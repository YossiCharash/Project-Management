from datetime import date, datetime
from pydantic import BaseModel, Field
from typing import Literal


class TransactionBase(BaseModel):
    project_id: int
    tx_date: date
    type: Literal["Income", "Expense"]
    amount: float = Field(ge=0)
    description: str | None = None


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    tx_date: date | None = None
    type: Literal["Income", "Expense"] | None = None
    amount: float | None = Field(default=None, ge=0)
    description: str | None = None


class TransactionOut(TransactionBase):
    id: int
    file_path: str | None
    created_at: datetime

    class Config:
        from_attributes = True
