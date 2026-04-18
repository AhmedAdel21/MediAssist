from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from auth.dependencies import get_current_user
from auth.models import RefreshRequest, TokenResponse, UserLogin, UserRegister, UserResponse
from auth.service import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    create_user,
    decode_token,
    get_user_by_email,
    get_user_by_id,
)
from config import settings
from database import get_db
from logging_config import get_logger

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
logger = get_logger(__name__)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    existing = await get_user_by_email(db, data.email)
    if existing:
        logger.warning("Registration failed — email already exists: %s", data.email)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = await create_user(db, data)
    logger.info("User registered: id=%s role=%s email=%s", user.id, user.role, user.email)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    user = await authenticate_user(db, data.email, data.password)
    if not user:
        logger.warning("Login failed — invalid credentials for email: %s", data.email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    payload = {"sub": user.id, "role": user.role}
    logger.info("Login successful: id=%s role=%s email=%s", user.id, user.role, user.email)
    return TokenResponse(
        access_token=create_access_token(payload),
        refresh_token=create_refresh_token(payload),
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decode_token(data.refresh_token)
        if payload.get("type") != "refresh":
            logger.warning("Token refresh failed — wrong token type")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id: str = payload.get("sub")
    except JWTError:
        logger.warning("Token refresh failed — invalid or expired refresh token")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    user = await get_user_by_id(db, user_id)
    if not user or not user.is_active:
        logger.warning("Token refresh failed — user not found or inactive: id=%s", user_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    new_payload = {"sub": user.id, "role": user.role}
    logger.info("Token refreshed: id=%s role=%s", user.id, user.role)
    return TokenResponse(
        access_token=create_access_token(new_payload),
        refresh_token=create_refresh_token(new_payload),
        expires_in=settings.access_token_expire_minutes * 60,
    )


@router.get("/me", response_model=UserResponse)
async def me(current_user=Depends(get_current_user)):
    logger.debug("GET /me: id=%s role=%s", current_user.id, current_user.role)
    return current_user
