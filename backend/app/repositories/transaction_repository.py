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
