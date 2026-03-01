from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from typing import List
from datetime import date

from ..models import Advance, AdvanceCreate, AdvanceRepay, User, AuditAction
from ..auth import get_current_manager_or_admin
from ..db_wrapper import (
    create_advance, get_advances, get_pending_advances, get_all_pending_advances_bulk, mark_advance_deducted, repay_advance_partial,
    get_labour, create_audit_log, get_all_labours, create_notification
)
from ..whatsapp_service import send_whatsapp_message
from ..push_service import send_push_to_user

router = APIRouter(prefix="/advances", tags=["Advances"])


@router.get("/", response_model=List[Advance])
async def list_advances(
    labour_id: str = None,
    is_deducted: bool = None,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get advance records with optional filters"""
    return get_advances(labour_id=labour_id, is_deducted=is_deducted)


@router.post("/", response_model=Advance)
async def give_advance(
    data: AdvanceCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Give advance payment to a labour"""
    labour = get_labour(data.labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {data.labour_id} not found"
        )
    
    advance = create_advance(
        labour_id=data.labour_id,
        amount=data.amount,
        reason=data.reason,
        given_by=current_user.username
    )
    
    create_audit_log(
        user=current_user.username,
        action=AuditAction.CREATE,
        entity_type="advance",
        entity_id=advance.id,
        new_value=f"\u20b9{data.amount} to {labour.name}"
    )

    try:
        create_notification(
            user=current_user.username,
            notif_type="advance_given",
            title="Advance Given",
            message=f"Advance of \u20b9{data.amount:.0f} given to {labour.name}",
            labour_id=data.labour_id
        )
        if labour.phone:
            msg = (
                f"Dear {labour.name}, an advance of \u20b9{data.amount:.0f} has been recorded "
                f"for you. - AttendanceMS"
            )
            background_tasks.add_task(send_whatsapp_message, labour.phone, msg)
        background_tasks.add_task(
            send_push_to_user, current_user.username,
            "Advance Given", f"Advance of \u20b9{data.amount:.0f} given to {labour.name}"
        )
    except Exception:
        pass

    return advance


@router.get("/pending/{labour_id}")
async def get_labour_pending_advances(
    labour_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get pending (not yet deducted) advance amount for a labour"""
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {labour_id} not found"
        )
    
    pending = get_pending_advances(labour_id)
    advances = get_advances(labour_id=labour_id, is_deducted=False)
    
    return {
        "labour_id": labour_id,
        "name": labour.name,
        "pending_amount": pending,
        "pending_count": len(advances),
        "advances": advances
    }


@router.get("/pending")
async def get_all_pending_advances(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get pending advances for all labours"""
    labours = get_all_labours()
    # Single bulk query instead of N queries
    pending_map = get_all_pending_advances_bulk()
    
    results = []
    total_pending = 0
    
    for labour in labours:
        pending = pending_map.get(labour.id, 0.0)
        if pending > 0:
            results.append({
                "labour_id": labour.id,
                "name": labour.name,
                "pending_amount": pending
            })
            total_pending += pending
    
    return {
        "total_pending": total_pending,
        "labours": results
    }


@router.post("/{advance_id}/deduct", response_model=Advance)
async def mark_advance_as_deducted(
    advance_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Mark an advance as fully deducted/paid"""
    advance = mark_advance_deducted(advance_id)
    if not advance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Advance with id {advance_id} not found"
        )
    
    labour = get_labour(advance.labour_id)
    create_audit_log(
        user=current_user.username,
        action=AuditAction.UPDATE,
        entity_type="advance",
        entity_id=advance_id,
        new_value=f"Marked ₹{advance.amount} as fully deducted for {labour.name if labour else advance.labour_id}"
    )
    
    return advance


@router.post("/{advance_id}/repay", response_model=Advance)
async def repay_advance(
    advance_id: str,
    data: AdvanceRepay,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Record a partial repayment for an advance"""
    if data.repay_amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Repay amount must be greater than zero"
        )
    
    advance = repay_advance_partial(advance_id, data.repay_amount)
    if not advance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Advance with id {advance_id} not found"
        )
    
    labour = get_labour(advance.labour_id)
    create_audit_log(
        user=current_user.username,
        action=AuditAction.UPDATE,
        entity_type="advance",
        entity_id=advance_id,
        new_value=f"Partial repay ₹{data.repay_amount} for {labour.name if labour else advance.labour_id} (total repaid: ₹{advance.repaid_amount}/{advance.amount})"
    )
    
    return advance
