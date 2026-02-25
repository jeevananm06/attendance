from fastapi import APIRouter, Depends
from fastapi.responses import Response
from datetime import date

from ..models import User
from ..auth import get_current_manager_or_admin
from ..database import export_labours_csv, export_attendance_csv, export_salary_csv, export_all_data

router = APIRouter(prefix="/export", tags=["Export"])


@router.get("/labours")
async def export_labours(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Export labours data as CSV"""
    csv_content = export_labours_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=labours_{date.today().isoformat()}.csv"
        }
    )


@router.get("/attendance")
async def export_attendance(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Export attendance data as CSV"""
    csv_content = export_attendance_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=attendance_{date.today().isoformat()}.csv"
        }
    )


@router.get("/salary")
async def export_salary(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Export salary data as CSV"""
    csv_content = export_salary_csv()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=salary_{date.today().isoformat()}.csv"
        }
    )


@router.get("/all")
async def export_all(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Export all data as JSON containing CSV strings"""
    data = export_all_data()
    return {
        "export_date": date.today().isoformat(),
        "data": data
    }
