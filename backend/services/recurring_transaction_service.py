from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
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
        
        # Debug logging
        if len(templates) > 0:
            print(f"[DEBUG] Found {len(templates)} templates for date {target_date}")

        for template in templates:
            try:
                # Check if transaction already exists for this template and date
                # Always use raw SQL to check for existing transactions to avoid AttributeError
                existing_transaction = None
                from sqlalchemy import text
                try:
                    check_query = text("""
                        SELECT id FROM transactions 
                        WHERE recurring_template_id = :template_id 
                        AND tx_date = :target_date
                        LIMIT 1
                    """)
                    check_result = await self.db.execute(check_query, {
                        "template_id": template.id,
                        "target_date": target_date
                    })
                    existing_row = check_result.fetchone()
                    if existing_row:
                        # Get full transaction object using id only
                        tx_query = select(Transaction).where(Transaction.id == existing_row[0])
                        tx_res = await self.db.execute(tx_query)
                        existing_transaction = tx_res.scalar_one_or_none()
                except Exception as sql_error:
                    # If raw SQL fails, the column might not exist in DB - skip the check
                    print(f"[WARNING] Could not check for existing transaction (column may not exist): {str(sql_error)}")
                    existing_transaction = None

                if existing_transaction:
                    print(f"[DEBUG] Transaction already exists for template {template.id} on {target_date}")
                    continue  # Skip if already generated

                # Check end conditions
                end_type_str = template.end_type.value if hasattr(template.end_type, 'value') else str(template.end_type)
                should_create = True
                
                if end_type_str == "On Date" and template.end_date and target_date > template.end_date:
                    should_create = False
                    print(f"[DEBUG] Template {template.id} skipped: end_date {template.end_date} < target_date {target_date}")
                
                if not should_create:
                    continue

                # Create new transaction
                # Handle category - it might be an Enum or string
                category_value = template.category
                if category_value and hasattr(category_value, 'value'):
                    category_value = category_value.value
                
                transaction_data = {
                    "project_id": template.project_id,
                    "recurring_template_id": template.id,
                    "tx_date": target_date,
                    "type": template.type,
                    "amount": template.amount,
                    "description": template.description,
                    "category": category_value,
                    "notes": template.notes,
                    "supplier_id": template.supplier_id,
                    "is_generated": True
                }

                print(f"[DEBUG] Creating transaction for template {template.id}: {transaction_data}")
                try:
                    # Try to create transaction - handle missing columns gracefully
                    transaction = Transaction(**transaction_data)
                    self.db.add(transaction)
                    generated_transactions.append(transaction)
                    print(f"[DEBUG] Created transaction: {transaction.description} - {transaction.amount} on {transaction.tx_date}")
                except Exception as create_error:
                    print(f"[ERROR] Failed to create Transaction object: {str(create_error)}")
                    # Try without recurring fields if they cause issues
                    try:
                        transaction_data_fallback = {k: v for k, v in transaction_data.items() 
                                                   if k not in ['recurring_template_id', 'is_generated']}
                        transaction = Transaction(**transaction_data_fallback)
                        # Manually set fields if they exist
                        if hasattr(transaction, 'recurring_template_id'):
                            transaction.recurring_template_id = transaction_data.get('recurring_template_id')
                        if hasattr(transaction, 'is_generated'):
                            transaction.is_generated = transaction_data.get('is_generated', False)
                        self.db.add(transaction)
                        generated_transactions.append(transaction)
                        print(f"[DEBUG] Created transaction with fallback method")
                    except Exception as fallback_error:
                        print(f"[ERROR] Fallback also failed: {str(fallback_error)}")
                        raise
            except Exception as e:
                import traceback
                print(f"[ERROR] Failed to create transaction for template {template.id}: {str(e)}")
                print(f"[ERROR] Traceback: {traceback.format_exc()}")
                raise

        if generated_transactions:
            await self.db.commit()
            for tx in generated_transactions:
                await self.db.refresh(tx)
        return generated_transactions

    async def generate_transactions_for_month(self, year: int, month: int) -> List[Transaction]:
        """Generate all transactions for a specific month"""
        generated_transactions = []
        
        # First, get all active templates to understand what we're working with
        from sqlalchemy import select
        all_active = await self.db.execute(
            select(RecurringTransactionTemplate).where(RecurringTransactionTemplate.is_active == True)
        )
        all_templates = list(all_active.scalars().all())
        print(f"[DEBUG] Total active templates: {len(all_templates)}")
        
        for t in all_templates:
            print(f"[DEBUG] Template {t.id}: project_id={t.project_id}, day_of_month={t.day_of_month}, start_date={t.start_date}, end_type={t.end_type}, description={t.description}")
        
        # Get the number of days in the month
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        
        last_day = (next_month - timedelta(days=1)).day
        
        print(f"[DEBUG] Generating transactions for {year}-{month:02d} (days 1-{last_day})")
        
        # Generate transactions for each day of the month
        # Also handle cases where day_of_month > last_day (e.g., template for day 31 in February)
        for day in range(1, last_day + 1):
            target_date = date(year, month, day)
            day_transactions = await self.generate_transactions_for_date(target_date)
            generated_transactions.extend(day_transactions)
        
        # Handle templates with day_of_month > last_day (e.g., day 31 in months with 30 days)
        # These should generate on the last day of the month
        for template in all_templates:
            if template.day_of_month > last_day:
                # Generate on last day of month
                target_date = date(year, month, last_day)
                # Check if transaction already exists - use raw SQL to avoid AttributeError
                existing = None
                from sqlalchemy import text
                try:
                    check_query = text("""
                        SELECT id FROM transactions 
                        WHERE recurring_template_id = :template_id 
                        AND tx_date = :target_date
                        LIMIT 1
                    """)
                    check_result = await self.db.execute(check_query, {
                        "template_id": template.id,
                        "target_date": target_date
                    })
                    existing_row = check_result.fetchone()
                    if existing_row:
                        tx_query = select(Transaction).where(Transaction.id == existing_row[0])
                        tx_res = await self.db.execute(tx_query)
                        existing = tx_res.scalar_one_or_none()
                except Exception as sql_error:
                    # If raw SQL fails, the column might not exist in DB - skip the check
                    print(f"[WARNING] Could not check for existing transaction (column may not exist): {str(sql_error)}")
                    existing = None
                
                if not existing and template.start_date <= target_date:
                    # Check end conditions
                    should_create = True
                    # Get end_type as string for comparison
                    end_type_str = template.end_type.value if hasattr(template.end_type, 'value') else str(template.end_type)
                    if end_type_str == "On Date" and template.end_date and target_date > template.end_date:
                        should_create = False
                    
                    if should_create:
                        # Handle category - it might be an Enum or string
                        category_value = template.category
                        if category_value and hasattr(category_value, 'value'):
                            category_value = category_value.value
                        
                        transaction_data = {
                            "project_id": template.project_id,
                            "recurring_template_id": template.id,
                            "tx_date": target_date,
                            "type": template.type,
                            "amount": template.amount,
                            "description": template.description,
                            "category": category_value,
                            "notes": template.notes,
                            "supplier_id": template.supplier_id,
                            "is_generated": True
                        }
                        try:
                            transaction = Transaction(**transaction_data)
                            self.db.add(transaction)
                            generated_transactions.append(transaction)
                            print(f"[DEBUG] Created transaction for day {template.day_of_month} on last day {last_day}: {transaction.description}")
                        except Exception as create_error:
                            print(f"[ERROR] Failed to create Transaction for template {template.id}: {str(create_error)}")
                            # Try without recurring fields
                            try:
                                transaction_data_fallback = {k: v for k, v in transaction_data.items() 
                                                           if k not in ['recurring_template_id', 'is_generated']}
                                transaction = Transaction(**transaction_data_fallback)
                                if hasattr(transaction, 'recurring_template_id'):
                                    transaction.recurring_template_id = transaction_data.get('recurring_template_id')
                                if hasattr(transaction, 'is_generated'):
                                    transaction.is_generated = True
                                self.db.add(transaction)
                                generated_transactions.append(transaction)
                                print(f"[DEBUG] Created transaction with fallback method")
                            except Exception as fallback_error:
                                print(f"[ERROR] Fallback also failed: {str(fallback_error)}")
                                # Don't raise - continue with next template
                                continue
        
        if generated_transactions:
            await self.db.commit()
            for tx in generated_transactions:
                await self.db.refresh(tx)
        
        print(f"[DEBUG] Total generated: {len(generated_transactions)} transactions")
        return generated_transactions

    async def get_template_transactions(self, template_id: int) -> List[Transaction]:
        """Get all transactions generated from a specific template"""
        # Use raw SQL to avoid AttributeError if column doesn't exist in model
        from sqlalchemy import text
        try:
            # First try with raw SQL to get IDs
            query = text("""
                SELECT id FROM transactions 
                WHERE recurring_template_id = :template_id 
                ORDER BY tx_date DESC
            """)
            result = await self.db.execute(query, {"template_id": template_id})
            tx_ids = [row[0] for row in result.fetchall()]
            
            if not tx_ids:
                return []
            
            # Get full Transaction objects
            res = await self.db.execute(
                select(Transaction).where(Transaction.id.in_(tx_ids)).order_by(Transaction.tx_date.desc())
            )
            return list(res.scalars().all())
        except Exception as e:
            # Fallback: try without recurring_template_id filter
            print(f"[WARNING] Could not query by recurring_template_id: {str(e)}")
            return []

    async def update_transaction_instance(self, transaction_id: int, data: RecurringTransactionInstanceUpdate) -> Optional[Transaction]:
        """Update a specific instance of a recurring transaction"""
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction:
            return None
        # Check if it's a recurring transaction using raw SQL
        from sqlalchemy import text
        try:
            check_query = text("SELECT recurring_template_id FROM transactions WHERE id = :tx_id")
            check_result = await self.db.execute(check_query, {"tx_id": transaction_id})
            recurring_id = check_result.scalar()
            if not recurring_id:
                return None
        except Exception:
            # If column doesn't exist or error, use getattr as fallback
            if not getattr(transaction, 'recurring_template_id', None):
                return None
        
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(transaction, field, value)
        
        return await self.transaction_repo.update(transaction)

    async def delete_transaction_instance(self, transaction_id: int) -> bool:
        """Delete a specific instance of a recurring transaction"""
        transaction = await self.transaction_repo.get_by_id(transaction_id)
        if not transaction:
            return False
        # Check if it's a recurring transaction using raw SQL
        from sqlalchemy import text
        try:
            check_query = text("SELECT recurring_template_id FROM transactions WHERE id = :tx_id")
            check_result = await self.db.execute(check_query, {"tx_id": transaction_id})
            recurring_id = check_result.scalar()
            if not recurring_id:
                return False
        except Exception:
            # If column doesn't exist or error, use getattr as fallback
            if not getattr(transaction, 'recurring_template_id', None):
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
                # Count existing transactions for this template using raw SQL
                from sqlalchemy import text
                try:
                    count_query = text("""
                        SELECT COUNT(*) FROM transactions 
                        WHERE recurring_template_id = :template_id
                    """)
                    count_result = await self.db.execute(count_query, {"template_id": template_id})
                    existing_count = count_result.scalar() or 0
                except Exception:
                    existing_count = 0
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
