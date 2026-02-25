from fastapi import APIRouter, Depends
from typing import List
from datetime import datetime

from ..models import AuditLog, AuditAction, User
from ..auth import get_current_admin
from ..db_wrapper import get_audit_logs

router = APIRouter(prefix="/audit", tags=["Audit Logs"])


@router.get("/", response_model=List[AuditLog])
async def list_audit_logs(
    user: str = None,
    action: AuditAction = None,
    entity_type: str = None,
    limit: int = 100,
    current_user: User = Depends(get_current_admin)
):
    """Get audit logs (Admin only)"""
    return get_audit_logs(
        user=user,
        action=action,
        entity_type=entity_type,
        limit=limit
    )


@router.get("/recent")
async def get_recent_activity(
    limit: int = 50,
    current_user: User = Depends(get_current_admin)
):
    """Get recent activity logs"""
    logs = get_audit_logs(limit=limit)
    
    return {
        "count": len(logs),
        "logs": logs
    }


@router.get("/user/{username}")
async def get_user_activity(
    username: str,
    limit: int = 50,
    current_user: User = Depends(get_current_admin)
):
    """Get activity logs for a specific user"""
    logs = get_audit_logs(user=username, limit=limit)
    
    return {
        "user": username,
        "count": len(logs),
        "logs": logs
    }


@router.get("/entity/{entity_type}")
async def get_entity_activity(
    entity_type: str,
    limit: int = 50,
    current_user: User = Depends(get_current_admin)
):
    """Get activity logs for a specific entity type"""
    logs = get_audit_logs(entity_type=entity_type, limit=limit)
    
    return {
        "entity_type": entity_type,
        "count": len(logs),
        "logs": logs
    }


@router.get("/summary")
async def get_audit_summary(
    current_user: User = Depends(get_current_admin)
):
    """Get summary of audit logs"""
    all_logs = get_audit_logs(limit=1000)
    
    action_counts = {}
    entity_counts = {}
    user_counts = {}
    
    for log in all_logs:
        action_counts[log.action.value] = action_counts.get(log.action.value, 0) + 1
        entity_counts[log.entity_type] = entity_counts.get(log.entity_type, 0) + 1
        user_counts[log.user] = user_counts.get(log.user, 0) + 1
    
    return {
        "total_logs": len(all_logs),
        "by_action": action_counts,
        "by_entity": entity_counts,
        "by_user": user_counts
    }
