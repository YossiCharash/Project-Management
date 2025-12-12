from __future__ import annotations
from typing import List
import os
from uuid import uuid4
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date

from backend.core.config import settings
from backend.repositories.transaction_repository import TransactionRepository
from backend.models.transaction import Transaction
from backend.services.s3_service import S3Service
from backend.repositories.category_repository import CategoryRepository


class TransactionService:
    def __init__(self, db: AsyncSession):
        self.transactions = TransactionRepository(db)
        self.category_repository = CategoryRepository(db)
        self.db = db  # Store db reference for duplicate checking
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

    async def check_duplicate_transaction(
        self,
        project_id: int,
        tx_date: date,
        amount: float,
        supplier_id: int | None = None,
        type: str = "Expense"
    ) -> List[Transaction]:
        """Check for duplicate transactions with same date, amount, and optionally supplier"""
        from sqlalchemy import select, and_
        
        query = select(Transaction).where(
            and_(
                Transaction.project_id == project_id,
                Transaction.tx_date == tx_date,
                Transaction.amount == amount,
                Transaction.type == type
            )
        )
        
        # If supplier is provided, also match by supplier
        if supplier_id is not None:
            query = query.where(Transaction.supplier_id == supplier_id)
        
        result = await self.transactions.db.execute(query)
        return list(result.scalars().all())

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
        
        # Check for duplicate transactions (for invoice payments)
        if data.get('type') == 'Expense' and not from_fund:
            duplicates = await self.check_duplicate_transaction(
                project_id=data['project_id'],
                tx_date=data['tx_date'],
                amount=data['amount'],
                supplier_id=data.get('supplier_id'),
                type='Expense'
            )
            if duplicates:
                # Format duplicate details for error message
                duplicate_details = []
                for dup in duplicates:
                    dup_info = f"עסקה #{dup.id} מתאריך {dup.tx_date}"
                    if dup.supplier_id:
                        from backend.repositories.supplier_repository import SupplierRepository
                        supplier_repo = SupplierRepository(self.transactions.db)
                        supplier = await supplier_repo.get(dup.supplier_id)
                        if supplier:
                            dup_info += f" לספק {supplier.name}"
                    duplicate_details.append(dup_info)
                
                raise ValueError(
                    f"⚠️ זוהתה עסקה כפולה!\n\n"
                    f"קיימת עסקה עם אותם פרטים:\n" + "\n".join(duplicate_details) + "\n\n"
                    f"אם זה תשלום שונה, אנא שנה את התאריך או הסכום.\n"
                    f"אם זה אותו תשלום, אנא בדוק את הרשומות הקיימות."
                )
        
        # Create transaction
        tx = Transaction(**data)
        return await self.transactions.create(tx)

    async def attach_file(self, tx: Transaction, file: UploadFile | None) -> Transaction:
        if not file:
            return tx

        # Upload to S3 instead of local filesystem
        import asyncio
        from backend.services.s3_service import S3Service

        # Reset file pointer to beginning
        await file.seek(0)
        
        s3 = S3Service()
        
        # Use run_in_executor/to_thread to avoid blocking event loop with boto3
        # Pass file.file which is the underlying binary file object
        file_url = await asyncio.to_thread(
            s3.upload_file,
            prefix="transactions",
            file_obj=file.file,
            filename=file.filename or "transaction-file",
            content_type=file.content_type,
        )
        # Store full URL
        tx.file_path = file_url
        return await self.transactions.update(tx)
