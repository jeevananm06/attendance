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


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None


class Labour(BaseModel):
    id: str
    name: str
    phone: Optional[str] = None
    daily_wage: float
    joined_date: date
    is_active: bool = True


class LabourCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    daily_wage: float
    joined_date: Optional[date] = None


class LabourUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    daily_wage: Optional[float] = None
    is_active: Optional[bool] = None
    joined_date: Optional[date] = None  # Admin only


class AttendanceStatus(str, Enum):
    PRESENT = "present"
    ABSENT = "absent"
    HALF_DAY = "half_day"


class Attendance(BaseModel):
    id: str
    labour_id: str
    date: date
    status: AttendanceStatus
    marked_by: str
    marked_at: datetime


class AttendanceCreate(BaseModel):
    labour_id: str
    date: date
    status: AttendanceStatus


class AttendanceBulkCreate(BaseModel):
    date: date
    records: List[dict]  # [{labour_id: str, status: AttendanceStatus}]


class SalaryRecord(BaseModel):
    id: str
    labour_id: str
    week_start: date
    week_end: date
    days_present: float
    daily_wage: float
    total_amount: float
    is_paid: bool = False
    paid_date: Optional[date] = None
    paid_by: Optional[str] = None


class SalaryPayment(BaseModel):
    labour_id: str
    week_end: date  # Friday of the week


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
