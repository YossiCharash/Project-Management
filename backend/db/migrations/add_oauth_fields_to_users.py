"""
Migration: Add OAuth and email verification fields to users table
Run this script to add the missing columns: oauth_provider, oauth_id, email_verified, avatar_url
"""
import asyncio
from sqlalchemy import text
from backend.db.session import engine


async def add_oauth_fields():
    """Add OAuth and email verification fields to users table"""
    async with engine.begin() as conn:
        print("[Migration] Adding oauth_provider column...")
        await conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50);
        """))
        
        print("[Migration] Adding oauth_id column...")
        await conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255);
        """))
        
        print("[Migration] Adding email_verified column...")
        await conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
        """))
        
        print("[Migration] Adding avatar_url column...")
        await conn.execute(text("""
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);
        """))
        
        # Set default value for existing users
        print("[Migration] Setting default values for existing users...")
        await conn.execute(text("""
            UPDATE users 
            SET email_verified = FALSE 
            WHERE email_verified IS NULL;
        """))
        
        # Create indexes
        print("[Migration] Creating indexes...")
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_users_oauth_provider ON users(oauth_provider);
        """))
        
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_users_oauth_id ON users(oauth_id);
        """))
        
        print("[Migration] Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(add_oauth_fields())
