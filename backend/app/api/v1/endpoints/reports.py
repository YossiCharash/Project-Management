from fastapi import APIRouter, Depends

from backend.app.core.deps import DBSessionDep, require_roles
from backend.app.services.report_service import ReportService
from backend.app.models.user import UserRole

router = APIRouter()


@router.get("/project/{project_id}")
async def project_report(project_id: int, db: DBSessionDep, user = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.VIEWER))):
    return await ReportService(db).project_profitability(project_id)


@router.get("/dashboard-snapshot")
async def get_dashboard_snapshot(db: DBSessionDep, user = Depends(require_roles(UserRole.ADMIN, UserRole.PROJECT_MANAGER, UserRole.VIEWER))):
    """Get comprehensive dashboard snapshot with real-time financial data"""
    return await ReportService(db).get_dashboard_snapshot()