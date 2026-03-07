from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from enum import Enum


class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    LABOUR = "labour"


class User(BaseModel):
    username: str
    role: UserRole
    hashed_password: str
    is_active: bool = True


class UserCreate(BaseModel):
    username: str
    password: str
    role: UserRole = UserRole.MANAGER


class UserUpdate(BaseModel):
    password: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str
    refresh_token: Optional[str] = None


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class PayCycle(str, Enum):
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class Labour(BaseModel):
    id: str
    name: str
    phone: Optional[str] = None
    daily_wage: float
    joined_date: date
    is_active: bool = True
    pay_cycle: PayCycle = PayCycle.WEEKLY


class LabourCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    daily_wage: float
    joined_date: Optional[date] = None
    pay_cycle: PayCycle = PayCycle.WEEKLY


class LabourUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    daily_wage: Optional[float] = None
    is_active: Optional[bool] = None
    joined_date: Optional[date] = None  # Admin only
    pay_cycle: Optional[PayCycle] = None


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    HALF_DAY = "half_day"
    PRESENT_HALF = "present_half"
    DOUBLE_DUTY = "double_duty"


class Attendance(BaseModel):
    id: str
    labour_id: str
    date: date
    status: AttendanceStatus
    comment: Optional[str] = None
    marked_by: str
    marked_at: datetime


class AttendanceCreate(BaseModel):
    labour_id: str
    date: date
    status: AttendanceStatus
    comment: Optional[str] = None


class AttendanceBulkCreate(BaseModel):
    date: date
    records: List[dict]  # [{labour_id: str, status: AttendanceStatus, comment?: str}]


class SalaryRecord(BaseModel):
    id: str
    labour_id: str
    week_start: date
    week_end: date
    days_present: float
    daily_wage: float
    total_amount: float
    paid_amount: float = 0.0  # Tracks partial payments
    is_paid: bool = False
    paid_date: Optional[date] = None
    paid_by: Optional[str] = None
    payment_comment: Optional[str] = None  # Comment for excess payments


class SalaryPayment(BaseModel):
    labour_id: str
    week_end: date  # Friday of the week
    amount_paid: Optional[float] = None  # None = pay full amount; otherwise partial
    payment_comment: Optional[str] = None  # Comment required when paying more than due
    advance_deduction: Optional[str] = None  # "full", "partial", or "none" (default: none)
    advance_deduction_amount: Optional[float] = None  # Amount to deduct if partial


class LabourStats(BaseModel):
    labour_id: str
    name: str
    total_days_present: float
    total_days_absent: int
    total_half_days: int
    total_earned: float
    total_paid: float
    pending_amount: float


class WeeklyStats(BaseModel):
    week_start: date
    week_end: date
    total_labourers: int
    total_present_days: float
    total_wages: float
    total_paid: float
    pending_payment: float


# ============== NEW FEATURES ==============

# Overtime Tracking
class Overtime(BaseModel):
    id: str
    labour_id: str
    date: date
    hours: float
    rate_multiplier: float = 1.5  # 1.5x normal hourly rate
    amount: float
    approved_by: Optional[str] = None
    created_at: datetime


class OvertimeCreate(BaseModel):
    labour_id: str
    date: date
    hours: float
    rate_multiplier: float = 1.5


# Advance Payments
class Advance(BaseModel):
    id: str
    labour_id: str
    amount: float
    repaid_amount: float = 0.0
    date: date
    reason: Optional[str] = None
    is_deducted: bool = False
    deducted_from_week: Optional[date] = None
    given_by: str
    created_at: datetime


class AdvanceCreate(BaseModel):
    labour_id: str
    amount: float
    reason: Optional[str] = None


class AdvanceRepay(BaseModel):
    repay_amount: float


# Leave Management
class LeaveType(str, Enum):
    SICK = "sick"
    CASUAL = "casual"
    EARNED = "earned"
    UNPAID = "unpaid"


class LeaveStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Leave(BaseModel):
    id: str
    labour_id: str
    leave_type: LeaveType
    start_date: date
    end_date: date
    days: float
    reason: Optional[str] = None
    status: LeaveStatus = LeaveStatus.PENDING
    approved_by: Optional[str] = None
    created_at: datetime


class LeaveCreate(BaseModel):
    labour_id: str
    leave_type: LeaveType
    start_date: date
    end_date: date
    reason: Optional[str] = None


class LeaveBalance(BaseModel):
    labour_id: str
    sick_leave: float = 12.0  # per year
    casual_leave: float = 12.0
    earned_leave: float = 15.0
    sick_used: float = 0.0
    casual_used: float = 0.0
    earned_used: float = 0.0


# Multi-site Support
class Site(BaseModel):
    id: str
    name: str
    address: Optional[str] = None
    is_active: bool = True
    created_at: datetime


class SiteCreate(BaseModel):
    name: str
    address: Optional[str] = None


class LabourSiteAssignment(BaseModel):
    labour_id: str
    site_id: str
    assigned_date: date
    assigned_by: str


# Audit Logs
class AuditAction(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    LOGIN = "login"
    LOGOUT = "logout"
    PAYMENT = "payment"
    APPROVE = "approve"
    REJECT = "reject"


class AuditLog(BaseModel):
    id: str
    timestamp: datetime
    user: str
    action: AuditAction
    entity_type: str  # labour, attendance, salary, leave, etc.
    entity_id: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    ip_address: Optional[str] = None


# Backup
class BackupRecord(BaseModel):
    id: str
    timestamp: datetime
    filename: str
    size_bytes: int
    created_by: str


# ============== NOTIFICATIONS ==============

class NotificationType(str, Enum):
    SALARY_PAID = "salary_paid"
    LEAVE_APPROVED = "leave_approved"
    LEAVE_REJECTED = "leave_rejected"
    ADVANCE_GIVEN = "advance_given"


class Notification(BaseModel):
    id: str
    user: str               # username the notification is FOR
    labour_id: Optional[str] = None
    type: NotificationType
    title: str
    message: str
    is_read: bool = False
    created_at: datetime


class NotificationMarkRead(BaseModel):
    notification_ids: List[str]


# ============== PUSH SUBSCRIPTIONS ==============

class PushSubscription(BaseModel):
    endpoint: str
    keys: dict   # {"p256dh": "...", "auth": "..."}
    user: str
