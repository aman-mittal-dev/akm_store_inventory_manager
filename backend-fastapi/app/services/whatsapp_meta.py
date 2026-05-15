"""Meta WhatsApp Cloud API — uploads PDF then sends a document message."""

from __future__ import annotations

import io

import httpx

from app.core.config import settings


def _strip_plus_e164(phone: str) -> str:
    s = phone.strip().replace(" ", "")
    if s.startswith("+"):
        return s[1:]
    return s


def send_whatsapp_meta_document(
    *,
    to_e164: str,
    pdf_bytes: bytes,
    file_name: str,
    caption: str | None = None,
) -> str:
    phone_id = settings.META_WHATSAPP_PHONE_NUMBER_ID
    token = settings.META_WHATSAPP_ACCESS_TOKEN
    if not phone_id or not token:
        raise ValueError(
            "META_WHATSAPP_PHONE_NUMBER_ID and META_WHATSAPP_ACCESS_TOKEN must be configured."
        )

    ver = settings.META_WHATSAPP_API_VERSION or "v21.0"
    base = f"https://graph.facebook.com/{ver}"

    to = _strip_plus_e164(to_e164)

    headers = {"Authorization": f"Bearer {token}"}

    # 1) Upload media (multipart per Graph API)
    upload_url = f"{base}/{phone_id}/media"
    files = {
        "messaging_product": (None, "whatsapp"),
        "file": (file_name, io.BytesIO(pdf_bytes), "application/pdf"),
    }
    with httpx.Client(timeout=120.0, headers=headers) as client:
        up = client.post(upload_url, files=files)
    if up.status_code not in (200, 201):
        raise RuntimeError(f"Meta media upload {up.status_code}: {up.text[:500]}")
    up_json = up.json()
    media_id = up_json.get("id")
    if not media_id:
        raise RuntimeError("Meta media upload did not return id")

    # 2) Send document message
    send_url = f"{base}/{phone_id}/messages"
    payload: dict = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": to,
        "type": "document",
        "document": {"id": media_id, "filename": file_name},
    }
    if caption:
        payload["document"]["caption"] = caption[:1024]

    with httpx.Client(timeout=60.0, headers=headers) as client:
        msg = client.post(send_url, json=payload)
    if msg.status_code not in (200, 201):
        raise RuntimeError(f"Meta send message {msg.status_code}: {msg.text[:500]}")

    try:
        body = msg.json()
        return str(body.get("messages", [{}])[0].get("id") or media_id)
    except Exception:
        return str(media_id)
