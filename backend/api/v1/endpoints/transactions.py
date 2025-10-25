from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from backend.core.deps import DBSessionDep, require_roles, get_current_user, require_admin
from backend.repositories.transaction_repository import TransactionRepository
from backend.repositories.project_repository import ProjectRepository
from backend.schemas.transaction import TransactionCreate, TransactionOut, TransactionUpdate
from backend.services.transaction_service import TransactionService
from backend.models.user import UserRole

router = APIRouter()


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
    return await TransactionService(db).create(**data.model_dump())


@router.post("/{tx_id}/upload", response_model=TransactionOut)
async def upload_receipt(tx_id: int, db: DBSessionDep, file: UploadFile = File(...), user = Depends(get_current_user)):
    """Upload receipt for transaction - accessible to all authenticated users"""
    tx = await TransactionRepository(db).get_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return await TransactionService(db).attach_file(tx, file)


@router.put("/{tx_id}", response_model=TransactionOut)
async def update_transaction(tx_id: int, db: DBSessionDep, data: TransactionUpdate, user = Depends(get_current_user)):
    """Update transaction - accessible to all authenticated users"""
    repo = TransactionRepository(db)
    tx = await repo.get_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
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
