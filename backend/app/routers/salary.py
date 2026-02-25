from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import date

from ..models import SalaryRecord, SalaryPayment, User
from ..auth import get_current_manager_or_admin, get_current_admin
from ..database import get_salary_records, mark_salary_paid, get_all_labours, get_labour
from ..salary_calculator import (
    calculate_weekly_salary,
    calculate_all_pending_weeks,
    get_consolidated_pending_salary,
    recalculate_all_salaries,
    get_last_friday
)

router = APIRouter(prefix="/salary", tags=["Salary"])


@router.get("/records", response_model=List[SalaryRecord])
async def list_salary_records(
    labour_id: str = None,
    is_paid: bool = None,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get salary records with optional filters"""
    return get_salary_records(labour_id=labour_id, is_paid=is_paid)


@router.get("/pending/{labour_id}")
async def get_pending_salary(
    labour_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get consolidated pending salary for a labour"""
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {labour_id} not found"
        )
    return get_consolidated_pending_salary(labour_id)


@router.get("/pending")
async def get_all_pending_salaries(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get pending salaries for all labours"""
    labours = get_all_labours()
    results = []
    
    for labour in labours:
        pending = get_consolidated_pending_salary(labour.id)
        pending["name"] = labour.name
        results.append(pending)
    
    total_pending = sum(r["total_pending"] for r in results)
    
    return {
        "total_pending": total_pending,
        "labours": results
    }


@router.post("/calculate/{labour_id}")
async def calculate_salary_for_labour(
    labour_id: str,
    week_end: date = None,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Calculate salary for a specific labour up to a given week"""
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {labour_id} not found"
        )
    
    if week_end is None:
        week_end = get_last_friday()
    
    records = calculate_all_pending_weeks(labour_id, week_end)
    return {
        "labour_id": labour_id,
        "name": labour.name,
        "weeks_calculated": len(records),
        "records": records
    }


@router.post("/calculate-all")
async def calculate_all_salaries(
    week_end: date = None,
    current_user: User = Depends(get_current_admin)
):
    """Recalculate salaries for all labours (Admin only)"""
    if week_end is None:
        week_end = get_last_friday()
    
    results = recalculate_all_salaries(week_end)
    return {
        "week_end": week_end.isoformat(),
        "results": results
    }


@router.post("/pay")
async def pay_salary(
    payment: SalaryPayment,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Mark salary as paid for a labour up to a specific week"""
    labour = get_labour(payment.labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {payment.labour_id} not found"
        )
    
    result = mark_salary_paid(
        labour_id=payment.labour_id,
        week_end=payment.week_end,
        paid_by=current_user.username
    )
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No unpaid salary records found for this period"
        )
    
    return {
        "message": f"Salary paid for {labour.name}",
        "paid_by": current_user.username,
        "record": result
    }


@router.get("/summary")
async def get_salary_summary(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get overall salary summary"""
    all_records = get_salary_records()
    labours = get_all_labours()
    
    total_paid = sum(r.total_amount for r in all_records if r.is_paid)
    total_pending = sum(r.total_amount for r in all_records if not r.is_paid)
    
    return {
        "total_labours": len(labours),
        "total_paid": total_paid,
        "total_pending": total_pending,
        "total_salary_records": len(all_records)
    }
