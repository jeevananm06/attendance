from datetime import date, timedelta
from typing import List, Tuple
from .models import AttendanceStatus, SalaryRecord
from .db_wrapper import (
    get_attendance_by_labour, 
    get_labour, 
    get_salary_records,
    create_salary_record,
    get_all_labours
)


def get_week_boundaries(target_date: date) -> Tuple[date, date]:
    """
    Get the Saturday (start) and Friday (end) of the week containing target_date.
    Week runs from Saturday to Friday.
    """
    # weekday(): Monday=0, Sunday=6
    # We want Saturday=0 (start), Friday=6 (end)
    days_since_saturday = (target_date.weekday() + 2) % 7
    week_start = target_date - timedelta(days=days_since_saturday)
    week_end = week_start + timedelta(days=6)  # Friday
    return week_start, week_end


def get_last_friday(target_date: date = None) -> date:
    """Get the most recent Friday (including today if it's Friday)."""
    if target_date is None:
        target_date = date.today()
    
    days_since_friday = (target_date.weekday() + 3) % 7
    if days_since_friday == 0 and target_date.weekday() == 4:  # Today is Friday
        return target_date
    return target_date - timedelta(days=days_since_friday)


def calculate_days_worked(labour_id: str, week_start: date, week_end: date) -> float:
    """
    Calculate total days worked in a week.
    Present = 1 day, Half day = 0.5 day, Absent = 0 day
    """
    attendance_records = get_attendance_by_labour(labour_id, week_start, week_end)
    
    total_days = 0.0
    for record in attendance_records:
        if record.status == AttendanceStatus.PRESENT:
            total_days += 1.0
        elif record.status == AttendanceStatus.HALF_DAY:
            total_days += 0.5
    
    return total_days


def calculate_weekly_salary(labour_id: str, week_end: date = None) -> SalaryRecord:
    """
    Calculate salary for a specific week ending on Friday.
    """
    if week_end is None:
        week_end = get_last_friday()
    
    week_start, week_end = get_week_boundaries(week_end)
    
    labour = get_labour(labour_id)
    if not labour:
        raise ValueError(f"Labour with id {labour_id} not found")
    
    days_present = calculate_days_worked(labour_id, week_start, week_end)
    
    return create_salary_record(
        labour_id=labour_id,
        week_start=week_start,
        week_end=week_end,
        days_present=days_present,
        daily_wage=labour.daily_wage
    )


def calculate_all_pending_weeks(labour_id: str, up_to_date: date = None) -> List[SalaryRecord]:
    """
    Calculate salary for all weeks from the last paid week to the current week.
    If no payment has been made, start from the labour's join date.
    """
    if up_to_date is None:
        up_to_date = get_last_friday()
    
    labour = get_labour(labour_id)
    if not labour:
        raise ValueError(f"Labour with id {labour_id} not found")
    
    # Find the last paid week
    paid_records = get_salary_records(labour_id=labour_id, is_paid=True)
    
    if paid_records:
        # Start from the week after the last paid week
        last_paid_week_end = max(r.week_end for r in paid_records)
        start_date = last_paid_week_end + timedelta(days=1)
    else:
        # Start from join date
        start_date = labour.joined_date
    
    # Calculate for each week
    records = []
    current_week_start, current_week_end = get_week_boundaries(start_date)
    
    while current_week_end <= up_to_date:
        record = calculate_weekly_salary(labour_id, current_week_end)
        records.append(record)
        current_week_start = current_week_end + timedelta(days=1)
        current_week_end = current_week_start + timedelta(days=6)
    
    return records


def get_consolidated_pending_salary(labour_id: str) -> dict:
    """
    Get consolidated pending salary for a labour.
    Returns total pending amount across all unpaid weeks.
    """
    unpaid_records = get_salary_records(labour_id=labour_id, is_paid=False)
    
    if not unpaid_records:
        return {
            "labour_id": labour_id,
            "total_pending": 0.0,
            "weeks_pending": 0,
            "records": []
        }
    
    total_pending = sum(r.total_amount for r in unpaid_records)
    
    return {
        "labour_id": labour_id,
        "total_pending": total_pending,
        "weeks_pending": len(unpaid_records),
        "oldest_unpaid_week": min(r.week_start for r in unpaid_records).isoformat(),
        "latest_unpaid_week": max(r.week_end for r in unpaid_records).isoformat(),
        "records": [
            {
                "week_start": r.week_start.isoformat(),
                "week_end": r.week_end.isoformat(),
                "days_present": r.days_present,
                "amount": r.total_amount
            }
            for r in sorted(unpaid_records, key=lambda x: x.week_end)
        ]
    }


def recalculate_all_salaries(up_to_date: date = None) -> dict:
    """
    Recalculate salaries for all active labours.
    """
    if up_to_date is None:
        up_to_date = get_last_friday()
    
    labours = get_all_labours()
    results = {}
    
    for labour in labours:
        try:
            records = calculate_all_pending_weeks(labour.id, up_to_date)
            results[labour.id] = {
                "name": labour.name,
                "weeks_calculated": len(records),
                "status": "success"
            }
        except Exception as e:
            results[labour.id] = {
                "name": labour.name,
                "error": str(e),
                "status": "error"
            }
    
    return results
