from fastapi import APIRouter, Depends, HTTPException, status

from backend.core.deps import DBSessionDep, get_current_user, require_roles, require_admin
from backend.repositories.user_repository import UserRepository
from backend.schemas.user import UserOut
from backend.models.user import UserRole

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_me(current = Depends(get_current_user)):
    return current


@router.get("/", response_model=list[UserOut])
async def list_users(db: DBSessionDep, user = Depends(require_admin())):
    """List all users - Admin only"""
    return await UserRepository(db).list()


@router.get("/profile", response_model=UserOut)
async def get_user_profile(db: DBSessionDep, current_user = Depends(get_current_user)):
    """Get current user profile"""
    return current_user


@router.delete("/{user_id}")
async def delete_user(user_id: int, db: DBSessionDep, current_admin = Depends(require_admin())):
    """Delete user - Admin only"""
    user_repo = UserRepository(db)
    
    # Check if user exists
    user = await user_repo.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent admin from deleting themselves
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete yourself"
        )
    
    await user_repo.delete(user)
    return {"message": "User deleted successfully"}
