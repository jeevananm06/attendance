from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from ..models import CafeItem, CafeItemCreate, CafeItemUpdate, User
from ..auth import get_current_authenticated_user, get_current_manager_or_admin, get_current_admin
from ..db_wrapper import create_cafe_item, get_cafe_items, get_cafe_item, update_cafe_item

router = APIRouter(prefix="/cafe/items", tags=["Cafe Items"])


@router.get("/", response_model=List[CafeItem])
async def list_cafe_items(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_authenticated_user)
):
    """Get all cafe items (all authenticated users)"""
    return get_cafe_items(include_inactive=include_inactive)


@router.post("/", response_model=CafeItem)
async def create_item(
    data: CafeItemCreate,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Create a new cafe item (manager/admin only)"""
    item = create_cafe_item(
        name=data.name,
        category=data.category,
        unit=data.unit,
        description=data.description,
    )
    if not item:
        raise HTTPException(status_code=500, detail="Failed to create item")
    return item


@router.put("/{item_id}", response_model=CafeItem)
async def update_item(
    item_id: str,
    data: CafeItemUpdate,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Update a cafe item (manager/admin only)"""
    existing = get_cafe_item(item_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")

    updated = update_cafe_item(
        item_id,
        **{k: v for k, v in data.dict().items() if v is not None}
    )
    return updated


@router.delete("/{item_id}")
async def deactivate_item(
    item_id: str,
    current_user: User = Depends(get_current_admin)
):
    """Deactivate a cafe item (admin only)"""
    existing = get_cafe_item(item_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item not found")
    update_cafe_item(item_id, active=False)
    return {"message": "Item deactivated"}
