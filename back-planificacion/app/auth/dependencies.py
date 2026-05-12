from __future__ import annotations
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from app.config import get_settings

_bearer = HTTPBearer(auto_error=True)


def _decode_token(token: str) -> dict:
    """Decodifica y valida un JWT. Lanza HTTPException si es inválido."""
    s = get_settings()
    try:
        return jwt.decode(token, s.secret_key, algorithms=[s.jwt_algorithm])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_superuser(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """Verifica JWT y que el sujeto sea 'superuser'."""
    payload = _decode_token(credentials.credentials)
    if payload.get("sub") != "superuser":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido al superusuario",
        )
    return payload


def require_any_auth(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """Verifica JWT válido (superusuario o usuario normal)."""
    return _decode_token(credentials.credentials)
