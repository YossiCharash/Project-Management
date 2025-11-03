from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import date

from backend.core.deps import DBSessionDep, get_current_user
from backend.services.recurring_transaction_service import RecurringTransactionService
from backend.schemas.recurring_transaction import (
    RecurringTransactionTemplateCreate,
    RecurringTransactionTemplateUpdate,
    RecurringTransactionTemplateOut,
    RecurringTransactionTemplateWithTransactions,
    RecurringTransactionInstanceUpdate
)
from backend.schemas.transaction import TransactionOut

router = APIRouter()


@router.get("/project/{project_id}", response_model=List[RecurringTransactionTemplateOut])
async def list_recurring_templates(
    project_id: int, 
    db: DBSessionDep, 
    user = Depends(get_current_user)
):
    """List all recurring transaction templates for a project"""
    templates = await RecurringTransactionService(db).list_templates_by_project(project_id)
    # Convert to schemas to handle enum serialization
    return [RecurringTransactionTemplateOut.model_validate(t) for t in templates]


@router.post("/", response_model=RecurringTransactionTemplateOut)
async def create_recurring_template(
    db: DBSessionDep, 
    data: RecurringTransactionTemplateCreate, 
    user = Depends(get_current_user)
):
    """Create a new recurring transaction template"""
    template = await RecurringTransactionService(db).create_template(data)
    # Convert to schema to handle enum serialization
    return RecurringTransactionTemplateOut.model_validate(template)


@router.get("/{template_id}", response_model=RecurringTransactionTemplateWithTransactions)
async def get_recurring_template(
    template_id: int, 
    db: DBSessionDep, 
    user = Depends(get_current_user)
):
    """Get a recurring transaction template with its generated transactions"""
    template = await RecurringTransactionService(db).get_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Recurring template not found")
    
    transactions = await RecurringTransactionService(db).get_template_transactions(template_id)
    
    # Convert to schema objects
    template_schema = RecurringTransactionTemplateOut.model_validate(template)
    transaction_schemas = [TransactionOut.model_validate(tx) for tx in transactions]
    
    # Create response with transactions
    return RecurringTransactionTemplateWithTransactions(
        **template_schema.model_dump(),
        generated_transactions=transaction_schemas
    )


@router.put("/{template_id}", response_model=RecurringTransactionTemplateOut)
async def update_recurring_template(
    template_id: int, 
    db: DBSessionDep, 
    data: RecurringTransactionTemplateUpdate, 
    user = Depends(get_current_user)
):
    """Update a recurring transaction template"""
    template = await RecurringTransactionService(db).update_template(template_id, data)
    if not template:
        raise HTTPException(status_code=404, detail="Recurring template not found")
    # Convert to schema to handle enum serialization
    return RecurringTransactionTemplateOut.model_validate(template)


@router.delete("/{template_id}")
async def delete_recurring_template(
    template_id: int, 
    db: DBSessionDep, 
    user = Depends(get_current_user)
):
    """Delete a recurring transaction template"""
    success = await RecurringTransactionService(db).delete_template(template_id)
    if not success:
        raise HTTPException(status_code=404, detail="Recurring template not found")
    return {"ok": True}


@router.post("/{template_id}/deactivate", response_model=RecurringTransactionTemplateOut)
async def deactivate_recurring_template(
    template_id: int, 
    db: DBSessionDep, 
    user = Depends(get_current_user)
):
    """Deactivate a recurring transaction template"""
    template = await RecurringTransactionService(db).deactivate_template(template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Recurring template not found")
    # Convert to schema to handle enum serialization
    return RecurringTransactionTemplateOut.model_validate(template)


@router.get("/{template_id}/transactions", response_model=List[TransactionOut])
async def get_template_transactions(
    template_id: int, 
    db: DBSessionDep, 
    user = Depends(get_current_user)
):
    """Get all transactions generated from a specific template"""
    return await RecurringTransactionService(db).get_template_transactions(template_id)


@router.get("/{template_id}/future-occurrences")
async def get_future_occurrences(
    template_id: int,
    db: DBSessionDep,
    start_date: date = Query(..., description="Start date for calculating future occurrences"),
    months_ahead: int = Query(12, ge=1, le=24, description="Number of months to look ahead"),
    user = Depends(get_current_user)
):
    """Get future occurrences of a recurring transaction template"""
    return await RecurringTransactionService(db).get_future_occurrences(
        template_id, start_date, months_ahead
    )


@router.put("/transactions/{transaction_id}", response_model=TransactionOut)
async def update_transaction_instance(
    transaction_id: int, 
    db: DBSessionDep, 
    data: RecurringTransactionInstanceUpdate, 
    user = Depends(get_current_user)
):
    """Update a specific instance of a recurring transaction"""
    transaction = await RecurringTransactionService(db).update_transaction_instance(transaction_id, data)
    if not transaction:
        raise HTTPException(status_code=404, detail="Transaction not found or not a recurring transaction instance")
    # Convert to schema
    return TransactionOut.model_validate(transaction)


@router.delete("/transactions/{transaction_id}")
async def delete_transaction_instance(
    transaction_id: int, 
    db: DBSessionDep, 
    user = Depends(get_current_user)
):
    """Delete a specific instance of a recurring transaction"""
    success = await RecurringTransactionService(db).delete_transaction_instance(transaction_id)
    if not success:
        raise HTTPException(status_code=404, detail="Transaction not found or not a recurring transaction instance")
    return {"ok": True}


@router.post("/generate-all-active")
async def generate_all_active_transactions(
    db: DBSessionDep,
    user = Depends(get_current_user)
):
    """Generate all recurring transactions for all active templates - useful for debugging"""
    try:
        from datetime import date
        today = date.today()
        current_year = today.year
        current_month = today.month
        
        service = RecurringTransactionService(db)
        transactions = await service.generate_transactions_for_month(current_year, current_month)
        
        from backend.schemas.transaction import TransactionOut
        transaction_schemas = [TransactionOut.model_validate(tx) for tx in transactions]
        
        return {
            "generated_count": len(transactions),
            "transactions": transaction_schemas,
            "month": current_month,
            "year": current_year
        }
    except Exception as e:
        import traceback
        raise HTTPException(
            status_code=500,
            detail=f"שגיאה: {str(e)}\n{traceback.format_exc()}"
        )


@router.post("/generate/{year}/{month}")
async def generate_monthly_transactions(
    year: int,
    month: int,
    db: DBSessionDep,
    user = Depends(get_current_user)
):
    """Generate all recurring transactions for a specific month"""
    try:
        service = RecurringTransactionService(db)
        
        # Get all active templates first to debug
        from backend.repositories.recurring_transaction_repository import RecurringTransactionRepository
        recurring_repo = RecurringTransactionRepository(db)
        all_templates = await recurring_repo.list_active_templates()
        
        # Generate transactions
        transactions = await service.generate_transactions_for_month(year, month)
        
        # Convert to TransactionOut schemas
        from backend.schemas.transaction import TransactionOut
        transaction_schemas = [TransactionOut.model_validate(tx) for tx in transactions]
        
        return {
            "generated_count": len(transactions),
            "transactions": transaction_schemas,
            "active_templates_count": len(all_templates),
            "debug_info": {
                "templates_checked": len(all_templates),
                "month": month,
                "year": year
            }
        }
    except AttributeError as e:
        if "recurring_template_id" in str(e):
            raise HTTPException(
                status_code=500,
                detail="הטבלה transactions לא מכילה את השדה recurring_template_id. יש צורך לעדכן את מסד הנתונים."
            )
        raise
    except Exception as e:
        import traceback
        raise HTTPException(
            status_code=500,
            detail=f"שגיאה ביצירת עסקאות מחזוריות: {str(e)}\n{traceback.format_exc()}"
        )
