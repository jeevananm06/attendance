from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .models import User, UserRole
from .auth import get_password_hash
from .routers import auth, labours, attendance, salary, stats, export
from .routers import overtime, advances, leaves, sites, audit, backup, reports

# Use PostgreSQL if enabled, otherwise CSV
USE_POSTGRES = os.getenv("USE_POSTGRES", "false").lower() == "true"

if USE_POSTGRES:
    from .db_operations import init_db_tables as init_csv_files, create_user, get_user
else:
    from .database import init_csv_files, create_user, get_user

app = FastAPI(
    title="Labour Attendance Management System",
    description="API for managing labour attendance and salary in small organizations",
    version="1.0.0"
)

# CORS middleware for React frontend
FRONTEND_URL = os.getenv("FRONTEND_URL", "")
allowed_origins = [
    "http://localhost:3000", 
    "http://localhost:5173", 
    "http://127.0.0.1:3000", 
    "http://127.0.0.1:5173"
]
if FRONTEND_URL:
    allowed_origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(labours.router)
app.include_router(attendance.router)
app.include_router(salary.router)
app.include_router(stats.router)
app.include_router(export.router)

# New feature routers
app.include_router(overtime.router)
app.include_router(advances.router)
app.include_router(leaves.router)
app.include_router(sites.router)
app.include_router(audit.router)
app.include_router(backup.router)
app.include_router(reports.router)


@app.on_event("startup")
async def startup_event():
    """Initialize database and create default admin user"""
    init_csv_files()
    
    # Create default admin user if not exists
    if not get_user("admin"):
        admin_user = User(
            username="admin",
            role=UserRole.ADMIN,
            hashed_password=get_password_hash("admin123")
        )
        create_user(admin_user)
        print("Default admin user created: admin / admin123")


@app.get("/")
async def root():
    return {
        "message": "Labour Attendance Management System API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
