"""Resolve PDFs, call providers, and update BillDelivery rows."""

from __future__ import annotations

import base64
import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.bill_delivery import BillDelivery
from app.models.bill_pdf_token import BillPdfPublicToken
from app.models.printed_bill import PrintedBill
from app.services.email_sendgrid import send_invoice_email_sendgrid
from app.services.email_smtp import send_invoice_email_smtp
from app.services.whatsapp_meta import send_whatsapp_meta_document
from app.services.whatsapp_twilio import send_whatsapp_twilio_pdf_url, send_whatsapp_twilio_text_only

logger = logging.getLogger(__name__)


def decode_pdf_base64(pdf_base64: str) -> bytes:
    try:
        raw = base64.b64decode(pdf_base64, validate=True)
    except Exception as exc:  # noqa: BLE001
        raise ValueError("Invalid PDF payload (base64)") from exc
    if not raw:
        raise ValueError("PDF payload is empty")
    return raw


def get_latest_printed_bill(
    db: Session, *, owner_id: uuid.UUID, bill_number: str
) -> PrintedBill | None:
    return (
        db.query(PrintedBill)
        .filter(PrintedBill.owner_id == owner_id, PrintedBill.bill_number == bill_number)
        .order_by(PrintedBill.created_at.desc())
        .first()
    )


def ensure_printed_bill_id(
    db: Session,
    *,
    owner_id: uuid.UUID,
    bill_number: str,
    pdf_base64: str | None,
    bill_format: str,
    invoice_type: str,
    file_name: str | None,
) -> uuid.UUID:
    """Return printed_bill pk — from new upload or latest existing row."""
    if pdf_base64 and pdf_base64.strip():
        raw = decode_pdf_base64(pdf_base64)
        fn = (file_name or f"{bill_number}.pdf").strip() or f"{bill_number}.pdf"
        rec = PrintedBill(
            owner_id=owner_id,
            bill_number=bill_number,
            bill_format=bill_format,
            invoice_type=invoice_type,
            file_name=fn,
            pdf_bytes=raw,
        )
        db.add(rec)
        db.flush()
        return rec.id

    latest = get_latest_printed_bill(db, owner_id=owner_id, bill_number=bill_number)
    if not latest:
        raise ValueError(
            "No saved bill PDF found. Use Print Bill once, or include pdfBase64 in the request."
        )
    return latest.id


def _public_pdf_url_for_twilio(
    db: Session,
    *,
    owner_id: uuid.UUID,
    pdf_bytes: bytes,
    file_name: str,
    printed_bill_id: uuid.UUID | None,
) -> str:
    base = settings.PUBLIC_BASE_URL.strip().rstrip("/")
    if not base:
        raise ValueError(
            "PUBLIC_BASE_URL is required for Twilio WhatsApp with PDF (Twilio must fetch MediaUrl)."
        )

    token = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(hours=48)
    rec = BillPdfPublicToken(
        token=token,
        owner_id=owner_id,
        printed_bill_id=printed_bill_id,
        pdf_bytes=pdf_bytes if printed_bill_id is None else None,
        file_name=file_name or "bill.pdf",
        expires_at=expires_at,
    )
    db.add(rec)
    db.flush()

    return f"{base}{settings.API_V1_PREFIX}/public/bill-pdf/{token}"


def execute_delivery(db: Session, delivery_id: uuid.UUID) -> None:
    row = db.query(BillDelivery).filter(BillDelivery.id == delivery_id).first()
    if not row or row.status == "sent":
        return

    pb = (
        db.query(PrintedBill)
        .filter(PrintedBill.id == row.printed_bill_id, PrintedBill.owner_id == row.owner_id)
        .first()
    )
    if not pb:
        row.status = "failed"
        row.error_message = "Linked printed bill PDF was not found."
        db.commit()
        return

    pdf_bytes, attach_name = pb.pdf_bytes, pb.file_name
    printed_bill_id = pb.id

    row.status = "sending"
    db.commit()
    db.refresh(row)

    subject = f"Invoice {row.bill_number}"
    plain = f"Please find attached invoice {row.bill_number}."

    try:
        msg_id: str
        channel = row.channel.lower()
        provider = row.provider.lower()

        if channel == "email":
            if provider == "sendgrid":
                msg_id = send_invoice_email_sendgrid(
                    to_email=row.recipient_email or "",
                    subject=subject,
                    plain_body=plain,
                    pdf_bytes=pdf_bytes,
                    attachment_file_name=attach_name,
                )
            elif provider == "smtp_brevo":
                msg_id = send_invoice_email_smtp(
                    to_email=row.recipient_email or "",
                    subject=subject,
                    plain_body=plain,
                    pdf_bytes=pdf_bytes,
                    attachment_file_name=attach_name,
                )
            else:
                raise RuntimeError(f"Unsupported email provider: {provider}")

        elif channel == "whatsapp":
            phone = row.recipient_phone_e164 or ""
            caption = f"Invoice {row.bill_number}"
            if provider == "meta_whatsapp":
                msg_id = send_whatsapp_meta_document(
                    to_e164=phone,
                    pdf_bytes=pdf_bytes,
                    file_name=attach_name,
                    caption=caption,
                )
            elif provider == "twilio_whatsapp":
                body = f"{caption}\n\nOpen the attached PDF."
                if settings.PUBLIC_BASE_URL.strip():
                    media_url = _public_pdf_url_for_twilio(
                        db,
                        owner_id=row.owner_id,
                        pdf_bytes=pdf_bytes,
                        file_name=attach_name,
                        printed_bill_id=printed_bill_id,
                    )
                    db.commit()
                    msg_id = send_whatsapp_twilio_pdf_url(
                        to_e164=phone,
                        body_text=body,
                        media_https_url=media_url,
                    )
                elif settings.TWILIO_WHATSAPP_TEXT_ONLY_IF_NO_PUBLIC_URL:
                    text_body = (
                        f"{caption}\n\n"
                        "PDF attachment skipped: set PUBLIC_BASE_URL to a public HTTPS URL so Twilio can fetch the file, "
                        "or use Meta WhatsApp for direct PDF upload."
                    )
                    msg_id = send_whatsapp_twilio_text_only(to_e164=phone, body_text=text_body)
                else:
                    raise ValueError(
                        "PUBLIC_BASE_URL must be set for Twilio WhatsApp PDF delivery, or enable "
                        "TWILIO_WHATSAPP_TEXT_ONLY_IF_NO_PUBLIC_URL."
                    )
            else:
                raise RuntimeError(f"Unsupported WhatsApp provider: {provider}")
        else:
            raise RuntimeError(f"Unsupported channel: {channel}")

        row.status = "sent"
        row.sent_at = datetime.now(timezone.utc)
        row.provider_message_id = (msg_id or "")[:255]
        row.error_message = None
        db.add(row)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Delivery %s failed", delivery_id)
        row.status = "failed"
        row.error_message = str(exc)[:4000]
        row.sent_at = None
        db.add(row)
        db.commit()


def process_due_scheduled(db: Session) -> int:
    now = datetime.now(timezone.utc)
    due = (
        db.query(BillDelivery)
        .filter(BillDelivery.status == "scheduled")
        .filter(BillDelivery.scheduled_at.is_not(None))  # type: ignore[union-attr]
        .filter(BillDelivery.scheduled_at <= now)  # type: ignore[operator]
        .all()
    )
    n = 0
    for r in due:
        execute_delivery(db, r.id)
        n += 1
    return n
