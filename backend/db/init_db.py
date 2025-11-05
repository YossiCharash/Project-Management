"""
Database initialization - creates all tables, enums, and indexes
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine
from backend.db.base import Base


async def create_enums(engine: AsyncEngine):
    """Create PostgreSQL enums if they don't exist"""
    async with engine.begin() as conn:
        # Create expense_category enum
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE expense_category AS ENUM ('ניקיון', 'חשמל', 'ביטוח', 'גינון', 'אחר');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        
        # Create recurring_frequency enum
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE recurring_frequency AS ENUM ('Monthly');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))
        
        # Create recurring_end_type enum
        await conn.execute(text("""
            DO $$ BEGIN
                CREATE TYPE recurring_end_type AS ENUM ('No End', 'After Occurrences', 'On Date');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        """))


async def init_database(engine: AsyncEngine):
    """
    Initialize database - create all tables, enums, and indexes
    This should be called on application startup
    """
    # First, create enums
    print("[DB] Creating enums...")
    await create_enums(engine)
    
    # Then, create all tables (this will also create indexes and foreign keys)
    print("[DB] Creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    print("[DB] Database initialization completed successfully!")

