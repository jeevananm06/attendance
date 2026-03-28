import calendar as cal_module
from collections import defaultdict

from fastapi import APIRouter, Depends
from typing import List
from datetime import date, timedelta

from ..models import User, LabourStats, UserRole
from ..auth import get_current_manager_or_admin, get_current_authenticated_user, get_current_admin
from ..db_wrapper import (
    get_all_labours,
    get_attendance_by_labour,
    get_attendance_by_date,
    get_salary_records,
    get_salary_records_bulk,
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
    
    # Get today's attendance in ONE query instead of N queries
    today = date.today()
    today_attendance = get_attendance_by_date(today)
    
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

        # Current month stats
        month_start = today.replace(day=1)
        month_records = [r for r in all_salary_records if r.week_end >= month_start]
        month_earned = sum(r.total_amount for r in month_records)
        month_paid = sum(r.paid_amount for r in month_records)
        month_pending = month_earned - month_paid

        result["salary"] = {
            "total_earned": total_earned,
            "total_paid": total_paid,
            "total_pending": total_pending,
            "month_earned": month_earned,
            "month_paid": month_paid,
            "month_pending": month_pending,
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

    labours = get_all_labours()
    all_records = get_salary_records()

    for i in range(weeks):
        target_date = today - timedelta(weeks=i)
        week_start, week_end = get_week_boundaries(target_date)

        # Filter records for this week
        week_salary = [r for r in all_records if r.week_end == week_end]
        
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
    if not labours:
        return {"labours": []}
    
    # Bulk fetch all data in 2 queries instead of 2*N queries
    labour_ids = [l.id for l in labours]
    all_salary_map = get_salary_records_bulk(labour_ids)
    
    stats = []
    for labour in labours:
        # Get all-time attendance stats from salary records (days_present already calculated)
        salary_records = all_salary_map.get(labour.id, [])
        
        total_earned = sum(r.total_amount for r in salary_records)
        total_paid = sum(r.paid_amount for r in salary_records)
        total_days = sum(r.days_present for r in salary_records)
        
        stats.append({
            "labour_id": labour.id,
            "name": labour.name,
            "is_active": labour.is_active,
            "daily_wage": labour.daily_wage,
            "total_days_present": total_days,
            "total_days_absent": 0,  # Not tracked in salary records
            "total_half_days": 0,    # Not tracked separately
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


@router.get("/weekly-by-site")
async def get_weekly_wages_by_site(
    weeks: int = 8,
    current_user: User = Depends(get_current_admin)
):
    """Get weekly wage breakdown per site for last N weeks (Admin only)"""
    from ..salary_calculator import get_week_boundaries

    today = date.today()
    sites = get_sites()
    all_salary = get_salary_records()
    all_labours = get_all_labours(include_inactive=True)

    # Build site_name → set(labour_ids) map
    site_labour_map = {}
    all_assigned_ids = set()
    for site in sites:
        ids = set(get_labours_by_site(site.id))
        if ids:
            site_labour_map[site.name] = ids
            all_assigned_ids |= ids

    unassigned_ids = set(l.id for l in all_labours) - all_assigned_ids
    if unassigned_ids:
        site_labour_map["Unassigned"] = unassigned_ids

    site_names = list(site_labour_map.keys())
    result = []

    for i in range(weeks - 1, -1, -1):
        target_date = today - timedelta(weeks=i)
        week_start, week_end = get_week_boundaries(target_date)
        week_records = [r for r in all_salary if r.week_end == week_end]

        entry = {
            "week_end": week_end.isoformat(),
            "label": week_end.strftime("%d %b"),
        }
        for site_name, labour_ids in site_labour_map.items():
            entry[site_name] = sum(
                r.total_amount for r in week_records if r.labour_id in labour_ids
            )

        result.append(entry)

    return {"weeks": result, "site_names": site_names}


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


# ======================== SALARY ANALYTICS ========================


@router.get("/payment-delays")
async def get_payment_delay_tracker(
    current_user: User = Depends(get_current_admin)
):
    """Payment Delay Tracker — how long salary stays unpaid after the period ends (Admin only)"""
    all_records = get_salary_records()
    labours = get_all_labours(include_inactive=True)
    labour_map = {l.id: l.name for l in labours}
    today = date.today()

    per_labour = defaultdict(lambda: {"delays": [], "total_pending": 0.0})

    for r in all_records:
        if r.is_paid:
            if r.paid_date:
                delay_days = (r.paid_date - r.week_end).days
                per_labour[r.labour_id]["delays"].append(delay_days)
        else:
            delay_days = (today - r.week_end).days
            per_labour[r.labour_id]["delays"].append(delay_days)
            per_labour[r.labour_id]["total_pending"] += r.total_amount - r.paid_amount

    # Build per-labour summary
    labour_delays = []
    for lid, info in per_labour.items():
        delays = info["delays"]
        if not delays:
            continue
        labour_delays.append({
            "labour_id": lid,
            "name": labour_map.get(lid, "Unknown"),
            "avg_delay_days": round(sum(delays) / len(delays), 1),
            "max_delay_days": max(delays),
            "records_count": len(delays),
            "pending_amount": info["total_pending"],
        })

    labour_delays.sort(key=lambda x: x["avg_delay_days"], reverse=True)

    # Bucket distribution
    buckets = {"within_7d": 0, "8_to_14d": 0, "15_to_30d": 0, "over_30d": 0}
    all_delays = []
    for info in per_labour.values():
        all_delays.extend(info["delays"])
    for d in all_delays:
        if d <= 7:
            buckets["within_7d"] += 1
        elif d <= 14:
            buckets["8_to_14d"] += 1
        elif d <= 30:
            buckets["15_to_30d"] += 1
        else:
            buckets["over_30d"] += 1

    avg_overall = round(sum(all_delays) / len(all_delays), 1) if all_delays else 0

    return {
        "avg_delay_days": avg_overall,
        "total_records": len(all_delays),
        "buckets": buckets,
        "labours": labour_delays,
    }


@router.get("/payment-funnel")
async def get_attendance_to_payment_funnel(
    year: int = None,
    month: int = None,
    current_user: User = Depends(get_current_admin)
):
    """Attendance-to-Payment Funnel — pipeline from attendance marked to salary paid (Admin only)"""
    today = date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month

    from_date = date(year, month, 1)
    to_date = date(year, month, cal_module.monthrange(year, month)[1])

    labours = get_all_labours(include_inactive=True)
    active_labour_ids = set(l.id for l in labours if l.is_active)

    # Stage 1: Attendance marked (unique labours who have any attendance this month)
    attendance_marked_ids = set()
    for labour in labours:
        att = get_attendance_by_labour(labour.id, from_date, to_date)
        if att:
            attendance_marked_ids.add(labour.id)

    # Stage 2 & 3: Salary calculated (records exist) and salary paid
    all_records = get_salary_records()
    month_records = [r for r in all_records if from_date <= r.week_end <= to_date]

    salary_calculated_ids = set(r.labour_id for r in month_records)
    fully_paid_ids = set()
    partially_paid_ids = set()
    unpaid_ids = set()

    labour_records = defaultdict(list)
    for r in month_records:
        labour_records[r.labour_id].append(r)

    for lid, records in labour_records.items():
        all_paid = all(r.is_paid for r in records)
        any_paid = any(r.paid_amount > 0 for r in records)
        if all_paid:
            fully_paid_ids.add(lid)
        elif any_paid:
            partially_paid_ids.add(lid)
        else:
            unpaid_ids.add(lid)

    total_earned = sum(r.total_amount for r in month_records)
    total_paid_amt = sum(r.paid_amount for r in month_records)

    return {
        "year": year,
        "month": month,
        "funnel": {
            "active_labours": len(active_labour_ids),
            "attendance_marked": len(attendance_marked_ids),
            "salary_calculated": len(salary_calculated_ids),
            "fully_paid": len(fully_paid_ids),
            "partially_paid": len(partially_paid_ids),
            "unpaid": len(unpaid_ids),
        },
        "amounts": {
            "total_earned": total_earned,
            "total_paid": total_paid_amt,
            "pending": total_earned - total_paid_amt,
        },
        "stuck_at_attendance": sorted(attendance_marked_ids - salary_calculated_ids),
        "stuck_at_calculated": sorted(salary_calculated_ids - fully_paid_ids - partially_paid_ids),
    }


@router.get("/site-profitability")
async def get_site_profitability(
    weeks: int = 8,
    year: int = None,
    month: int = None,
    current_user: User = Depends(get_current_admin)
):
    """Site Profitability / Cost-per-Day — per-site cost efficiency for a given month (Admin only).
    Cost/Day and Utilization are scoped to the selected month (defaults to current month).
    Cost/Day = total earned / days in month.
    Utilization = actual attendance days / (labours × working weeks × 7), capped at 100%.
    """
    from ..salary_calculator import get_week_boundaries

    today = date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month

    from_date = date(year, month, 1)
    to_date = date(year, month, cal_module.monthrange(year, month)[1])

    sites = get_sites()
    all_salary = get_salary_records()
    all_labours = get_all_labours(include_inactive=True)

    # Filter salary records to the selected month
    month_salary = [r for r in all_salary if from_date <= r.week_end <= to_date]

    # Count how many distinct weeks fall in this month (for utilization denominator)
    week_ends_in_month = set(r.week_end for r in month_salary)
    num_weeks = len(week_ends_in_month) or 1  # avoid div-by-zero

    # Build site → labour_ids map
    site_info = {}
    all_assigned = set()
    for site in sites:
        ids = set(get_labours_by_site(site.id))
        site_info[site.id] = {"name": site.name, "labour_ids": ids}
        all_assigned |= ids

    unassigned = set(l.id for l in all_labours) - all_assigned
    if unassigned:
        site_info["unassigned"] = {"name": "Unassigned", "labour_ids": unassigned}

    # Per-site summary (scoped to selected month)
    site_summaries = []
    for sid, info in site_info.items():
        lids = info["labour_ids"]
        site_records = [r for r in month_salary if r.labour_id in lids]
        total_earned = sum(r.total_amount for r in site_records)
        total_days = sum(r.days_present for r in site_records)

        # Cost per day = total earned / number of days in the month
        days_in_month = cal_module.monthrange(year, month)[1]
        cost_per_day = round(total_earned / days_in_month, 2) if total_earned > 0 else 0

        # Utilization = actual days / possible days
        # Possible days = number of labours who have records × number of weeks × 7
        active_lids_in_month = set(r.labour_id for r in site_records)
        possible_days = len(active_lids_in_month) * num_weeks * 7
        utilization_pct = round(min(total_days / possible_days, 1.0) * 100, 1) if possible_days > 0 else 0

        site_summaries.append({
            "site_id": sid,
            "site_name": info["name"],
            "labour_count": len(lids),
            "active_this_month": len(active_lids_in_month),
            "total_earned": total_earned,
            "total_days": total_days,
            "cost_per_day": cost_per_day,
            "utilization_pct": utilization_pct,
        })

    site_summaries.sort(key=lambda x: x["total_earned"], reverse=True)

    # Weekly trend per site (last N weeks, not scoped to month — gives broader picture)
    weekly_trend = []
    for i in range(weeks - 1, -1, -1):
        target = today - timedelta(weeks=i)
        week_start, week_end = get_week_boundaries(target)
        week_records = [r for r in all_salary if r.week_end == week_end]

        entry = {"week_end": week_end.isoformat(), "label": week_end.strftime("%d %b")}
        for sid, info in site_info.items():
            lids = info["labour_ids"]
            sr = [r for r in week_records if r.labour_id in lids]
            days = sum(r.days_present for r in sr)
            earned = sum(r.total_amount for r in sr)
            entry[info["name"] + "_cost_per_day"] = round(earned / days, 2) if days > 0 else 0
            entry[info["name"] + "_total"] = earned
        weekly_trend.append(entry)

    return {
        "year": year,
        "month": month,
        "sites": site_summaries,
        "weekly_trend": weekly_trend,
        "site_names": [s["site_name"] for s in site_summaries],
    }


@router.get("/payroll-comparison")
async def get_payroll_comparison(
    current_user: User = Depends(get_current_admin)
):
    """Payroll Comparison (Month-over-Month) — last 6 months side-by-side (Admin only)"""
    today = date.today()
    all_records = get_salary_records()
    labours = get_all_labours(include_inactive=True)
    labour_wage_map = {l.id: l.daily_wage for l in labours}

    months = []
    for i in range(5, -1, -1):
        # Go back i months
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        from_date = date(y, m, 1)
        to_date = date(y, m, cal_module.monthrange(y, m)[1])

        month_records = [r for r in all_records if from_date <= r.week_end <= to_date]
        labour_ids_in_month = set(r.labour_id for r in month_records)

        total_earned = sum(r.total_amount for r in month_records)
        total_paid = sum(r.paid_amount for r in month_records)
        total_days = sum(r.days_present for r in month_records)

        months.append({
            "year": y,
            "month": m,
            "label": from_date.strftime("%b %Y"),
            "headcount": len(labour_ids_in_month),
            "total_earned": total_earned,
            "total_paid": total_paid,
            "pending": total_earned - total_paid,
            "total_days": total_days,
            "avg_daily_cost": round(total_earned / total_days, 2) if total_days > 0 else 0,
        })

    # Month-over-month changes
    for i in range(1, len(months)):
        prev = months[i - 1]
        curr = months[i]
        if prev["total_earned"] > 0:
            curr["earned_change_pct"] = round(
                ((curr["total_earned"] - prev["total_earned"]) / prev["total_earned"]) * 100, 1
            )
        else:
            curr["earned_change_pct"] = 0
        curr["headcount_change"] = curr["headcount"] - prev["headcount"]

    return {"months": months}


@router.get("/wage-distribution")
async def get_wage_distribution(
    current_user: User = Depends(get_current_admin)
):
    """Daily Wage Distribution & Wage Bill Sensitivity (Admin only)"""
    labours = get_all_labours()
    if not labours:
        return {"distribution": [], "sensitivity": [], "stats": {}}

    wages = [l.daily_wage for l in labours]
    wages.sort()

    # Distribution histogram (buckets of 100)
    if not wages:
        return {"distribution": [], "sensitivity": [], "stats": {}}

    min_w = int(wages[0] // 100) * 100
    max_w = int(wages[-1] // 100 + 1) * 100
    buckets = []
    for b_start in range(min_w, max_w, 100):
        b_end = b_start + 100
        count = sum(1 for w in wages if b_start <= w < b_end)
        if count > 0:
            buckets.append({
                "range": f"{b_start}-{b_end}",
                "min": b_start,
                "max": b_end,
                "count": count,
            })

    # Stats
    avg_wage = round(sum(wages) / len(wages), 2)
    median_wage = wages[len(wages) // 2]
    total_daily_bill = sum(wages)

    # Sensitivity analysis: what-if wage increase
    sensitivity = []
    for pct in [5, 10, 15, 20, 25]:
        new_total = sum(w * (1 + pct / 100) for w in wages)
        monthly_increase = (new_total - total_daily_bill) * 26  # 26 working days/month
        sensitivity.append({
            "increase_pct": pct,
            "new_daily_bill": round(new_total, 2),
            "daily_increase": round(new_total - total_daily_bill, 2),
            "monthly_increase": round(monthly_increase, 2),
        })

    # Per-labour wage list
    labour_wages = sorted(
        [{"name": l.name, "daily_wage": l.daily_wage, "is_active": l.is_active} for l in labours],
        key=lambda x: x["daily_wage"],
        reverse=True,
    )

    return {
        "distribution": buckets,
        "sensitivity": sensitivity,
        "stats": {
            "count": len(wages),
            "min": min(wages),
            "max": max(wages),
            "avg": avg_wage,
            "median": median_wage,
            "total_daily_bill": total_daily_bill,
            "estimated_monthly_bill": round(total_daily_bill * 26, 2),
        },
        "labours": labour_wages,
    }


@router.get("/attendance-report")
async def get_attendance_report(
    months: int = 12,
    current_user: User = Depends(get_current_admin)
):
    """Attendance report for last N months — days present vs calendar days per labour.
    Working days = actual days in the calendar month (28/30/31).
    Sorted by attendance percentage descending.
    """
    today = date.today()
    # Build list of (year, month) tuples for the last N months
    month_list = []
    y, m = today.year, today.month
    for _ in range(months):
        month_list.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    month_list.reverse()

    from_date = date(month_list[0][0], month_list[0][1], 1)

    all_salary = get_salary_records()
    all_labours = get_all_labours(include_inactive=False)

    # Filter salary records to the period
    period_salary = [r for r in all_salary if r.week_end >= from_date]

    # Per-month: days_present per labour, and calendar days in month
    month_buckets = defaultdict(lambda: defaultdict(float))
    for r in period_salary:
        key = r.week_end.strftime("%Y-%m")
        month_buckets[r.labour_id][key] += r.days_present

    # Build month labels with actual calendar days
    month_labels = []
    month_calendar_days = {}
    for yr, mo in month_list:
        key = f"{yr:04d}-{mo:02d}"
        cal_days = cal_module.monthrange(yr, mo)[1]
        month_calendar_days[key] = cal_days
        label = date(yr, mo, 1).strftime("%b %Y")
        month_labels.append({"key": key, "label": label, "working_days": cal_days})

    # Per-labour summary
    labour_rows = []
    for labour in all_labours:
        lid = labour.id
        records = [r for r in period_salary if r.labour_id == lid]
        if not records:
            continue
        days_present = sum(r.days_present for r in records)

        # Working days = sum of calendar days for months where labour has records
        active_months = set(r.week_end.strftime("%Y-%m") for r in records)
        labour_working_days = sum(month_calendar_days.get(m, 30) for m in active_months)
        pct = round(days_present / labour_working_days * 100, 1) if labour_working_days > 0 else 0

        # Monthly breakdown
        monthly = []
        for m_info in month_labels:
            m_key = m_info["key"]
            present = month_buckets[lid].get(m_key, 0)
            if present > 0 or m_key in active_months:
                monthly.append({
                    "month": m_info["label"],
                    "days_present": present,
                    "working_days": m_info["working_days"],
                })

        labour_rows.append({
            "labour_id": lid,
            "labour_name": labour.name,
            "designation": getattr(labour, "designation", None),
            "days_present": days_present,
            "working_days": labour_working_days,
            "attendance_pct": pct,
            "monthly": monthly,
        })

    # Sort by attendance percentage descending
    labour_rows.sort(key=lambda x: x["attendance_pct"], reverse=True)

    return {
        "months": months,
        "from_date": from_date.isoformat(),
        "to_date": today.isoformat(),
        "month_labels": month_labels,
        "labours": labour_rows,
    }
