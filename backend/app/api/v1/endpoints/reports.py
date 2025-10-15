from fastapi import APIRouter, Depends

from app.core.deps import DBSessionDep, require_roles
from app.services.report_service import ReportService
from app.models.user import UserRole

router = APIRouter()


@router.get("/project/{project_id}")
async def project_report(project_id: int, db: DBSessionDep, user = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.VIEWER))):
    return await ReportService(db).project_profitability(project_id)
