"""
Database Wrapper - Switches between CSV and PostgreSQL based on environment
This allows gradual migration and fallback to CSV for local development
"""

import os
from dotenv import load_dotenv

load_dotenv()  # Ensure .env is loaded before reading USE_POSTGRES

USE_POSTGRES = os.getenv("USE_POSTGRES", "false").lower() == "true"

if USE_POSTGRES:
    from .db_operations import (
        # User operations
        get_user, create_user, get_all_users, update_user,
        # Labour operations
        get_all_labours, get_labour, create_labour, update_labour, delete_labour,
        # Attendance operations
        get_attendance_by_date, get_attendance_by_labour, get_attendance_bulk, mark_attendance, delete_attendance, purge_absent_attendance_records,
        # Salary operations
        get_salary_records, get_salary_records_bulk, create_salary_record, mark_salary_paid, get_payment_logs, create_payment_log_entry,
        # Overtime operations
        create_overtime, get_overtime_records,
        # Advance operations
        create_advance, get_advances, get_pending_advances, get_all_pending_advances_bulk, mark_advance_deducted, repay_advance_partial,
        # Leave operations
        create_leave, get_leaves, approve_leave,
        # Site operations
        create_site, get_sites, get_site, assign_labour_to_site, get_labours_by_site, get_labour_site,
        # Audit operations
        create_audit_log, get_audit_logs,
        # Export operations
        export_labours_csv, export_attendance_csv, export_salary_csv, export_all_data,
        # Notification operations
        create_notification, get_notifications, get_unread_count, mark_notifications_read,
        # Push subscription operations
        save_push_subscription, delete_push_subscription, get_push_subscriptions,
        # Init
        init_db_tables as init_csv_files
    )

    # Cafe inventory operations
    from .db_operations import (
        create_cafe_item, get_cafe_items, get_cafe_item, update_cafe_item,
        create_cafe_stock_entry, get_cafe_stock_entries, get_cafe_stock_entry,
        update_cafe_stock_entry, delete_cafe_stock_entry,
        get_cafe_analytics, export_cafe_stock_csv,
    )

    # Bulk functions (PostgreSQL only, already imported above)
    # get_attendance_bulk, get_salary_records_bulk, create_salary_records_bulk
    # are imported directly from db_operations in salary_calculator.py

    # CSV-only stubs for PostgreSQL mode
    def get_leave_balance(labour_id: str):
        return None

    def init_leave_balance(labour_id: str):
        return None

    _pg_backup_storage = {}  # In-memory storage for backups: {backup_id: {"path": path, "record": BackupRecord}}

    def create_backup(created_by: str):
        global _pg_backup_storage
        import os
        import tempfile
        import zipfile
        import json
        from datetime import datetime
        import uuid
        from pathlib import Path
        from .db_operations import (
            export_labours_csv as _export_labours,
            export_attendance_csv as _export_attendance,
            export_salary_csv as _export_salary
        )
        
        backup_id = str(uuid.uuid4())[:8]
        now = datetime.now()
        filename = f"backup_{now.strftime('%Y%m%d_%H%M%S')}.zip"
        
        # Use system temp directory for persistent storage during runtime
        backup_dir = os.path.join(tempfile.gettempdir(), 'attendance_backups')
        os.makedirs(backup_dir, exist_ok=True)
        backup_path = os.path.join(backup_dir, filename)
        
        # Create a temp dir for CSV files before zipping
        with tempfile.TemporaryDirectory() as temp_dir:
            # Export individual tables as CSV
            labours_csv = _export_labours()
            attendance_csv = _export_attendance()
            salary_csv = _export_salary()
            
            # Write CSV files to temp directory
            labours_path = os.path.join(temp_dir, 'labours.csv')
            with open(labours_path, 'w', encoding='utf-8') as f:
                f.write(labours_csv)
            
            attendance_path = os.path.join(temp_dir, 'attendance.csv')
            with open(attendance_path, 'w', encoding='utf-8') as f:
                f.write(attendance_csv)
            
            salary_path = os.path.join(temp_dir, 'salary.csv')
            with open(salary_path, 'w', encoding='utf-8') as f:
                f.write(salary_csv)
            
            # Create a summary JSON file
            summary = {
                "backup_id": backup_id,
                "created_at": now.isoformat(),
                "created_by": created_by,
                "tables": ["labours", "attendance", "salary"]
            }
            summary_path = os.path.join(temp_dir, 'backup_info.json')
            with open(summary_path, 'w', encoding='utf-8') as f:
                json.dump(summary, f, indent=2)
            
            # Create zip file
            with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(labours_path, 'labours.csv')
                zipf.write(attendance_path, 'attendance.csv')
                zipf.write(salary_path, 'salary.csv')
                zipf.write(summary_path, 'backup_info.json')
        
        # Get file size
        size_bytes = os.path.getsize(backup_path)
        
        from .models import BackupRecord
        record = BackupRecord(
            id=backup_id,
            timestamp=now,
            filename=filename,
            size_bytes=size_bytes,
            created_by=created_by
        )
        
        # Store backup info for later retrieval
        _pg_backup_storage[backup_id] = {
            "path": Path(backup_path),
            "record": record
        }
        
        return record

    def get_backups():
        global _pg_backup_storage
        return [info["record"] for info in _pg_backup_storage.values()]

    def restore_backup(backup_id: str, restored_by: str):
        # Not implemented for PostgreSQL mode
        return False

    def get_backup_file_path(backup_id: str):
        global _pg_backup_storage
        if backup_id in _pg_backup_storage:
            path = _pg_backup_storage[backup_id]["path"]
            if path.exists():
                return path
        return None

else:
    # CSV mode stubs for cafe inventory (data doesn't persist on Render — use PostgreSQL)
    def create_cafe_item(name, category, unit, description=None): return None
    def get_cafe_items(include_inactive=False): return []
    def get_cafe_item(item_id): return None
    def update_cafe_item(item_id, **kwargs): return None
    def create_cafe_stock_entry(site_id, item_id, quantity, unit_price, supplier, entry_date, comments, created_by): return None
    def get_cafe_stock_entries(site_id=None, item_id=None, start_date=None, end_date=None, limit=100, offset=0): return []
    def get_cafe_stock_entry(entry_id): return None
    def update_cafe_stock_entry(entry_id, **kwargs): return None
    def delete_cafe_stock_entry(entry_id): return False
    def get_cafe_analytics(site_id=None, start_date=None, end_date=None): return {"by_item": [], "by_site": [], "trend": [], "summary": {}}
    def export_cafe_stock_csv(site_id=None, start_date=None, end_date=None): return ""

    from .database import (
        # User operations
        get_user, create_user, get_all_users, update_user,
        # Labour operations
        get_all_labours, get_labour, create_labour, update_labour, delete_labour,
        # Attendance operations
        get_attendance_by_date, get_attendance_by_labour, mark_attendance,
    )

    def delete_attendance(labour_id: str, target_date) -> bool:
        return False

    def purge_absent_attendance_records() -> int:
        return 0

    from .database import (
        # Salary operations
        get_salary_records, create_salary_record, mark_salary_paid, delete_unpaid_salary_records,
        # Overtime operations
        create_overtime, get_overtime_records,
        # Advance operations
        create_advance, get_advances, get_pending_advances,
        # Leave operations
        create_leave, get_leaves, approve_leave,
        get_leave_balance, init_leave_balance,
        # Site operations
        create_site, get_sites, get_site, assign_labour_to_site, get_labours_by_site, get_labour_site,
        # Audit operations
        create_audit_log, get_audit_logs,
        # Backup operations
        create_backup, get_backups, restore_backup, get_backup_file_path,
        # Export operations
        export_labours_csv, export_attendance_csv, export_salary_csv, export_all_data,
        # Notification operations
        create_notification, get_notifications, get_unread_count, mark_notifications_read,
        # Push subscription operations
        save_push_subscription, delete_push_subscription, get_push_subscriptions,
        # Init
        init_csv_files
    )

    def get_payment_logs(labour_id=None, salary_record_id=None):
        return []

    def create_payment_log_entry(salary_record_id, labour_id, amount, paid_by, comment=None):
        return None

    def get_salary_records_bulk(labour_ids: list) -> dict:
        from .database import get_salary_records
        return {labour_id: get_salary_records(labour_id=labour_id) for labour_id in labour_ids}

    def get_all_pending_advances_bulk() -> dict:
        from .database import get_advances
        all_advances = get_advances()
        result = {}
        for adv in all_advances:
            if not getattr(adv, 'is_deducted', False):
                pending = adv.amount - (getattr(adv, 'repaid_amount', 0.0) or 0.0)
                if pending > 0:
                    result[adv.labour_id] = result.get(adv.labour_id, 0.0) + pending
        return result

    def mark_advance_deducted(advance_id: str):
        from .database import get_advances
        import pandas as pd
        from .config import ADVANCES_FILE
        from datetime import date
        if not ADVANCES_FILE.exists():
            return None
        df = pd.read_csv(ADVANCES_FILE)
        idx = df[df["id"] == advance_id].index
        if len(idx) == 0:
            return None
        df.loc[idx, "is_deducted"] = True
        df.loc[idx, "deducted_from_week"] = date.today().isoformat()
        df.to_csv(ADVANCES_FILE, index=False)
        advances = get_advances()
        for a in advances:
            if a.id == advance_id:
                return a
        return None

    def repay_advance_partial(advance_id: str, repay_amount: float):
        from .database import get_advances
        import pandas as pd
        from .config import ADVANCES_FILE
        if not ADVANCES_FILE.exists():
            return None
        df = pd.read_csv(ADVANCES_FILE)
        idx = df[df["id"] == advance_id].index
        if len(idx) == 0:
            return None
        if "repaid_amount" not in df.columns:
            df["repaid_amount"] = 0.0
        current = float(df.loc[idx[0], "repaid_amount"]) if pd.notna(df.loc[idx[0], "repaid_amount"]) else 0.0
        total_amount = float(df.loc[idx[0], "amount"])
        new_repaid = current + repay_amount
        df.loc[idx, "repaid_amount"] = new_repaid
        if new_repaid >= total_amount:
            df.loc[idx, "is_deducted"] = True
        df.to_csv(ADVANCES_FILE, index=False)
        advances = get_advances()
        for a in advances:
            if a.id == advance_id:
                return a
        return None
