from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from datetime import date

from ..models import Attendance, AttendanceCreate, AttendanceBulkCreate, User, AttendanceStatus
from ..auth import get_current_manager_or_admin, get_current_admin
from ..db_wrapper import (
    get_attendance_by_date,
    get_attendance_by_labour,
    mark_attendance,
    delete_attendance,
    purge_absent_attendance_records,
    get_all_labours
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
    """Mark attendance for a single labour. Absent = unmark (deletes record)."""
    if attendance_data.status == AttendanceStatus.ABSENT:
        delete_attendance(attendance_data.labour_id, attendance_data.date)
        return Attendance(
            id="",
            labour_id=attendance_data.labour_id,
            date=attendance_data.date,
            status=AttendanceStatus.ABSENT,
            marked_by=current_user.username,
            marked_at=__import__('datetime').datetime.now()
        )
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
    """Mark attendance for multiple labours at once. Absent = unmark (deletes record)."""
    from datetime import datetime
    results = []
    for record in bulk_data.records:
        s = AttendanceStatus(record["status"])
        if s == AttendanceStatus.ABSENT:
            delete_attendance(record["labour_id"], bulk_data.date)
            results.append(Attendance(
                id="",
                labour_id=record["labour_id"],
                date=bulk_data.date,
                status=AttendanceStatus.ABSENT,
                marked_by=current_user.username,
                marked_at=datetime.now()
            ))
        else:
            attendance = mark_attendance(
                labour_id=record["labour_id"],
                target_date=bulk_data.date,
                status=s,
                marked_by=current_user.username
            )
            results.append(attendance)
    return results


@router.post("/admin/purge-absent")
async def purge_absent_records(
    current_user: User = Depends(get_current_admin)
):
    """Admin only: Delete all stored absent records and recalculate salaries."""
    from ..salary_calculator import recalculate_all_salaries
    deleted = purge_absent_attendance_records()
    recalculate_all_salaries()
    return {
        "deleted_absent_records": deleted,
        "message": f"Purged {deleted} absent records and recalculated all salaries"
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
