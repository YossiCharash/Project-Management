"""
Script to add supplier_id column to transactions table
Run this from the backend directory: python migrations/add_supplier_id_to_transactions.py
"""
import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from backend.db.session import AsyncSessionLocal


async def run_migration():
    """Add supplier_id column to transactions table"""
    print("Starting migration: Add supplier_id to transactions...")
    
    async with AsyncSessionLocal() as session:
        try:
            # Check if column already exists
            check_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'transactions' 
                AND column_name = 'supplier_id'
            """)
            result = await session.execute(check_query)
            exists = result.scalar() is not None
            
            if exists:
                print("Column supplier_id already exists. Skipping migration.")
                return
            
            # Add column
            print("Adding supplier_id column...")
            await session.execute(text("""
                ALTER TABLE transactions 
                ADD COLUMN supplier_id INTEGER NULL
            """))
            
            # Create index
            print("Creating index...")
            await session.execute(text("""
                CREATE INDEX ix_transactions_supplier_id 
                ON transactions(supplier_id)
            """))
            
            # Add foreign key constraint
            print("Adding foreign key constraint...")
            await session.execute(text("""
                ALTER TABLE transactions 
                ADD CONSTRAINT transactions_supplier_id_fkey 
                FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
            """))
            
            await session.commit()
            print("✅ Migration completed successfully!")
            
        except Exception as e:
            await session.rollback()
            print(f"❌ Error running migration: {e}")
            print("\nYou can also run the SQL script manually:")
            print("psql -U your_username -d your_database -f migrations/add_supplier_id_to_transactions.sql")
            raise


if __name__ == "__main__":
    asyncio.run(run_migration())

