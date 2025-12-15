from sqlalchemy import func, select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
from typing import List, Dict, Any
from dateutil.relativedelta import relativedelta

from backend.models.transaction import Transaction
from backend.models.project import Project
from backend.models.budget import Budget
from backend.services.budget_service import BudgetService
from backend.services.fund_service import FundService
from backend.services.project_service import calculate_start_date, calculate_monthly_income_amount


class ReportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def project_profitability(self, project_id: int) -> dict:
        income_q = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.project_id == project_id, 
                Transaction.type == "Income",
                Transaction.from_fund == False  # Exclude fund transactions
            )
        )
        expense_q = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
            and_(
                Transaction.project_id == project_id, 
                Transaction.type == "Expense",
                Transaction.from_fund == False  # Exclude fund transactions
            )
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
        print("🚀 get_dashboard_snapshot called")
        # Rollback any failed transaction before starting
        try:
            await self.db.rollback()
        except Exception:
            pass  # Ignore if there's no transaction to rollback
        
        # Get all active projects
        projects_query = select(Project).where(Project.is_active == True)
        projects_result = await self.db.execute(projects_query)
        projects = list(projects_result.scalars().all())
        print(f"📋 Found {len(projects)} active projects")

        if not projects:
            return {
                "projects": [],
                "alerts": {
                    "budget_overrun": [],
                    "budget_warning": [],
                    "missing_proof": [],
                    "unpaid_recurring": [],
                    "negative_fund_balance": [],
                    "category_budget_alerts": []
                },
                "summary": {
                    "total_income": 0,
                    "total_expense": 0,
                    "total_profit": 0
                },
                "expense_categories": []
            }

        # Get current date
        current_date = date.today()

        # Initialize budget service for category budget alerts
        budget_service = BudgetService(self.db)
        fund_service = FundService(self.db)
        
        # Calculate financial data for each project
        projects_with_finance = []
        total_income = 0
        total_expense = 0
        budget_overrun_projects = []
        budget_warning_projects = []  # Projects approaching budget limit (70%+)
        missing_proof_projects = []
        unpaid_recurring_projects = []
        negative_fund_balance_projects = []  # Projects with negative fund balance
        category_budget_alerts = []  # Store category budget alerts

        for project in projects:
            # Initialize default values
            yearly_income = 0.0
            yearly_expense = 0.0
            
            # Wrap each project's processing in error handling
            # If a query fails for this project, skip it and continue with others
            try:
                # Ensure all scalar attributes are loaded to avoid lazy-loads outside greenlet
                try:
                    await self.db.refresh(project)
                except Exception:
                    # If refresh fails (e.g., detached instance), fetch a fresh copy
                    project = (await self.db.get(Project, project.id)) or project

                # Calculate start date: use project.start_date if available, otherwise use 1 year ago as fallback
                # Budget is NOT income - only actual transactions count
                if project.start_date:
                    calculation_start_date = project.start_date
                else:
                    # Fallback: use 1 year ago if no project start date
                    calculation_start_date = current_date - relativedelta(years=1)
                
                # Get transactions from calculation_start_date to now (exclude fund transactions)
                # Only actual transactions are counted - budget is NOT included
                yearly_income_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    and_(
                        Transaction.project_id == project.id,
                        Transaction.type == "Income",
                        Transaction.tx_date >= calculation_start_date,
                        Transaction.tx_date <= current_date,
                        Transaction.from_fund == False  # Exclude fund transactions
                    )
                )
                yearly_expense_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
                    and_(
                        Transaction.project_id == project.id,
                        Transaction.type == "Expense",
                        Transaction.tx_date >= calculation_start_date,
                        Transaction.tx_date <= current_date,
                        Transaction.from_fund == False  # Exclude fund transactions
                    )
                )

                # Execute queries with error handling to prevent transaction failures
                try:
                    yearly_income = float((await self.db.execute(yearly_income_query)).scalar_one())
                except Exception:
                    # If query fails, rollback and use default value
                    try:
                        await self.db.rollback()
                    except Exception:
                        pass
                    yearly_income = 0.0
                
                try:
                    yearly_expense = float((await self.db.execute(yearly_expense_query)).scalar_one())
                except Exception:
                    # If query fails, rollback and use default value
                    try:
                        await self.db.rollback()
                    except Exception:
                        pass
                    yearly_expense = 0.0
            except Exception:
                # If project processing fails completely, rollback and skip this project
                try:
                    await self.db.rollback()
                except Exception:
                    pass
                continue  # Skip this project and continue with the next one

            # Budget is NOT income - only actual transactions count
            # Calculate budget separately for budget overrun warnings (not for income calculation)
            # Access budget fields directly - they should already be loaded
            try:
                budget_annual = float(project.budget_annual if project.budget_annual is not None else 0)
                budget_monthly = float(project.budget_monthly if project.budget_monthly is not None else 0)
            except (AttributeError, ValueError) as e:
                # If there's an issue accessing budget fields, use defaults
                budget_annual = 0.0
                budget_monthly = 0.0
            
            # Calculate income from the monthly budget (treated as expected monthly income)
            # Calculate from project start date (or created_at if start_date not available)
            project_income = 0.0
            monthly_income = float(project.budget_monthly or 0)
            if monthly_income > 0:
                # Use project start_date if available, otherwise use created_at date
                if project.start_date:
                    income_calculation_start = project.start_date
                elif hasattr(project, 'created_at') and project.created_at:
                    income_calculation_start = project.created_at.date() if hasattr(project.created_at, 'date') else project.created_at
                else:
                    # Fallback: use calculation_start_date (which is already 1 year ago if no start_date)
                    income_calculation_start = calculation_start_date
                project_income = calculate_monthly_income_amount(monthly_income, income_calculation_start, current_date)
                yearly_income = 0.0
            
            # Income = actual transactions + project income (from monthly budget)
            # Budget is NOT included in income
            project_total_income = yearly_income + project_income
            
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

            # Check for budget overrun and warnings
            # Calculate expected budget for the period (same logic as budget_income)
            yearly_budget = 0.0
            # Prioritize monthly budget if both are set
            if budget_monthly > 0:
                # Same logic as budget_income calculation
                if project.start_date:
                    start_month = date(project.start_date.year, project.start_date.month, 1)
                else:
                    start_month = date(calculation_start_date.year, calculation_start_date.month, 1)
                end_month = date(current_date.year, current_date.month, 1)
                month_count = 0
                temp_month = start_month
                while temp_month <= end_month:
                    month_count += 1
                    if temp_month.month == 12:
                        temp_month = date(temp_month.year + 1, 1, 1)
                    else:
                        temp_month = date(temp_month.year, temp_month.month + 1, 1)
                yearly_budget = budget_monthly * month_count
            elif budget_annual > 0:
                # If only annual budget is set (and no monthly), calculate proportionally
                days_in_period = (current_date - calculation_start_date).days + 1
                days_in_year = 365
                yearly_budget = (budget_annual / days_in_year) * days_in_period
            if yearly_budget > 0:  # Only check if there's a budget
                budget_percentage = (yearly_expense / yearly_budget) * 100
                if yearly_expense > yearly_budget:
                    budget_overrun_projects.append(project.id)
                elif budget_percentage >= 70:  # Approaching budget (70% or more)
                    budget_warning_projects.append(project.id)

            # Check for missing proof (transactions without file_path, excluding fund transactions)
            missing_proof_query = select(func.count(Transaction.id)).where(
                and_(
                    Transaction.project_id == project.id,
                    Transaction.file_path.is_(None),
                    Transaction.tx_date >= calculation_start_date,
                    Transaction.tx_date <= current_date,
                    Transaction.from_fund == False  # Exclude fund transactions
                )
            )
            try:
                missing_proof_count = (await self.db.execute(missing_proof_query)).scalar_one()
                if missing_proof_count > 0:
                    missing_proof_projects.append(project.id)
            except Exception:
                # If query fails, rollback and continue
                try:
                    await self.db.rollback()
                except Exception:
                    pass

            # Check for unpaid recurring expenses (simplified - could be enhanced, excluding fund transactions)
            unpaid_recurring_query = select(func.count(Transaction.id)).where(
                and_(
                    Transaction.project_id == project.id,
                    Transaction.type == "Expense",
                    Transaction.is_exceptional == False,
                    Transaction.tx_date < current_date,
                    Transaction.file_path.is_(None),
                    Transaction.from_fund == False  # Exclude fund transactions
                )
            )
            try:
                unpaid_recurring_count = (await self.db.execute(unpaid_recurring_query)).scalar_one()
                if unpaid_recurring_count > 0:
                    unpaid_recurring_projects.append(project.id)
            except Exception:
                # If query fails, rollback and continue
                try:
                    await self.db.rollback()
                except Exception:
                    pass
            
            # Check for category budget alerts
            try:
                project_budget_alerts = await budget_service.check_category_budget_alerts(
                    project.id, 
                    current_date
                )
                category_budget_alerts.extend(project_budget_alerts)
            except Exception:
                # If budget checking fails, rollback and continue without it
                # This prevents the transaction from being in a failed state
                try:
                    await self.db.rollback()
                except Exception:
                    pass
                # Continue without budget alerts for this project

            # Check for negative fund balance
            try:
                fund = await fund_service.get_fund_by_project(project.id)
                if fund and float(fund.current_balance) < 0:
                    negative_fund_balance_projects.append(project.id)
            except Exception:
                # If fund check fails, rollback and continue
                try:
                    await self.db.rollback()
                except Exception:
                    pass
                # Continue without fund balance check for this project

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
                "is_parent_project": project.is_parent_project,  # Add is_parent_project field
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

        # Get expense categories breakdown (from earliest project start_date or 1 year ago)
        # Calculate the earliest calculation_start_date across all projects
        earliest_start = date.today() - relativedelta(years=1)
        for project in projects:
            project_start = calculate_start_date(project.start_date)
            if project_start < earliest_start:
                earliest_start = project_start
        
        expense_categories_query = select(
            Transaction.category,
            func.coalesce(func.sum(Transaction.amount), 0).label('total_amount')
        ).where(
            and_(
                Transaction.type == "Expense",
                Transaction.tx_date >= earliest_start,
                Transaction.tx_date <= current_date,
                Transaction.from_fund == False  # Exclude fund transactions
            )
        ).group_by(Transaction.category)
        
        expense_categories = []
        try:
            expense_categories_result = await self.db.execute(expense_categories_query)
            for row in expense_categories_result:
                if row.total_amount > 0:  # Only include categories with expenses
                    expense_categories.append({
                        "category": row.category or "אחר",
                        "amount": float(row.total_amount),
                        "color": self._get_category_color(row.category)
                    })
        except Exception:
            # If query fails, rollback and continue with empty categories
            try:
                await self.db.rollback()
            except Exception:
                pass

        return {
            "projects": projects_with_finance,  # Return all projects, not just root ones
            "alerts": {
                "budget_overrun": budget_overrun_projects,
                "budget_warning": budget_warning_projects,
                "missing_proof": missing_proof_projects,
                "unpaid_recurring": unpaid_recurring_projects,
                "negative_fund_balance": negative_fund_balance_projects,
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
                Transaction.type == "Expense",
                Transaction.from_fund == False  # Exclude fund transactions
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
