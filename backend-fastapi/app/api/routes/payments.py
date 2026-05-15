from __future__ import annotations

import logging

import stripe
from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import ApiResponse
from app.services import stripe_billing

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments", tags=["Payments"])

_VALID_PLANS = frozenset({"monthly", "quarterly", "annual", "custom"})


class StripeCheckoutCreate(BaseModel):
    plan: str
    custom_months: int | None = Field(None, ge=1, le=60)


class VerifySessionBody(BaseModel):
    session_id: str = Field(..., min_length=8)


@router.get("/stripe/public-config", response_model=ApiResponse)
def stripe_public_config(res: Response):
    res.status_code = status.HTTP_200_OK
    return {
        "data": {"publishable_key": settings.STRIPE_PUBLISHABLE_KEY or None},
        "message": "OK",
        "status": status.HTTP_200_OK,
    }


@router.post("/stripe/create-checkout-session", response_model=ApiResponse)
def stripe_create_checkout(
    res: Response,
    body: StripeCheckoutCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.plan not in _VALID_PLANS:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "Invalid plan",
            "status": status.HTTP_400_BAD_REQUEST,
        }
    if body.plan == "custom" and body.custom_months is None:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "custom_months is required for the custom plan",
            "status": status.HTTP_400_BAD_REQUEST,
        }
    try:
        url = stripe_billing.create_checkout_session_url(db, user, body.plan, body.custom_months)
    except RuntimeError as exc:
        res.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"data": None, "message": str(exc), "status": status.HTTP_503_SERVICE_UNAVAILABLE}
    except ValueError as exc:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {"data": None, "message": str(exc), "status": status.HTTP_400_BAD_REQUEST}
    except Exception:
        logger.exception("Stripe checkout failed")
        res.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {
            "data": None,
            "message": "Could not start checkout",
            "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
        }

    res.status_code = status.HTTP_200_OK
    return {
        "data": {"checkout_url": url},
        "message": "OK",
        "status": status.HTTP_200_OK,
    }


@router.post("/stripe/billing-portal", response_model=ApiResponse)
def stripe_billing_portal(
    res: Response,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        stripe_billing.ensure_stripe_configured()
        url = stripe_billing.create_billing_portal_url(db, user)
    except RuntimeError as exc:
        res.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"data": None, "message": str(exc), "status": status.HTTP_503_SERVICE_UNAVAILABLE}
    except Exception:
        logger.exception("Stripe billing portal failed")
        res.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {
            "data": None,
            "message": "Could not open billing portal",
            "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
        }

    res.status_code = status.HTTP_200_OK
    return {"data": {"portal_url": url}, "message": "OK", "status": status.HTTP_200_OK}


@router.post("/stripe/verify-checkout-session", response_model=ApiResponse)
def stripe_verify_session(
    res: Response,
    body: VerifySessionBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        stripe_billing.ensure_stripe_configured()
        stripe_billing.verify_checkout_session_for_user(db, user, body.session_id.strip())
        db.commit()
    except PermissionError as exc:
        db.rollback()
        res.status_code = status.HTTP_403_FORBIDDEN
        return {"data": None, "message": str(exc), "status": status.HTTP_403_FORBIDDEN}
    except ValueError as exc:
        db.rollback()
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {"data": None, "message": str(exc), "status": status.HTTP_400_BAD_REQUEST}
    except RuntimeError as exc:
        db.rollback()
        res.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"data": None, "message": str(exc), "status": status.HTTP_503_SERVICE_UNAVAILABLE}
    except Exception:
        db.rollback()
        logger.exception("verify checkout session")
        res.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return {
            "data": None,
            "message": "Could not verify session",
            "status": status.HTTP_500_INTERNAL_SERVER_ERROR,
        }

    res.status_code = status.HTTP_200_OK
    return {"data": {"ok": True}, "message": "Subscription updated", "status": status.HTTP_200_OK}


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    if not settings.STRIPE_WEBHOOK_SECRET:
        return Response(status_code=503, content="Webhook is not configured")

    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    if not sig:
        return Response(status_code=400, content="Missing stripe-signature header")

    try:
        event = stripe.Webhook.construct_event(
            payload,
            sig,
            settings.STRIPE_WEBHOOK_SECRET,
        )
    except ValueError:
        return Response(status_code=400, content="Invalid payload")
    except stripe.error.SignatureVerificationError:
        return Response(status_code=400, content="Invalid signature")

    try:
        stripe_billing.ensure_stripe_configured()
        stripe_billing.handle_webhook_event(db, event)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Stripe webhook processing failed")
        return Response(status_code=500, content="Webhook handler error")

    return {"received": True}
