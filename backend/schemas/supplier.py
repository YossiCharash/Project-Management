from datetime import datetime
from pydantic import BaseModel, Field, EmailStr


class SupplierBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contact_email: EmailStr | None = None
    phone: str | None = None
    annual_budget: float | None = None
    category: str | None = None


class SupplierCreate(SupplierBase):
    # For creation, category is mandatory
    category: str


class SupplierUpdate(BaseModel):
    name: str | None = None
    contact_email: EmailStr | None = None
    phone: str | None = None
    annual_budget: float | None = None
    category: str | None = None


class SupplierOut(SupplierBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
