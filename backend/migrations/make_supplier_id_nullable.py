"""
Migration script to make supplier_id nullable in supplier_documents table.
This allows documents to be linked to transactions without a supplier.
Run this from the backend directory: python migrations/make_supplier_id_nullable.py
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from backend.db.session import AsyncSessionLocal


async def run_migration():
    """Make supplier_id nullable in supplier_documents table"""
    print("Starting migration: Make supplier_id nullable in supplier_documents...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if column is already nullable
            check_query = text("""
                SELECT is_nullable 
                FROM information_schema.columns 
                WHERE table_name = 'supplier_documents' 
                AND column_name = 'supplier_id'
            """)
            result = await session.execute(check_query)
            row = result.fetchone()
            
            if row and row[0] == 'YES':
                print("✓ supplier_id is already nullable. No migration needed.")
                return
            
            # Make supplier_id nullable
            alter_query = text("""
                ALTER TABLE supplier_documents 
                ALTER COLUMN supplier_id DROP NOT NULL
            """)
            
            await session.execute(alter_query)
            await session.commit()
            
            print("✓ Migration completed successfully!")
            print("  supplier_id is now nullable in supplier_documents table")
            
        except Exception as e:
            await session.rollback()
            print(f"✗ Migration failed: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(run_migration())

