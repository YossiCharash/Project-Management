import asyncio
import asyncpg
import os

async def check_database():
    # Database connection string
    DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5432/bms"
    # Convert to asyncpg format
    asyncpg_url = DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
    
    try:
        conn = await asyncpg.connect(asyncpg_url)
        
        # Check if projects table exists and has data
        result = await conn.fetch("SELECT COUNT(*) FROM projects")
        project_count = result[0][0]
        print(f"Number of projects in database: {project_count}")
        
        # Get some project details
        if project_count > 0:
            projects = await conn.fetch("SELECT id, name, is_active FROM projects LIMIT 5")
            print("Sample projects:")
            for project in projects:
                print(f"  ID: {project['id']}, Name: {project['name']}, Active: {project['is_active']}")
        
        # Check users
        result = await conn.fetch("SELECT COUNT(*) FROM users")
        user_count = result[0][0]
        print(f"Number of users in database: {user_count}")
        
        if user_count > 0:
            users = await conn.fetch("SELECT id, email, full_name, role FROM users LIMIT 5")
            print("Sample users:")
            for user in users:
                print(f"  ID: {user['id']}, Email: {user['email']}, Name: {user['full_name']}, Role: {user['role']}")
        
        # Check transactions
        result = await conn.fetch("SELECT COUNT(*) FROM transactions")
        transaction_count = result[0][0]
        print(f"Number of transactions in database: {transaction_count}")
        
        # Check transactions table schema
        schema_result = await conn.fetch("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'transactions' 
            ORDER BY ordinal_position
        """)
        print("\nTransactions table schema:")
        for col in schema_result:
            print(f"  {col['column_name']}: {col['data_type']} (nullable: {col['is_nullable']})")
        
        await conn.close()
        
    except Exception as e:
        print(f"Error connecting to database: {e}")

if __name__ == "__main__":
    asyncio.run(check_database())
