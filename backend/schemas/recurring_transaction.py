from __future__ import annotations

from datetime import date, datetime
from pydantic import BaseModel, Field
from typing import Literal, Optional


class RecurringTransactionTemplateBase(BaseModel):
    project_id: int
    description: str
    type: Literal["Income", "Expense"]
    amount: float
    category: Optional[str] = None
    notes: Optional[str] = None
    frequency: Literal["Monthly"] = "Monthly"
    day_of_month: int = Field(ge=1, le=31)
    start_date: date
    end_type: Literal["No End", "After Occurrences", "On Date"] = "No End"
    end_date: Optional[date] = None
    max_occurrences: Optional[int] = Field(None, ge=1)


class RecurringTransactionTemplateCreate(RecurringTransactionTemplateBase):
    pass


class RecurringTransactionTemplateUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    start_date: Optional[date] = None
    end_type: Optional[Literal["No End", "After Occurrences", "On Date"]] = None
    end_date: Optional[date] = None
    max_occurrences: Optional[int] = Field(None, ge=1)
    is_active: Optional[bool] = None


class RecurringTransactionTemplateOut(RecurringTransactionTemplateBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RecurringTransactionTemplateWithTransactions(RecurringTransactionTemplateOut):
    generated_transactions: list["TransactionOut"] = []

    class Config:
        from_attributes = True


class RecurringTransactionInstanceUpdate(BaseModel):
    """For updating individual instances of recurring transactions"""
    tx_date: Optional[date] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    notes: Optional[str] = None


# Import TransactionOut for model_rebuild
from backend.schemas.transaction import TransactionOut

# Rebuild models to resolve forward references
RecurringTransactionTemplateWithTransactions.model_rebuild()