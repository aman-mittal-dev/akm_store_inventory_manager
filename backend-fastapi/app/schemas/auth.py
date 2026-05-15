from datetime import datetime

from pydantic import AliasChoices, BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=2, max_length=255)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SubscriptionOut(BaseModel):
    status: str
    plan: str
    start_date: datetime | None = None
    end_date: datetime | None = None
    amount_inr: int | None = None
    custom_duration_months: int | None = None
    cancel_at_period_end: bool = False
    stripe_subscription_id: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    created_at: datetime
    subscription: SubscriptionOut | None = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

class ApiResponse(BaseModel):
    data: dict | None = None
    message: str
    status: int


class GoogleAuthRequest(BaseModel):
    id_token: str = Field(
        min_length=10,
        validation_alias=AliasChoices("id_token", "idToken"),
        description="Google ID token (JWT) from the client",
    )