from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import engine
from app.db.base import Base
import app.db.base_models  # ensure models are imported


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
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def on_startup() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Inject global Bearer auth into OpenAPI so Swagger has an Authorize button
    def customize_openapi():
        if app.openapi_schema:
            return app.openapi_schema
        openapi_schema = app.openapi()
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

    app.openapi = customize_openapi  # type: ignore[assignment]

    app.include_router(api_router, prefix=settings.API_V1_STR)

    return app


app = create_app()
