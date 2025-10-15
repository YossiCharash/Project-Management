from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.audit_log import AuditLog


class AuditRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, log: AuditLog) -> AuditLog:
        self.db.add(log)
        await self.db.commit()
        await self.db.refresh(log)
        return log

    async def list(self, limit: int = 100) -> list[AuditLog]:
        res = await self.db.execute(select(AuditLog).order_by(AuditLog.id.desc()).limit(limit))
        return list(res.scalars().all())
