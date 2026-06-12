"""
auth.py — Utilidades de autenticación JWT y hashing de contraseñas.
"""

import uuid
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── Contraseñas ──────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ──────────────────────────────────────────────────────────────────────

def create_access_token(
    user_id: int,
    role: str,
    username: str,
    expires_delta: Optional[timedelta] = None
) -> tuple[str, str]:
    """
    Crea un JWT y retorna (token, jti).
    jti es un ID único del token para poder invalidarlo (logout).
    """
    jti = str(uuid.uuid4())
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload = {
        "sub": str(user_id),
        "role": role,
        "username": username,
        "jti": jti,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, jti


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


# ── OTP en memoria (para desarrollo) ────────────────────────────────────────
# En producción: guardar en Redis o en una tabla de BD

_otp_store: dict[str, dict] = {}     # { correo: { code, expires, user_id } }
_reset_store: dict[str, dict] = {}   # { token: { user_id, expires } }


def store_otp(correo: str, code: str, user_id: int, ttl_minutes: int = 5):
    _otp_store[correo.lower()] = {
        "code": code,
        "expires": datetime.utcnow() + timedelta(minutes=ttl_minutes),
        "user_id": user_id,
    }


def verify_otp(correo: str, code: str) -> Optional[int]:
    """
    Verifica el OTP para el correo dado.
    Retorna user_id si es válido, None si no.
    En DEV acepta "123456" para cualquier correo.
    """
    # Código demo universal
    if code == "123456":
        entry = _otp_store.get(correo.lower())
        return entry["user_id"] if entry else None

    entry = _otp_store.get(correo.lower())
    if not entry:
        return None
    if datetime.utcnow() > entry["expires"]:
        _otp_store.pop(correo.lower(), None)
        return None
    if entry["code"] != code:
        return None

    _otp_store.pop(correo.lower(), None)
    return entry["user_id"]


def get_otp_user_id(correo: str) -> Optional[int]:
    entry = _otp_store.get(correo.lower())
    return entry["user_id"] if entry else None


def store_reset_token(token: str, user_id: int, ttl_minutes: int = 30):
    _reset_store[token] = {
        "user_id": user_id,
        "expires": datetime.utcnow() + timedelta(minutes=ttl_minutes),
    }


def verify_reset_token(token: str) -> Optional[int]:
    entry = _reset_store.get(token)
    if not entry:
        return None
    if datetime.utcnow() > entry["expires"]:
        _reset_store.pop(token, None)
        return None
    _reset_store.pop(token, None)
    return entry["user_id"]


# ── Tokens invalidados (logout) ─────────────────────────────────────────────
_blacklist: set[str] = set()


def blacklist_token(jti: str):
    _blacklist.add(jti)


def is_token_blacklisted(jti: str) -> bool:
    return jti in _blacklist
