from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import get_db
from models.user import User
from fastapi.security import OAuth2PasswordRequestForm
from models.user import TokenBlocklist

# FIX: Added create_refresh_token, SECRET_KEY, ALGORITHM, and jose's jwt/JWTError tools
from core.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    verify_password,
    create_access_token,
    create_refresh_token,
    verify_token,
    TokenData,
    SECRET_KEY,
    ALGORITHM,
    jwt,
    JWTError,
)

# FIX: Imported schemas correctly from your schemas module
from schemas.user import UserModel, RefreshTokenRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ------------------- login (ISSUES DUAL TOKENS NOW) ------------------------#
@router.post("/login", response_model=TokenResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    db_user = db.scalar(select(User).where(User.email == form_data.username))
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    if not verify_password(form_data.password, db_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    # Generate the dual token pair to match your new production system architecture
    access_token = create_access_token({"sub": db_user.email})
    refresh_token = create_refresh_token({"sub": db_user.email})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


# ------------------- check_login ----------------------------------------#
@router.get("/me", response_model=UserModel)
def user(token_data: TokenData = Depends(verify_token), db: Session = Depends(get_db)):
    is_blocked = db.scalar(
        select(TokenBlocklist).where(TokenBlocklist.jti == token_data.jti)
    )
    if is_blocked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked . Please log in again.",
        )
    db_user = db.scalar(select(User).where(User.email == token_data.email))
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer exists"
        )
    return db_user


# ------------------- REFRESH SESSION ------------------------------------#
@router.post("/refresh", response_model=TokenResponse)
def refresh_session(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        # Decode using variables cleanly pulled from core.security
        decoded = jwt.decode(payload.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = decoded.get("sub")
        if not email or decoded.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type"
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Expired or broken token"
        )

    db_user = db.scalar(select(User).where(User.email == email))
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    new_access = create_access_token({"sub": db_user.email})
    new_refresh = create_refresh_token({"sub": db_user.email})

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
    }


# ------------------- Logout ------------------------------------#

from datetime import datetime, timezone
from models.user import TokenBlocklist  # Import your new model instance
from jose import jwt
from core.security import SECRET_KEY, ALGORITHM


# ------------------- LOGOUT (REVOKES ACTIVE TOKENS) ------------------------#
# ------------------- LOGOUT (REVOKES ACTIVE TOKENS) ------------------------#
@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(
    payload: RefreshTokenRequest,
    db: Session = Depends(get_db),
    token_data: TokenData = Depends(verify_token),
):
    access_token_jti = token_data.jti

    try:
        decoded_refresh = jwt.decode(
            payload.refresh_token, SECRET_KEY, algorithms=[ALGORITHM]
        )
        email_sub: str | None = decoded_refresh.get("sub")
        token_type: str | None = decoded_refresh.get("type")

        # 1. FIX: Explicitly pull keys and check for existence to eliminate 'None' warnings
        refresh_jti = decoded_refresh.get("jti")
        refresh_exp = decoded_refresh.get("exp")

        # 2. RUNTIME GUARD: Verifies keys exist and are valid types before processing
        if (
            not refresh_jti
            or not refresh_exp
            or not isinstance(refresh_exp, (int, float))
        ):
            raise HTTPException(
                status_code=400, detail="Invalid refresh token metadata structure"
            )

        if email_sub != token_data.email or token_type != "refresh":
            raise HTTPException(
                status_code=400, detail="Invalid refresh token payload mapping match"
            )

    except JWTError:
        raise HTTPException(
            status_code=400, detail="Broken or expired refresh token configuration"
        )

    # 3. Save access token blockage using explicit current datetime bounds
    db_access_block = TokenBlocklist(
        jti=access_token_jti,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )

    # 4. Save refresh token blockage (VS Code is happy because refresh_exp is guaranteed a float/int)
    db_refresh_block = TokenBlocklist(
        jti=refresh_jti, expires_at=datetime.fromtimestamp(refresh_exp, timezone.utc)
    )

    db.add(db_access_block)
    db.add(db_refresh_block)
    db.commit()

    return {"message": "Successfully logged out. Tokens have been completely revoked."}
