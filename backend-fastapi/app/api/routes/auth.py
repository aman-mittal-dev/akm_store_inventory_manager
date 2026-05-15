from datetime import timedelta
from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    ApiResponse,
    GoogleAuthRequest,
    LoginRequest,
    SignupRequest,
    SubscriptionOut,
    UserOut,
)
from app.services.google_auth import verify_google_id_token

router = APIRouter(prefix="/auth", tags=["Auth"])

def _subscription_out(user: User) -> SubscriptionOut | None:
    if not user.stripe_subscription_id:
        return None
    return SubscriptionOut(
        status=user.subscription_status or "active",
        plan=(user.subscription_plan or "monthly"),
        start_date=user.subscription_start_at,
        end_date=user.subscription_current_period_end,
        amount_inr=user.subscription_amount_inr,
        custom_duration_months=user.subscription_custom_months,
        cancel_at_period_end=bool(user.subscription_cancel_at_period_end),
        stripe_subscription_id=user.stripe_subscription_id,
    )


def _serialize_user(user: User) -> dict:
    return UserOut(
        id=str(user.id),
        email=user.email,
        name=user.full_name,
        created_at=user.created_at,
        subscription=_subscription_out(user),
    ).model_dump(mode="json")


@router.post("/signup", response_model=ApiResponse)
def signup(res: Response, payload: SignupRequest, db: Session = Depends(get_db)):
    try:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None,
                "message": "Email already registered",
                "status": status.HTTP_400_BAD_REQUEST
            }

        user = User(email=payload.email, full_name=payload.name, password_hash=get_password_hash(payload.password))
        db.add(user)
        db.commit()
        db.refresh(user)

        token = create_access_token(subject=str(user.id),expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES))
        res.status_code = status.HTTP_200_OK
        return {
            "data": {
                "access_token": token,
                "user": _serialize_user(user)
            },
            "message": "Signup successful",
            "status": status.HTTP_201_CREATED
        }
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": f"An error occurred during signup: {str(e)}",
            "status": status.HTTP_400_BAD_REQUEST
        }


@router.post("/login", response_model=ApiResponse)
def login(res: Response, payload: LoginRequest, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.email == payload.email).first()
        if not user:
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None,
                "message": "Invalid email or password",
                "status": status.HTTP_400_BAD_REQUEST,
            }
        if not user.password_hash:
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None,
                "message": "This account uses Google sign-in. Please use Continue with Google.",
                "status": status.HTTP_400_BAD_REQUEST,
            }
        if not verify_password(payload.password, user.password_hash):
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None,
                "message": "Invalid email or password",
                "status": status.HTTP_400_BAD_REQUEST,
            }

        token = create_access_token(subject=str(user.id), expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES))
        res.status_code = status.HTTP_200_OK
        return {
            "data": {
                "access_token": token,
                "user": _serialize_user(user)
            },
            "message": "Login successful",
            "status": status.HTTP_200_OK
        }
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred during login " + str(e),
            "status": status.HTTP_400_BAD_REQUEST
        }


@router.post("/google", response_model=ApiResponse)
def login_with_google(res: Response, payload: GoogleAuthRequest, db: Session = Depends(get_db)):
    try:
        try:
            info = verify_google_id_token(payload.id_token)
        except ValueError as exc:
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None,
                "message": str(exc) or "Invalid Google token",
                "status": status.HTTP_400_BAD_REQUEST,
            }

        sub = info.get("sub")
        email = info.get("email")
        if not sub or not email:
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None,
                "message": "Google token missing email or subject",
                "status": status.HTTP_400_BAD_REQUEST,
            }

        name = str(info.get("name") or email.split("@")[0])[:255]

        user = db.query(User).filter(User.google_sub == sub).first()
        if user:
            token = create_access_token(
                subject=str(user.id),
                expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
            )
            res.status_code = status.HTTP_200_OK
            return {
                "data": {"access_token": token, "user": _serialize_user(user)},
                "message": "Login successful",
                "status": status.HTTP_200_OK,
            }

        user = db.query(User).filter(User.email == email).first()
        if user:
            if user.google_sub and user.google_sub != sub:
                res.status_code = status.HTTP_400_BAD_REQUEST
                return {
                    "data": None,
                    "message": "This email is linked to a different Google account",
                    "status": status.HTTP_400_BAD_REQUEST,
                }
            user.google_sub = sub
            user.full_name = name or user.full_name
            db.commit()
            db.refresh(user)
        else:
            user = User(email=email, full_name=name, password_hash=None, google_sub=sub)
            db.add(user)
            db.commit()
            db.refresh(user)

        token = create_access_token(
            subject=str(user.id),
            expires_delta=timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES),
        )
        res.status_code = status.HTTP_200_OK
        return {
            "data": {"access_token": token, "user": _serialize_user(user)},
            "message": "Login successful",
            "status": status.HTTP_200_OK,
        }
    except Exception:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred during Google sign-in",
            "status": status.HTTP_400_BAD_REQUEST,
        }


@router.get("/me", response_model=ApiResponse)
def me(res: Response, current_user: User = Depends(get_current_user)):
    try:
        res.status_code = status.HTTP_200_OK
        return {
            "data": {"user": _serialize_user(current_user)},
            "message": "Success",
            "status": status.HTTP_200_OK
        }
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred while fetching user details",
            "status": status.HTTP_400_BAD_REQUEST
        }