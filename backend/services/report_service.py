from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
from typing import List, Dict, Any

from backend.models.transaction import Transaction
from backend.models.project import Project
from backend.services.budget_service import BudgetService


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
                    "unpaid_recurring": [],
                    "category_budget_alerts": []
                },
                "summary": {
                    "total_income": 0,
                    "total_expense": 0,
                    "total_profit": 0
                },
                "expense_categories": []
            }

        # Get current year's date range
        current_date = date.today()
        current_year_start = current_date.replace(month=1, day=1)

        # Initialize budget service for category budget alerts
        budget_service = BudgetService(self.db)
        
        # Calculate financial data for each project
        projects_with_finance = []
        total_income = 0
        total_expense = 0
        budget_overrun_projects = []
        missing_proof_projects = []
        unpaid_recurring_projects = []
        category_budget_alerts = []  # Store category budget alerts

        for project in projects:
            # Get current year's transactions
            yearly_income_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                and_(
                    Transaction.project_id == project.id,
                    Transaction.type == "Income",
                    Transaction.tx_date >= current_year_start
                )
            )
            yearly_expense_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                and_(
                    Transaction.project_id == project.id,
                    Transaction.type == "Expense",
                    Transaction.tx_date >= current_year_start
                )
            )

            yearly_income = float((await self.db.execute(yearly_income_query)).scalar_one())
            yearly_expense = float((await self.db.execute(yearly_expense_query)).scalar_one())

            # Calculate profit including budgets
            # Add annual budget to income
            project_total_income = yearly_income + float(project.budget_annual or 0)
            # Add monthly budget multiplied by 12 to yearly income
            project_total_income += float(project.budget_monthly or 0) * 12
            
            profit = project_total_income - yearly_expense
            
            # Calculate profit percentage based on total income
            if project_total_income > 0:
                profit_percent = (profit / project_total_income * 100)
            else:
                profit_percent = 0

            # Determine status color based on profit percentage
            if profit_percent >= 10:
                status_color = "green"
            elif profit_percent <= -10:
                status_color = "red"
            else:
                status_color = "yellow"

            # Check for budget overrun (compare yearly expense to yearly budget)
            yearly_budget = float(project.budget_annual or 0) + (float(project.budget_monthly or 0) * 12)
            if yearly_expense > yearly_budget:
                budget_overrun_projects.append(project.id)

            # Check for missing proof (transactions without file_path)
            missing_proof_query = select(func.count(Transaction.id)).where(
                and_(
                    Transaction.project_id == project.id,
                    Transaction.file_path.is_(None),
                    Transaction.tx_date >= current_year_start
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
            
            # Check for category budget alerts
            try:
                project_budget_alerts = await budget_service.check_category_budget_alerts(
                    project.id, 
                    current_date
                )
                category_budget_alerts.extend(project_budget_alerts)
            except Exception as e:
                # If budget checking fails, continue without it
                print(f"Warning: Could not check budget alerts for project {project.id}: {str(e)}")

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
                "image_url": project.image_url,
                "is_active": project.is_active,
                "manager_id": project.manager_id,
                "created_at": project.created_at.isoformat() if project.created_at else None,
                "income_month_to_date": project_total_income,  # Calculated by year, keeping field name for frontend compatibility
                "expense_month_to_date": yearly_expense,  # Calculated by year, keeping field name for frontend compatibility
                "profit_percent": round(profit_percent, 1),
                "status_color": status_color,
                "budget_monthly": float(project.budget_monthly or 0),
                "budget_annual": float(project.budget_annual or 0),
                "children": []
            }

            projects_with_finance.append(project_data)
            total_income += project_total_income  # project_total_income includes budgets
            total_expense += yearly_expense

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

        # Get expense categories breakdown
        expense_categories_query = select(
            Transaction.category,
            func.coalesce(func.sum(Transaction.amount), 0).label('total_amount')
        ).where(
            and_(
                Transaction.type == "Expense",
                Transaction.tx_date >= current_year_start
            )
        ).group_by(Transaction.category)
        
        expense_categories_result = await self.db.execute(expense_categories_query)
        expense_categories = []
        
        for row in expense_categories_result:
            if row.total_amount > 0:  # Only include categories with expenses
                expense_categories.append({
                    "category": row.category or "אחר",
                    "amount": float(row.total_amount),
                    "color": self._get_category_color(row.category)
                })

        return {
            "projects": projects_with_finance,  # Return all projects, not just root ones
            "alerts": {
                "budget_overrun": budget_overrun_projects,
                "missing_proof": missing_proof_projects,
                "unpaid_recurring": unpaid_recurring_projects,
                "category_budget_alerts": category_budget_alerts
            },
            "summary": {
                "total_income": round(total_income, 2),
                "total_expense": round(total_expense, 2),
                "total_profit": round(total_profit, 2)
            },
            "expense_categories": expense_categories
        }

    def _get_category_color(self, category: str) -> str:
        """Get color for expense category"""
        color_map = {
            "ניקיון": "#3B82F6",  # blue-500
            "חשמל": "#F59E0B",    # amber-500
            "ביטוח": "#8B5CF6",   # violet-500
            "גינון": "#059669",   # emerald-500
            "אחר": "#EF4444"      # red-500
        }
        return color_map.get(category, "#6B7280")  # gray-500 as default

    async def get_project_expense_categories(self, project_id: int) -> List[Dict[str, Any]]:
        """Get expense categories breakdown for a specific project"""
        expense_categories_query = select(
            Transaction.category,
            func.coalesce(func.sum(Transaction.amount), 0).label('total_amount')
        ).where(
            and_(
                Transaction.project_id == project_id,
                Transaction.type == "Expense"
            )
        ).group_by(Transaction.category)
        
        expense_categories_result = await self.db.execute(expense_categories_query)
        expense_categories = []
        
        for row in expense_categories_result:
            if row.total_amount > 0:  # Only include categories with expenses
                expense_categories.append({
                    "category": row.category or "אחר",
                    "amount": float(row.total_amount),
                    "color": self._get_category_color(row.category)
                })
        
        return expense_categories

    async def get_project_transactions(self, project_id: int) -> List[Dict[str, Any]]:
        """Get all transactions for a specific project (including recurring ones)"""
        transactions_query = select(Transaction).where(Transaction.project_id == project_id).order_by(Transaction.tx_date.desc())
        transactions_result = await self.db.execute(transactions_query)
        transactions = list(transactions_result.scalars().all())
        
        return [
            {
                "id": tx.id,
                "project_id": tx.project_id,
                "tx_date": tx.tx_date.isoformat(),
                "type": tx.type,
                "amount": float(tx.amount),
                "description": tx.description,
                "category": tx.category,
                "notes": tx.notes,
                "is_exceptional": tx.is_exceptional,
                "is_generated": getattr(tx, 'is_generated', False),
                "recurring_template_id": getattr(tx, 'recurring_template_id', None),
                "created_at": tx.created_at.isoformat() if hasattr(tx, 'created_at') and tx.created_at else None
            }
            for tx in transactions
        ]
