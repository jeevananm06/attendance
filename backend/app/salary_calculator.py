import calendar
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
    days_since_saturday = (target_date.weekday() + 2) % 7
    week_start = target_date - timedelta(days=days_since_saturday)
    week_end = week_start + timedelta(days=6)  # Friday
    return week_start, week_end


def get_last_friday(target_date: date = None) -> date:
    """Get the most recent Friday (including today if it's Friday)."""
    if target_date is None:
        target_date = date.today()
    days_since_friday = (target_date.weekday() + 3) % 7
    if days_since_friday == 0 and target_date.weekday() == 4:
        return target_date
    return target_date - timedelta(days=days_since_friday)


def get_month_boundaries(year: int, month: int) -> Tuple[date, date]:
    """Return the first and last date of a calendar month."""
    first = date(year, month, 1)
    last = date(year, month, calendar.monthrange(year, month)[1])
    return first, last


def get_last_completed_month(target_date: date = None) -> Tuple[int, int]:
    """Return (year, month) of the most recently completed calendar month."""
    if target_date is None:
        target_date = date.today()
    if target_date.month == 1:
        return target_date.year - 1, 12
    return target_date.year, target_date.month - 1


def add_months(d: date, months: int) -> date:
    """Add `months` to a date, clamping day to valid range for the target month."""
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def get_rolling_period_boundaries(joined_date: date, period_index: int) -> Tuple[date, date]:
    """
    Return (period_start, period_end) for a rolling monthly period.
    Period 0: joined_date .. (joined_date + 1 month - 1 day)
    Period 1: period_0_end + 1 day .. (that + 1 month - 1 day)
    e.g. joined Feb 25 -> period 0: Feb 25 - Mar 24, period 1: Mar 25 - Apr 24
    """
    period_start = add_months(joined_date, period_index)
    period_end = add_months(joined_date, period_index + 1) - timedelta(days=1)
    return period_start, period_end


def get_rolling_periods_up_to(joined_date: date, up_to_date: date) -> List[Tuple[date, date]]:
    """Return all complete rolling monthly periods whose end date <= up_to_date."""
    periods = []
    i = 0
    while True:
        p_start, p_end = get_rolling_period_boundaries(joined_date, i)
        if p_end > up_to_date:
            break
        periods.append((p_start, p_end))
        i += 1
    return periods


def count_days_from_attendance(labour_attendance: dict, start: date, end: date) -> float:
    """Count present + half-day from pre-fetched attendance dict for a date range."""
    days = 0.0
    d = start
    while d <= end:
        status = labour_attendance.get(d)
        if status == AttendanceStatus.PRESENT:
            days += 1.0
        elif status == AttendanceStatus.HALF_DAY:
            days += 0.5
        elif status == AttendanceStatus.PRESENT_HALF:
            days += 1.5
        elif status == AttendanceStatus.DOUBLE_DUTY:
            days += 2.0
        d += timedelta(days=1)
    return days


def calculate_days_worked(labour_id: str, start: date, end: date) -> float:
    """Calculate total days worked in a date range from DB."""
    attendance_records = get_attendance_by_labour(labour_id, start, end)
    total_days = 0.0
    for record in attendance_records:
        if record.status == AttendanceStatus.PRESENT:
            total_days += 1.0
        elif record.status == AttendanceStatus.HALF_DAY:
            total_days += 0.5
        elif record.status == AttendanceStatus.PRESENT_HALF:
            total_days += 1.5
        elif record.status == AttendanceStatus.DOUBLE_DUTY:
            total_days += 2.0
    return total_days


def calculate_weekly_salary(labour_id: str, week_end: date = None) -> SalaryRecord:
    """Calculate salary for a specific week ending on Friday."""
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


def calculate_monthly_salary(labour_id: str, period_start: date, period_end: date) -> SalaryRecord:
    """Calculate salary for a rolling monthly period (period_start..period_end)."""
    labour = get_labour(labour_id)
    if not labour:
        raise ValueError(f"Labour with id {labour_id} not found")
    days_present = calculate_days_worked(labour_id, period_start, period_end)
    return create_salary_record(
        labour_id=labour_id,
        week_start=period_start,
        week_end=period_end,
        days_present=days_present,
        daily_wage=labour.daily_wage
    )


def calculate_all_pending_weeks(labour_id: str, up_to_date: date = None) -> List[SalaryRecord]:
    """Calculate salary for all unpaid periods for a single labour."""
    if up_to_date is None:
        up_to_date = get_last_friday()

    labour = get_labour(labour_id)
    if not labour:
        raise ValueError(f"Labour with id {labour_id} not found")

    pay_cycle = getattr(labour, 'pay_cycle', 'weekly') or 'weekly'
    all_records = get_salary_records(labour_id=labour_id)
    paid_records = [r for r in all_records if r.is_paid]
    paid_ends = {r.week_end for r in paid_records}

    if paid_records:
        last_paid_end = max(r.week_end for r in paid_records)
        start_date = last_paid_end + timedelta(days=1)
    else:
        start_date = labour.joined_date

    records = []

    if pay_cycle == 'monthly':
        periods = get_rolling_periods_up_to(labour.joined_date, up_to_date)
        # Skip periods that were already accounted for by start_date
        periods = [(ps, pe) for ps, pe in periods if pe >= start_date]
        for p_start, p_end in periods:
            if p_end not in paid_ends:
                record = calculate_monthly_salary(labour_id, p_start, p_end)
                records.append(record)
    else:
        current_week_start, current_week_end = get_week_boundaries(start_date)
        while current_week_end <= up_to_date:
            if current_week_end not in paid_ends:
                record = calculate_weekly_salary(labour_id, current_week_end)
                records.append(record)
            current_week_start = current_week_end + timedelta(days=1)
            current_week_end = current_week_start + timedelta(days=6)

    return records


def get_consolidated_pending_salary(labour_id: str) -> dict:
    """
    Get consolidated pending salary for a labour.
    Returns total pending amount across all unpaid periods.
    """
    all_unpaid = get_salary_records(labour_id=labour_id, is_paid=False)
    unpaid_records = [r for r in all_unpaid if r.total_amount > 0]

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
    Handles both weekly and monthly pay cycles.
    """
    if up_to_date is None:
        up_to_date = date.today()

    last_friday = get_last_friday(up_to_date)
    last_year, last_month = get_last_completed_month(up_to_date)

    labours = get_all_labours()
    if not labours:
        return {}

    labour_ids = [l.id for l in labours]

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
            pay_cycle = getattr(labour, 'pay_cycle', 'weekly') or 'weekly'
            salary_records = all_salary.get(labour.id, [])
            paid_records = [r for r in salary_records if r.is_paid]
            paid_ends = {r.week_end for r in paid_records}

            if paid_records:
                last_paid_end = max(r.week_end for r in paid_records)
                start_date = last_paid_end + timedelta(days=1)
            else:
                start_date = labour.joined_date

            labour_attendance = {r.date: r.status for r in all_attendance.get(labour.id, [])}
            periods_calculated = 0

            if pay_cycle == 'monthly':
                periods = get_rolling_periods_up_to(labour.joined_date, up_to_date)
                periods = [(ps, pe) for ps, pe in periods if pe >= start_date]
                for p_start, p_end in periods:
                    if p_end not in paid_ends:
                        days_present = count_days_from_attendance(labour_attendance, p_start, p_end)
                        new_records_data.append({
                            'labour_id': labour.id,
                            'week_start': p_start,
                            'week_end': p_end,
                            'days_present': days_present,
                            'daily_wage': labour.daily_wage
                        })
                        periods_calculated += 1
            else:
                current_week_start, current_week_end = get_week_boundaries(start_date)
                while current_week_end <= last_friday:
                    if current_week_end not in paid_ends:
                        days_present = count_days_from_attendance(labour_attendance, current_week_start, current_week_end)
                        new_records_data.append({
                            'labour_id': labour.id,
                            'week_start': current_week_start,
                            'week_end': current_week_end,
                            'days_present': days_present,
                            'daily_wage': labour.daily_wage
                        })
                        periods_calculated += 1
                    current_week_start = current_week_end + timedelta(days=1)
                    current_week_end = current_week_start + timedelta(days=6)

            results[labour.id] = {
                "name": labour.name,
                "weeks_calculated": periods_calculated,
                "status": "success"
            }
        except Exception as e:
            results[labour.id] = {
                "name": labour.name,
                "error": str(e),
                "status": "error"
            }

    if new_records_data:
        if USE_POSTGRES:
            create_salary_records_bulk(new_records_data)
        else:
            for data in new_records_data:
                create_salary_record(**data)

    return results
