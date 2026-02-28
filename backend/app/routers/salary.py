import os
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import date

from ..models import SalaryRecord, SalaryPayment, User
from ..auth import get_current_manager_or_admin, get_current_admin
from ..db_wrapper import get_salary_records, mark_salary_paid, get_all_labours, get_labour

USE_POSTGRES = os.getenv("USE_POSTGRES", "false").lower() == "true"
if USE_POSTGRES:
    from ..db_operations import get_salary_records_bulk

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
    current_user: User = Depends(get_current_admin)
):
    """Get salary records with optional filters (Admin only)"""
    return get_salary_records(labour_id=labour_id, is_paid=is_paid)


@router.get("/pending/{labour_id}")
async def get_pending_salary(
    labour_id: str,
    current_user: User = Depends(get_current_admin)
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
    current_user: User = Depends(get_current_admin)
):
    """Get pending salaries for all labours"""
    labours = get_all_labours()
    if not labours:
        return {"total_pending": 0.0, "labours": []}

    if USE_POSTGRES:
        labour_ids = [l.id for l in labours]
        all_salary_map = get_salary_records_bulk(labour_ids)
    else:
        all_salary_map = {l.id: get_salary_records(labour_id=l.id) for l in labours}

    results = []
    for labour in labours:
        salary_records = all_salary_map.get(labour.id, [])
        unpaid = [r for r in salary_records if not r.is_paid and r.total_amount > 0]
        if not unpaid:
            pending = {
                "labour_id": labour.id,
                "total_pending": 0.0,
                "weeks_pending": 0,
                "records": []
            }
        else:
            # Calculate remaining = total_amount - paid_amount for each week
            total_pending = sum(r.total_amount - r.paid_amount for r in unpaid)
            sorted_unpaid = sorted(unpaid, key=lambda x: x.week_end)
            pending = {
                "labour_id": labour.id,
                "total_pending": total_pending,
                "weeks_pending": len(unpaid),
                "oldest_unpaid_week": min(r.week_start for r in unpaid).isoformat(),
                "latest_unpaid_week": max(r.week_end for r in unpaid).isoformat(),
                "records": [
                    {
                        "week_start": r.week_start.isoformat(),
                        "week_end": r.week_end.isoformat(),
                        "days_present": r.days_present,
                        "amount": r.total_amount - r.paid_amount,  # Show remaining, not total
                        "total_amount": r.total_amount,
                        "paid_amount": r.paid_amount
                    }
                    for r in sorted_unpaid
                ]
            }
        pending["name"] = labour.name
        pending["pay_cycle"] = getattr(labour, "pay_cycle", "weekly") or "weekly"
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
    current_user: User = Depends(get_current_admin)
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
    current_user: User = Depends(get_current_admin)
):
    """Mark salary as paid for a labour up to a specific week.
    If amount_paid is provided and less than total due, marks oldest weeks paid first."""
    labour = get_labour(payment.labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {payment.labour_id} not found"
        )

    if payment.amount_paid is not None and payment.amount_paid <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="amount_paid must be greater than 0"
        )

    result = mark_salary_paid(
        labour_id=payment.labour_id,
        week_end=payment.week_end,
        paid_by=current_user.username,
        amount_paid=payment.amount_paid
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No unpaid salary records found for this period"
        )

    return {
        "message": f"Salary paid for {labour.name}",
        "paid_by": current_user.username,
        "weeks_paid": result["weeks_paid"],
        "amount_paid": result["amount_paid"],
        "remaining": result["remaining"],
    }


@router.get("/summary")
async def get_salary_summary(
    current_user: User = Depends(get_current_admin)
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
