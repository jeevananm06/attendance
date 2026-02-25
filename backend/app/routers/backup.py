from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from typing import List

from ..models import BackupRecord, User, AuditAction
from ..auth import get_current_admin
from ..db_wrapper import create_backup, get_backups, restore_backup, get_backup_file_path, create_audit_log

router = APIRouter(prefix="/backup", tags=["Backup"])


@router.get("/", response_model=List[BackupRecord])
async def list_backups(
    current_user: User = Depends(get_current_admin)
):
    """Get all backup records (Admin only)"""
    return get_backups()


@router.post("/create", response_model=BackupRecord)
async def create_new_backup(
    current_user: User = Depends(get_current_admin)
):
    """Create a new backup of all data (Admin only)"""
    backup = create_backup(current_user.username)
    
    create_audit_log(
        user=current_user.username,
        action=AuditAction.CREATE,
        entity_type="backup",
        entity_id=backup.id,
        new_value=backup.filename
    )
    
    return backup


@router.post("/restore/{backup_id}")
async def restore_from_backup(
    backup_id: str,
    current_user: User = Depends(get_current_admin)
):
    """Restore data from a backup (Admin only)"""
    success = restore_backup(backup_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Backup with id {backup_id} not found or file missing"
        )
    
    create_audit_log(
        user=current_user.username,
        action=AuditAction.UPDATE,
        entity_type="backup",
        entity_id=backup_id,
        new_value="Restored"
    )
    
    return {"message": "Backup restored successfully", "backup_id": backup_id}


@router.get("/download/{backup_id}")
async def download_backup(
    backup_id: str,
    current_user: User = Depends(get_current_admin)
):
    """Download a backup file (Admin only)"""
    backup_path = get_backup_file_path(backup_id)
    
    if not backup_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Backup with id {backup_id} not found"
        )
    
    return FileResponse(
        path=backup_path,
        filename=backup_path.name,
        media_type="application/zip"
    )
