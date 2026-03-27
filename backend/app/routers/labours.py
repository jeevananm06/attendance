from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from ..models import Labour, LabourCreate, LabourUpdate, User, UserRole
from ..auth import get_current_manager_or_admin, get_current_admin, get_current_authenticated_user
from ..db_wrapper import (
    get_all_labours,
    get_labour,
    create_labour,
    update_labour,
    delete_labour,
    delete_unpaid_salary_records,
)

router = APIRouter(prefix="/labours", tags=["Labours"])


@router.get("/", response_model=List[Labour])
async def list_labours(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_authenticated_user)
):
    """Get all labours. All authenticated users can view."""
    return get_all_labours(include_inactive=include_inactive)


@router.get("/{labour_id}", response_model=Labour)
async def get_labour_by_id(
    labour_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get a specific labour by ID"""
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {labour_id} not found"
        )
    return labour


@router.post("/", response_model=Labour)
async def add_labour(
    labour_data: LabourCreate,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Add a new labour"""
    return create_labour(
        name=labour_data.name,
        daily_wage=labour_data.daily_wage,
        phone=labour_data.phone,
        joined_date=labour_data.joined_date,
        pay_cycle=labour_data.pay_cycle.value if labour_data.pay_cycle else "weekly",
        designation=labour_data.designation
    )


@router.put("/{labour_id}", response_model=Labour)
async def update_labour_info(
    labour_id: str,
    labour_data: LabourUpdate,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Update labour information. joined_date can only be updated by admin."""
    # Only admin can update joined_date
    joined_date = None
    if labour_data.joined_date is not None:
        if current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admin can update joined date"
            )
        joined_date = labour_data.joined_date

    # If joined_date is changing, wipe unpaid salary records so they are
    # recalculated cleanly against the new anchor date (prevents overlapping periods)
    if joined_date is not None:
        existing = get_labour(labour_id)
        if existing and existing.joined_date != joined_date:
            delete_unpaid_salary_records(labour_id)

    updated = update_labour(
        labour_id,
        name=labour_data.name,
        phone=labour_data.phone,
        daily_wage=labour_data.daily_wage,
        is_active=labour_data.is_active,
        joined_date=joined_date,
        pay_cycle=labour_data.pay_cycle.value if labour_data.pay_cycle else None,
        designation=labour_data.designation
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {labour_id} not found"
        )
    return updated


@router.delete("/{labour_id}")
async def remove_labour(
    labour_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Soft delete a labour (mark as inactive)"""
    success = delete_labour(labour_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {labour_id} not found"
        )
    return {"message": f"Labour {labour_id} has been deactivated"}
