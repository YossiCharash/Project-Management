from sqlalchemy.ext.asyncio import AsyncSession
from backend.repositories.project_repository import ProjectRepository
from backend.models.project import Project
from backend.repositories.transaction_repository import TransactionRepository
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta


def calculate_start_date(project_start_date: date | None) -> date:
    """Calculate the start date for financial calculations: max(project_start_date, 1 year ago)"""
    current_date = date.today()
    one_year_ago = current_date - relativedelta(years=1)
    
    if project_start_date:
        # Return the later date (more recent)
        return max(project_start_date, one_year_ago)
    else:
        # If no project start date, use 1 year ago
        return one_year_ago


async def calculate_recurring_transactions_amount(
    db: AsyncSession,
    project_id: int,
    start_date: date,
    end_date: date,
    transaction_type: str
) -> float:
    """Calculate the amount of recurring transactions (especially monthly) from start_date to end_date"""
    from sqlalchemy import select, and_, func
    from backend.models.recurring_transaction import RecurringTransactionTemplate
    from backend.models.transaction import Transaction
    
    # Get all active recurring transaction templates for this project and type
    templates_query = select(RecurringTransactionTemplate).where(
        and_(
            RecurringTransactionTemplate.project_id == project_id,
            RecurringTransactionTemplate.type == transaction_type,
            RecurringTransactionTemplate.is_active == True
        )
    )
    templates_result = await db.execute(templates_query)
    templates = list(templates_result.scalars().all())
    
    total_amount = 0.0
    
    for template in templates:
        # Only process monthly recurring transactions
        if template.frequency != "Monthly":
            continue
        
        # Calculate how many months from start_date to end_date
        # Start from the first occurrence on or after start_date
        template_start = max(template.start_date, start_date)
        
        # If template has an end_date, use the earlier of end_date or end_date parameter
        effective_end = end_date
        if template.end_type == "On Date" and template.end_date:
            effective_end = min(template.end_date, end_date)
        
        if template_start > effective_end:
            continue
        
        # Calculate months between template_start and effective_end
        # For monthly recurring, count how many times it should occur
        current_month = date(template_start.year, template_start.month, 1)
        end_month = date(effective_end.year, effective_end.month, 1)
        
        month_count = 0
        while current_month <= end_month:
            # Check if the day_of_month falls within the date range
            # For the first month, check if day_of_month is on or after template_start
            # For the last month, check if day_of_month is on or before effective_end
            occurrence_date = date(current_month.year, current_month.month, min(template.day_of_month, 28))
            
            # Handle months with fewer days (e.g., day 31 in February)
            try:
                occurrence_date = date(current_month.year, current_month.month, template.day_of_month)
            except ValueError:
                # If day doesn't exist in this month, use last day of month
                if current_month.month == 12:
                    next_month = date(current_month.year + 1, 1, 1)
                else:
                    next_month = date(current_month.year, current_month.month + 1, 1)
                occurrence_date = next_month - timedelta(days=1)
            
            # Check if this occurrence is within the date range
            if occurrence_date >= template_start and occurrence_date <= effective_end:
                # Check if transaction already exists (was actually generated)
                existing_query = select(func.count(Transaction.id)).where(
                    and_(
                        Transaction.project_id == project_id,
                        Transaction.recurring_template_id == template.id,
                        Transaction.tx_date == occurrence_date
                    )
                )
                existing_count = (await db.execute(existing_query)).scalar_one() or 0
                
                # If transaction exists, use its amount (might have been modified)
                if existing_count > 0:
                    tx_query = select(Transaction).where(
                        and_(
                            Transaction.project_id == project_id,
                            Transaction.recurring_template_id == template.id,
                            Transaction.tx_date == occurrence_date
                        )
                    ).limit(1)
                    tx_result = await db.execute(tx_query)
                    existing_tx = tx_result.scalar_one_or_none()
                    if existing_tx:
                        total_amount += float(existing_tx.amount)
                    else:
                        total_amount += float(template.amount)
                else:
                    # Transaction doesn't exist yet, use template amount
                    total_amount += float(template.amount)
            
            # Move to next month
            if current_month.month == 12:
                current_month = date(current_month.year + 1, 1, 1)
            else:
                current_month = date(current_month.year, current_month.month + 1, 1)
            
            month_count += 1
            # Safety check to prevent infinite loops
            if month_count > 120:  # Max 10 years
                break
    
    return total_amount


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.projects = ProjectRepository(db)
        self.transactions = TransactionRepository(db)

    async def get_value_of_projects(self, project_id: int):
        proj: Project = await self.projects.get_by_id(project_id=project_id)
        if not proj:
            return None
            
        # Get real-time financial data
        financial_data = await self.get_project_financial_data(project_id)
        
        project_data = {
            "id": proj.id,
            "name": proj.name,
            "description": proj.description,
            "start_date": proj.start_date,
            "end_date": proj.end_date,
            "budget_monthly": proj.budget_monthly,
            "budget_annual": proj.budget_annual,
            "num_residents": proj.num_residents,
            "monthly_price_per_apartment": proj.monthly_price_per_apartment,
            "address": proj.address,
            "city": proj.city,
            "relation_project": proj.relation_project,
            "is_active": proj.is_active,
            "manager_id": proj.manager_id,
            "created_at": proj.created_at,
            **financial_data
        }
        return project_data

    async def get_project_financial_data(self, project_id: int) -> dict:
        """Get real-time financial calculations for a project - from project start date or 1 year back (whichever is later)"""
        from sqlalchemy import func, select, and_
        from backend.models.transaction import Transaction
        
        # Get project to access start_date
        project = await self.projects.get_by_id(project_id)
        if not project:
            return {
                "total_value": 0,
                "income_month_to_date": 0,
                "expense_month_to_date": 0,
                "profit_percent": 0,
                "status_color": "yellow"
            }
        
        current_date = date.today()
        calculation_start_date = calculate_start_date(project.start_date)
        
        # Get actual transactions from calculation_start_date to now (exclude fund transactions)
        actual_income_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.project_id == project_id,
                Transaction.type == "Income",
                Transaction.tx_date >= calculation_start_date,
                Transaction.tx_date <= current_date,
                Transaction.from_fund == False  # Exclude fund transactions
            )
        )
        actual_expense_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.project_id == project_id,
                Transaction.type == "Expense",
                Transaction.tx_date >= calculation_start_date,
                Transaction.tx_date <= current_date,
                Transaction.from_fund == False  # Exclude fund transactions
            )
        )
        
        actual_income = float((await self.db.execute(actual_income_query)).scalar_one())
        actual_expense = float((await self.db.execute(actual_expense_query)).scalar_one())
        
        # Calculate recurring transactions (especially monthly) from start_date to now
        recurring_income = await calculate_recurring_transactions_amount(
            self.db, project_id, calculation_start_date, current_date, "Income"
        )
        recurring_expense = await calculate_recurring_transactions_amount(
            self.db, project_id, calculation_start_date, current_date, "Expense"
        )
        
        # Calculate budget income from calculation_start_date to now
        budget_income = 0.0
        budget_annual = float(project.budget_annual or 0)
        budget_monthly = float(project.budget_monthly or 0)
        
        # Prioritize monthly budget if both are set
        if budget_monthly > 0:
            # If monthly budget, calculate how many months from project start_date to now
            # Each month's budget is added on the 1st of that month
            # ALWAYS use project.start_date if available, NOT calculation_start_date
            if project.start_date:
                # Use the 1st of the project's start month
                start_month = date(project.start_date.year, project.start_date.month, 1)
                print(f"📅 Project {project_id}: Using project.start_date {project.start_date} -> start_month {start_month}")
            else:
                # If no project start date, use calculation_start_date
                start_month = date(calculation_start_date.year, calculation_start_date.month, 1)
                print(f"⚠️ Project {project_id}: No start_date, using calculation_start_date {calculation_start_date} -> start_month {start_month}")
            
            # Always include current month (since we're past the 1st of it)
            end_month = date(current_date.year, current_date.month, 1)
            print(f"📅 Project {project_id}: end_month {end_month}, current_date {current_date}")
            
            # Count months from start_month to end_month (inclusive)
            month_count = 0
            temp_month = start_month
            while temp_month <= end_month:
                month_count += 1
                print(f"  Month {month_count}: {temp_month}")
                if temp_month.month == 12:
                    temp_month = date(temp_month.year + 1, 1, 1)
                else:
                    temp_month = date(temp_month.year, temp_month.month + 1, 1)
            
            budget_income = budget_monthly * month_count
            print(f"📊 Project {project_id}: budget_monthly={budget_monthly}, month_count={month_count}, budget_income={budget_income}")
        elif budget_annual > 0:
            # If only annual budget is set (and no monthly), calculate proportionally from start_date to now
            days_in_period = (current_date - calculation_start_date).days + 1
            days_in_year = 365
            budget_income = (budget_annual / days_in_year) * days_in_period
            print(f"📊 Project {project_id}: Using ANNUAL budget calculation: {budget_annual} / {days_in_year} * {days_in_period} = {budget_income}")
        
        # Total income and expense = actual transactions + recurring transactions + budget income
        # Note: Recurring transactions that were already generated are included in actual_income/actual_expense
        # So we need to avoid double counting. The calculate_recurring_transactions_amount function
        # already handles this by checking if transactions exist.
        total_income = actual_income + recurring_income + budget_income
        total_expense = actual_expense + recurring_expense
        
        # Calculate profit and percentage
        profit = total_income - total_expense
        profit_percent = (profit / total_income * 100) if total_income > 0 else 0
        
        # Determine status color
        if profit_percent >= 10:
            status_color = "green"
        elif profit_percent <= -10:
            status_color = "red"
        else:
            status_color = "yellow"
        
        return {
            "total_value": profit,
            "income_month_to_date": total_income,  # From project start or 1 year back
            "expense_month_to_date": total_expense,  # From project start or 1 year back
            "profit_percent": round(profit_percent, 1),
            "status_color": status_color
        }

    async def calculation_of_financials(self, project_id):
        monthly_payment_tenants = float(await self.projects.get_payments_of_monthly_tenants(project_id))
        transaction_val = float(await self.transactions.get_transaction_value(project_id))
        return monthly_payment_tenants - transaction_val

    async def create(self, **data) -> Project:
        project = Project(**data)
        return await self.projects.create(project)

    async def update(self, project: Project, **data) -> Project:
        for k, v in data.items():
            if v is not None:
                setattr(project, k, v)
        return await self.projects.update(project)

    async def delete(self, project: Project) -> None:
        await self.projects.delete(project)
