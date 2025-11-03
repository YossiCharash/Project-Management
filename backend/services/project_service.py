from sqlalchemy.ext.asyncio import AsyncSession
from backend.repositories.project_repository import ProjectRepository
from backend.models.project import Project
from backend.repositories.transaction_repository import TransactionRepository


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
        """Get real-time financial calculations for a project - by year"""
        from sqlalchemy import func, select, and_
        from datetime import date
        from backend.models.transaction import Transaction
        
        current_date = date.today()
        current_year_start = current_date.replace(month=1, day=1)
        
        # Get current year's income and expenses
        yearly_income_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.project_id == project_id,
                Transaction.type == "Income",
                Transaction.tx_date >= current_year_start
            )
        )
        yearly_expense_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.project_id == project_id,
                Transaction.type == "Expense",
                Transaction.tx_date >= current_year_start
            )
        )
        
        yearly_income = float((await self.db.execute(yearly_income_query)).scalar_one())
        yearly_expense = float((await self.db.execute(yearly_expense_query)).scalar_one())
        
        # Calculate profit and percentage
        profit = yearly_income - yearly_expense
        profit_percent = (profit / yearly_income * 100) if yearly_income > 0 else 0
        
        # Determine status color
        if profit_percent >= 10:
            status_color = "green"
        elif profit_percent <= -10:
            status_color = "red"
        else:
            status_color = "yellow"
        
        return {
            "total_value": profit,
            "income_month_to_date": yearly_income,  # Calculated by year, keeping field name for frontend compatibility
            "expense_month_to_date": yearly_expense,  # Calculated by year, keeping field name for frontend compatibility
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
