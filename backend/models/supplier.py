from __future__ import annotations
from datetime import datetime
from sqlalchemy import String, DateTime, Boolean, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), default=None)
    phone: Mapped[str | None] = mapped_column(String(50), default=None)
    # Optional logical category for this supplier (e.g. 'ניקיון', 'חשמל')
    category: Mapped[str | None] = mapped_column(String(255), default=None, index=True)
    annual_budget: Mapped[float | None] = mapped_column(Numeric(14, 2), default=None)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    documents: Mapped[list["SupplierDocument"]] = relationship(back_populates="supplier", cascade="all, delete-orphan")
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="supplier", lazy="selectin")
