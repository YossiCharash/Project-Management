from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class GroupCodeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=500)


class GroupCodeOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    created_by: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class GroupCodeList(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
