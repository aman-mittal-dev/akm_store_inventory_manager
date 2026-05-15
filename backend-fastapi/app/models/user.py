import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    subscription_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    subscription_plan: Mapped[str | None] = mapped_column(String(32), nullable=True)
    subscription_start_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    subscription_current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    subscription_cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    subscription_amount_inr: Mapped[int | None] = mapped_column(Integer, nullable=True)
    subscription_custom_months: Mapped[int | None] = mapped_column(Integer, nullable=True)

    items = relationship("Item", back_populates="owner", cascade="all, delete-orphan")
