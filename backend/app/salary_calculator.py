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

USE_POSTGRES = __import__('os').getenv("USE_POSTGRES", "false").lower() == "true"

if USE_POSTGRES:
    from .db_operations import get_attendance_bulk, get_salary_records_bulk, create_salary_records_bulk


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
    Skips weeks that already have an unpaid salary record (optimization #2).
    """
    if up_to_date is None:
        up_to_date = get_last_friday()

    labour = get_labour(labour_id)
    if not labour:
        raise ValueError(f"Labour with id {labour_id} not found")

    all_records = get_salary_records(labour_id=labour_id)
    existing_week_ends = {r.week_end for r in all_records}

    paid_records = [r for r in all_records if r.is_paid]
    if paid_records:
        last_paid_week_end = max(r.week_end for r in paid_records)
        start_date = last_paid_week_end + timedelta(days=1)
    else:
        start_date = labour.joined_date

    records = []
    current_week_start, current_week_end = get_week_boundaries(start_date)

    while current_week_end <= up_to_date:
        # Skip weeks already calculated (optimization #2)
        if current_week_end not in existing_week_ends:
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
    Recalculate salaries for all active labours using bulk DB queries (optimization #4).
    - 1 query to get all labours
    - 1 query to get all salary records for all labours
    - 1 query to get all attendance records for the full date range
    - 1 bulk upsert for all new salary records
    """
    if up_to_date is None:
        up_to_date = get_last_friday()

    labours = get_all_labours()
    if not labours:
        return {}

    labour_ids = [l.id for l in labours]
    labour_map = {l.id: l for l in labours}

    # Determine overall date range needed (optimization #4 - single attendance query)
    earliest_join = min(l.joined_date for l in labours)
    if USE_POSTGRES:
        all_salary = get_salary_records_bulk(labour_ids)
        all_attendance = get_attendance_bulk(labour_ids, earliest_join, up_to_date)
    else:
        all_salary = {l.id: get_salary_records(labour_id=l.id) for l in labours}
        all_attendance = {l.id: get_attendance_by_labour(l.id, earliest_join, up_to_date) for l in labours}

    new_records_data = []
    results = {}

    for labour in labours:
        try:
            salary_records = all_salary.get(labour.id, [])
            existing_week_ends = {r.week_end for r in salary_records}
            paid_records = [r for r in salary_records if r.is_paid]

            if paid_records:
                last_paid_week_end = max(r.week_end for r in paid_records)
                start_date = last_paid_week_end + timedelta(days=1)
            else:
                start_date = labour.joined_date

            # Build attendance lookup for this labour: date -> status
            labour_attendance = {r.date: r.status for r in all_attendance.get(labour.id, [])}

            weeks_calculated = 0
            current_week_start, current_week_end = get_week_boundaries(start_date)

            while current_week_end <= up_to_date:
                if current_week_end not in existing_week_ends:
                    # Calculate days from pre-fetched attendance (no extra DB call)
                    days_present = 0.0
                    d = current_week_start
                    while d <= current_week_end:
                        status = labour_attendance.get(d)
                        if status == AttendanceStatus.PRESENT:
                            days_present += 1.0
                        elif status == AttendanceStatus.HALF_DAY:
                            days_present += 0.5
                        d += timedelta(days=1)

                    new_records_data.append({
                        'labour_id': labour.id,
                        'week_start': current_week_start,
                        'week_end': current_week_end,
                        'days_present': days_present,
                        'daily_wage': labour.daily_wage
                    })
                    weeks_calculated += 1

                current_week_start = current_week_end + timedelta(days=1)
                current_week_end = current_week_start + timedelta(days=6)

            results[labour.id] = {
                "name": labour.name,
                "weeks_calculated": weeks_calculated,
                "status": "success"
            }
        except Exception as e:
            results[labour.id] = {
                "name": labour.name,
                "error": str(e),
                "status": "error"
            }

    # Single bulk upsert for all new records (optimization #4)
    if new_records_data:
        if USE_POSTGRES:
            create_salary_records_bulk(new_records_data)
        else:
            for data in new_records_data:
                create_salary_record(**data)

    return results
