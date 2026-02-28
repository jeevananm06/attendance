"""
WhatsApp notification service using Meta Cloud API.
Non-blocking — never raises, all errors are logged.
Set WHATSAPP_ENABLED=true and configure the other env vars to activate.
"""

import os
import logging

logger = logging.getLogger(__name__)

WHATSAPP_ENABLED = os.getenv("WHATSAPP_ENABLED", "false").lower() == "true"
WHATSAPP_TOKEN = os.getenv("WHATSAPP_TOKEN", "")
WHATSAPP_PHONE_NUMBER_ID = os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")


def _normalize_phone(phone: str) -> str:
    """Strip non-digits; prefix 91 for 10-digit Indian numbers."""
    digits = ''.join(c for c in phone if c.isdigit())
    if len(digits) == 10:
        digits = '91' + digits
    return digits


async def send_whatsapp_message(to_phone: str, message: str) -> bool:
    """
    Send a WhatsApp text message via Meta Cloud API.
    Returns True on success, False on any failure. Never raises.
    """
    if not WHATSAPP_ENABLED:
        return False
    if not to_phone or not WHATSAPP_TOKEN or not WHATSAPP_PHONE_NUMBER_ID:
        logger.debug("WhatsApp not configured — skipping")
        return False

    phone = _normalize_phone(to_phone)
    if len(phone) < 10:
        logger.warning(f"WhatsApp: invalid phone number '{to_phone}'")
        return False

    url = f"https://graph.facebook.com/v18.0/{WHATSAPP_PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"body": message}
    }
    headers = {
        "Authorization": f"Bearer {WHATSAPP_TOKEN}",
        "Content-Type": "application/json"
    }

    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(url, json=payload, headers=headers)
            if resp.status_code == 200:
                logger.info(f"WhatsApp sent to {phone}")
                return True
            else:
                logger.warning(f"WhatsApp failed [{resp.status_code}]: {resp.text[:200]}")
                return False
    except Exception as e:
        logger.error(f"WhatsApp error: {e}")
        return False
