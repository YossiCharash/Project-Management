from functools import lru_cache
from pydantic import BaseModel, Field
import os
from dotenv import load_dotenv

# Load environment variables from a .env file if present
load_dotenv()


class Settings(BaseModel):
    API_V1_STR: str = "/api/v1"
    SQLALCHEMY_DATABASE_URI: str = Field(
        default=os.getenv(
            "DATABASE_URL",
            "postgresql+asyncpg://postgres:postgres@localhost:5432/bms",
        )
    )
    JWT_SECRET_KEY: str = Field(default=os.getenv("JWT_SECRET_KEY", "change_me"))
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173/,http://127.0.0.1:5173,http://localhost:3000,http://localhost:5176"
    ).split(",")

    FILE_UPLOAD_DIR: str = os.getenv("FILE_UPLOAD_DIR", "./uploads")
    
    # Super Admin Configuration
    SUPER_ADMIN_EMAIL: str = Field(default=os.getenv("SUPER_ADMIN_EMAIL", "c0548508540@gmail.com"))
    SUPER_ADMIN_PASSWORD: str = Field(default=os.getenv("SUPER_ADMIN_PASSWORD", "c98C98@98"))
    SUPER_ADMIN_NAME: str = Field(default=os.getenv("SUPER_ADMIN_NAME", "Super Administrator"))

    class Config:
        arbitrary_types_allowed = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
