from datetime import date, datetime
from pydantic import BaseModel, Field, field_validator
from typing import Optional, Union


class BudgetBase(BaseModel):
    category: str = Field(..., description="Expense category (e.g., 'חשמל', 'ניקיון')")
    amount: float = Field(..., gt=0, description="Total budget amount")
    period_type: str = Field(default="Annual", description="'Annual' or 'Monthly'")
    start_date: date = Field(..., description="When budget period starts")
    end_date: Optional[date] = Field(None, description="When budget period ends (for annual budgets)")


class BudgetCreate(BudgetBase):
    project_id: int


class BudgetCreateWithoutProject(BudgetBase):
    """Budget creation without project_id - used when creating budgets as part of project creation"""
    pass


class BudgetUpdate(BaseModel):
    category: Optional[str] = None
    amount: Optional[float] = Field(None, gt=0)
    period_type: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_active: Optional[bool] = None


class BudgetOut(BudgetBase):
    id: int
    project_id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BudgetWithSpending(BudgetOut):
    """Budget with calculated spending information"""
    base_amount: float = 0.0
    spent_amount: float = 0.0
    expense_amount: float = 0.0
    income_amount: float = 0.0
    remaining_amount: float = 0.0
    spent_percentage: float = 0.0
    expected_spent_percentage: float = 0.0  # Based on time elapsed
    is_over_budget: bool = False
    is_spending_too_fast: bool = False  # Spending faster than time elapsed

