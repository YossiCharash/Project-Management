import os
from uuid import uuid4
from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.config import settings
from backend.repositories.transaction_repository import TransactionRepository
from backend.models.transaction import Transaction, ExpenseCategory


class TransactionService:
    def __init__(self, db: AsyncSession):
        self.transactions = TransactionRepository(db)
        os.makedirs(settings.FILE_UPLOAD_DIR, exist_ok=True)

    def _normalize_category(self, category: str | None) -> str | None:
        """
        Convert category from Enum member name (e.g., 'CLEANING') to Enum value (e.g., 'ניקיון')
        This handles cases where the frontend or API sends the Enum member name instead of the value
        """
        if not category:
            return None
        
        # If it's already a valid Enum value (Hebrew), return it
        valid_values = {e.value for e in ExpenseCategory}
        if category in valid_values:
            return category
        
        # Try to convert from Enum member name to value
        category_mapping = {
            'CLEANING': ExpenseCategory.CLEANING.value,
            'ELECTRICITY': ExpenseCategory.ELECTRICITY.value,
            'INSURANCE': ExpenseCategory.INSURANCE.value,
            'GARDENING': ExpenseCategory.GARDENING.value,
            'OTHER': ExpenseCategory.OTHER.value,
        }
        
        # Convert to uppercase for case-insensitive matching
        category_upper = category.upper()
        if category_upper in category_mapping:
            return category_mapping[category_upper]
        
        # If no match, return original (will fail validation if invalid)
        return category

    async def create(self, **data) -> Transaction:
        # Normalize category before creating transaction
        if 'category' in data:
            original_category = data['category']
            data['category'] = self._normalize_category(data['category'])
            # Debug: verify normalization worked
            if original_category != data['category']:
                print(f"DEBUG: Normalized category from '{original_category}' to '{data['category']}'")
        # Create transaction - the @validates decorator will also normalize if needed
        tx = Transaction(**data)
        # Double-check category is normalized after object creation
        if hasattr(tx, 'category') and tx.category:
            normalized = self._normalize_category(tx.category)
            if normalized != tx.category:
                tx.category = normalized
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
