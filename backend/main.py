import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.openapi.utils import get_openapi
import re
import os
import asyncio
from datetime import date

# Import all models to ensure Base.metadata is populated
# This import ensures all models are registered before create_all is called
from backend.models import (  # noqa: F401
    User, Project, Subproject, Transaction, AuditLog,
    Supplier, SupplierDocument, AdminInvite, EmailVerification,
    RecurringTransactionTemplate, MemberInvite
)
# Also import base_models to ensure all models are loaded
from backend.db import base_models  # noqa: F401

from backend.api.v1.router import api_router
from backend.core.config import settings
from backend.db.session import engine
from backend.db.base import Base
from backend.db.init_db import init_database


def create_app() -> FastAPI:
    tags_metadata = [
        {"name": "auth", "description": "אימות משתמשים והנפקת טוקנים"},
        {"name": "users", "description": "ניהול משתמשים והרשאות"},
        {"name": "projects", "description": "ניהול פרויקטים ותקציבים"},
        {"name": "transactions", "description": "תיעוד הכנסות/הוצאות והעלאות קבצים"},
        {"name": "reports", "description": "דוחות רווחיות והשוואה לתקציב"},
    ]

    app = FastAPI(
        title="BMS Backend",
        version="1.0.0",
        description="מערכת ניהול תקציב לבנייה (BMS) עם FastAPI",
        openapi_url="/openapi.json",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_tags=tags_metadata,
        redirect_slashes=False,  # Disable automatic 307 redirects between /route and /route/
    )

    @app.middleware("http")
    async def resolve_trailing_slash(request, call_next):
        """
        Ensure routes defined with a trailing slash still work without it,
        without issuing an HTTP redirect (prevents 307 -> HTTP/port 10000).
        """
        path = request.scope.get("path", "")
        if path and not path.endswith("/"):
            alt_path = f"{path}/"
            available_paths = {
                getattr(route, "path", None)
                for route in app.router.routes
                if getattr(route, "path", None)
            }
            if alt_path in available_paths:
                request.scope["path"] = alt_path
        response = await call_next(request)
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    @app.on_event("startup")
    async def on_startup() -> None:
        # Initialize database - creates all tables, enums, indexes, and foreign keys
        await init_database(engine)

        # Create super admin from environment variables
        from backend.core.seed import create_super_admin
        await create_super_admin()
        
        # Start background task for recurring transactions
        asyncio.create_task(run_recurring_transactions_scheduler())

    def custom_openapi():
        if app.openapi_schema:
            return app.openapi_schema
        openapi_schema = get_openapi(
            title=app.title,
            version=app.version,
            description=app.description,
            routes=app.routes,
        )
        openapi_schema.setdefault("components", {}).setdefault("securitySchemes", {}).update({
            "bearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            }
        })
        openapi_schema["security"] = [{"bearerAuth": []}]
        app.openapi_schema = openapi_schema
        return app.openapi_schema

    app.openapi = custom_openapi  # type: ignore[assignment]

    app.include_router(api_router, prefix=settings.API_V1_STR)

    # Mount static files for uploads (images, documents, etc.)
    # Get absolute path to uploads directory
    # If FILE_UPLOAD_DIR is relative, resolve it relative to backend directory
    if os.path.isabs(settings.FILE_UPLOAD_DIR):
        uploads_dir = settings.FILE_UPLOAD_DIR
    else:
        # Get the directory where this file (main.py) is located
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        uploads_dir = os.path.abspath(os.path.join(backend_dir, settings.FILE_UPLOAD_DIR))
    
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Create subdirectories
    projects_dir = os.path.join(uploads_dir, 'projects')
    suppliers_dir = os.path.join(uploads_dir, 'suppliers')
    os.makedirs(projects_dir, exist_ok=True)
    os.makedirs(suppliers_dir, exist_ok=True)
    # Note: Supplier-specific subdirectories will be created automatically when needed
    
    # Mount static files - this allows serving files from /uploads/{path}
    # Note: StaticFiles will serve files relative to the directory provided
    # So /uploads/suppliers/file.txt will look for {uploads_dir}/suppliers/file.txt
    try:
        app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")
    except Exception as e:
        raise

    @app.get("/health")
    async def health_check():
        return {"status": "healthy", "message": "Project Management System is running"}

    return app


async def run_recurring_transactions_scheduler():
    """
    Background task that runs daily to generate recurring transactions.
    Checks every day if there are any recurring templates that need to generate transactions.
    Runs immediately on startup, then every 24 hours.
    """
    from backend.db.session import AsyncSessionLocal
    from backend.services.recurring_transaction_service import RecurringTransactionService
    
    # Run immediately on startup
    first_run = True
    
    while True:
        try:
            if not first_run:
                # Wait 24 hours before next run
                await asyncio.sleep(60 * 60 * 24)
            else:
                first_run = False
                # Wait 5 seconds after startup to let the app fully initialize
                await asyncio.sleep(5)
            
            # Get today's date
            today = date.today()
            
            # Create a new database session for this task
            async with AsyncSessionLocal() as db:
                try:
                    service = RecurringTransactionService(db)
                    # Generate transactions for today
                    transactions = await service.generate_transactions_for_date(today)
                    
                    if transactions:
                        print(f"✅ Generated {len(transactions)} recurring transactions for {today}")
                    else:
                        print(f"ℹ️  No recurring transactions to generate for {today}")
                except Exception as e:
                    print(f"❌ Error generating recurring transactions: {e}")
                    import traceback
                    traceback.print_exc()
                finally:
                    await db.close()
        except Exception as e:
            print(f"❌ Error in recurring transactions scheduler: {e}")
            import traceback
            traceback.print_exc()
            # Wait a bit before retrying
            await asyncio.sleep(60 * 60)  # Wait 1 hour before retrying


app = create_app()

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)