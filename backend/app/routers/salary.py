import os
import calendar as cal_module
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from typing import List
from datetime import date

from ..models import SalaryRecord, SalaryPayment, User
from ..auth import get_current_manager_or_admin, get_current_admin
from ..db_wrapper import get_salary_records, mark_salary_paid, get_all_labours, get_labour, create_notification, get_pending_advances, get_advances, repay_advance_partial, mark_advance_deducted, get_payment_logs
from ..whatsapp_service import send_whatsapp_message
from ..push_service import send_push_to_user

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
        pending["daily_wage"] = labour.daily_wage
        pending["phone"] = labour.phone
        results.append(pending)

    total_pending = sum(r["total_pending"] for r in results)
    labours_with_pending = len([r for r in results if r["total_pending"] > 0])
    return {
        "total_pending": total_pending,
        "labours_with_pending": labours_with_pending,
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
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_admin)
):
    """Mark salary as paid for a labour up to a specific week.
    If amount_paid is provided and less than total due, marks oldest weeks paid first.
    Optionally deduct advances from the payment."""
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

    # Handle advance deduction
    advance_deducted = 0.0
    advances_updated = []
    
    if payment.advance_deduction and payment.advance_deduction != "none":
        pending_advances = get_advances(labour_id=payment.labour_id, is_deducted=False)
        total_pending_advance = sum(a.amount - (a.repaid_amount or 0.0) for a in pending_advances)
        
        if total_pending_advance > 0:
            if payment.advance_deduction == "full":
                # Deduct all pending advances
                for adv in pending_advances:
                    remaining = adv.amount - (adv.repaid_amount or 0.0)
                    if remaining > 0:
                        mark_advance_deducted(adv.id)
                        advance_deducted += remaining
                        advances_updated.append({"id": adv.id, "amount": remaining, "type": "full"})
            
            elif payment.advance_deduction == "partial":
                # Deduct specified amount
                deduct_amount = payment.advance_deduction_amount or 0.0
                if deduct_amount <= 0:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="advance_deduction_amount must be greater than 0 for partial deduction"
                    )
                if deduct_amount > total_pending_advance:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Deduction amount ({deduct_amount}) exceeds pending advances ({total_pending_advance})"
                    )
                
                # Deduct from oldest advances first
                remaining_to_deduct = deduct_amount
                for adv in sorted(pending_advances, key=lambda x: x.date):
                    if remaining_to_deduct <= 0:
                        break
                    adv_remaining = adv.amount - (adv.repaid_amount or 0.0)
                    if adv_remaining <= 0:
                        continue
                    
                    to_deduct = min(remaining_to_deduct, adv_remaining)
                    repay_advance_partial(adv.id, to_deduct)
                    advance_deducted += to_deduct
                    remaining_to_deduct -= to_deduct
                    advances_updated.append({"id": adv.id, "amount": to_deduct, "type": "partial"})

    result = mark_salary_paid(
        labour_id=payment.labour_id,
        week_end=payment.week_end,
        paid_by=current_user.username,
        amount_paid=payment.amount_paid,
        payment_comment=payment.payment_comment
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No unpaid salary records found for this period"
        )

    # Calculate net payment (salary paid minus advance deducted)
    net_payment = result['amount_paid'] - advance_deducted

    # In-app notification
    try:
        msg_text = f"Paid ₹{result['amount_paid']:.0f} to {labour.name}"
        if advance_deducted > 0:
            msg_text += f" (₹{advance_deducted:.0f} advance deducted, net: ₹{net_payment:.0f})"
        create_notification(
            user=current_user.username,
            notif_type="salary_paid",
            title="Salary Paid",
            message=msg_text,
            labour_id=payment.labour_id
        )
    except Exception:
        pass

    # WhatsApp notification to labour
    if labour.phone:
        if advance_deducted > 0:
            msg = (
                f"Dear {labour.name}, your salary of ₹{result['amount_paid']:.0f} "
                f"has been processed. Advance deducted: ₹{advance_deducted:.0f}. "
                f"Net payment: ₹{net_payment:.0f}. - AttendanceMS"
            )
        else:
            msg = (
                f"Dear {labour.name}, your salary of ₹{result['amount_paid']:.0f} "
                f"has been paid. - AttendanceMS"
            )
        background_tasks.add_task(send_whatsapp_message, labour.phone, msg)

    # Push notification to the user who paid
    push_msg = f"Paid ₹{result['amount_paid']:.0f} to {labour.name}"
    if advance_deducted > 0:
        push_msg += f" (net: ₹{net_payment:.0f})"
    background_tasks.add_task(
        send_push_to_user,
        current_user.username,
        "Salary Paid",
        push_msg
    )

    response = {
        "message": f"Salary paid for {labour.name}",
        "paid_by": current_user.username,
        "weeks_paid": result["weeks_paid"],
        "amount_paid": result["amount_paid"],
        "remaining": result["remaining"],
    }
    
    if advance_deducted > 0:
        response["advance_deducted"] = advance_deducted
        response["net_payment"] = net_payment
        response["advances_updated"] = len(advances_updated)
    
    return response


@router.get("/slip/{labour_id}")
async def get_salary_slip(
    labour_id: str,
    week_end: date = None,
    current_user: User = Depends(get_current_admin)
):
    """Get salary slip data for a specific week (Admin only)"""
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {labour_id} not found"
        )

    records = get_salary_records(labour_id=labour_id)
    if not records:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No salary records found for this labour"
        )

    if week_end:
        record = next((r for r in records if r.week_end == week_end), None)
    else:
        record = max(records, key=lambda r: r.week_end)

    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No salary record found for the requested period"
        )

    advance_pending = get_pending_advances(labour_id)
    net_salary = max(0.0, record.total_amount - advance_pending)

    return {
        "labour_id": labour.id,
        "labour_name": labour.name,
        "daily_wage": labour.daily_wage,
        "pay_cycle": getattr(labour, "pay_cycle", "weekly") or "weekly",
        "week_start": record.week_start.isoformat(),
        "week_end": record.week_end.isoformat(),
        "days_present": record.days_present,
        "gross_salary": record.total_amount,
        "advance_pending": advance_pending,
        "net_salary": net_salary,
        "is_paid": record.is_paid,
        "paid_amount": record.paid_amount,
        "paid_date": record.paid_date.isoformat() if record.paid_date else None,
        "paid_by": record.paid_by,
        "generated_at": date.today().isoformat(),
    }


@router.get("/payments/{labour_id}")
async def get_salary_payments(
    labour_id: str,
    current_user: User = Depends(get_current_admin)
):
    """Get all payment log entries for a labour (Admin only)"""
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Labour {labour_id} not found")
    logs = get_payment_logs(labour_id=labour_id)
    return {
        "labour_id": labour_id,
        "labour_name": labour.name,
        "payments": [
            {
                "id": p.id,
                "salary_record_id": p.salary_record_id,
                "amount": p.amount,
                "paid_date": p.paid_date.isoformat(),
                "paid_by": p.paid_by,
                "comment": p.comment,
            }
            for p in sorted(logs, key=lambda x: x.paid_date)
        ],
        "total_paid": sum(p.amount for p in logs),
    }


@router.get("/register")
async def get_pay_register(
    year: int,
    month: int,
    current_user: User = Depends(get_current_admin)
):
    """Monthly pay register for all labours (Admin only)"""
    if not (1 <= month <= 12):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="month must be between 1 and 12"
        )

    from_date = date(year, month, 1)
    to_date = date(year, month, cal_module.monthrange(year, month)[1])

    labours = get_all_labours()
    all_records = get_salary_records()
    # Build payment log map: salary_record_id → list of payment entries
    all_logs = get_payment_logs()
    log_map: dict = {}
    for log in all_logs:
        log_map.setdefault(log.salary_record_id, []).append(log)

    result = []
    for labour in labours:
        labour_records = [
            r for r in all_records
            if r.labour_id == labour.id and from_date <= r.week_end <= to_date
        ]
        if not labour_records:
            continue

        total_earned = sum(r.total_amount for r in labour_records)
        total_paid = sum(r.paid_amount for r in labour_records)
        result.append({
            "labour_id": labour.id,
            "labour_name": labour.name,
            "daily_wage": labour.daily_wage,
            "weeks": [
                {
                    "week_start": r.week_start.isoformat(),
                    "week_end": r.week_end.isoformat(),
                    "days_present": r.days_present,
                    "total_amount": r.total_amount,
                    "paid_amount": r.paid_amount,
                    "is_paid": r.is_paid,
                    "paid_date": r.paid_date.isoformat() if r.paid_date else None,
                    "paid_by": r.paid_by,
                    "payment_comment": r.payment_comment,
                    # Per-week payment log entries
                    "payments": [
                        {
                            "id": p.id,
                            "amount": p.amount,
                            "paid_date": p.paid_date.isoformat(),
                            "paid_by": p.paid_by,
                            "comment": p.comment,
                        }
                        for p in sorted(log_map.get(r.id, []), key=lambda x: x.paid_date)
                    ],
                }
                for r in sorted(labour_records, key=lambda x: x.week_end)
            ],
            "total_earned": total_earned,
            "total_paid": total_paid,
            "balance": total_earned - total_paid,
        })

    result.sort(key=lambda x: x["labour_name"])
    return {
        "year": year,
        "month": month,
        "labours": result,
        "grand_total_earned": sum(r["total_earned"] for r in result),
        "grand_total_paid": sum(r["total_paid"] for r in result),
    }


@router.get("/summary")
async def get_salary_summary(
    current_user: User = Depends(get_current_admin)
):
    """Get overall salary summary"""
    all_records = get_salary_records()
    labours = get_all_labours()
    
    # Use paid_amount to correctly account for partial payments
    total_earned = sum(r.total_amount for r in all_records)
    total_paid = sum(r.paid_amount for r in all_records)
    total_pending = total_earned - total_paid
    
    return {
        "total_labours": len(labours),
        "total_paid": total_paid,
        "total_pending": total_pending,
        "total_salary_records": len(all_records)
    }
