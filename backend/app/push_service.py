"""
Browser Push Notification service using Web Push Protocol (VAPID).
Non-blocking — never raises, all errors are logged.

Setup:
1. Generate VAPID keys:
     pip install pywebpush
     vapid --gen --applicationServerKey
2. Set env vars:
     VAPID_PRIVATE_KEY=<base64 private key>
     VAPID_PUBLIC_KEY=<base64 public key>
     VAPID_CLAIMS_EMAIL=admin@yourdomain.com
     PUSH_ENABLED=true
"""

import os
import json
import logging

logger = logging.getLogger(__name__)

PUSH_ENABLED = os.getenv("PUSH_ENABLED", "false").lower() == "true"
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "admin@example.com")


def send_push_notification(subscription_info: dict, title: str, body: str, url: str = "/") -> bool:
    """
    Send a push notification to a single subscription.
    Returns True on success, False on failure. Never raises.
    """
    if not PUSH_ENABLED or not VAPID_PRIVATE_KEY or not VAPID_PUBLIC_KEY:
        return False
    try:
        from pywebpush import webpush, WebPushException
        webpush(
            subscription_info=subscription_info,
            data=json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": f"mailto:{VAPID_CLAIMS_EMAIL}"}
        )
        return True
    except Exception as e:
        logger.warning(f"Push notification failed: {e}")
        return False


def send_push_to_user(user: str, title: str, body: str, url: str = "/") -> None:
    """Send push notification to all subscriptions for a given user."""
    try:
        from .db_wrapper import get_push_subscriptions
        subscriptions = get_push_subscriptions(user)
        for sub in subscriptions:
            send_push_notification(sub, title, body, url)
    except Exception as e:
        logger.error(f"send_push_to_user error: {e}")
