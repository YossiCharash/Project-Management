from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
import os
import re
from uuid import uuid4

from backend.core.deps import DBSessionDep, require_roles, get_current_user, require_admin
from backend.core.config import settings
from backend.repositories.transaction_repository import TransactionRepository
from backend.repositories.project_repository import ProjectRepository
from backend.repositories.supplier_repository import SupplierRepository
from backend.repositories.supplier_document_repository import SupplierDocumentRepository
from backend.models.supplier_document import SupplierDocument
from backend.schemas.transaction import TransactionCreate, TransactionOut, TransactionUpdate
from backend.services.transaction_service import TransactionService
from backend.models.user import UserRole

router = APIRouter()


def sanitize_filename(name: str) -> str:
    """Sanitize supplier name to be used as directory name"""
    # Remove or replace invalid characters for Windows/Linux file paths
    sanitized = re.sub(r'[<>:"/\\|?*]', '_', name)
    # Remove leading/trailing spaces and dots
    sanitized = sanitized.strip(' .')
    # Replace multiple spaces/underscores with single underscore
    sanitized = re.sub(r'[\s_]+', '_', sanitized)
    # If empty after sanitization, use a default
    if not sanitized:
        sanitized = 'supplier'
    return sanitized


def get_uploads_dir() -> str:
    """Get absolute path to uploads directory, resolving relative paths relative to backend directory"""
    if os.path.isabs(settings.FILE_UPLOAD_DIR):
        return settings.FILE_UPLOAD_DIR
    else:
        # Get the directory where this file is located, then go up to backend directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Go from api/v1/endpoints to backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
        return os.path.abspath(os.path.join(backend_dir, settings.FILE_UPLOAD_DIR))


@router.get("/project/{project_id}", response_model=list[TransactionOut])
async def list_transactions(project_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """List transactions for a project - accessible to all authenticated users"""
    return await TransactionRepository(db).list_by_project(project_id)


@router.post("/", response_model=TransactionOut)
async def create_transaction(db: DBSessionDep, data: TransactionCreate, user = Depends(get_current_user)):
    """Create transaction - accessible to all authenticated users"""
    project = await ProjectRepository(db).get_by_id(data.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate supplier if provided
    if data.supplier_id is not None:
        supplier = await SupplierRepository(db).get(data.supplier_id)
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        if not supplier.is_active:
            raise HTTPException(status_code=400, detail="Cannot create transaction with inactive supplier")
    
    return await TransactionService(db).create(**data.model_dump())


@router.post("/{tx_id}/upload", response_model=TransactionOut)
async def upload_receipt(tx_id: int, db: DBSessionDep, file: UploadFile = File(...), user = Depends(get_current_user)):
    """Upload receipt for transaction - accessible to all authenticated users"""
    tx = await TransactionRepository(db).get_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return await TransactionService(db).attach_file(tx, file)


@router.get("/{tx_id}/documents", response_model=list[dict])
async def get_transaction_documents(tx_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """Get all documents for a transaction - accessible to all authenticated users"""
    from sqlalchemy import select, and_
    
    tx = await TransactionRepository(db).get_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Get all documents for this transaction
    docs_query = select(SupplierDocument).where(SupplierDocument.transaction_id == tx_id)
    docs_result = await db.execute(docs_query)
    docs = docs_result.scalars().all()
    
    uploads_dir = get_uploads_dir()
    result = []
    
    for doc in docs:
        # Get relative path from uploads directory
        if os.path.isabs(doc.file_path):
            rel_path = os.path.relpath(doc.file_path, uploads_dir).replace('\\', '/')
        else:
            rel_path = doc.file_path.replace('\\', '/').lstrip('./')
        
        result.append({
            "id": doc.id,
            "supplier_id": doc.supplier_id,
            "transaction_id": doc.transaction_id,
            "file_path": f"/uploads/{rel_path}",
            "description": doc.description,
            "uploaded_at": doc.uploaded_at.isoformat() if doc.uploaded_at else None
        })
    
    return result


@router.put("/{tx_id}/documents/{doc_id}", response_model=dict)
async def update_transaction_document(
    tx_id: int, 
    doc_id: int, 
    db: DBSessionDep, 
    description: str | None = Form(None),
    user = Depends(get_current_user)
):
    """Update document description for a transaction - accessible to all authenticated users"""
    from sqlalchemy import select, and_
    
    # Verify transaction exists
    tx = await TransactionRepository(db).get_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Get the document
    docs_query = select(SupplierDocument).where(
        and_(
            SupplierDocument.id == doc_id,
            SupplierDocument.transaction_id == tx_id
        )
    )
    docs_result = await db.execute(docs_query)
    doc = docs_result.scalar_one_or_none()
    
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Update description
    doc.description = description.strip() if description and description.strip() else None
    await SupplierDocumentRepository(db).update(doc)
    
    uploads_dir = get_uploads_dir()
    if os.path.isabs(doc.file_path):
        rel_path = os.path.relpath(doc.file_path, uploads_dir).replace('\\', '/')
    else:
        rel_path = doc.file_path.replace('\\', '/').lstrip('./')
    
    return {
        "id": doc.id,
        "transaction_id": doc.transaction_id,
        "description": doc.description,
        "file_path": f"/uploads/{rel_path}"
    }


@router.post("/{tx_id}/supplier-document", response_model=dict)
async def upload_supplier_document(tx_id: int, db: DBSessionDep, file: UploadFile = File(...), user = Depends(get_current_user)):
    """Upload document for transaction - accessible to all authenticated users"""
    tx = await TransactionRepository(db).get_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Save file
    uploads_dir = get_uploads_dir()
    suppliers_dir = os.path.join(uploads_dir, 'suppliers')
    
    # If transaction has supplier, use supplier directory structure
    if tx.supplier_id:
        supplier = await SupplierRepository(db).get(tx.supplier_id)
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        # Create directory for this specific supplier using supplier name
        supplier_name_sanitized = sanitize_filename(supplier.name)
        supplier_specific_dir = os.path.join(suppliers_dir, supplier_name_sanitized)
        os.makedirs(supplier_specific_dir, exist_ok=True)
        ext = os.path.splitext(file.filename or "")[1]
        path = os.path.join(supplier_specific_dir, f"{uuid4().hex}{ext}")
        supplier_id = tx.supplier_id
    else:
        # If no supplier, use a generic transactions directory
        transactions_dir = os.path.join(uploads_dir, 'transactions')
        os.makedirs(transactions_dir, exist_ok=True)
        ext = os.path.splitext(file.filename or "")[1]
        path = os.path.join(transactions_dir, f"{uuid4().hex}{ext}")
        supplier_id = None
    
    content = await file.read()
    with open(path, 'wb') as f:
        f.write(content)
    
    # Create supplier document linked to transaction (supplier_id can be None)
    doc = SupplierDocument(supplier_id=supplier_id, transaction_id=tx_id, file_path=path)
    await SupplierDocumentRepository(db).create(doc)
    
    # Return relative path for frontend
    rel_path = os.path.relpath(path, uploads_dir).replace('\\', '/')
    return {
        "id": doc.id,
        "file_path": f"/uploads/{rel_path}", 
        "supplier_id": supplier_id, 
        "transaction_id": tx_id,
        "description": doc.description
    }


@router.put("/{tx_id}", response_model=TransactionOut)
async def update_transaction(tx_id: int, db: DBSessionDep, data: TransactionUpdate, user = Depends(get_current_user)):
    """Update transaction - accessible to all authenticated users"""
    repo = TransactionRepository(db)
    tx = await repo.get_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    
    # Validate supplier if provided
    if data.supplier_id is not None:
        supplier = await SupplierRepository(db).get(data.supplier_id)
        if not supplier:
            raise HTTPException(status_code=404, detail="Supplier not found")
        if not supplier.is_active:
            raise HTTPException(status_code=400, detail="Cannot update transaction with inactive supplier")
    
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(tx, k, v)
    return await repo.update(tx)


@router.delete("/{tx_id}")
async def delete_transaction(tx_id: int, db: DBSessionDep, user = Depends(require_admin())):
    """Delete transaction - Admin only"""
    repo = TransactionRepository(db)
    tx = await repo.get_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await repo.delete(tx)
    return {"ok": True}
