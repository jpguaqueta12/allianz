from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from pydantic import BaseModel

from app.auth.dependencies import require_superuser
from app.config import get_settings

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/auth/login", response_model=TokenResponse, tags=["auth"])
async def login(body: LoginRequest) -> TokenResponse:
    """Autenticación de superusuario. Devuelve un JWT."""
    s = get_settings()

    if body.username != s.super_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    password_matches = bcrypt.checkpw(
        body.password.encode("utf-8"),
        s.super_password_hash.encode("utf-8"),
    )
    if not password_matches:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    expire = datetime.now(timezone.utc) + timedelta(minutes=s.jwt_expire_minutes)
    token = jwt.encode(
        {"sub": "superuser", "exp": expire},
        s.secret_key,
        algorithm=s.jwt_algorithm,
    )

    return TokenResponse(access_token=token)


@router.get("/auth/me", tags=["auth"])
async def me(_: Annotated[dict, Depends(require_superuser)]):
    """Verifica si el token actual es válido."""
    return {"authenticated": True, "role": "superuser"}
