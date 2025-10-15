from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.security import verify_password, hash_password, create_access_token
from backend.app.repositories.user_repository import UserRepository
from backend.app.models.user import User, UserRole


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.users = UserRepository(db)

    async def authenticate(self, email: str, password: str) -> str:
        user = await self.users.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        return create_access_token(user.id)

    async def register(self, email: str, full_name: str, password: str, role: str = UserRole.VIEWER.value) -> User:
        existing = await self.users.get_by_email(email)
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
        user = User(email=email, full_name=full_name, hashed_password=hash_password(password), role=role)
        return await self.users.create(user)
