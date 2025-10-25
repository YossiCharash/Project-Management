from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from backend.core.deps import DBSessionDep, require_roles, get_current_user, require_admin
from backend.models.user import UserRole
from backend.models.supplier import Supplier
from backend.models.supplier_document import SupplierDocument
from backend.repositories.supplier_repository import SupplierRepository
from backend.repositories.supplier_document_repository import SupplierDocumentRepository
from backend.schemas.supplier import SupplierCreate, SupplierOut, SupplierUpdate
from backend.core.config import settings
import os
from uuid import uuid4

router = APIRouter()


@router.get("/", response_model=list[SupplierOut])
async def list_suppliers(db: DBSessionDep, user = Depends(get_current_user)):
    """List suppliers - accessible to all authenticated users"""
    return await SupplierRepository(db).list()


@router.post("/", response_model=SupplierOut)
async def create_supplier(db: DBSessionDep, data: SupplierCreate, user = Depends(get_current_user)):
    """Create supplier - accessible to all authenticated users"""
    supplier = Supplier(**data.model_dump())
    return await SupplierRepository(db).create(supplier)


@router.put("/{supplier_id}", response_model=SupplierOut)
async def update_supplier(supplier_id: int, db: DBSessionDep, data: SupplierUpdate, user = Depends(get_current_user)):
    """Update supplier - accessible to all authenticated users"""
    repo = SupplierRepository(db)
    supplier = await repo.get(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(supplier, k, v)
    return await repo.update(supplier)


@router.delete("/{supplier_id}")
async def delete_supplier(supplier_id: int, db: DBSessionDep, user = Depends(require_admin())):
    """Delete supplier - Admin only"""
    repo = SupplierRepository(db)
    supplier = await repo.get(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    await repo.delete(supplier)
    return {"ok": True}


@router.post("/{supplier_id}/documents", response_model=dict)
async def upload_supplier_document(supplier_id: int, db: DBSessionDep, file: UploadFile = File(...), user = Depends(get_current_user)):
    """Upload supplier document - accessible to all authenticated users"""
    supplier = await SupplierRepository(db).get(supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    os.makedirs(os.path.join(settings.FILE_UPLOAD_DIR, 'suppliers'), exist_ok=True)
    ext = os.path.splitext(file.filename or "")[1]
    path = os.path.join(settings.FILE_UPLOAD_DIR, 'suppliers', f"{uuid4().hex}{ext}")
    content = await file.read()
    with open(path, 'wb') as f:
        f.write(content)
    doc = SupplierDocument(supplier_id=supplier_id, file_path=path)
    await SupplierDocumentRepository(db).create(doc)
    return {"file_path": path}
