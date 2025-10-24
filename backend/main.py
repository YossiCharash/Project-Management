import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from backend.api.v1.router import api_router
from backend.core.config import settings
from backend.db.session import engine
from backend.db.base import Base


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

    return app

app = create_app()


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
