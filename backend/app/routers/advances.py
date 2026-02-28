from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import date

from ..models import Advance, AdvanceCreate, User, AuditAction
from ..auth import get_current_manager_or_admin
from ..db_wrapper import (
    create_advance, get_advances, get_pending_advances, mark_advance_deducted,
    get_labour, create_audit_log, get_all_labours
)

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
        new_value=f"₹{data.amount} to {labour.name}"
    )
    
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
    results = []
    total_pending = 0
    
    for labour in labours:
        pending = get_pending_advances(labour.id)
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
    """Mark an advance as deducted/paid"""
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
        new_value=f"Marked ₹{advance.amount} as deducted for {labour.name if labour else advance.labour_id}"
    )
    
    return advance
