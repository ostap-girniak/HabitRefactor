from __future__ import annotations

import asyncio
import json
from typing import Optional

from pywebpush import WebPushException, webpush

from app.config import Settings


def _b64url_to_str(value: str) -> str:
    return (value or "").strip()


async def send_web_push(
    *,
    settings: Settings,
    subscription: dict,
    title: str,
    body: str,
    url: str = "/dashboard",
    tag: str = "danger-zone",
) -> Optional[str]:
    """
    Send a single Web Push notification.

    Returns:
      None on success, or a short error string on failure.
    """
    vapid_private_key = _b64url_to_str(settings.vapid_private_key)
    vapid_public_key = _b64url_to_str(settings.vapid_public_key)
    vapid_contact = _b64url_to_str(settings.vapid_contact_email)
    if not (vapid_private_key and vapid_public_key and vapid_contact):
        return "missing_vapid_config"

    endpoint = subscription.get("endpoint")
    p256dh_key = subscription.get("p256dh_key")
    auth_key = subscription.get("auth_key")
    # Legacy schema support: `keys` JSONB column
    keys = subscription.get("keys") or {}
    if not (p256dh_key and auth_key) and isinstance(keys, dict):
        p256dh_key = p256dh_key or keys.get("p256dh")
        auth_key = auth_key or keys.get("auth")
    if not (endpoint and p256dh_key and auth_key):
        return "invalid_subscription"

    payload = json.dumps(
        {
            "title": title,
            "body": body,
            "url": url,
            "tag": tag,
        }
    )

    def _send_sync():
        return webpush(
            subscription_info={
                "endpoint": endpoint,
                "keys": {"p256dh": p256dh_key, "auth": auth_key},
            },
            data=payload,
            vapid_private_key=vapid_private_key,
            vapid_claims={"sub": vapid_contact},
        )

    try:
        await asyncio.to_thread(_send_sync)
        return None
    except WebPushException as exc:
        # Common: 404/410 means subscription is gone.
        status_code = None
        try:
            status_code = getattr(getattr(exc, "response", None), "status_code", None)
        except Exception:
            status_code = None
        if status_code in (404, 410):
            return "subscription_gone"
        return f"webpush_error:{status_code or 'unknown'}"
    except Exception:
        return "webpush_error"


async def save_notification_to_history(
    *,
    client,
    user_id: str,
    title: str,
    body: str,
    notification_type: str = "general",
    url: str = "/dashboard",
    metadata: Optional[dict] = None,
) -> None:
    """
    Persist a notification to notification_history so it appears in the bell icon.
    Fails silently if the table doesn't exist yet.
    """
    try:
        row = {
            "user_id": user_id,
            "title": title,
            "message": body,
            "notification_type": notification_type,
            "url": url,
            "is_read": False,
        }
        if metadata:
            row["metadata"] = metadata
        await client.table("notification_history").insert(row).execute()
    except Exception as e:
        print(f"[WARN] Failed to save notification to history: {e}")

