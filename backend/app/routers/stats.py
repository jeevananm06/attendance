from fastapi import APIRouter, Depends
from typing import List
from datetime import date, timedelta

from ..models import User, LabourStats, UserRole
from ..auth import get_current_manager_or_admin, get_current_authenticated_user, get_current_admin
from ..db_wrapper import (
    get_all_labours,
    get_attendance_by_labour,
    get_salary_records,
    get_sites,
    get_labours_by_site
)
from ..models import AttendanceStatus

router = APIRouter(prefix="/stats", tags=["Statistics"])


@router.get("/labour/{labour_id}")
async def get_labour_stats(
    labour_id: str,
    start_date: date = None,
    end_date: date = None,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get detailed statistics for a specific labour"""
    from ..db_wrapper import get_labour
    
    labour = get_labour(labour_id)
    if not labour:
        return {"error": f"Labour with id {labour_id} not found"}
    
    attendance = get_attendance_by_labour(labour_id, start_date, end_date)
    salary_records = get_salary_records(labour_id=labour_id)
    
    present_days = sum(1 for a in attendance if a.status == AttendanceStatus.PRESENT)
    half_days = sum(1 for a in attendance if a.status == AttendanceStatus.HALF_DAY)
    absent_days = sum(1 for a in attendance if a.status == AttendanceStatus.ABSENT)
    
    total_earned = sum(r.total_amount for r in salary_records)
    total_paid = sum(r.total_amount for r in salary_records if r.is_paid)
    
    return {
        "labour_id": labour_id,
        "name": labour.name,
        "daily_wage": labour.daily_wage,
        "joined_date": labour.joined_date.isoformat(),
        "attendance": {
            "present_days": present_days,
            "half_days": half_days,
            "absent_days": absent_days,
            "total_working_days": present_days + (half_days * 0.5)
        },
        "salary": {
            "total_earned": total_earned,
            "total_paid": total_paid,
            "pending_amount": total_earned - total_paid
        }
    }


@router.get("/overview")
async def get_overview_stats(
    current_user: User = Depends(get_current_authenticated_user)
):
    """Get overall statistics for the organization. Salary info only shown to admin."""
    labours = get_all_labours()
    
    total_labours = len(labours)
    active_labours = sum(1 for l in labours if l.is_active)
    
    # Get today's attendance
    today = date.today()
    today_attendance = []
    for labour in labours:
        att = get_attendance_by_labour(labour.id, today, today)
        if att:
            today_attendance.extend(att)
    
    present_today = sum(1 for a in today_attendance if a.status == AttendanceStatus.PRESENT)
    half_day_today = sum(1 for a in today_attendance if a.status == AttendanceStatus.HALF_DAY)
    absent_today = sum(1 for a in today_attendance if a.status == AttendanceStatus.ABSENT)
    present_half_today = sum(1 for a in today_attendance if a.status == AttendanceStatus.PRESENT_HALF)
    double_duty_today = sum(1 for a in today_attendance if a.status == AttendanceStatus.DOUBLE_DUTY)
    not_marked = total_labours - len(today_attendance)

    result = {
        "labours": {
            "total": total_labours,
            "active": active_labours,
            "inactive": total_labours - active_labours
        },
        "today_attendance": {
            "date": today.isoformat(),
            "present": present_today,
            "half_day": half_day_today,
            "absent": absent_today,
            "present_half": present_half_today,
            "double_duty": double_duty_today,
            "not_marked": not_marked
        }
    }
    
    # Only include salary info for admin
    if current_user.role == UserRole.ADMIN:
        all_salary_records = get_salary_records()
        total_earned = sum(r.total_amount for r in all_salary_records)
        # Use paid_amount to account for partial payments
        total_paid = sum(r.paid_amount for r in all_salary_records)
        total_pending = total_earned - total_paid
        result["salary"] = {
            "total_earned": total_earned,
            "total_paid": total_paid,
            "total_pending": total_pending
        }
    
    return result


@router.get("/weekly")
async def get_weekly_stats(
    weeks: int = 4,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get weekly statistics for the last N weeks"""
    from ..salary_calculator import get_week_boundaries
    
    today = date.today()
    weekly_data = []
    
    for i in range(weeks):
        target_date = today - timedelta(weeks=i)
        week_start, week_end = get_week_boundaries(target_date)
        
        labours = get_all_labours()
        week_records = get_salary_records()
        
        # Filter records for this week
        week_salary = [r for r in week_records if r.week_end == week_end]
        
        total_days = sum(r.days_present for r in week_salary)
        total_wages = sum(r.total_amount for r in week_salary)
        total_paid = sum(r.total_amount for r in week_salary if r.is_paid)
        
        weekly_data.append({
            "week_start": week_start.isoformat(),
            "week_end": week_end.isoformat(),
            "total_labourers": len(labours),
            "total_present_days": total_days,
            "total_wages": total_wages,
            "total_paid": total_paid,
            "pending": total_wages - total_paid
        })
    
    return {"weeks": weekly_data}


@router.get("/all-labours")
async def get_all_labour_stats(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get statistics for all labours"""
    labours = get_all_labours(include_inactive=True)
    stats = []
    
    for labour in labours:
        attendance = get_attendance_by_labour(labour.id)
        salary_records = get_salary_records(labour_id=labour.id)
        
        present_days = sum(1 for a in attendance if a.status == AttendanceStatus.PRESENT)
        half_days = sum(1 for a in attendance if a.status == AttendanceStatus.HALF_DAY)
        absent_days = sum(1 for a in attendance if a.status == AttendanceStatus.ABSENT)
        
        total_earned = sum(r.total_amount for r in salary_records)
        total_paid = sum(r.total_amount for r in salary_records if r.is_paid)
        
        stats.append({
            "labour_id": labour.id,
            "name": labour.name,
            "is_active": labour.is_active,
            "daily_wage": labour.daily_wage,
            "total_days_present": present_days + (half_days * 0.5),
            "total_days_absent": absent_days,
            "total_half_days": half_days,
            "total_earned": total_earned,
            "total_paid": total_paid,
            "pending_amount": total_earned - total_paid
        })
    
    return {"labours": stats}


@router.get("/sites")
async def get_site_cost_stats(
    current_user: User = Depends(get_current_admin)
):
    """Get cost statistics per site (Admin only)"""
    sites = get_sites()
    all_salary = get_salary_records()

    result = []
    for site in sites:
        labours = get_labours_by_site(site.id)
        labour_ids = set(labours)

        site_records = [r for r in all_salary if r.labour_id in labour_ids]
        total_earned = sum(r.total_amount for r in site_records)
        total_paid = sum(r.paid_amount for r in site_records)

        result.append({
            "site_id": site.id,
            "site_name": site.name,
            "labour_count": len(labours),
            "total_earned": total_earned,
            "total_paid": total_paid,
            "balance": total_earned - total_paid,
        })

    result.sort(key=lambda x: x["total_earned"], reverse=True)
    return {
        "sites": result,
        "grand_total_earned": sum(r["total_earned"] for r in result),
        "grand_total_paid": sum(r["total_paid"] for r in result),
    }


@router.get("/trends")
async def get_attendance_trends(
    labour_id: str,
    weeks: int = 12,
    current_user: User = Depends(get_current_admin)
):
    """Get weekly attendance percentage trend for a labour (Admin only)"""
    from ..db_wrapper import get_labour
    from ..salary_calculator import get_week_boundaries

    labour = get_labour(labour_id)
    if not labour:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Labour not found")

    today = date.today()
    trend = []

    for i in range(weeks - 1, -1, -1):
        target = today - timedelta(weeks=i)
        week_start, week_end = get_week_boundaries(target)

        attendance = get_attendance_by_labour(labour_id, week_start, week_end)
        present = sum(1.0 if a.status == AttendanceStatus.PRESENT else 0.5
                      for a in attendance if a.status != AttendanceStatus.ABSENT)
        pct = round((present / 6) * 100, 1)  # 6-day work week

        salary_records = get_salary_records(labour_id=labour_id)
        week_record = next((r for r in salary_records if r.week_end == week_end), None)

        trend.append({
            "week_end": week_end.isoformat(),
            "label": week_end.strftime("%d %b"),
            "attendance_pct": pct,
            "days_present": present,
            "earnings": week_record.total_amount if week_record else 0.0,
        })

    return {"labour_id": labour_id, "labour_name": labour.name, "trend": trend}
