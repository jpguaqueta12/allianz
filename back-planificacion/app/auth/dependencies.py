from __future__ import annotations
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from app.config import get_settings

_bearer = HTTPBearer(auto_error=True)


def require_superuser(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> dict:
    """Dependencia FastAPI: verifica JWT y que el sujeto sea 'superuser'."""
    s = get_settings()
    try:
        payload = jwt.decode(
            credentials.credentials,
            s.secret_key,
            algorithms=[s.jwt_algorithm],
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if payload.get("sub") != "superuser":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido al superusuario",
        )

    return payload
