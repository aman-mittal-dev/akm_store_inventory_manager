"""Send bill PDF via SendGrid REST API v3."""

from __future__ import annotations

import base64

import httpx

from app.core.config import settings


def send_invoice_email_sendgrid(
    *,
    to_email: str,
    subject: str,
    plain_body: str,
    pdf_bytes: bytes,
    attachment_file_name: str,
) -> str:
    if not settings.SENDGRID_API_KEY:
        raise ValueError("SENDGRID_API_KEY is not configured in the backend environment.")

    from_email = settings.EMAIL_FROM_ADDRESS
    if not from_email:
        raise ValueError("EMAIL_FROM_ADDRESS is not configured.")

    payload = {
        "personalizations": [{"to": [{"email": to_email.strip()}]}],
        "from": {"email": from_email, "name": settings.EMAIL_FROM_NAME or "Invoice"},
        "subject": subject,
        "content": [{"type": "text/plain", "value": plain_body}],
        "attachments": [
            {
                "content": base64.b64encode(pdf_bytes).decode("ascii"),
                "type": "application/pdf",
                "filename": attachment_file_name,
                "disposition": "attachment",
            }
        ],
    }

    with httpx.Client(timeout=60.0) as client:
        r = client.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={
                "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
    if r.status_code not in (200, 202):
        err = r.text[:500]
        raise RuntimeError(f"SendGrid error {r.status_code}: {err}")

    return (r.headers.get("X-Message-Id") or "").strip() or "sendgrid-accepted"
