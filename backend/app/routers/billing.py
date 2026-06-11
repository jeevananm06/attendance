from fastapi import APIRouter, Depends, HTTPException, status
from typing import Optional
from datetime import date

from ..models import User, BillCreate, BillUpdate, BillReplicate, BillingItemCreate, BillingItemUpdate
from ..auth import get_current_manager_or_admin, get_current_admin
from ..db_wrapper import (
    get_billing_items, create_billing_item, update_billing_item,
    create_bill, get_bill, get_bill_by_number, search_bills,
    update_bill_status, update_bill, replicate_bill, delete_bill,
    get_billing_summary, get_customer_suggestions,
)

router = APIRouter(prefix="/billing", tags=["Billing"])


# ── Billing Items (configurable) ──────────────────────────────────────────

@router.get("/items")
async def list_billing_items(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """List all configurable billing items"""
    return get_billing_items(include_inactive=include_inactive)


@router.post("/items")
async def add_billing_item(
    data: BillingItemCreate,
    current_user: User = Depends(get_current_admin)
):
    """Add a new billing item (Admin only)"""
    item = create_billing_item(name=data.name, default_rate=data.default_rate)
    return item


@router.put("/items/{item_id}")
async def edit_billing_item(
    item_id: str,
    data: BillingItemUpdate,
    current_user: User = Depends(get_current_admin)
):
    """Update a billing item (Admin only)"""
    result = update_billing_item(
        item_id, name=data.name, default_rate=data.default_rate, is_active=data.is_active
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Billing item not found")
    return result


# ── Bills ─────────────────────────────────────────────────────────────────

@router.post("/bills")
async def create_new_bill(
    data: BillCreate,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Create a new bill (Manager + Admin)"""
    if not data.line_items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one line item required")

    line_items = [{"item_name": li.item_name, "quantity": li.quantity, "rate": li.rate} for li in data.line_items]

    bill = create_bill(
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        customer_place=data.customer_place,
        bill_date=data.bill_date,
        line_items=line_items,
        tax_percentage=data.tax_percentage,
        notes=data.notes,
        created_by=current_user.username,
    )
    return bill


@router.get("/bills/search")
async def search_bills_endpoint(
    customer_name: Optional[str] = None,
    customer_phone: Optional[str] = None,
    bill_date: Optional[date] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    bill_status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Search bills with filters"""
    return search_bills(
        customer_name=customer_name, customer_phone=customer_phone,
        bill_date=bill_date, start_date=start_date, end_date=end_date,
        status=bill_status, limit=limit, offset=offset,
    )


@router.get("/bills/number/{bill_number}")
async def get_bill_by_number_endpoint(
    bill_number: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get a bill by its bill number"""
    bill = get_bill_by_number(bill_number)
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return bill


@router.get("/bills/{bill_id}")
async def get_bill_detail(
    bill_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get a single bill by ID"""
    bill = get_bill(bill_id)
    if not bill:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return bill


@router.put("/bills/{bill_id}/status")
async def change_bill_status(
    bill_id: str,
    new_status: str,
    paid_amount: float = 0,
    current_user: User = Depends(get_current_admin)
):
    """Update bill status — finalize, mark paid, or partial paid (Admin only)"""
    if new_status not in ("draft", "finalized", "partial_paid", "paid"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    result = update_bill_status(bill_id, new_status, paid_amount=paid_amount)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return result


@router.put("/bills/{bill_id}")
async def edit_bill(
    bill_id: str,
    data: BillUpdate,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Edit an existing bill in place (Manager + Admin).

    Preserves the bill id and bill_number; replaces line items and recalculates
    totals atomically so the bill is never lost on failure.
    """
    line_items = None
    if data.line_items is not None:
        if not data.line_items:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one line item required")
        line_items = [{"item_name": li.item_name, "quantity": li.quantity, "rate": li.rate} for li in data.line_items]

    result = update_bill(
        bill_id,
        customer_phone=data.customer_phone,
        customer_place=data.customer_place,
        bill_date=data.bill_date,
        line_items=line_items,
        tax_percentage=data.tax_percentage,
        notes=data.notes,
    )
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return result


@router.post("/bills/{bill_id}/replicate")
async def replicate_bill_endpoint(
    bill_id: str,
    data: BillReplicate,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Replicate a bill across each consecutive day in a date range (Manager + Admin).

    Copies the source bill's customer, line items and tax into one new bill per
    day. Days that already have a bill for the same customer are skipped when
    skip_existing is true, so only the missing days (gaps) get filled.
    """
    if data.end_date < data.start_date:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="End date must be on or after start date")
    if (data.end_date - data.start_date).days > 92:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Date range too large (max 93 days)")

    result = replicate_bill(
        bill_id,
        start_date=data.start_date,
        end_date=data.end_date,
        skip_existing=data.skip_existing,
        created_by=current_user.username,
    )
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return result


@router.delete("/bills/{bill_id}")
async def remove_bill(
    bill_id: str,
    current_user: User = Depends(get_current_admin)
):
    """Delete a bill (Admin only)"""
    ok = delete_bill(bill_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bill not found")
    return {"message": "Bill deleted"}


# ── Summary & Suggestions ─────────────────────────────────────────────────

@router.get("/summary")
async def billing_summary(
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_admin)
):
    """Billing summary with item breakdown (Admin only)"""
    return get_billing_summary(start_date=start_date, end_date=end_date)


@router.get("/customers/suggest")
async def suggest_customers(
    q: str = "",
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Auto-complete customer suggestions based on previous bills. Empty q returns all distinct customers."""
    return get_customer_suggestions(q)
