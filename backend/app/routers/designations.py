from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..models import User
from ..auth import get_current_admin, get_current_authenticated_user
from ..db_wrapper import (
    get_designations, create_designation, update_designation, delete_designation,
)

router = APIRouter(prefix="/designations", tags=["Designations"])


class DesignationCreate(BaseModel):
    name: str


class DesignationUpdate(BaseModel):
    name: str


@router.get("/")
async def list_designations(
    current_user: User = Depends(get_current_authenticated_user)
):
    """Get all designations. Any authenticated user can view."""
    return get_designations()


@router.post("/")
async def add_designation(
    data: DesignationCreate,
    current_user: User = Depends(get_current_admin)
):
    """Create a new designation. Admin only."""
    return create_designation(data.name.strip())


@router.put("/{designation_id}")
async def edit_designation(
    designation_id: str,
    data: DesignationUpdate,
    current_user: User = Depends(get_current_admin)
):
    """Update a designation. Admin only."""
    result = update_designation(designation_id, data.name.strip())
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Designation not found")
    return result


@router.delete("/{designation_id}")
async def remove_designation(
    designation_id: str,
    current_user: User = Depends(get_current_admin)
):
    """Delete a designation. Admin only."""
    success = delete_designation(designation_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Designation not found")
    return {"message": "Designation deleted"}
