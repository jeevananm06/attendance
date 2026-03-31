try:
    import pandas as pd
except ImportError:
    pd = None
from pathlib import Path
from typing import List, Optional
from datetime import date, datetime
import uuid

from .config import (
    USERS_FILE, LABOURS_FILE, ATTENDANCE_FILE, SALARY_FILE,
    OVERTIME_FILE, ADVANCES_FILE, LEAVES_FILE, LEAVE_BALANCE_FILE,
    SITES_FILE, SITE_ASSIGNMENTS_FILE, AUDIT_LOG_FILE, BACKUPS_FILE, BACKUP_DIR,
    NOTIFICATIONS_FILE, PUSH_SUBSCRIPTIONS_FILE, SALARY_PAYMENTS_FILE
)
from .models import (
    User, Labour, Attendance, SalaryRecord, PaymentLog, UserRole, AttendanceStatus,
    Overtime, Advance, Leave, LeaveType, LeaveStatus, LeaveBalance,
    Site, LabourSiteAssignment, AuditLog, AuditAction, BackupRecord,
    Notification, NotificationType
)


def init_csv_files():
    """Initialize CSV files with headers if they don't exist."""
    
    if not USERS_FILE.exists():
        df = pd.DataFrame(columns=["username", "role", "hashed_password"])
        df.to_csv(USERS_FILE, index=False)
    
    if not LABOURS_FILE.exists():
        df = pd.DataFrame(columns=["id", "name", "phone", "daily_wage", "joined_date", "is_active"])
        df.to_csv(LABOURS_FILE, index=False)
    
    if not ATTENDANCE_FILE.exists():
        df = pd.DataFrame(columns=["id", "labour_id", "date", "status", "marked_by", "marked_at"])
        df.to_csv(ATTENDANCE_FILE, index=False)
    
    if not SALARY_FILE.exists():
        df = pd.DataFrame(columns=[
            "id", "labour_id", "week_start", "week_end", "days_present", 
            "daily_wage", "total_amount", "is_paid", "paid_date", "paid_by"
        ])
        df.to_csv(SALARY_FILE, index=False)
    
    # New feature CSV files
    if not OVERTIME_FILE.exists():
        df = pd.DataFrame(columns=[
            "id", "labour_id", "date", "hours", "rate_multiplier", "amount", "approved_by", "created_at"
        ])
        df.to_csv(OVERTIME_FILE, index=False)
    
    if not ADVANCES_FILE.exists():
        df = pd.DataFrame(columns=[
            "id", "labour_id", "amount", "date", "reason", "is_deducted", "deducted_from_week", "given_by", "created_at"
        ])
        df.to_csv(ADVANCES_FILE, index=False)
    
    if not LEAVES_FILE.exists():
        df = pd.DataFrame(columns=[
            "id", "labour_id", "leave_type", "start_date", "end_date", "days", "reason", "status", "approved_by", "created_at"
        ])
        df.to_csv(LEAVES_FILE, index=False)
    
    if not LEAVE_BALANCE_FILE.exists():
        df = pd.DataFrame(columns=[
            "labour_id", "sick_leave", "casual_leave", "earned_leave", "sick_used", "casual_used", "earned_used"
        ])
        df.to_csv(LEAVE_BALANCE_FILE, index=False)
    
    if not SITES_FILE.exists():
        df = pd.DataFrame(columns=["id", "name", "address", "is_active", "created_at"])
        df.to_csv(SITES_FILE, index=False)
    
    if not SITE_ASSIGNMENTS_FILE.exists():
        df = pd.DataFrame(columns=["labour_id", "site_id", "assigned_date", "assigned_by"])
        df.to_csv(SITE_ASSIGNMENTS_FILE, index=False)
    
    if not AUDIT_LOG_FILE.exists():
        df = pd.DataFrame(columns=[
            "id", "timestamp", "user", "action", "entity_type", "entity_id", "old_value", "new_value", "ip_address"
        ])
        df.to_csv(AUDIT_LOG_FILE, index=False)
    
    if not BACKUPS_FILE.exists():
        df = pd.DataFrame(columns=["id", "timestamp", "filename", "size_bytes", "created_by"])
        df.to_csv(BACKUPS_FILE, index=False)

    if not NOTIFICATIONS_FILE.exists():
        df = pd.DataFrame(columns=[
            "id", "user", "labour_id", "type", "title", "message", "is_read", "created_at"
        ])
        df.to_csv(NOTIFICATIONS_FILE, index=False)

    if not PUSH_SUBSCRIPTIONS_FILE.exists():
        df = pd.DataFrame(columns=["id", "user", "endpoint", "p256dh", "auth", "created_at"])
        df.to_csv(PUSH_SUBSCRIPTIONS_FILE, index=False)

    if not SALARY_PAYMENTS_FILE.exists():
        df = pd.DataFrame(columns=[
            "id", "salary_record_id", "labour_id",
            "amount", "paid_date", "paid_by", "comment"
        ])
        df.to_csv(SALARY_PAYMENTS_FILE, index=False)


# User operations
def get_user(username: str) -> Optional[User]:
    if not USERS_FILE.exists():
        return None
    df = pd.read_csv(USERS_FILE)
    user_row = df[df["username"] == username]
    if user_row.empty:
        return None
    row = user_row.iloc[0]
    return User(
        username=row["username"],
        role=UserRole(row["role"]),
        hashed_password=row["hashed_password"]
    )


def create_user(user: User) -> User:
    df = pd.read_csv(USERS_FILE) if USERS_FILE.exists() else pd.DataFrame()
    new_row = pd.DataFrame([{
        "username": user.username,
        "role": user.role.value,
        "hashed_password": user.hashed_password
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(USERS_FILE, index=False)
    return user


def get_all_users() -> List[dict]:
    if not USERS_FILE.exists():
        return []
    df = pd.read_csv(USERS_FILE)
    # Add is_active column if not exists (for backward compatibility)
    if "is_active" not in df.columns:
        df["is_active"] = True
    # Fill NaN values with True for is_active
    df["is_active"] = df["is_active"].fillna(True).astype(bool)
    return df[["username", "role", "is_active"]].to_dict("records")


def update_user(username: str, **kwargs) -> bool:
    if not USERS_FILE.exists():
        return False
    df = pd.read_csv(USERS_FILE)
    idx = df[df["username"] == username].index
    if len(idx) == 0:
        return False
    
    # Add is_active column if not exists
    if "is_active" not in df.columns:
        df["is_active"] = True
    
    for key, value in kwargs.items():
        if value is not None:
            # Handle role enum
            if key == 'role' and hasattr(value, 'value'):
                value = value.value
            df.loc[idx, key] = value
    
    df.to_csv(USERS_FILE, index=False)
    return True


# Labour operations
def get_all_labours(include_inactive: bool = False) -> List[Labour]:
    if not LABOURS_FILE.exists():
        return []
    df = pd.read_csv(LABOURS_FILE)
    if not include_inactive:
        df = df[df["is_active"] == True]
    labours = []
    for _, row in df.iterrows():
        labours.append(Labour(
            id=row["id"],
            name=row["name"],
            phone=str(row["phone"]) if pd.notna(row["phone"]) else None,
            daily_wage=float(row["daily_wage"]),
            joined_date=date.fromisoformat(str(row["joined_date"])),
            is_active=bool(row["is_active"])
        ))
    return labours


def get_labour(labour_id: str) -> Optional[Labour]:
    if not LABOURS_FILE.exists():
        return None
    df = pd.read_csv(LABOURS_FILE)
    labour_row = df[df["id"] == labour_id]
    if labour_row.empty:
        return None
    row = labour_row.iloc[0]
    return Labour(
        id=row["id"],
        name=row["name"],
        phone=str(row["phone"]) if pd.notna(row["phone"]) else None,
        daily_wage=float(row["daily_wage"]),
        joined_date=date.fromisoformat(str(row["joined_date"])),
        is_active=bool(row["is_active"])
    )


def create_labour(name: str, daily_wage: float, phone: str = None, joined_date: date = None) -> Labour:
    labour_id = str(uuid.uuid4())[:8]
    if joined_date is None:
        joined_date = date.today()
    
    df = pd.read_csv(LABOURS_FILE) if LABOURS_FILE.exists() else pd.DataFrame()
    new_row = pd.DataFrame([{
        "id": labour_id,
        "name": name,
        "phone": phone,
        "daily_wage": daily_wage,
        "joined_date": joined_date.isoformat(),
        "is_active": True
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(LABOURS_FILE, index=False)
    
    return Labour(
        id=labour_id,
        name=name,
        phone=phone,
        daily_wage=daily_wage,
        joined_date=joined_date,
        is_active=True
    )


def update_labour(labour_id: str, **kwargs) -> Optional[Labour]:
    if not LABOURS_FILE.exists():
        return None
    df = pd.read_csv(LABOURS_FILE)
    idx = df[df["id"] == labour_id].index
    if len(idx) == 0:
        return None
    
    for key, value in kwargs.items():
        if value is not None:
            # Convert date to ISO format string for CSV storage
            if key == 'joined_date' and hasattr(value, 'isoformat'):
                value = value.isoformat()
            df.loc[idx, key] = value
    
    df.to_csv(LABOURS_FILE, index=False)
    return get_labour(labour_id)


def delete_labour(labour_id: str) -> bool:
    """Soft delete - mark as inactive"""
    result = update_labour(labour_id, is_active=False)
    return result is not None


# Attendance operations
def get_attendance_by_date(target_date: date) -> List[Attendance]:
    if not ATTENDANCE_FILE.exists():
        return []
    df = pd.read_csv(ATTENDANCE_FILE)
    
    # Add marked_at column if missing (migration)
    if "marked_at" not in df.columns:
        df["marked_at"] = datetime.now().isoformat()
        df.to_csv(ATTENDANCE_FILE, index=False)
    
    df_filtered = df[df["date"] == target_date.isoformat()]
    records = []
    for _, row in df_filtered.iterrows():
        records.append(Attendance(
            id=row["id"],
            labour_id=row["labour_id"],
            date=date.fromisoformat(row["date"]),
            status=AttendanceStatus(row["status"]),
            marked_by=row["marked_by"],
            marked_at=datetime.fromisoformat(row["marked_at"]) if pd.notna(row["marked_at"]) else datetime.now()
        ))
    return records


def get_attendance_by_labour(labour_id: str, start_date: date = None, end_date: date = None) -> List[Attendance]:
    if not ATTENDANCE_FILE.exists():
        return []
    df = pd.read_csv(ATTENDANCE_FILE)
    
    # Add marked_at column if missing (migration)
    if "marked_at" not in df.columns:
        df["marked_at"] = datetime.now().isoformat()
        df.to_csv(ATTENDANCE_FILE, index=False)
    
    df_filtered = df[df["labour_id"] == labour_id]
    
    if start_date:
        df_filtered = df_filtered[df_filtered["date"] >= start_date.isoformat()]
    if end_date:
        df_filtered = df_filtered[df_filtered["date"] <= end_date.isoformat()]
    
    records = []
    for _, row in df_filtered.iterrows():
        records.append(Attendance(
            id=row["id"],
            labour_id=row["labour_id"],
            date=date.fromisoformat(row["date"]),
            status=AttendanceStatus(row["status"]),
            marked_by=row["marked_by"],
            marked_at=datetime.fromisoformat(row["marked_at"]) if pd.notna(row["marked_at"]) else datetime.now()
        ))
    return records


def mark_attendance(labour_id: str, target_date: date, status: AttendanceStatus, marked_by: str) -> Attendance:
    df = pd.read_csv(ATTENDANCE_FILE) if ATTENDANCE_FILE.exists() else pd.DataFrame()
    
    # Check if attendance already exists for this labour on this date
    if not df.empty:
        existing = df[(df["labour_id"] == labour_id) & (df["date"] == target_date.isoformat())]
        if not existing.empty:
            # Update existing record
            idx = existing.index[0]
            df.loc[idx, "status"] = status.value
            df.loc[idx, "marked_by"] = marked_by
            df.loc[idx, "marked_at"] = datetime.now().isoformat()
            df.to_csv(ATTENDANCE_FILE, index=False)
            return Attendance(
                id=df.loc[idx, "id"],
                labour_id=labour_id,
                date=target_date,
                status=status,
                marked_by=marked_by,
                marked_at=datetime.now()
            )
    
    # Create new record
    attendance_id = str(uuid.uuid4())[:8]
    now = datetime.now()
    new_row = pd.DataFrame([{
        "id": attendance_id,
        "labour_id": labour_id,
        "date": target_date.isoformat(),
        "status": status.value,
        "marked_by": marked_by,
        "marked_at": now.isoformat()
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(ATTENDANCE_FILE, index=False)
    
    return Attendance(
        id=attendance_id,
        labour_id=labour_id,
        date=target_date,
        status=status,
        marked_by=marked_by,
        marked_at=now
    )


# Salary operations
def get_salary_records(labour_id: str = None, is_paid: bool = None) -> List[SalaryRecord]:
    if not SALARY_FILE.exists():
        return []
    df = pd.read_csv(SALARY_FILE)
    
    if labour_id:
        df = df[df["labour_id"] == labour_id]
    if is_paid is not None:
        df = df[df["is_paid"] == is_paid]
    
    records = []
    for _, row in df.iterrows():
        records.append(SalaryRecord(
            id=row["id"],
            labour_id=row["labour_id"],
            week_start=date.fromisoformat(row["week_start"]),
            week_end=date.fromisoformat(row["week_end"]),
            days_present=float(row["days_present"]),
            daily_wage=float(row["daily_wage"]),
            total_amount=float(row["total_amount"]),
            paid_amount=float(row["paid_amount"]) if "paid_amount" in df.columns and pd.notna(row.get("paid_amount")) else 0.0,
            is_paid=bool(row["is_paid"]),
            paid_date=date.fromisoformat(row["paid_date"]) if pd.notna(row["paid_date"]) else None,
            paid_by=row["paid_by"] if pd.notna(row["paid_by"]) else None,
            payment_comment=row["payment_comment"] if "payment_comment" in df.columns and pd.notna(row.get("payment_comment")) else None,
        ))
    return records


def delete_unpaid_salary_records(labour_id: str) -> int:
    """Delete all unpaid salary records for a labour. Returns count deleted."""
    if not SALARY_FILE.exists():
        return 0
    df = pd.read_csv(SALARY_FILE)
    mask = (df["labour_id"] == labour_id) & (df["is_paid"] == False)
    count = int(mask.sum())
    df = df[~mask]
    df.to_csv(SALARY_FILE, index=False)
    return count


def create_salary_record(labour_id: str, week_start: date, week_end: date, 
                         days_present: float, daily_wage: float) -> SalaryRecord:
    salary_id = str(uuid.uuid4())[:8]
    total_amount = days_present * daily_wage
    
    df = pd.read_csv(SALARY_FILE) if SALARY_FILE.exists() else pd.DataFrame()
    
    # Check if record already exists
    if not df.empty:
        existing = df[(df["labour_id"] == labour_id) & (df["week_end"] == week_end.isoformat())]
        if not existing.empty:
            idx = existing.index[0]
            df.loc[idx, "days_present"] = days_present
            df.loc[idx, "daily_wage"] = daily_wage
            df.loc[idx, "total_amount"] = total_amount
            df.to_csv(SALARY_FILE, index=False)
            return SalaryRecord(
                id=df.loc[idx, "id"],
                labour_id=labour_id,
                week_start=week_start,
                week_end=week_end,
                days_present=days_present,
                daily_wage=daily_wage,
                total_amount=total_amount,
                is_paid=bool(df.loc[idx, "is_paid"])
            )
    
    new_row = pd.DataFrame([{
        "id": salary_id,
        "labour_id": labour_id,
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "days_present": days_present,
        "daily_wage": daily_wage,
        "total_amount": total_amount,
        "paid_amount": 0.0,
        "is_paid": False,
        "paid_date": None,
        "paid_by": None,
        "payment_comment": None,
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(SALARY_FILE, index=False)
    
    return SalaryRecord(
        id=salary_id,
        labour_id=labour_id,
        week_start=week_start,
        week_end=week_end,
        days_present=days_present,
        daily_wage=daily_wage,
        total_amount=total_amount,
        is_paid=False
    )


def mark_salary_paid(
    labour_id: str,
    week_end: date,
    paid_by: str,
    amount_paid: float = None,
    payment_comment: str = None,
) -> Optional[dict]:
    """Pay salary for a labour up to week_end.

    - amount_paid=None → pay all pending weeks in full.
    - amount_paid=N    → distribute N across oldest weeks first (partial OK).
    Records each payment as a PaymentLog entry.
    Returns a dict with weeks_paid, amount_paid, remaining.
    """
    if not SALARY_FILE.exists():
        return None
    df = pd.read_csv(SALARY_FILE)

    # Ensure paid_amount column exists (backward compat)
    if "paid_amount" not in df.columns:
        df["paid_amount"] = 0.0
    if "payment_comment" not in df.columns:
        df["payment_comment"] = None

    today = date.today()

    # Rows that still have money remaining, oldest week first
    candidate_mask = (
        (df["labour_id"] == labour_id)
        & (df["is_paid"] == False)
        & (df["week_end"] <= week_end.isoformat())
    )
    if df[candidate_mask].empty:
        return None

    candidates = df[candidate_mask].sort_values("week_end")
    total_remaining = sum(
        float(row["total_amount"]) - float(row["paid_amount"])
        for _, row in candidates.iterrows()
    )

    # Determine how much we're paying now
    paying_now = total_remaining if amount_paid is None else float(amount_paid)
    budget = paying_now
    weeks_paid = 0
    salary_record_ids = []  # for linking the payment log

    for idx, row in candidates.iterrows():
        if budget <= 0:
            break
        week_remaining = float(row["total_amount"]) - float(row["paid_amount"])
        if week_remaining <= 0:
            continue
        pay_for_this_week = min(budget, week_remaining)
        new_paid = float(row["paid_amount"]) + pay_for_this_week
        df.loc[idx, "paid_amount"] = round(new_paid, 2)
        df.loc[idx, "paid_by"] = paid_by
        df.loc[idx, "payment_comment"] = payment_comment
        if new_paid >= float(row["total_amount"]) - 0.01:  # fully paid (tolerance for float)
            df.loc[idx, "is_paid"] = True
            df.loc[idx, "paid_date"] = today.isoformat()
            weeks_paid += 1
        budget -= pay_for_this_week
        salary_record_ids.append(str(row["id"]))

    df.to_csv(SALARY_FILE, index=False)

    # Recalculate remaining after saving
    df2 = pd.read_csv(SALARY_FILE)
    remaining_mask = (
        (df2["labour_id"] == labour_id)
        & (df2["is_paid"] == False)
        & (df2["week_end"] <= week_end.isoformat())
    )
    remaining = float(
        df2[remaining_mask].apply(
            lambda r: float(r["total_amount"]) - float(r.get("paid_amount", 0)), axis=1
        ).sum()
    ) if not df2[remaining_mask].empty else 0.0

    # Create ONE payment log entry for this transaction
    primary_salary_record_id = salary_record_ids[0] if salary_record_ids else "unknown"
    create_payment_log_entry(
        salary_record_id=primary_salary_record_id,
        labour_id=labour_id,
        amount=round(paying_now, 2),
        paid_by=paid_by,
        comment=payment_comment,
    )

    return {
        "weeks_paid": weeks_paid,
        "amount_paid": round(paying_now, 2),
        "remaining": round(remaining, 2),
    }


# ── Payment log operations ──────────────────────────────────────────────────

def _ensure_payment_log_file():
    if not SALARY_PAYMENTS_FILE.exists():
        pd.DataFrame(columns=[
            "id", "salary_record_id", "labour_id",
            "amount", "paid_date", "paid_by", "comment"
        ]).to_csv(SALARY_PAYMENTS_FILE, index=False)


def create_payment_log_entry(
    salary_record_id: str,
    labour_id: str,
    amount: float,
    paid_by: str,
    comment: str = None,
) -> PaymentLog:
    _ensure_payment_log_file()
    entry_id = str(uuid.uuid4())[:8]
    today = date.today()
    df = pd.read_csv(SALARY_PAYMENTS_FILE)
    new_row = pd.DataFrame([{
        "id": entry_id,
        "salary_record_id": salary_record_id,
        "labour_id": labour_id,
        "amount": round(amount, 2),
        "paid_date": today.isoformat(),
        "paid_by": paid_by,
        "comment": comment,
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(SALARY_PAYMENTS_FILE, index=False)
    return PaymentLog(
        id=entry_id,
        salary_record_id=salary_record_id,
        labour_id=labour_id,
        amount=amount,
        paid_date=today,
        paid_by=paid_by,
        comment=comment,
    )


def get_payment_logs(labour_id: str = None, salary_record_id: str = None) -> List[PaymentLog]:
    _ensure_payment_log_file()
    df = pd.read_csv(SALARY_PAYMENTS_FILE)
    if labour_id:
        df = df[df["labour_id"] == labour_id]
    if salary_record_id:
        df = df[df["salary_record_id"] == salary_record_id]
    logs = []
    for _, row in df.iterrows():
        logs.append(PaymentLog(
            id=str(row["id"]),
            salary_record_id=str(row["salary_record_id"]),
            labour_id=str(row["labour_id"]),
            amount=float(row["amount"]),
            paid_date=date.fromisoformat(row["paid_date"]),
            paid_by=str(row["paid_by"]),
            comment=row["comment"] if pd.notna(row["comment"]) else None,
        ))
    return logs


# Export functions
def export_labours_csv() -> str:
    if not LABOURS_FILE.exists():
        return ""
    return LABOURS_FILE.read_text()


def export_attendance_csv() -> str:
    if not ATTENDANCE_FILE.exists():
        return ""
    return ATTENDANCE_FILE.read_text()


def export_salary_csv() -> str:
    if not SALARY_FILE.exists():
        return ""
    return SALARY_FILE.read_text()


def export_all_data() -> dict:
    return {
        "labours": export_labours_csv(),
        "attendance": export_attendance_csv(),
        "salary": export_salary_csv()
    }


# ============== OVERTIME OPERATIONS ==============

def create_overtime(labour_id: str, target_date: date, hours: float, rate_multiplier: float, approved_by: str) -> Overtime:
    from .database import get_labour
    labour = get_labour(labour_id)
    if not labour:
        raise ValueError(f"Labour {labour_id} not found")
    
    hourly_rate = labour.daily_wage / 8  # Assuming 8-hour workday
    amount = hours * hourly_rate * rate_multiplier
    
    overtime_id = str(uuid.uuid4())[:8]
    now = datetime.now()
    
    df = pd.read_csv(OVERTIME_FILE) if OVERTIME_FILE.exists() else pd.DataFrame()
    new_row = pd.DataFrame([{
        "id": overtime_id,
        "labour_id": labour_id,
        "date": target_date.isoformat(),
        "hours": hours,
        "rate_multiplier": rate_multiplier,
        "amount": amount,
        "approved_by": approved_by,
        "created_at": now.isoformat()
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(OVERTIME_FILE, index=False)
    
    return Overtime(
        id=overtime_id,
        labour_id=labour_id,
        date=target_date,
        hours=hours,
        rate_multiplier=rate_multiplier,
        amount=amount,
        approved_by=approved_by,
        created_at=now
    )


def get_overtime_records(labour_id: str = None, start_date: date = None, end_date: date = None) -> List[Overtime]:
    if not OVERTIME_FILE.exists():
        return []
    df = pd.read_csv(OVERTIME_FILE)
    
    if labour_id:
        df = df[df["labour_id"] == labour_id]
    if start_date:
        df = df[df["date"] >= start_date.isoformat()]
    if end_date:
        df = df[df["date"] <= end_date.isoformat()]
    
    records = []
    for _, row in df.iterrows():
        records.append(Overtime(
            id=row["id"],
            labour_id=row["labour_id"],
            date=date.fromisoformat(row["date"]),
            hours=float(row["hours"]),
            rate_multiplier=float(row["rate_multiplier"]),
            amount=float(row["amount"]),
            approved_by=row["approved_by"] if pd.notna(row["approved_by"]) else None,
            created_at=datetime.fromisoformat(row["created_at"])
        ))
    return records


# ============== ADVANCE OPERATIONS ==============

def create_advance(labour_id: str, amount: float, reason: str, given_by: str) -> Advance:
    advance_id = str(uuid.uuid4())[:8]
    now = datetime.now()
    today = date.today()
    
    df = pd.read_csv(ADVANCES_FILE) if ADVANCES_FILE.exists() else pd.DataFrame()
    new_row = pd.DataFrame([{
        "id": advance_id,
        "labour_id": labour_id,
        "amount": amount,
        "date": today.isoformat(),
        "reason": reason,
        "is_deducted": False,
        "deducted_from_week": None,
        "given_by": given_by,
        "created_at": now.isoformat()
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(ADVANCES_FILE, index=False)
    
    return Advance(
        id=advance_id,
        labour_id=labour_id,
        amount=amount,
        date=today,
        reason=reason,
        is_deducted=False,
        deducted_from_week=None,
        given_by=given_by,
        created_at=now
    )


def get_advances(labour_id: str = None, is_deducted: bool = None) -> List[Advance]:
    if not ADVANCES_FILE.exists():
        return []
    df = pd.read_csv(ADVANCES_FILE)
    
    if labour_id:
        df = df[df["labour_id"] == labour_id]
    if is_deducted is not None:
        df = df[df["is_deducted"] == is_deducted]
    
    records = []
    for _, row in df.iterrows():
        records.append(Advance(
            id=row["id"],
            labour_id=row["labour_id"],
            amount=float(row["amount"]),
            date=date.fromisoformat(row["date"]),
            reason=row["reason"] if pd.notna(row["reason"]) else None,
            is_deducted=bool(row["is_deducted"]),
            deducted_from_week=date.fromisoformat(row["deducted_from_week"]) if pd.notna(row["deducted_from_week"]) else None,
            given_by=row["given_by"],
            created_at=datetime.fromisoformat(row["created_at"])
        ))
    return records


def get_pending_advances(labour_id: str) -> float:
    advances = get_advances(labour_id=labour_id, is_deducted=False)
    return sum(a.amount for a in advances)


def mark_advances_deducted(labour_id: str, week_end: date) -> float:
    if not ADVANCES_FILE.exists():
        return 0.0
    df = pd.read_csv(ADVANCES_FILE)
    
    mask = (df["labour_id"] == labour_id) & (df["is_deducted"] == False)
    total_deducted = df.loc[mask, "amount"].sum()
    
    df.loc[mask, "is_deducted"] = True
    df.loc[mask, "deducted_from_week"] = week_end.isoformat()
    df.to_csv(ADVANCES_FILE, index=False)
    
    return float(total_deducted)


# ============== LEAVE OPERATIONS ==============

def create_leave(labour_id: str, leave_type: LeaveType, start_date: date, end_date: date, reason: str = None) -> Leave:
    leave_id = str(uuid.uuid4())[:8]
    now = datetime.now()
    days = (end_date - start_date).days + 1
    
    df = pd.read_csv(LEAVES_FILE) if LEAVES_FILE.exists() else pd.DataFrame()
    new_row = pd.DataFrame([{
        "id": leave_id,
        "labour_id": labour_id,
        "leave_type": leave_type.value,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "days": days,
        "reason": reason,
        "status": LeaveStatus.PENDING.value,
        "approved_by": None,
        "created_at": now.isoformat()
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(LEAVES_FILE, index=False)
    
    return Leave(
        id=leave_id,
        labour_id=labour_id,
        leave_type=leave_type,
        start_date=start_date,
        end_date=end_date,
        days=days,
        reason=reason,
        status=LeaveStatus.PENDING,
        approved_by=None,
        created_at=now
    )


def get_leaves(labour_id: str = None, status: LeaveStatus = None) -> List[Leave]:
    if not LEAVES_FILE.exists():
        return []
    df = pd.read_csv(LEAVES_FILE)
    
    if labour_id:
        df = df[df["labour_id"] == labour_id]
    if status:
        df = df[df["status"] == status.value]
    
    records = []
    for _, row in df.iterrows():
        records.append(Leave(
            id=row["id"],
            labour_id=row["labour_id"],
            leave_type=LeaveType(row["leave_type"]),
            start_date=date.fromisoformat(row["start_date"]),
            end_date=date.fromisoformat(row["end_date"]),
            days=float(row["days"]),
            reason=row["reason"] if pd.notna(row["reason"]) else None,
            status=LeaveStatus(row["status"]),
            approved_by=row["approved_by"] if pd.notna(row["approved_by"]) else None,
            created_at=datetime.fromisoformat(row["created_at"])
        ))
    return records


def approve_leave(leave_id: str, approved_by: str, approve: bool = True) -> Optional[Leave]:
    if not LEAVES_FILE.exists():
        return None
    df = pd.read_csv(LEAVES_FILE)
    
    idx = df[df["id"] == leave_id].index
    if len(idx) == 0:
        return None
    
    new_status = LeaveStatus.APPROVED if approve else LeaveStatus.REJECTED
    df.loc[idx, "status"] = new_status.value
    df.loc[idx, "approved_by"] = approved_by
    df.to_csv(LEAVES_FILE, index=False)
    
    # Update leave balance if approved
    if approve:
        row = df.loc[idx[0]]
        update_leave_balance_used(row["labour_id"], LeaveType(row["leave_type"]), float(row["days"]))
    
    row = df.loc[idx[0]]
    return Leave(
        id=row["id"],
        labour_id=row["labour_id"],
        leave_type=LeaveType(row["leave_type"]),
        start_date=date.fromisoformat(row["start_date"]),
        end_date=date.fromisoformat(row["end_date"]),
        days=float(row["days"]),
        reason=row["reason"] if pd.notna(row["reason"]) else None,
        status=new_status,
        approved_by=approved_by,
        created_at=datetime.fromisoformat(row["created_at"])
    )


def get_leave_balance(labour_id: str) -> LeaveBalance:
    if not LEAVE_BALANCE_FILE.exists():
        return LeaveBalance(labour_id=labour_id)
    
    df = pd.read_csv(LEAVE_BALANCE_FILE)
    row = df[df["labour_id"] == labour_id]
    
    if row.empty:
        return LeaveBalance(labour_id=labour_id)
    
    r = row.iloc[0]
    return LeaveBalance(
        labour_id=labour_id,
        sick_leave=float(r["sick_leave"]),
        casual_leave=float(r["casual_leave"]),
        earned_leave=float(r["earned_leave"]),
        sick_used=float(r["sick_used"]),
        casual_used=float(r["casual_used"]),
        earned_used=float(r["earned_used"])
    )


def init_leave_balance(labour_id: str) -> LeaveBalance:
    df = pd.read_csv(LEAVE_BALANCE_FILE) if LEAVE_BALANCE_FILE.exists() else pd.DataFrame()
    
    existing = df[df["labour_id"] == labour_id]
    if not existing.empty:
        return get_leave_balance(labour_id)
    
    new_row = pd.DataFrame([{
        "labour_id": labour_id,
        "sick_leave": 12.0,
        "casual_leave": 12.0,
        "earned_leave": 15.0,
        "sick_used": 0.0,
        "casual_used": 0.0,
        "earned_used": 0.0
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(LEAVE_BALANCE_FILE, index=False)
    
    return LeaveBalance(labour_id=labour_id)


def update_leave_balance_used(labour_id: str, leave_type: LeaveType, days: float):
    df = pd.read_csv(LEAVE_BALANCE_FILE) if LEAVE_BALANCE_FILE.exists() else pd.DataFrame()
    
    idx = df[df["labour_id"] == labour_id].index
    if len(idx) == 0:
        init_leave_balance(labour_id)
        df = pd.read_csv(LEAVE_BALANCE_FILE)
        idx = df[df["labour_id"] == labour_id].index
    
    col_map = {
        LeaveType.SICK: "sick_used",
        LeaveType.CASUAL: "casual_used",
        LeaveType.EARNED: "earned_used"
    }
    
    if leave_type in col_map:
        df.loc[idx, col_map[leave_type]] = df.loc[idx, col_map[leave_type]] + days
        df.to_csv(LEAVE_BALANCE_FILE, index=False)


# ============== SITE OPERATIONS ==============

def create_site(name: str, address: str = None) -> Site:
    site_id = str(uuid.uuid4())[:8]
    now = datetime.now()
    
    df = pd.read_csv(SITES_FILE) if SITES_FILE.exists() else pd.DataFrame()
    new_row = pd.DataFrame([{
        "id": site_id,
        "name": name,
        "address": address,
        "is_active": True,
        "created_at": now.isoformat()
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(SITES_FILE, index=False)
    
    return Site(id=site_id, name=name, address=address, is_active=True, created_at=now)


def get_sites(include_inactive: bool = False) -> List[Site]:
    if not SITES_FILE.exists():
        return []
    df = pd.read_csv(SITES_FILE)
    
    if not include_inactive:
        df = df[df["is_active"] == True]
    
    sites = []
    for _, row in df.iterrows():
        sites.append(Site(
            id=row["id"],
            name=row["name"],
            address=row["address"] if pd.notna(row["address"]) else None,
            is_active=bool(row["is_active"]),
            created_at=datetime.fromisoformat(row["created_at"])
        ))
    return sites


def get_site(site_id: str) -> Optional[Site]:
    if not SITES_FILE.exists():
        return None
    df = pd.read_csv(SITES_FILE)
    row = df[df["id"] == site_id]
    if row.empty:
        return None
    r = row.iloc[0]
    return Site(
        id=r["id"],
        name=r["name"],
        address=r["address"] if pd.notna(r["address"]) else None,
        is_active=bool(r["is_active"]),
        created_at=datetime.fromisoformat(r["created_at"])
    )


def assign_labour_to_site(labour_id: str, site_id: str, assigned_by: str) -> LabourSiteAssignment:
    today = date.today()
    
    df = pd.read_csv(SITE_ASSIGNMENTS_FILE) if SITE_ASSIGNMENTS_FILE.exists() else pd.DataFrame()
    
    # Remove existing assignment for this labour
    df = df[df["labour_id"] != labour_id]
    
    new_row = pd.DataFrame([{
        "labour_id": labour_id,
        "site_id": site_id,
        "assigned_date": today.isoformat(),
        "assigned_by": assigned_by
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(SITE_ASSIGNMENTS_FILE, index=False)
    
    return LabourSiteAssignment(
        labour_id=labour_id,
        site_id=site_id,
        assigned_date=today,
        assigned_by=assigned_by
    )


def get_labours_by_site(site_id: str) -> List[str]:
    if not SITE_ASSIGNMENTS_FILE.exists():
        return []
    df = pd.read_csv(SITE_ASSIGNMENTS_FILE)
    return df[df["site_id"] == site_id]["labour_id"].tolist()


def get_labour_site(labour_id: str) -> Optional[str]:
    if not SITE_ASSIGNMENTS_FILE.exists():
        return None
    df = pd.read_csv(SITE_ASSIGNMENTS_FILE)
    row = df[df["labour_id"] == labour_id]
    if row.empty:
        return None
    return row.iloc[0]["site_id"]


# ============== AUDIT LOG OPERATIONS ==============

def create_audit_log(user: str, action: AuditAction, entity_type: str, entity_id: str = None,
                     old_value: str = None, new_value: str = None, ip_address: str = None) -> AuditLog:
    log_id = str(uuid.uuid4())[:8]
    now = datetime.now()
    
    df = pd.read_csv(AUDIT_LOG_FILE) if AUDIT_LOG_FILE.exists() else pd.DataFrame()
    new_row = pd.DataFrame([{
        "id": log_id,
        "timestamp": now.isoformat(),
        "user": user,
        "action": action.value,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "old_value": old_value,
        "new_value": new_value,
        "ip_address": ip_address
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(AUDIT_LOG_FILE, index=False)
    
    return AuditLog(
        id=log_id,
        timestamp=now,
        user=user,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
        ip_address=ip_address
    )


def get_audit_logs(user: str = None, action: AuditAction = None, entity_type: str = None,
                   start_date: datetime = None, end_date: datetime = None, limit: int = 100) -> List[AuditLog]:
    if not AUDIT_LOG_FILE.exists():
        return []
    df = pd.read_csv(AUDIT_LOG_FILE)
    
    if user:
        df = df[df["user"] == user]
    if action:
        df = df[df["action"] == action.value]
    if entity_type:
        df = df[df["entity_type"] == entity_type]
    if start_date:
        df = df[df["timestamp"] >= start_date.isoformat()]
    if end_date:
        df = df[df["timestamp"] <= end_date.isoformat()]
    
    df = df.tail(limit)
    
    logs = []
    for _, row in df.iterrows():
        logs.append(AuditLog(
            id=row["id"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
            user=row["user"],
            action=AuditAction(row["action"]),
            entity_type=row["entity_type"],
            entity_id=row["entity_id"] if pd.notna(row["entity_id"]) else None,
            old_value=row["old_value"] if pd.notna(row["old_value"]) else None,
            new_value=row["new_value"] if pd.notna(row["new_value"]) else None,
            ip_address=row["ip_address"] if pd.notna(row["ip_address"]) else None
        ))
    return logs


# ============== BACKUP OPERATIONS ==============

import shutil
import zipfile

def create_backup(created_by: str) -> BackupRecord:
    backup_id = str(uuid.uuid4())[:8]
    now = datetime.now()
    filename = f"backup_{now.strftime('%Y%m%d_%H%M%S')}.zip"
    backup_path = BACKUP_DIR / filename
    
    # Create zip file with all CSV data
    with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        from .config import DATA_DIR
        for csv_file in DATA_DIR.glob("*.csv"):
            zipf.write(csv_file, csv_file.name)
    
    size_bytes = backup_path.stat().st_size
    
    df = pd.read_csv(BACKUPS_FILE) if BACKUPS_FILE.exists() else pd.DataFrame()
    new_row = pd.DataFrame([{
        "id": backup_id,
        "timestamp": now.isoformat(),
        "filename": filename,
        "size_bytes": size_bytes,
        "created_by": created_by
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(BACKUPS_FILE, index=False)
    
    return BackupRecord(
        id=backup_id,
        timestamp=now,
        filename=filename,
        size_bytes=size_bytes,
        created_by=created_by
    )


def get_backups() -> List[BackupRecord]:
    if not BACKUPS_FILE.exists():
        return []
    df = pd.read_csv(BACKUPS_FILE)
    
    backups = []
    for _, row in df.iterrows():
        backups.append(BackupRecord(
            id=row["id"],
            timestamp=datetime.fromisoformat(row["timestamp"]),
            filename=row["filename"],
            size_bytes=int(row["size_bytes"]),
            created_by=row["created_by"]
        ))
    return backups


def restore_backup(backup_id: str) -> bool:
    if not BACKUPS_FILE.exists():
        return False
    
    df = pd.read_csv(BACKUPS_FILE)
    row = df[df["id"] == backup_id]
    if row.empty:
        return False
    
    filename = row.iloc[0]["filename"]
    backup_path = BACKUP_DIR / filename
    
    if not backup_path.exists():
        return False
    
    from .config import DATA_DIR
    with zipfile.ZipFile(backup_path, 'r') as zipf:
        zipf.extractall(DATA_DIR)
    
    return True


def get_backup_file_path(backup_id: str) -> Optional[Path]:
    if not BACKUPS_FILE.exists():
        return None

    df = pd.read_csv(BACKUPS_FILE)
    row = df[df["id"] == backup_id]
    if row.empty:
        return None

    filename = row.iloc[0]["filename"]
    backup_path = BACKUP_DIR / filename

    return backup_path if backup_path.exists() else None


# ============== NOTIFICATION OPERATIONS ==============

def create_notification(user: str, notif_type: str, title: str, message: str,
                        labour_id: str = None) -> Notification:
    notif_id = str(uuid.uuid4())[:8]
    now = datetime.now()

    df = pd.read_csv(NOTIFICATIONS_FILE) if NOTIFICATIONS_FILE.exists() else pd.DataFrame()
    new_row = pd.DataFrame([{
        "id": notif_id,
        "user": user,
        "labour_id": labour_id,
        "type": notif_type,
        "title": title,
        "message": message,
        "is_read": False,
        "created_at": now.isoformat()
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(NOTIFICATIONS_FILE, index=False)

    return Notification(
        id=notif_id, user=user, labour_id=labour_id,
        type=NotificationType(notif_type), title=title, message=message,
        is_read=False, created_at=now
    )


def get_notifications(user: str, unread_only: bool = False, limit: int = 50) -> List[Notification]:
    if not NOTIFICATIONS_FILE.exists():
        return []
    df = pd.read_csv(NOTIFICATIONS_FILE)
    df = df[df["user"] == user]
    if unread_only:
        df = df[df["is_read"] == False]
    df = df.sort_values("created_at", ascending=False).head(limit)

    results = []
    for _, row in df.iterrows():
        results.append(Notification(
            id=row["id"],
            user=row["user"],
            labour_id=row["labour_id"] if pd.notna(row["labour_id"]) else None,
            type=NotificationType(row["type"]),
            title=row["title"],
            message=row["message"],
            is_read=bool(row["is_read"]),
            created_at=datetime.fromisoformat(row["created_at"])
        ))
    return results


def get_unread_count(user: str) -> int:
    if not NOTIFICATIONS_FILE.exists():
        return 0
    df = pd.read_csv(NOTIFICATIONS_FILE)
    return int(len(df[(df["user"] == user) & (df["is_read"] == False)]))


def mark_notifications_read(user: str, notification_ids: List[str] = None) -> int:
    if not NOTIFICATIONS_FILE.exists():
        return 0
    df = pd.read_csv(NOTIFICATIONS_FILE)
    if notification_ids:
        mask = (df["user"] == user) & (df["id"].isin(notification_ids))
    else:
        mask = (df["user"] == user) & (df["is_read"] == False)
    count = int(mask.sum())
    df.loc[mask, "is_read"] = True
    df.to_csv(NOTIFICATIONS_FILE, index=False)
    return count


# ============== PUSH SUBSCRIPTION OPERATIONS ==============

def save_push_subscription(user: str, endpoint: str, p256dh: str, auth: str) -> bool:
    """Upsert a push subscription (unique by endpoint)."""
    df = pd.read_csv(PUSH_SUBSCRIPTIONS_FILE) if PUSH_SUBSCRIPTIONS_FILE.exists() else pd.DataFrame()
    if not df.empty and "endpoint" in df.columns:
        df = df[df["endpoint"] != endpoint]  # Remove existing with same endpoint
    new_row = pd.DataFrame([{
        "id": str(uuid.uuid4())[:8],
        "user": user,
        "endpoint": endpoint,
        "p256dh": p256dh,
        "auth": auth,
        "created_at": datetime.now().isoformat()
    }])
    df = pd.concat([df, new_row], ignore_index=True)
    df.to_csv(PUSH_SUBSCRIPTIONS_FILE, index=False)
    return True


def delete_push_subscription(endpoint: str) -> bool:
    if not PUSH_SUBSCRIPTIONS_FILE.exists():
        return False
    df = pd.read_csv(PUSH_SUBSCRIPTIONS_FILE)
    before = len(df)
    df = df[df["endpoint"] != endpoint]
    df.to_csv(PUSH_SUBSCRIPTIONS_FILE, index=False)
    return len(df) < before


def get_push_subscriptions(user: str) -> List[dict]:
    """Return list of subscription_info dicts for pywebpush."""
    if not PUSH_SUBSCRIPTIONS_FILE.exists():
        return []
    df = pd.read_csv(PUSH_SUBSCRIPTIONS_FILE)
    df = df[df["user"] == user]
    results = []
    for _, row in df.iterrows():
        results.append({
            "endpoint": row["endpoint"],
            "keys": {"p256dh": row["p256dh"], "auth": row["auth"]}
        })
    return results
