from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.transaction import Transaction


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
