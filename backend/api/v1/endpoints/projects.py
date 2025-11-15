from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from datetime import date
from typing import Optional
import os
from uuid import uuid4

from backend.core.deps import DBSessionDep, require_roles, get_current_user, require_admin
from backend.core.config import settings
from backend.repositories.project_repository import ProjectRepository
from backend.repositories.transaction_repository import TransactionRepository
from backend.schemas.project import ProjectCreate, ProjectOut, ProjectUpdate
from backend.schemas.recurring_transaction import RecurringTransactionTemplateCreate
from backend.services.project_service import ProjectService
from backend.services.recurring_transaction_service import RecurringTransactionService
from backend.services.financial_aggregation_service import FinancialAggregationService
from backend.services.budget_service import BudgetService
from backend.services.fund_service import FundService
from backend.services.audit_service import AuditService
from backend.models.user import UserRole

router = APIRouter()


def get_uploads_dir() -> str:
    """Get absolute path to uploads directory, resolving relative paths relative to backend directory"""
    if os.path.isabs(settings.FILE_UPLOAD_DIR):
        return settings.FILE_UPLOAD_DIR
    else:
        # Get the directory where this file is located, then go up to backend directory
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Go from api/v1/endpoints to backend directory
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_dir)))
        return os.path.abspath(os.path.join(backend_dir, settings.FILE_UPLOAD_DIR))


@router.get("/", response_model=list[ProjectOut])
async def list_projects(db: DBSessionDep, include_archived: bool = Query(False), only_archived: bool = Query(False), user = Depends(get_current_user)):
    """List projects - accessible to all authenticated users"""
    return await ProjectRepository(db).list(include_archived=include_archived, only_archived=only_archived)

@router.get("", response_model=list[ProjectOut])
async def list_projects_no_slash(db: DBSessionDep, include_archived: bool = Query(False), only_archived: bool = Query(False), user = Depends(get_current_user)):
    """Alias without trailing slash to avoid 404 when redirect_slashes=False"""
    return await ProjectRepository(db).list(include_archived=include_archived, only_archived=only_archived)

@router.get("/profitability-alerts")
async def get_profitability_alerts(
    db: DBSessionDep,
    user = Depends(get_current_user)
):
    """
    Get projects and sub-projects with profitability issues based on last 6 months of data.
    Returns projects with profit margin <= -10% (loss-making projects).
    """
    try:
        from sqlalchemy import select, and_
        from backend.models.project import Project
        from backend.models.transaction import Transaction
        from datetime import timedelta
        
        # Calculate date 6 months ago
        today = date.today()
        six_months_ago = today - timedelta(days=180)
        
        # Get all projects (both active and inactive) - we'll check transactions for all
        projects_result = await db.execute(
            select(Project)
        )
        all_projects = projects_result.scalars().all()
        
        alerts = []
        
        for project in all_projects:
            # Get transactions for the last 6 months
            transactions_query = select(Transaction).where(
                and_(
                    Transaction.project_id == project.id,
                    Transaction.tx_date >= six_months_ago,
                    Transaction.tx_date <= today
                )
            )
            transactions_result = await db.execute(transactions_query)
            transactions = transactions_result.scalars().all()
            
            # Calculate income and expenses (exclude fund transactions)
            income = sum(float(t.amount) for t in transactions if t.type == 'Income' and not (hasattr(t, 'from_fund') and t.from_fund))
            expense = sum(float(t.amount) for t in transactions if t.type == 'Expense' and not (hasattr(t, 'from_fund') and t.from_fund))
            profit = income - expense
            
            # Also check all transactions regardless of date for debugging
            all_transactions_query = select(Transaction).where(Transaction.project_id == project.id)
            all_transactions_result = await db.execute(all_transactions_query)
            all_transactions = all_transactions_result.scalars().all()
            
            # If no transactions in the last 6 months, check if there are any transactions at all
            if len(transactions) == 0 and len(all_transactions) > 0:
                # Check if the oldest transaction is recent (within last year)
                oldest_tx = min(all_transactions, key=lambda t: t.tx_date)
                # If the oldest transaction is within the last year, include it in calculation
                one_year_ago = today - timedelta(days=365)
                if oldest_tx.tx_date >= one_year_ago:
                    # Use all transactions from the last year
                    transactions_query = select(Transaction).where(
                        and_(
                            Transaction.project_id == project.id,
                            Transaction.tx_date >= one_year_ago,
                            Transaction.tx_date <= today
                        )
                    )
                    transactions_result = await db.execute(transactions_query)
                    transactions = transactions_result.scalars().all()
                    # Recalculate with new transactions
                    income = sum(float(t.amount) for t in transactions if t.type == 'Income')
                    expense = sum(float(t.amount) for t in transactions if t.type == 'Expense')
                    profit = income - expense
            
            # Calculate profit margin
            if income > 0:
                profit_margin = (profit / income) * 100
            elif expense > 0:
                # If no income but there are expenses, consider it as 100% loss
                profit_margin = -100
            else:
                # No transactions, skip this project
                continue
            
            # Only include projects with profit margin <= -10% (loss-making)
            if profit_margin <= -10:
                # Determine if it's a sub-project
                is_subproject = project.relation_project is not None
                
                alerts.append({
                    'id': int(project.id),
                    'name': str(project.name),
                    'profit_margin': float(round(profit_margin, 1)),
                    'income': float(income),
                    'expense': float(expense),
                    'profit': float(profit),
                    'is_subproject': bool(is_subproject),
                    'parent_project_id': int(project.relation_project) if project.relation_project else None
                })
        
        # Sort by profit margin (most negative first)
        alerts.sort(key=lambda x: x['profit_margin'])
        
        result = {
            'alerts': alerts,
            'count': int(len(alerts)),
            'period_start': str(six_months_ago.isoformat()),
            'period_end': str(today.isoformat())
        }
        
        return result
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving profitability alerts: {str(e)}")

@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """Get project details - accessible to all authenticated users"""
    project = await ProjectRepository(db).get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Add fund information to project response
    from backend.services.fund_service import FundService
    fund_service = FundService(db)
    fund = await fund_service.get_fund_by_project(project_id)
    
    # Convert to dict to modify
    project_dict = {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "start_date": project.start_date,
        "end_date": project.end_date,
        "budget_monthly": project.budget_monthly,
        "budget_annual": project.budget_annual,
        "manager_id": project.manager_id,
        "relation_project": project.relation_project,
        "num_residents": project.num_residents,
        "monthly_price_per_apartment": project.monthly_price_per_apartment,
        "address": project.address,
        "city": project.city,
        "image_url": project.image_url,
        "is_active": project.is_active,
        "created_at": project.created_at,
        "total_value": getattr(project, 'total_value', 0.0),  # Use getattr with default value
        "has_fund": fund is not None,
        "monthly_fund_amount": float(fund.monthly_amount) if fund else None
    }
    return project_dict

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
    # Extract recurring transactions, budgets, and fund data from project data
    project_data = data.model_dump(exclude={'recurring_transactions', 'budgets', 'has_fund', 'monthly_fund_amount'})
    recurring_transactions = data.recurring_transactions or []
    budgets = data.budgets or []
    has_fund = data.has_fund or False
    monthly_fund_amount = data.monthly_fund_amount
    
    # Create the project
    project = await ProjectService(db).create(**project_data)
    
    # Create fund if requested (even if monthly_amount is 0)
    if has_fund:
        fund_service = FundService(db)
        monthly_amount = monthly_fund_amount if monthly_fund_amount is not None and monthly_fund_amount > 0 else 0
        await fund_service.create_fund(
            project_id=project.id,
            monthly_amount=monthly_amount,
            initial_balance=0
        )
    
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
    
    # Create budgets if provided
    if budgets:
        budget_service = BudgetService(db)
        for idx, budget_data in enumerate(budgets):
            try:
                # Convert string dates to date objects
                from datetime import date as date_type
                start_date = None
                end_date = None

                if budget_data.start_date:
                    if isinstance(budget_data.start_date, str):
                        start_date = date_type.fromisoformat(budget_data.start_date)
                    else:
                        start_date = budget_data.start_date

                if budget_data.end_date:
                    if isinstance(budget_data.end_date, str):
                        end_date = date_type.fromisoformat(budget_data.end_date)
                    else:
                        end_date = budget_data.end_date

                print(
                    "📥 [Project Budget] Creating budget",
                    {
                        "project_id": project.id,
                        "index": idx,
                        "category": budget_data.category,
                        "amount": budget_data.amount,
                        "period_type": budget_data.period_type,
                        "start_date": start_date,
                        "end_date": end_date,
                    },
                )

                created_budget = await budget_service.create_budget(
                    project_id=project.id,
                    category=budget_data.category,
                    amount=budget_data.amount,
                    period_type=budget_data.period_type or "Annual",
                    start_date=start_date,
                    end_date=end_date
                )
                print(
                    "✅ [Project Budget] Budget created",
                    {"budget_id": created_budget.id, "category": budget_data.category},
                )
            except Exception as e:
                import traceback
                print(
                    "❌ [Project Budget] Failed to create budget",
                    {
                        "project_id": project.id,
                        "index": idx,
                        "category": budget_data.category,
                        "amount": budget_data.amount,
                        "period_type": budget_data.period_type,
                        "error": str(e),
                    },
                )
                traceback.print_exc()
                # Log error but don't fail the entire project creation
                pass
    
    # Log create action with full details
    await AuditService(db).log_project_action(
        user_id=user.id,
        action='create',
        project_id=project.id,
        details={
            'name': project.name,
            'description': project.description,
            'budget_monthly': str(project.budget_monthly) if project.budget_monthly else None,
            'budget_annual': str(project.budget_annual) if project.budget_annual else None,
            'address': project.address,
            'city': project.city,
            'start_date': str(project.start_date) if project.start_date else None,
            'end_date': str(project.end_date) if project.end_date else None
        }
    )
    
    return project

@router.post("", response_model=ProjectOut)
async def create_project_no_slash(db: DBSessionDep, data: ProjectCreate, user = Depends(get_current_user)):
    """Alias without trailing slash to avoid 404 when redirect_slashes=False"""
    return await create_project(db, data, user)

@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: int, db: DBSessionDep, data: ProjectUpdate, user = Depends(get_current_user)):
    """Update project - accessible to all authenticated users"""
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    budgets_to_add = data.budgets or []
    has_fund = data.has_fund
    monthly_fund_amount = data.monthly_fund_amount

    # Store old values for audit log
    old_values = {
        'name': project.name,
        'description': project.description or '',
        'budget_monthly': str(project.budget_monthly) if project.budget_monthly else None,
        'budget_annual': str(project.budget_annual) if project.budget_annual else None,
        'address': project.address or '',
        'city': project.city or ''
    }

    update_payload = data.model_dump(exclude_unset=True, exclude={'budgets', 'has_fund', 'monthly_fund_amount'})
    updated_project = await ProjectService(db).update(project, **update_payload)
    
    # Handle fund creation/update
    fund_service = FundService(db)
    existing_fund = await fund_service.get_fund_by_project(project_id)
    
    if has_fund is not None:
        if has_fund:
            # Create or update fund (even if monthly_amount is 0)
            monthly_amount = monthly_fund_amount if monthly_fund_amount is not None and monthly_fund_amount > 0 else 0
            if existing_fund:
                # Update existing fund (repository already commits)
                await fund_service.update_fund(existing_fund, monthly_amount=monthly_amount)
            else:
                # Create new fund (repository already commits)
                await fund_service.create_fund(
                    project_id=project_id,
                    monthly_amount=monthly_amount,
                    initial_balance=0
                )
        elif not has_fund and existing_fund:
            # Delete fund if has_fund is False (repository already commits)
            await fund_service.funds.delete(existing_fund)
    elif monthly_fund_amount is not None and existing_fund:
        # Update monthly amount only (if has_fund wasn't explicitly set) (repository already commits)
        monthly_amount = monthly_fund_amount if monthly_fund_amount > 0 else 0
        await fund_service.update_fund(existing_fund, monthly_amount=monthly_amount)

    # Handle new category budgets if provided
    if budgets_to_add:
        budget_service = BudgetService(db)
        for idx, budget_data in enumerate(budgets_to_add):
            try:
                from datetime import date as date_type
                start_date = None
                end_date = None

                if budget_data.start_date:
                    if isinstance(budget_data.start_date, str):
                        start_date = date_type.fromisoformat(budget_data.start_date)
                    else:
                        start_date = budget_data.start_date

                if budget_data.end_date:
                    if isinstance(budget_data.end_date, str):
                        end_date = date_type.fromisoformat(budget_data.end_date)
                    else:
                        end_date = budget_data.end_date

                print(
                    "📥 [Project Budget] Adding budget during update",
                    {
                        "project_id": project_id,
                        "index": idx,
                        "category": budget_data.category,
                        "amount": budget_data.amount,
                        "period_type": budget_data.period_type,
                        "start_date": start_date,
                        "end_date": end_date,
                    },
                )

                created_budget = await budget_service.create_budget(
                    project_id=project_id,
                    category=budget_data.category,
                    amount=budget_data.amount,
                    period_type=budget_data.period_type or "Annual",
                    start_date=start_date,
                    end_date=end_date
                )
                print(
                    "✅ [Project Budget] Budget added during update",
                    {"budget_id": created_budget.id, "category": budget_data.category},
                )
            except Exception as e:
                import traceback
                print(
                    "❌ [Project Budget] Failed to add budget during update",
                    {
                        "project_id": project_id,
                        "index": idx,
                        "category": budget_data.category,
                        "amount": budget_data.amount,
                        "period_type": budget_data.period_type,
                        "error": str(e),
                    },
                )
                traceback.print_exc()

    # Log update action with full details
    update_data = {k: str(v) for k, v in update_payload.items()}
    await AuditService(db).log_project_action(
        user_id=user.id,
        action='update',
        project_id=project_id,
        details={
            'project_name': project.name,
            'old_values': old_values,
            'new_values': update_data
        }
    )

    # Refresh project to get updated data including fund info
    await db.refresh(updated_project)
    
    # Get updated fund information for response
    fund = await fund_service.get_fund_by_project(project_id)
    
    # Convert to dict to modify
    project_dict = {
        "id": updated_project.id,
        "name": updated_project.name,
        "description": updated_project.description,
        "start_date": updated_project.start_date,
        "end_date": updated_project.end_date,
        "budget_monthly": updated_project.budget_monthly,
        "budget_annual": updated_project.budget_annual,
        "manager_id": updated_project.manager_id,
        "relation_project": updated_project.relation_project,
        "num_residents": updated_project.num_residents,
        "monthly_price_per_apartment": updated_project.monthly_price_per_apartment,
        "address": updated_project.address,
        "city": updated_project.city,
        "image_url": updated_project.image_url,
        "is_active": updated_project.is_active,
        "created_at": updated_project.created_at,
        "total_value": getattr(updated_project, 'total_value', 0.0),  # Use getattr with default value
        "has_fund": fund is not None,
        "monthly_fund_amount": float(fund.monthly_amount) if fund else None
    }
    
    return project_dict


@router.post("/{project_id}/upload-image", response_model=ProjectOut)
async def upload_project_image(project_id: int, db: DBSessionDep, file: UploadFile = File(...), user = Depends(get_current_user)):
    """Upload project image - accessible to all authenticated users"""
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Validate file type (only images)
    allowed_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Invalid file type. Allowed types: {', '.join(allowed_extensions)}")
    
    # Create projects directory in uploads if it doesn't exist
    uploads_dir = get_uploads_dir()
    upload_dir = os.path.join(uploads_dir, 'projects')
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    filename = f"{uuid4().hex}{ext}"
    file_path = os.path.join(upload_dir, filename)
    
    # Save file
    content = await file.read()
    with open(file_path, 'wb') as f:
        f.write(content)
    
    # Update project with image URL (relative path from uploads directory)
    image_url = f"projects/{filename}"
    project.image_url = image_url
    await repo.update(project)
    
    return project


@router.post("/{project_id}/archive", response_model=ProjectOut)
async def archive_project(project_id: int, db: DBSessionDep, user = Depends(require_admin())):
    """Archive project - Admin only"""
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    archived = await repo.archive(project)
    
    # Log archive action
    await AuditService(db).log_project_action(
        user_id=user.id,
        action='archive',
        project_id=project_id,
        details={'name': project.name}
    )
    
    return archived


@router.post("/{project_id}/restore", response_model=ProjectOut)
async def restore_project(project_id: int, db: DBSessionDep, user = Depends(require_admin())):
    """Restore project - Admin only"""
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    restored = await repo.restore(project)
    
    # Log restore action
    await AuditService(db).log_project_action(
        user_id=user.id,
        action='restore',
        project_id=project_id,
        details={'name': project.name}
    )
    
    return restored


@router.delete("/{project_id}")
async def hard_delete_project(project_id: int, db: DBSessionDep, user = Depends(require_admin())):
    """Hard delete project - Admin only"""
    proj_repo = ProjectRepository(db)
    project = await proj_repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Store project details for audit log
    project_details = {'name': project.name}
    
    # delete child transactions first
    await TransactionRepository(db).delete_by_project(project_id)
    await proj_repo.delete(project)
    
    # Log delete action
    await AuditService(db).log_project_action(
        user_id=user.id,
        action='delete',
        project_id=project_id,
        details=project_details
    )
    
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


@router.get("/{project_id}/fund")
async def get_project_fund(
    project_id: int,
    db: DBSessionDep,
    user = Depends(get_current_user)
):
    """Get fund details for a project"""
    from backend.schemas.fund import FundWithTransactions
    from sqlalchemy import select, and_, func
    from backend.models.transaction import Transaction
    from datetime import date
    
    fund_service = FundService(db)
    fund = await fund_service.get_fund_by_project(project_id)
    
    if not fund:
        raise HTTPException(status_code=404, detail="Fund not found for this project")
    
    # Ensure monthly addition is made if needed
    await fund_service.ensure_monthly_addition(project_id)
    # Refresh fund after potential update
    fund = await fund_service.get_fund_by_project(project_id)
    
    # Get transactions from fund
    transactions_query = select(Transaction).where(
        and_(
            Transaction.project_id == project_id,
            Transaction.from_fund == True
        )
    ).order_by(Transaction.tx_date.desc())
    
    transactions_result = await db.execute(transactions_query)
    transactions = transactions_result.scalars().all()
    
    # Calculate total deductions (total amount withdrawn from fund)
    total_deductions_query = select(func.coalesce(func.sum(Transaction.amount), 0)).where(
        and_(
            Transaction.project_id == project_id,
            Transaction.from_fund == True,
            Transaction.type == 'Expense'
        )
    )
    total_deductions_result = await db.execute(total_deductions_query)
    total_deductions = float(total_deductions_result.scalar_one())
    
    # Calculate initial balance and total additions
    # Initial balance is 0 (fund starts with 0)
    initial_balance = 0.0
    monthly_amount = float(fund.monthly_amount)
    
    # Calculate total monthly additions based on creation date and last addition
    total_additions = 0.0
    if fund.last_monthly_addition and monthly_amount > 0:
        # Calculate months between creation and last addition (inclusive)
        created_date = fund.created_at.date() if hasattr(fund.created_at, 'date') else date.today()
        last_addition_date = fund.last_monthly_addition
        
        # Count months from creation to last addition
        if last_addition_date >= created_date:
            # Calculate number of months (including the creation month)
            months_count = (last_addition_date.year - created_date.year) * 12 + (last_addition_date.month - created_date.month) + 1
            total_additions = months_count * monthly_amount
    elif monthly_amount > 0:
        # If no monthly addition yet, but fund exists, at least the current month should count
        # This handles the case where fund was just created
        created_date = fund.created_at.date() if hasattr(fund.created_at, 'date') else date.today()
        today = date.today()
        if created_date <= today:
            months_count = (today.year - created_date.year) * 12 + (today.month - created_date.month) + 1
            # Only count if this month's addition should have been made
            if today.year > created_date.year or (today.year == created_date.year and today.month > created_date.month) or (today.year == created_date.year and today.month == created_date.month and today.day >= 1):
                total_additions = months_count * monthly_amount
    
    # Initial total = initial_balance + total_additions
    initial_total = initial_balance + total_additions
    
    # Load user repository for created_by_user
    from backend.repositories.user_repository import UserRepository
    from backend.repositories.supplier_document_repository import SupplierDocumentRepository
    user_repo = UserRepository(db)
    doc_repo = SupplierDocumentRepository(db)
    
    # Convert transactions to dict with additional info
    transactions_list = []
    for tx in transactions:
        # Get creator user info
        created_by_user = None
        if hasattr(tx, 'created_by_user_id') and tx.created_by_user_id:
            creator = await user_repo.get_by_id(tx.created_by_user_id)
            if creator:
                created_by_user = {
                    'id': creator.id,
                    'full_name': creator.full_name,
                    'email': creator.email
                }
        
        # Get documents count
        documents_count = 0
        try:
            documents = await doc_repo.get_by_transaction_id(tx.id)
            documents_count = len(documents) if documents else 0
        except Exception:
            pass
        
        transactions_list.append({
            'id': tx.id,
            'tx_date': tx.tx_date.isoformat() if tx.tx_date else None,
            'type': tx.type,
            'amount': float(tx.amount),
            'description': tx.description,
            'category': tx.category,
            'notes': tx.notes,
            'created_by_user': created_by_user,
            'file_path': getattr(tx, 'file_path', None),
            'documents_count': documents_count
        })
    
    return {
        'id': fund.id,
        'project_id': fund.project_id,
        'current_balance': float(fund.current_balance),
        'monthly_amount': monthly_amount,
        'last_monthly_addition': fund.last_monthly_addition.isoformat() if fund.last_monthly_addition else None,
        'created_at': fund.created_at.isoformat(),
        'updated_at': fund.updated_at.isoformat(),
        'initial_balance': initial_balance,
        'initial_total': initial_total,  # Initial balance + all monthly additions
        'total_additions': total_additions,  # Total monthly additions made
        'total_deductions': total_deductions,  # Total amount withdrawn from fund
        'transactions': transactions_list
    }

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