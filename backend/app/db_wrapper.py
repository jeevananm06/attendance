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
        get_attendance_by_date, get_attendance_by_labour, mark_attendance, delete_attendance, purge_absent_attendance_records,
        # Salary operations
        get_salary_records, create_salary_record, mark_salary_paid,
        # Overtime operations
        create_overtime, get_overtime_records,
        # Advance operations
        create_advance, get_advances, get_pending_advances, mark_advance_deducted,
        # Leave operations
        create_leave, get_leaves, approve_leave,
        # Site operations
        create_site, get_sites, get_site, assign_labour_to_site, get_labours_by_site, get_labour_site,
        # Audit operations
        create_audit_log, get_audit_logs,
        # Export operations
        export_labours_csv, export_attendance_csv, export_salary_csv, export_all_data,
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
        # Init
        init_csv_files
    )
