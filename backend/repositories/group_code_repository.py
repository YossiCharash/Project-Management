from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.models.group_code import GroupCode


class GroupCodeRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_code(self, code: str) -> GroupCode | None:
        """Get group code by code"""
        res = await self.db.execute(select(GroupCode).where(GroupCode.code == code))
        return res.scalar_one_or_none()

    async def create(self, group_code: GroupCode) -> GroupCode:
        """Create new group code"""
        self.db.add(group_code)
        await self.db.commit()
        await self.db.refresh(group_code)
        return group_code

    async def update(self, group_code: GroupCode) -> GroupCode:
        """Update group code"""
        await self.db.commit()
        await self.db.refresh(group_code)
        return group_code

    async def list_by_creator(self, creator_id: int) -> list[GroupCode]:
        """List group codes created by specific user"""
        res = await self.db.execute(select(GroupCode).where(GroupCode.created_by == creator_id))
        return list(res.scalars().all())

    async def list_all(self) -> list[GroupCode]:
        """List all group codes"""
        res = await self.db.execute(select(GroupCode))
        return list(res.scalars().all())

    async def delete(self, group_code: GroupCode) -> None:
        """Delete group code"""
        await self.db.delete(group_code)
        await self.db.commit()
