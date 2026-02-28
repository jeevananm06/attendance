from fastapi import APIRouter, Depends
from typing import List

from ..models import Notification, NotificationMarkRead, User
from ..auth import get_current_authenticated_user
from ..db_wrapper import get_notifications, get_unread_count, mark_notifications_read

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/", response_model=List[Notification])
async def list_notifications(
    unread_only: bool = False,
    current_user: User = Depends(get_current_authenticated_user)
):
    """Get notifications for the current user"""
    return get_notifications(user=current_user.username, unread_only=unread_only, limit=50)


@router.get("/unread-count")
async def unread_notification_count(
    current_user: User = Depends(get_current_authenticated_user)
):
    """Get unread notification count for the current user"""
    count = get_unread_count(user=current_user.username)
    return {"count": count}


@router.post("/mark-read")
async def mark_read(
    data: NotificationMarkRead,
    current_user: User = Depends(get_current_authenticated_user)
):
    """Mark specific notifications as read"""
    updated = mark_notifications_read(
        user=current_user.username,
        notification_ids=data.notification_ids
    )
    return {"marked": updated}


@router.post("/mark-all-read")
async def mark_all_read(
    current_user: User = Depends(get_current_authenticated_user)
):
    """Mark all notifications as read for the current user"""
    updated = mark_notifications_read(user=current_user.username)
    return {"marked": updated}
