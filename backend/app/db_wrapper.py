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
        get_attendance_by_date, get_attendance_by_labour, mark_attendance,
        # Salary operations
        get_salary_records, create_salary_record, mark_salary_paid,
        # Overtime operations
        create_overtime, get_overtime_records,
        # Advance operations
        create_advance, get_advances, get_pending_advances,
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
else:
    from .database import (
        # User operations
        get_user, create_user, get_all_users, update_user,
        # Labour operations
        get_all_labours, get_labour, create_labour, update_labour, delete_labour,
        # Attendance operations
        get_attendance_by_date, get_attendance_by_labour, mark_attendance,
        # Salary operations
        get_salary_records, create_salary_record, mark_salary_paid,
        # Overtime operations
        create_overtime, get_overtime_records,
        # Advance operations
        create_advance, get_advances, get_pending_advances,
        # Leave operations
        create_leave, get_leaves, approve_leave,
        # Site operations
        create_site, get_sites, get_site, assign_labour_to_site, get_labours_by_site, get_labour_site,
        # Audit operations
        create_audit_log, get_audit_logs,
        # Export operations
        export_labours_csv, export_attendance_csv, export_salary_csv, export_all_data,
        # Init
        init_csv_files
    )
