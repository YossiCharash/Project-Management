from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Literal


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    role: Literal["Admin", "ProjectManager", "Viewer"] = "Viewer"
    is_active: bool = True


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    role: Literal["Admin", "ProjectManager", "Viewer"] | None = None
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserOut(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True
