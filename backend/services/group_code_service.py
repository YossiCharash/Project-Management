from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.repositories.group_code_repository import GroupCodeRepository
from backend.models.group_code import GroupCode
from backend.schemas.group_code import GroupCodeCreate


class GroupCodeService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.group_code_repo = GroupCodeRepository(db)

    async def create_group_code(self, group_data: GroupCodeCreate, creator_id: int) -> GroupCode:
        """Create a new group code"""
        # Create new group code
        group_code = GroupCode.create_group_code(
            name=group_data.name,
            description=group_data.description,
            created_by=creator_id
        )

        return await self.group_code_repo.create(group_code)

    async def get_group_code_by_code(self, code: str) -> GroupCode:
        """Get group code by code"""
        group_code = await self.group_code_repo.get_by_code(code)
        if not group_code:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group code not found"
            )
        return group_code

    async def list_group_codes(self, creator_id: int | None = None) -> list[GroupCode]:
        """List group codes, optionally filtered by creator"""
        if creator_id:
            return await self.group_code_repo.list_by_creator(creator_id)
        return await self.group_code_repo.list_all()

    async def update_group_code(self, group_code_id: int, group_data: GroupCodeCreate, creator_id: int) -> GroupCode:
        """Update group code (only by creator)"""
        group_code = await self.group_code_repo.get_by_code(str(group_code_id))  # This is a hack, should have get_by_id
        if not group_code:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group code not found"
            )

        if group_code.created_by != creator_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update your own group codes"
            )

        group_code.name = group_data.name
        group_code.description = group_data.description
        return await self.group_code_repo.update(group_code)

    async def delete_group_code(self, group_code_id: int, creator_id: int) -> None:
        """Delete group code (only by creator)"""
        group_code = await self.group_code_repo.get_by_code(str(group_code_id))  # This is a hack, should have get_by_id
        if not group_code:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Group code not found"
            )

        if group_code.created_by != creator_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only delete your own group codes"
            )

        await self.group_code_repo.delete(group_code)
