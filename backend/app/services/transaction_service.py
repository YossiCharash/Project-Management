import os
from uuid import uuid4
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import settings
from backend.app.repositories.transaction_repository import TransactionRepository
from backend.app.models.transaction import Transaction


class TransactionService:
    def __init__(self, db: AsyncSession):
        self.transactions = TransactionRepository(db)
        os.makedirs(settings.FILE_UPLOAD_DIR, exist_ok=True)

    async def create(self, **data) -> Transaction:
        tx = Transaction(**data)
        return await self.transactions.create(tx)

    async def attach_file(self, tx: Transaction, file: UploadFile | None) -> Transaction:
        if not file:
            return tx
        ext = os.path.splitext(file.filename or "")[1]
        filename = f"{uuid4().hex}{ext}"
        path = os.path.join(settings.FILE_UPLOAD_DIR, filename)
        content = await file.read()
        with open(path, "wb") as f:
            f.write(content)
        tx.file_path = path
        return await self.transactions.update(tx)
