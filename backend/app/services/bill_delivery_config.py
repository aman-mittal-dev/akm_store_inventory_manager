"""Resolve which bill-delivery channels are configured (credentials live in env only)."""

from __future__ import annotations

from app.core.config import settings


def email_provider_configured() -> bool:
    if settings.SENDGRID_API_KEY.strip() and settings.EMAIL_FROM_ADDRESS.strip():
        return True
    if settings.SMTP_HOST.strip() and settings.SMTP_FROM_EMAIL.strip():
        return True
    return False


def whatsapp_provider_configured() -> bool:
    if settings.META_WHATSAPP_PHONE_NUMBER_ID.strip() and settings.META_WHATSAPP_ACCESS_TOKEN.strip():
        return True
    if (
        settings.TWILIO_ACCOUNT_SID.strip()
        and settings.TWILIO_AUTH_TOKEN.strip()
        and settings.TWILIO_WHATSAPP_FROM.strip()
    ):
        return True
    return False


def resolve_email_provider() -> str | None:
    """Prefer SendGrid when configured, otherwise SMTP/Brevo."""
    if settings.SENDGRID_API_KEY.strip() and settings.EMAIL_FROM_ADDRESS.strip():
        return "sendgrid"
    if settings.SMTP_HOST.strip() and settings.SMTP_FROM_EMAIL.strip():
        return "smtp_brevo"
    return None


def resolve_whatsapp_provider() -> str | None:
    """Prefer Meta Cloud API when configured, otherwise Twilio."""
    if settings.META_WHATSAPP_PHONE_NUMBER_ID.strip() and settings.META_WHATSAPP_ACCESS_TOKEN.strip():
        return "meta_whatsapp"
    if (
        settings.TWILIO_ACCOUNT_SID.strip()
        and settings.TWILIO_AUTH_TOKEN.strip()
        and settings.TWILIO_WHATSAPP_FROM.strip()
    ):
        return "twilio_whatsapp"
    return None


def delivery_config_public() -> dict[str, bool]:
    return {
        "emailEnabled": email_provider_configured(),
        "whatsappEnabled": whatsapp_provider_configured(),
    }
