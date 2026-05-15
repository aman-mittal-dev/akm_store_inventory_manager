"""Twilio WhatsApp — PDF is delivered via a short-lived public HTTPS URL (MediaUrl)."""

from __future__ import annotations

import httpx

from app.core.config import settings


def send_whatsapp_twilio_pdf_url(
    *,
    to_e164: str,
    body_text: str,
    media_https_url: str,
) -> str:
    sid = settings.TWILIO_ACCOUNT_SID
    token = settings.TWILIO_AUTH_TOKEN
    from_wa = settings.TWILIO_WHATSAPP_FROM
    if not sid or not token or not from_wa:
        raise ValueError(
            "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM must be configured."
        )

    to_digits = to_e164.strip()
    if not to_digits.startswith("+"):
        to_digits = f"+{to_digits}"
    to_param = f"whatsapp:{to_digits}"

    auth = (sid, token)
    data = {
        "From": from_wa if from_wa.startswith("whatsapp:") else f"whatsapp:{from_wa}",
        "To": to_param,
        "Body": body_text[:1600],
        "MediaUrl": media_https_url,
    }

    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    with httpx.Client(timeout=60.0, auth=auth) as client:
        r = client.post(url, data=data)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Twilio error {r.status_code}: {r.text[:500]}")

    try:
        payload = r.json()
        return str(payload.get("sid") or "")
    except Exception:
        return "twilio-sent"


def send_whatsapp_twilio_text_only(*, to_e164: str, body_text: str) -> str:
    """Fallback when no public HTTPS base URL is configured."""
    sid = settings.TWILIO_ACCOUNT_SID
    token = settings.TWILIO_AUTH_TOKEN
    from_wa = settings.TWILIO_WHATSAPP_FROM
    if not sid or not token or not from_wa:
        raise ValueError(
            "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_WHATSAPP_FROM must be configured."
        )

    to_digits = to_e164.strip()
    if not to_digits.startswith("+"):
        to_digits = f"+{to_digits}"
    to_param = f"whatsapp:{to_digits}"

    auth = (sid, token)
    data = {
        "From": from_wa if from_wa.startswith("whatsapp:") else f"whatsapp:{from_wa}",
        "To": to_param,
        "Body": body_text[:1600],
    }

    url = f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json"
    with httpx.Client(timeout=60.0, auth=auth) as client:
        r = client.post(url, data=data)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Twilio error {r.status_code}: {r.text[:500]}")

    try:
        payload = r.json()
        return str(payload.get("sid") or "")
    except Exception:
        return "twilio-sent"
