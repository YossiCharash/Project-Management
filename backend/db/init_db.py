"""
Database initialization - creates all tables, enums, and indexes
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine
from backend.db.base import Base

# Import all models to ensure they are registered with Base.metadata
from backend.models import Budget  # noqa: F401


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


async def ensure_oauth_columns(engine: AsyncEngine):
    """
    Ensure OAuth and email verification columns exist in users table
    This is a migration function to add missing columns to existing tables
    """
    async with engine.begin() as conn:
        # Check if users table exists by trying to query it
        try:
            result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'oauth_provider'
            """))
            oauth_provider_exists = result.fetchone() is not None
        except Exception:
            # Table doesn't exist yet, skip migration
            return

        if not oauth_provider_exists:
            print("[DB] Adding OAuth columns to users table...")
            
            # Add oauth_provider column
            await conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50);
            """))
            
            # Add oauth_id column
            await conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255);
            """))
            
            # Add email_verified column
            await conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
            """))
            
            # Add avatar_url column
            await conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
            """))
            
            # Set default value for existing users
            await conn.execute(text("""
                UPDATE users 
                SET email_verified = FALSE 
                WHERE email_verified IS NULL;
            """))
            
            # Create indexes
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_users_oauth_provider ON users(oauth_provider);
            """))
            
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_users_oauth_id ON users(oauth_id);
            """))
            
            print("[DB] OAuth columns added successfully!")


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
    
    # Ensure OAuth columns exist (for existing databases)
    await ensure_oauth_columns(engine)
    
    print("[DB] Database initialization completed successfully!")

