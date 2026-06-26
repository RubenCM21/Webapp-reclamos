from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.database import fetch_one
from app.utils.security import decode_token


security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticación requerido."
        )

    token = credentials.credentials
    payload = decode_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o vencido."
        )

    usuario_id = payload.get("usuario_id") or payload.get("sub")

    if not usuario_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sin usuario válido."
        )

    user = fetch_one(
        """
        SELECT
            u.usuario_id,
            u.username,
            u.correo,
            u.estado,
            u.tipo_acceso,

            r.rol_id,
            r.codigo AS rol,
            r.codigo AS codigo_rol,
            r.nombre_visual AS nombre_rol,
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
        WHERE u.usuario_id = ?
        """,
        (usuario_id,)
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado."
        )

    if user.get("estado") != "ACTIVO":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo o bloqueado."
        )

    return user


def require_roles(user: dict, allowed_roles: list[str]):
    user_role = user.get("rol") or user.get("codigo_rol")

    if user_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para acceder a este módulo."
        )

    return user


def get_current_client(user: dict = Depends(get_current_user)):
    return require_roles(
        user,
        [
            "CLIENTE",
            "CLIENTE_PERSONA",
            "CLIENTE_EMPRESA"
        ]
    )


def get_current_advisor(user: dict = Depends(get_current_user)):
    return require_roles(
        user,
        [
            "ASESOR"
        ]
    )


def get_current_supervisor(user: dict = Depends(get_current_user)):
    return require_roles(
        user,
        [
            "SUPERVISOR"
        ]
    )


def get_current_admin(user: dict = Depends(get_current_user)):
    return require_roles(
        user,
        [
            "ADMINISTRADOR"
        ]
    )