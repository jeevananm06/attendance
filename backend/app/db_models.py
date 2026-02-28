"""
SQLAlchemy Database Models for Labour Attendance Management System
"""

from sqlalchemy import Column, String, Float, Boolean, Date, DateTime, Enum, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, date
import enum

Base = declarative_base()


class UserRoleEnum(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    LABOUR = "labour"


class AttendanceStatusEnum(str, enum.Enum):
    PRESENT = "present"
    ABSENT = "absent"
    HALF_DAY = "half_day"


class LeaveTypeEnum(str, enum.Enum):
    CASUAL = "casual"
    SICK = "sick"
    UNPAID = "unpaid"


class LeaveStatusEnum(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class UserDB(Base):
    __tablename__ = "users"
    
    username = Column(String(100), primary_key=True, index=True)
    role = Column(String(20), default="manager")
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class LabourDB(Base):
    __tablename__ = "labours"
    
    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(20), nullable=True)
    daily_wage = Column(Float, nullable=False)
    joined_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True)
    pay_cycle = Column(String(10), default="weekly")  # "weekly" or "monthly"
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    attendances = relationship("AttendanceDB", back_populates="labour")
    salaries = relationship("SalaryDB", back_populates="labour")
    overtimes = relationship("OvertimeDB", back_populates="labour")
    advances = relationship("AdvanceDB", back_populates="labour")
    leaves = relationship("LeaveDB", back_populates="labour")


class AttendanceDB(Base):
    __tablename__ = "attendance"
    
    id = Column(String(36), primary_key=True, index=True)
    labour_id = Column(String(36), ForeignKey("labours.id"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String(20), default="present")
    comment = Column(String(500), nullable=True)
    marked_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    labour = relationship("LabourDB", back_populates="attendances")


class SalaryDB(Base):
    __tablename__ = "salary"
    
    id = Column(String(36), primary_key=True, index=True)
    labour_id = Column(String(36), ForeignKey("labours.id"), nullable=False)
    week_start = Column(Date, nullable=False)
    week_end = Column(Date, nullable=False)
    days_present = Column(Float, default=0.0)
    daily_wage = Column(Float, nullable=False)
    total_amount = Column(Float, default=0.0)
    paid_amount = Column(Float, default=0.0)  # Tracks partial payments
    is_paid = Column(Boolean, default=False)
    paid_date = Column(Date, nullable=True)
    paid_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    labour = relationship("LabourDB", back_populates="salaries")


class OvertimeDB(Base):
    __tablename__ = "overtime"
    
    id = Column(String(36), primary_key=True, index=True)
    labour_id = Column(String(36), ForeignKey("labours.id"), nullable=False)
    date = Column(Date, nullable=False)
    hours = Column(Float, nullable=False)
    rate_multiplier = Column(Float, default=1.5)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    labour = relationship("LabourDB", back_populates="overtimes")


class AdvanceDB(Base):
    __tablename__ = "advances"
    
    id = Column(String(36), primary_key=True, index=True)
    labour_id = Column(String(36), ForeignKey("labours.id"), nullable=False)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)
    is_deducted = Column(Boolean, default=False)
    repaid_amount = Column(Float, default=0.0)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    labour = relationship("LabourDB", back_populates="advances")


class LeaveDB(Base):
    __tablename__ = "leaves"
    
    id = Column(String(36), primary_key=True, index=True)
    labour_id = Column(String(36), ForeignKey("labours.id"), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    leave_type = Column(String(20), default="casual")
    reason = Column(Text, nullable=True)
    status = Column(String(20), default="pending")
    approved_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    labour = relationship("LabourDB", back_populates="leaves")


class SiteDB(Base):
    __tablename__ = "sites"
    
    id = Column(String(36), primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    address = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class SiteAssignmentDB(Base):
    __tablename__ = "site_assignments"
    
    id = Column(String(36), primary_key=True, index=True)
    labour_id = Column(String(36), ForeignKey("labours.id"), nullable=False)
    site_id = Column(String(36), ForeignKey("sites.id"), nullable=False)
    assigned_date = Column(Date, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuditLogDB(Base):
    __tablename__ = "audit_logs"
    
    id = Column(String(36), primary_key=True, index=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(String(36), nullable=True)
    user = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)


class BackupDB(Base):
    __tablename__ = "backups"

    id = Column(String(36), primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class NotificationDB(Base):
    __tablename__ = "notifications"

    id = Column(String(36), primary_key=True, index=True)
    user = Column(String(100), nullable=False, index=True)  # recipient username
    labour_id = Column(String(36), nullable=True)
    type = Column(String(30), nullable=False)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class PushSubscriptionDB(Base):
    __tablename__ = "push_subscriptions"

    id = Column(String(36), primary_key=True, index=True)
    user = Column(String(100), nullable=False, index=True)
    endpoint = Column(Text, nullable=False, unique=True)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
