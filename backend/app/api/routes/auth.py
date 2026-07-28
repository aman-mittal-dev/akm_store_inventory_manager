from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import get_password_hash, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    ApiResponse,
    GoogleAuthRequest,
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
    SignupRequest,
)
from app.services.google_auth import verify_google_id_token
from app.services.token_service import issue_token_pair, revoke_refresh_token, rotate_refresh_token
from app.services.user_payload import serialize_user

router = APIRouter(prefix="/auth", tags=["Auth"])


def _auth_success_payload(db: Session, user: User) -> dict:
    tokens = issue_token_pair(db, user)
    return {
        **tokens,
        "user": serialize_user(user),
    }


@router.post("/signup", response_model=ApiResponse)
def signup(res: Response, payload: SignupRequest, db: Session = Depends(get_db)):
    try:
        existing = db.query(User).filter(User.email == payload.email).first()
        if existing:
            res.status_code = status.HTTP_400_BAD_REQUEST
            return {
                "data": None,
                "message": "Email already registered",
                "status": status.HTTP_400_BAD_REQUEST,
            }

        user = User(
            email=payload.email,
            full_name=payload.name,
            password_hash=get_password_hash(payload.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        res.status_code = status.HTTP_200_OK
        return {
            "data": _auth_success_payload(db, user),
            "message": "Signup successful",
            "status": status.HTTP_201_CREATED,
        }
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": f"An error occurred during signup: {str(e)}",
            "status": status.HTTP_400_BAD_REQUEST,
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

        res.status_code = status.HTTP_200_OK
        return {
            "data": _auth_success_payload(db, user),
            "message": "Login successful",
            "status": status.HTTP_200_OK,
        }
    except Exception as e:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred during login " + str(e),
            "status": status.HTTP_400_BAD_REQUEST,
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
            res.status_code = status.HTTP_200_OK
            return {
                "data": _auth_success_payload(db, user),
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

        res.status_code = status.HTTP_200_OK
        return {
            "data": _auth_success_payload(db, user),
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


@router.post("/refresh", response_model=ApiResponse)
def refresh_tokens(res: Response, payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access + refresh pair (rotation)."""
    try:
        result = rotate_refresh_token(db, payload.refresh_token)
        if not result:
            res.status_code = status.HTTP_401_UNAUTHORIZED
            return {
                "data": None,
                "message": "Invalid or expired refresh token",
                "status": status.HTTP_401_UNAUTHORIZED,
            }

        user, tokens = result
        res.status_code = status.HTTP_200_OK
        return {
            "data": {
                **tokens,
                "user": serialize_user(user),
            },
            "message": "Token refreshed",
            "status": status.HTTP_200_OK,
        }
    except Exception:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred while refreshing tokens",
            "status": status.HTTP_400_BAD_REQUEST,
        }


@router.post("/logout", response_model=ApiResponse)
def logout(res: Response, payload: LogoutRequest, db: Session = Depends(get_db)):
    """Revoke the presented refresh token so it cannot be reused."""
    try:
        revoke_refresh_token(db, payload.refresh_token)
        res.status_code = status.HTTP_200_OK
        return {
            "data": None,
            "message": "Logged out",
            "status": status.HTTP_200_OK,
        }
    except Exception:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred during logout",
            "status": status.HTTP_400_BAD_REQUEST,
        }


@router.get("/me", response_model=ApiResponse)
def me(res: Response, current_user: User = Depends(get_current_user)):
    try:
        res.status_code = status.HTTP_200_OK
        return {
            "data": {"user": serialize_user(current_user)},
            "message": "Success",
            "status": status.HTTP_200_OK,
        }
    except Exception:
        res.status_code = status.HTTP_400_BAD_REQUEST
        return {
            "data": None,
            "message": "An error occurred while fetching user details",
            "status": status.HTTP_400_BAD_REQUEST,
        }
