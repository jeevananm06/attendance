"""
Database Wrapper - Switches between CSV and PostgreSQL based on environment
This allows gradual migration and fallback to CSV for local development
"""

import os

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
        get_salary_records, get_salary_records_bulk, create_salary_record, mark_salary_paid,
        # Overtime operations
        create_overtime, get_overtime_records,
        # Advance operations
        create_advance, get_advances, get_pending_advances, mark_advance_deducted, repay_advance_partial,
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

    # Bulk functions (PostgreSQL only, already imported above)
    # get_attendance_bulk, get_salary_records_bulk, create_salary_records_bulk
    # are imported directly from db_operations in salary_calculator.py

    # CSV-only stubs for PostgreSQL mode
    def get_leave_balance(labour_id: str):
        return None

    def init_leave_balance(labour_id: str):
        return None

    def create_backup(created_by: str):
        return {"id": "n/a", "filename": "n/a", "created_by": created_by, "note": "Backup not supported in PostgreSQL mode"}

    def get_backups():
        return []

    def restore_backup(backup_id: str, restored_by: str):
        return False

    def get_backup_file_path(backup_id: str):
        return None

else:
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
        get_salary_records, create_salary_record, mark_salary_paid,
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
