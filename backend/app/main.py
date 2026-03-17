from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import asyncio
import logging
import httpx

from .models import User, UserRole
from .auth import get_password_hash
from .routers import auth, labours, attendance, salary, stats, export
from .routers import overtime, advances, leaves, sites, audit, backup, reports, notifications, push, documents
from .routers import cafe_items, cafe_stock

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
    "http://127.0.0.1:5173",
    "https://attendance-ten-rosy.vercel.app",
]
if FRONTEND_URL and FRONTEND_URL not in allowed_origins:
    allowed_origins.append(FRONTEND_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
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
app.include_router(notifications.router)
app.include_router(push.router)
app.include_router(documents.router)

# Cafe inventory routers
app.include_router(cafe_items.router)
app.include_router(cafe_stock.router)


async def keep_alive():
    """Ping self every 14 minutes to prevent Render free tier shutdown"""
    await asyncio.sleep(60)
    while True:
        try:
            render_url = os.getenv("RENDER_EXTERNAL_URL", "")
            if render_url:
                async with httpx.AsyncClient() as client:
                    await client.get(f"{render_url}/health", timeout=10)
        except Exception:
            pass
        await asyncio.sleep(14 * 60)


@app.on_event("startup")
async def startup_event():
    """Initialize database and create default admin user"""
    logger = logging.getLogger(__name__)
    
    asyncio.create_task(keep_alive())

    try:
        init_csv_files()
        print("DB INIT: Database initialized successfully", flush=True)
    except Exception as e:
        print(f"DB INIT ERROR: {e}", flush=True)
        raise

    if USE_POSTGRES:
        try:
            from .db_connection import engine
            from sqlalchemy import text
            with engine.connect() as conn:
                conn.execute(text(
                    "ALTER TABLE advances ADD COLUMN IF NOT EXISTS repaid_amount FLOAT DEFAULT 0.0"
                ))
                conn.execute(text(
                    "ALTER TABLE salary ADD COLUMN IF NOT EXISTS payment_comment VARCHAR(500)"
                ))
                conn.commit()
            print("DB MIGRATION: repaid_amount and payment_comment columns ensured", flush=True)
        except Exception as e:
            print(f"DB MIGRATION WARNING: {e}", flush=True)

    # Add cafe_price_access column to users table if it doesn't exist yet
    if USE_POSTGRES:
        try:
            from .db_connection import engine
            from sqlalchemy import text
            with engine.connect() as conn:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN IF NOT EXISTS cafe_price_access BOOLEAN DEFAULT FALSE"
                ))
                conn.commit()
            print("DB MIGRATION: cafe_price_access column ensured in users", flush=True)
        except Exception as e:
            print(f"DB MIGRATION (cafe_price_access): {e}", flush=True)
    else:
        try:
            from .db_connection import engine
            from sqlalchemy import text
            with engine.connect() as conn:
                conn.execute(text(
                    "ALTER TABLE users ADD COLUMN cafe_price_access BOOLEAN DEFAULT 0"
                ))
                conn.commit()
            print("DB MIGRATION: cafe_price_access column added to users (sqlite)", flush=True)
        except Exception as e:
            print(f"DB MIGRATION (cafe_price_access sqlite): {e}", flush=True)
    
    try:
        existing = get_user("admin")
        print(f"DB ADMIN CHECK: existing={existing}", flush=True)
        if not existing:
            admin_user = User(
                username="admin",
                role=UserRole.ADMIN,
                hashed_password=get_password_hash("admin123"),
                is_active=True
            )
            create_user(admin_user)
            print("DB ADMIN CREATED: admin / admin123", flush=True)
        else:
            print(f"DB ADMIN EXISTS: {existing.username}", flush=True)
    except Exception as e:
        print(f"DB ADMIN ERROR: {e}", flush=True)
        raise


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
