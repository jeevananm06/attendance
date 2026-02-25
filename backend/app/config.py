import os
from pathlib import Path

# Base directory for data storage
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)

# CSV file paths
USERS_FILE = DATA_DIR / "users.csv"
LABOURS_FILE = DATA_DIR / "labours.csv"
ATTENDANCE_FILE = DATA_DIR / "attendance.csv"
SALARY_FILE = DATA_DIR / "salary.csv"

# New feature CSV files
OVERTIME_FILE = DATA_DIR / "overtime.csv"
ADVANCES_FILE = DATA_DIR / "advances.csv"
LEAVES_FILE = DATA_DIR / "leaves.csv"
LEAVE_BALANCE_FILE = DATA_DIR / "leave_balance.csv"
SITES_FILE = DATA_DIR / "sites.csv"
SITE_ASSIGNMENTS_FILE = DATA_DIR / "site_assignments.csv"
AUDIT_LOG_FILE = DATA_DIR / "audit_log.csv"
BACKUPS_FILE = DATA_DIR / "backups.csv"

# Backup directory
BACKUP_DIR = BASE_DIR / "backups"
BACKUP_DIR.mkdir(exist_ok=True)

# JWT Settings
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production-123456789")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 480  # 8 hours
