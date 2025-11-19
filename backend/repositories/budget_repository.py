from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
from typing import Tuple
from backend.models.budget import Budget
from backend.models.transaction import Transaction


class BudgetRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, budget_id: int) -> Budget | None:
        res = await self.db.execute(select(Budget).where(Budget.id == budget_id))
        return res.scalar_one_or_none()

    async def create(self, budget: Budget) -> Budget:
        self.db.add(budget)
        await self.db.commit()
        await self.db.refresh(budget)
        return budget

    async def update(self, budget: Budget) -> Budget:
        await self.db.commit()
        await self.db.refresh(budget)
        return budget

    async def delete(self, budget: Budget) -> None:
        await self.db.delete(budget)
        await self.db.commit()

    async def list_by_project(self, project_id: int, active_only: bool = True) -> list[Budget]:
        stmt = select(Budget).where(Budget.project_id == project_id)
        if active_only:
            stmt = stmt.where(Budget.is_active == True)  # noqa: E712
        res = await self.db.execute(stmt.order_by(Budget.start_date.desc()))
        return list(res.scalars().all())

    async def get_by_project_and_category(
        self, 
        project_id: int, 
        category: str, 
        active_only: bool = True
    ) -> Budget | None:
        stmt = select(Budget).where(
            and_(
                Budget.project_id == project_id,
                Budget.category == category
            )
        )
        if active_only:
            stmt = stmt.where(Budget.is_active == True)  # noqa: E712
        res = await self.db.execute(stmt)
        return res.scalar_one_or_none()

    async def get_active_budgets_for_project(self, project_id: int) -> list[Budget]:
        """Get all active budgets for a project"""
        return await self.list_by_project(project_id, active_only=True)

    async def calculate_spending_for_budget(
        self, 
        budget: Budget, 
        as_of_date: date | None = None
    ) -> Tuple[float, float]:
        """Calculate spending breakdown for a budget's category within the budget period.
        Returns (total_expenses, total_income).
        """
        if as_of_date is None:
            as_of_date = date.today()
        
        # Determine the date range for the budget
        start_date = budget.start_date
        end_date = budget.end_date if budget.end_date else as_of_date
        
        # Calculate expenses for transactions in this category within the period
        expenses_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.project_id == budget.project_id,
                Transaction.type == "Expense",
                Transaction.category == budget.category,
                Transaction.tx_date >= start_date,
                Transaction.tx_date <= end_date,
                Transaction.from_fund == False  # Exclude fund transactions
            )
        )
        
        # Calculate income for transactions in this category within the period
        income_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.project_id == budget.project_id,
                Transaction.type == "Income",
                Transaction.category == budget.category,
                Transaction.tx_date >= start_date,
                Transaction.tx_date <= end_date,
                Transaction.from_fund == False  # Exclude fund transactions
            )
        )
        
        expenses_result = await self.db.execute(expenses_query)
        income_result = await self.db.execute(income_query)
        
        total_expenses = float(expenses_result.scalar_one())
        total_income = float(income_result.scalar_one())
        
        return total_expenses, total_income

