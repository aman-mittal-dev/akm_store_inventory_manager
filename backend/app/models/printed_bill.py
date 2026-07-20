import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PrintedBill(Base):
    __tablename__ = "printed_bills"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    bill_number: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    bill_format: Mapped[str] = mapped_column(String(20), nullable=False)  # full | compact
    invoice_type: Mapped[str] = mapped_column(String(20), nullable=False)  # internal | customer
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    pdf_bytes: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
