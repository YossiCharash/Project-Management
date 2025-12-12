from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta
import json
from typing import Dict, List, Optional

from backend.repositories.contract_period_repository import ContractPeriodRepository
from backend.repositories.project_repository import ProjectRepository
from backend.repositories.transaction_repository import TransactionRepository
from backend.repositories.budget_repository import BudgetRepository
from backend.models.contract_period import ContractPeriod
from backend.models.archived_contract import ArchivedContract
from backend.models.project import Project
from backend.models.transaction import Transaction
from backend.models.budget import Budget


class ContractPeriodService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.contract_periods = ContractPeriodRepository(db)
        self.projects = ProjectRepository(db)
        self.transactions = TransactionRepository(db)
        self.budgets = BudgetRepository(db)

    async def create_contract_period(
        self,
        project_id: int,
        start_date: date,
        end_date: date,
        budgets_snapshot: Optional[Dict] = None
    ) -> ContractPeriod:
        """Create a new contract period for a project"""
        # Calculate year and index
        contract_year = end_date.year
        year_count = await self.contract_periods.count_by_year(project_id, contract_year)
        year_index = year_count + 1

        # Calculate financial summary
        financial_summary = await self._calculate_financial_summary(
            project_id, start_date, end_date
        )

        # Store budgets snapshot as JSON
        budgets_json = json.dumps(budgets_snapshot) if budgets_snapshot else None

        contract_period = ContractPeriod(
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
            contract_year=contract_year,
            year_index=year_index,
            total_income=financial_summary['income'],
            total_expense=financial_summary['expense'],
            total_profit=financial_summary['profit'],
            budgets_snapshot=budgets_json
        )

        return await self.contract_periods.create(contract_period)

    async def _calculate_financial_summary(
        self, 
        project_id: int, 
        start_date: date, 
        end_date: date
    ) -> Dict[str, float]:
        """Calculate financial summary for a date range"""
        # Get all transactions in date range (excluding fund transactions)
        transactions_query = select(Transaction).where(
            and_(
                Transaction.project_id == project_id,
                Transaction.tx_date >= start_date,
                Transaction.tx_date <= end_date,
                Transaction.from_fund == False
            )
        )
        result = await self.db.execute(transactions_query)
        transactions = result.scalars().all()

        income = sum(float(t.amount) for t in transactions if t.type == 'Income')
        expense = sum(float(t.amount) for t in transactions if t.type == 'Expense')
        profit = income - expense

        return {
            'income': income,
            'expense': expense,
            'profit': profit
        }

    async def check_and_renew_contract(self, project_id: int) -> Optional[Project]:
        """
        Check if a contract has ended and if so, create a new contract period
        and reset the project dates for a new contract period.
        Returns the updated project if renewal occurred, None otherwise.
        """
        project = await self.projects.get_by_id(project_id)
        if not project or not project.is_active:
            return None

        # Check if contract has an end_date and if it has passed
        if not project.end_date:
            return None

        today = date.today()
        # Renew if end_date is today or in the past
        if project.end_date > today:
            # Contract hasn't ended yet
            return None

        # Contract has ended (end_date <= today) - archive it and create new period
        print(f"🔄 Contract for project {project_id} has ended (end_date: {project.end_date}, today: {today}). Renewing...")
        # Calculate the duration of the contract
        if not project.start_date:
            # Can't calculate duration without start_date
            return None

        contract_duration = (project.end_date - project.start_date).days

        # Check if contract period already exists with exact same dates to prevent duplicates
        existing_period = await self.contract_periods.get_by_exact_dates(
            project_id=project_id,
            start_date=project.start_date,
            end_date=project.end_date
        )
        
        # Only create if it doesn't already exist
        if not existing_period:
            # Archive the old contract period
            print(f"📦 Archiving contract period for project {project_id} ({project.start_date} to {project.end_date})")
            budgets_snapshot = await self._get_budgets_snapshot(project_id)
            archived_period = await self.create_contract_period(
                project_id=project_id,
                start_date=project.start_date,
                end_date=project.end_date,
                budgets_snapshot=budgets_snapshot
            )
            print(f"✅ Contract period archived with ID {archived_period.id}")
            
            # Create read-only archive entry
            await self._create_read_only_archive(archived_period)
        else:
            # Contract period already exists, just update project dates
            print(f"ℹ️  Contract period already exists for project {project_id}, skipping creation")

        # Create new contract period starting the day after end_date
        new_start_date = project.end_date + timedelta(days=1)
        new_end_date = new_start_date + timedelta(days=contract_duration)

        print(f"🆕 Creating new contract period for project {project_id}: {new_start_date} to {new_end_date}")

        # Update project with new dates
        # Note: Budgets and fund continue, but transactions will only show for new period
        project.start_date = new_start_date
        project.end_date = new_end_date

        await self.projects.update(project)
        print(f"✅ Project {project_id} updated with new contract dates")
        return project

    async def _get_budgets_snapshot(self, project_id: int) -> Dict:
        """Get current budgets as a snapshot"""
        budgets = await self.budgets.list_by_project(project_id, active_only=False)
        return {
            'budgets': [
                {
                    'category': b.category,
                    'amount': float(b.amount),
                    'period_type': b.period_type,
                    'start_date': b.start_date.isoformat() if b.start_date else None,
                    'end_date': b.end_date.isoformat() if b.end_date else None,
                    'is_active': b.is_active
                }
                for b in budgets
            ]
        }
    
    async def _create_read_only_archive(self, contract_period: ContractPeriod, archived_by_user_id: int | None = None) -> ArchivedContract:
        """Create a read-only archive entry for a contract period"""
        # Count transactions in this period
        transactions_query = select(Transaction).where(
            and_(
                Transaction.project_id == contract_period.project_id,
                Transaction.tx_date >= contract_period.start_date,
                Transaction.tx_date <= contract_period.end_date,
                Transaction.from_fund == False
            )
        )
        result = await self.db.execute(transactions_query)
        transaction_count = len(list(result.scalars().all()))
        
        # Create archived contract entry
        archived_contract = ArchivedContract(
            contract_period_id=contract_period.id,
            project_id=contract_period.project_id,
            start_date=contract_period.start_date,
            end_date=contract_period.end_date,
            contract_year=contract_period.contract_year,
            year_index=contract_period.year_index,
            total_income=contract_period.total_income,
            total_expense=contract_period.total_expense,
            total_profit=contract_period.total_profit,
            budgets_snapshot=contract_period.budgets_snapshot,
            transaction_count=transaction_count,
            archived_by_user_id=archived_by_user_id,
            is_read_only=True
        )
        
        self.db.add(archived_contract)
        await self.db.commit()
        await self.db.refresh(archived_contract)
        
        print(f"📚 Created read-only archive entry for contract period {contract_period.id}")
        return archived_contract
    
    async def close_year_manually(
        self,
        project_id: int,
        end_date: date,
        archived_by_user_id: int | None = None
    ) -> ContractPeriod:
        """
        Manually close a contract year and archive it.
        This is the main workflow for year-end closing.
        """
        project = await self.projects.get_by_id(project_id)
        if not project or not project.is_active:
            raise ValueError("Project not found or not active")
        
        if not project.start_date:
            raise ValueError("Project must have a start_date to close a year")
        
        # Use project's current start_date and provided end_date
        start_date = project.start_date
        
        # Check if contract period already exists
        existing_period = await self.contract_periods.get_by_exact_dates(
            project_id=project_id,
            start_date=start_date,
            end_date=end_date
        )
        
        if existing_period:
            # If already exists, create archive entry if it doesn't exist
            from sqlalchemy import select
            from backend.models.archived_contract import ArchivedContract
            archive_check = await self.db.execute(
                select(ArchivedContract).where(
                    ArchivedContract.contract_period_id == existing_period.id
                )
            )
            if not archive_check.scalar_one_or_none():
                await self._create_read_only_archive(existing_period, archived_by_user_id)
            return existing_period
        
        # Create new contract period
        budgets_snapshot = await self._get_budgets_snapshot(project_id)
        contract_period = await self.create_contract_period(
            project_id=project_id,
            start_date=start_date,
            end_date=end_date,
            budgets_snapshot=budgets_snapshot
        )
        
        # Create read-only archive entry
        await self._create_read_only_archive(contract_period, archived_by_user_id)
        
        # Update project dates for new period
        new_start_date = end_date + timedelta(days=1)
        # Calculate duration and set new end_date
        duration = (end_date - start_date).days
        new_end_date = new_start_date + timedelta(days=duration)
        
        project.start_date = new_start_date
        project.end_date = new_end_date
        await self.projects.update(project)
        
        print(f"✅ Year closed and archived for project {project_id}. New period: {new_start_date} to {new_end_date}")
        return contract_period

    async def get_contract_period_summary(
        self, 
        period_id: int
    ) -> Optional[Dict]:
        """Get full summary of a contract period including transactions and budgets"""
        period = await self.contract_periods.get_by_id(period_id)
        if not period:
            return None

        # Get all transactions in this period
        transactions_query = select(Transaction).where(
            and_(
                Transaction.project_id == period.project_id,
                Transaction.tx_date >= period.start_date,
                Transaction.tx_date <= period.end_date,
                Transaction.from_fund == False
            )
        ).order_by(Transaction.tx_date.desc())
        
        result = await self.db.execute(transactions_query)
        transactions = result.scalars().all()

        # Parse budgets snapshot
        budgets = []
        if period.budgets_snapshot:
            try:
                budgets_data = json.loads(period.budgets_snapshot)
                budgets = budgets_data.get('budgets', [])
            except:
                pass

        # Format transactions
        transactions_list = []
        for tx in transactions:
            transactions_list.append({
                'id': tx.id,
                'tx_date': tx.tx_date.isoformat(),
                'type': tx.type,
                'amount': float(tx.amount),
                'description': tx.description,
                'category': tx.category,
                'payment_method': tx.payment_method,
                'notes': tx.notes,
                'supplier_id': tx.supplier_id
            })

        # Get year label with Hebrew letter if needed
        year_label = self._get_year_label(period.contract_year, period.year_index)

        return {
            'period_id': period.id,
            'project_id': period.project_id,
            'start_date': period.start_date.isoformat(),
            'end_date': period.end_date.isoformat(),
            'contract_year': period.contract_year,
            'year_index': period.year_index,
            'year_label': year_label,
            'total_income': float(period.total_income),
            'total_expense': float(period.total_expense),
            'total_profit': float(period.total_profit),
            'transactions': transactions_list,
            'budgets': budgets
        }

    def _get_year_label(self, year: int, index: int) -> str:
        """Get year label with Hebrew letter suffix if index > 1"""
        if index == 1:
            return str(year)
        
        # Hebrew letters for indices 2, 3, 4, etc.
        hebrew_letters = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י']
        letter_index = (index - 2) % len(hebrew_letters)
        return f"{year}{hebrew_letters[letter_index]}"

    async def get_previous_contracts_by_year(
        self, 
        project_id: int
    ) -> Dict[int, List[Dict]]:
        """Get all previous contract periods grouped by year, removing duplicates"""
        periods = await self.contract_periods.get_by_project(project_id)
        
        # Remove duplicates based on exact start_date and end_date match
        seen_periods = set()
        unique_periods = []
        for period in periods:
            period_key = (period.start_date, period.end_date)
            if period_key not in seen_periods:
                seen_periods.add(period_key)
                unique_periods.append(period)
            else:
                # If duplicate found, keep the one with the latest created_at
                existing_idx = next(i for i, p in enumerate(unique_periods) 
                                  if (p.start_date, p.end_date) == period_key)
                if period.created_at > unique_periods[existing_idx].created_at:
                    unique_periods[existing_idx] = period
        
        # Group by year and calculate indices
        grouped: Dict[int, List[ContractPeriod]] = {}
        for period in unique_periods:
            year = period.contract_year
            if year not in grouped:
                grouped[year] = []
            grouped[year].append(period)
        
        # Sort periods within each year and calculate indices
        result: Dict[int, List[Dict]] = {}
        for year in sorted(grouped.keys(), reverse=True):
            year_periods = sorted(grouped[year], key=lambda p: (p.start_date, p.created_at))
            result[year] = []
            for idx, period in enumerate(year_periods, 1):
                year_label = self._get_year_label(period.contract_year, idx)
                result[year].append({
                    'period_id': period.id,
                    'start_date': period.start_date.isoformat(),
                    'end_date': period.end_date.isoformat(),
                    'year_index': idx,
                    'year_label': year_label,
                    'total_income': float(period.total_income),
                    'total_expense': float(period.total_expense),
                    'total_profit': float(period.total_profit)
                })
        
        return result

