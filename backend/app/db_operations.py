"""

PostgreSQL Database Operations for Labour Attendance Management System

This module replaces the CSV-based database.py with SQLAlchemy operations

"""



from typing import List, Optional

from datetime import date, datetime, timedelta

import uuid

from sqlalchemy.orm import Session

from sqlalchemy import and_, or_



from .db_models import (

    UserDB, LabourDB, AttendanceDB, SalaryDB, OvertimeDB,

    AdvanceDB, LeaveDB, SiteDB, SiteAssignmentDB, AuditLogDB, BackupDB,

    NotificationDB, PushSubscriptionDB, RefreshTokenDB, SalaryPaymentDB,

    DesignationDB, ist_now

)

from .models import (

    User, Labour, Attendance, SalaryRecord, PaymentLog, UserRole, AttendanceStatus,

    Overtime, Advance, Leave, LeaveType, LeaveStatus,

    Site, LabourSiteAssignment, AuditLog, AuditAction,

    Notification, NotificationType

)

from .db_connection import get_db_session





# ============== USER OPERATIONS ==============



def get_user(username: str) -> Optional[User]:

    db = get_db_session()

    try:

        user = db.query(UserDB).filter(UserDB.username == username).first()

        if not user:

            return None

        return User(

            username=user.username,

            role=UserRole(user.role),

            hashed_password=user.hashed_password,

            is_active=user.is_active,

            cafe_price_access=bool(getattr(user, 'cafe_price_access', False)),

        )

    finally:

        db.close()





def create_user(user: User) -> User:

    db = get_db_session()

    try:

        db_user = UserDB(

            username=user.username,

            role=user.role.value,

            hashed_password=user.hashed_password,

            is_active=getattr(user, 'is_active', True),

            cafe_price_access=getattr(user, 'cafe_price_access', False),

        )

        db.add(db_user)

        db.commit()

        return user

    finally:

        db.close()





def get_all_users() -> List[dict]:

    db = get_db_session()

    try:

        users = db.query(UserDB).all()

        return [

            {

                "username": u.username,

                "role": u.role,

                "is_active": u.is_active,

                "cafe_price_access": bool(getattr(u, 'cafe_price_access', False)),

            }

            for u in users

        ]

    finally:

        db.close()





def update_user(username: str, **kwargs) -> bool:

    db = get_db_session()

    try:

        user = db.query(UserDB).filter(UserDB.username == username).first()

        if not user:

            return False

        

        for key, value in kwargs.items():

            if value is not None:

                if key == 'role' and hasattr(value, 'value'):

                    value = value.value

                if key == 'hashed_password':

                    setattr(user, 'hashed_password', value)

                elif hasattr(user, key):

                    setattr(user, key, value)

        

        db.commit()

        return True

    finally:

        db.close()





# ============== LABOUR OPERATIONS ==============



def get_all_labours(include_inactive: bool = False) -> List[Labour]:

    db = get_db_session()

    try:

        query = db.query(LabourDB)

        if not include_inactive:

            query = query.filter(LabourDB.is_active == True)

        

        labours = query.all()

        return [Labour(

            id=l.id,

            name=l.name,

            phone=l.phone,

            daily_wage=l.daily_wage,

            joined_date=l.joined_date,

            is_active=l.is_active,

            pay_cycle=l.pay_cycle or "weekly",

            designation=l.designation

        ) for l in labours]

    finally:

        db.close()





def get_labour(labour_id: str) -> Optional[Labour]:

    db = get_db_session()

    try:

        labour = db.query(LabourDB).filter(LabourDB.id == labour_id).first()

        if not labour:

            return None

        return Labour(

            id=labour.id,

            name=labour.name,

            phone=labour.phone,

            daily_wage=labour.daily_wage,

            joined_date=labour.joined_date,

            is_active=labour.is_active,

            pay_cycle=labour.pay_cycle or "weekly",

            designation=labour.designation

        )

    finally:

        db.close()





def create_labour(name: str, daily_wage: float, phone: str = None, joined_date: date = None, pay_cycle: str = "weekly", designation: str = None) -> Labour:

    db = get_db_session()

    try:

        labour_id = str(uuid.uuid4())[:8]

        if joined_date is None:

            joined_date = date.today()



        db_labour = LabourDB(

            id=labour_id,

            name=name,

            phone=phone,

            daily_wage=daily_wage,

            joined_date=joined_date,

            is_active=True,

            pay_cycle=pay_cycle,

            designation=designation

        )

        db.add(db_labour)

        db.commit()



        return Labour(

            id=labour_id,

            name=name,

            phone=phone,

            daily_wage=daily_wage,

            joined_date=joined_date,

            is_active=True,

            pay_cycle=pay_cycle,

            designation=designation

        )

    finally:

        db.close()





def update_labour(labour_id: str, **kwargs) -> Optional[Labour]:

    db = get_db_session()

    try:

        labour = db.query(LabourDB).filter(LabourDB.id == labour_id).first()

        if not labour:

            return None

        

        for key, value in kwargs.items():

            if value is not None and hasattr(labour, key):

                setattr(labour, key, value)

        

        db.commit()

        return get_labour(labour_id)

    finally:

        db.close()





def delete_labour(labour_id: str) -> bool:

    result = update_labour(labour_id, is_active=False)

    return result is not None





# ============== ATTENDANCE OPERATIONS ==============



def get_attendance_by_date(target_date: date) -> List[Attendance]:

    db = get_db_session()

    try:

        records = db.query(AttendanceDB).filter(AttendanceDB.date == target_date).all()

        return [Attendance(

            id=r.id,

            labour_id=r.labour_id,

            date=r.date,

            status=AttendanceStatus(r.status),

            comment=r.comment,

            marked_by=r.marked_by,

            marked_at=r.created_at

        ) for r in records]

    finally:

        db.close()





def get_attendance_by_labour(labour_id: str, start_date: date = None, end_date: date = None) -> List[Attendance]:

    db = get_db_session()

    try:

        query = db.query(AttendanceDB).filter(AttendanceDB.labour_id == labour_id)

        

        if start_date:

            query = query.filter(AttendanceDB.date >= start_date)

        if end_date:

            query = query.filter(AttendanceDB.date <= end_date)

        

        records = query.all()

        return [Attendance(

            id=r.id,

            labour_id=r.labour_id,

            date=r.date,

            status=AttendanceStatus(r.status),

            comment=r.comment,

            marked_by=r.marked_by,

            marked_at=r.created_at

        ) for r in records]

    finally:

        db.close()





def get_attendance_bulk(labour_ids: List[str], start_date: date, end_date: date) -> dict:

    """Fetch attendance for multiple labours in a single query. Returns dict keyed by labour_id."""

    db = get_db_session()

    try:

        records = db.query(AttendanceDB).filter(

            and_(

                AttendanceDB.labour_id.in_(labour_ids),

                AttendanceDB.date >= start_date,

                AttendanceDB.date <= end_date

            )

        ).all()

        result = {lid: [] for lid in labour_ids}

        for r in records:

            result[r.labour_id].append(Attendance(

                id=r.id,

                labour_id=r.labour_id,

                date=r.date,

                status=AttendanceStatus(r.status),

                marked_by=r.marked_by,

                marked_at=r.created_at

            ))

        return result

    finally:

        db.close()





def get_salary_records_bulk(labour_ids: List[str]) -> dict:

    """Fetch all salary records for multiple labours in a single query. Returns dict keyed by labour_id."""

    db = get_db_session()

    try:

        records = db.query(SalaryDB).filter(

            SalaryDB.labour_id.in_(labour_ids)

        ).all()

        result = {lid: [] for lid in labour_ids}

        for r in records:

            result[r.labour_id].append(SalaryRecord(

                id=r.id,

                labour_id=r.labour_id,

                week_start=r.week_start,

                week_end=r.week_end,

                days_present=r.days_present,

                daily_wage=r.daily_wage,

                total_amount=r.total_amount,

                paid_amount=r.paid_amount or 0.0,

                is_paid=r.is_paid,

                paid_date=r.paid_date,

                paid_by=r.paid_by

            ))

        return result

    finally:

        db.close()





def create_salary_records_bulk(records_data: list) -> List[SalaryRecord]:

    """Upsert multiple salary records in a single DB transaction.

    Zero-days weeks are deleted if they exist, not saved."""

    db = get_db_session()

    try:

        results = []

        for data in records_data:

            total_amount = data['days_present'] * data['daily_wage']

            existing = db.query(SalaryDB).filter(

                and_(SalaryDB.labour_id == data['labour_id'], SalaryDB.week_end == data['week_end'])

            ).first()

            # Don't store zero-amount records; delete if previously existed

            if data['days_present'] == 0:

                if existing and not existing.is_paid:

                    db.delete(existing)

                continue

            if existing:

                existing.days_present = data['days_present']

                existing.daily_wage = data['daily_wage']

                existing.total_amount = total_amount

            else:

                rec = SalaryDB(

                    id=str(uuid.uuid4())[:8],

                    labour_id=data['labour_id'],

                    week_start=data['week_start'],

                    week_end=data['week_end'],

                    days_present=data['days_present'],

                    daily_wage=data['daily_wage'],

                    total_amount=total_amount,

                    is_paid=False

                )

                db.add(rec)

            results.append(SalaryRecord(

                id=existing.id if existing else data['labour_id'],

                labour_id=data['labour_id'],

                week_start=data['week_start'],

                week_end=data['week_end'],

                days_present=data['days_present'],

                daily_wage=data['daily_wage'],

                total_amount=total_amount,

                is_paid=False

            ))

        db.commit()

        return results

    finally:

        db.close()





def mark_attendance(labour_id: str, target_date: date, status: AttendanceStatus, marked_by: str, comment: str = None) -> Attendance:

    db = get_db_session()

    try:

        existing = db.query(AttendanceDB).filter(

            and_(AttendanceDB.labour_id == labour_id, AttendanceDB.date == target_date)

        ).first()

        

        now = datetime.now()

        

        if existing:

            existing.status = status.value

            existing.comment = comment

            existing.marked_by = marked_by

            existing.created_at = now

            db.commit()

            return Attendance(

                id=existing.id,

                labour_id=labour_id,

                date=target_date,

                status=status,

                comment=comment,

                marked_by=marked_by,

                marked_at=now

            )

        

        attendance_id = str(uuid.uuid4())[:8]

        db_attendance = AttendanceDB(

            id=attendance_id,

            labour_id=labour_id,

            date=target_date,

            status=status.value,

            comment=comment,

            marked_by=marked_by,

            created_at=now

        )

        db.add(db_attendance)

        db.commit()

        

        return Attendance(

            id=attendance_id,

            labour_id=labour_id,

            date=target_date,

            status=status,

            comment=comment,

            marked_by=marked_by,

            marked_at=now

        )

    finally:

        db.close()





def purge_absent_attendance_records() -> int:

    """Delete all attendance records with status 'absent'. One-time cleanup."""

    db = get_db_session()

    try:

        deleted = db.query(AttendanceDB).filter(AttendanceDB.status == "absent").delete()

        db.commit()

        return deleted

    finally:

        db.close()





def delete_attendance(labour_id: str, target_date: date) -> bool:

    """Delete an attendance record (used when marking absent = unmark)."""

    db = get_db_session()

    try:

        existing = db.query(AttendanceDB).filter(

            and_(AttendanceDB.labour_id == labour_id, AttendanceDB.date == target_date)

        ).first()

        if existing:

            db.delete(existing)

            db.commit()

            return True

        return False

    finally:

        db.close()





# ============== SALARY OPERATIONS ==============



def get_salary_records(labour_id: str = None, is_paid: bool = None) -> List[SalaryRecord]:

    db = get_db_session()

    try:

        query = db.query(SalaryDB)

        

        if labour_id:

            query = query.filter(SalaryDB.labour_id == labour_id)

        if is_paid is not None:

            query = query.filter(SalaryDB.is_paid == is_paid)

        

        records = query.all()

        return [SalaryRecord(

            id=r.id,

            labour_id=r.labour_id,

            week_start=r.week_start,

            week_end=r.week_end,

            days_present=r.days_present,

            daily_wage=r.daily_wage,

            total_amount=r.total_amount,

            paid_amount=r.paid_amount or 0.0,

            is_paid=r.is_paid,

            paid_date=r.paid_date,

            paid_by=r.paid_by,

            payment_comment=r.payment_comment

        ) for r in records]

    finally:

        db.close()





def delete_unpaid_salary_records(labour_id: str) -> int:

    """Delete all unpaid salary records for a labour. Returns count deleted."""

    db = get_db_session()

    try:

        count = db.query(SalaryDB).filter(

            and_(SalaryDB.labour_id == labour_id, SalaryDB.is_paid == False)

        ).delete()

        db.commit()

        return count

    finally:

        db.close()





def create_salary_record(labour_id: str, week_start: date, week_end: date,

                         days_present: float, daily_wage: float) -> SalaryRecord:

    db = get_db_session()

    try:

        total_amount = days_present * daily_wage



        existing = db.query(SalaryDB).filter(

            and_(SalaryDB.labour_id == labour_id, SalaryDB.week_end == week_end)

        ).first()



        # Zero-days week: delete existing unpaid record if any, don't create new

        if days_present == 0:

            if existing and not existing.is_paid:

                db.delete(existing)

                db.commit()

            return SalaryRecord(

                id=existing.id if existing else "",

                labour_id=labour_id,

                week_start=week_start,

                week_end=week_end,

                days_present=0,

                daily_wage=daily_wage,

                total_amount=0,

                is_paid=False

            )



        if existing:

            existing.days_present = days_present

            existing.daily_wage = daily_wage

            existing.total_amount = total_amount

            db.commit()

            return SalaryRecord(

                id=existing.id,

                labour_id=labour_id,

                week_start=week_start,

                week_end=week_end,

                days_present=days_present,

                daily_wage=daily_wage,

                total_amount=total_amount,

                is_paid=existing.is_paid

            )

        

        salary_id = str(uuid.uuid4())[:8]

        db_salary = SalaryDB(

            id=salary_id,

            labour_id=labour_id,

            week_start=week_start,

            week_end=week_end,

            days_present=days_present,

            daily_wage=daily_wage,

            total_amount=total_amount,

            is_paid=False

        )

        db.add(db_salary)

        db.commit()

        

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

    finally:

        db.close()





def mark_salary_paid(labour_id: str, week_end: date, paid_by: str, amount_paid: float = None, payment_comment: str = None) -> Optional[dict]:

    db = get_db_session()

    try:

        records = db.query(SalaryDB).filter(

            and_(

                SalaryDB.labour_id == labour_id,

                SalaryDB.is_paid == False,

                SalaryDB.week_end <= week_end

            )

        ).order_by(SalaryDB.week_end).all()



        if not records:

            return None



        today = date.today()

        # Calculate total still owed (total_amount - paid_amount for each record)

        total_due = sum(r.total_amount - (r.paid_amount or 0) for r in records)

        

        # Check if this is an excess payment

        is_excess_payment = amount_paid is not None and amount_paid > total_due



        # Full payment

        if amount_paid is None or amount_paid >= total_due:

            for record in records:

                record.paid_amount = record.total_amount

                record.is_paid = True

                record.paid_date = today

                record.paid_by = paid_by

                if payment_comment:

                    record.payment_comment = payment_comment

            db.commit()



            paid_now = amount_paid if is_excess_payment else total_due

            primary_record_id = records[0].id if records else "unknown"

            _create_payment_log(db, primary_record_id, labour_id, paid_now, paid_by, payment_comment)

            db.commit()



            result = {

                "weeks_paid": len(records),

                "amount_paid": paid_now,

                "remaining": 0.0,

            }

            if is_excess_payment:

                result["excess_amount"] = amount_paid - total_due

                result["payment_comment"] = payment_comment

            return result



        # Partial payment — allocate to oldest weeks first

        remaining_budget = amount_paid

        weeks_paid = 0

        for record in records:

            week_remaining = record.total_amount - (record.paid_amount or 0)

            if remaining_budget >= week_remaining:

                # Fully pay this week

                record.paid_amount = record.total_amount

                record.is_paid = True

                record.paid_date = today

                record.paid_by = paid_by

                remaining_budget -= week_remaining

                weeks_paid += 1

            elif remaining_budget > 0:

                # Partial payment toward this week — don't mark as paid

                record.paid_amount = (record.paid_amount or 0) + remaining_budget

                record.paid_by = paid_by

                if payment_comment:

                    record.payment_comment = payment_comment

                remaining_budget = 0

                break

            else:

                break



        db.commit()

        actual_paid = amount_paid - remaining_budget

        result = {

            "weeks_paid": weeks_paid,

            "amount_paid": actual_paid,

            "remaining": total_due - actual_paid,

        }



        # Log this payment installment

        primary_record_id = records[0].id if records else "unknown"

        _create_payment_log(db, primary_record_id, labour_id, actual_paid, paid_by, payment_comment)

        db.commit()

        return result

    finally:

        db.close()





# ============== PAYMENT LOG OPERATIONS ==============



def _create_payment_log(db: Session, salary_record_id: str, labour_id: str,

                        amount: float, paid_by: str, comment: str = None):

    """Internal helper — creates a SalaryPaymentDB row inside an open session."""

    entry = SalaryPaymentDB(

        id=str(uuid.uuid4())[:8],

        salary_record_id=salary_record_id,

        labour_id=labour_id,

        amount=round(amount, 2),

        paid_date=date.today(),

        paid_by=paid_by,

        comment=comment,

    )

    db.add(entry)





def create_payment_log_entry(salary_record_id: str, labour_id: str,

                             amount: float, paid_by: str, comment: str = None) -> PaymentLog:

    """Public function — creates a payment log entry in its own session."""

    db = get_db_session()

    try:

        _create_payment_log(db, salary_record_id, labour_id, amount, paid_by, comment)

        db.commit()

        return PaymentLog(

            id=str(uuid.uuid4())[:8],

            salary_record_id=salary_record_id,

            labour_id=labour_id,

            amount=amount,

            paid_date=date.today(),

            paid_by=paid_by,

            comment=comment,

        )

    finally:

        db.close()





def get_payment_logs(labour_id: str = None, salary_record_id: str = None) -> list:

    """Return PaymentLog entries, optionally filtered by labour or salary record."""

    db = get_db_session()

    try:

        q = db.query(SalaryPaymentDB)

        if labour_id:

            q = q.filter(SalaryPaymentDB.labour_id == labour_id)

        if salary_record_id:

            q = q.filter(SalaryPaymentDB.salary_record_id == salary_record_id)

        rows = q.order_by(SalaryPaymentDB.paid_date).all()

        return [

            PaymentLog(

                id=r.id,

                salary_record_id=r.salary_record_id,

                labour_id=r.labour_id,

                amount=r.amount,

                paid_date=r.paid_date,

                paid_by=r.paid_by,

                comment=r.comment,

            )

            for r in rows

        ]

    finally:

        db.close()





# ============== OVERTIME OPERATIONS ==============



def create_overtime(labour_id: str, target_date: date, hours: float, rate_multiplier: float, approved_by: str) -> Overtime:

    db = get_db_session()

    try:

        labour = get_labour(labour_id)

        if not labour:

            raise ValueError(f"Labour {labour_id} not found")

        

        hourly_rate = labour.daily_wage / 8

        amount = hours * hourly_rate * rate_multiplier

        

        overtime_id = str(uuid.uuid4())[:8]

        now = datetime.now()

        

        db_overtime = OvertimeDB(

            id=overtime_id,

            labour_id=labour_id,

            date=target_date,

            hours=hours,

            rate_multiplier=rate_multiplier,

            created_by=approved_by,

            created_at=now

        )

        db.add(db_overtime)

        db.commit()

        

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

    finally:

        db.close()





def get_overtime_records(labour_id: str = None, start_date: date = None, end_date: date = None) -> List[Overtime]:

    db = get_db_session()

    try:

        query = db.query(OvertimeDB)

        

        if labour_id:

            query = query.filter(OvertimeDB.labour_id == labour_id)

        if start_date:

            query = query.filter(OvertimeDB.date >= start_date)

        if end_date:

            query = query.filter(OvertimeDB.date <= end_date)

        

        records = query.all()

        result = []

        for r in records:

            labour = get_labour(r.labour_id)

            hourly_rate = labour.daily_wage / 8 if labour else 0

            amount = r.hours * hourly_rate * r.rate_multiplier

            result.append(Overtime(

                id=r.id,

                labour_id=r.labour_id,

                date=r.date,

                hours=r.hours,

                rate_multiplier=r.rate_multiplier,

                amount=amount,

                approved_by=r.created_by,

                created_at=r.created_at

            ))

        return result

    finally:

        db.close()





# ============== ADVANCE OPERATIONS ==============



def create_advance(labour_id: str, amount: float, reason: str, given_by: str) -> Advance:

    db = get_db_session()

    try:

        advance_id = str(uuid.uuid4())[:8]

        now = datetime.now()

        today = date.today()

        

        db_advance = AdvanceDB(

            id=advance_id,

            labour_id=labour_id,

            amount=amount,

            date=today,

            reason=reason,

            is_deducted=False,

            created_by=given_by,

            created_at=now

        )

        db.add(db_advance)

        db.commit()

        

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

    finally:

        db.close()





def get_advances(labour_id: str = None, is_deducted: bool = None) -> List[Advance]:

    db = get_db_session()

    try:

        query = db.query(AdvanceDB)

        

        if labour_id:

            query = query.filter(AdvanceDB.labour_id == labour_id)

        if is_deducted is not None:

            query = query.filter(AdvanceDB.is_deducted == is_deducted)

        

        records = query.all()

        return [Advance(

            id=r.id,

            labour_id=r.labour_id,

            amount=r.amount,

            repaid_amount=r.repaid_amount or 0.0,

            date=r.date,

            reason=r.reason,

            is_deducted=r.is_deducted,

            deducted_from_week=None,

            given_by=r.created_by,

            created_at=r.created_at

        ) for r in records]

    finally:

        db.close()





def get_pending_advances(labour_id: str) -> float:

    advances = get_advances(labour_id=labour_id, is_deducted=False)

    return sum(a.amount - (a.repaid_amount or 0.0) for a in advances)





def get_all_pending_advances_bulk() -> dict:

    """Get pending advances for all labours in a single query. Returns dict keyed by labour_id."""

    db = get_db_session()

    try:

        records = db.query(AdvanceDB).filter(AdvanceDB.is_deducted == False).all()

        result = {}

        for r in records:

            pending = r.amount - (r.repaid_amount or 0.0)

            if pending > 0:

                if r.labour_id not in result:

                    result[r.labour_id] = 0.0

                result[r.labour_id] += pending

        return result

    finally:

        db.close()





def mark_advance_deducted(advance_id: str) -> Advance:

    """Mark an advance as fully deducted"""

    db = get_db_session()

    try:

        advance = db.query(AdvanceDB).filter(AdvanceDB.id == advance_id).first()

        if not advance:

            return None

        

        advance.repaid_amount = advance.amount

        advance.is_deducted = True

        db.commit()

        db.refresh(advance)

        

        return Advance(

            id=advance.id,

            labour_id=advance.labour_id,

            amount=advance.amount,

            repaid_amount=advance.repaid_amount or 0.0,

            date=advance.date,

            reason=advance.reason,

            is_deducted=advance.is_deducted,

            deducted_from_week=None,

            given_by=advance.created_by,

            created_at=advance.created_at

        )

    finally:

        db.close()





def repay_advance_partial(advance_id: str, repay_amount: float) -> Advance:

    """Record a partial repayment for an advance"""

    db = get_db_session()

    try:

        advance = db.query(AdvanceDB).filter(AdvanceDB.id == advance_id).first()

        if not advance:

            return None

        

        current_repaid = advance.repaid_amount or 0.0

        new_repaid = min(current_repaid + repay_amount, advance.amount)

        advance.repaid_amount = new_repaid

        

        # Auto-mark fully deducted if fully repaid

        if new_repaid >= advance.amount:

            advance.is_deducted = True

        

        db.commit()

        db.refresh(advance)

        

        return Advance(

            id=advance.id,

            labour_id=advance.labour_id,

            amount=advance.amount,

            repaid_amount=advance.repaid_amount or 0.0,

            date=advance.date,

            reason=advance.reason,

            is_deducted=advance.is_deducted,

            deducted_from_week=None,

            given_by=advance.created_by,

            created_at=advance.created_at

        )

    finally:

        db.close()





# ============== LEAVE OPERATIONS ==============



def create_leave(labour_id: str, leave_type: LeaveType, start_date: date, end_date: date, reason: str = None) -> Leave:

    db = get_db_session()

    try:

        leave_id = str(uuid.uuid4())[:8]

        now = datetime.now()

        days = (end_date - start_date).days + 1

        

        db_leave = LeaveDB(

            id=leave_id,

            labour_id=labour_id,

            start_date=start_date,

            end_date=end_date,

            leave_type=leave_type.value,

            reason=reason,

            status=LeaveStatus.PENDING.value,

            created_at=now

        )

        db.add(db_leave)

        db.commit()

        

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

    finally:

        db.close()





def get_leaves(labour_id: str = None, status: LeaveStatus = None) -> List[Leave]:

    db = get_db_session()

    try:

        query = db.query(LeaveDB)

        

        if labour_id:

            query = query.filter(LeaveDB.labour_id == labour_id)

        if status:

            query = query.filter(LeaveDB.status == status.value)

        

        records = query.all()

        return [Leave(

            id=r.id,

            labour_id=r.labour_id,

            leave_type=LeaveType(r.leave_type),

            start_date=r.start_date,

            end_date=r.end_date,

            days=(r.end_date - r.start_date).days + 1,

            reason=r.reason,

            status=LeaveStatus(r.status),

            approved_by=r.approved_by,

            created_at=r.created_at

        ) for r in records]

    finally:

        db.close()





def approve_leave(leave_id: str, approved_by: str, approve: bool = True) -> Optional[Leave]:

    db = get_db_session()

    try:

        leave = db.query(LeaveDB).filter(LeaveDB.id == leave_id).first()

        if not leave:

            return None

        

        new_status = LeaveStatus.APPROVED if approve else LeaveStatus.REJECTED

        leave.status = new_status.value

        leave.approved_by = approved_by

        db.commit()

        

        return Leave(

            id=leave.id,

            labour_id=leave.labour_id,

            leave_type=LeaveType(leave.leave_type),

            start_date=leave.start_date,

            end_date=leave.end_date,

            days=(leave.end_date - leave.start_date).days + 1,

            reason=leave.reason,

            status=new_status,

            approved_by=approved_by,

            created_at=leave.created_at

        )

    finally:

        db.close()





# ============== SITE OPERATIONS ==============



def create_site(name: str, address: str = None) -> Site:

    db = get_db_session()

    try:

        site_id = str(uuid.uuid4())[:8]

        now = datetime.now()

        

        db_site = SiteDB(

            id=site_id,

            name=name,

            address=address,

            is_active=True,

            created_at=now

        )

        db.add(db_site)

        db.commit()

        

        return Site(id=site_id, name=name, address=address, is_active=True, created_at=now)

    finally:

        db.close()





def get_sites(include_inactive: bool = False) -> List[Site]:

    db = get_db_session()

    try:

        query = db.query(SiteDB)

        if not include_inactive:

            query = query.filter(SiteDB.is_active == True)

        

        sites = query.all()

        return [Site(

            id=s.id,

            name=s.name,

            address=s.address,

            is_active=s.is_active,

            created_at=s.created_at

        ) for s in sites]

    finally:

        db.close()





def get_site(site_id: str) -> Optional[Site]:

    db = get_db_session()

    try:

        site = db.query(SiteDB).filter(SiteDB.id == site_id).first()

        if not site:

            return None

        return Site(

            id=site.id,

            name=site.name,

            address=site.address,

            is_active=site.is_active,

            created_at=site.created_at

        )

    finally:

        db.close()





def assign_labour_to_site(labour_id: str, site_id: str, assigned_by: str) -> LabourSiteAssignment:

    db = get_db_session()

    try:

        today = date.today()

        

        # Remove existing assignment

        db.query(SiteAssignmentDB).filter(SiteAssignmentDB.labour_id == labour_id).delete()

        

        assignment_id = str(uuid.uuid4())[:8]

        db_assignment = SiteAssignmentDB(

            id=assignment_id,

            labour_id=labour_id,

            site_id=site_id,

            assigned_date=today,

            is_active=True

        )

        db.add(db_assignment)

        db.commit()

        

        return LabourSiteAssignment(

            labour_id=labour_id,

            site_id=site_id,

            assigned_date=today,

            assigned_by=assigned_by

        )

    finally:

        db.close()





def get_labours_by_site(site_id: str) -> List[str]:

    db = get_db_session()

    try:

        assignments = db.query(SiteAssignmentDB).filter(

            and_(SiteAssignmentDB.site_id == site_id, SiteAssignmentDB.is_active == True)

        ).all()

        return [a.labour_id for a in assignments]

    finally:

        db.close()





def get_labour_site(labour_id: str) -> Optional[str]:

    db = get_db_session()

    try:

        assignment = db.query(SiteAssignmentDB).filter(

            and_(SiteAssignmentDB.labour_id == labour_id, SiteAssignmentDB.is_active == True)

        ).first()

        return assignment.site_id if assignment else None

    finally:

        db.close()





# ============== AUDIT LOG OPERATIONS ==============



def create_audit_log(user: str, action: AuditAction, entity_type: str, entity_id: str = None,

                     old_value: str = None, new_value: str = None, ip_address: str = None) -> AuditLog:

    db = get_db_session()

    try:

        log_id = str(uuid.uuid4())[:8]

        now = datetime.now()

        

        db_log = AuditLogDB(

            id=log_id,

            action=action.value,

            entity_type=entity_type,

            entity_id=entity_id,

            user=user,

            details=new_value,

            timestamp=now

        )

        db.add(db_log)

        db.commit()

        

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

    finally:

        db.close()





def get_audit_logs(user: str = None, action: AuditAction = None, entity_type: str = None,

                   start_date: datetime = None, end_date: datetime = None, limit: int = 100) -> List[AuditLog]:

    db = get_db_session()

    try:

        query = db.query(AuditLogDB)

        

        if user:

            query = query.filter(AuditLogDB.user == user)

        if action:

            query = query.filter(AuditLogDB.action == action.value)

        if entity_type:

            query = query.filter(AuditLogDB.entity_type == entity_type)

        if start_date:

            query = query.filter(AuditLogDB.timestamp >= start_date)

        if end_date:

            query = query.filter(AuditLogDB.timestamp <= end_date)

        

        logs = query.order_by(AuditLogDB.timestamp.desc()).limit(limit).all()

        return [AuditLog(

            id=l.id,

            timestamp=l.timestamp,

            user=l.user,

            action=AuditAction(l.action),

            entity_type=l.entity_type,

            entity_id=l.entity_id,

            old_value=None,

            new_value=l.details,

            ip_address=None

        ) for l in logs]

    finally:

        db.close()





# ============== EXPORT OPERATIONS ==============



def export_labours_csv() -> str:

    labours = get_all_labours(include_inactive=True)

    if not labours:

        return "id,name,phone,daily_wage,joined_date,is_active\n"

    

    lines = ["id,name,phone,daily_wage,joined_date,is_active"]

    for l in labours:

        lines.append(f"{l.id},{l.name},{l.phone or ''},{l.daily_wage},{l.joined_date},{l.is_active}")

    return "\n".join(lines)





def export_attendance_csv() -> str:

    db = get_db_session()

    try:

        records = db.query(AttendanceDB).all()

        if not records:

            return "id,labour_id,date,status,marked_by,marked_at\n"

        

        lines = ["id,labour_id,date,status,marked_by,marked_at"]

        for r in records:

            lines.append(f"{r.id},{r.labour_id},{r.date},{r.status},{r.marked_by or ''},{r.created_at}")

        return "\n".join(lines)

    finally:

        db.close()





def export_salary_csv() -> str:

    records = get_salary_records()

    if not records:

        return "id,labour_id,week_start,week_end,days_present,daily_wage,total_amount,is_paid,paid_date,paid_by\n"

    

    lines = ["id,labour_id,week_start,week_end,days_present,daily_wage,total_amount,is_paid,paid_date,paid_by"]

    for r in records:

        lines.append(f"{r.id},{r.labour_id},{r.week_start},{r.week_end},{r.days_present},{r.daily_wage},{r.total_amount},{r.is_paid},{r.paid_date or ''},{r.paid_by or ''}")

    return "\n".join(lines)





def export_all_data() -> dict:

    return {

        "labours": export_labours_csv(),

        "attendance": export_attendance_csv(),

        "salary": export_salary_csv()

    }





# ============== NOTIFICATION OPERATIONS ==============



def create_notification(user: str, notif_type: str, title: str, message: str,

                        labour_id: str = None) -> Notification:

    db = get_db_session()

    try:

        notif_id = str(uuid.uuid4())[:8]

        now = ist_now()

        db_notif = NotificationDB(

            id=notif_id, user=user, labour_id=labour_id,

            type=notif_type, title=title, message=message,

            is_read=False, created_at=now

        )

        db.add(db_notif)

        db.commit()

        return Notification(

            id=notif_id, user=user, labour_id=labour_id,

            type=NotificationType(notif_type), title=title, message=message,

            is_read=False, created_at=now

        )

    finally:

        db.close()





def get_notifications(user: str, unread_only: bool = False, limit: int = 50) -> List[Notification]:

    db = get_db_session()

    try:

        q = db.query(NotificationDB).filter(NotificationDB.user == user)

        if unread_only:

            q = q.filter(NotificationDB.is_read == False)

        rows = q.order_by(NotificationDB.created_at.desc()).limit(limit).all()

        return [

            Notification(

                id=r.id, user=r.user, labour_id=r.labour_id,

                type=NotificationType(r.type), title=r.title, message=r.message,

                is_read=r.is_read, created_at=r.created_at

            ) for r in rows

        ]

    finally:

        db.close()





def get_unread_count(user: str) -> int:

    db = get_db_session()

    try:

        return db.query(NotificationDB).filter(

            NotificationDB.user == user, NotificationDB.is_read == False

        ).count()

    finally:

        db.close()





def mark_notifications_read(user: str, notification_ids: List[str] = None) -> int:

    db = get_db_session()

    try:

        q = db.query(NotificationDB).filter(

            NotificationDB.user == user, NotificationDB.is_read == False

        )

        if notification_ids:

            q = q.filter(NotificationDB.id.in_(notification_ids))

        count = q.count()

        q.update({"is_read": True}, synchronize_session=False)

        db.commit()

        return count

    finally:

        db.close()





# ============== PUSH SUBSCRIPTION OPERATIONS ==============



def save_push_subscription(user: str, endpoint: str, p256dh: str, auth: str) -> bool:

    db = get_db_session()

    try:

        existing = db.query(PushSubscriptionDB).filter(

            PushSubscriptionDB.endpoint == endpoint

        ).first()

        if existing:

            existing.user = user

            existing.p256dh = p256dh

            existing.auth = auth

        else:

            db.add(PushSubscriptionDB(

                id=str(uuid.uuid4())[:8], user=user,

                endpoint=endpoint, p256dh=p256dh, auth=auth

            ))

        db.commit()

        return True

    finally:

        db.close()





def delete_push_subscription(endpoint: str) -> bool:

    db = get_db_session()

    try:

        deleted = db.query(PushSubscriptionDB).filter(

            PushSubscriptionDB.endpoint == endpoint

        ).delete()

        db.commit()

        return deleted > 0

    finally:

        db.close()





def get_push_subscriptions(user: str) -> List[dict]:

    db = get_db_session()

    try:

        rows = db.query(PushSubscriptionDB).filter(PushSubscriptionDB.user == user).all()

        return [{"endpoint": r.endpoint, "keys": {"p256dh": r.p256dh, "auth": r.auth}} for r in rows]

    finally:

        db.close()





# ============== REFRESH TOKEN OPERATIONS ==============



def create_refresh_token(username: str, token: str, expires_at: datetime) -> bool:

    """Create a new refresh token"""

    db = get_db_session()

    try:

        # Revoke any existing tokens for this user

        db.query(RefreshTokenDB).filter(RefreshTokenDB.user_id == username).update({"is_revoked": True})

        

        # Create new refresh token

        refresh_token = RefreshTokenDB(

            id=str(uuid.uuid4()),

            user_id=username,

            token=token,

            expires_at=expires_at

        )

        db.add(refresh_token)

        db.commit()

        return True

    except Exception:

        db.rollback()

        return False

    finally:

        db.close()





def get_refresh_token(token: str) -> Optional[RefreshTokenDB]:

    """Get refresh token by token string"""

    db = get_db_session()

    try:

        return db.query(RefreshTokenDB).filter(

            and_(

                RefreshTokenDB.token == token,

                RefreshTokenDB.is_revoked == False,

                RefreshTokenDB.expires_at > ist_now()

            )

        ).first()

    finally:

        db.close()





def revoke_refresh_token(token: str) -> bool:

    """Revoke a refresh token"""

    db = get_db_session()

    try:

        refresh_token = db.query(RefreshTokenDB).filter(RefreshTokenDB.token == token).first()

        if refresh_token:

            refresh_token.is_revoked = True

            db.commit()

            return True

        return False

    except Exception:

        db.rollback()

        return False

    finally:

        db.close()





def revoke_all_refresh_tokens(username: str) -> bool:

    """Revoke all refresh tokens for a user"""

    db = get_db_session()

    try:

        db.query(RefreshTokenDB).filter(RefreshTokenDB.user_id == username).update({"is_revoked": True})

        db.commit()

        return True

    except Exception:

        db.rollback()

        return False

    finally:

        db.close()





# ============== CAFE INVENTORY OPERATIONS ==============



from .db_models import CafeItemDB, CafeStockEntryDB





def create_cafe_item(name: str, category: str, unit: str, description: str = None):

    from .models import CafeItem

    db = get_db_session()

    try:

        now = ist_now()

        item_id = str(uuid.uuid4())[:8]

        db_item = CafeItemDB(

            id=item_id, name=name, category=category, unit=unit,

            description=description, active=True, created_at=now, updated_at=now

        )

        db.add(db_item)

        db.commit()

        return CafeItem(id=item_id, name=name, category=category, unit=unit,

                        description=description, active=True, created_at=now, updated_at=now)

    finally:

        db.close()





def get_cafe_items(include_inactive: bool = False) -> list:

    from .models import CafeItem

    db = get_db_session()

    try:

        q = db.query(CafeItemDB)

        if not include_inactive:

            q = q.filter(CafeItemDB.active == True)

        rows = q.order_by(CafeItemDB.category, CafeItemDB.name).all()

        return [CafeItem(id=r.id, name=r.name, category=r.category, unit=r.unit,

                         description=r.description, active=r.active,

                         created_at=r.created_at, updated_at=r.updated_at) for r in rows]

    finally:

        db.close()





def get_cafe_item(item_id: str):

    from .models import CafeItem

    db = get_db_session()

    try:

        r = db.query(CafeItemDB).filter(CafeItemDB.id == item_id).first()

        if not r:

            return None

        return CafeItem(id=r.id, name=r.name, category=r.category, unit=r.unit,

                        description=r.description, active=r.active,

                        created_at=r.created_at, updated_at=r.updated_at)

    finally:

        db.close()





def update_cafe_item(item_id: str, **kwargs):

    from .models import CafeItem

    db = get_db_session()

    try:

        r = db.query(CafeItemDB).filter(CafeItemDB.id == item_id).first()

        if not r:

            return None

        for key, val in kwargs.items():

            if val is not None and hasattr(r, key):

                setattr(r, key, val)

        r.updated_at = ist_now()

        db.commit()

        return CafeItem(id=r.id, name=r.name, category=r.category, unit=r.unit,

                        description=r.description, active=r.active,

                        created_at=r.created_at, updated_at=r.updated_at)

    finally:

        db.close()





def create_cafe_stock_entry(site_id: str, item_id: str, quantity: float,

                             unit_price: float, supplier: str, entry_date,

                             comments: str, created_by: str):

    from .models import CafeStockEntry

    db = get_db_session()

    try:

        now = ist_now()

        entry_id = str(uuid.uuid4())[:8]

        total_cost = round(quantity * unit_price, 2) if unit_price is not None else None

        db_entry = CafeStockEntryDB(

            id=entry_id, site_id=site_id, item_id=item_id, quantity=quantity,

            unit_price=unit_price, total_cost=total_cost, supplier=supplier,

            entry_date=entry_date, comments=comments, created_by=created_by,

            created_at=now, updated_at=now

        )

        db.add(db_entry)

        db.commit()



        item = db.query(CafeItemDB).filter(CafeItemDB.id == item_id).first()

        site = db.query(SiteDB).filter(SiteDB.id == site_id).first()

        return CafeStockEntry(

            id=entry_id, site_id=site_id, item_id=item_id,

            site_name=site.name if site else None,

            item_name=item.name if item else None,

            item_unit=item.unit if item else None,

            item_category=item.category if item else None,

            quantity=quantity, unit_price=unit_price, total_cost=total_cost,

            supplier=supplier, entry_date=entry_date, comments=comments,

            created_by=created_by, created_at=now, updated_at=now

        )

    finally:

        db.close()





def get_cafe_stock_entries(site_id: str = None, item_id: str = None,

                            start_date=None, end_date=None,

                            limit: int = 100, offset: int = 0) -> list:

    from .models import CafeStockEntry

    db = get_db_session()

    try:

        q = db.query(CafeStockEntryDB)

        if site_id:

            q = q.filter(CafeStockEntryDB.site_id == site_id)

        if item_id:

            q = q.filter(CafeStockEntryDB.item_id == item_id)

        if start_date:

            q = q.filter(CafeStockEntryDB.entry_date >= start_date)

        if end_date:

            q = q.filter(CafeStockEntryDB.entry_date <= end_date)

        rows = q.order_by(CafeStockEntryDB.entry_date.desc(), CafeStockEntryDB.created_at.desc()) \

                .offset(offset).limit(limit).all()



        item_map = {r.id: r for r in db.query(CafeItemDB).all()}

        site_map = {r.id: r for r in db.query(SiteDB).all()}



        result = []

        for r in rows:

            item = item_map.get(r.item_id)

            site = site_map.get(r.site_id)

            result.append(CafeStockEntry(

                id=r.id, site_id=r.site_id, item_id=r.item_id,

                site_name=site.name if site else None,

                item_name=item.name if item else None,

                item_unit=item.unit if item else None,

                item_category=item.category if item else None,

                quantity=r.quantity, unit_price=r.unit_price, total_cost=r.total_cost,

                supplier=r.supplier, entry_date=r.entry_date, comments=r.comments,

                created_by=r.created_by, created_at=r.created_at, updated_at=r.updated_at

            ))

        return result

    finally:

        db.close()





def get_cafe_stock_entry(entry_id: str):

    from .models import CafeStockEntry

    db = get_db_session()

    try:

        r = db.query(CafeStockEntryDB).filter(CafeStockEntryDB.id == entry_id).first()

        if not r:

            return None

        item = db.query(CafeItemDB).filter(CafeItemDB.id == r.item_id).first()

        site = db.query(SiteDB).filter(SiteDB.id == r.site_id).first()

        return CafeStockEntry(

            id=r.id, site_id=r.site_id, item_id=r.item_id,

            site_name=site.name if site else None,

            item_name=item.name if item else None,

            item_unit=item.unit if item else None,

            item_category=item.category if item else None,

            quantity=r.quantity, unit_price=r.unit_price, total_cost=r.total_cost,

            supplier=r.supplier, entry_date=r.entry_date, comments=r.comments,

            created_by=r.created_by, created_at=r.created_at, updated_at=r.updated_at

        )

    finally:

        db.close()





def update_cafe_stock_entry(entry_id: str, **kwargs):

    from .models import CafeStockEntry

    db = get_db_session()

    try:

        r = db.query(CafeStockEntryDB).filter(CafeStockEntryDB.id == entry_id).first()

        if not r:

            return None

        for key, val in kwargs.items():

            if val is not None and hasattr(r, key):

                setattr(r, key, val)

        # Recalculate total_cost if quantity or unit_price changed

        if r.unit_price is not None and r.quantity is not None:

            r.total_cost = round(r.quantity * r.unit_price, 2)

        r.updated_at = ist_now()

        db.commit()

        item = db.query(CafeItemDB).filter(CafeItemDB.id == r.item_id).first()

        site = db.query(SiteDB).filter(SiteDB.id == r.site_id).first()

        return CafeStockEntry(

            id=r.id, site_id=r.site_id, item_id=r.item_id,

            site_name=site.name if site else None,

            item_name=item.name if item else None,

            item_unit=item.unit if item else None,

            item_category=item.category if item else None,

            quantity=r.quantity, unit_price=r.unit_price, total_cost=r.total_cost,

            supplier=r.supplier, entry_date=r.entry_date, comments=r.comments,

            created_by=r.created_by, created_at=r.created_at, updated_at=r.updated_at

        )

    finally:

        db.close()





def delete_cafe_stock_entry(entry_id: str) -> bool:

    db = get_db_session()

    try:

        deleted = db.query(CafeStockEntryDB).filter(CafeStockEntryDB.id == entry_id).delete()

        db.commit()

        return deleted > 0

    finally:

        db.close()





def get_cafe_analytics(site_id: str = None, start_date=None, end_date=None) -> dict:

    from sqlalchemy import func, desc

    db = get_db_session()

    try:

        def base_filter(q):

            if site_id:

                q = q.filter(CafeStockEntryDB.site_id == site_id)

            if start_date:

                q = q.filter(CafeStockEntryDB.entry_date >= start_date)

            if end_date:

                q = q.filter(CafeStockEntryDB.entry_date <= end_date)

            return q



        # By item

        by_item_q = base_filter(

            db.query(

                CafeItemDB.name.label('item_name'),

                CafeItemDB.category.label('category'),

                CafeItemDB.unit.label('unit'),

                func.sum(CafeStockEntryDB.quantity).label('total_quantity'),

                func.sum(CafeStockEntryDB.total_cost).label('total_cost'),

                func.count(CafeStockEntryDB.id).label('entry_count')

            ).join(CafeItemDB, CafeStockEntryDB.item_id == CafeItemDB.id)

        ).group_by(CafeItemDB.id, CafeItemDB.name, CafeItemDB.category, CafeItemDB.unit) \

         .order_by(desc('total_quantity'))

        by_item = [{"item_name": r.item_name, "category": r.category, "unit": r.unit,

                    "total_quantity": float(r.total_quantity or 0),

                    "total_cost": float(r.total_cost or 0),

                    "entry_count": r.entry_count} for r in by_item_q.all()]



        # By site

        by_site_q = base_filter(

            db.query(

                SiteDB.name.label('site_name'),

                func.sum(CafeStockEntryDB.quantity).label('total_quantity'),

                func.sum(CafeStockEntryDB.total_cost).label('total_cost'),

                func.count(CafeStockEntryDB.id).label('entry_count')

            ).join(SiteDB, CafeStockEntryDB.site_id == SiteDB.id)

        ).group_by(SiteDB.id, SiteDB.name).order_by(desc('total_cost'))

        by_site = [{"site_name": r.site_name,

                    "total_quantity": float(r.total_quantity or 0),

                    "total_cost": float(r.total_cost or 0),

                    "entry_count": r.entry_count} for r in by_site_q.all()]



        # Trend by date

        trend_q = base_filter(

            db.query(

                CafeStockEntryDB.entry_date,

                func.sum(CafeStockEntryDB.total_cost).label('total_cost'),

                func.sum(CafeStockEntryDB.quantity).label('total_quantity'),

                func.count(CafeStockEntryDB.id).label('count')

            )

        ).group_by(CafeStockEntryDB.entry_date).order_by(CafeStockEntryDB.entry_date)

        trend = [{"date": str(r.entry_date),

                  "total_cost": float(r.total_cost or 0),

                  "total_quantity": float(r.total_quantity or 0),

                  "count": r.count} for r in trend_q.all()]



        # Summary totals

        summary_q = base_filter(

            db.query(

                func.count(CafeStockEntryDB.id).label('total_entries'),

                func.sum(CafeStockEntryDB.total_cost).label('total_cost'),

                func.sum(CafeStockEntryDB.quantity).label('total_quantity'),

            )

        ).first()

        summary = {

            "total_entries": summary_q.total_entries or 0,

            "total_cost": float(summary_q.total_cost or 0),

            "total_quantity": float(summary_q.total_quantity or 0),

        }



        return {"by_item": by_item, "by_site": by_site, "trend": trend, "summary": summary}

    finally:

        db.close()





def export_cafe_stock_csv(site_id: str = None, start_date=None, end_date=None) -> str:

    entries = get_cafe_stock_entries(site_id=site_id, start_date=start_date, end_date=end_date, limit=10000)

    if not entries:

        return "id,entry_date,site_name,item_name,category,unit,quantity,unit_price,total_cost,supplier,comments,created_by\n"

    lines = ["id,entry_date,site_name,item_name,category,unit,quantity,unit_price,total_cost,supplier,comments,created_by"]

    for e in entries:

        supplier = (e.supplier or '').replace(',', ';')

        comments = (e.comments or '').replace(',', ';')

        lines.append(

            f"{e.id},{e.entry_date},{e.site_name or ''},{e.item_name or ''},"

            f"{e.item_category or ''},{e.item_unit or ''},{e.quantity},"

            f"{e.unit_price or ''},{e.total_cost or ''},{supplier},{comments},{e.created_by}"

        )

    return "\n".join(lines)





# ============== DESIGNATION OPERATIONS ==============



def get_designations() -> list:

    db = get_db_session()

    try:

        records = db.query(DesignationDB).order_by(DesignationDB.name).all()

        return [{"id": r.id, "name": r.name} for r in records]

    finally:

        db.close()





def create_designation(name: str) -> dict:

    db = get_db_session()

    try:

        existing = db.query(DesignationDB).filter(DesignationDB.name == name).first()

        if existing:

            return {"id": existing.id, "name": existing.name}

        designation = DesignationDB(

            id=str(uuid.uuid4())[:8],

            name=name,

        )

        db.add(designation)

        db.commit()

        return {"id": designation.id, "name": designation.name}

    finally:

        db.close()





def update_designation(designation_id: str, name: str) -> Optional[dict]:

    db = get_db_session()

    try:

        record = db.query(DesignationDB).filter(DesignationDB.id == designation_id).first()

        if not record:

            return None

        record.name = name

        db.commit()

        return {"id": record.id, "name": record.name}

    finally:

        db.close()





def delete_designation(designation_id: str) -> bool:

    db = get_db_session()

    try:

        record = db.query(DesignationDB).filter(DesignationDB.id == designation_id).first()

        if not record:

            return False

        db.delete(record)

        db.commit()

        return True

    finally:

        db.close()





# ============== INITIALIZATION ==============



def init_db_tables():

    """Initialize database tables"""

    from .db_connection import init_db

    init_db()

