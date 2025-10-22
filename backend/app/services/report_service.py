from decimal import Decimal
from sqlalchemy import func, select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date
from typing import List, Dict, Any

from backend.app.models.transaction import Transaction
from backend.app.models.project import Project


class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def project_profitability(self, project_id: int) -> dict:
        income_q = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.project_id == project_id, Transaction.type == "Income"
        )
        expense_q = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            Transaction.project_id == project_id, Transaction.type == "Expense"
        )
        income_val = (await self.db.execute(income_q)).scalar_one()
        expense_val = (await self.db.execute(expense_q)).scalar_one()

        proj = (await self.db.execute(select(Project).where(Project.id == project_id))).scalar_one()

        income = float(income_val)
        expenses = float(expense_val)
        profit = income - expenses

        return {
            "project_id": project_id,
            "income": income,
            "expenses": expenses,
            "profit": profit,
            "budget_monthly": float(proj.budget_monthly or 0),
            "budget_annual": float(proj.budget_annual or 0),
        }

    async def get_dashboard_snapshot(self) -> Dict[str, Any]:
        """Get comprehensive dashboard snapshot with real-time financial data"""
        # Get all active projects
        projects_query = select(Project).where(Project.is_active == True)
        projects_result = await self.db.execute(projects_query)
        projects = list(projects_result.scalars().all())

        if not projects:
            return {
                "projects": [],
                "alerts": {
                    "budget_overrun": [],
                    "missing_proof": [],
                    "unpaid_recurring": []
                },
                "summary": {
                    "total_income": 0,
                    "total_expense": 0,
                    "total_profit": 0
                }
            }

        # Get current month's date range
        current_date = date.today()
        current_month_start = current_date.replace(day=1)

        # Calculate financial data for each project
        projects_with_finance = []
        total_income = 0
        total_expense = 0
        budget_overrun_projects = []
        missing_proof_projects = []
        unpaid_recurring_projects = []

        for project in projects:
            # Get current month's transactions
            monthly_income_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                and_(
                    Transaction.project_id == project.id,
                    Transaction.type == "Income",
                    Transaction.tx_date >= current_month_start
                )
            )
            monthly_expense_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                and_(
                    Transaction.project_id == project.id,
                    Transaction.type == "Expense",
                    Transaction.tx_date >= current_month_start
                )
            )

            monthly_income = float((await self.db.execute(monthly_income_query)).scalar_one())
            monthly_expense = float((await self.db.execute(monthly_expense_query)).scalar_one())

            # Calculate profit percentage
            profit = monthly_income - monthly_expense
            profit_percent = (profit / monthly_income * 100) if monthly_income > 0 else 0

            # Determine status color
            if profit_percent >= 10:
                status_color = "green"
            elif profit_percent <= -10:
                status_color = "red"
            else:
                status_color = "yellow"

            # Check for budget overrun
            if monthly_expense > (project.budget_monthly or 0):
                budget_overrun_projects.append(project.id)

            # Check for missing proof (transactions without file_path)
            missing_proof_query = select(func.count(Transaction.id)).where(
                and_(
                    Transaction.project_id == project.id,
                    Transaction.file_path.is_(None),
                    Transaction.tx_date >= current_month_start
                )
            )
            missing_proof_count = (await self.db.execute(missing_proof_query)).scalar_one()
            if missing_proof_count > 0:
                missing_proof_projects.append(project.id)

            # Check for unpaid recurring expenses (simplified - could be enhanced)
            unpaid_recurring_query = select(func.count(Transaction.id)).where(
                and_(
                    Transaction.project_id == project.id,
                    Transaction.type == "Expense",
                    Transaction.is_exceptional == False,
                    Transaction.tx_date < current_date,
                    Transaction.file_path.is_(None)
                )
            )
            unpaid_recurring_count = (await self.db.execute(unpaid_recurring_query)).scalar_one()
            if unpaid_recurring_count > 0:
                unpaid_recurring_projects.append(project.id)

            # Build project data
            project_data = {
                "id": project.id,
                "name": project.name,
                "description": project.description,
                "start_date": project.start_date.isoformat() if project.start_date else None,
                "end_date": project.end_date.isoformat() if project.end_date else None,
                "budget_monthly": float(project.budget_monthly or 0),
                "budget_annual": float(project.budget_annual or 0),
                "num_residents": project.num_residents,
                "monthly_price_per_apartment": float(project.monthly_price_per_apartment or 0),
                "address": project.address,
                "city": project.city,
                "relation_project": project.relation_project,
                "is_active": project.is_active,
                "manager_id": project.manager_id,
                "created_at": project.created_at.isoformat() if project.created_at else None,
                "income_month_to_date": monthly_income,
                "expense_month_to_date": monthly_expense,
                "profit_percent": round(profit_percent, 1),
                "status_color": status_color,
                "children": []
            }

            projects_with_finance.append(project_data)
            total_income += monthly_income
            total_expense += monthly_expense

        # Build project hierarchy
        project_map = {p["id"]: p for p in projects_with_finance}
        root_projects = []

        for project_data in projects_with_finance:
            if project_data["relation_project"] and project_data["relation_project"] in project_map:
                parent = project_map[project_data["relation_project"]]
                parent["children"].append(project_data)
            else:
                root_projects.append(project_data)

        # Calculate total profit
        total_profit = total_income - total_expense

        return {
            "projects": root_projects,
            "alerts": {
                "budget_overrun": budget_overrun_projects,
                "missing_proof": missing_proof_projects,
                "unpaid_recurring": unpaid_recurring_projects
            },
            "summary": {
                "total_income": round(total_income, 2),
                "total_expense": round(total_expense, 2),
                "total_profit": round(total_profit, 2)
            }
        }
