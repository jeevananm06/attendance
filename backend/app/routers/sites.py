from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from ..models import Site, SiteCreate, LabourSiteAssignment, User, AuditAction
from ..auth import get_current_manager_or_admin, get_current_admin
from ..db_wrapper import (
    create_site, get_sites, get_site, assign_labour_to_site,
    get_labours_by_site, get_labour_site, get_labour, create_audit_log,
    get_all_labours
)

router = APIRouter(prefix="/sites", tags=["Sites"])


@router.get("/", response_model=List[Site])
async def list_sites(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get all sites"""
    return get_sites(include_inactive=include_inactive)


@router.get("/summary")
async def get_sites_summary(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get summary of all sites with labour counts"""
    sites = get_sites()
    all_labours = get_all_labours()
    
    summary = []
    assigned_count = 0
    
    for site in sites:
        labour_ids = get_labours_by_site(site.id)
        summary.append({
            "site_id": site.id,
            "name": site.name,
            "address": site.address,
            "labour_count": len(labour_ids)
        })
        assigned_count += len(labour_ids)
    
    return {
        "total_sites": len(sites),
        "total_labours": len(all_labours),
        "assigned_labours": assigned_count,
        "unassigned_labours": len(all_labours) - assigned_count,
        "sites": summary
    }


@router.post("/", response_model=Site)
async def add_site(
    data: SiteCreate,
    current_user: User = Depends(get_current_admin)
):
    """Create a new site (Admin only)"""
    site = create_site(name=data.name, address=data.address)
    
    create_audit_log(
        user=current_user.username,
        action=AuditAction.CREATE,
        entity_type="site",
        entity_id=site.id,
        new_value=data.name
    )
    
    return site


@router.get("/unassigned-labours")
async def get_unassigned_labours(
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get all labours that are not assigned to any site"""
    try:
        all_labours = get_all_labours()
        sites = get_sites()

        assigned_labour_ids = set()
        for site in sites:
            try:
                labour_ids = get_labours_by_site(site.id)
                assigned_labour_ids.update(labour_ids)
            except Exception as e:
                print(f"Error getting labours for site {site.id}: {e}")
                continue

        unassigned_labours = [
            labour for labour in all_labours
            if labour.id not in assigned_labour_ids
        ]

        return {
            "unassigned_count": len(unassigned_labours),
            "labours": unassigned_labours
        }
    except Exception as e:
        print(f"Error in get_unassigned_labours: {e}")
        return {
            "unassigned_count": 0,
            "labours": []
        }


@router.get("/{site_id}", response_model=Site)
async def get_site_by_id(
    site_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get site details"""
    site = get_site(site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with id {site_id} not found"
        )
    return site


@router.get("/{site_id}/labours")
async def get_site_labours(
    site_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get all labours assigned to a site"""
    site = get_site(site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with id {site_id} not found"
        )
    
    labour_ids = get_labours_by_site(site_id)
    labours = []
    for lid in labour_ids:
        labour = get_labour(lid)
        if labour:
            labours.append(labour)
    
    return {
        "site": site,
        "labour_count": len(labours),
        "labours": labours
    }


@router.post("/assign")
async def assign_to_site(
    labour_id: str,
    site_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Assign a labour to a site"""
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {labour_id} not found"
        )
    
    site = get_site(site_id)
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Site with id {site_id} not found"
        )
    
    assignment = assign_labour_to_site(labour_id, site_id, current_user.username)
    
    create_audit_log(
        user=current_user.username,
        action=AuditAction.UPDATE,
        entity_type="site_assignment",
        entity_id=labour_id,
        new_value=f"Assigned to {site.name}"
    )
    
    return {
        "message": f"{labour.name} assigned to {site.name}",
        "assignment": assignment
    }


@router.get("/labour/{labour_id}/site")
async def get_labour_assigned_site(
    labour_id: str,
    current_user: User = Depends(get_current_manager_or_admin)
):
    """Get the site a labour is assigned to"""
    labour = get_labour(labour_id)
    if not labour:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Labour with id {labour_id} not found"
        )
    
    site_id = get_labour_site(labour_id)
    site = get_site(site_id) if site_id else None
    
    return {
        "labour_id": labour_id,
        "name": labour.name,
        "site": site
    }


