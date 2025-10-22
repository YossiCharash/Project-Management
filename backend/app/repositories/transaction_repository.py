from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.transaction import Transaction


class TransactionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, tx_id: int) -> Transaction | None:
        res = await self.db.execute(select(Transaction).where(Transaction.id == tx_id))
        return res.scalar_one_or_none()

    async def create(self, tx: Transaction) -> Transaction:
        self.db.add(tx)
        await self.db.commit()
        await self.db.refresh(tx)
        return tx

    async def update(self, tx: Transaction) -> Transaction:
        await self.db.commit()
        await self.db.refresh(tx)
        return tx

    async def delete(self, tx: Transaction) -> None:
        await self.db.delete(tx)
        await self.db.commit()

    async def list_by_project(self, project_id: int) -> list[Transaction]:
        res = await self.db.execute(select(Transaction).where(Transaction.project_id == project_id))
        return list(res.scalars().all())

    async def delete_by_project(self, project_id: int) -> None:
        await self.db.execute(delete(Transaction).where(Transaction.project_id == project_id))
        await self.db.commit()

    async def get_transaction_value(self, project_id: int) -> float:
        res = await self.db.execute(
            select(func.sum(Transaction.amount)).where(Transaction.project_id == project_id)
        )
        return res.scalar() or 0.0

    async def get_monthly_financial_summary(self, project_id: int, month_start: date) -> dict:
        """Get monthly financial summary for a project"""
        from sqlalchemy import and_
        
        # Income for the month
        income_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.project_id == project_id,
                Transaction.type == "Income",
                Transaction.tx_date >= month_start
            )
        )
        
        # Expenses for the month
        expense_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.project_id == project_id,
                Transaction.type == "Expense",
                Transaction.tx_date >= month_start
            )
        )
        
        income = float((await self.db.execute(income_query)).scalar_one())
        expense = float((await self.db.execute(expense_query)).scalar_one())
        
        return {
            "income": income,
            "expense": expense,
            "profit": income - expense
        }

    async def get_transactions_without_proof(self, project_id: int, month_start: date) -> int:
        """Count transactions without file attachments for a project in a given month"""
        from sqlalchemy import and_
        
        query = select(func.count(Transaction.id)).where(
            and_(
                Transaction.project_id == project_id,
                Transaction.file_path.is_(None),
                Transaction.tx_date >= month_start
            )
        )
        
        return (await self.db.execute(query)).scalar_one() or 0

    async def get_unpaid_recurring_count(self, project_id: int) -> int:
        """Count unpaid recurring expenses for a project"""
        from sqlalchemy import and_
        from datetime import date
        
        current_date = date.today()
        
        query = select(func.count(Transaction.id)).where(
            and_(
                Transaction.project_id == project_id,
                Transaction.type == "Expense",
                Transaction.is_exceptional == False,
                Transaction.tx_date < current_date,
                Transaction.file_path.is_(None)
            )
        )
        
        return (await self.db.execute(query)).scalar_one() or 0