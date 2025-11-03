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
        from backend.models.recurring_transaction import RecurringEndType
        
        # Debug: First check all active templates
        all_active = await self.db.execute(
            select(RecurringTransactionTemplate).where(RecurringTransactionTemplate.is_active == True)
        )
        all_templates = list(all_active.scalars().all())
        print(f"[DEBUG] get_templates_to_generate for {target_date}: Found {len(all_templates)} active templates")
        
        for t in all_templates:
            # Get end_type as string for comparison
            end_type_str = t.end_type.value if hasattr(t.end_type, 'value') else str(t.end_type)
            print(f"[DEBUG] Template {t.id}: day_of_month={t.day_of_month}, start_date={t.start_date}, target_day={target_date.day}, day_matches={t.day_of_month == target_date.day}, start_ok={t.start_date <= target_date}, end_type={end_type_str}")
        
        # Use Enum values for comparison - SQLAlchemy will handle the conversion
        res = await self.db.execute(
            select(RecurringTransactionTemplate).where(
                and_(
                    RecurringTransactionTemplate.is_active == True,
                    RecurringTransactionTemplate.day_of_month == target_date.day,
                    RecurringTransactionTemplate.start_date <= target_date,
                    or_(
                        RecurringTransactionTemplate.end_type == RecurringEndType.NO_END,
                        and_(
                            RecurringTransactionTemplate.end_type == RecurringEndType.ON_DATE,
                            RecurringTransactionTemplate.end_date >= target_date,
                        ),
                        and_(
                            RecurringTransactionTemplate.end_type == RecurringEndType.AFTER_OCCURRENCES,
                            True,  # Placeholder - occurrence count check handled at service level
                        ),
                    ),
                )
            )
        )
        matching_templates = list(res.scalars().all())
        print(f"[DEBUG] Templates matching date {target_date}: {len(matching_templates)}")
        return matching_templates
