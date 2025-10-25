from datetime import datetime
from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class EmailVerificationRequest(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=255)
    verification_type: str = Field(pattern="^(admin_register|member_register)$")
    group_code: Optional[str] = None  # Only for member_register


class EmailVerificationConfirm(BaseModel):
    email: EmailStr
    verification_code: str = Field(min_length=6, max_length=6)
    password: str = Field(min_length=8, max_length=128)


class EmailVerificationOut(BaseModel):
    id: int
    email: str
    verification_type: str
    is_verified: bool
    verified_at: Optional[datetime] = None
    expires_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class EmailVerificationStatus(BaseModel):
    email: str
    verification_sent: bool
    message: str
