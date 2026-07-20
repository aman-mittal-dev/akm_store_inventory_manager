import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BillDelivery(Base):
    __tablename__ = "bill_deliveries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    bill_number: Mapped[str] = mapped_column(String(120), nullable=False, index=True)

    printed_bill_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("printed_bills.id"), nullable=True
    )

    channel: Mapped[str] = mapped_column(String(32), nullable=False)  # email | whatsapp
    provider: Mapped[str] = mapped_column(String(64), nullable=False)  # sendgrid | smtp_brevo | ...

    recipient_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recipient_phone_e164: Mapped[str | None] = mapped_column(String(32), nullable=True)

    send_mode: Mapped[str] = mapped_column(String(20), nullable=False)  # immediate | scheduled
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    # pending | scheduled | sending | sent | failed

    is_resend: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
