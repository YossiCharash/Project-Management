from fastapi import APIRouter, Depends, Query, Response
from datetime import date
import io

from backend.core.deps import DBSessionDep, require_roles, get_current_user
from backend.services.report_service import ReportService
from backend.models.user import UserRole

router = APIRouter()


from backend.schemas.report import ReportOptions, SupplierReportOptions

@router.post("/project/custom-report")
async def generate_custom_report(options: ReportOptions, db: DBSessionDep, user = Depends(get_current_user)):
    """Generate a custom report based on options"""
    try:
        report_service = ReportService(db)
        
        # Determine filename based on project name if possible
        from sqlalchemy import select
        from backend.models.project import Project
        project_result = await db.execute(select(Project.name).where(Project.id == options.project_id))
        project_name = project_result.scalar_one_or_none()
        
        content = await report_service.generate_custom_report(options)
        
        # Build filename: [Project Name] הפרטים
        # Sanitize project name for filename
        safe_project_name = "".join([c for c in (project_name or f"project_{options.project_id}") if c.isalnum() or c in (' ', '-', '_')]).strip()
        filename = f"{safe_project_name} הפרטים"
        
        if options.format == "pdf":
            media_type = "application/pdf"
            filename += ".pdf"
        elif options.format == "excel":
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename += ".xlsx"
        elif options.format == "zip":
            media_type = "application/zip"
            filename += ".zip"
        else:
            raise ValueError("Invalid format")
            
        # URL encode filename for Content-Disposition header to handle non-ASCII chars
        from urllib.parse import quote
        encoded_filename = quote(filename)
            
        headers = {
            'Content-Disposition': f"attachment; filename*=UTF-8''{encoded_filename}"
        }
        return Response(content=content, media_type=media_type, headers=headers)
    except Exception as e:
        import traceback
        print(f"❌ [Report API] Error generating custom report: {str(e)}")
        traceback.print_exc()
        raise


@router.get("/project/{project_id}/export/excel")
async def export_project_excel(project_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """Export project report to Excel"""
    try:
        report_content = await ReportService(db).generate_excel_report(project_id)
        
        headers = {
            'Content-Disposition': f'attachment; filename="project_{project_id}_report.xlsx"'
        }
        return Response(content=report_content, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)
    except Exception as e:
        import traceback
        print(f"❌ [Report API] Error generating Excel report: {str(e)}")
        traceback.print_exc()
        raise


@router.get("/project/{project_id}/export/zip")
async def export_project_zip(project_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """Export project report and documents to ZIP"""
    try:
        zip_content = await ReportService(db).generate_zip_export(project_id)
        
        headers = {
            'Content-Disposition': f'attachment; filename="project_{project_id}_export.zip"'
        }
        return Response(content=zip_content, media_type="application/zip", headers=headers)
    except Exception as e:
        import traceback
        print(f"❌ [Report API] Error generating ZIP export: {str(e)}")
        traceback.print_exc()
        raise


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
    try:
        result = await ReportService(db).get_project_expense_categories(project_id)
        return result
    except Exception as e:
        import traceback
        print(f"❌ [Report API] Error getting expense categories for project {project_id}: {str(e)}")
        traceback.print_exc()
        raise


@router.get("/project/{project_id}/transactions")
async def get_project_transactions(project_id: int, db: DBSessionDep, user = Depends(get_current_user)):
    """Get all transactions for a specific project (including recurring ones)"""
    try:
        # Use raw SQL query to avoid SQLAlchemy model issues when columns are missing
        from sqlalchemy import text
        from datetime import datetime
        import json

        try:
            # Try query with all columns including recurring fields
            try:
                # Query with all columns including recurring fields
                query = text("""
                    SELECT 
                        t.id, t.project_id, t.tx_date, t.type, t.amount, t.description, t.category, t.notes,
                        t.is_exceptional, t.file_path, t.created_at,
                        t.recurring_template_id, t.is_generated,
                        t.payment_method, t.supplier_id, t.created_by_user_id,
                        COALESCE(t.from_fund, false) as from_fund,
                        CASE WHEN u.id IS NOT NULL THEN json_build_object(
                            'id', u.id,
                            'full_name', u.full_name,
                            'email', u.email
                        ) ELSE NULL END AS created_by_user
                    FROM transactions t
                    LEFT JOIN users u ON u.id = t.created_by_user_id
                    WHERE t.project_id = :project_id
                    ORDER BY t.tx_date DESC
                """)
                result = await db.execute(query, {"project_id": project_id})
                rows = result.fetchall()
                has_recurring_fields = True
            except Exception:
                # If columns don't exist, query without them
                # Rollback the failed transaction first
                await db.rollback()
                query = text("""
                    SELECT 
                        t.id, t.project_id, t.tx_date, t.type, t.amount, t.description, t.category, t.notes,
                        t.is_exceptional, t.file_path, t.created_at,
                        t.payment_method, t.supplier_id, t.created_by_user_id,
                        COALESCE(t.from_fund, false) as from_fund,
                        CASE WHEN u.id IS NOT NULL THEN json_build_object(
                            'id', u.id,
                            'full_name', u.full_name,
                            'email', u.email
                        ) ELSE NULL END AS created_by_user
                    FROM transactions t
                    LEFT JOIN users u ON u.id = t.created_by_user_id
                    WHERE t.project_id = :project_id
                    ORDER BY t.tx_date DESC
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
                                   'recurring_template_id', 'is_generated', 'payment_method',
                                   'supplier_id', 'created_by_user_id', 'created_by_user']:
                            if hasattr(row, attr):
                                row_dict[attr] = getattr(row, attr)

                    created_by_user = row_dict.get('created_by_user')
                    if isinstance(created_by_user, str):
                        try:
                            created_by_user = json.loads(created_by_user)
                        except json.JSONDecodeError:
                            created_by_user = None

                    # Get is_generated value - check both is_generated and recurring_template_id
                    is_generated_value = row_dict.get('is_generated', False) if has_recurring_fields else False
                    recurring_template_id = row_dict.get('recurring_template_id', None) if has_recurring_fields else None
                    
                    # If transaction has recurring_template_id but is_generated is False, set it to True
                    if recurring_template_id and not is_generated_value:
                        is_generated_value = True
                    
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
                        "is_generated": is_generated_value,
                        "file_path": row_dict.get('file_path'),
                        "created_at": row_dict.get('created_at') or datetime.utcnow(),
                        "payment_method": row_dict.get('payment_method'),
                        "supplier_id": row_dict.get('supplier_id'),
                        "created_by_user_id": row_dict.get('created_by_user_id'),
                        "from_fund": row_dict.get('from_fund', False),
                        "created_by_user": created_by_user
                    }
                    transactions.append(tx_dict)
                except Exception:
                    continue

            # Convert to TransactionOut schemas
            from backend.schemas.transaction import TransactionOut
            result = [TransactionOut.model_validate(tx) for tx in transactions]
            return result
        except Exception:
            # If raw SQL fails (e.g., columns don't exist), try fallback method
            try:
                # Rollback the failed transaction first
                await db.rollback()
                
                from backend.repositories.transaction_repository import TransactionRepository
                from backend.schemas.transaction import TransactionOut

                transactions = await TransactionRepository(db).list_by_project(project_id)
                result = []
                for tx in transactions:
                    try:
                        created_by_user_obj = getattr(tx, 'created_by_user', None)
                        if created_by_user_obj:
                            created_by_user = {
                                'id': getattr(created_by_user_obj, 'id', None),
                                'full_name': getattr(created_by_user_obj, 'full_name', None),
                                'email': getattr(created_by_user_obj, 'email', None),
                            }
                        else:
                            created_by_user = None

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
                            "created_at": getattr(tx, 'created_at', None) or datetime.utcnow(),
                            "payment_method": getattr(tx, 'payment_method', None),
                            "supplier_id": getattr(tx, 'supplier_id', None),
                            "created_by_user_id": getattr(tx, 'created_by_user_id', None),
                            "from_fund": getattr(tx, 'from_fund', False),
                            "created_by_user": created_by_user
                        }
                        result.append(TransactionOut.model_validate(tx_dict))
                    except Exception:
                        continue
                return result
            except Exception as e2:
                import traceback
                traceback.print_exc()
                return []
    except Exception as e:
        import traceback
        print(f"❌ [Report API] Error getting transactions for project {project_id}: {str(e)}")
        traceback.print_exc()
        raise


@router.post("/supplier/{supplier_id}/custom-report")
async def generate_supplier_report(
    supplier_id: int,
    options: SupplierReportOptions,
    db: DBSessionDep,
    user = Depends(get_current_user)
):
    """Generate a custom report for a specific supplier with all their transactions"""
    try:
        # Override supplier_id from path
        options.supplier_id = supplier_id
        
        report_service = ReportService(db)
        
        # Get supplier name for filename
        from sqlalchemy import select
        from backend.models.supplier import Supplier
        supplier_result = await db.execute(select(Supplier.name).where(Supplier.id == supplier_id))
        supplier_name = supplier_result.scalar_one_or_none()
        
        content = await report_service.generate_supplier_report(options)
        
        # Build filename
        safe_supplier_name = "".join([c for c in (supplier_name or f"supplier_{supplier_id}") if c.isalnum() or c in (' ', '-', '_')]).strip()
        filename = f"{safe_supplier_name} דוח"
        
        if options.format == "pdf":
            media_type = "application/pdf"
            filename += ".pdf"
        elif options.format == "excel":
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename += ".xlsx"
        elif options.format == "zip":
            media_type = "application/zip"
            filename += ".zip"
        else:
            raise ValueError("פורמט לא תקין")
        
        from urllib.parse import quote
        encoded_filename = quote(filename)
        
        headers = {
            'Content-Disposition': f"attachment; filename*=UTF-8''{encoded_filename}"
        }
        return Response(content=content, media_type=media_type, headers=headers)
    except Exception as e:
        import traceback
        print(f"❌ [Report API] Error generating supplier report: {str(e)}")
        traceback.print_exc()
        raise


@router.get("/expenses-by-date")
async def get_expenses_by_transaction_date(
    db: DBSessionDep,
    project_id: int | None = Query(None, description="Filter by project ID"),
    start_date: date | None = Query(None, description="Start date for filtering"),
    end_date: date | None = Query(None, description="End date for filtering"),
    user = Depends(get_current_user)
):
    """
    Get expenses aggregated by transaction date for dashboard.
    Shows expenses related to specific transaction dates with aggregation.
    Accessible to all authenticated users.
    """
    try:
        result = await ReportService(db).get_expenses_by_transaction_date(
            project_id=project_id,
            start_date=start_date,
            end_date=end_date
        )
        return result
    except Exception as e:
        import traceback
        print(f"❌ [Report API] Error getting expenses by date: {str(e)}")
        traceback.print_exc()
        raise
