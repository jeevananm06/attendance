from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from typing import List, Optional
from datetime import date
import io

from ..models import CafeStockEntry, CafeStockEntryCreate, CafeStockEntryUpdate, User
from ..auth import get_current_authenticated_user, get_current_manager_or_admin, get_current_admin
from ..db_wrapper import (
    create_cafe_stock_entry, get_cafe_stock_entries, get_cafe_stock_entry,
    update_cafe_stock_entry, delete_cafe_stock_entry,
    get_cafe_analytics, export_cafe_stock_csv,
    get_sites,
)

router = APIRouter(prefix="/cafe/stock", tags=["Cafe Stock"])

def _can_see_price(user: User) -> bool:
    """Return True if the user is allowed to see price/cost fields."""
    if user.role == "admin":
        return True
    if user.role == "manager" and getattr(user, "cafe_price_access", False):
        return True
    return False


def _strip_price(entry: CafeStockEntry, user: User) -> dict:
    """Remove price fields for users without price access."""
    d = entry.dict()
    if not _can_see_price(user):
        d["unit_price"] = None
        d["total_cost"] = None
    return d


@router.get("/dashboard")
async def cafe_dashboard(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Dashboard summary for cafe inventory"""
    from datetime import datetime, timedelta
    today = date.today()
    month_start = today.replace(day=1)

    all_entries = get_cafe_stock_entries(limit=10000)
    today_entries = [e for e in all_entries if e.entry_date == today]
    month_entries = [e for e in all_entries if e.entry_date >= month_start]
    recent = get_cafe_stock_entries(limit=10)

    month_cost = sum(e.total_cost or 0 for e in month_entries)
    sites = get_sites()

    return {
        "today_count": len(today_entries),
        "month_count": len(month_entries),
        "month_cost": round(month_cost, 2) if _can_see_price(current_user) else None,
        "total_entries": len(all_entries),
        "total_sites": len(sites),
        "recent_entries": [_strip_price(e, current_user) for e in recent],
    }


@router.get("/analytics")
async def cafe_analytics(
    site_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_admin)
):
    """Analytics data for charts (admin only)"""
    data = get_cafe_analytics(site_id=site_id, start_date=start_date, end_date=end_date)
    return data


@router.get("/export/csv")
async def export_csv(
    site_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_admin)
):
    """Export stock entries as CSV (admin only)"""
    csv_content = export_cafe_stock_csv(site_id=site_id, start_date=start_date, end_date=end_date)
    return StreamingResponse(
        io.StringIO(csv_content),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=cafe_stock_export.csv"}
    )


@router.get("/", response_model=List[dict])
async def list_entries(
    site_id: Optional[str] = None,
    item_id: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    limit: int = Query(default=50, le=500),
    offset: int = 0,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get stock entries with optional filters"""
    entries = get_cafe_stock_entries(
        site_id=site_id, item_id=item_id,
        start_date=start_date, end_date=end_date,
        limit=limit, offset=offset
    )
    return [_strip_price(e, current_user) for e in entries]


@router.post("/", response_model=dict)
async def create_entry(
    data: CafeStockEntryCreate,
    current_user: User = Depends(get_current_authenticated_user)
):
    """Log a new stock entry (all authenticated users)"""
    # Only users with price access can submit unit_price
    unit_price = data.unit_price
    if not _can_see_price(current_user):
        unit_price = None

    entry = create_cafe_stock_entry(
        site_id=data.site_id,
        item_id=data.item_id,
        quantity=data.quantity,
        unit_price=unit_price,
        supplier=data.supplier,
        entry_date=data.entry_date,
        comments=data.comments,
        created_by=current_user.username,
    )
    if not entry:
        raise HTTPException(status_code=500, detail="Failed to create stock entry")
    return _strip_price(entry, current_user)


@router.get("/{entry_id}", response_model=dict)
async def get_entry(
    entry_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    entry = get_cafe_stock_entry(entry_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    return _strip_price(entry, current_user)


@router.put("/{entry_id}", response_model=dict)
async def update_entry(
    entry_id: str,
    data: CafeStockEntryUpdate,
    current_user: User = Depends(get_current_manager_or_admin)
):
    existing = get_cafe_stock_entry(entry_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not _can_see_price(current_user):
        update_data.pop("unit_price", None)

    entry = update_cafe_stock_entry(entry_id, **update_data)
    return _strip_price(entry, current_user)


@router.delete("/{entry_id}")
async def delete_entry(
    entry_id: str,
    current_user: User = Depends(get_current_admin)
):
    existing = get_cafe_stock_entry(entry_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entry not found")
    delete_cafe_stock_entry(entry_id)
    return {"message": "Entry deleted"}
