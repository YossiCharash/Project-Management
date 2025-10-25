from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from backend.core.deps import DBSessionDep, require_admin, get_current_user
from backend.schemas.auth import (
    Token, LoginInput, RefreshTokenInput, PasswordResetRequest, 
    PasswordReset, ChangePassword, UserProfile
)
from backend.schemas.user import UserOut, AdminRegister, MemberRegister
from backend.services.auth_service import AuthService

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/login", response_model=Token)
async def login(db: DBSessionDep, login_data: LoginInput):
    """Login endpoint - accepts email and password"""
    token = await AuthService(db).authenticate(email=login_data.email, password=login_data.password)
    return {"access_token": token, "token_type": "bearer", "expires_in": 1440, "refresh_token": None}


@router.post("/token", response_model=Token)
async def login_access_token(db: DBSessionDep, form_data: OAuth2PasswordRequestForm = Depends()):
    """OAuth2 compatible login endpoint"""
    token = await AuthService(db).authenticate(email=form_data.username, password=form_data.password)
    return {"access_token": token, "token_type": "bearer"}


@router.post("/register-admin", response_model=UserOut)
async def register_admin(db: DBSessionDep, admin_data: AdminRegister, current_admin = Depends(require_admin())):
    """Register new admin - Admin only"""
    user = await AuthService(db).register_admin(
        email=admin_data.email,
        full_name=admin_data.full_name,
        password=admin_data.password
    )
    return user


@router.post("/register-super-admin", response_model=UserOut)
async def register_super_admin(db: DBSessionDep, admin_data: AdminRegister):
    """Register super admin - Only allowed if no admin exists (initial setup)"""
    # Check if any admin exists
    auth_service = AuthService(db)
    admin_exists = await auth_service.check_admin_exists()
    
    # Only allow if no admin exists (initial setup)
    if admin_exists:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Super admin registration is only allowed for initial setup."
        )
    
    user = await auth_service.register_admin(
        email=admin_data.email,
        full_name=admin_data.full_name,
        password=admin_data.password
    )
    return user


@router.post("/register-member", response_model=UserOut)
async def register_member(db: DBSessionDep, member_data: MemberRegister, current_admin = Depends(require_admin())):
    """Register new member - only accessible by admin"""
    user = await AuthService(db).register_member(
        email=member_data.email,
        full_name=member_data.full_name,
        password=member_data.password,
        group_id=member_data.group_id
    )
    return user


@router.post("/refresh", response_model=Token)
async def refresh_token(db: DBSessionDep, refresh_data: RefreshTokenInput):
    """Refresh access token using refresh token"""
    from backend.core.security import decode_token, create_token_pair
    
    payload = decode_token(refresh_data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = int(payload.get("sub"))
    auth_service = AuthService(db)
    user = await auth_service.get_user_by_id(user_id)
    
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    return create_token_pair(user_id, False)


@router.post("/logout")
async def logout():
    """Logout endpoint - client should remove tokens"""
    return {"message": "Successfully logged out"}


@router.post("/forgot-password")
async def forgot_password(db: DBSessionDep, request: PasswordResetRequest):
    """Request password reset"""
    auth_service = AuthService(db)
    user = await auth_service.get_user_by_email(request.email)
    
    if user:
        # In a real app, you would send an email here
        reset_token = await auth_service.create_password_reset_token(user.email)
        # For now, just return success (in production, send email)
        return {"message": "If the email exists, a reset link has been sent"}
    
    # Always return success to prevent email enumeration
    return {"message": "If the email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(db: DBSessionDep, reset_data: PasswordReset):
    """Reset password using reset token"""
    from backend.core.security import verify_password_reset_token
    
    email = verify_password_reset_token(reset_data.token)
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    auth_service = AuthService(db)
    user = await auth_service.get_user_by_email(email)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found"
        )
    
    await auth_service.update_password(user.id, reset_data.new_password)
    return {"message": "Password updated successfully"}


@router.post("/change-password")
async def change_password(
    db: DBSessionDep, 
    password_data: ChangePassword, 
    current_user = Depends(get_current_user)
):
    """Change password for authenticated user"""
    auth_service = AuthService(db)
    
    # Verify current password
    if not auth_service.verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    await auth_service.update_password(current_user.id, password_data.new_password)
    return {"message": "Password updated successfully"}


@router.get("/profile", response_model=UserProfile)
async def get_profile(db: DBSessionDep, current_user = Depends(get_current_user)):
    """Get current user profile with enhanced information"""
    return UserProfile(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )
