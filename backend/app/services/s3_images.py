"""Upload item images to Amazon S3 (optional — requires AWS env vars)."""

from __future__ import annotations

import uuid
from typing import Final

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings

_MAX_BYTES: Final = 5 * 1024 * 1024
_CT_EXT: Final[dict[str, str]] = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def is_s3_configured() -> bool:
    return bool(
        settings.AWS_S3_BUCKET.strip()
        and settings.AWS_ACCESS_KEY_ID.strip()
        and settings.AWS_SECRET_ACCESS_KEY.strip()
    )


def upload_item_image_bytes(*, owner_id: str, content_type: str, body: bytes) -> str:
    if not is_s3_configured():
        raise ValueError(
            "Image uploads are not configured. Set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, and "
            "AWS_SECRET_ACCESS_KEY on the server (see backend .env.example)."
        )

    ct = (content_type or "").split(";")[0].strip().lower()
    ext = _CT_EXT.get(ct)
    if not ext:
        raise ValueError("Only JPEG, PNG, or WebP images are allowed.")

    if len(body) > _MAX_BYTES:
        raise ValueError("Image must be 5 MB or smaller.")

    prefix = (settings.AWS_S3_ITEM_PREFIX or "inventory/items").strip().strip("/")
    key = f"{prefix}/{owner_id}/{uuid.uuid4().hex}{ext}"

    region = (settings.AWS_S3_REGION or "us-east-1").strip()
    client = boto3.client(
        "s3",
        region_name=region,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )

    try:
        client.put_object(
            Bucket=settings.AWS_S3_BUCKET.strip(),
            Key=key,
            Body=body,
            ContentType=ct,
        )
    except (ClientError, BotoCoreError) as exc:
        raise RuntimeError(f"S3 upload failed: {exc}") from exc

    base = settings.AWS_S3_PUBLIC_BASE_URL.strip().rstrip("/")
    if base:
        return f"{base}/{key}"

    bucket = settings.AWS_S3_BUCKET.strip()
    if region == "us-east-1":
        return f"https://{bucket}.s3.amazonaws.com/{key}"
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"
