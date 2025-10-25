from fastapi import APIRouter, Depends, HTTPException, status
from typing import List

from backend.core.deps import DBSessionDep, require_admin, get_current_user
from backend.schemas.group_code import GroupCodeCreate, GroupCodeOut, GroupCodeList
from backend.services.group_code_service import GroupCodeService
from backend.models.user import User


router = APIRouter()


@router.post("/", response_model=GroupCodeOut)
async def create_group_code(
    db: DBSessionDep, 
    group_data: GroupCodeCreate, 
    current_admin: User = Depends(require_admin())
):
    """Create a new group code - Admin only"""
    service = GroupCodeService(db)
    group_code = await service.create_group_code(group_data, current_admin.id)
    return group_code


@router.get("/", response_model=List[GroupCodeList])
async def list_group_codes(
    db: DBSessionDep, 
    current_admin: User = Depends(require_admin())
):
    """List all group codes - Admin only"""
    service = GroupCodeService(db)
    group_codes = await service.list_group_codes(current_admin.id)
    return group_codes


@router.get("/{code}", response_model=GroupCodeOut)
async def get_group_code(
    code: str,
    db: DBSessionDep,
    current_admin: User = Depends(require_admin())
):
    """Get group code by code - Admin only"""
    service = GroupCodeService(db)
    group_code = await service.get_group_code_by_code(code)
    return group_code


@router.put("/{group_code_id}", response_model=GroupCodeOut)
async def update_group_code(
    group_code_id: int,
    group_data: GroupCodeCreate,
    db: DBSessionDep,
    current_admin: User = Depends(require_admin())
):
    """Update group code - Admin only"""
    service = GroupCodeService(db)
    group_code = await service.update_group_code(group_code_id, group_data, current_admin.id)
    return group_code


@router.delete("/{group_code_id}")
async def delete_group_code(
    group_code_id: int,
    db: DBSessionDep,
    current_admin: User = Depends(require_admin())
):
    """Delete group code - Admin only"""
    service = GroupCodeService(db)
    await service.delete_group_code(group_code_id, current_admin.id)
    return {"message": "Group code deleted successfully"}
