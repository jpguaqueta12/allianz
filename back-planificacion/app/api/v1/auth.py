from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from pydantic import BaseModel

from app.auth.dependencies import require_superuser, _decode_token
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
    """Autenticación. Verifica credenciales contra la tabla dbo.usuarios."""
    from app.db.connection import get_pool
    s = get_settings()

    pool = get_pool()
    row = await pool.fetchrow(
        "SELECT password_hash, rol FROM dbo.usuarios WHERE username=$1 AND activo=1",
        body.username,
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    if not bcrypt.checkpw(body.password.encode("utf-8"), row["password_hash"].encode("utf-8")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
        )

    expire = datetime.now(timezone.utc) + timedelta(minutes=s.jwt_expire_minutes)
    token = jwt.encode(
        {"sub": row["rol"], "exp": expire},
        s.secret_key,
        algorithm=s.jwt_algorithm,
    )

    return TokenResponse(access_token=token)


@router.get("/auth/me", tags=["auth"])
async def me(payload: Annotated[dict, Depends(require_superuser)]):
    """Verifica si el token actual es válido (superusuario)."""
    return {"authenticated": True, "role": "superuser"}


@router.get("/auth/me/any", tags=["auth"])
async def me_any(credentials: Annotated[HTTPAuthorizationCredentials, Depends(HTTPBearer(auto_error=True))]):
    """Verifica si cualquier token válido está activo (superusuario o usuario normal)."""
    from app.auth.dependencies import _decode_token
    payload = _decode_token(credentials.credentials)
    return {"authenticated": True, "role": payload.get("sub")}
