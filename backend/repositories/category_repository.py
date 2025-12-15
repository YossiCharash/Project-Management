from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from backend.models.category import Category


class CategoryRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list(self, include_inactive: bool = False) -> list[Category]:
        """List all categories, optionally including inactive ones"""
        query = select(Category)            
        query = query.order_by(Category.name)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get(self, category_id: int) -> Category | None:
        """Get category by ID"""
        result = await self.db.execute(select(Category).where(Category.id == category_id))
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Category | None:
        """Get category by name"""
        result = await self.db.execute(select(Category).where(Category.name == name))
        return result.scalar_one_or_none()

    async def create(self, category: Category) -> Category:
        """Create a new category"""
        self.db.add(category)
        await self.db.commit()
        await self.db.refresh(category)
        return category

    async def update(self, category: Category) -> Category:
        """Update an existing category"""
        await self.db.commit()
        await self.db.refresh(category)
        return category

    async def delete(self, category: Category) -> None:
        """Permanently delete a category"""
        await self.db.delete(category)
        await self.db.commit()

