from datetime import date, datetime
from pydantic import BaseModel, Field
from typing import Literal


class TransactionBase(BaseModel):
    project_id: int
    tx_date: date
    type: Literal["Income", "Expense"]
    amount: float
    description: str | None = None
    category: str | None = None
    notes: str | None = None
    is_exceptional: bool = False


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    tx_date: date | None = None
    type: Literal["Income", "Expense"] | None = None
    amount: float | None = None
    description: str | None = None
    category: str | None = None
    notes: str | None = None
    is_exceptional: bool | None = None


class TransactionOut(BaseModel):
    id: int
    project_id: int
    tx_date: date
    type: Literal["Income", "Expense"]
    amount: float  # No validation constraint for response
    description: str | None = None
    category: str | None = None
    notes: str | None = None
    is_exceptional: bool = False
    file_path: str | None
    created_at: datetime

    class Config:
        from_attributes = True
