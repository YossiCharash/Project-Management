from __future__ import annotations
from datetime import datetime
from sqlalchemy import String, Date, DateTime, ForeignKey, Numeric, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, default=None)
    start_date: Mapped[datetime | None] = mapped_column(Date, default=None)
    end_date: Mapped[datetime | None] = mapped_column(Date, default=None)

    budget_monthly: Mapped[float] = mapped_column(Numeric(12, 2), default=0)
    budget_annual: Mapped[float] = mapped_column(Numeric(14, 2), default=0)

    manager_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), index=True)
    owner: Mapped["User | None"] = relationship(back_populates="projects")

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="project", cascade="all, delete-orphan")

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
