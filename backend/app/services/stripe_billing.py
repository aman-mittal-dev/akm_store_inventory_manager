from __future__ import annotations
import logging
import uuid
from datetime import datetime, timezone
from typing import Any
import stripe
from sqlalchemy.orm import Session
from app.core.config import settings
from app.models.user import User

logger = logging.getLogger(__name__)

APP_PLANS = frozenset({"monthly", "quarterly", "annual", "custom"})

def ensure_stripe_configured() -> None:
    if not settings.STRIPE_SECRET_KEY:
        raise RuntimeError("Stripe is not configured (missing STRIPE_SECRET_KEY)")


def configure_stripe() -> None:
    stripe.api_key = settings.STRIPE_SECRET_KEY


def catalog_base_amount_inr(plan: str, custom_months: int | None = None) -> int:
    MONTHLY_PRICE = 199

    if plan == "monthly":
        return MONTHLY_PRICE

    if plan == "quarterly":
        # 3 months with 5% discount
        return round(MONTHLY_PRICE * 3 * 0.95)

    if plan == "annual":
        # 12 months with 15% discount
        return round(MONTHLY_PRICE * 12 * 0.85)

    if plan == "custom":
        n = custom_months or 1
        n = max(1, min(n, 60))

        # 1–2 months → 0%
        if n <= 2:
            discount = 0

        # 3–5 months → 5%
        elif 3 <= n <= 5:
            discount = 5

        # 6–11 months → 10%
        elif 6 <= n <= 11:
            discount = 10

        # 12–17 months → 15%
        elif 12 <= n <= 17:
            discount = 15

        # 18–23 months → 20%
        elif 18 <= n <= 23:
            discount = 20

        # 24+ months → 25%
        else:
            discount = 25

        total = MONTHLY_PRICE * n
        final_price = total - (total * discount / 100)

        return round(final_price)

    raise ValueError(f"Unknown plan {plan!r}")

def total_inr_with_gst(base_inr: int) -> int:
    return int(round(base_inr * 1.18))


def rupees_to_paise_inr(rupees: int) -> int:
    return int(rupees) * 100


def normalize_stripe_to_app_status(stripe_status: str) -> str:
    s = (stripe_status or "").strip()
    if s == "trialing":
        return "trial"
    if s == "active":
        return "active"
    if s in ("canceled", "cancelled"):
        return "cancelled"
    if s in ("past_due", "unpaid", "incomplete", "incomplete_expired"):
        return "expired"
    return "expired"


def _stripe_ts_to_aware_utc(ts: int | None) -> datetime | None:
    if not ts:
        return None
    return datetime.fromtimestamp(int(ts), tz=timezone.utc)


def _get(sub: Any, key: str, default: Any = None) -> Any:
    if isinstance(sub, dict):
        return sub.get(key, default)
    return getattr(sub, key, default)


def _meta_dict(sub: Any) -> dict[str, Any]:
    meta = _get(sub, "metadata") or {}
    if isinstance(meta, dict):
        return dict(meta)
    try:
        return dict(meta)
    except Exception:
        return {}


def _parse_custom_months(meta: dict[str, Any]) -> int | None:
    raw = meta.get("custom_months")
    if raw in (None, "", False):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def apply_stripe_subscription_to_user(user: User, sub: Any) -> None:
    meta = _meta_dict(sub)
    plan = str(meta.get("app_plan") or user.subscription_plan or "monthly")
    if plan not in APP_PLANS:
        plan = "monthly"

    custom_m = _parse_custom_months(meta)
    if plan != "custom":
        custom_m = None

    amt_raw = meta.get("amount_inr_base")
    if amt_raw not in (None, "", False):
        try:
            amount_inr = int(amt_raw)
        except (TypeError, ValueError):
            amount_inr = catalog_base_amount_inr(plan, custom_m)
    else:
        amount_inr = catalog_base_amount_inr(plan, custom_m)

    stripe_status = str(_get(sub, "status") or "")
    status = normalize_stripe_to_app_status(stripe_status)

    sub_id = _get(sub, "id")
    if sub_id:
        user.stripe_subscription_id = str(sub_id)

    cust = _get(sub, "customer")
    if cust and not user.stripe_customer_id:
        user.stripe_customer_id = str(cust)

    user.subscription_status = status
    user.subscription_plan = plan
    user.subscription_start_at = _stripe_ts_to_aware_utc(_get(sub, "start_date"))
    user.subscription_current_period_end = _stripe_ts_to_aware_utc(_get(sub, "current_period_end"))
    user.subscription_cancel_at_period_end = bool(_get(sub, "cancel_at_period_end") or False)
    user.subscription_amount_inr = amount_inr
    user.subscription_custom_months = custom_m


def sync_user_from_stripe_subscription_id(db: Session, user: User, subscription_id: str) -> None:
    configure_stripe()
    sub = stripe.Subscription.retrieve(subscription_id)
    apply_stripe_subscription_to_user(user, sub)
    cid = _get(sub, "customer")
    if cid and not user.stripe_customer_id:
        user.stripe_customer_id = str(cid)
    db.add(user)


def ensure_stripe_customer(db: Session, user: User) -> str:
    configure_stripe()
    if user.stripe_customer_id:
        return user.stripe_customer_id
    c = stripe.Customer.create(
        email=user.email,
        name=user.full_name,
        metadata={"user_id": str(user.id)},
    )
    user.stripe_customer_id = c.id
    db.add(user)
    db.commit()
    db.refresh(user)
    return str(c.id)


def _env_price_id_for_plan(plan: str) -> str | None:
    if plan == "monthly" and settings.STRIPE_PRICE_MONTHLY:
        return settings.STRIPE_PRICE_MONTHLY
    if plan == "quarterly" and settings.STRIPE_PRICE_QUARTERLY:
        return settings.STRIPE_PRICE_QUARTERLY
    if plan == "annual" and settings.STRIPE_PRICE_ANNUAL:
        return settings.STRIPE_PRICE_ANNUAL
    return None


def _line_item_for_plan(plan: str, custom_months: int | None) -> dict[str, Any]:
    env_price = _env_price_id_for_plan(plan)
    if env_price:
        return {"price": env_price, "quantity": 1}

    base = catalog_base_amount_inr(plan, custom_months)
    inclusive = total_inr_with_gst(base)
    paise = rupees_to_paise_inr(inclusive)

    if plan == "monthly":
        interval, interval_count, name = "month", 1, "Monthly plan"
    elif plan == "quarterly":
        interval, interval_count, name = "month", 3, "Quarterly plan"
    elif plan == "annual":
        interval, interval_count, name = "month", 12, "Annual plan"
    else:
        n = custom_months or 6
        n = max(1, min(n, 60))
        interval, interval_count, name = "month", n, f"Custom {n}-month plan"

    return {
        "price_data": {
            "currency": "inr",
            "product_data": {"name": name},
            "unit_amount": paise,
            "recurring": {"interval": interval, "interval_count": interval_count},
        },
        "quantity": 1,
    }


def create_checkout_session_url(db: Session, user: User, plan: str, custom_months: int | None) -> str:
    ensure_stripe_configured()
    configure_stripe()

    if plan == "custom" and (custom_months is None or custom_months < 1):
        raise ValueError("custom_months is required for the custom plan")

    base = catalog_base_amount_inr(plan, custom_months)
    cust_id = ensure_stripe_customer(db, user)

    cm = str(custom_months) if plan == "custom" and custom_months else ""
    meta = {
        "user_id": str(user.id),
        "app_plan": plan,
        "custom_months": cm,
        "amount_inr_base": str(base),
    }

    base_fe = settings.FRONTEND_BASE_URL.rstrip("/")
    success_url = f"{base_fe}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{base_fe}/checkout?canceled=1"

    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=cust_id,
        client_reference_id=str(user.id),
        line_items=[_line_item_for_plan(plan, custom_months)],
        success_url=success_url,
        cancel_url=cancel_url,
        subscription_data={"metadata": dict(meta)},
        metadata=dict(meta),
        allow_promotion_codes=True,
    )
    url = getattr(session, "url", None)
    if not url:
        raise RuntimeError("Stripe did not return a checkout URL")
    return str(url)


def create_billing_portal_url(db: Session, user: User) -> str:
    ensure_stripe_configured()
    configure_stripe()
    if not user.stripe_customer_id:
        ensure_stripe_customer(db, user)
    session = stripe.billing_portal.Session.create(
        customer=str(user.stripe_customer_id),
        return_url=f"{settings.FRONTEND_BASE_URL.rstrip('/')}/account",
    )
    u = getattr(session, "url", None)
    if not u:
        raise RuntimeError("Stripe did not return a portal URL")
    return str(u)


def verify_checkout_session_for_user(db: Session, user: User, session_id: str) -> None:
    configure_stripe()
    sess = stripe.checkout.Session.retrieve(session_id, expand=["subscription"])
    if getattr(sess, "payment_status", None) != "paid":
        raise ValueError("Checkout session is not paid yet")

    ref = getattr(sess, "client_reference_id", None) or _meta_dict(sess).get("user_id")
    if not ref or str(ref) != str(user.id):
        raise PermissionError("This checkout session does not belong to your account")

    sub = getattr(sess, "subscription", None)
    sub_id: str | None
    if isinstance(sub, dict):
        sub_id = sub.get("id")
    elif sub is not None:
        sub_id = getattr(sub, "id", None)
    else:
        sub_id = None
    if not sub_id:
        raise ValueError("No subscription is attached to this checkout session")

    sync_user_from_stripe_subscription_id(db, user, str(sub_id))


def _resolve_user_for_subscription_event(db: Session, obj: dict[str, Any]) -> User | None:
    cust_id = obj.get("customer")
    if cust_id:
        u = db.query(User).filter(User.stripe_customer_id == str(cust_id)).first()
        if u:
            return u
    meta = obj.get("metadata") or {}
    uid = meta.get("user_id")
    if uid:
        try:
            uu = uuid.UUID(str(uid))
        except ValueError:
            uu = None
        if uu:
            u = db.query(User).filter(User.id == uu).first()
            if u:
                return u
    sub_id = obj.get("id")
    if sub_id:
        return db.query(User).filter(User.stripe_subscription_id == str(sub_id)).first()
    return None


def _as_dict(obj: Any) -> dict[str, Any]:
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    to = getattr(obj, "to_dict", None)
    if callable(to):
        return to()
    try:
        return dict(obj)
    except Exception:
        return {}


def handle_webhook_event(db: Session, event: Any) -> None:
    configure_stripe()
    if hasattr(event, "to_dict"):
        event = event.to_dict()
    elif not isinstance(event, dict):
        try:
            event = dict(event)
        except Exception:
            event = {}

    etype = event.get("type")
    raw_obj = (event.get("data") or {}).get("object")
    obj = _as_dict(raw_obj)

    if etype == "checkout.session.completed":
        if obj.get("mode") != "subscription":
            return
        sub_id = obj.get("subscription")
        if not sub_id:
            return
        uid = obj.get("client_reference_id") or (obj.get("metadata") or {}).get("user_id")
        if not uid:
            logger.warning("checkout.session.completed missing user reference")
            return
        try:
            uu = uuid.UUID(str(uid))
        except ValueError:
            logger.warning("checkout.session.completed invalid user id %s", uid)
            return
        user = db.query(User).filter(User.id == uu).first()
        if not user:
            logger.warning("checkout.session.completed unknown user %s", uid)
            return
        sync_user_from_stripe_subscription_id(db, user, str(sub_id))
        return

    if etype in ("customer.subscription.updated", "customer.subscription.deleted"):
        user = _resolve_user_for_subscription_event(db, obj)
        if not user:
            logger.warning("subscription event: user not found type=%s", etype)
            return
        sub_id = obj.get("id")
        if not sub_id:
            return
        if etype == "customer.subscription.deleted":
            apply_stripe_subscription_to_user(user, obj)
            user.subscription_status = "cancelled"
            ended = obj.get("ended_at") or obj.get("canceled_at")
            if ended:
                user.subscription_current_period_end = _stripe_ts_to_aware_utc(int(ended))
            db.add(user)
            return
        sync_user_from_stripe_subscription_id(db, user, str(sub_id))
        return

    if etype == "invoice.payment_failed":
        sub_id = obj.get("subscription")
        if not sub_id:
            return
        user = db.query(User).filter(User.stripe_subscription_id == str(sub_id)).first()
        if user:
            user.subscription_status = "expired"
            db.add(user)
