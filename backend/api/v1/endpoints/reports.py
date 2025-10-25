from fastapi import APIRouter, Depends

from backend.core.deps import DBSessionDep, require_roles, get_current_user
from backend.services.report_service import ReportService
from backend.models.user import UserRole

router = APIRouter()


@router.get("/project/{project_id}")
async def project_report(project_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """Get project report - accessible to all authenticated users"""
    return await ReportService(db).project_profitability(project_id)


@router.get("/dashboard-snapshot")
async def get_dashboard_snapshot(db: DBSessionDep, user = Depends(get_current_user)):
    """Get comprehensive dashboard snapshot with real-time financial data"""
    return await ReportService(db).get_dashboard_snapshot()


@router.get("/project/{project_id}/expense-categories")
async def get_project_expense_categories(project_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """Get expense categories breakdown for a specific project"""
    return await ReportService(db).get_project_expense_categories(project_id)


@router.get("/project/{project_id}/transactions")
async def get_project_transactions(project_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """Get all transactions for a specific project"""
    return await ReportService(db).get_project_transactions(project_id)
