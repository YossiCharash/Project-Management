from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from backend.db.session import get_db
from backend.core.security import decode_token
from backend.repositories.user_repository import UserRepository
from backend.models.user import UserRole


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


DBSessionDep = Annotated[AsyncSession, Depends(get_db)]


async def get_current_user(db: DBSessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user_id = int(payload["sub"]) 
    user = await UserRepository(db).get_by_id(user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive user")
    return user


def require_roles(*roles: UserRole | str):
    async def _role_dep(user = Depends(get_current_user)):
        allowed = {r.value if hasattr(r, "value") else r for r in roles}
        if allowed and user.role not in allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user
    return _role_dep
