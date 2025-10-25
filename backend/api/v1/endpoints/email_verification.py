from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from backend.core.deps import DBSessionDep
from backend.schemas.email_verification import (
    EmailVerificationRequest, 
    EmailVerificationConfirm, 
    EmailVerificationStatus
)
from backend.repositories.email_verification_repository import EmailVerificationRepository
from backend.repositories.group_code_repository import GroupCodeRepository
from backend.services.email_service import EmailService
from backend.services.auth_service import AuthService
from backend.models.email_verification import EmailVerification
from backend.models.user import UserRole


router = APIRouter()


@router.post("/send", response_model=EmailVerificationStatus)
async def send_verification_email(
    db: DBSessionDep,
    request: EmailVerificationRequest
):
    """Send email verification code"""
    verification_repo = EmailVerificationRepository(db)
    email_service = EmailService()
    
    # Check if user already exists
    auth_service = AuthService(db)
    existing_user = await auth_service.get_user_by_email(request.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    # Check if there's already a pending verification
    existing_verification = await verification_repo.get_by_email_and_type(
        request.email, 
        request.verification_type
    )
    
    if existing_verification and not existing_verification.is_expired():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code already sent. Please wait before requesting another."
        )
    
    # Validate group code for member registration
    group_id = None
    if request.verification_type == 'member_register':
        if not request.group_code:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Group code is required for member registration"
            )
        
        # Validate group code
        group_code_repo = GroupCodeRepository(db)
        group_code = await group_code_repo.get_by_code(request.group_code)
        if not group_code or not group_code.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or inactive group code"
            )
        group_id = group_code.id

    # Create new verification
    verification = EmailVerification.create_verification(
        email=request.email,
        verification_type=request.verification_type,
        full_name=request.full_name,
        group_id=group_id,
        role=UserRole.ADMIN.value if request.verification_type == 'admin_register' else UserRole.MEMBER.value
    )
    
    created_verification = await verification_repo.create(verification)
    
    # Send email
    email_sent = await email_service.send_verification_email(
        email=request.email,
        verification_code=created_verification.verification_code,
        full_name=request.full_name,
        verification_type=request.verification_type
    )
    
    if not email_sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email"
        )
    
    return EmailVerificationStatus(
        email=request.email,
        verification_sent=True,
        message="Verification code sent successfully"
    )


@router.post("/confirm", response_model=dict)
async def confirm_verification(
    db: DBSessionDep,
    request: EmailVerificationConfirm
):
    """Confirm email verification and create user"""
    verification_repo = EmailVerificationRepository(db)
    auth_service = AuthService(db)
    
    # Get verification
    verification = await verification_repo.get_by_code(request.verification_code)
    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid verification code"
        )
    
    # Check if verification is valid
    if not verification.is_valid():
        if verification.is_verified:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has already been used"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code has expired"
            )
    
    # Check email matches
    if verification.email != request.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email does not match verification code"
        )
    
    # Create user based on verification type
    if verification.verification_type == 'admin_register':
        user = await auth_service.register_admin(
            email=verification.email,
            full_name=verification.full_name,
            password=request.password
        )
    elif verification.verification_type == 'member_register':
        user = await auth_service.register_member(
            email=verification.email,
            full_name=verification.full_name,
            password=request.password,
            group_id=verification.group_id
        )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification type"
        )
    
    # Mark verification as used
    verification.is_verified = True
    verification.verified_at = datetime.utcnow()
    await verification_repo.update(verification)
    
    return {
        "message": "Email verified and user created successfully",
        "user_id": user.id,
        "email": user.email
    }
