"""
dependencies.py — Dependencias reutilizables de FastAPI.

Uso en routers:
    current_user: Usuario = Depends(get_current_user)
    admin_user: Usuario = Depends(require_admin)
"""

from typing import Annotated
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from database import get_db
from auth import decode_token, is_token_blacklisted
import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> models.Usuario:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado o token inválido.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_token(token)
    if payload is None:
        raise credentials_exc

    # Verificar blacklist (logout)
    jti = payload.get("jti")
    if jti and is_token_blacklisted(jti):
        raise credentials_exc

    user_id = payload.get("sub")
    if not user_id:
        raise credentials_exc

    user = (
        db.query(models.Usuario)
        .filter(models.Usuario.usuario_id == int(user_id))
        .first()
    )
    if user is None or user.estado != "ACTIVO":
        raise credentials_exc

    return user


def _require_role(*role_names: str):
    """Factoría de dependencias de rol."""
    def checker(current_user: models.Usuario = Depends(get_current_user)) -> models.Usuario:
        user_role = current_user.rol.nombre.lower()
        allowed = [r.lower() for r in role_names]
        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso restringido. Se requiere uno de: {', '.join(role_names)}.",
            )
        return current_user
    return checker


# ── Dependencias de rol específicas ─────────────────────────────────────────

require_admin        = _require_role("administrador", "admin")
require_supervisor   = _require_role("supervisor", "administrador", "admin")
require_asesor       = _require_role("asesor", "supervisor", "administrador", "admin")
require_cliente      = _require_role("cliente-persona", "cliente-empresa", "cliente")
require_staff        = _require_role("asesor", "supervisor", "administrador", "admin")
require_any          = get_current_user   # Cualquier rol autenticado


def get_client_ip(request: Request) -> str:
    return request.client.host if request.client else "0.0.0.0"
