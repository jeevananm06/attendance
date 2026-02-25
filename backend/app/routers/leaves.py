from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from ..models import Leave, LeaveCreate, LeaveBalance, LeaveStatus, User, AuditAction
from ..auth import get_current_manager_or_admin
from ..database import (
    create_leave, get_leaves, approve_leave, get_leave_balance,
    init_leave_balance, get_labour, create_audit_log
)

router = APIRouter(prefix="/leaves", tags=["Leave Management"])


@router.get("/", response_model=List[Leave])
async def list_leaves(
    labour_id: str = None,
    status: LeaveStatus = None,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get leave records with optional filters"""
    return get_leaves(labour_id=labour_id, status=status)


@router.post("/", response_model=Leave)
async def apply_leave(
    data: LeaveCreate,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Apply for leave"""
    labour = get_labour(data.labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {data.labour_id} not found"
        )
    
    if data.end_date < data.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be before start date"
        )
    
    leave = create_leave(
        labour_id=data.labour_id,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        reason=data.reason
    )
    
    create_audit_log(
        user=current_user.username,
        action=AuditAction.CREATE,
        entity_type="leave",
        entity_id=leave.id,
        new_value=f"{data.leave_type.value}: {data.start_date} to {data.end_date}"
    )
    
    return leave


@router.post("/{leave_id}/approve")
async def approve_leave_request(
    leave_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Approve a leave request"""
    leave = approve_leave(leave_id, current_user.username, approve=True)
    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Leave with id {leave_id} not found"
        )
    
    create_audit_log(
        user=current_user.username,
        action=AuditAction.APPROVE,
        entity_type="leave",
        entity_id=leave_id
    )
    
    return {"message": "Leave approved", "leave": leave}


@router.post("/{leave_id}/reject")
async def reject_leave_request(
    leave_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Reject a leave request"""
    leave = approve_leave(leave_id, current_user.username, approve=False)
    if not leave:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Leave with id {leave_id} not found"
        )
    
    create_audit_log(
        user=current_user.username,
        action=AuditAction.REJECT,
        entity_type="leave",
        entity_id=leave_id
    )
    
    return {"message": "Leave rejected", "leave": leave}


@router.get("/balance/{labour_id}", response_model=LeaveBalance)
async def get_labour_leave_balance(
    labour_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get leave balance for a labour"""
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {labour_id} not found"
        )
    
    return get_leave_balance(labour_id)


@router.post("/balance/{labour_id}/init", response_model=LeaveBalance)
async def initialize_leave_balance(
    labour_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Initialize leave balance for a labour (typically at year start)"""
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {labour_id} not found"
        )
    
    return init_leave_balance(labour_id)


@router.get("/pending")
async def get_pending_leaves(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get all pending leave requests"""
    pending = get_leaves(status=LeaveStatus.PENDING)
    return {
        "count": len(pending),
        "leaves": pending
    }
