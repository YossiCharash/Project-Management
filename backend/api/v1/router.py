from fastapi import APIRouter

from backend.api.v1.endpoints import transactions, auth, reports, suppliers, users, projects

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["transactions"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(suppliers.router, prefix="/suppliers", tags=["suppliers"])
