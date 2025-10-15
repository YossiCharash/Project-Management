from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm

from backend.app.core.deps import DBSessionDep
from backend.app.schemas.auth import Token
from backend.app.schemas.user import UserOut
from backend.app.services.auth_service import AuthService

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/token", response_model=Token)
async def login_access_token(db: DBSessionDep, form_data: OAuth2PasswordRequestForm = Depends()):
    token = await AuthService(db).authenticate(email=form_data.username, password=form_data.password)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/register", response_model=UserOut)
async def register_user(db: DBSessionDep, form_data: OAuth2PasswordRequestForm = Depends()):
    user = await AuthService(db).register(
        email=form_data.username,
        full_name=form_data.username,
        password=form_data.password,
    )
    return user
