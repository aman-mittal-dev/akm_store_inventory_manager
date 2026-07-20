"""Send bill PDF via SMTP (Brevo / Sendinblue and other providers)."""

from __future__ import annotations

from email.message import EmailMessage
from email.utils import formataddr
import smtplib

from app.core.config import settings


def send_invoice_email_smtp(
    *,
    to_email: str,
    subject: str,
    plain_body: str,
    pdf_bytes: bytes,
    attachment_file_name: str,
) -> str:
    host = settings.SMTP_HOST
    port = settings.SMTP_PORT
    user = settings.SMTP_USER
    password = settings.SMTP_PASSWORD
    from_email = settings.SMTP_FROM_EMAIL or user
    if not host or not from_email:
        raise ValueError("SMTP_HOST and SMTP_FROM_EMAIL (or SMTP_USER) must be configured.")

    msg = EmailMessage()
    display_name = settings.EMAIL_FROM_NAME or "Invoice"
    msg["Subject"] = subject
    msg["From"] = formataddr((display_name, from_email))
    msg["To"] = to_email.strip()
    msg.set_content(plain_body)
    msg.add_attachment(
        pdf_bytes, maintype="application", subtype="pdf", filename=attachment_file_name
    )

    if settings.SMTP_USE_SSL:
        with smtplib.SMTP_SSL(host, port, timeout=60) as smtp:
            if user and password:
                smtp.login(user, password)
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=60) as smtp:
            smtp.ehlo()
            if settings.SMTP_USE_TLS:
                smtp.starttls()
            if user and password:
                smtp.login(user, password)
            smtp.send_message(msg)

    return "smtp-sent"
