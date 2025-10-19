import asyncio

from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.repositories.project_repository import ProjectRepository
from backend.app.models.project import Project
from backend.app.repositories.transaction_repository import TransactionRepository


class ProjectService:
    def __init__(self, db: AsyncSession):
        self.projects = ProjectRepository(db)
        self.transactions = TransactionRepository(db)

    async def get_value_of_projects(self, project_id: int):
        proj: Project = await self.projects.get_by_id(project_id=project_id)
        project_data = proj.__dict__
        project_data['total_value'] = await self.calculation_of_financials(project_id=project_id)
        return project_data

    async def calculation_of_financials(self, project_id):
        monthly_payment_tenants = float(await self.projects.get_payments_of_monthly_tenants(project_id))
        transaction_val = float(await self.transactions.get_transaction_value(project_id))
        return monthly_payment_tenants - transaction_val

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
