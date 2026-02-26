from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from datetime import date, timedelta
import calendar

from ..models import Attendance, AttendanceCreate, AttendanceBulkCreate, User, AttendanceStatus
from ..auth import get_current_manager_or_admin
from ..db_wrapper import (
    get_attendance_by_date,
    get_attendance_by_labour,
    mark_attendance,
    get_all_labours,
    get_labour
)

router = APIRouter(prefix="/attendance", tags=["Attendance"])


@router.get("/date/{target_date}", response_model=List[Attendance])
async def get_attendance_for_date(
    target_date: date,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get attendance records for a specific date"""
    return get_attendance_by_date(target_date)


@router.get("/labour/{labour_id}", response_model=List[Attendance])
async def get_attendance_for_labour(
    labour_id: str,
    start_date: date = None,
    end_date: date = None,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get attendance records for a specific labour"""
    return get_attendance_by_labour(labour_id, start_date, end_date)


@router.post("/", response_model=Attendance)
async def mark_single_attendance(
    attendance_data: AttendanceCreate,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Mark attendance for a single labour."""
    return mark_attendance(
        labour_id=attendance_data.labour_id,
        target_date=attendance_data.date,
        status=attendance_data.status,
        marked_by=current_user.username
    )


@router.post("/bulk", response_model=List[Attendance])
async def mark_bulk_attendance(
    bulk_data: AttendanceBulkCreate,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Mark attendance for multiple labours at once."""
    results = []
    for record in bulk_data.records:
        attendance = mark_attendance(
            labour_id=record["labour_id"],
            target_date=bulk_data.date,
            status=AttendanceStatus(record["status"]),
            marked_by=current_user.username
        )
        results.append(attendance)
    return results



@router.post("/fill-month", response_model=dict)
async def fill_month_attendance(
    labour_id: str,
    year: int,
    month: int,
    status: AttendanceStatus = AttendanceStatus.PRESENT,
    skip_sundays: bool = True,
    overwrite: bool = False,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Fill attendance for a labour for an entire month. Skips Sundays by default.
    If overwrite=False (default), only fills dates that have no record yet."""
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(status_code=404, detail="Labour not found")

    _, days_in_month = calendar.monthrange(year, month)
    existing_records = get_attendance_by_labour(
        labour_id,
        start_date=date(year, month, 1),
        end_date=date(year, month, days_in_month)
    )
    existing_dates = {r.date for r in existing_records}

    filled = []
    skipped = []
    current = date(year, month, 1)
    end = date(year, month, days_in_month)

    while current <= end:
        is_sunday = current.weekday() == 6
        if skip_sundays and is_sunday:
            skipped.append({"date": current.isoformat(), "reason": "sunday"})
        elif not overwrite and current in existing_dates:
            skipped.append({"date": current.isoformat(), "reason": "already_marked"})
        else:
            mark_attendance(
                labour_id=labour_id,
                target_date=current,
                status=status,
                marked_by=current_user.username
            )
            filled.append(current.isoformat())
        current += timedelta(days=1)

    return {
        "labour_id": labour_id,
        "name": labour.name,
        "year": year,
        "month": month,
        "status": status.value,
        "filled_count": len(filled),
        "skipped_count": len(skipped),
        "filled_dates": filled,
    }


@router.get("/today", response_model=dict)
async def get_today_attendance_status(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get today's attendance status with all labours"""
    today = date.today()
    labours = get_all_labours()
    attendance_records = get_attendance_by_date(today)
    
    # Create a map of labour_id to attendance status
    attendance_map = {a.labour_id: a.status.value for a in attendance_records}
    
    result = []
    for labour in labours:
        result.append({
            "labour_id": labour.id,
            "name": labour.name,
            "daily_wage": labour.daily_wage,
            "status": attendance_map.get(labour.id, "not_marked")
        })
    
    return {
        "date": today.isoformat(),
        "total_labours": len(labours),
        "marked": len(attendance_records),
        "pending": len(labours) - len(attendance_records),
        "records": result
    }
