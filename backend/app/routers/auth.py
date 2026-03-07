from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from typing import Optional

from ..models import Token, UserCreate, UserUpdate, User, UserRole
from ..auth import (
    authenticate_user, 
    create_access_token, 
    get_password_hash,
    get_current_admin,
    get_current_user,
    create_refresh_token,
    create_refresh_token_expires_at
)
from ..config import ACCESS_TOKEN_EXPIRE_MINUTES
from ..db_wrapper import create_user, get_user, get_all_users, update_user
from ..db_operations import create_refresh_token as save_refresh_token, get_refresh_token, revoke_refresh_token

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value},
        expires_delta=access_token_expires
    )

    # Create and store refresh token
    refresh_token_str = create_refresh_token()
    refresh_token_expires_at = create_refresh_token_expires_at()
    save_refresh_token(user.username, refresh_token_str, refresh_token_expires_at)

    return {"access_token": access_token, "token_type": "bearer", "refresh_token": refresh_token_str}


@router.post("/register", response_model=dict)
async def register_user(user_data: UserCreate, current_user: User = Depends(get_current_admin)):
    """Register a new user (Admin only)"""
    existing_user = get_user(user_data.username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        username=user_data.username,
        role=user_data.role,
        hashed_password=hashed_password
    )
    create_user(new_user)
    
    return {"message": f"User {user_data.username} created successfully", "role": user_data.role.value}


@router.get("/users", response_model=list)
async def list_users(current_user: User = Depends(get_current_admin)):
    """List all users (Admin only)"""
    return get_all_users()


@router.get("/me", response_model=dict)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user info"""
    return {"username": current_user.username, "role": current_user.role.value}


@router.put("/users/{username}", response_model=dict)
async def update_user_info(
    username: str,
    user_data: UserUpdate,
    current_user: User = Depends(get_current_admin)
):
    """Update user info (Admin only)"""
    existing_user = get_user(username)
    if not existing_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {username} not found"
        )
    
    # Prevent admin from deactivating themselves
    if username == current_user.username and user_data.is_active == False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )
    
    # Hash password if provided
    hashed_password = None
    if user_data.password:
        hashed_password = get_password_hash(user_data.password)
    
    updated = update_user(
        username,
        hashed_password=hashed_password,
        role=user_data.role,
        is_active=user_data.is_active
    )
    
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update user"
        )
    
    return {"message": f"User {username} updated successfully"}


@router.post("/refresh", response_model=Token)
async def refresh_access_token(request: Request, refresh_token: Optional[str] = None):
    """Refresh access token using refresh token from request body"""
    token_str = refresh_token
    if not token_str:
        # Fallback to cookie for backward compatibility
        token_str = request.cookies.get("refresh_token")

    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token required"
        )

    # Validate refresh token
    token_data = get_refresh_token(token_str)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    # Get user to include correct role in new access token
    user = get_user(token_data.user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # Create new access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.value},
        expires_delta=access_token_expires
    )

    # Create new refresh token and revoke old one (token rotation)
    new_refresh_token_str = create_refresh_token()
    new_refresh_token_expires_at = create_refresh_token_expires_at()
    save_refresh_token(token_data.user_id, new_refresh_token_str, new_refresh_token_expires_at)
    revoke_refresh_token(token_str)

    return {"access_token": access_token, "token_type": "bearer", "refresh_token": new_refresh_token_str}


@router.post("/logout")
async def logout(request: Request, refresh_token: Optional[str] = None):
    """Logout user by revoking refresh token"""
    token_str = refresh_token
    if not token_str:
        token_str = request.cookies.get("refresh_token")

    if token_str:
        revoke_refresh_token(token_str)

    return {"message": "Successfully logged out"}
