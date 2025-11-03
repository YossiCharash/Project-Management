from fastapi import APIRouter, Depends, HTTPException, Query
from datetime import date
from typing import Optional

from backend.core.deps import DBSessionDep, require_roles, get_current_user, require_admin
from backend.repositories.project_repository import ProjectRepository
from backend.repositories.transaction_repository import TransactionRepository
from backend.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from backend.schemas.recurring_transaction import RecurringTransactionTemplateCreate
from backend.services.project_service import ProjectService
from backend.services.recurring_transaction_service import RecurringTransactionService
from backend.services.financial_aggregation_service import FinancialAggregationService
from backend.models.user import UserRole

router = APIRouter()


@router.get("/", response_model=list[ProjectOut])
async def list_projects(db: DBSessionDep, include_archived: bool = Query(False), only_archived: bool = Query(False), user = Depends(get_current_user)):
    """List projects - accessible to all authenticated users"""
    return await ProjectRepository(db).list(include_archived=include_archived, only_archived=only_archived)

@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """Get project details - accessible to all authenticated users"""
    project = await ProjectRepository(db).get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.get("/{project_id}/subprojects", response_model=list[ProjectOut])
async def get_subprojects(project_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """Get subprojects - accessible to all authenticated users"""
    return await ProjectRepository(db).get_subprojects(project_id)

@router.get("/get_values/{project_id}", response_model=ProjectOut)
async def get_project_values(project_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """Get project values - accessible to all authenticated users"""
    project_data = await ProjectService(db).get_value_of_projects(project_id=project_id)
    if not project_data:
        raise HTTPException(status_code=404, detail="Project not found")
    return project_data

@router.post("/", response_model=ProjectOut)
async def create_project(db: DBSessionDep, data: ProjectCreate, user = Depends(get_current_user)):
    """Create project - accessible to all authenticated users"""
    # Extract recurring transactions from project data
    project_data = data.model_dump(exclude={'recurring_transactions'})
    recurring_transactions = data.recurring_transactions or []
    
    # Create the project
    project = await ProjectService(db).create(**project_data)
    
    # Create recurring transactions if provided
    if recurring_transactions:
        recurring_service = RecurringTransactionService(db)
        for rt_data in recurring_transactions:
            # Convert to dict and set the project_id for each recurring transaction
            rt_dict = rt_data.model_dump()
            rt_dict['project_id'] = project.id
            # Create new instance with project_id set
            rt_create = RecurringTransactionTemplateCreate(**rt_dict)
            await recurring_service.create_template(rt_create)
    
    return project


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: int, db: DBSessionDep, data: ProjectUpdate, user = Depends(get_current_user)):
    """Update project - accessible to all authenticated users"""
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await ProjectService(db).update(project, **data.model_dump(exclude_unset=True))


@router.post("/{project_id}/archive", response_model=ProjectOut)
async def archive_project(project_id: int, db: DBSessionDep, user = Depends(require_admin())):
    """Archive project - Admin only"""
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await repo.archive(project)


@router.post("/{project_id}/restore", response_model=ProjectOut)
async def restore_project(project_id: int, db: DBSessionDep, user = Depends(require_admin())):
    """Restore project - Admin only"""
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return await repo.restore(project)


@router.delete("/{project_id}")
async def hard_delete_project(project_id: int, db: DBSessionDep, user = Depends(require_admin())):
    """Hard delete project - Admin only"""
    proj_repo = ProjectRepository(db)
    project = await proj_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    # delete child transactions first
    await TransactionRepository(db).delete_by_project(project_id)
    await proj_repo.delete(project)
    return {"ok": True}


@router.get("/{project_id}/financial-summary")
async def get_parent_project_financial_summary(
    project_id: int,
    db: DBSessionDep,
    start_date: Optional[date] = Query(None, description="Start date for filtering transactions"),
    end_date: Optional[date] = Query(None, description="End date for filtering transactions"),
    user = Depends(get_current_user)
):
    """Get consolidated financial summary for a parent project including all subprojects"""
    try:
        # Use async approach instead of sync
        from sqlalchemy import select, and_, func
        from backend.models.project import Project
        from backend.models.transaction import Transaction
        
        # Get parent project
        parent_result = await db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.is_active == True
            )
        )
        parent_project = parent_result.scalar_one_or_none()
        
        if not parent_project:
            raise HTTPException(status_code=404, detail="Parent project not found")
        
        # Get all subprojects
        subprojects_result = await db.execute(
            select(Project).where(
                Project.relation_project == project_id,
                Project.is_active == True
            )
        )
        subprojects = subprojects_result.scalars().all()
        
        # Build date filter
        date_conditions = []
        if start_date:
            date_conditions.append(Transaction.tx_date >= start_date)
        if end_date:
            date_conditions.append(Transaction.tx_date <= end_date)
        
        # Get transactions for parent project
        parent_transactions_query = select(Transaction).where(Transaction.project_id == project_id)
        if date_conditions:
            parent_transactions_query = parent_transactions_query.where(and_(*date_conditions))
        
        parent_transactions_result = await db.execute(parent_transactions_query)
        parent_transactions = parent_transactions_result.scalars().all()
        
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
            subproject_transactions_query = select(Transaction).where(Transaction.project_id == subproject.id)
            if date_conditions:
                subproject_transactions_query = subproject_transactions_query.where(and_(*date_conditions))
            
            subproject_transactions_result = await db.execute(subproject_transactions_query)
            subproject_transactions = subproject_transactions_result.scalars().all()
            
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
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving financial summary: {str(e)}")


@router.get("/{project_id}/financial-trends")
async def get_financial_trends(
    project_id: int,
    db: DBSessionDep,
    years_back: int = Query(5, description="Number of years to look back"),
    user = Depends(get_current_user)
):
    """Get financial trends over the last N years"""
    try:
        from sqlalchemy import select, and_, func, extract
        from backend.models.project import Project
        from backend.models.transaction import Transaction
        from datetime import datetime, date
        
        # Get parent project
        parent_result = await db.execute(
            select(Project).where(
                Project.id == project_id,
                Project.is_active == True
            )
        )
        parent_project = parent_result.scalar_one_or_none()
        
        if not parent_project:
            raise HTTPException(status_code=404, detail="Parent project not found")
        
        # Get all subprojects
        subprojects_result = await db.execute(
            select(Project).where(
                Project.relation_project == project_id,
                Project.is_active == True
            )
        )
        subprojects = subprojects_result.scalars().all()
        
        # Calculate trends for the last N years
        trends = []
        current_year = datetime.now().year
        
        for i in range(years_back):
            year = current_year - i
            
            # Get start and end of year
            year_start = date(year, 1, 1)
            year_end = date(year, 12, 31)
            
            # Get transactions for parent project in this year
            parent_transactions_query = select(Transaction).where(
                and_(
                    Transaction.project_id == project_id,
                    Transaction.tx_date >= year_start,
                    Transaction.tx_date <= year_end
                )
            )
            parent_transactions_result = await db.execute(parent_transactions_query)
            parent_transactions = parent_transactions_result.scalars().all()
            
            parent_income = sum(t.amount for t in parent_transactions if t.type == 'Income')
            parent_expense = sum(t.amount for t in parent_transactions if t.type == 'Expense')
            
            # Get transactions for subprojects in this year
            total_subproject_income = 0
            total_subproject_expense = 0
            
            for subproject in subprojects:
                subproject_transactions_query = select(Transaction).where(
                    and_(
                        Transaction.project_id == subproject.id,
                        Transaction.tx_date >= year_start,
                        Transaction.tx_date <= year_end
                    )
                )
                subproject_transactions_result = await db.execute(subproject_transactions_query)
                subproject_transactions = subproject_transactions_result.scalars().all()
                
                subproject_income = sum(t.amount for t in subproject_transactions if t.type == 'Income')
                subproject_expense = sum(t.amount for t in subproject_transactions if t.type == 'Expense')
                
                total_subproject_income += subproject_income
                total_subproject_expense += subproject_expense
            
            # Calculate totals
            total_income = parent_income + total_subproject_income
            total_expense = parent_expense + total_subproject_expense
            total_profit = total_income - total_expense
            total_profit_margin = (total_profit / total_income * 100) if total_income > 0 else 0
            
            trends.append({
                'year': year,
                'income': total_income,
                'expense': total_expense,
                'profit': total_profit,
                'profit_margin': total_profit_margin
            })
        
        # Reverse to get chronological order
        trends.reverse()
        
        return {
            'trends': trends,
            'period_years': years_back
        }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving financial trends: {str(e)}")
