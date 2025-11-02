from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import and_, or_, select
from datetime import date, datetime

from backend.models.recurring_transaction import RecurringTransactionTemplate
from backend.schemas.recurring_transaction import RecurringTransactionTemplateCreate, RecurringTransactionTemplateUpdate


class RecurringTransactionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: RecurringTransactionTemplateCreate) -> RecurringTransactionTemplate:
        """Create a new recurring transaction template"""
        template = RecurringTransactionTemplate(**data.model_dump())
        self.db.add(template)
        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def get_by_id(self, template_id: int) -> Optional[RecurringTransactionTemplate]:
        """Get a recurring transaction template by ID"""
        res = await self.db.execute(
            select(RecurringTransactionTemplate).where(RecurringTransactionTemplate.id == template_id)
        )
        return res.scalar_one_or_none()

    async def list_by_project(self, project_id: int) -> List[RecurringTransactionTemplate]:
        """List all recurring transaction templates for a project"""
        res = await self.db.execute(
            select(RecurringTransactionTemplate)
            .where(RecurringTransactionTemplate.project_id == project_id)
            .order_by(RecurringTransactionTemplate.created_at.desc())
        )
        return list(res.scalars().all())

    async def list_active_templates(self) -> List[RecurringTransactionTemplate]:
        """List all active recurring transaction templates"""
        res = await self.db.execute(
            select(RecurringTransactionTemplate).where(RecurringTransactionTemplate.is_active == True)
        )
        return list(res.scalars().all())

    async def update(self, template: RecurringTransactionTemplate, data: RecurringTransactionTemplateUpdate) -> RecurringTransactionTemplate:
        """Update a recurring transaction template"""
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(template, field, value)
        
        template.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def delete(self, template: RecurringTransactionTemplate) -> bool:
        """Delete a recurring transaction template"""
        self.db.delete(template)
        await self.db.commit()
        return True

    async def deactivate(self, template: RecurringTransactionTemplate) -> RecurringTransactionTemplate:
        """Deactivate a recurring transaction template"""
        template.is_active = False
        template.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(template)
        return template

    async def get_templates_to_generate(self, target_date: date) -> List[RecurringTransactionTemplate]:
        """Get templates that should generate transactions for a given date"""
        res = await self.db.execute(
            select(RecurringTransactionTemplate).where(
                and_(
                    RecurringTransactionTemplate.is_active == True,
                    RecurringTransactionTemplate.day_of_month == target_date.day,
                    RecurringTransactionTemplate.start_date <= target_date,
                    or_(
                        RecurringTransactionTemplate.end_type == "No End",
                        and_(
                            RecurringTransactionTemplate.end_type == "On Date",
                            RecurringTransactionTemplate.end_date >= target_date,
                        ),
                        and_(
                            RecurringTransactionTemplate.end_type == "After Occurrences",
                            True,  # Placeholder - occurrence count check handled at service level
                        ),
                    ),
                )
            )
        )
        return list(res.scalars().all())
