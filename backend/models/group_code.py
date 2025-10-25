from __future__ import annotations
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
import secrets
import string

from backend.db.base import Base


class GroupCode(Base):
    __tablename__ = "group_codes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(8), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(String(500), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    # Relationships
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])

    @classmethod
    def generate_code(cls) -> str:
        """Generate a secure random group code"""
        return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))

    @classmethod
    def create_group_code(cls, name: str, description: str, created_by: int) -> "GroupCode":
        """Create a new group code"""
        code = cls.generate_code()
        
        return cls(
            code=code,
            name=name,
            description=description,
            created_by=created_by
        )
