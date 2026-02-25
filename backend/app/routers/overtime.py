from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import date

from ..models import Overtime, OvertimeCreate, User
from ..auth import get_current_manager_or_admin
from ..database import create_overtime, get_overtime_records, get_labour, create_audit_log
from ..models import AuditAction

router = APIRouter(prefix="/overtime", tags=["Overtime"])


@router.get("/", response_model=List[Overtime])
async def list_overtime(
    labour_id: str = None,
    start_date: date = None,
    end_date: date = None,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get overtime records with optional filters"""
    return get_overtime_records(labour_id=labour_id, start_date=start_date, end_date=end_date)


@router.post("/", response_model=Overtime)
async def add_overtime(
    data: OvertimeCreate,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Add overtime record for a labour"""
    labour = get_labour(data.labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {data.labour_id} not found"
        )
    
    overtime = create_overtime(
        labour_id=data.labour_id,
        target_date=data.date,
        hours=data.hours,
        rate_multiplier=data.rate_multiplier,
        approved_by=current_user.username
    )
    
    create_audit_log(
        user=current_user.username,
        action=AuditAction.CREATE,
        entity_type="overtime",
        entity_id=overtime.id,
        new_value=f"{data.hours}hrs @ {data.rate_multiplier}x"
    )
    
    return overtime


@router.get("/labour/{labour_id}")
async def get_labour_overtime(
    labour_id: str,
    start_date: date = None,
    end_date: date = None,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get overtime summary for a specific labour"""
    records = get_overtime_records(labour_id=labour_id, start_date=start_date, end_date=end_date)
    
    total_hours = sum(r.hours for r in records)
    total_amount = sum(r.amount for r in records)
    
    return {
        "labour_id": labour_id,
        "total_records": len(records),
        "total_hours": total_hours,
        "total_amount": total_amount,
        "records": records
    }
