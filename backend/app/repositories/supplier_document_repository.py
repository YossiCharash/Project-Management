from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.supplier_document import SupplierDocument


class SupplierDocumentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, doc: SupplierDocument) -> SupplierDocument:
        self.db.add(doc)
        await self.db.commit()
        await self.db.refresh(doc)
        return doc

    async def list_by_supplier(self, supplier_id: int) -> list[SupplierDocument]:
        res = await self.db.execute(select(SupplierDocument).where(SupplierDocument.supplier_id == supplier_id))
        return list(res.scalars().all())
