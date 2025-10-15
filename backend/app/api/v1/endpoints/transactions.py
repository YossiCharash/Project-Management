from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from app.core.deps import DBSessionDep, require_roles
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.project_repository import ProjectRepository
from app.schemas.transaction import TransactionCreate, TransactionOut, TransactionUpdate
from app.services.transaction_service import TransactionService
from app.models.user import UserRole

router = APIRouter()


@router.get("/project/{project_id}", response_model=list[TransactionOut])
async def list_transactions(project_id: int, db: DBSessionDep):
    return await TransactionRepository(db).list_by_project(project_id)


@router.post("/", response_model=TransactionOut)
async def create_transaction(db: DBSessionDep, data: TransactionCreate, user = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER))):
    project = await ProjectRepository(db).get_by_id(data.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await TransactionService(db).create(**data.model_dump())


@router.post("/{tx_id}/upload", response_model=TransactionOut)
async def upload_receipt(tx_id: int, db: DBSessionDep, file: UploadFile = File(...), user = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER))):
    tx = await TransactionRepository(db).get_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return await TransactionService(db).attach_file(tx, file)


@router.put("/{tx_id}", response_model=TransactionOut)
async def update_transaction(tx_id: int, db: DBSessionDep, data: TransactionUpdate, user = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER))):
    repo = TransactionRepository(db)
    tx = await repo.get_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(tx, k, v)
    return await repo.update(tx)


@router.delete("/{tx_id}")
async def delete_transaction(tx_id: int, db: DBSessionDep, user = Depends(require_roles(UserRole.ADMIN))):
    repo = TransactionRepository(db)
    tx = await repo.get_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await repo.delete(tx)
    return {"ok": True}
