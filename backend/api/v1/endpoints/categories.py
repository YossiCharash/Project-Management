from fastapi import APIRouter, Depends, HTTPException, Query
from backend.core.deps import DBSessionDep, get_current_user, require_admin
from backend.models.category import Category
from backend.repositories.category_repository import CategoryRepository
from backend.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from backend.services.audit_service import AuditService

router = APIRouter()


@router.get("/", response_model=list[CategoryOut])
async def list_categories(
    db: DBSessionDep,
    include_inactive: bool = Query(False),
    user = Depends(get_current_user)
):
    """List all categories - accessible to all authenticated users"""
    return await CategoryRepository(db).list(include_inactive=include_inactive)


@router.get("/{category_id}", response_model=CategoryOut)
async def get_category(
    category_id: int,
    db: DBSessionDep,
    user = Depends(get_current_user)
):
    """Get category by ID - accessible to all authenticated users"""
    repo = CategoryRepository(db)
    category = await repo.get(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.post("/", response_model=CategoryOut)
async def create_category(
    data: CategoryCreate,
    db: DBSessionDep,
    user = Depends(require_admin())
):
    """Create a new category - Admin only"""
    repo = CategoryRepository(db)
    
    # Validate that category name doesn't already exist
    existing = await repo.get_by_name(data.name)
    if existing:
        raise HTTPException(
            status_code=422,
            detail=[{
                "type": "value_error",
                "loc": ["body", "name"],
                "msg": "קטגוריה עם שם זה כבר קיימת",
                "input": data.name
            }]
        )
    
    category = Category(**data.model_dump())
    created_category = await repo.create(category)
    
    # Log create action
    await AuditService(db).log_action(
        user_id=user.id,
        action='create',
        entity='category',
        entity_id=str(created_category.id),
        details={'name': created_category.name}
    )
    
    return created_category


@router.put("/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: int,
    data: CategoryUpdate,
    db: DBSessionDep,
    user = Depends(require_admin())
):
    """Update a category - Admin only"""
    repo = CategoryRepository(db)
    category = await repo.get(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Validate that updated category name doesn't already exist
    if data.name and data.name != category.name:
        existing = await repo.get_by_name(data.name)
        if existing:
            raise HTTPException(
                status_code=422,
                detail=[{
                    "type": "value_error",
                    "loc": ["body", "name"],
                    "msg": "קטגוריה עם שם זה כבר קיימת",
                    "input": data.name
                }]
            )
    
    # Update fields
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(category, key, value)
    
    updated_category = await repo.update(category)
    
    # Log update action
    await AuditService(db).log_action(
        user_id=user.id,
        action='update',
        entity='category',
        entity_id=str(updated_category.id),
        details={'name': updated_category.name}
    )
    
    return updated_category


@router.delete("/{category_id}")
async def delete_category(
    category_id: int,
    db: DBSessionDep,
    user = Depends(require_admin())
):
    """Delete a category (soft delete) - Admin only"""
    repo = CategoryRepository(db)
    category = await repo.get(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Log delete action before soft delete
    await AuditService(db).log_action(
        user_id=user.id,
        action='delete',
        entity='category',
        entity_id=str(category.id),
        details={'name': category.name}
    )
    
    await repo.delete(category)
    return {"message": "Category deleted successfully"}

