from datetime import datetime, date
from pydantic import BaseModel, Field


class ProjectBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    budget_monthly: float = 0
    budget_annual: float = 0
    manager_id: int | None = None
    relation_project: int | None = None

    num_residents: int | None = None
    monthly_price_per_apartment: float | None = None
    address: str | None = None
    city: str | None = None
    image_url: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    budget_monthly: float | None = None
    budget_annual: float | None = None
    manager_id: int | None = None

    num_residents: int | None = None
    monthly_price_per_apartment: float | None = None
    address: str | None = None
    city: str | None = None
    image_url: str | None = None


class ProjectOut(ProjectBase):
    id: int
    is_active: bool = True
    created_at: datetime
    total_value: float = 0.0



    class Config:
        from_attributes = True
