from fastapi import APIRouter, Depends

from backend.core.deps import DBSessionDep, get_current_user, require_roles
from backend.repositories.user_repository import UserRepository
from backend.schemas.user import UserOut
from backend.models.user import UserRole

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_me(current = Depends(get_current_user)):
    return current


@router.get("/", response_model=list[UserOut])
async def list_users(db: DBSessionDep, user = Depends(require_roles(UserRole.ADMIN))):
    return await UserRepository(db).list()
