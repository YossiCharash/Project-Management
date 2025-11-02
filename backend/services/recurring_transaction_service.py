from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta

from backend.models.recurring_transaction import RecurringTransactionTemplate
from backend.models.transaction import Transaction, TransactionType
from backend.repositories.recurring_transaction_repository import RecurringTransactionRepository
from backend.repositories.transaction_repository import TransactionRepository
from backend.schemas.recurring_transaction import (
    RecurringTransactionTemplateCreate, 
    RecurringTransactionTemplateUpdate,
    RecurringTransactionInstanceUpdate
)


class RecurringTransactionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.recurring_repo = RecurringTransactionRepository(db)
        self.transaction_repo = TransactionRepository(db)

    async def create_template(self, data: RecurringTransactionTemplateCreate) -> RecurringTransactionTemplate:
        """Create a new recurring transaction template"""
        return await self.recurring_repo.create(data)

    async def get_template(self, template_id: int) -> Optional[RecurringTransactionTemplate]:
        """Get a recurring transaction template by ID"""
        return await self.recurring_repo.get_by_id(template_id)

    async def list_templates_by_project(self, project_id: int) -> List[RecurringTransactionTemplate]:
        """List all recurring transaction templates for a project"""
        return await self.recurring_repo.list_by_project(project_id)

    async def update_template(self, template_id: int, data: RecurringTransactionTemplateUpdate) -> Optional[RecurringTransactionTemplate]:
        """Update a recurring transaction template"""
        template = await self.recurring_repo.get_by_id(template_id)
        if not template:
            return None
        
        return await self.recurring_repo.update(template, data)

    async def delete_template(self, template_id: int) -> bool:
        """Delete a recurring transaction template"""
        template = await self.recurring_repo.get_by_id(template_id)
        if not template:
            return False
        
        return await self.recurring_repo.delete(template)

    async def deactivate_template(self, template_id: int) -> Optional[RecurringTransactionTemplate]:
        """Deactivate a recurring transaction template"""
        template = await self.recurring_repo.get_by_id(template_id)
        if not template:
            return None
        
        return await self.recurring_repo.deactivate(template)

    async def generate_transactions_for_date(self, target_date: date) -> List[Transaction]:
        """Generate transactions for a specific date based on active templates"""
        templates = await self.recurring_repo.get_templates_to_generate(target_date)
        generated_transactions = []

        for template in templates:
            # Check if transaction already exists for this template and date
            res = await self.db.execute(
                select(Transaction).where(
                    Transaction.recurring_template_id == template.id,
                    Transaction.tx_date == target_date,
                )
            )
            existing_transaction = res.scalar_one_or_none()

            if existing_transaction:
                continue  # Skip if already generated

            # Create new transaction
            transaction_data = {
                "project_id": template.project_id,
                "recurring_template_id": template.id,
                "tx_date": target_date,
                "type": template.type,
                "amount": template.amount,
                "description": template.description,
                "category": template.category,
                "notes": template.notes,
                "is_generated": True
            }

            transaction = Transaction(**transaction_data)
            self.db.add(transaction)
            generated_transactions.append(transaction)

        await self.db.commit()
        for tx in generated_transactions:
            await self.db.refresh(tx)
        return generated_transactions

    async def generate_transactions_for_month(self, year: int, month: int) -> List[Transaction]:
        """Generate all transactions for a specific month"""
        generated_transactions = []
        
        # Get the number of days in the month
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        
        last_day = (next_month - timedelta(days=1)).day
        
        # Generate transactions for each day of the month
        for day in range(1, last_day + 1):
            target_date = date(year, month, day)
            day_transactions = await self.generate_transactions_for_date(target_date)
            generated_transactions.extend(day_transactions)
        
        return generated_transactions

    async def get_template_transactions(self, template_id: int) -> List[Transaction]:
        """Get all transactions generated from a specific template"""
        res = await self.db.execute(
            select(Transaction)
            .where(Transaction.recurring_template_id == template_id)
            .order_by(Transaction.tx_date.desc())
        )
        return list(res.scalars().all())

    async def update_transaction_instance(self, transaction_id: int, data: RecurringTransactionInstanceUpdate) -> Optional[Transaction]:
        """Update a specific instance of a recurring transaction"""
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction or not transaction.recurring_template_id:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(transaction, field, value)
        
        return await self.transaction_repo.update(transaction)

    async def delete_transaction_instance(self, transaction_id: int) -> bool:
        """Delete a specific instance of a recurring transaction"""
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction or not transaction.recurring_template_id:
            return False
        
        return await self.transaction_repo.delete(transaction)

    async def get_future_occurrences(self, template_id: int, start_date: date, months_ahead: int = 12) -> List[dict]:
        """Get future occurrences of a recurring transaction template"""
        template = await self.recurring_repo.get_by_id(template_id)
        if not template:
            return []

        occurrences = []
        current_date = start_date
        
        for i in range(months_ahead):
            # Calculate the next occurrence date
            if current_date.day > template.day_of_month:
                # Move to next month
                next_month = current_date + relativedelta(months=1)
                occurrence_date = date(next_month.year, next_month.month, template.day_of_month)
            else:
                # Use current month
                occurrence_date = date(current_date.year, current_date.month, template.day_of_month)
            
            # Check if this occurrence should be generated based on end conditions
            should_generate = True
            
            if template.end_type == "On Date" and template.end_date and occurrence_date > template.end_date:
                should_generate = False
            elif template.end_type == "After Occurrences" and template.max_occurrences:
                # Count existing transactions for this template
                res = await self.db.execute(
                    select(func.count(Transaction.id)).where(
                        Transaction.recurring_template_id == template_id
                    )
                )
                existing_count = res.scalar_one() or 0
                if existing_count >= template.max_occurrences:
                    should_generate = False
            
            if should_generate:
                occurrences.append({
                    "date": occurrence_date,
                    "amount": template.amount,
                    "description": template.description,
                    "category": template.category
                })
            
            current_date = occurrence_date + relativedelta(months=1)
        
        return occurrences
