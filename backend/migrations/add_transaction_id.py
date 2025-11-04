"""
Script to add transaction_id column to supplier_documents table
Run this from the backend directory: python migrations/add_transaction_id.py
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from backend.db.session import AsyncSessionLocal
from backend.core.config import settings


async def run_migration():
    """Add transaction_id column to supplier_documents table"""
    print("Starting migration: Add transaction_id to supplier_documents...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if column already exists
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'supplier_documents' 
                AND column_name = 'transaction_id'
            """)
            result = await session.execute(check_query)
            exists = result.scalar() is not None
            
            if exists:
                print("Column transaction_id already exists. Skipping migration.")
                return
            
            # Add column
            print("Adding transaction_id column...")
            await session.execute(text("""
                ALTER TABLE supplier_documents 
                ADD COLUMN transaction_id INTEGER NULL
            """))
            
            # Create index
            print("Creating index...")
            await session.execute(text("""
                CREATE INDEX ix_supplier_documents_transaction_id 
                ON supplier_documents(transaction_id)
            """))
            
            # Add foreign key constraint
            print("Adding foreign key constraint...")
            await session.execute(text("""
                ALTER TABLE supplier_documents 
                ADD CONSTRAINT supplier_documents_transaction_id_fkey 
                FOREIGN KEY (transaction_id) REFERENCES transactions(id)
            """))
            
            await session.commit()
            print("✅ Migration completed successfully!")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error running migration: {e}")
            print("\nYou can also run the SQL script manually:")
            print("psql -U your_username -d your_database -f migrations/add_transaction_id_to_supplier_documents.sql")
            raise


if __name__ == "__main__":
    asyncio.run(run_migration())

