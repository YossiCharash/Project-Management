import os
from uuid import uuid4
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.repositories.transaction_repository import TransactionRepository
from backend.models.transaction import Transaction
from backend.services.s3_service import S3Service
from backend.repositories.category_repository import CategoryRepository


class TransactionService:
    def __init__(self, db: AsyncSession):
        self.transactions = TransactionRepository(db)
        self.category_repository = CategoryRepository(db)
        # Keep local directory for backward compatibility (old files)
        os.makedirs(settings.FILE_UPLOAD_DIR, exist_ok=True)

    async def _resolve_category(
        self,
        *,
        category_id: int | None = None,
        allow_missing: bool = False
    ):
        if category_id is not None:
            category = await self.category_repository.get(category_id)
            if not category and not allow_missing:
                raise ValueError("קטגוריה שנבחרה לא קיימת יותר במערכת.")
        else:
            category = None

        if category and not category.is_active:
            raise ValueError(f"קטגוריה '{category.name}' לא פעילה. יש להפעיל את הקטגוריה בהגדרות לפני יצירת העסקה.")

        return category

    async def create(self, **data) -> Transaction:
        # Validate category if provided (unless it's a cash register transaction)
        from_fund = data.get('from_fund', False)
        category_id = data.get('category_id')
        
        resolved_category = None
        if category_id is not None:
            resolved_category = await self._resolve_category(
                category_id=category_id,
                allow_missing=from_fund
            )
        elif not from_fund and data.get('type') == 'Expense':
            raise ValueError("קטגוריה היא שדה חובה לעסקאות הוצאה. יש לבחור קטגוריה מהרשימה או לסמן 'הוריד מהקופה'.")
        
        data['category_id'] = resolved_category.id if resolved_category else None
        
        # Create transaction
        tx = Transaction(**data)
        return await self.transactions.create(tx)

    async def attach_file(self, tx: Transaction, file: UploadFile | None) -> Transaction:
        if not file:
            return tx

        # Upload to S3 instead of local filesystem
        from io import BytesIO

        content = await file.read()
        file_obj = BytesIO(content)
        s3 = S3Service()
        file_url = s3.upload_file(
            prefix="transactions",
            file_obj=file_obj,
            filename=file.filename or "transaction-file",
            content_type=file.content_type,
        )
        # Store full URL
        tx.file_path = file_url
        return await self.transactions.update(tx)
