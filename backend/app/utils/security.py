from datetime import datetime, timedelta, timezone
import hashlib
import hmac
import secrets
import string
import uuid

from jose import jwt, JWTError

from app.config import settings


# =========================================================
# PASSWORD HASH
# =========================================================

def hash_password(password: str) -> str:
    """
    Hash simple y consistente para el proyecto académico.
    Formato guardado en SQL:
    sha256$<hash>
    """
    password = password or ""
    digest = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return f"sha256${digest}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Valida contraseñas guardadas como:
    sha256$<hash>
    """
    plain_password = plain_password or ""
    hashed_password = hashed_password or ""

    if hashed_password.startswith("sha256$"):
        expected = hash_password(plain_password)
        return hmac.compare_digest(expected, hashed_password)

    return False


# =========================================================
# CONFIG JWT
# =========================================================

def _get_secret_key() -> str:
    return getattr(settings, "JWT_SECRET_KEY", "claro360_secret_key")


def _get_algorithm() -> str:
    return getattr(settings, "JWT_ALGORITHM", "HS256")


def _get_access_minutes() -> int:
    return int(getattr(settings, "ACCESS_TOKEN_EXPIRE_MINUTES", 60))


def _get_refresh_days() -> int:
    return int(getattr(settings, "REFRESH_TOKEN_EXPIRE_DAYS", 7))


def generate_jti() -> str:
    """
    Genera identificador único del token.
    """
    return uuid.uuid4().hex


# =========================================================
# JWT TOKENS
# =========================================================

def create_access_token(data=None, expires_delta: timedelta | None = None, **kwargs) -> str:
    """
    Crea token de acceso.

    Soporta:
    create_access_token({"sub": "1", "rol": "ADMINISTRADOR"})
    create_access_token(user_id=1, rol="ADMINISTRADOR")
    create_access_token(1)
    """

    to_encode = {}

    if isinstance(data, dict):
        to_encode.update(data)
    elif data is not None:
        to_encode["sub"] = str(data)

    to_encode.update(kwargs)

    if "user_id" in to_encode and "sub" not in to_encode:
        to_encode["sub"] = str(to_encode["user_id"])

    if "usuario_id" in to_encode and "sub" not in to_encode:
        to_encode["sub"] = str(to_encode["usuario_id"])

    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=_get_access_minutes())
    )

    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
        "jti": to_encode.get("jti") or generate_jti()
    })

    return jwt.encode(
        to_encode,
        _get_secret_key(),
        algorithm=_get_algorithm()
    )


def create_refresh_token(data=None, expires_delta: timedelta | None = None, **kwargs) -> str:
    """
    Crea token de refresco.
    """

    to_encode = {}

    if isinstance(data, dict):
        to_encode.update(data)
    elif data is not None:
        to_encode["sub"] = str(data)

    to_encode.update(kwargs)

    if "user_id" in to_encode and "sub" not in to_encode:
        to_encode["sub"] = str(to_encode["user_id"])

    if "usuario_id" in to_encode and "sub" not in to_encode:
        to_encode["sub"] = str(to_encode["usuario_id"])

    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(days=_get_refresh_days())
    )

    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "jti": to_encode.get("jti") or generate_jti()
    })

    return jwt.encode(
        to_encode,
        _get_secret_key(),
        algorithm=_get_algorithm()
    )


def decode_token(token: str) -> dict:
    """
    Decodifica token JWT.
    """
    try:
        return jwt.decode(
            token,
            _get_secret_key(),
            algorithms=[_get_algorithm()]
        )
    except JWTError:
        return {}


def decode_access_token(token: str) -> dict:
    """
    Decodifica token de acceso.
    """
    payload = decode_token(token)

    if payload.get("type") != "access":
        return {}

    return payload


def decode_refresh_token(token: str) -> dict:
    """
    Decodifica token de refresco.
    """
    payload = decode_token(token)

    if payload.get("type") != "refresh":
        return {}

    return payload


def get_token_jti(token: str | None = None) -> str:
    """
    Obtiene el JTI de un token.
    Si no recibe token, genera uno nuevo.
    Esto evita errores si auth/service.py lo usa para refresh tokens.
    """

    if not token:
        return generate_jti()

    payload = decode_token(token)

    return payload.get("jti") or generate_jti()


def get_token_subject(token: str) -> str | None:
    """
    Obtiene el sub del token.
    """
    payload = decode_token(token)
    return payload.get("sub")


def hash_token(token: str) -> str:
    """
    Hash para guardar refresh token en BD.
    """
    token = token or ""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


# =========================================================
# CÓDIGOS TEMPORALES / OTP
# =========================================================

def generate_numeric_code(length: int = 6) -> str:
    """
    Genera código numérico.
    """
    return "".join(secrets.choice(string.digits) for _ in range(length))


def generate_otp_code(length: int = 6) -> str:
    """
    Alias para código OTP.
    """
    return generate_numeric_code(length)


def generate_random_password(length: int = 12) -> str:
    """
    Genera contraseña temporal.
    """
    alphabet = string.ascii_letters + string.digits + "*#@$"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def generate_secure_token(length: int = 48) -> str:
    """
    Genera token seguro aleatorio para recuperación, verificación u otros usos.
    """
    return secrets.token_urlsafe(length)

# =========================================================
# HASH GENÉRICO PARA VALORES PLANOS
# =========================================================

def hash_plain_value(value: str) -> str:
    """
    Genera hash SHA256 para valores simples:
    tokens, códigos, correos u otros textos.
    """
    value = value or ""
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def verify_plain_value(plain_value: str, hashed_value: str) -> bool:
    """
    Compara un valor plano contra su hash SHA256.
    """
    plain_value = plain_value or ""
    hashed_value = hashed_value or ""

    expected = hash_plain_value(plain_value)
    return hmac.compare_digest(expected, hashed_value)