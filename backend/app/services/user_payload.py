"""Serialize User models for API responses (auth + payments)."""

from app.models.user import User
from app.schemas.auth import SubscriptionOut, UserOut


def subscription_out(user: User) -> SubscriptionOut | None:
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


def serialize_user(user: User) -> dict:
    return UserOut(
        id=str(user.id),
        email=user.email,
        name=user.full_name,
        created_at=user.created_at,
        subscription=subscription_out(user),
    ).model_dump(mode="json")
