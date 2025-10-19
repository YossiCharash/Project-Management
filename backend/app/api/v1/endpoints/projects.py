from fastapi import APIRouter, Depends, HTTPException, Query

from backend.app.core.deps import DBSessionDep, require_roles
from backend.app.repositories.project_repository import ProjectRepository
from backend.app.repositories.transaction_repository import TransactionRepository
from backend.app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from backend.app.services.project_service import ProjectService
from backend.app.models.user import UserRole

router = APIRouter()


@router.get("/", response_model=list[ProjectOut])
async def list_projects(db: DBSessionDep, include_archived: bool = Query(False), only_archived: bool = Query(False)):
    return await ProjectRepository(db).list(include_archived=include_archived, only_archived=only_archived)

@router.get("/get_values/{project_id}", response_model=ProjectOut)
async def get_project_values(project_id: int, db: DBSessionDep):
    project_data = await ProjectService(db).get_value_of_projects(project_id=project_id)
    if not project_data:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_data

@router.post("/", response_model=ProjectOut)
async def create_project(db: DBSessionDep, data: ProjectCreate, user = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER))):
    return await ProjectService(db).create(**data.model_dump())


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: int, db: DBSessionDep, data: ProjectUpdate, user = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER))):
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await ProjectService(db).update(project, **data.model_dump(exclude_unset=True))


@router.post("/{project_id}/archive", response_model=ProjectOut)
async def archive_project(project_id: int, db: DBSessionDep, user = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER))):
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await repo.archive(project)


@router.post("/{project_id}/restore", response_model=ProjectOut)
async def restore_project(project_id: int, db: DBSessionDep, user = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER))):
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await repo.restore(project)


@router.delete("/{project_id}")
async def hard_delete_project(project_id: int, db: DBSessionDep, user = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER))):
    proj_repo = ProjectRepository(db)
    project = await proj_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # delete child transactions first
    await TransactionRepository(db).delete_by_project(project_id)
    await proj_repo.delete(project)
    return {"ok": True}
