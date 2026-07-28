from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    refresh_token_expiry,
)
from app.models.refresh_token import RefreshToken
from app.models.user import User


def issue_token_pair(db: Session, user: User) -> dict[str, str]:
    """
    Issue access + refresh tokens for password or Google auth.
    Refresh tokens are stored hashed so they can be revoked.
    """
    access_token = create_access_token(subject=str(user.id))
    raw_refresh = generate_refresh_token()

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw_refresh),
            expires_at=refresh_token_expiry(),
        )
    )
    db.commit()

    return {
        "access_token": access_token,
        "refresh_token": raw_refresh,
        "token_type": "bearer",
    }


def rotate_refresh_token(db: Session, raw_refresh: str) -> tuple[User, dict[str, str]] | None:
    """
    Validate a refresh token, revoke it, and issue a new pair (rotation).
    Returns None if the token is invalid, expired, or already revoked.
    """
    token_hash = hash_refresh_token(raw_refresh)
    row = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if not row or row.revoked_at is not None:
        return None

    now = datetime.now(timezone.utc)
    expires = row.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= now:
        row.revoked_at = now
        db.commit()
        return None

    user = db.query(User).filter(User.id == row.user_id).first()
    if not user or not user.is_active:
        row.revoked_at = now
        db.commit()
        return None

    row.revoked_at = now
    db.commit()

    return user, issue_token_pair(db, user)


def revoke_refresh_token(db: Session, raw_refresh: str) -> bool:
    """Revoke a refresh token (logout). Returns True if a token was found."""
    token_hash = hash_refresh_token(raw_refresh)
    row = db.query(RefreshToken).filter(RefreshToken.token_hash == token_hash).first()
    if not row:
        return False
    if row.revoked_at is None:
        row.revoked_at = datetime.now(timezone.utc)
        db.commit()
    return True


def revoke_all_user_refresh_tokens(db: Session, user_id) -> None:
    """Optional hard logout across devices."""
    now = datetime.now(timezone.utc)
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked_at.is_(None),
    ).update({"revoked_at": now}, synchronize_session=False)
    db.commit()
