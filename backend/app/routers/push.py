import os
from fastapi import APIRouter, Depends, HTTPException, status

from ..models import PushSubscription, User
from ..auth import get_current_authenticated_user
from ..db_wrapper import save_push_subscription, delete_push_subscription

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "")

router = APIRouter(prefix="/push", tags=["Push Notifications"])


@router.get("/vapid-public-key")
async def get_vapid_public_key():
    """Return the VAPID public key for browser push subscription"""
    return {"public_key": VAPID_PUBLIC_KEY}


@router.post("/subscribe")
async def subscribe_push(
    data: PushSubscription,
    current_user: User = Depends(get_current_authenticated_user)
):
    """Register a push subscription for the current user"""
    keys = data.keys
    if not keys.get("p256dh") or not keys.get("auth"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing p256dh or auth keys in subscription"
        )
    save_push_subscription(
        user=current_user.username,
        endpoint=data.endpoint,
        p256dh=keys["p256dh"],
        auth=keys["auth"]
    )
    return {"message": "Subscribed successfully"}


@router.delete("/unsubscribe")
async def unsubscribe_push(
    data: PushSubscription,
    current_user: User = Depends(get_current_authenticated_user)
):
    """Remove a push subscription"""
    delete_push_subscription(endpoint=data.endpoint)
    return {"message": "Unsubscribed successfully"}
