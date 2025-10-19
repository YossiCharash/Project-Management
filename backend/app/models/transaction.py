from __future__ import annotations
from datetime import datetime, date
from enum import Enum
from sqlalchemy import String, Date, DateTime, ForeignKey, Numeric, Text, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base


class TransactionType(str, Enum):
    INCOME = "Income"
    EXPENSE = "Expense"


class ExpenseCategory(str, Enum):
    CLEANING = "cleaning"
    ELECTRICITY = "electricity"
    INSURANCE = "insurance"
    GARDENING = "gardening"
    OTHER = "other"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), index=True)
    project: Mapped["Project"] = relationship(back_populates="transactions")

    subproject_id: Mapped[int | None] = mapped_column(ForeignKey("subprojects.id"), index=True, nullable=True)

    tx_date: Mapped[date] = mapped_column(Date, index=True)
    type: Mapped[str] = mapped_column(String(20), index=True, default=TransactionType.EXPENSE.value)
    amount: Mapped[float] = mapped_column(Numeric(14, 2))
    description: Mapped[str | None] = mapped_column(Text, default=None)

    category: Mapped[str | None] = mapped_column(SAEnum(ExpenseCategory, name="expense_category", create_constraint=True, native_enum=True), default=ExpenseCategory.OTHER.value, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, default=None)
    is_exceptional: Mapped[bool] = mapped_column(Boolean, default=False, index=True)

    file_path: Mapped[str | None] = mapped_column(String(500), default=None)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow) # לדוגמה, חישוב מתוך שדות קיימים
