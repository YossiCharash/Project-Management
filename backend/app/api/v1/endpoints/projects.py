from fastapi import APIRouter, Depends, HTTPException

from app.core.deps import DBSessionDep, require_roles
from app.repositories.project_repository import ProjectRepository
from app.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from app.services.project_service import ProjectService
from app.models.user import UserRole

router = APIRouter()


@router.get("/", response_model=list[ProjectOut])
async def list_projects(db: DBSessionDep):
    return await ProjectRepository(db).list()


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


@router.delete("/{project_id}")
async def delete_project(project_id: int, db: DBSessionDep, user = Depends(require_roles(UserRole.ADMIN))):
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    await ProjectService(db).delete(project)
    return {"ok": True}
