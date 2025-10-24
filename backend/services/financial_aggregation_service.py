from datetime import datetime, date
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, extract

from backend.models.project import Project
from backend.models.transaction import Transaction
from backend.models.subproject import Subproject


class FinancialAggregationService:
    """Service for aggregating financial data across parent projects and subprojects"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_parent_project_financial_summary(
        self, 
        parent_project_id: int, 
        start_date: Optional[date] = None, 
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Get consolidated financial summary for a parent project including all subprojects
        
        Args:
            parent_project_id: ID of the parent project
            start_date: Start date for filtering transactions (optional)
            end_date: End date for filtering transactions (optional)
            
        Returns:
            Dictionary containing consolidated financial data
        """
        # Get parent project
        parent_project = self.db.query(Project).filter(
            Project.id == parent_project_id,
            Project.is_active == True
        ).first()
        
        if not parent_project:
            raise ValueError(f"Parent project with ID {parent_project_id} not found")
        
        # Get all subprojects
        subprojects = self.db.query(Project).filter(
            Project.relation_project == parent_project_id,
            Project.is_active == True
        ).all()
        
        # Build date filter
        date_filter = []
        if start_date:
            date_filter.append(Transaction.tx_date >= start_date)
        if end_date:
            date_filter.append(Transaction.tx_date <= end_date)
        
        # Get transactions for parent project
        parent_transactions_query = self.db.query(Transaction).filter(
            Transaction.project_id == parent_project_id
        )
        if date_filter:
            parent_transactions_query = parent_transactions_query.filter(and_(*date_filter))
        
        parent_transactions = parent_transactions_query.all()
        
        # Calculate parent project financials
        parent_income = sum(t.amount for t in parent_transactions if t.type == 'Income')
        parent_expense = sum(t.amount for t in parent_transactions if t.type == 'Expense')
        parent_profit = parent_income - parent_expense
        parent_profit_margin = (parent_profit / parent_income * 100) if parent_income > 0 else 0
        
        # Calculate subproject financials
        subproject_financials = []
        total_subproject_income = 0
        total_subproject_expense = 0
        
        for subproject in subprojects:
            subproject_transactions_query = self.db.query(Transaction).filter(
                Transaction.project_id == subproject.id
            )
            if date_filter:
                subproject_transactions_query = subproject_transactions_query.filter(and_(*date_filter))
            
            subproject_transactions = subproject_transactions_query.all()
            
            subproject_income = sum(t.amount for t in subproject_transactions if t.type == 'Income')
            subproject_expense = sum(t.amount for t in subproject_transactions if t.type == 'Expense')
            subproject_profit = subproject_income - subproject_expense
            subproject_profit_margin = (subproject_profit / subproject_income * 100) if subproject_income > 0 else 0
            
            # Determine status
            if subproject_profit_margin >= 10:
                status = 'green'
            elif subproject_profit_margin <= -10:
                status = 'red'
            else:
                status = 'yellow'
            
            subproject_financials.append({
                'id': subproject.id,
                'name': subproject.name,
                'income': subproject_income,
                'expense': subproject_expense,
                'profit': subproject_profit,
                'profit_margin': subproject_profit_margin,
                'status': status
            })
            
            total_subproject_income += subproject_income
            total_subproject_expense += subproject_expense
        
        # Calculate consolidated totals
        total_income = parent_income + total_subproject_income
        total_expense = parent_expense + total_subproject_expense
        total_profit = total_income - total_expense
        total_profit_margin = (total_profit / total_income * 100) if total_income > 0 else 0
        
        return {
            'parent_project': {
                'id': parent_project.id,
                'name': parent_project.name,
                'description': parent_project.description,
                'address': parent_project.address,
                'city': parent_project.city,
                'num_residents': parent_project.num_residents,
                'monthly_price_per_apartment': parent_project.monthly_price_per_apartment,
                'budget_monthly': parent_project.budget_monthly,
                'budget_annual': parent_project.budget_annual
            },
            'financial_summary': {
                'total_income': total_income,
                'total_expense': total_expense,
                'net_profit': total_profit,
                'profit_margin': total_profit_margin,
                'subproject_count': len(subprojects),
                'active_subprojects': len([sp for sp in subprojects if sp.is_active])
            },
            'parent_financials': {
                'income': parent_income,
                'expense': parent_expense,
                'profit': parent_profit,
                'profit_margin': parent_profit_margin
            },
            'subproject_financials': subproject_financials,
            'date_range': {
                'start_date': start_date.isoformat() if start_date else None,
                'end_date': end_date.isoformat() if end_date else None
            }
        }
    
    def get_monthly_financial_summary(
        self, 
        parent_project_id: int, 
        year: int, 
        month: int
    ) -> Dict[str, Any]:
        """Get financial summary for a specific month"""
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)
        
        return self.get_parent_project_financial_summary(
            parent_project_id, 
            start_date, 
            end_date
        )
    
    def get_yearly_financial_summary(
        self, 
        parent_project_id: int, 
        year: int
    ) -> Dict[str, Any]:
        """Get financial summary for a specific year"""
        start_date = date(year, 1, 1)
        end_date = date(year, 12, 31)
        
        return self.get_parent_project_financial_summary(
            parent_project_id, 
            start_date, 
            end_date
        )
    
    def get_custom_range_financial_summary(
        self, 
        parent_project_id: int, 
        start_date: date, 
        end_date: date
    ) -> Dict[str, Any]:
        """Get financial summary for a custom date range"""
        return self.get_parent_project_financial_summary(
            parent_project_id, 
            start_date, 
            end_date
        )
    
    def get_subproject_performance_comparison(
        self, 
        parent_project_id: int, 
        start_date: Optional[date] = None, 
        end_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Get performance comparison of all subprojects
        
        Returns:
            List of subproject performance data sorted by profitability
        """
        summary = self.get_parent_project_financial_summary(
            parent_project_id, 
            start_date, 
            end_date
        )
        
        subprojects = summary['subproject_financials']
        
        # Sort by profit margin (descending)
        subprojects.sort(key=lambda x: x['profit_margin'], reverse=True)
        
        return subprojects
    
    def get_financial_trends(
        self, 
        parent_project_id: int, 
        months_back: int = 12
    ) -> Dict[str, Any]:
        """
        Get financial trends over the last N months
        
        Args:
            parent_project_id: ID of the parent project
            months_back: Number of months to look back
            
        Returns:
            Dictionary containing monthly trends
        """
        trends = []
        current_date = datetime.now().date()
        
        for i in range(months_back):
            # Calculate month and year
            month = current_date.month - i
            year = current_date.year
            
            if month <= 0:
                month += 12
                year -= 1
            
            # Get monthly summary
            monthly_summary = self.get_monthly_financial_summary(
                parent_project_id, 
                year, 
                month
            )
            
            trends.append({
                'year': year,
                'month': month,
                'month_name': self._get_month_name(month),
                'income': monthly_summary['financial_summary']['total_income'],
                'expense': monthly_summary['financial_summary']['total_expense'],
                'profit': monthly_summary['financial_summary']['net_profit'],
                'profit_margin': monthly_summary['financial_summary']['profit_margin']
            })
        
        # Reverse to get chronological order
        trends.reverse()
        
        return {
            'trends': trends,
            'period_months': months_back
        }
    
    def _get_month_name(self, month: int) -> str:
        """Get Hebrew month name"""
        month_names = [
            'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
            'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
        ]
        return month_names[month - 1]
