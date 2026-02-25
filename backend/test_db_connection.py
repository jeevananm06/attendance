"""Test database connection"""
from dotenv import load_dotenv
import os

load_dotenv()

print("USE_POSTGRES:", os.getenv("USE_POSTGRES"))
print("DATABASE_URL set:", bool(os.getenv("DATABASE_URL")))

if os.getenv("USE_POSTGRES") == "true" and os.getenv("DATABASE_URL"):
    print("\nTesting PostgreSQL connection...")
    try:
        from sqlalchemy import text
        from app.db_connection import engine, init_db
        
        # Test connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            print("✓ Connection successful!")
        
        # Create tables
        init_db()
        print("✓ Tables created!")
        
    except Exception as e:
        print(f"✗ Connection failed: {e}")
else:
    print("\nPostgreSQL not enabled. Update .env file with:")
    print("  USE_POSTGRES=true")
    print("  DATABASE_URL=postgresql://...")
