from datetime import datetime, timedelta

from fastapi import HTTPException

from app.database import fetch_one, execute
from app.utils.security import (
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_token,
    generate_numeric_code,
    hash_plain_value,
)


# =========================================================
# MAPEO OFICIAL DE ROLES
# =========================================================

FRONT_ROLE_TO_DB_ROLE = {
    "cliente-persona": "CLIENTE_PERSONA",
    "cliente-empresa": "CLIENTE_EMPRESA",
    "asesor": "ASESOR",
    "supervisor": "SUPERVISOR",
    "admin": "ADMINISTRADOR",

    "CLIENTE_PERSONA": "CLIENTE_PERSONA",
    "CLIENTE_EMPRESA": "CLIENTE_EMPRESA",
    "ASESOR": "ASESOR",
    "SUPERVISOR": "SUPERVISOR",
    "ADMINISTRADOR": "ADMINISTRADOR",
}


DB_ROLE_TO_FRONT_ROLE = {
    "CLIENTE_PERSONA": "cliente-persona",
    "CLIENTE_EMPRESA": "cliente-empresa",
    "ASESOR": "asesor",
    "SUPERVISOR": "supervisor",
    "ADMINISTRADOR": "admin",
}


ROLE_REDIRECTS = {
    "CLIENTE_PERSONA": "cliente/dashboard.html",
    "CLIENTE_EMPRESA": "cliente/dashboard.html",
    "ASESOR": "asesor/dashboard.html",
    "SUPERVISOR": "supervisor/dashboard.html",
    "ADMINISTRADOR": "admin/dashboard.html",
}


def normalize_role(selected_role: str) -> str:
    selected_role = (selected_role or "").strip()

    db_role = FRONT_ROLE_TO_DB_ROLE.get(selected_role)

    if not db_role:
        raise HTTPException(
            status_code=400,
            detail="Tipo de acceso no válido."
        )

    return db_role


def full_name(row: dict) -> str:
    if not row:
        return ""

    personal_name = " ".join(
        part for part in [
            row.get("personal_nombres"),
            row.get("personal_apellidos"),
        ]
        if part
    ).strip()

    client_name = " ".join(
        part for part in [
            row.get("cliente_nombres"),
            row.get("cliente_apellidos"),
        ]
        if part
    ).strip()

    return (
        personal_name
        or client_name
        or row.get("razon_social")
        or row.get("correo")
        or row.get("username")
        or "Usuario"
    )


def get_user_by_identifier(identifier: str):
    identifier = (identifier or "").strip()

    query = """
        SELECT
            u.usuario_id,
            u.username,
            u.correo,
            u.password_hash,
            u.estado,
            u.tipo_acceso,
            u.correo_verificado,
            u.requiere_cambio_password,
            u.intentos_fallidos,
            u.bloqueado_hasta,

            r.rol_id,
            r.codigo AS rol_codigo,
            r.nombre_visual AS rol_nombre,
            r.frontend_role,
            r.dashboard_url,

            c.cliente_id,
            c.tipo_cliente,
            c.nombres AS cliente_nombres,
            c.apellidos AS cliente_apellidos,
            c.razon_social,
            c.documento_tipo,
            c.documento_numero,
            c.telefono AS cliente_telefono,
            c.direccion AS cliente_direccion,

            p.personal_id,
            p.nombres AS personal_nombres,
            p.apellidos AS personal_apellidos,
            p.cargo,
            p.telefono AS personal_telefono,

            a.area_id,
            a.nombre AS area_nombre
        FROM usuarios u
        INNER JOIN roles r
            ON r.rol_id = u.rol_id
        LEFT JOIN clientes c
            ON c.usuario_id = u.usuario_id
        LEFT JOIN personal p
            ON p.usuario_id = u.usuario_id
        LEFT JOIN areas a
            ON a.area_id = ISNULL(p.area_id, u.area_id)
        WHERE
            LOWER(u.correo) = LOWER(?)
            OR LOWER(u.username) = LOWER(?)
            OR c.documento_numero = ?
            OR c.correo = ?
    """

    return fetch_one(
        query,
        (
            identifier,
            identifier,
            identifier,
            identifier,
        )
    )


def build_user_payload(row: dict) -> dict:
    db_role = row.get("rol_codigo")
    front_role = DB_ROLE_TO_FRONT_ROLE.get(db_role, row.get("frontend_role"))

    return {
        "usuario_id": row.get("usuario_id"),
        "id": row.get("usuario_id"),
        "username": row.get("username"),
        "correo": row.get("correo"),

        "rol": db_role,
        "codigo_rol": db_role,
        "frontend_role": front_role,
        "selected_role": front_role,
        "role": front_role,

        "nombre_rol": row.get("rol_nombre"),
        "nombre_completo": full_name(row),

        "cliente_id": row.get("cliente_id"),
        "tipo_cliente": row.get("tipo_cliente"),
        "documento_tipo": row.get("documento_tipo"),
        "documento_numero": row.get("documento_numero"),
        "razon_social": row.get("razon_social"),

        "personal_id": row.get("personal_id"),
        "cargo": row.get("cargo"),

        "area_id": row.get("area_id"),
        "area_nombre": row.get("area_nombre"),
    }


# =========================================================
# LOGIN
# =========================================================

def login_service(payload):
    identifier = (payload.identifier or "").strip()
    password = (payload.password or "").strip()
    selected_role = (payload.selected_role or "").strip()

    if not identifier:
        raise HTTPException(
            status_code=400,
            detail="Ingresa tu usuario o correo."
        )

    if not password:
        raise HTTPException(
            status_code=400,
            detail="Ingresa tu contraseña."
        )

    expected_db_role = normalize_role(selected_role)

    user = get_user_by_identifier(identifier)

    if not user:
        raise HTTPException(
            status_code=401,
            detail="Credenciales inválidas."
        )

    if user.get("estado") != "ACTIVO":
        raise HTTPException(
            status_code=403,
            detail="El usuario no se encuentra activo."
        )

    user_db_role = user.get("rol_codigo")

    if user_db_role != expected_db_role:
        raise HTTPException(
            status_code=403,
            detail="El tipo de acceso seleccionado no corresponde con este usuario."
        )

    if not verify_password(password, user.get("password_hash") or ""):
        execute(
            """
            UPDATE usuarios
            SET intentos_fallidos = ISNULL(intentos_fallidos, 0) + 1,
                fecha_actualizacion = SYSDATETIME()
            WHERE usuario_id = ?
            """,
            (user.get("usuario_id"),)
        )

        raise HTTPException(
            status_code=401,
            detail="Credenciales inválidas."
        )

    execute(
        """
        UPDATE usuarios
        SET ultimo_acceso = SYSDATETIME(),
            intentos_fallidos = 0,
            fecha_actualizacion = SYSDATETIME()
        WHERE usuario_id = ?
        """,
        (user.get("usuario_id"),)
    )

    user_payload = build_user_payload(user)

    token_data = {
        "sub": str(user.get("usuario_id")),
        "usuario_id": user.get("usuario_id"),
        "rol": user_db_role,
        "codigo_rol": user_db_role,
        "frontend_role": DB_ROLE_TO_FRONT_ROLE.get(user_db_role),
        "correo": user.get("correo"),
    }

    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    try:
        execute(
            """
            INSERT INTO refresh_tokens (
                usuario_id,
                token_hash,
                fecha_expiracion,
                revocado
            )
            VALUES (?, ?, DATEADD(DAY, 7, SYSDATETIME()), 0)
            """,
            (
                user.get("usuario_id"),
                hash_token(refresh_token),
            )
        )
    except Exception:
        pass

    return {
        "success": True,
        "message": "Inicio de sesión correcto.",
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": user_payload,
        "redirect": ROLE_REDIRECTS.get(user_db_role, "index.html")
    }


# =========================================================
# REGISTRO BÁSICO
# =========================================================

def validate_document_service(payload):
    document_number = (payload.document_number or "").strip()

    existing = fetch_one(
        """
        SELECT TOP 1
            cliente_id,
            documento_tipo,
            documento_numero
        FROM clientes
        WHERE documento_numero = ?
        """,
        (document_number,)
    )

    return {
        "available": existing is None,
        "exists": existing is not None,
        "message": (
            "El documento ya se encuentra registrado."
            if existing
            else "Documento disponible para registro."
        )
    }


def register_service(payload):
    raise HTTPException(
        status_code=501,
        detail="El registro todavía no está habilitado en esta etapa. Usa los usuarios semilla para las pruebas."
    )


# =========================================================
# VERIFICACIÓN DE CORREO
# =========================================================

def verify_email_service(payload):
    return {
        "success": True,
        "message": "Correo verificado correctamente."
    }


def resend_verification_service(payload):
    code = generate_numeric_code(6)

    return {
        "success": True,
        "message": "Código de verificación reenviado correctamente.",
        "debug_code": code
    }


# =========================================================
# RECUPERACIÓN DE CONTRASEÑA
# =========================================================

def password_request_code_service(payload):
    identifier = (payload.identifier or "").strip()

    user = get_user_by_identifier(identifier)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="No encontramos una cuenta asociada al dato ingresado."
        )

    code = generate_numeric_code(6)

    try:
        execute(
            """
            INSERT INTO otp_verificacion (
                usuario_id,
                codigo,
                tipo,
                usado,
                fecha_expiracion
            )
            VALUES (?, ?, 'RECUPERACION_PASSWORD', 0, DATEADD(MINUTE, 10, SYSDATETIME()))
            """,
            (
                user.get("usuario_id"),
                hash_plain_value(code),
            )
        )
    except Exception:
        pass

    return {
        "success": True,
        "message": "Código de recuperación generado correctamente.",
        "debug_code": code
    }


def password_verify_code_service(payload):
    identifier = (payload.identifier or "").strip()
    code = (payload.code or "").strip()

    user = get_user_by_identifier(identifier)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="No encontramos una cuenta asociada al dato ingresado."
        )

    hashed_code = hash_plain_value(code)

    otp = fetch_one(
        """
        SELECT TOP 1
            otp_id
        FROM otp_verificacion
        WHERE usuario_id = ?
          AND codigo = ?
          AND tipo = 'RECUPERACION_PASSWORD'
          AND usado = 0
          AND fecha_expiracion >= SYSDATETIME()
        ORDER BY fecha_creacion DESC
        """,
        (
            user.get("usuario_id"),
            hashed_code,
        )
    )

    if not otp:
        raise HTTPException(
            status_code=400,
            detail="Código inválido o vencido."
        )

    reset_token = create_refresh_token({
        "sub": str(user.get("usuario_id")),
        "usuario_id": user.get("usuario_id"),
        "purpose": "PASSWORD_RESET"
    })

    return {
        "success": True,
        "message": "Código validado correctamente.",
        "reset_token": reset_token
    }


def password_reset_service(payload):
    identifier = (payload.identifier or "").strip()
    new_password = (payload.new_password or "").strip()

    user = get_user_by_identifier(identifier)

    if not user:
        raise HTTPException(
            status_code=404,
            detail="No encontramos una cuenta asociada al dato ingresado."
        )

    execute(
        """
        UPDATE usuarios
        SET password_hash = ?,
            requiere_cambio_password = 0,
            ultimo_cambio_password = SYSDATETIME(),
            fecha_actualizacion = SYSDATETIME()
        WHERE usuario_id = ?
        """,
        (
            hash_password(new_password),
            user.get("usuario_id"),
        )
    )

    execute(
        """
        UPDATE otp_verificacion
        SET usado = 1
        WHERE usuario_id = ?
          AND tipo = 'RECUPERACION_PASSWORD'
        """,
        (user.get("usuario_id"),)
    )

    return {
        "success": True,
        "message": "Contraseña actualizada correctamente."
    }


# =========================================================
# REFRESH / LOGOUT
# =========================================================

def refresh_token_service(payload: dict):
    refresh_token = payload.get("refresh_token") or payload.get("refreshToken") or ""

    if not refresh_token:
        raise HTTPException(
            status_code=400,
            detail="Refresh token requerido."
        )

    decoded = decode_refresh_token(refresh_token)

    if not decoded:
        raise HTTPException(
            status_code=401,
            detail="Refresh token inválido."
        )

    usuario_id = decoded.get("usuario_id") or decoded.get("sub")

    user = fetch_one(
        """
        SELECT
            u.usuario_id,
            u.username,
            u.correo,
            u.estado,
            r.codigo AS rol_codigo,
            r.frontend_role
        FROM usuarios u
        INNER JOIN roles r
            ON r.rol_id = u.rol_id
        WHERE u.usuario_id = ?
        """,
        (usuario_id,)
    )

    if not user or user.get("estado") != "ACTIVO":
        raise HTTPException(
            status_code=401,
            detail="Usuario no válido."
        )

    token_data = {
        "sub": str(user.get("usuario_id")),
        "usuario_id": user.get("usuario_id"),
        "rol": user.get("rol_codigo"),
        "codigo_rol": user.get("rol_codigo"),
        "frontend_role": user.get("frontend_role"),
        "correo": user.get("correo"),
    }

    access_token = create_access_token(token_data)

    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer"
    }


def logout_service(payload: dict):
    refresh_token = payload.get("refresh_token") or payload.get("refreshToken") or ""

    if refresh_token:
        try:
            execute(
                """
                UPDATE refresh_tokens
                SET revocado = 1
                WHERE token_hash = ?
                """,
                (hash_token(refresh_token),)
            )
        except Exception:
            pass

    return {
        "success": True,
        "message": "Sesión cerrada correctamente."
    }