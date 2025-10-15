from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.repositories.project_repository import ProjectRepository
from backend.app.models.project import Project


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.projects = ProjectRepository(db)

    async def create(self, **data) -> Project:
        project = Project(**data)
        return await self.projects.create(project)

    async def update(self, project: Project, **data) -> Project:
        for k, v in data.items():
            if v is not None:
                setattr(project, k, v)
        return await self.projects.update(project)

    async def delete(self, project: Project) -> None:
        await self.projects.delete(project)
