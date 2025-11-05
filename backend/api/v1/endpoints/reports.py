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
    """Get all transactions for a specific project (including recurring ones)"""
    # Use raw SQL query to avoid SQLAlchemy model issues when columns are missing
    from sqlalchemy import text
    from datetime import datetime
    
    try:
        # Try query with all columns first, fallback if columns don't exist
        try:
            # Query with all columns including recurring fields
            query = text("""
                SELECT 
                    id, project_id, tx_date, type, amount, description, category, notes,
                    is_exceptional, file_path, created_at,
                    recurring_template_id, is_generated
                FROM transactions 
                WHERE project_id = :project_id
                ORDER BY tx_date DESC
            """)
            result = await db.execute(query, {"project_id": project_id})
            rows = result.fetchall()
            has_recurring_fields = True
        except Exception:
            # If columns don't exist, query without them
            query = text("""
                SELECT 
                    id, project_id, tx_date, type, amount, description, category, notes,
                    is_exceptional, file_path, created_at
                FROM transactions 
                WHERE project_id = :project_id
                ORDER BY tx_date DESC
            """)
            result = await db.execute(query, {"project_id": project_id})
            rows = result.fetchall()
            has_recurring_fields = False
        
        # Convert rows to dict format
        transactions = []
        for row in rows:
            try:
                # Convert row to dict - handle both Row and dict-like objects
                if hasattr(row, '_mapping'):
                    row_dict = dict(row._mapping)
                elif hasattr(row, '_asdict'):
                    row_dict = row._asdict()
                elif isinstance(row, dict):
                    row_dict = row
                else:
                    # Fallback: try to access attributes directly
                    row_dict = {}
                    for attr in ['id', 'project_id', 'tx_date', 'type', 'amount', 'description', 
                               'category', 'notes', 'is_exceptional', 'file_path', 'created_at',
                               'recurring_template_id', 'is_generated']:
                        if hasattr(row, attr):
                            row_dict[attr] = getattr(row, attr)
                
                tx_dict = {
                    "id": row_dict.get('id'),
                    "project_id": row_dict.get('project_id'),
                    "tx_date": row_dict.get('tx_date'),
                    "type": row_dict.get('type'),
                    "amount": float(row_dict.get('amount', 0)),
                    "description": row_dict.get('description'),
                    "category": row_dict.get('category'),
                    "notes": row_dict.get('notes'),
                    "is_exceptional": row_dict.get('is_exceptional', False),
                    "is_generated": row_dict.get('is_generated', False) if has_recurring_fields else False,
                    "file_path": row_dict.get('file_path'),
                    "created_at": row_dict.get('created_at') or datetime.utcnow()
                }
                transactions.append(tx_dict)
            except Exception:
                continue
        
        # Convert to TransactionOut schemas
        from backend.schemas.transaction import TransactionOut
        return [TransactionOut.model_validate(tx) for tx in transactions]
        
    except Exception as e:
        import traceback
        # If raw SQL fails (e.g., columns don't exist), try fallback method
        try:
            from backend.repositories.transaction_repository import TransactionRepository
            from backend.schemas.transaction import TransactionOut
            
            transactions = await TransactionRepository(db).list_by_project(project_id)
            result = []
            for tx in transactions:
                try:
                    # Use getattr with safe defaults
                    tx_dict = {
                        "id": tx.id,
                        "project_id": tx.project_id,
                        "tx_date": tx.tx_date,
                        "type": tx.type,
                        "amount": float(tx.amount),
                        "description": tx.description,
                        "category": tx.category,
                        "notes": tx.notes,
                        "is_exceptional": getattr(tx, 'is_exceptional', False),
                        "is_generated": getattr(tx, 'is_generated', False),
                        "file_path": getattr(tx, 'file_path', None),
                        "created_at": getattr(tx, 'created_at', None) or datetime.utcnow()
                    }
                    result.append(TransactionOut.model_validate(tx_dict))
                except Exception:
                    continue
            return result
        except Exception:
            return []
