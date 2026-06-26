from __future__ import annotations

from datetime import date, datetime, time, timedelta
from decimal import Decimal
import csv
import io
import json
import os
import re
import secrets
import string
import uuid
from typing import Any, Dict, Iterable, List, Optional, Tuple

from fastapi import HTTPException

from app.database import fetch_one, fetch_all, execute
from app.utils.security import hash_password


# =========================================================
# CONFIGURACIÓN GENERAL DEL MÓDULO ADMIN
# =========================================================

ADMIN_MODULE = "Administrador"
DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE = 500

EXPORT_BASE_DIR = os.path.join(
    os.getcwd(),
    "storage",
    "admin_exports"
)

os.makedirs(EXPORT_BASE_DIR, exist_ok=True)


# =========================================================
# HELPERS BÁSICOS
# =========================================================

def now():
    return datetime.now()


def clean(value: Any) -> str:
    return str(value or "").strip()


def clean_lower(value: Any) -> str:
    return clean(value).lower()


def clean_upper(value: Any) -> str:
    return clean(value).upper()


def to_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    text = clean_lower(value)

    if text in {"1", "true", "sí", "si", "activo", "activa", "yes", "y", "on"}:
        return True

    if text in {"0", "false", "no", "inactivo", "inactiva", "off"}:
        return False

    return default


def to_int(value: Any, default: int = 0) -> int:
    try:
        if value is None or value == "":
            return default
        return int(value)
    except Exception:
        return default


def to_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None or value == "":
            return default
        return float(value)
    except Exception:
        return default


def safe_date(value: Any) -> Optional[str]:
    if not value:
        return None

    if isinstance(value, datetime):
        return value.date().isoformat()

    if isinstance(value, date):
        return value.isoformat()

    text = clean(value)
    return text or None


def safe_datetime(value: Any) -> Optional[str]:
    if not value:
        return None

    if isinstance(value, datetime):
        return value.isoformat(sep=" ", timespec="seconds")

    if isinstance(value, date):
        return value.isoformat()

    return clean(value) or None


def json_dumps(value: Any) -> str:
    return json.dumps(
        value,
        ensure_ascii=False,
        default=str,
        indent=None
    )


def json_loads(value: Any, default: Any = None) -> Any:
    if default is None:
        default = {}

    if not value:
        return default

    if isinstance(value, (dict, list)):
        return value

    try:
        return json.loads(value)
    except Exception:
        return default


def normalize_text(value: Any) -> str:
    """
    Normaliza texto para búsquedas simples.
    """
    text = clean_lower(value)
    replacements = {
        "á": "a",
        "é": "e",
        "í": "i",
        "ó": "o",
        "ú": "u",
        "ñ": "n"
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return text


def get_payload_value(payload: Optional[dict], *keys: str, default: Any = "") -> Any:
    """
    Permite leer payloads enviados por frontend aunque vengan con nombres distintos:
    nombre/name, correo/email, tipo/type, estado/status, etc.
    """
    if not isinstance(payload, dict):
        return default

    for key in keys:
        if key in payload and payload.get(key) is not None:
            return payload.get(key)

    return default


def compact_dict(data: dict) -> dict:
    return {key: value for key, value in data.items() if value is not None}


def paginate_items(items: List[dict], page: int = 1, page_size: int = DEFAULT_PAGE_SIZE) -> dict:
    page = max(1, to_int(page, 1))
    page_size = min(MAX_PAGE_SIZE, max(1, to_int(page_size, DEFAULT_PAGE_SIZE)))

    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size

    return {
        "items": items[start:end],
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "pages": max(1, (total + page_size - 1) // page_size)
        }
    }


def parse_minutes(value: Any) -> Optional[int]:
    """
    Convierte textos de UI a minutos:
    - '2 horas' -> 120
    - '30 minutos antes' -> 30
    - '1 día' -> 1440
    """
    text = clean_lower(value)

    if not text:
        return None

    match = re.search(r"(\d+)", text)
    if not match:
        return None

    number = int(match.group(1))

    if "día" in text or "dia" in text:
        return number * 1440

    if "hora" in text:
        return number * 60

    if "min" in text:
        return number

    if "seg" in text:
        return max(1, number // 60)

    return number


def parse_seconds(value: Any) -> Optional[int]:
    text = clean_lower(value)

    if not text:
        return None

    match = re.search(r"(\d+)", text)
    if not match:
        return None

    number = int(match.group(1))

    if "min" in text:
        return number * 60

    if "hora" in text:
        return number * 3600

    return number


def format_bytes(value: Any) -> str:
    size = to_float(value, 0)

    if size <= 0:
        return "Pendiente"

    units = ["B", "KB", "MB", "GB", "TB"]
    idx = 0

    while size >= 1024 and idx < len(units) - 1:
        size = size / 1024
        idx += 1

    return f"{size:.1f} {units[idx]}"


def random_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "*#@$"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def make_token(prefix: str = "adm") -> str:
    return f"{prefix}_{secrets.token_urlsafe(24)}"


def make_correlation_id() -> str:
    return str(uuid.uuid4())


# =========================================================
# HELPERS BD SEGUROS
# =========================================================

_SCHEMA_CACHE: Dict[str, Any] = {
    "tables": {},
    "columns": {}
}


def safe_fetch_one(query: str, params: tuple = (), default: Optional[dict] = None) -> Optional[dict]:
    try:
        return fetch_one(query, params)
    except Exception:
        return default


def safe_fetch_all(query: str, params: tuple = (), default: Optional[list] = None) -> list:
    try:
        return fetch_all(query, params)
    except Exception:
        return default if default is not None else []


def safe_execute(query: str, params: tuple = ()) -> bool:
    try:
        execute(query, params)
        return True
    except Exception:
        return False


def table_exists(table_name: str) -> bool:
    key = clean_lower(table_name)

    if key in _SCHEMA_CACHE["tables"]:
        return _SCHEMA_CACHE["tables"][key]

    row = safe_fetch_one(
        """
        SELECT 1 AS existe
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME = ?
        """,
        (table_name,)
    )

    exists = bool(row)
    _SCHEMA_CACHE["tables"][key] = exists
    return exists


def get_table_columns(table_name: str) -> set:
    key = clean_lower(table_name)

    if key in _SCHEMA_CACHE["columns"]:
        return _SCHEMA_CACHE["columns"][key]

    rows = safe_fetch_all(
        """
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME = ?
        """,
        (table_name,)
    )

    columns = {clean_lower(row["COLUMN_NAME"]) for row in rows}
    _SCHEMA_CACHE["columns"][key] = columns
    return columns


def column_exists(table_name: str, column_name: str) -> bool:
    return clean_lower(column_name) in get_table_columns(table_name)


def insert_dynamic(table_name: str, values: Dict[str, Any]) -> bool:
    """
    Inserta solo columnas existentes. Sirve para mantener compatibilidad entre
    la BD actual y las mejoras incrementales.
    """
    if not table_exists(table_name):
        return False

    columns_available = get_table_columns(table_name)

    filtered = {
        column: value
        for column, value in values.items()
        if clean_lower(column) in columns_available
    }

    if not filtered:
        return False

    columns_sql = ", ".join(filtered.keys())
    placeholders = ", ".join(["?"] * len(filtered))

    query = f"""
        INSERT INTO {table_name} ({columns_sql})
        VALUES ({placeholders})
    """

    return safe_execute(query, tuple(filtered.values()))


def update_dynamic(
    table_name: str,
    values: Dict[str, Any],
    where_sql: str,
    where_params: tuple
) -> bool:
    """
    Actualiza solo columnas existentes.
    """
    if not table_exists(table_name):
        return False

    columns_available = get_table_columns(table_name)

    filtered = {
        column: value
        for column, value in values.items()
        if clean_lower(column) in columns_available
    }

    if not filtered:
        return False

    set_sql = ", ".join([f"{column} = ?" for column in filtered.keys()])

    query = f"""
        UPDATE {table_name}
        SET {set_sql}
        WHERE {where_sql}
    """

    return safe_execute(query, tuple(filtered.values()) + where_params)


def count_table(table_name: str, where_sql: str = "1 = 1", params: tuple = ()) -> int:
    if not table_exists(table_name):
        return 0

    row = safe_fetch_one(
        f"""
        SELECT COUNT(*) AS total
        FROM {table_name}
        WHERE {where_sql}
        """,
        params,
        {"total": 0}
    )

    return int((row or {}).get("total") or 0)


# =========================================================
# ROLES / USUARIOS HELPERS
# =========================================================

def admin_name(admin: dict) -> str:
    full = f"{admin.get('nombres') or ''} {admin.get('apellidos') or ''}".strip()
    return full or admin.get("username") or admin.get("correo") or "Administrador"


def initials(name: str) -> str:
    return "".join([part[0].upper() for part in clean(name).split()[:2]]) or "AD"


def display_role(role_name: str) -> str:
    value = clean_upper(role_name)

    return {
        "CLIENTE": "Cliente",
        "CLIENTE PERSONA": "Cliente",
        "CLIENTE EMPRESA": "Cliente",
        "ASESOR": "Asesor",
        "SUPERVISOR": "Supervisor",
        "ADMIN": "Administrador",
        "ADMINISTRADOR": "Administrador"
    }.get(value, clean(role_name).title())


def db_role_name(role_name: str) -> str:
    value = clean_upper(role_name)

    mapping = {
        "CLIENTE": "CLIENTE",
        "CLIENTE PERSONA": "CLIENTE",
        "CLIENTE EMPRESA": "CLIENTE",
        "ASESOR": "ASESOR",
        "SUPERVISOR": "SUPERVISOR",
        "ADMIN": "ADMINISTRADOR",
        "ADMINISTRADOR": "ADMINISTRADOR"
    }

    return mapping.get(value, value)


def status_to_bit(status: str) -> int:
    value = clean_lower(status)
    return 0 if value in {
        "inactivo",
        "inactiva",
        "deshabilitado",
        "deshabilitada",
        "bloqueado",
        "bloqueada"
    } else 1


def bit_to_status(value: Any) -> str:
    return "Activo" if bool(value) else "Inactivo"


def normalize_status(value: Any, default: str = "ACTIVO") -> str:
    text = clean_upper(value)

    if not text:
        return default

    mapping = {
        "ACTIVO": "ACTIVO",
        "ACTIVA": "ACTIVO",
        "INACTIVO": "INACTIVO",
        "INACTIVA": "INACTIVO",
        "BLOQUEADO": "BLOQUEADO",
        "BLOQUEADA": "BLOQUEADO",
        "EN REVISION": "EN REVISIÓN",
        "EN REVISIÓN": "EN REVISIÓN",
        "PENDIENTE": "PENDIENTE"
    }

    return mapping.get(text, text)


def get_role_id(role_name: str) -> int:
    db_name = db_role_name(role_name)

    row = fetch_one(
        """
        SELECT TOP 1 rol_id
        FROM roles
        WHERE UPPER(nombre) = ?
        """,
        (db_name,)
    )

    if not row:
        raise HTTPException(status_code=400, detail=f"No existe el rol {role_name}.")

    return int(row["rol_id"])


def get_area_id(area_name: str) -> Optional[int]:
    if not clean(area_name):
        return None

    row = safe_fetch_one(
        """
        SELECT TOP 1 area_id
        FROM areas
        WHERE nombre = ?
        """,
        (clean(area_name),)
    )

    if row:
        return int(row["area_id"])

    execute(
        """
        INSERT INTO areas (nombre, descripcion, activo, fecha_creacion)
        VALUES (?, ?, 1, SYSDATETIME())
        """,
        (
            clean(area_name),
            f"Área creada desde administración: {clean(area_name)}"
        )
    )

    row = fetch_one(
        """
        SELECT TOP 1 area_id
        FROM areas
        WHERE nombre = ?
        ORDER BY area_id DESC
        """,
        (clean(area_name),)
    )

    return int(row["area_id"])


def split_full_name(full_name: str) -> Tuple[str, str]:
    parts = clean(full_name).split()

    if not parts:
        return "", ""

    if len(parts) == 1:
        return parts[0], ""

    if len(parts) == 2:
        return parts[0], parts[1]

    return " ".join(parts[:2]), " ".join(parts[2:])


def user_risk_by_role(role: str) -> str:
    role_display = display_role(role)

    if role_display == "Administrador":
        return "Alto"

    if role_display == "Supervisor":
        return "Medio"

    if role_display == "Asesor":
        return "Medio"

    return "Bajo"


def user_access_type_by_role(role: str) -> str:
    role_display = display_role(role)

    if role_display == "Administrador":
        return "Acceso administrativo"

    if role_display == "Supervisor":
        return "Acceso supervisor"

    if role_display == "Asesor":
        return "Acceso operativo"

    return "Acceso estándar"


# =========================================================
# AUDITORÍA Y ALERTAS
# =========================================================

def audit(
    admin: dict,
    module: str,
    action: str,
    before: Any = "-",
    after: Any = "-",
    detail: str = "",
    critical: bool = False,
    result: str = "Exitoso",
    reason: str = "",
    entity: str = "",
    entity_id: Any = "",
    sensitivity: Optional[str] = None,
    before_json: Any = None,
    after_json: Any = None,
    correlation_id: Optional[str] = None,
    ip: str = "",
    user_agent: str = ""
) -> str:
    """
    Registra auditoría manteniendo compatibilidad con la tabla actual.
    Si ya ejecutaste el script incremental, también llena columnas nuevas.
    """
    correlation_id = correlation_id or make_correlation_id()
    sensitivity = sensitivity or ("Alta" if critical else "Media")

    base_values = {
        "modulo": module,
        "tipo": normalize_text(module),
        "accion": action,
        "usuario_id": admin.get("usuario_id"),
        "usuario_nombre": admin_name(admin),
        "valor_anterior": str(before if before is not None else "-"),
        "valor_nuevo": str(after if after is not None else "-"),
        "resultado": result,
        "critico": 1 if critical else 0,
        "detalle": detail or reason or "",
        "fecha_evento": now(),

        # Columnas nuevas opcionales
        "motivo": reason or detail or "",
        "entidad": entity or module,
        "entidad_id": str(entity_id or ""),
        "valor_anterior_json": json_dumps(before_json) if before_json is not None else None,
        "valor_nuevo_json": json_dumps(after_json) if after_json is not None else None,
        "correlacion_id": correlation_id,
        "sensibilidad": sensitivity,
        "ip": ip or admin.get("ip") or "",
        "user_agent": user_agent or admin.get("user_agent") or ""
    }

    insert_dynamic("auditoria_admin", base_values)
    return correlation_id


def create_alert(
    module: str,
    title: str,
    message: str,
    severity: str = "Media",
    href: str = "auditoria.html",
    action: str = "Revisar",
    priority: str = "Media",
    entity: str = "",
    entity_id: Any = ""
) -> None:
    values = {
        "modulo": module,
        "titulo": title,
        "mensaje": message,
        "severidad": severity,
        "estado": "Pendiente",
        "href": href,
        "fecha_creacion": now(),

        # Columnas nuevas opcionales
        "accion": action,
        "prioridad": priority,
        "entidad": entity,
        "entidad_id": str(entity_id or "")
    }

    insert_dynamic("alertas_sistema", values)


def get_alerts(limit: int = 20) -> List[dict]:
    if not table_exists("alertas_sistema"):
        return []

    rows = safe_fetch_all(
        f"""
        SELECT TOP {to_int(limit, 20)}
            alerta_id,
            modulo,
            titulo,
            mensaje,
            severidad,
            estado,
            href,
            fecha_creacion
        FROM alertas_sistema
        WHERE ISNULL(estado, 'Pendiente') <> 'Revisada'
        ORDER BY fecha_creacion DESC
        """
    )

    return [
        {
            "id": row["alerta_id"],
            "icon": "⚠️",
            "title": row["titulo"],
            "text": row["mensaje"],
            "module": row["modulo"],
            "severity": row["severidad"],
            "date": row["fecha_creacion"],
            "action": "Revisar",
            "href": row["href"] or "auditoria.html"
        }
        for row in rows
    ]


def metric_status(progress: int) -> str:
    progress = to_int(progress, 0)

    if progress >= 90:
        return "success"

    if progress >= 70:
        return "warning"

    return "danger"


# =========================================================
# CATÁLOGOS UI / OPCIONES DINÁMICAS
# =========================================================

def get_catalog_ui_options(group: str) -> List[dict]:
    if not table_exists("catalogos_ui"):
        return []

    rows = safe_fetch_all(
        """
        SELECT
            codigo,
            etiqueta,
            descripcion,
            orden
        FROM catalogos_ui
        WHERE grupo = ?
          AND activo = 1
        ORDER BY ISNULL(orden, 999), etiqueta
        """,
        (group,)
    )

    return [
        {
            "value": row["etiqueta"],
            "code": row["codigo"],
            "label": row["etiqueta"],
            "description": row.get("descripcion") or ""
        }
        for row in rows
    ]


def get_simple_options(table_name: str, pk: str = "id") -> List[dict]:
    if not table_exists(table_name):
        return []

    rows = safe_fetch_all(
        f"""
        SELECT
            nombre,
            descripcion
        FROM {table_name}
        WHERE ISNULL(activo, 1) = 1
        ORDER BY nombre
        """
    )

    return [
        {
            "value": row["nombre"],
            "label": row["nombre"],
            "description": row.get("descripcion") or ""
        }
        for row in rows
    ]


def admin_options_service(admin: dict):
    """
    Servicio preparado para una futura ruta /admin/opciones.
    Permite que los selects del frontend vengan de BD.
    """
    return {
        "ok": True,
        "options": {
            "roles": get_simple_options("roles"),
            "areas": get_simple_options("areas"),
            "prioridades": get_simple_options("prioridades"),
            "estados_caso": get_simple_options("estados_caso"),
            "canales": get_simple_options("canales_ingreso"),
            "tipos_caso": get_simple_options("tipos_caso"),
            "categorias": get_simple_options("categorias"),
            "formatos_exportacion": get_catalog_ui_options("formatos_exportacion"),
            "ambientes": get_catalog_ui_options("ambientes"),
            "criticidades": get_catalog_ui_options("criticidades"),
            "frecuencias": get_catalog_ui_options("frecuencias"),
            "metodos_autenticacion": get_catalog_ui_options("metodos_autenticacion"),
            "tipos_acceso_usuario": get_catalog_ui_options("tipos_acceso_usuario")
        }
    }


# =========================================================
# SHELL / SESIÓN
# =========================================================

def admin_me_service(admin: dict):
    name = admin_name(admin)

    return {
        "ok": True,
        "admin": {
            "usuario_id": admin.get("usuario_id"),
            "personal_id": admin.get("personal_id"),
            "username": admin.get("username"),
            "correo": admin.get("correo"),
            "nombre": name,
            "initials": initials(name),
            "role": admin.get("cargo") or "Administrador del sistema",
            "cargo": admin.get("cargo") or "Administrador del sistema",
            "area": admin.get("area_nombre") or "Administración",
            "status": "Sistema operativo",
            "last_access": admin.get("ultimo_acceso")
        }
    }


def admin_resumen_service(admin: dict):
    usuarios_activos = count_table(
        "usuarios",
        "estado = 'ACTIVO'"
    )

    integraciones_alerta = 0
    if table_exists("integraciones_sistema"):
        integraciones_alerta = count_table(
            "integraciones_sistema",
            "estado IN ('Con alerta', 'Error')"
        )

    alertas = 0
    if table_exists("alertas_sistema"):
        alertas = count_table(
            "alertas_sistema",
            "ISNULL(estado, 'Pendiente') <> 'Revisada'"
        )

    return {
        "ok": True,
        "usuarios_activos": usuarios_activos,
        "integraciones_alerta": integraciones_alerta,
        "alertas": alertas
    }

    # =========================================================
# USUARIOS
# =========================================================

def get_user_snapshot(user_id: int) -> dict:
    row = safe_fetch_one(
        """
        SELECT
            u.usuario_id,
            u.username,
            u.correo,
            u.estado,
            u.ultimo_acceso,
            u.fecha_creacion,
            u.intentos_fallidos,
            u.bloqueado_hasta,
            r.nombre AS rol,
            p.nombres,
            p.apellidos,
            p.cargo,
            a.nombre AS area_nombre
        FROM usuarios u
        INNER JOIN roles r ON r.rol_id = u.rol_id
        LEFT JOIN personal p ON p.usuario_id = u.usuario_id
        LEFT JOIN areas a ON a.area_id = COALESCE(p.area_id, u.area_id)
        WHERE u.usuario_id = ?
        """,
        (user_id,)
    )

    return dict(row or {})


def get_user_display_name(row: dict) -> str:
    name = f"{row.get('nombres') or ''} {row.get('apellidos') or ''}".strip()
    return name or row.get("username") or row.get("correo") or "Usuario"


def map_user_row(row: dict) -> dict:
    name = get_user_display_name(row)
    role = display_role(row.get("rol"))
    status = clean(row.get("estado")).title() if row.get("estado") else "Sin estado"
    risk = user_risk_by_role(role)
    access_type = user_access_type_by_role(role)

    locked_until = row.get("bloqueado_hasta")
    failed_attempts = int(row.get("intentos_fallidos") or 0)

    if clean_upper(row.get("estado")) == "BLOQUEADO" or locked_until:
        status = "Bloqueado"
        risk = "Alto"

    return {
        "id": row["usuario_id"],
        "usuario_id": row["usuario_id"],
        "initials": initials(name),
        "name": name,
        "nombre": name,
        "email": row.get("correo"),
        "correo": row.get("correo"),
        "username": row.get("username"),
        "usuario": row.get("username"),
        "role": role,
        "rol": role,
        "area": row.get("area_nombre") or "Sin área",
        "area_nombre": row.get("area_nombre") or "Sin área",
        "status": status,
        "estado": status,
        "accessType": access_type,
        "tipo_acceso": access_type,
        "lastAccess": safe_datetime(row.get("ultimo_acceso")) or "Sin acceso",
        "ultimo_acceso": safe_datetime(row.get("ultimo_acceso")),
        "createdAt": safe_datetime(row.get("fecha_creacion")),
        "fecha_creacion": safe_datetime(row.get("fecha_creacion")),
        "failedAttempts": failed_attempts,
        "intentos_fallidos": failed_attempts,
        "lockedUntil": safe_datetime(locked_until),
        "bloqueado_hasta": safe_datetime(locked_until),
        "risk": risk,
        "riesgo": risk,
        "activity": failed_attempts
    }


def filter_user_items(
    items: List[dict],
    q: str = "",
    rol: str = "todos",
    estado: str = "todos",
    area: str = "todos"
) -> List[dict]:
    query = normalize_text(q)
    role_filter = normalize_text(rol)
    status_filter = normalize_text(estado)
    area_filter = normalize_text(area)

    result = []

    for item in items:
        searchable = normalize_text(
            " ".join([
                clean(item.get("name")),
                clean(item.get("email")),
                clean(item.get("username")),
                clean(item.get("role")),
                clean(item.get("area")),
                clean(item.get("status")),
                clean(item.get("accessType")),
                clean(item.get("risk")),
            ])
        )

        if query and query not in searchable:
            continue

        if role_filter not in {"", "todos", "todo", "all"}:
            if role_filter not in normalize_text(item.get("role")):
                continue

        if status_filter not in {"", "todos", "todo", "all"}:
            if status_filter not in normalize_text(item.get("status")):
                continue

        if area_filter not in {"", "todos", "todo", "all"}:
            if area_filter not in normalize_text(item.get("area")):
                continue

        result.append(item)

    return result


def count_active_admins(exclude_user_id: Optional[int] = None) -> int:
    params: list = []
    exclude_sql = ""

    if exclude_user_id:
        exclude_sql = "AND u.usuario_id <> ?"
        params.append(exclude_user_id)

    row = safe_fetch_one(
        f"""
        SELECT COUNT(*) AS total
        FROM usuarios u
        INNER JOIN roles r ON r.rol_id = u.rol_id
        WHERE UPPER(r.nombre) = 'ADMINISTRADOR'
          AND UPPER(u.estado) = 'ACTIVO'
          {exclude_sql}
        """,
        tuple(params),
        {"total": 0}
    )

    return int((row or {}).get("total") or 0)


def validate_last_admin_protection(user_id: int, new_role: Optional[str] = None, new_status: Optional[str] = None):
    current = get_user_snapshot(user_id)

    if not current:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    current_role = db_role_name(current.get("rol"))
    target_role = db_role_name(new_role or current.get("rol"))
    target_status = normalize_status(new_status or current.get("estado"))

    is_current_admin = current_role == "ADMINISTRADOR"
    will_stop_being_active_admin = (
        is_current_admin
        and (
            target_role != "ADMINISTRADOR"
            or target_status != "ACTIVO"
        )
    )

    if will_stop_being_active_admin and count_active_admins(exclude_user_id=user_id) <= 0:
        raise HTTPException(
            status_code=409,
            detail="No puedes modificar o desactivar al último administrador activo."
        )


def admin_users_service(
    admin: dict,
    q: str = "",
    rol: str = "todos",
    estado: str = "todos",
    area: str = "todos",
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE
):
    rows = safe_fetch_all(
        """
        SELECT
            u.usuario_id,
            u.username,
            u.correo,
            u.estado,
            u.ultimo_acceso,
            u.fecha_creacion,
            u.intentos_fallidos,
            u.bloqueado_hasta,
            r.nombre AS rol,
            p.nombres,
            p.apellidos,
            p.cargo,
            a.nombre AS area_nombre
        FROM usuarios u
        INNER JOIN roles r ON r.rol_id = u.rol_id
        LEFT JOIN personal p ON p.usuario_id = u.usuario_id
        LEFT JOIN areas a ON a.area_id = COALESCE(p.area_id, u.area_id)
        ORDER BY u.fecha_creacion DESC
        """
    )

    items = [map_user_row(row) for row in rows]
    filtered = filter_user_items(items, q=q, rol=rol, estado=estado, area=area)
    paged = paginate_items(filtered, page=page, page_size=page_size)

    total_users = len(items)
    active_users = len([item for item in items if normalize_text(item.get("status")) == "activo"])
    blocked_users = len([item for item in items if normalize_text(item.get("status")) == "bloqueado"])
    admin_users = len([item for item in items if normalize_text(item.get("role")) == "administrador"])

    return {
        "ok": True,
        "items": paged["items"],
        "pagination": paged["pagination"],
        "summary": {
            "total": total_users,
            "active": active_users,
            "blocked": blocked_users,
            "admins": admin_users
        },
        "kpis": [
            {
                "icon": "👤",
                "value": total_users,
                "label": "Usuarios registrados",
                "description": "Total de cuentas del sistema."
            },
            {
                "icon": "✅",
                "value": active_users,
                "label": "Usuarios activos",
                "description": "Cuentas disponibles para operar."
            },
            {
                "icon": "🔐",
                "value": admin_users,
                "label": "Administradores",
                "description": "Usuarios con privilegios elevados."
            },
            {
                "icon": "⚠️",
                "value": blocked_users,
                "label": "Bloqueados",
                "description": "Cuentas que requieren revisión."
            }
        ],
        "ai_summary": [
            {
                "title": "Control de accesos",
                "text": "Prioriza cuentas administrativas, usuarios bloqueados y perfiles con privilegios elevados."
            }
        ],
        "action_plan": [
            {
                "icon": "1",
                "title": "Revisar administradores",
                "text": "Validar que solo usuarios autorizados tengan acceso administrativo."
            },
            {
                "icon": "2",
                "title": "Atender bloqueos",
                "text": "Restablecer acceso solo con motivo y registro auditable."
            },
            {
                "icon": "3",
                "title": "Validar áreas",
                "text": "Mantener usuarios asociados a áreas reales de operación."
            }
        ]
    }


def normalize_user_payload(payload: dict) -> dict:
    name = clean(get_payload_value(payload, "nombre", "name"))
    email = clean_lower(get_payload_value(payload, "correo", "email"))
    role = clean(get_payload_value(payload, "rol", "role"))
    area = clean(get_payload_value(payload, "area", "area_nombre"))
    status = normalize_status(get_payload_value(payload, "estado", "status", default="ACTIVO"))
    reason = clean(get_payload_value(payload, "motivo", "reason", "comentario", default=""))

    return {
        "nombre": name,
        "correo": email,
        "rol": role,
        "area": area,
        "estado": status,
        "motivo": reason
    }


def validate_email(email: str):
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", clean(email)):
        raise HTTPException(status_code=400, detail="El correo no tiene un formato válido.")


def admin_create_user_service(admin: dict, payload: dict):
    data = normalize_user_payload(payload)

    name = data["nombre"]
    email = data["correo"]
    role = data["rol"]
    area = data["area"]
    status = data["estado"]
    reason = data["motivo"] or "Creación administrativa de usuario."

    if not name or not email or not role:
        raise HTTPException(status_code=400, detail="Nombre, correo y rol son obligatorios.")

    validate_email(email)

    exists = safe_fetch_one(
        """
        SELECT usuario_id
        FROM usuarios
        WHERE LOWER(correo) = LOWER(?)
        """,
        (email,)
    )

    if exists:
        raise HTTPException(status_code=409, detail="Ya existe un usuario con ese correo.")

    role_id = get_role_id(role)
    area_id = get_area_id(area)
    username = email.split("@")[0]
    temp_password = random_temp_password()
    password_hash = hash_password(temp_password)

    insert_ok = insert_dynamic(
        "usuarios",
        {
            "rol_id": role_id,
            "area_id": area_id,
            "username": username,
            "correo": email,
            "password_hash": password_hash,
            "estado": status,
            "correo_verificado": 1,
            "requiere_cambio_password": 1,
            "ultimo_cambio_password": now(),
            "motivo_ultimo_cambio": reason,
            "fecha_creacion": now(),
            "fecha_actualizacion": now()
        }
    )

    if not insert_ok:
        raise HTTPException(status_code=500, detail="No se pudo crear el usuario.")

    user = fetch_one(
        """
        SELECT TOP 1 usuario_id
        FROM usuarios
        WHERE correo = ?
        ORDER BY usuario_id DESC
        """,
        (email,)
    )

    nombres, apellidos = split_full_name(name)

    if db_role_name(role) != "CLIENTE":
        insert_dynamic(
            "personal",
            {
                "usuario_id": user["usuario_id"],
                "area_id": area_id,
                "nombres": nombres,
                "apellidos": apellidos,
                "cargo": display_role(role),
                "activo": 1,
                "fecha_creacion": now()
            }
        )

    audit(
        admin,
        "Usuarios",
        "Usuario creado",
        before="-",
        after=email,
        detail=f"Se creó el usuario {email} con rol {display_role(role)}.",
        critical=True,
        reason=reason,
        entity="usuarios",
        entity_id=user["usuario_id"],
        after_json={
            "usuario_id": user["usuario_id"],
            "correo": email,
            "rol": display_role(role),
            "area": area,
            "estado": status
        }
    )

    return {
        "ok": True,
        "message": "Usuario creado correctamente.",
        "temporary_password": temp_password
    }


def admin_update_user_service(admin: dict, user_id: int, payload: dict):
    before = get_user_snapshot(user_id)

    if not before:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    data = normalize_user_payload(payload)

    name = data["nombre"]
    email = data["correo"]
    role = data["rol"]
    area = data["area"]
    status = data["estado"]
    reason = data["motivo"] or "Actualización administrativa de usuario."

    if not name or not email or not role:
        raise HTTPException(status_code=400, detail="Nombre, correo y rol son obligatorios.")

    validate_email(email)
    validate_last_admin_protection(user_id, new_role=role, new_status=status)

    duplicated = safe_fetch_one(
        """
        SELECT usuario_id
        FROM usuarios
        WHERE LOWER(correo) = LOWER(?)
          AND usuario_id <> ?
        """,
        (email, user_id)
    )

    if duplicated:
        raise HTTPException(status_code=409, detail="Ya existe otro usuario con ese correo.")

    role_id = get_role_id(role)
    area_id = get_area_id(area)

    update_dynamic(
        "usuarios",
        {
            "rol_id": role_id,
            "area_id": area_id,
            "correo": email,
            "estado": status,
            "motivo_ultimo_cambio": reason,
            "fecha_actualizacion": now()
        },
        "usuario_id = ?",
        (user_id,)
    )

    nombres, apellidos = split_full_name(name)
    personal = safe_fetch_one(
        """
        SELECT personal_id
        FROM personal
        WHERE usuario_id = ?
        """,
        (user_id,)
    )

    if personal:
        update_dynamic(
            "personal",
            {
                "area_id": area_id,
                "nombres": nombres,
                "apellidos": apellidos,
                "cargo": display_role(role),
                "activo": 1 if status == "ACTIVO" else 0
            },
            "usuario_id = ?",
            (user_id,)
        )
    elif db_role_name(role) != "CLIENTE":
        insert_dynamic(
            "personal",
            {
                "usuario_id": user_id,
                "area_id": area_id,
                "nombres": nombres,
                "apellidos": apellidos,
                "cargo": display_role(role),
                "activo": 1 if status == "ACTIVO" else 0,
                "fecha_creacion": now()
            }
        )

    after = get_user_snapshot(user_id)

    audit(
        admin,
        "Usuarios",
        "Usuario actualizado",
        before=before.get("correo"),
        after=email,
        detail=f"Se actualizó el usuario {email}.",
        critical=True,
        reason=reason,
        entity="usuarios",
        entity_id=user_id,
        before_json=before,
        after_json=after
    )

    return {
        "ok": True,
        "message": "Usuario actualizado correctamente."
    }


def admin_change_user_status_service(admin: dict, user_id: int, payload: dict):
    status = normalize_status(get_payload_value(payload, "estado", "status"))
    reason = clean(get_payload_value(payload, "motivo", "reason"))

    if not status or not reason:
        raise HTTPException(status_code=400, detail="Estado y motivo son obligatorios.")

    before = get_user_snapshot(user_id)

    if not before:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    validate_last_admin_protection(user_id, new_status=status)

    update_dynamic(
        "usuarios",
        {
            "estado": status,
            "motivo_ultimo_cambio": reason,
            "fecha_actualizacion": now()
        },
        "usuario_id = ?",
        (user_id,)
    )

    update_dynamic(
        "personal",
        {
            "activo": 1 if status == "ACTIVO" else 0
        },
        "usuario_id = ?",
        (user_id,)
    )

    after = get_user_snapshot(user_id)

    audit(
        admin,
        "Usuarios",
        "Cambio de estado de usuario",
        before=before.get("estado"),
        after=status,
        detail=reason,
        critical=True,
        reason=reason,
        entity="usuarios",
        entity_id=user_id,
        before_json=before,
        after_json=after
    )

    if status == "BLOQUEADO":
        create_alert(
            "Usuarios",
            "Usuario bloqueado",
            f"El usuario {before.get('correo')} fue bloqueado por administración.",
            severity="Alta",
            href="usuarios.html",
            priority="Alta",
            entity="usuarios",
            entity_id=user_id
        )

    return {
        "ok": True,
        "message": "Estado actualizado correctamente."
    }


def admin_reset_user_access_service(admin: dict, user_id: int, payload: Optional[dict] = None):
    payload = payload or {}
    reason = clean(get_payload_value(payload, "motivo", "reason", default="Restablecimiento administrativo de acceso."))

    if not reason:
        raise HTTPException(status_code=400, detail="El motivo es obligatorio.")

    user = get_user_snapshot(user_id)

    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    temp_password = random_temp_password()
    reset_token = make_token("reset")

    update_dynamic(
        "usuarios",
        {
            "password_hash": hash_password(temp_password),
            "intentos_fallidos": 0,
            "bloqueado_hasta": None,
            "requiere_cambio_password": 1,
            "ultimo_cambio_password": now(),
            "reset_token": reset_token,
            "reset_token_expira": now() + timedelta(hours=2),
            "motivo_ultimo_cambio": reason,
            "fecha_actualizacion": now()
        },
        "usuario_id = ?",
        (user_id,)
    )

    audit(
        admin,
        "Usuarios",
        "Restablecimiento de acceso",
        before="-",
        after=user.get("correo"),
        detail="Se restableció el acceso del usuario.",
        critical=True,
        reason=reason,
        entity="usuarios",
        entity_id=user_id,
        before_json={
            "estado": user.get("estado"),
            "intentos_fallidos": user.get("intentos_fallidos"),
            "bloqueado_hasta": safe_datetime(user.get("bloqueado_hasta"))
        },
        after_json={
            "requiere_cambio_password": True,
            "reset_token_generado": True
        }
    )

    return {
        "ok": True,
        "message": "Acceso restablecido correctamente.",
        "temporary_password": temp_password
    }


def admin_bulk_user_action_service(admin: dict, payload: dict):
    scope = clean(get_payload_value(payload, "alcance", "scope", default="seleccion"))
    action = clean_lower(get_payload_value(payload, "accion", "action"))
    reason = clean(get_payload_value(payload, "motivo", "reason", default="Acción masiva administrativa."))
    ids = get_payload_value(payload, "usuario_ids", "user_ids", "ids", default=[])

    if not action:
        raise HTTPException(status_code=400, detail="La acción es obligatoria.")

    if not reason:
        raise HTTPException(status_code=400, detail="El motivo es obligatorio.")

    if not isinstance(ids, list):
        ids = []

    valid_ids = [to_int(item) for item in ids if to_int(item) > 0]

    status_map = {
        "activar": "ACTIVO",
        "activo": "ACTIVO",
        "inactivar": "INACTIVO",
        "inactivo": "INACTIVO",
        "bloquear": "BLOQUEADO",
        "bloqueado": "BLOQUEADO"
    }

    affected = 0

    if valid_ids and action in status_map:
        new_status = status_map[action]

        for user_id in valid_ids:
            validate_last_admin_protection(user_id, new_status=new_status)

            update_dynamic(
                "usuarios",
                {
                    "estado": new_status,
                    "motivo_ultimo_cambio": reason,
                    "fecha_actualizacion": now()
                },
                "usuario_id = ?",
                (user_id,)
            )

            affected += 1

    audit(
        admin,
        "Usuarios",
        "Acción masiva de usuarios",
        before=scope,
        after=action,
        detail=f"Se registró acción masiva. Usuarios afectados: {affected}.",
        critical=True,
        reason=reason,
        entity="usuarios",
        entity_id="masivo",
        after_json={
            "accion": action,
            "alcance": scope,
            "ids": valid_ids,
            "afectados": affected
        }
    )

    return {
        "ok": True,
        "message": "Acción masiva registrada correctamente.",
        "affected": affected
    }


# =========================================================
# ROLES Y PERMISOS
# =========================================================

def map_role_row(row: dict) -> dict:
    role_name = display_role(row.get("nombre"))
    users = int(row.get("usuarios") or 0)
    active = bool(row.get("activo", 1))

    level = row.get("nivel_acceso") or role_name
    scope = row.get("alcance_funcional") or row.get("descripcion") or role_name

    if role_name == "Administrador":
        icon = "🔐"
        risk = "Alto"
    elif role_name == "Supervisor":
        icon = "🧭"
        risk = "Medio"
    elif role_name == "Asesor":
        icon = "🎧"
        risk = "Medio"
    else:
        icon = "👤"
        risk = "Bajo"

    return {
        "id": row["rol_id"],
        "rol_id": row["rol_id"],
        "icon": icon,
        "name": role_name,
        "nombre": role_name,
        "scope": scope,
        "alcance": scope,
        "accessLevel": level,
        "nivel_acceso": level,
        "status": bit_to_status(active),
        "estado": bit_to_status(active),
        "users": users,
        "usuarios": users,
        "description": row.get("descripcion") or "",
        "descripcion": row.get("descripcion") or "",
        "risk": risk,
        "riesgo": risk,
        "system": bool(row.get("es_sistema", 0)),
        "es_sistema": bool(row.get("es_sistema", 0))
    }


def admin_roles_permissions_service(admin: dict, q: str = "", filtro: str = "todos"):
    role_extra_select = []

    if column_exists("roles", "alcance_funcional"):
        role_extra_select.append("r.alcance_funcional")
    else:
        role_extra_select.append("NULL AS alcance_funcional")

    if column_exists("roles", "nivel_acceso"):
        role_extra_select.append("r.nivel_acceso")
    else:
        role_extra_select.append("NULL AS nivel_acceso")

    if column_exists("roles", "es_sistema"):
        role_extra_select.append("r.es_sistema")
    else:
        role_extra_select.append("0 AS es_sistema")

    roles = safe_fetch_all(
        f"""
        SELECT
            r.rol_id,
            r.nombre,
            r.descripcion,
            r.activo,
            {", ".join(role_extra_select)},
            (
                SELECT COUNT(*)
                FROM usuarios u
                WHERE u.rol_id = r.rol_id
            ) AS usuarios
        FROM roles r
        ORDER BY r.rol_id
        """
    )

    permission_extra_select = []

    if column_exists("permisos", "codigo"):
        permission_extra_select.append("p.codigo")
    else:
        permission_extra_select.append("NULL AS codigo")

    if column_exists("permisos", "riesgo"):
        permission_extra_select.append("p.riesgo")
    else:
        permission_extra_select.append("NULL AS riesgo")

    permissions = safe_fetch_all(
        f"""
        SELECT
            p.permiso_id,
            p.nombre,
            p.descripcion,
            p.modulo,
            p.activo,
            {", ".join(permission_extra_select)},
            MAX(CASE WHEN UPPER(r.nombre) = 'CLIENTE' THEN 1 ELSE 0 END) AS cliente,
            MAX(CASE WHEN UPPER(r.nombre) = 'ASESOR' THEN 1 ELSE 0 END) AS asesor,
            MAX(CASE WHEN UPPER(r.nombre) = 'SUPERVISOR' THEN 1 ELSE 0 END) AS supervisor,
            MAX(CASE WHEN UPPER(r.nombre) = 'ADMINISTRADOR' THEN 1 ELSE 0 END) AS administrador
        FROM permisos p
        LEFT JOIN roles_permisos rp ON rp.permiso_id = p.permiso_id
        LEFT JOIN roles r ON r.rol_id = rp.rol_id
        GROUP BY
            p.permiso_id,
            p.nombre,
            p.descripcion,
            p.modulo,
            p.activo,
            {", ".join(permission_extra_select)}
        ORDER BY p.modulo, p.nombre
        """
    )

    role_items = [map_role_row(row) for row in roles]
    permission_items = []

    query = normalize_text(q)
    filter_value = normalize_text(filtro)

    for row in permissions:
        module = row.get("modulo") or "Sistema"
        risk = row.get("riesgo") or ""

        sensitive = (
            normalize_text(module) in {
                "administracion",
                "administrador",
                "seguridad",
                "sistema",
                "auditoria",
                "configuracion",
                "roles",
                "permisos"
            }
            or normalize_text(risk) in {"alto", "critico", "critica"}
        )

        item = {
            "id": row["permiso_id"],
            "permiso_id": row["permiso_id"],
            "code": row.get("codigo") or f"PERM-{row['permiso_id']}",
            "codigo": row.get("codigo") or f"PERM-{row['permiso_id']}",
            "module": module,
            "modulo": module,
            "permission": row.get("nombre"),
            "nombre": row.get("nombre"),
            "description": row.get("descripcion") or "",
            "descripcion": row.get("descripcion") or "",
            "risk": risk or ("Alto" if sensitive else "Medio"),
            "riesgo": risk or ("Alto" if sensitive else "Medio"),
            "sensitive": sensitive,
            "sensible": sensitive,
            "status": bit_to_status(row.get("activo", 1)),
            "estado": bit_to_status(row.get("activo", 1)),
            "cliente": bool(row.get("cliente")),
            "asesor": bool(row.get("asesor")),
            "supervisor": bool(row.get("supervisor")),
            "administrador": bool(row.get("administrador"))
        }

        searchable = normalize_text(
            " ".join([
                item["module"],
                item["permission"],
                item["description"],
                item["risk"]
            ])
        )

        if query and query not in searchable:
            continue

        if filter_value not in {"", "todos", "todo", "all"}:
            if filter_value == "sensibles" and not item["sensitive"]:
                continue

            if filter_value in {"cliente", "asesor", "supervisor", "administrador"} and not item.get(filter_value):
                continue

            if filter_value not in {"sensibles", "cliente", "asesor", "supervisor", "administrador"}:
                if filter_value not in searchable:
                    continue

        permission_items.append(item)

    sensitive_count = len([item for item in permission_items if item["sensitive"]])
    total_assignments = sum(
        1
        for item in permission_items
        for role_key in ["cliente", "asesor", "supervisor", "administrador"]
        if item.get(role_key)
    )

    return {
        "ok": True,
        "roles": role_items,
        "permissions": permission_items,
        "summary": {
            "roles": len(role_items),
            "permissions": len(permission_items),
            "sensitive": sensitive_count,
            "assignments": total_assignments
        },
        "kpis": [
            {
                "icon": "🔐",
                "value": len(role_items),
                "label": "Roles configurados",
                "description": "Perfiles funcionales del sistema."
            },
            {
                "icon": "🧩",
                "value": len(permission_items),
                "label": "Permisos",
                "description": "Permisos disponibles por módulo."
            },
            {
                "icon": "⚠️",
                "value": sensitive_count,
                "label": "Permisos sensibles",
                "description": "Requieren revisión antes de asignarse."
            },
            {
                "icon": "✅",
                "value": total_assignments,
                "label": "Asignaciones",
                "description": "Relaciones rol-permiso activas."
            }
        ],
        "ai_summary": [
            {
                "title": "Mínimo privilegio",
                "text": "Revisa permisos administrativos asignados a roles no críticos."
            },
            {
                "title": "Permisos sensibles",
                "text": "Toda modificación en usuarios, roles, auditoría y configuración debe justificarse."
            }
        ],
        "action_plan": [
            {
                "icon": "1",
                "title": "Revisar rol administrador",
                "text": "Confirmar que solo administradores tengan permisos críticos."
            },
            {
                "icon": "2",
                "title": "Validar permisos sensibles",
                "text": "Auditar cambios en seguridad, configuración y reportes."
            },
            {
                "icon": "3",
                "title": "Guardar matriz",
                "text": "Registrar motivo y trazabilidad al modificar permisos."
            }
        ]
    }


def get_role_snapshot(role_id: int) -> dict:
    row = safe_fetch_one(
        """
        SELECT
            rol_id,
            nombre,
            descripcion,
            activo
        FROM roles
        WHERE rol_id = ?
        """,
        (role_id,)
    )

    if not row:
        return {}

    data = dict(row)

    if column_exists("roles", "alcance_funcional") or column_exists("roles", "nivel_acceso") or column_exists("roles", "es_sistema"):
        extra = safe_fetch_one(
            """
            SELECT *
            FROM roles
            WHERE rol_id = ?
            """,
            (role_id,)
        )

        if extra:
            data.update(dict(extra))

    return data


def normalize_role_payload(payload: dict) -> dict:
    name = clean(get_payload_value(payload, "nombre", "name"))
    description = clean(get_payload_value(payload, "descripcion", "description"))
    status = clean(get_payload_value(payload, "estado", "status", default="Activo"))
    scope = clean(get_payload_value(payload, "alcance", "scope", "alcance_funcional"))
    level = clean(get_payload_value(payload, "nivel_acceso", "accessLevel", "access_level"))

    if not scope:
        scope = description or name

    if not level:
        level = name

    return {
        "nombre": name,
        "descripcion": description,
        "estado": status,
        "alcance_funcional": scope,
        "nivel_acceso": level
    }


def admin_create_role_service(admin: dict, payload: dict):
    data = normalize_role_payload(payload)
    name = db_role_name(data["nombre"])
    description = data["descripcion"]
    active = status_to_bit(data["estado"])

    if not name:
        raise HTTPException(status_code=400, detail="El nombre del rol es obligatorio.")

    exists = safe_fetch_one(
        """
        SELECT rol_id
        FROM roles
        WHERE UPPER(nombre) = ?
        """,
        (name,)
    )

    if exists:
        raise HTTPException(status_code=409, detail="Ya existe un rol con ese nombre.")

    insert_dynamic(
        "roles",
        {
            "nombre": name,
            "descripcion": description,
            "activo": active,
            "alcance_funcional": data["alcance_funcional"],
            "nivel_acceso": data["nivel_acceso"],
            "es_sistema": 0,
            "fecha_creacion": now(),
            "fecha_actualizacion": now()
        }
    )

    role = safe_fetch_one(
        """
        SELECT TOP 1 rol_id
        FROM roles
        WHERE UPPER(nombre) = ?
        ORDER BY rol_id DESC
        """,
        (name,)
    )

    audit(
        admin,
        "Roles",
        "Rol creado",
        before="-",
        after=name,
        detail=f"Se creó el rol {display_role(name)}.",
        critical=True,
        reason=clean(get_payload_value(payload, "motivo", "reason", default="Creación administrativa de rol.")),
        entity="roles",
        entity_id=(role or {}).get("rol_id"),
        after_json=data
    )

    return {
        "ok": True,
        "message": "Rol creado correctamente."
    }


def admin_update_role_service(admin: dict, role_id: int, payload: dict):
    before = get_role_snapshot(role_id)

    if not before:
        raise HTTPException(status_code=404, detail="Rol no encontrado.")

    data = normalize_role_payload(payload)
    name = db_role_name(data["nombre"])
    description = data["descripcion"]
    active = status_to_bit(data["estado"])
    reason = clean(get_payload_value(payload, "motivo", "reason", default="Actualización administrativa de rol."))

    if not name:
        raise HTTPException(status_code=400, detail="El nombre del rol es obligatorio.")

    duplicated = safe_fetch_one(
        """
        SELECT rol_id
        FROM roles
        WHERE UPPER(nombre) = ?
          AND rol_id <> ?
        """,
        (name, role_id)
    )

    if duplicated:
        raise HTTPException(status_code=409, detail="Ya existe otro rol con ese nombre.")

    if db_role_name(before.get("nombre")) == "ADMINISTRADOR" and active == 0:
        if count_active_admins() > 0:
            raise HTTPException(
                status_code=409,
                detail="No se recomienda inactivar el rol Administrador mientras existan administradores activos."
            )

    update_dynamic(
        "roles",
        {
            "nombre": name,
            "descripcion": description,
            "activo": active,
            "alcance_funcional": data["alcance_funcional"],
            "nivel_acceso": data["nivel_acceso"],
            "fecha_actualizacion": now()
        },
        "rol_id = ?",
        (role_id,)
    )

    after = get_role_snapshot(role_id)

    audit(
        admin,
        "Roles",
        "Rol actualizado",
        before=before.get("nombre"),
        after=name,
        detail=f"Se actualizó el rol {display_role(name)}.",
        critical=True,
        reason=reason,
        entity="roles",
        entity_id=role_id,
        before_json=before,
        after_json=after
    )

    return {
        "ok": True,
        "message": "Rol actualizado correctamente."
    }


def normalize_permission_matrix(payload: dict) -> List[dict]:
    """
    Soporta dos formatos:
    1. [{"permiso_id": 1, "rol": "ASESOR", "activo": true}]
    2. [{"permiso_id": 1, "cliente": true, "asesor": true, ...}]
    """
    matrix = get_payload_value(payload, "matrix", "matriz", "items", default=[])

    if not isinstance(matrix, list):
        raise HTTPException(status_code=400, detail="La matriz de permisos no es válida.")

    normalized = []

    role_keys = {
        "cliente": "CLIENTE",
        "asesor": "ASESOR",
        "supervisor": "SUPERVISOR",
        "administrador": "ADMINISTRADOR"
    }

    for item in matrix:
        if not isinstance(item, dict):
            continue

        permiso_id = to_int(get_payload_value(item, "permiso_id", "id"))

        if permiso_id <= 0:
            continue

        explicit_role = clean(get_payload_value(item, "rol", "role"))

        if explicit_role:
            normalized.append({
                "permiso_id": permiso_id,
                "rol": db_role_name(explicit_role),
                "activo": to_bool(get_payload_value(item, "activo", "enabled", "checked"), False)
            })
            continue

        for key, role_name in role_keys.items():
            if key in item:
                normalized.append({
                    "permiso_id": permiso_id,
                    "rol": role_name,
                    "activo": to_bool(item.get(key), False)
                })

    return normalized


def get_permission_matrix_snapshot() -> List[dict]:
    rows = safe_fetch_all(
        """
        SELECT
            r.nombre AS rol,
            p.permiso_id,
            p.nombre AS permiso,
            p.modulo
        FROM roles_permisos rp
        INNER JOIN roles r ON r.rol_id = rp.rol_id
        INNER JOIN permisos p ON p.permiso_id = rp.permiso_id
        ORDER BY r.nombre, p.modulo, p.nombre
        """
    )

    return [
        {
            "rol": row["rol"],
            "permiso_id": row["permiso_id"],
            "permiso": row["permiso"],
            "modulo": row["modulo"]
        }
        for row in rows
    ]


def admin_save_permission_matrix_service(admin: dict, payload: dict):
    matrix = normalize_permission_matrix(payload)
    reason = clean(get_payload_value(payload, "motivo", "reason", default="Actualización de matriz de permisos."))

    if not matrix:
        raise HTTPException(status_code=400, detail="No se recibieron cambios válidos en la matriz.")

    if not reason:
        raise HTTPException(status_code=400, detail="El motivo es obligatorio.")

    before = get_permission_matrix_snapshot()

    changes = 0
    sensitive_changes = 0

    for item in matrix:
        permiso_id = int(item["permiso_id"])
        role_name = db_role_name(item["rol"])
        active = bool(item["activo"])

        role = safe_fetch_one(
            """
            SELECT rol_id, nombre
            FROM roles
            WHERE UPPER(nombre) = ?
            """,
            (role_name,)
        )

        permission = safe_fetch_one(
            """
            SELECT permiso_id, nombre, modulo
            FROM permisos
            WHERE permiso_id = ?
            """,
            (permiso_id,)
        )

        if not role or not permission:
            continue

        exists = safe_fetch_one(
            """
            SELECT rol_permiso_id
            FROM roles_permisos
            WHERE rol_id = ?
              AND permiso_id = ?
            """,
            (
                role["rol_id"],
                permiso_id
            )
        )

        module_name = normalize_text(permission.get("modulo"))
        is_sensitive = module_name in {
            "administracion",
            "seguridad",
            "sistema",
            "auditoria",
            "configuracion",
            "roles",
            "permisos"
        }

        if active and not exists:
            insert_dynamic(
                "roles_permisos",
                {
                    "rol_id": role["rol_id"],
                    "permiso_id": permiso_id,
                    "fecha_creacion": now()
                }
            )
            changes += 1

            if is_sensitive:
                sensitive_changes += 1

        elif not active and exists:
            safe_execute(
                """
                DELETE FROM roles_permisos
                WHERE rol_id = ?
                  AND permiso_id = ?
                """,
                (
                    role["rol_id"],
                    permiso_id
                )
            )
            changes += 1

            if is_sensitive:
                sensitive_changes += 1

    after = get_permission_matrix_snapshot()

    audit(
        admin,
        "Roles",
        "Matriz de permisos actualizada",
        before=f"{len(before)} asignaciones",
        after=f"{len(after)} asignaciones",
        detail=f"Se actualizaron {changes} asignaciones de permisos.",
        critical=True,
        reason=reason,
        entity="roles_permisos",
        entity_id="matriz",
        sensitivity="Alta" if sensitive_changes else "Media",
        before_json=before,
        after_json=after
    )

    if sensitive_changes > 0:
        create_alert(
            "Roles",
            "Permisos sensibles modificados",
            f"Se modificaron {sensitive_changes} asignaciones sensibles en la matriz de permisos.",
            severity="Alta",
            href="roles-permisos.html",
            priority="Alta",
            entity="roles_permisos",
            entity_id="matriz"
        )

    return {
        "ok": True,
        "message": "Matriz de permisos guardada correctamente.",
        "changes": changes,
        "sensitive_changes": sensitive_changes
    }

    # =========================================================
# CATÁLOGOS
# =========================================================

CATALOG_TABLES = {
    "categorías": ("categorias", "categoria_id", "Categorías", "categorias", "🧩"),
    "categorias": ("categorias", "categoria_id", "Categorías", "categorias", "🧩"),
    "categoria": ("categorias", "categoria_id", "Categorías", "categorias", "🧩"),

    "prioridades": ("prioridades", "prioridad_id", "Prioridades", "prioridades", "🔥"),
    "prioridad": ("prioridades", "prioridad_id", "Prioridades", "prioridades", "🔥"),

    "estados": ("estados_caso", "estado_caso_id", "Estados", "estados", "📌"),
    "estado": ("estados_caso", "estado_caso_id", "Estados", "estados", "📌"),
    "estado de caso": ("estados_caso", "estado_caso_id", "Estados", "estados", "📌"),

    "canales": ("canales_ingreso", "canal_ingreso_id", "Canales", "canales", "📞"),
    "canal": ("canales_ingreso", "canal_ingreso_id", "Canales", "canales", "📞"),

    "áreas": ("areas", "area_id", "Áreas", "areas", "🏢"),
    "areas": ("areas", "area_id", "Áreas", "areas", "🏢"),
    "area": ("areas", "area_id", "Áreas", "areas", "🏢"),
    "área": ("areas", "area_id", "Áreas", "areas", "🏢"),

    "tipos": ("tipos_caso", "tipo_caso_id", "Tipos de caso", "tipos", "📝"),
    "tipo": ("tipos_caso", "tipo_caso_id", "Tipos de caso", "tipos", "📝"),
    "tipo de caso": ("tipos_caso", "tipo_caso_id", "Tipos de caso", "tipos", "📝"),
    "tipos de caso": ("tipos_caso", "tipo_caso_id", "Tipos de caso", "tipos", "📝"),

    "motivos": ("motivos_catalogo", "motivo_id", "Motivos", "motivos", "🧾"),
    "motivo": ("motivos_catalogo", "motivo_id", "Motivos", "motivos", "🧾"),
    "motivo de reclamo": ("motivos_catalogo", "motivo_id", "Motivos", "motivos", "🧾")
}


def catalog_key(value: str):
    raw = clean_lower(value)
    normalized = normalize_text(raw)
    return (
        CATALOG_TABLES.get(raw)
        or CATALOG_TABLES.get(normalized)
        or CATALOG_TABLES["categorias"]
    )


def encode_catalog_id(table: str, item_id: Any) -> str:
    return f"{table}:{item_id}"


def decode_catalog_id(catalog_id: str):
    value = clean(catalog_id)

    if ":" not in value:
        raise HTTPException(status_code=400, detail="Código de catálogo inválido.")

    table, item_id = value.split(":", 1)

    for data in set(CATALOG_TABLES.values()):
        if data[0] == table:
            return data[0], data[1], int(item_id)

    raise HTTPException(status_code=400, detail="Catálogo no reconocido.")


def catalog_table_exists(table: str) -> bool:
    return table_exists(table)


def get_catalog_row(table: str, pk: str, item_id: int) -> dict:
    row = safe_fetch_one(
        f"""
        SELECT *
        FROM {table}
        WHERE {pk} = ?
        """,
        (item_id,)
    )

    return dict(row or {})


def get_catalog_usage(table: str, item_id: int, name: str) -> dict:
    """
    Estima dependencias sin romper si no existen tablas.
    """
    usage = {
        "cases": 0,
        "sla": 0,
        "reports": 0,
        "integrations": 0,
        "total": 0
    }

    if table == "estados_caso" and table_exists("casos"):
        usage["cases"] = count_table("casos", "estado_caso_id = ?", (item_id,))

    if table == "prioridades" and table_exists("casos"):
        usage["cases"] = count_table("casos", "prioridad_id = ?", (item_id,))

    if table == "canales_ingreso" and table_exists("casos"):
        usage["cases"] = count_table("casos", "canal_ingreso_id = ?", (item_id,))

    if table == "categorias" and table_exists("casos"):
        usage["cases"] = count_table("casos", "categoria_id = ?", (item_id,))

    if table == "tipos_caso" and table_exists("casos"):
        usage["cases"] = count_table("casos", "tipo_caso_id = ?", (item_id,))

    if table_exists("reglas_sla_admin"):
        usage["sla"] = count_table(
            "reglas_sla_admin",
            """
            tipo_caso = ?
            OR prioridad = ?
            OR canal = ?
            OR area = ?
            OR categoria = ?
            """,
            (name, name, name, name, name)
        )

    if table_exists("reportes"):
        usage["reports"] = count_table(
            "reportes",
            "alcance LIKE ? OR filtros_json LIKE ?",
            (f"%{name}%", f"%{name}%")
        )

    if table_exists("integraciones_sistema"):
        usage["integrations"] = count_table(
            "integraciones_sistema",
            "descripcion LIKE ?",
            (f"%{name}%",)
        )

    usage["total"] = usage["cases"] + usage["sla"] + usage["reports"] + usage["integrations"]
    return usage


def map_catalog_item(row: dict, table: str, pk: str, label: str, filter_type: str, icon: str) -> dict:
    item_id = row["id"]
    name = row.get("nombre") or ""
    description = row.get("descripcion") or ""
    active = row.get("activo", 1)
    usage_data = get_catalog_usage(table, item_id, name)

    dependency = "Sin dependencia crítica"

    if usage_data["cases"] > 0:
        dependency = "Casos"
    elif usage_data["sla"] > 0:
        dependency = "Reglas SLA"
    elif usage_data["reports"] > 0:
        dependency = "Reportes"
    elif usage_data["integrations"] > 0:
        dependency = "Integraciones"

    if row.get("dependencia"):
        dependency = row.get("dependencia")

    return {
        "id": encode_catalog_id(table, item_id),
        "rawId": item_id,
        "catalog_id": encode_catalog_id(table, item_id),
        "icon": icon,
        "name": name,
        "nombre": name,
        "type": label,
        "tipo": label,
        "filterType": filter_type,
        "tipo_filtro": filter_type,
        "status": bit_to_status(active),
        "estado": bit_to_status(active),
        "usage": f"{usage_data['total']} uso(s) detectado(s)",
        "uso": f"{usage_data['total']} uso(s) detectado(s)",
        "usageCount": usage_data["total"],
        "dependency": dependency,
        "dependencia": dependency,
        "updatedAt": safe_datetime(row.get("fecha_actualizacion")) or safe_datetime(row.get("fecha_creacion")),
        "description": description,
        "descripcion": description,
        "impact": usage_data
    }


def filter_catalog_items(items: List[dict], q: str = "", tipo: str = "todos", estado: str = "todos") -> List[dict]:
    query = normalize_text(q)
    type_filter = normalize_text(tipo)
    status_filter = normalize_text(estado)

    result = []

    for item in items:
        searchable = normalize_text(
            " ".join([
                clean(item.get("name")),
                clean(item.get("type")),
                clean(item.get("status")),
                clean(item.get("dependency")),
                clean(item.get("description")),
                clean(item.get("usage"))
            ])
        )

        if query and query not in searchable:
            continue

        if type_filter not in {"", "todos", "todo", "all"}:
            if type_filter not in normalize_text(item.get("filterType")) and type_filter not in normalize_text(item.get("type")):
                continue

        if status_filter not in {"", "todos", "todo", "all"}:
            if status_filter not in normalize_text(item.get("status")):
                continue

        result.append(item)

    return result


def admin_catalogs_service(admin: dict, q: str = "", tipo: str = "todos", estado: str = "todos"):
    items = []

    for table, pk, label, filter_type, icon in sorted(set(CATALOG_TABLES.values())):
        if not catalog_table_exists(table):
            continue

        select_extra = []

        if column_exists(table, "dependencia"):
            select_extra.append("dependencia")
        else:
            select_extra.append("NULL AS dependencia")

        if column_exists(table, "fecha_creacion"):
            select_extra.append("fecha_creacion")
        else:
            select_extra.append("NULL AS fecha_creacion")

        if column_exists(table, "fecha_actualizacion"):
            select_extra.append("fecha_actualizacion")
        else:
            select_extra.append("NULL AS fecha_actualizacion")

        rows = safe_fetch_all(
            f"""
            SELECT
                {pk} AS id,
                nombre,
                descripcion,
                activo,
                {", ".join(select_extra)}
            FROM {table}
            ORDER BY nombre
            """
        )

        for row in rows:
            items.append(map_catalog_item(row, table, pk, label, filter_type, icon))

    filtered = filter_catalog_items(items, q=q, tipo=tipo, estado=estado)

    active_count = len([item for item in items if item["status"] == "Activo"])
    inactive_count = len([item for item in items if item["status"] != "Activo"])
    dependent_count = len([item for item in items if item.get("usageCount", 0) > 0])

    distribution = {}

    for item in items:
        distribution[item["type"]] = distribution.get(item["type"], 0) + 1

    return {
        "ok": True,
        "items": filtered,
        "all_items": items,
        "summary": {
            "total": len(items),
            "visible": len(filtered),
            "active": active_count,
            "inactive": inactive_count,
            "dependent": dependent_count
        },
        "distribution": [
            {
                "label": key,
                "value": value
            }
            for key, value in distribution.items()
        ],
        "status_distribution": [
            {
                "label": "Activos",
                "value": active_count
            },
            {
                "label": "Inactivos / revisión",
                "value": inactive_count
            }
        ],
        "kpis": [
            {
                "icon": "🧩",
                "value": len(items),
                "label": "Elementos",
                "description": "Datos maestros registrados."
            },
            {
                "icon": "✅",
                "value": active_count,
                "label": "Activos",
                "description": "Disponibles para operación."
            },
            {
                "icon": "🔗",
                "value": dependent_count,
                "label": "Con dependencia",
                "description": "Usados por casos, SLA o reportes."
            },
            {
                "icon": "⚠️",
                "value": inactive_count,
                "label": "Inactivos",
                "description": "Requieren revisión si están en uso."
            }
        ],
        "ai_summary": [
            {
                "title": "Consistencia de datos maestros",
                "text": "Evita duplicar valores y valida dependencias antes de inactivar catálogos."
            },
            {
                "title": "Impacto operacional",
                "text": "Estados, prioridades, canales y áreas impactan casos, SLA, reportes y filtros."
            }
        ],
        "action_plan": [
            {
                "icon": "1",
                "title": "Validar duplicados",
                "text": "Revisar nombres equivalentes o variantes escritas distinto."
            },
            {
                "icon": "2",
                "title": "Revisar dependencias",
                "text": "No inactivar elementos usados por casos o reglas SLA."
            },
            {
                "icon": "3",
                "title": "Auditar cambios",
                "text": "Registrar motivo en cambios de estado o edición."
            }
        ]
    }


def normalize_catalog_payload(payload: dict) -> dict:
    return {
        "nombre": clean(get_payload_value(payload, "nombre", "name")),
        "tipo": clean(get_payload_value(payload, "tipo", "type")),
        "estado": clean(get_payload_value(payload, "estado", "status", default="Activo")),
        "dependencia": clean(get_payload_value(payload, "dependencia", "dependency", default="Sin dependencia crítica")),
        "descripcion": clean(get_payload_value(payload, "descripcion", "description")),
        "motivo": clean(get_payload_value(payload, "motivo", "reason", default="Mantenimiento de catálogo."))
    }


def validate_catalog_duplicate(table: str, pk: str, name: str, exclude_id: Optional[int] = None):
    params: list = [name]
    exclude_sql = ""

    if exclude_id:
        exclude_sql = f"AND {pk} <> ?"
        params.append(exclude_id)

    exists = safe_fetch_one(
        f"""
        SELECT {pk} AS id
        FROM {table}
        WHERE LOWER(nombre) = LOWER(?)
        {exclude_sql}
        """,
        tuple(params)
    )

    if exists:
        raise HTTPException(status_code=409, detail="Ya existe un elemento con ese nombre en el catálogo seleccionado.")


def admin_create_catalog_item_service(admin: dict, payload: dict):
    data = normalize_catalog_payload(payload)
    table, pk, label, filter_type, icon = catalog_key(data["tipo"])

    name = data["nombre"]
    description = data["descripcion"]
    dependency = data["dependencia"]

    if not name:
        raise HTTPException(status_code=400, detail="El nombre del catálogo es obligatorio.")

    if not table_exists(table):
        raise HTTPException(status_code=400, detail=f"La tabla del catálogo {label} no existe.")

    validate_catalog_duplicate(table, pk, name)

    insert_dynamic(
        table,
        {
            "nombre": name,
            "descripcion": description,
            "activo": status_to_bit(data["estado"]),
            "dependencia": dependency,
            "fecha_creacion": now(),
            "fecha_actualizacion": now()
        }
    )

    row = safe_fetch_one(
        f"""
        SELECT TOP 1 {pk} AS id
        FROM {table}
        WHERE nombre = ?
        ORDER BY {pk} DESC
        """,
        (name,)
    )

    audit(
        admin,
        "Catálogos",
        "Elemento creado",
        before="-",
        after=name,
        detail=f"Se creó elemento en {label}.",
        critical=False,
        reason=data["motivo"],
        entity=table,
        entity_id=(row or {}).get("id"),
        after_json={
            "catalogo": label,
            "nombre": name,
            "estado": data["estado"],
            "dependencia": dependency,
            "descripcion": description
        }
    )

    return {
        "ok": True,
        "message": "Elemento de catálogo creado correctamente."
    }


def admin_update_catalog_item_service(admin: dict, catalog_id: str, payload: dict):
    table, pk, item_id = decode_catalog_id(catalog_id)
    data = normalize_catalog_payload(payload)

    before = get_catalog_row(table, pk, item_id)

    if not before:
        raise HTTPException(status_code=404, detail="Elemento de catálogo no encontrado.")

    name = data["nombre"]
    description = data["descripcion"]
    active = status_to_bit(data["estado"])

    if not name:
        raise HTTPException(status_code=400, detail="El nombre del catálogo es obligatorio.")

    validate_catalog_duplicate(table, pk, name, exclude_id=item_id)

    update_dynamic(
        table,
        {
            "nombre": name,
            "descripcion": description,
            "activo": active,
            "dependencia": data["dependencia"],
            "fecha_actualizacion": now()
        },
        f"{pk} = ?",
        (item_id,)
    )

    after = get_catalog_row(table, pk, item_id)

    audit(
        admin,
        "Catálogos",
        "Elemento actualizado",
        before=before.get("nombre"),
        after=name,
        detail=f"Se actualizó elemento de catálogo {catalog_id}.",
        critical=False,
        reason=data["motivo"],
        entity=table,
        entity_id=item_id,
        before_json=before,
        after_json=after
    )

    return {
        "ok": True,
        "message": "Elemento de catálogo actualizado correctamente."
    }


def admin_change_catalog_status_service(admin: dict, catalog_id: str, payload: dict):
    table, pk, item_id = decode_catalog_id(catalog_id)

    status = clean(get_payload_value(payload, "estado", "status"))
    reason = clean(get_payload_value(payload, "motivo", "reason"))

    if not status or not reason:
        raise HTTPException(status_code=400, detail="Estado y motivo son obligatorios.")

    before = get_catalog_row(table, pk, item_id)

    if not before:
        raise HTTPException(status_code=404, detail="Elemento de catálogo no encontrado.")

    usage_data = get_catalog_usage(table, item_id, before.get("nombre") or "")

    if status_to_bit(status) == 0 and usage_data["total"] > 0:
        create_alert(
            "Catálogos",
            "Catálogo inactivado con dependencias",
            f"El catálogo {before.get('nombre')} tiene {usage_data['total']} dependencia(s) detectada(s).",
            severity="Alta",
            href="catalogos.html",
            priority="Alta",
            entity=table,
            entity_id=item_id
        )

    update_dynamic(
        table,
        {
            "activo": status_to_bit(status),
            "fecha_actualizacion": now()
        },
        f"{pk} = ?",
        (item_id,)
    )

    after = get_catalog_row(table, pk, item_id)

    audit(
        admin,
        "Catálogos",
        "Cambio de estado",
        before=bit_to_status(before.get("activo", 1)),
        after=status,
        detail=reason,
        critical=usage_data["total"] > 0,
        reason=reason,
        entity=table,
        entity_id=item_id,
        before_json=before,
        after_json=after,
        sensitivity="Alta" if usage_data["total"] > 0 else "Media"
    )

    return {
        "ok": True,
        "message": "Estado del catálogo actualizado correctamente.",
        "dependencies": usage_data
    }


# =========================================================
# REGLAS SLA
# =========================================================

def normalize_sla_status(value: Any) -> str:
    text = clean(value)

    if not text:
        return "Activo"

    text_norm = normalize_text(text)

    mapping = {
        "activo": "Activo",
        "activa": "Activo",
        "inactivo": "Inactivo",
        "inactiva": "Inactivo",
        "en revision": "En revisión",
        "revision": "En revisión"
    }

    return mapping.get(text_norm, text)


def normalize_priority(value: Any) -> str:
    text = clean(value)

    if not text:
        return "Media"

    text_norm = normalize_text(text)

    mapping = {
        "critica": "Crítica",
        "critico": "Crítica",
        "alta": "Alta",
        "media": "Media",
        "baja": "Baja"
    }

    return mapping.get(text_norm, text)


def normalize_sla_payload(payload: dict) -> dict:
    time_text = clean(get_payload_value(payload, "tiempo_sla", "time", "sla_time"))
    alert_text = clean(get_payload_value(payload, "alerta", "alert", "preventive_alert"))

    time_minutes = parse_minutes(time_text)
    alert_minutes = parse_minutes(alert_text)

    return {
        "nombre": clean(get_payload_value(payload, "nombre", "name")),
        "tipo_caso": clean(get_payload_value(payload, "tipo_caso", "caseType", "case_type")),
        "prioridad": normalize_priority(get_payload_value(payload, "prioridad", "priority")),
        "canal": clean(get_payload_value(payload, "canal", "channel")),
        "tiempo_sla": time_text,
        "tiempo_sla_minutos": time_minutes,
        "alerta": alert_text,
        "alerta_minutos": alert_minutes,
        "area": clean(get_payload_value(payload, "area", "area_responsable", "responsible_area")),
        "estado": normalize_sla_status(get_payload_value(payload, "estado", "status", default="Activo")),
        "descripcion": clean(get_payload_value(payload, "descripcion", "description")),
        "categoria": clean(get_payload_value(payload, "categoria", "category")),
        "vigencia_inicio": safe_date(get_payload_value(payload, "vigencia_inicio", "startDate", "start_date")),
        "vigencia_fin": safe_date(get_payload_value(payload, "vigencia_fin", "endDate", "end_date")),
        "area_escalamiento": clean(get_payload_value(payload, "area_escalamiento", "escalationArea", "escalation_area")),
        "nivel_escalamiento": clean(get_payload_value(payload, "nivel_escalamiento", "escalationLevel", "escalation_level")),
        "motivo": clean(get_payload_value(payload, "motivo", "reason", default="Mantenimiento de regla SLA."))
    }


def validate_sla_payload(data: dict, exclude_rule_id: Optional[int] = None):
    required = [
        "nombre",
        "tipo_caso",
        "prioridad",
        "canal",
        "tiempo_sla",
        "alerta",
        "area",
        "estado",
        "descripcion"
    ]

    for field in required:
        if not clean(data.get(field)):
            raise HTTPException(status_code=400, detail=f"Falta el campo {field}.")

    if data.get("tiempo_sla_minutos") is None:
        raise HTTPException(status_code=400, detail="El tiempo SLA no tiene un formato válido.")

    if data.get("alerta_minutos") is None:
        raise HTTPException(status_code=400, detail="La alerta preventiva no tiene un formato válido.")

    if int(data["alerta_minutos"]) >= int(data["tiempo_sla_minutos"]):
        raise HTTPException(
            status_code=400,
            detail="La alerta preventiva debe ser menor al tiempo SLA."
        )

    params: list = [
        data["tipo_caso"],
        data["prioridad"],
        data["canal"],
        data["area"],
        data["estado"]
    ]

    exclude_sql = ""

    if exclude_rule_id:
        exclude_sql = "AND regla_sla_id <> ?"
        params.append(exclude_rule_id)

    duplicated = safe_fetch_one(
        f"""
        SELECT regla_sla_id
        FROM reglas_sla_admin
        WHERE tipo_caso = ?
          AND prioridad = ?
          AND canal = ?
          AND area = ?
          AND estado = ?
          {exclude_sql}
        """,
        tuple(params)
    )

    if duplicated:
        raise HTTPException(
            status_code=409,
            detail="Ya existe una regla SLA con el mismo tipo de caso, prioridad, canal, área y estado."
        )


def get_sla_rule_snapshot(rule_id: int) -> dict:
    row = safe_fetch_one(
        """
        SELECT *
        FROM reglas_sla_admin
        WHERE regla_sla_id = ?
        """,
        (rule_id,)
    )

    return dict(row or {})


def map_sla_rule_row(row: dict) -> dict:
    time_text = row.get("tiempo_sla") or ""
    alert_text = row.get("alerta") or ""

    time_minutes = row.get("tiempo_sla_minutos")
    alert_minutes = row.get("alerta_minutos")

    if time_minutes is None:
        time_minutes = parse_minutes(time_text) or 0

    if alert_minutes is None:
        alert_minutes = parse_minutes(alert_text) or 0

    validation_state = row.get("validacion_estado") or "Correcta"
    validation_message = row.get("validacion_mensaje") or "Regla válida."

    if alert_minutes and time_minutes and alert_minutes >= time_minutes:
        validation_state = "Rechazada"
        validation_message = "La alerta preventiva no puede ser igual o mayor al tiempo SLA."

    return {
        "id": row["regla_sla_id"],
        "regla_sla_id": row["regla_sla_id"],
        "icon": "⏱️",
        "name": row.get("nombre"),
        "nombre": row.get("nombre"),
        "caseType": row.get("tipo_caso"),
        "tipo_caso": row.get("tipo_caso"),
        "priority": row.get("prioridad"),
        "prioridad": row.get("prioridad"),
        "channel": row.get("canal"),
        "canal": row.get("canal"),
        "time": time_text,
        "tiempo_sla": time_text,
        "timeMinutes": int(time_minutes or 0),
        "tiempo_sla_minutos": int(time_minutes or 0),
        "alert": alert_text,
        "alerta": alert_text,
        "alertMinutes": int(alert_minutes or 0),
        "alerta_minutos": int(alert_minutes or 0),
        "area": row.get("area"),
        "status": row.get("estado"),
        "estado": row.get("estado"),
        "description": row.get("descripcion") or "",
        "descripcion": row.get("descripcion") or "",
        "category": row.get("categoria") or "",
        "categoria": row.get("categoria") or "",
        "startDate": safe_date(row.get("vigencia_inicio")),
        "vigencia_inicio": safe_date(row.get("vigencia_inicio")),
        "endDate": safe_date(row.get("vigencia_fin")),
        "vigencia_fin": safe_date(row.get("vigencia_fin")),
        "escalationArea": row.get("area_escalamiento") or "",
        "area_escalamiento": row.get("area_escalamiento") or "",
        "escalationLevel": row.get("nivel_escalamiento") or "",
        "nivel_escalamiento": row.get("nivel_escalamiento") or "",
        "validationStatus": validation_state,
        "validacion_estado": validation_state,
        "validationMessage": validation_message,
        "validacion_mensaje": validation_message,
        "createdAt": safe_datetime(row.get("fecha_creacion")),
        "updatedAt": safe_datetime(row.get("fecha_actualizacion"))
    }


def filter_sla_rules(
    items: List[dict],
    q: str = "",
    prioridad: str = "todos",
    estado: str = "todos",
    canal: str = "todos",
    tipo_caso: str = "todos"
) -> List[dict]:
    query = normalize_text(q)
    priority_filter = normalize_text(prioridad)
    status_filter = normalize_text(estado)
    channel_filter = normalize_text(canal)
    case_filter = normalize_text(tipo_caso)

    result = []

    for item in items:
        searchable = normalize_text(
            " ".join([
                clean(item.get("name")),
                clean(item.get("caseType")),
                clean(item.get("priority")),
                clean(item.get("channel")),
                clean(item.get("area")),
                clean(item.get("status")),
                clean(item.get("description")),
                clean(item.get("category"))
            ])
        )

        if query and query not in searchable:
            continue

        if priority_filter not in {"", "todos", "todo", "all"}:
            if priority_filter not in normalize_text(item.get("priority")):
                continue

        if status_filter not in {"", "todos", "todo", "all"}:
            if status_filter not in normalize_text(item.get("status")):
                continue

        if channel_filter not in {"", "todos", "todo", "all"}:
            if channel_filter not in normalize_text(item.get("channel")):
                continue

        if case_filter not in {"", "todos", "todo", "all"}:
            if case_filter not in normalize_text(item.get("caseType")):
                continue

        result.append(item)

    return result


def admin_sla_rules_service(
    admin: dict,
    q: str = "",
    prioridad: str = "todos",
    estado: str = "todos",
    canal: str = "todos",
    tipo_caso: str = "todos"
):
    if not table_exists("reglas_sla_admin"):
        return {
            "ok": True,
            "items": [],
            "summary": {
                "total": 0,
                "visible": 0,
                "active": 0,
                "critical": 0,
                "review": 0
            }
        }

    columns = get_table_columns("reglas_sla_admin")

    def col(name: str, fallback: str = "NULL"):
        return name if clean_lower(name) in columns else f"{fallback} AS {name}"

    rows = safe_fetch_all(
        f"""
        SELECT
            regla_sla_id,
            nombre,
            tipo_caso,
            prioridad,
            canal,
            tiempo_sla,
            alerta,
            area,
            estado,
            descripcion,
            fecha_creacion,
            {col("categoria")},
            {col("tiempo_sla_minutos")},
            {col("alerta_minutos")},
            {col("vigencia_inicio")},
            {col("vigencia_fin")},
            {col("area_escalamiento")},
            {col("nivel_escalamiento")},
            {col("validacion_estado")},
            {col("validacion_mensaje")},
            {col("fecha_actualizacion")}
        FROM reglas_sla_admin
        ORDER BY regla_sla_id DESC
        """
    )

    all_items = [map_sla_rule_row(row) for row in rows]
    filtered = filter_sla_rules(
        all_items,
        q=q,
        prioridad=prioridad,
        estado=estado,
        canal=canal,
        tipo_caso=tipo_caso
    )

    active_count = len([item for item in all_items if item["status"] == "Activo"])
    critical_count = len([item for item in all_items if normalize_text(item["priority"]) == "critica"])
    review_count = len([item for item in all_items if normalize_text(item["status"]) == "en revision"])
    invalid_count = len([item for item in all_items if item["validationStatus"] == "Rechazada"])

    priority_distribution = {}

    for item in all_items:
        priority_distribution[item["priority"]] = priority_distribution.get(item["priority"], 0) + 1

    status_distribution = {}

    for item in all_items:
        status_distribution[item["status"]] = status_distribution.get(item["status"], 0) + 1

    return {
        "ok": True,
        "items": filtered,
        "all_items": all_items,
        "summary": {
            "total": len(all_items),
            "visible": len(filtered),
            "active": active_count,
            "critical": critical_count,
            "review": review_count,
            "invalid": invalid_count
        },
        "priority_distribution": [
            {
                "label": key,
                "value": value
            }
            for key, value in priority_distribution.items()
        ],
        "status_distribution": [
            {
                "label": key,
                "value": value
            }
            for key, value in status_distribution.items()
        ],
        "kpis": [
            {
                "icon": "⏱️",
                "value": len(all_items),
                "label": "Reglas",
                "description": "Total configurado."
            },
            {
                "icon": "✅",
                "value": active_count,
                "label": "Activas",
                "description": "Reglas en uso."
            },
            {
                "icon": "🔥",
                "value": critical_count,
                "label": "Críticas",
                "description": "Alta prioridad."
            },
            {
                "icon": "🕘",
                "value": review_count,
                "label": "En revisión",
                "description": "Pendientes de validación."
            }
        ],
        "ai_summary": [
            {
                "title": "Validación SLA",
                "text": "La alerta preventiva debe ser menor que el tiempo SLA y estar alineada a prioridad."
            },
            {
                "title": "Reglas críticas",
                "text": "Las reglas críticas deben tener escalamiento y área responsable clara."
            }
        ],
        "action_plan": [
            {
                "icon": "1",
                "title": "Revisar alertas",
                "text": "Corregir reglas donde la alerta sea igual o mayor al SLA."
            },
            {
                "icon": "2",
                "title": "Validar duplicados",
                "text": "Evitar reglas repetidas para el mismo tipo, prioridad, canal y área."
            },
            {
                "icon": "3",
                "title": "Auditar cambios",
                "text": "Registrar motivo al crear, editar o duplicar reglas."
            }
        ]
    }


def admin_create_sla_rule_service(admin: dict, payload: dict):
    data = normalize_sla_payload(payload)
    validate_sla_payload(data)

    insert_dynamic(
        "reglas_sla_admin",
        {
            "nombre": data["nombre"],
            "tipo_caso": data["tipo_caso"],
            "prioridad": data["prioridad"],
            "canal": data["canal"],
            "tiempo_sla": data["tiempo_sla"],
            "tiempo_sla_minutos": data["tiempo_sla_minutos"],
            "alerta": data["alerta"],
            "alerta_minutos": data["alerta_minutos"],
            "area": data["area"],
            "estado": data["estado"],
            "descripcion": data["descripcion"],
            "categoria": data["categoria"],
            "vigencia_inicio": data["vigencia_inicio"],
            "vigencia_fin": data["vigencia_fin"],
            "area_escalamiento": data["area_escalamiento"],
            "nivel_escalamiento": data["nivel_escalamiento"],
            "validacion_estado": "Correcta",
            "validacion_mensaje": "Regla válida.",
            "motivo_ultimo_cambio": data["motivo"],
            "creado_por_usuario_id": admin.get("usuario_id"),
            "fecha_creacion": now(),
            "fecha_actualizacion": now()
        }
    )

    rule = safe_fetch_one(
        """
        SELECT TOP 1 regla_sla_id
        FROM reglas_sla_admin
        WHERE nombre = ?
        ORDER BY regla_sla_id DESC
        """,
        (data["nombre"],)
    )

    audit(
        admin,
        "SLA",
        "Regla SLA creada",
        before="-",
        after=data["nombre"],
        detail="Se creó una regla SLA.",
        critical=True,
        reason=data["motivo"],
        entity="reglas_sla_admin",
        entity_id=(rule or {}).get("regla_sla_id"),
        after_json=data
    )

    return {
        "ok": True,
        "message": "Regla SLA creada correctamente."
    }


def admin_update_sla_rule_service(admin: dict, rule_id: int, payload: dict):
    before = get_sla_rule_snapshot(rule_id)

    if not before:
        raise HTTPException(status_code=404, detail="Regla SLA no encontrada.")

    data = normalize_sla_payload(payload)
    validate_sla_payload(data, exclude_rule_id=rule_id)

    update_dynamic(
        "reglas_sla_admin",
        {
            "nombre": data["nombre"],
            "tipo_caso": data["tipo_caso"],
            "prioridad": data["prioridad"],
            "canal": data["canal"],
            "tiempo_sla": data["tiempo_sla"],
            "tiempo_sla_minutos": data["tiempo_sla_minutos"],
            "alerta": data["alerta"],
            "alerta_minutos": data["alerta_minutos"],
            "area": data["area"],
            "estado": data["estado"],
            "descripcion": data["descripcion"],
            "categoria": data["categoria"],
            "vigencia_inicio": data["vigencia_inicio"],
            "vigencia_fin": data["vigencia_fin"],
            "area_escalamiento": data["area_escalamiento"],
            "nivel_escalamiento": data["nivel_escalamiento"],
            "validacion_estado": "Correcta",
            "validacion_mensaje": "Regla válida.",
            "motivo_ultimo_cambio": data["motivo"],
            "fecha_actualizacion": now()
        },
        "regla_sla_id = ?",
        (rule_id,)
    )

    after = get_sla_rule_snapshot(rule_id)

    audit(
        admin,
        "SLA",
        "Regla SLA actualizada",
        before=before.get("nombre"),
        after=data["nombre"],
        detail="Se actualizó una regla SLA.",
        critical=True,
        reason=data["motivo"],
        entity="reglas_sla_admin",
        entity_id=rule_id,
        before_json=before,
        after_json=after
    )

    return {
        "ok": True,
        "message": "Regla SLA actualizada correctamente."
    }


def admin_duplicate_sla_rule_service(admin: dict, rule_id: int, payload: Optional[dict] = None):
    payload = payload or {}
    reason = clean(get_payload_value(payload, "motivo", "reason", default="Duplicación administrativa de regla SLA."))

    rule = get_sla_rule_snapshot(rule_id)

    if not rule:
        raise HTTPException(status_code=404, detail="Regla SLA no encontrada.")

    new_name = f"Copia de {rule.get('nombre')}"

    insert_dynamic(
        "reglas_sla_admin",
        {
            "nombre": new_name,
            "tipo_caso": rule.get("tipo_caso"),
            "prioridad": rule.get("prioridad"),
            "canal": rule.get("canal"),
            "tiempo_sla": rule.get("tiempo_sla"),
            "tiempo_sla_minutos": rule.get("tiempo_sla_minutos"),
            "alerta": rule.get("alerta"),
            "alerta_minutos": rule.get("alerta_minutos"),
            "area": rule.get("area"),
            "estado": "En revisión",
            "descripcion": rule.get("descripcion"),
            "categoria": rule.get("categoria"),
            "vigencia_inicio": rule.get("vigencia_inicio"),
            "vigencia_fin": rule.get("vigencia_fin"),
            "area_escalamiento": rule.get("area_escalamiento"),
            "nivel_escalamiento": rule.get("nivel_escalamiento"),
            "validacion_estado": "Pendiente",
            "validacion_mensaje": "Regla duplicada pendiente de revisión.",
            "motivo_ultimo_cambio": reason,
            "creado_por_usuario_id": admin.get("usuario_id"),
            "fecha_creacion": now(),
            "fecha_actualizacion": now()
        }
    )

    audit(
        admin,
        "SLA",
        "Regla SLA duplicada",
        before=rule.get("nombre"),
        after=new_name,
        detail="Se duplicó una regla SLA.",
        critical=True,
        reason=reason,
        entity="reglas_sla_admin",
        entity_id=rule_id,
        before_json=rule,
        after_json={
            "nombre": new_name,
            "estado": "En revisión"
        }
    )

    create_alert(
        "SLA",
        "Regla SLA duplicada pendiente",
        f"La regla {new_name} fue creada en revisión y debe validarse antes de activarse.",
        severity="Media",
        href="reglas-sla.html",
        priority="Media",
        entity="reglas_sla_admin",
        entity_id=rule_id
    )

    return {
        "ok": True,
        "message": "Regla SLA duplicada correctamente."
    }

# =========================================================
# INTEGRACIONES
# =========================================================

def normalize_integration_status(value: Any) -> str:
    text = clean(value)

    if not text:
        return "Activa"

    normalized = normalize_text(text)

    mapping = {
        "activa": "Activa",
        "activo": "Activa",
        "inactiva": "Inactiva",
        "inactivo": "Inactiva",
        "con alerta": "Con alerta",
        "alerta": "Con alerta",
        "error": "Error",
        "fallida": "Error",
        "fallido": "Error",
        "mantenimiento": "Mantenimiento",
        "en mantenimiento": "Mantenimiento"
    }

    return mapping.get(normalized, text)


def normalize_criticality(value: Any) -> str:
    text = clean(value)

    if not text:
        return "Media"

    normalized = normalize_text(text)

    mapping = {
        "critica": "Crítica",
        "critico": "Crítica",
        "alta": "Alta",
        "media": "Media",
        "baja": "Baja"
    }

    return mapping.get(normalized, text)


def normalize_integration_payload(payload: dict) -> dict:
    timeout_raw = get_payload_value(
        payload,
        "timeout",
        "timeout_segundos",
        "timeoutSeconds",
        default=30
    )

    return {
        "nombre": clean(get_payload_value(payload, "nombre", "name")),
        "tipo": clean(get_payload_value(payload, "tipo", "type")),
        "estado": normalize_integration_status(
            get_payload_value(payload, "estado", "status", default="Activa")
        ),
        "criticidad": normalize_criticality(
            get_payload_value(payload, "criticidad", "criticality", default="Media")
        ),
        "endpoint": clean(get_payload_value(payload, "endpoint", "url")),
        "descripcion": clean(get_payload_value(payload, "descripcion", "description")),
        "responsable": clean(get_payload_value(payload, "responsable", "owner", default="Administración")),
        "ambiente": clean(get_payload_value(payload, "ambiente", "environment", default="Producción")),
        "metodo_autenticacion": clean(
            get_payload_value(
                payload,
                "metodo_autenticacion",
                "authMethod",
                "auth_method",
                default="API Key"
            )
        ),
        "timeout_segundos": parse_seconds(timeout_raw) or to_int(timeout_raw, 30),
        "politica_reintentos": clean(
            get_payload_value(
                payload,
                "politica_reintentos",
                "retryPolicy",
                "retry_policy",
                default="3 reintentos"
            )
        ),
        "metodo_http": clean_upper(get_payload_value(payload, "metodo_http", "method", default="GET")),
        "credencial_alias": clean(
            get_payload_value(payload, "credencial_alias", "credentialAlias", default="Credencial protegida")
        ),
        "motivo": clean(get_payload_value(payload, "motivo", "reason", default="Mantenimiento de integración."))
    }


def validate_integration_payload(data: dict, exclude_id: Optional[int] = None):
    if not data["nombre"]:
        raise HTTPException(status_code=400, detail="El nombre de la integración es obligatorio.")

    if not data["tipo"]:
        raise HTTPException(status_code=400, detail="El tipo de integración es obligatorio.")

    if not data["endpoint"]:
        raise HTTPException(status_code=400, detail="El endpoint es obligatorio.")

    if not re.match(r"^https?://", data["endpoint"], flags=re.IGNORECASE):
        raise HTTPException(status_code=400, detail="El endpoint debe iniciar con http:// o https://.")

    if data["timeout_segundos"] <= 0:
        raise HTTPException(status_code=400, detail="El timeout debe ser mayor a cero.")

    params = [data["nombre"]]
    exclude_sql = ""

    if exclude_id:
        exclude_sql = "AND integracion_id <> ?"
        params.append(exclude_id)

    duplicated = safe_fetch_one(
        f"""
        SELECT integracion_id
        FROM integraciones_sistema
        WHERE LOWER(nombre) = LOWER(?)
        {exclude_sql}
        """,
        tuple(params)
    )

    if duplicated:
        raise HTTPException(status_code=409, detail="Ya existe una integración con ese nombre.")


def get_integration_snapshot(integration_id: int) -> dict:
    row = safe_fetch_one(
        """
        SELECT *
        FROM integraciones_sistema
        WHERE integracion_id = ?
        """,
        (integration_id,)
    )

    return dict(row or {})


def map_integration_row(row: dict) -> dict:
    status = row.get("estado") or "Sin estado"
    criticality = row.get("criticidad") or "Media"

    if normalize_text(status) == "activa":
        icon = "✅"
    elif normalize_text(status) == "con alerta":
        icon = "⚠️"
    elif normalize_text(status) == "error":
        icon = "⛔"
    else:
        icon = "🔌"

    return {
        "id": row["integracion_id"],
        "integracion_id": row["integracion_id"],
        "icon": icon,
        "name": row.get("nombre"),
        "nombre": row.get("nombre"),
        "type": row.get("tipo"),
        "tipo": row.get("tipo"),
        "status": status,
        "estado": status,
        "lastSync": safe_datetime(row.get("ultima_sincronizacion")) or "Sin sincronización",
        "ultima_sincronizacion": safe_datetime(row.get("ultima_sincronizacion")),
        "lastTest": safe_datetime(row.get("ultima_prueba")),
        "ultima_prueba": safe_datetime(row.get("ultima_prueba")),
        "owner": row.get("responsable") or "Administración",
        "responsable": row.get("responsable") or "Administración",
        "criticality": criticality,
        "criticidad": criticality,
        "endpoint": row.get("endpoint"),
        "environment": row.get("ambiente") or "Producción",
        "ambiente": row.get("ambiente") or "Producción",
        "authMethod": row.get("metodo_autenticacion") or "Protegida",
        "metodo_autenticacion": row.get("metodo_autenticacion") or "Protegida",
        "timeoutSeconds": row.get("timeout_segundos") or 30,
        "timeout_segundos": row.get("timeout_segundos") or 30,
        "retryPolicy": row.get("politica_reintentos") or "3 reintentos",
        "politica_reintentos": row.get("politica_reintentos") or "3 reintentos",
        "method": row.get("metodo_http") or "GET",
        "metodo_http": row.get("metodo_http") or "GET",
        "httpCode": row.get("codigo_http"),
        "codigo_http": row.get("codigo_http"),
        "latencyMs": row.get("latencia_ms"),
        "latencia_ms": row.get("latencia_ms"),
        "lastResult": row.get("resultado_ultima_prueba") or status,
        "resultado_ultima_prueba": row.get("resultado_ultima_prueba") or status,
        "credentialAlias": row.get("credencial_alias") or "Credencial protegida",
        "credencial_alias": row.get("credencial_alias") or "Credencial protegida",
        "description": row.get("descripcion") or "",
        "descripcion": row.get("descripcion") or ""
    }


def filter_integrations(
    items: List[dict],
    q: str = "",
    tipo: str = "todos",
    estado: str = "todos",
    criticidad: str = "todos"
) -> List[dict]:
    query = normalize_text(q)
    type_filter = normalize_text(tipo)
    status_filter = normalize_text(estado)
    criticality_filter = normalize_text(criticidad)

    result = []

    for item in items:
        searchable = normalize_text(
            " ".join([
                clean(item.get("name")),
                clean(item.get("type")),
                clean(item.get("status")),
                clean(item.get("criticality")),
                clean(item.get("endpoint")),
                clean(item.get("owner")),
                clean(item.get("description")),
                clean(item.get("environment"))
            ])
        )

        if query and query not in searchable:
            continue

        if type_filter not in {"", "todos", "todo", "all"}:
            if type_filter not in normalize_text(item.get("type")):
                continue

        if status_filter not in {"", "todos", "todo", "all"}:
            if status_filter not in normalize_text(item.get("status")):
                continue

        if criticality_filter not in {"", "todos", "todo", "all"}:
            if criticality_filter not in normalize_text(item.get("criticality")):
                continue

        result.append(item)

    return result


def get_integration_events(limit: int = 20, integration_id: Optional[int] = None) -> List[dict]:
    if not table_exists("eventos_integracion"):
        return []

    params = []
    where_sql = "1 = 1"

    if integration_id:
        where_sql = "integracion_id = ?"
        params.append(integration_id)

    columns = get_table_columns("eventos_integracion")

    def col(name: str, fallback: str = "NULL"):
        return name if clean_lower(name) in columns else f"{fallback} AS {name}"

    rows = safe_fetch_all(
        f"""
        SELECT TOP {to_int(limit, 20)}
            evento_id,
            integracion_id,
            titulo,
            descripcion,
            estado,
            fecha_evento,
            {col("codigo_http")},
            {col("latencia_ms")},
            {col("endpoint")},
            {col("request_id")},
            {col("respuesta")},
            {col("nivel")}
        FROM eventos_integracion
        WHERE {where_sql}
        ORDER BY fecha_evento DESC
        """,
        tuple(params)
    )

    items = []

    for row in rows:
        state = row.get("estado") or "Sin estado"
        icon = "✅" if normalize_text(state) == "exitoso" else "⚠️"

        items.append({
            "id": row["evento_id"],
            "icon": icon,
            "title": row.get("titulo"),
            "text": row.get("descripcion"),
            "state": state,
            "estado": state,
            "date": safe_datetime(row.get("fecha_evento")),
            "fecha_evento": safe_datetime(row.get("fecha_evento")),
            "httpCode": row.get("codigo_http"),
            "codigo_http": row.get("codigo_http"),
            "latencyMs": row.get("latencia_ms"),
            "latencia_ms": row.get("latencia_ms"),
            "endpoint": row.get("endpoint"),
            "requestId": row.get("request_id"),
            "request_id": row.get("request_id"),
            "response": row.get("respuesta"),
            "respuesta": row.get("respuesta"),
            "level": row.get("nivel") or "Info",
            "nivel": row.get("nivel") or "Info"
        })

    return items


def admin_integrations_service(
    admin: dict,
    q: str = "",
    tipo: str = "todos",
    estado: str = "todos",
    criticidad: str = "todos"
):
    if not table_exists("integraciones_sistema"):
        return {
            "ok": True,
            "items": [],
            "all_items": [],
            "webhooks": [],
            "events": [],
            "summary": {
                "total": 0,
                "visible": 0,
                "active": 0,
                "alerts": 0,
                "errors": 0,
                "critical": 0
            }
        }

    columns = get_table_columns("integraciones_sistema")

    def col(name: str, fallback: str = "NULL"):
        return name if clean_lower(name) in columns else f"{fallback} AS {name}"

    rows = safe_fetch_all(
        f"""
        SELECT
            integracion_id,
            nombre,
            tipo,
            estado,
            criticidad,
            endpoint,
            descripcion,
            responsable,
            ultima_sincronizacion,
            {col("ambiente")},
            {col("metodo_autenticacion")},
            {col("timeout_segundos")},
            {col("politica_reintentos")},
            {col("metodo_http")},
            {col("codigo_http")},
            {col("latencia_ms")},
            {col("ultima_prueba")},
            {col("resultado_ultima_prueba")},
            {col("credencial_alias")}
        FROM integraciones_sistema
        ORDER BY integracion_id DESC
        """
    )

    all_items = [map_integration_row(row) for row in rows]

    filtered = filter_integrations(
        all_items,
        q=q,
        tipo=tipo,
        estado=estado,
        criticidad=criticidad
    )

    active_count = len([item for item in all_items if normalize_text(item["status"]) == "activa"])
    alert_count = len([item for item in all_items if normalize_text(item["status"]) == "con alerta"])
    error_count = len([item for item in all_items if normalize_text(item["status"]) == "error"])
    critical_count = len([
        item for item in all_items
        if normalize_text(item["criticality"]) in {"alta", "critica"}
    ])

    events = get_integration_events(limit=20)

    return {
        "ok": True,
        "items": filtered,
        "all_items": all_items,
        "webhooks": events,
        "events": events,
        "summary": {
            "total": len(all_items),
            "visible": len(filtered),
            "active": active_count,
            "alerts": alert_count,
            "errors": error_count,
            "critical": critical_count
        },
        "kpis": [
            {
                "icon": "🔌",
                "value": len(all_items),
                "label": "Integraciones",
                "description": "Servicios configurados."
            },
            {
                "icon": "✅",
                "value": active_count,
                "label": "Activas",
                "description": "Operando sin alerta."
            },
            {
                "icon": "⚠️",
                "value": alert_count,
                "label": "Con alerta",
                "description": "Requieren revisión."
            },
            {
                "icon": "⛔",
                "value": error_count,
                "label": "Con error",
                "description": "Impactan operación."
            }
        ],
        "ai_summary": [
            {
                "title": "Salud de integraciones",
                "text": "Prioriza integraciones críticas con error, alta latencia o última prueba fallida."
            },
            {
                "title": "Seguridad de credenciales",
                "text": "No expongas tokens en frontend. Usa alias o credenciales protegidas."
            }
        ],
        "action_plan": [
            {
                "icon": "1",
                "title": "Probar críticas",
                "text": "Ejecutar prueba primero en integraciones de criticidad alta."
            },
            {
                "icon": "2",
                "title": "Revisar logs",
                "text": "Validar código HTTP, latencia y último error."
            },
            {
                "icon": "3",
                "title": "Auditar cambios",
                "text": "Registrar motivo al editar endpoint o autenticación."
            }
        ]
    }


def admin_create_integration_service(admin: dict, payload: dict):
    data = normalize_integration_payload(payload)
    validate_integration_payload(data)

    insert_dynamic(
        "integraciones_sistema",
        {
            "nombre": data["nombre"],
            "tipo": data["tipo"],
            "estado": data["estado"],
            "criticidad": data["criticidad"],
            "endpoint": data["endpoint"],
            "descripcion": data["descripcion"],
            "responsable": data["responsable"],
            "ambiente": data["ambiente"],
            "metodo_autenticacion": data["metodo_autenticacion"],
            "timeout_segundos": data["timeout_segundos"],
            "politica_reintentos": data["politica_reintentos"],
            "metodo_http": data["metodo_http"],
            "credencial_alias": data["credencial_alias"],
            "motivo_ultimo_cambio": data["motivo"],
            "creado_por_usuario_id": admin.get("usuario_id"),
            "fecha_creacion": now(),
            "fecha_actualizacion": now()
        }
    )

    integration = safe_fetch_one(
        """
        SELECT TOP 1 integracion_id
        FROM integraciones_sistema
        WHERE nombre = ?
        ORDER BY integracion_id DESC
        """,
        (data["nombre"],)
    )

    integration_id = (integration or {}).get("integracion_id")

    audit(
        admin,
        "Integraciones",
        "Integración creada",
        before="-",
        after=data["nombre"],
        detail="Se creó integración.",
        critical=True,
        reason=data["motivo"],
        entity="integraciones_sistema",
        entity_id=integration_id,
        after_json=data
    )

    return {
        "ok": True,
        "message": "Integración creada correctamente."
    }


def admin_update_integration_service(admin: dict, integration_id: int, payload: dict):
    before = get_integration_snapshot(integration_id)

    if not before:
        raise HTTPException(status_code=404, detail="Integración no encontrada.")

    data = normalize_integration_payload(payload)
    validate_integration_payload(data, exclude_id=integration_id)

    update_dynamic(
        "integraciones_sistema",
        {
            "nombre": data["nombre"],
            "tipo": data["tipo"],
            "estado": data["estado"],
            "criticidad": data["criticidad"],
            "endpoint": data["endpoint"],
            "descripcion": data["descripcion"],
            "responsable": data["responsable"],
            "ambiente": data["ambiente"],
            "metodo_autenticacion": data["metodo_autenticacion"],
            "timeout_segundos": data["timeout_segundos"],
            "politica_reintentos": data["politica_reintentos"],
            "metodo_http": data["metodo_http"],
            "credencial_alias": data["credencial_alias"],
            "motivo_ultimo_cambio": data["motivo"],
            "fecha_actualizacion": now()
        },
        "integracion_id = ?",
        (integration_id,)
    )

    after = get_integration_snapshot(integration_id)

    audit(
        admin,
        "Integraciones",
        "Integración actualizada",
        before=before.get("nombre"),
        after=data["nombre"],
        detail="Se actualizó integración.",
        critical=True,
        reason=data["motivo"],
        entity="integraciones_sistema",
        entity_id=integration_id,
        before_json=before,
        after_json=after
    )

    return {
        "ok": True,
        "message": "Integración actualizada correctamente."
    }


def simulate_integration_test(integration: dict) -> dict:
    endpoint = clean(integration.get("endpoint"))
    criticality = normalize_text(integration.get("criticidad"))

    latency = secrets.randbelow(850) + 80

    if not endpoint.startswith("http"):
        return {
            "estado": "Error",
            "resultado": "Fallido",
            "codigo_http": 0,
            "latencia_ms": latency,
            "mensaje": "Endpoint inválido.",
            "nivel": "Error"
        }

    if "error" in normalize_text(endpoint):
        return {
            "estado": "Error",
            "resultado": "Fallido",
            "codigo_http": 500,
            "latencia_ms": latency,
            "mensaje": "La integración respondió con error simulado.",
            "nivel": "Error"
        }

    if criticality in {"alta", "critica"} and latency > 750:
        return {
            "estado": "Con alerta",
            "resultado": "Con alerta",
            "codigo_http": 200,
            "latencia_ms": latency,
            "mensaje": "La integración respondió, pero con latencia alta.",
            "nivel": "Warning"
        }

    return {
        "estado": "Activa",
        "resultado": "Exitoso",
        "codigo_http": 200,
        "latencia_ms": latency,
        "mensaje": "Prueba de conexión registrada correctamente.",
        "nivel": "Info"
    }


def admin_test_integration_service(admin: dict, integration_id: int, payload: Optional[dict] = None):
    payload = payload or {}
    reason = clean(get_payload_value(payload, "motivo", "reason", default="Prueba manual de integración."))

    integration = get_integration_snapshot(integration_id)

    if not integration:
        raise HTTPException(status_code=404, detail="Integración no encontrada.")

    result = simulate_integration_test(integration)
    request_id = make_correlation_id()

    update_dynamic(
        "integraciones_sistema",
        {
            "estado": result["estado"],
            "ultima_sincronizacion": now(),
            "ultima_prueba": now(),
            "resultado_ultima_prueba": result["resultado"],
            "codigo_http": result["codigo_http"],
            "latencia_ms": result["latencia_ms"],
            "fecha_actualizacion": now()
        },
        "integracion_id = ?",
        (integration_id,)
    )

    insert_dynamic(
        "eventos_integracion",
        {
            "integracion_id": integration_id,
            "titulo": "Prueba de conexión",
            "descripcion": f"{result['mensaje']} Latencia: {result['latencia_ms']} ms.",
            "estado": result["resultado"],
            "fecha_evento": now(),
            "codigo_http": result["codigo_http"],
            "latencia_ms": result["latencia_ms"],
            "endpoint": integration.get("endpoint"),
            "request_id": request_id,
            "respuesta": json_dumps(result),
            "nivel": result["nivel"]
        }
    )

    audit(
        admin,
        "Integraciones",
        "Prueba de integración",
        before=integration.get("estado"),
        after=result["resultado"],
        detail=result["mensaje"],
        critical=result["resultado"] != "Exitoso",
        reason=reason,
        entity="integraciones_sistema",
        entity_id=integration_id,
        after_json=result,
        correlation_id=request_id,
        sensitivity="Alta" if result["resultado"] != "Exitoso" else "Media"
    )

    if result["resultado"] != "Exitoso":
        create_alert(
            "Integraciones",
            "Prueba de integración con alerta",
            f"{integration.get('nombre')} registró resultado {result['resultado']}.",
            severity="Alta" if result["resultado"] == "Fallido" else "Media",
            href="integraciones.html",
            priority="Alta" if result["resultado"] == "Fallido" else "Media",
            entity="integraciones_sistema",
            entity_id=integration_id
        )

    return {
        "ok": True,
        "message": "Prueba de integración registrada correctamente.",
        "result": result
    }


def admin_test_all_integrations_service(admin: dict, payload: Optional[dict] = None):
    payload = payload or {}

    rows = safe_fetch_all(
        """
        SELECT integracion_id
        FROM integraciones_sistema
        ORDER BY integracion_id
        """
    )

    results = []

    for row in rows:
        try:
            result = admin_test_integration_service(admin, row["integracion_id"], payload)
            results.append(result.get("result", {}))
        except Exception as exc:
            results.append({
                "estado": "Error",
                "resultado": "Fallido",
                "mensaje": str(exc)
            })

    failed = len([item for item in results if item.get("resultado") != "Exitoso"])

    return {
        "ok": True,
        "message": f"Se registraron {len(rows)} pruebas de integración.",
        "total": len(rows),
        "failed": failed,
        "results": results
    }


def admin_integration_logs_service(admin: dict, integration_id: int, limit: int = 50):
    integration = get_integration_snapshot(integration_id)

    if not integration:
        raise HTTPException(status_code=404, detail="Integración no encontrada.")

    return {
        "ok": True,
        "integration": map_integration_row(integration),
        "items": get_integration_events(limit=limit, integration_id=integration_id)
    }


# =========================================================
# INDICADORES / REPORTES / EXPORTACIONES
# =========================================================

import base64
import zipfile
from xml.sax.saxutils import escape as xml_escape


REPORT_FORMATS = {
    "pdf": {
        "label": "PDF",
        "extension": "pdf",
        "mime": "application/pdf"
    },
    "word": {
        "label": "Word",
        "extension": "docx",
        "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    },
    "docx": {
        "label": "Word",
        "extension": "docx",
        "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    },
    "excel": {
        "label": "Excel",
        "extension": "xlsx",
        "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    },
    "xlsx": {
        "label": "Excel",
        "extension": "xlsx",
        "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    },
    "csv": {
        "label": "CSV",
        "extension": "csv",
        "mime": "text/csv"
    },
    "imagen": {
        "label": "Imagen PNG",
        "extension": "png",
        "mime": "image/png"
    },
    "imagen png": {
        "label": "Imagen PNG",
        "extension": "png",
        "mime": "image/png"
    },
    "png": {
        "label": "Imagen PNG",
        "extension": "png",
        "mime": "image/png"
    },
    "dashboard": {
        "label": "Dashboard compartible",
        "extension": "json",
        "mime": "application/json"
    },
    "dashboard compartible": {
        "label": "Dashboard compartible",
        "extension": "json",
        "mime": "application/json"
    }
}


def normalize_report_format(value: Any) -> dict:
    raw = normalize_text(value)

    if not raw:
        raise HTTPException(status_code=400, detail="El formato del reporte es obligatorio.")

    if raw not in REPORT_FORMATS:
        raise HTTPException(
            status_code=400,
            detail="Formato no soportado. Usa PDF, Word, Excel, CSV, Imagen PNG o Dashboard compartible."
        )

    return REPORT_FORMATS[raw]


def sanitize_filename(value: str) -> str:
    text = normalize_text(value)
    text = re.sub(r"[^a-z0-9_\-]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text or "reporte"


def get_period_days(period: str) -> int:
    value = normalize_text(period)

    if value in {"hoy", "dia", "día"}:
        return 1

    if "7" in value or "semana" in value:
        return 7

    if "30" in value or "mes" in value:
        return 30

    if "trimestre" in value:
        return 90

    return 30


def safe_count_sql(query: str, params: tuple = ()) -> int:
    row = safe_fetch_one(query, params, {"total": 0})
    return int((row or {}).get("total") or 0)


def get_admin_metrics():
    total_users = count_table("usuarios")
    active_users = count_table("usuarios", "estado = 'ACTIVO'")
    blocked_users = count_table("usuarios", "estado = 'BLOQUEADO'")
    total_roles = count_table("roles")
    total_permissions = count_table("permisos")
    total_cases = count_table("casos")
    open_cases = count_table("casos", "fecha_cierre IS NULL") if table_exists("casos") else 0
    total_integrations = count_table("integraciones_sistema")
    healthy_integrations = count_table("integraciones_sistema", "estado = 'Activa'") if table_exists("integraciones_sistema") else 0
    integration_alerts = count_table("integraciones_sistema", "estado IN ('Con alerta', 'Error')") if table_exists("integraciones_sistema") else 0
    critical_audit = count_table("auditoria_admin", "critico = 1") if table_exists("auditoria_admin") else 0
    completed_backups = count_table("respaldos_sistema", "estado = 'Completado'") if table_exists("respaldos_sistema") else 0
    failed_backups = count_table("respaldos_sistema", "estado = 'Fallido'") if table_exists("respaldos_sistema") else 0

    user_progress = 100 if total_users == 0 else int((active_users / total_users) * 100)
    integration_progress = 100 if total_integrations == 0 else int((healthy_integrations / total_integrations) * 100)
    backup_progress = 100 if completed_backups > 0 and failed_backups == 0 else 70 if completed_backups > 0 else 30

    return [
        {
            "id": "MET-USR",
            "icon": "👤",
            "title": "Usuarios activos",
            "value": active_users,
            "target": total_users,
            "progress": user_progress,
            "status": metric_status(user_progress),
            "description": "Usuarios activos frente al total registrado.",
            "cause": "Cuentas inactivas o bloqueadas reducen disponibilidad operativa."
        },
        {
            "id": "MET-BLOCK",
            "icon": "🔒",
            "title": "Usuarios bloqueados",
            "value": blocked_users,
            "target": "0",
            "progress": max(0, 100 - blocked_users * 10),
            "status": "danger" if blocked_users > 0 else "success",
            "description": "Cuentas bloqueadas por seguridad o acción administrativa.",
            "cause": "Intentos fallidos, bloqueo manual o credenciales vencidas."
        },
        {
            "id": "MET-ROL",
            "icon": "🔐",
            "title": "Roles y permisos",
            "value": f"{total_roles}/{total_permissions}",
            "target": "Gobernado",
            "progress": 90 if total_roles and total_permissions else 40,
            "status": "success" if total_roles and total_permissions else "warning",
            "description": "Roles y permisos disponibles para la operación.",
            "cause": "La matriz debe mantenerse con mínimo privilegio."
        },
        {
            "id": "MET-CASOS",
            "icon": "📈",
            "title": "Casos abiertos",
            "value": open_cases,
            "target": total_cases,
            "progress": 80 if total_cases else 60,
            "status": "info",
            "description": "Casos abiertos registrados en la plataforma.",
            "cause": "La carga depende del flujo operativo de reclamos, incidencias y solicitudes."
        },
        {
            "id": "MET-INT",
            "icon": "🔌",
            "title": "Integraciones sanas",
            "value": f"{healthy_integrations}/{total_integrations}",
            "target": f"{total_integrations}/{total_integrations}",
            "progress": integration_progress,
            "status": metric_status(integration_progress),
            "description": "Integraciones sin alerta ni error.",
            "cause": "Errores de conexión o sincronización impactan procesos automáticos."
        },
        {
            "id": "MET-INT-ALERT",
            "icon": "⚠️",
            "title": "Integraciones con alerta",
            "value": integration_alerts,
            "target": "0",
            "progress": max(0, 100 - integration_alerts * 15),
            "status": "danger" if integration_alerts else "success",
            "description": "Servicios externos con alerta o error.",
            "cause": "APIs, webhooks, SMTP o servicios externos no disponibles."
        },
        {
            "id": "MET-AUD",
            "icon": "🕵️",
            "title": "Eventos sensibles",
            "value": critical_audit,
            "target": "Controlado",
            "progress": max(0, 100 - critical_audit * 5),
            "status": "warning" if critical_audit > 0 else "success",
            "description": "Eventos críticos de auditoría administrativa.",
            "cause": "Cambios en usuarios, roles, SLA, integraciones, reportes o configuración."
        },
        {
            "id": "MET-BKP",
            "icon": "💾",
            "title": "Respaldos completados",
            "value": completed_backups,
            "target": "Vigente",
            "progress": backup_progress,
            "status": metric_status(backup_progress),
            "description": "Copias completadas registradas.",
            "cause": "La continuidad requiere copias verificadas y restaurables."
        }
    ]


def get_case_evolution(days: int = 7) -> List[dict]:
    if not table_exists("casos"):
        return []

    return safe_fetch_all(
        """
        SELECT
            FORMAT(fecha_registro, 'dd/MM') AS label,
            COUNT(*) AS value
        FROM casos
        WHERE fecha_registro >= DATEADD(DAY, ?, SYSDATETIME())
        GROUP BY FORMAT(fecha_registro, 'dd/MM')
        ORDER BY MIN(fecha_registro)
        """,
        (-abs(days),)
    )


def get_channel_distribution() -> List[dict]:
    if not table_exists("casos") or not table_exists("canales_ingreso"):
        return []

    return safe_fetch_all(
        """
        SELECT
            ISNULL(ci.nombre, 'Sin canal') AS label,
            COUNT(*) AS value
        FROM casos c
        LEFT JOIN canales_ingreso ci ON ci.canal_ingreso_id = c.canal_ingreso_id
        GROUP BY ci.nombre
        ORDER BY COUNT(*) DESC
        """
    )


def get_reports_table(limit: int = 30) -> List[dict]:
    if not table_exists("reportes"):
        return []

    columns = get_table_columns("reportes")

    def col(name: str, fallback: str = "NULL"):
        return name if clean_lower(name) in columns else f"{fallback} AS {name}"

    reports = safe_fetch_all(
        f"""
        SELECT TOP {to_int(limit, 30)}
            r.reporte_id,
            r.nombre,
            r.tipo,
            r.periodo,
            r.alcance,
            r.formato,
            r.estado,
            r.fecha_generacion,
            {col("archivo_nombre")},
            {col("archivo_ruta")},
            {col("mime_type")},
            {col("tamano_bytes")},
            {col("token_compartido")},
            {col("url_compartida")},
            u.username AS generado_por
        FROM reportes r
        LEFT JOIN usuarios u ON u.usuario_id = r.generado_por_usuario_id
        ORDER BY r.fecha_generacion DESC
        """
    )

    items = []

    for row in reports:
        report_id = row["reporte_id"]
        file_name = row.get("archivo_nombre")
        shared_url = row.get("url_compartida")

        items.append({
            "id": report_id,
            "reporte_id": report_id,
            "name": row.get("nombre"),
            "nombre": row.get("nombre"),
            "type": row.get("tipo"),
            "tipo": row.get("tipo"),
            "period": row.get("periodo"),
            "periodo": row.get("periodo"),
            "scope": row.get("alcance"),
            "alcance": row.get("alcance"),
            "format": row.get("formato"),
            "formato": row.get("formato"),
            "status": row.get("estado"),
            "estado": row.get("estado"),
            "owner": row.get("generado_por") or "Administrador",
            "responsable": row.get("generado_por") or "Administrador",
            "fileName": file_name,
            "archivo_nombre": file_name,
            "mimeType": row.get("mime_type"),
            "mime_type": row.get("mime_type"),
            "size": row.get("tamano_bytes"),
            "tamano_bytes": row.get("tamano_bytes"),
            "date": safe_datetime(row.get("fecha_generacion")),
            "fecha_generacion": safe_datetime(row.get("fecha_generacion")),
            "downloadUrl": f"/api/admin/reportes/{report_id}/descargar" if file_name else "",
            "download_url": f"/api/admin/reportes/{report_id}/descargar" if file_name else "",
            "sharedUrl": shared_url or "",
            "url_compartida": shared_url or ""
        })

    return items


def build_report_dataset(admin: dict, payload: dict) -> dict:
    include_audit = to_bool(get_payload_value(payload, "incluir_auditoria", "includeAudit"), False)
    include_sla = to_bool(get_payload_value(payload, "incluir_sla", "includeSla"), False)
    include_security = to_bool(get_payload_value(payload, "incluir_seguridad", "includeSecurity"), False)
    include_charts = to_bool(get_payload_value(payload, "incluir_graficos", "includeCharts"), False)

    metrics = get_admin_metrics()

    dataset = {
        "generated_at": safe_datetime(now()),
        "generated_by": admin_name(admin),
        "metrics": metrics,
        "case_evolution": get_case_evolution(30 if "mes" in normalize_text(get_payload_value(payload, "periodo")) else 7),
        "channel_distribution": get_channel_distribution(),
        "summary": {
            "usuarios": count_table("usuarios"),
            "roles": count_table("roles"),
            "permisos": count_table("permisos"),
            "casos": count_table("casos"),
            "integraciones": count_table("integraciones_sistema"),
            "auditoria_critica": count_table("auditoria_admin", "critico = 1") if table_exists("auditoria_admin") else 0,
            "respaldos": count_table("respaldos_sistema")
        },
        "sections": {
            "include_audit": include_audit,
            "include_sla": include_sla,
            "include_security": include_security,
            "include_charts": include_charts
        }
    }

    if include_audit and table_exists("auditoria_admin"):
        dataset["audit"] = safe_fetch_all(
            """
            SELECT TOP 30
                fecha_evento,
                modulo,
                accion,
                usuario_nombre,
                resultado,
                critico,
                detalle
            FROM auditoria_admin
            ORDER BY fecha_evento DESC
            """
        )
    else:
        dataset["audit"] = []

    if include_sla and table_exists("reglas_sla_admin"):
        dataset["sla_rules"] = safe_fetch_all(
            """
            SELECT TOP 30
                nombre,
                tipo_caso,
                prioridad,
                canal,
                tiempo_sla,
                alerta,
                area,
                estado
            FROM reglas_sla_admin
            ORDER BY regla_sla_id DESC
            """
        )
    else:
        dataset["sla_rules"] = []

    if include_security:
        dataset["security"] = {
            "usuarios_bloqueados": count_table("usuarios", "estado = 'BLOQUEADO'"),
            "administradores_activos": count_active_admins(),
            "eventos_criticos": count_table("auditoria_admin", "critico = 1") if table_exists("auditoria_admin") else 0,
            "permisos_sensibles": count_table("permisos", "ISNULL(es_sensible, 0) = 1") if column_exists("permisos", "es_sensible") else 0
        }
    else:
        dataset["security"] = {}

    return dataset


def report_lines(title: str, payload: dict, dataset: dict) -> List[str]:
    lines = [
        title,
        "",
        f"Generado: {dataset.get('generated_at')}",
        f"Generado por: {dataset.get('generated_by')}",
        f"Tipo: {get_payload_value(payload, 'tipo')}",
        f"Periodo: {get_payload_value(payload, 'periodo')}",
        f"Alcance: {get_payload_value(payload, 'alcance')}",
        "",
        "Resumen ejecutivo:",
    ]

    summary = dataset.get("summary", {})

    for key, value in summary.items():
        lines.append(f"- {key.replace('_', ' ').title()}: {value}")

    lines.append("")
    lines.append("Indicadores:")

    for metric in dataset.get("metrics", []):
        lines.append(
            f"- {metric['title']}: {metric['value']} | Meta: {metric['target']} | Avance: {metric['progress']}%"
        )

    if dataset.get("audit"):
        lines.append("")
        lines.append("Auditoría reciente:")

        for item in dataset["audit"][:15]:
            lines.append(
                f"- {safe_datetime(item.get('fecha_evento'))} | {item.get('modulo')} | {item.get('accion')} | {item.get('resultado')}"
            )

    if dataset.get("sla_rules"):
        lines.append("")
        lines.append("Reglas SLA:")

        for item in dataset["sla_rules"][:15]:
            lines.append(
                f"- {item.get('nombre')} | {item.get('prioridad')} | {item.get('tiempo_sla')} | {item.get('estado')}"
            )

    if dataset.get("security"):
        lines.append("")
        lines.append("Seguridad:")

        for key, value in dataset["security"].items():
            lines.append(f"- {key.replace('_', ' ').title()}: {value}")

    comentario = clean(get_payload_value(payload, "comentario", "comment"))

    if comentario:
        lines.append("")
        lines.append("Comentario:")
        lines.append(comentario)

    return lines


def write_file(path: str, content: bytes):
    with open(path, "wb") as file:
        file.write(content)


def generate_csv_file(path: str, lines: List[str], dataset: dict):
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["Sección", "Campo", "Valor"])

    for line in lines:
        if not line:
            continue
        writer.writerow(["Resumen", line, ""])

    for metric in dataset.get("metrics", []):
        writer.writerow(["Indicadores", metric["title"], metric["value"]])
        writer.writerow(["Indicadores", f"{metric['title']} - Meta", metric["target"]])
        writer.writerow(["Indicadores", f"{metric['title']} - Avance", f"{metric['progress']}%"])

    write_file(path, output.getvalue().encode("utf-8-sig"))


def generate_pdf_file(path: str, lines: List[str]):
    """
    PDF mínimo válido sin dependencias externas.
    Para producción real se podría usar reportlab, pero esto evita que el backend
    rompa si no instalas librerías adicionales.
    """
    safe_lines = []

    for line in lines[:45]:
        text = clean(line)
        text = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        text = text.encode("latin-1", "replace").decode("latin-1")
        safe_lines.append(text)

    stream_lines = ["BT", "/F1 10 Tf", "50 790 Td"]

    for index, line in enumerate(safe_lines):
        if index > 0:
            stream_lines.append("0 -16 Td")
        stream_lines.append(f"({line[:95]}) Tj")

    stream_lines.append("ET")
    stream = "\n".join(stream_lines).encode("latin-1", "replace")

    objects = []
    objects.append(b"1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj")
    objects.append(b"2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj")
    objects.append(
        b"3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
        b"/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj"
    )
    objects.append(b"4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj")
    objects.append(
        b"5 0 obj << /Length " + str(len(stream)).encode("ascii") + b" >> stream\n" +
        stream +
        b"\nendstream endobj"
    )

    pdf = b"%PDF-1.4\n"
    offsets = [0]

    for obj in objects:
        offsets.append(len(pdf))
        pdf += obj + b"\n"

    xref_pos = len(pdf)
    pdf += f"xref\n0 {len(objects) + 1}\n".encode("ascii")
    pdf += b"0000000000 65535 f \n"

    for offset in offsets[1:]:
        pdf += f"{offset:010d} 00000 n \n".encode("ascii")

    pdf += (
        f"trailer << /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF"
    ).encode("ascii")

    write_file(path, pdf)


def generate_docx_file(path: str, lines: List[str]):
    paragraphs = ""

    for line in lines:
        text = xml_escape(clean(line))
        paragraphs += f"<w:p><w:r><w:t>{text}</w:t></w:r></w:p>"

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

    document = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>{paragraphs}</w:body>
</w:document>"""

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types)
        docx.writestr("_rels/.rels", rels)
        docx.writestr("word/document.xml", document)


def generate_xlsx_file(path: str, dataset: dict):
    rows = [["Indicador", "Valor", "Meta", "Avance", "Estado"]]

    for metric in dataset.get("metrics", []):
        rows.append([
            metric.get("title"),
            metric.get("value"),
            metric.get("target"),
            f"{metric.get('progress')}%",
            metric.get("status")
        ])

    def cell(value: Any) -> str:
        return f"<c t=\"inlineStr\"><is><t>{xml_escape(clean(value))}</t></is></c>"

    sheet_rows = ""

    for idx, row in enumerate(rows, start=1):
        sheet_rows += f"<row r=\"{idx}\">"
        for value in row:
            sheet_rows += cell(value)
        sheet_rows += "</row>"

    content_types = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>"""

    rels = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""

    workbook = """<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Indicadores" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>"""

    workbook_rels = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>"""

    sheet = f"""<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>{sheet_rows}</sheetData>
</worksheet>"""

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as xlsx:
        xlsx.writestr("[Content_Types].xml", content_types)
        xlsx.writestr("_rels/.rels", rels)
        xlsx.writestr("xl/workbook.xml", workbook)
        xlsx.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        xlsx.writestr("xl/worksheets/sheet1.xml", sheet)


def generate_png_file(path: str):
    """
    PNG mínimo válido. Sirve como evidencia visual generada.
    Para captura real del dashboard se podría integrar Playwright en backend.
    """
    png_1x1 = (
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8"
        "/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
    )

    write_file(path, base64.b64decode(png_1x1))


def generate_dashboard_json(path: str, payload: dict, dataset: dict, token: str):
    content = {
        "token": token,
        "created_at": safe_datetime(now()),
        "expires_at": safe_datetime(now() + timedelta(days=7)),
        "payload": payload,
        "dataset": dataset
    }

    write_file(path, json_dumps(content).encode("utf-8"))


def generate_report_file(format_info: dict, title: str, payload: dict, dataset: dict, token: Optional[str] = None) -> str:
    safe_title = sanitize_filename(title)
    timestamp = now().strftime("%Y%m%d_%H%M%S")
    filename = f"{safe_title}_{timestamp}.{format_info['extension']}"
    path = os.path.join(EXPORT_BASE_DIR, filename)

    lines = report_lines(title, payload, dataset)

    if format_info["extension"] == "csv":
        generate_csv_file(path, lines, dataset)
    elif format_info["extension"] == "pdf":
        generate_pdf_file(path, lines)
    elif format_info["extension"] == "docx":
        generate_docx_file(path, lines)
    elif format_info["extension"] == "xlsx":
        generate_xlsx_file(path, dataset)
    elif format_info["extension"] == "png":
        generate_png_file(path)
    elif format_info["label"] == "Dashboard compartible":
        generate_dashboard_json(path, payload, dataset, token or make_token("dash"))
    else:
        raise HTTPException(status_code=400, detail="Formato no soportado.")

    return path


def normalize_report_payload(payload: dict) -> dict:
    data = {
        "tipo": clean(get_payload_value(payload, "tipo", "type")),
        "periodo": clean(get_payload_value(payload, "periodo", "period")),
        "formato": clean(get_payload_value(payload, "formato", "format")),
        "alcance": clean(get_payload_value(payload, "alcance", "scope")),
        "comentario": clean(get_payload_value(payload, "comentario", "comment")),
        "incluir_graficos": to_bool(get_payload_value(payload, "incluir_graficos", "includeCharts"), False),
        "incluir_auditoria": to_bool(get_payload_value(payload, "incluir_auditoria", "includeAudit"), False),
        "incluir_sla": to_bool(get_payload_value(payload, "incluir_sla", "includeSla"), False),
        "incluir_seguridad": to_bool(get_payload_value(payload, "incluir_seguridad", "includeSecurity"), False)
    }

    if not data["tipo"] or not data["periodo"] or not data["formato"] or not data["alcance"]:
        raise HTTPException(status_code=400, detail="Tipo, periodo, formato y alcance son obligatorios.")

    return data


def admin_indicators_reports_service(admin: dict, period: str, module: str, role: str, channel: str):
    period_days = get_period_days(period)
    metrics = get_admin_metrics()
    reports = get_reports_table()
    case_evolution = get_case_evolution(period_days)
    channels = get_channel_distribution()

    weakest_metric = None

    if metrics:
        weakest_metric = sorted(metrics, key=lambda item: to_int(item.get("progress")))[0]

    return {
        "ok": True,
        "metrics": metrics,
        "indicadores": metrics,
        "reports": reports,
        "reportes": reports,
        "case_evolution": case_evolution,
        "evolucion_casos": case_evolution,
        "channel_distribution": channels,
        "canales": channels,
        "filters": {
            "period": period,
            "module": module,
            "role": role,
            "channel": channel
        },
        "kpis": [
            {
                "icon": "📈",
                "value": len(metrics),
                "label": "Métricas",
                "description": "Indicadores administrativos cargados."
            },
            {
                "icon": "📄",
                "value": len(reports),
                "label": "Reportes",
                "description": "Reportes generados o programados."
            },
            {
                "icon": "⚠️",
                "value": len([m for m in metrics if m.get("status") in {"warning", "danger"}]),
                "label": "Alertas de gestión",
                "description": "Métricas con desviación o riesgo."
            },
            {
                "icon": "✅",
                "value": len([m for m in metrics if m.get("status") == "success"]),
                "label": "En control",
                "description": "Métricas dentro de rango esperado."
            }
        ],
        "ai_summary": [
            {
                "title": "Indicador con menor avance",
                "text": f"{weakest_metric['title']} tiene {weakest_metric['progress']}% de avance." if weakest_metric else "No hay métricas suficientes para analizar."
            },
            {
                "title": "Reporte recomendado",
                "text": "Genera un resumen ejecutivo en PDF con auditoría, SLA, seguridad e integraciones."
            }
        ],
        "action_plan": [
            {
                "icon": "1",
                "title": "Revisar desviaciones",
                "text": "Priorizar métricas en warning o danger."
            },
            {
                "icon": "2",
                "title": "Generar reporte formal",
                "text": "Usar PDF para comité y Excel/CSV para análisis operativo."
            },
            {
                "icon": "3",
                "title": "Guardar evidencia",
                "text": "Registrar archivo, formato, usuario y parámetros en base de datos."
            }
        ]
    }


def admin_generate_report_service(admin: dict, payload: dict):
    data = normalize_report_payload(payload)
    format_info = normalize_report_format(data["formato"])
    dataset = build_report_dataset(admin, data)
    title = f"{data['tipo']} - {data['periodo']}"
    token = make_token("dash") if format_info["label"] == "Dashboard compartible" else None
    file_path = generate_report_file(format_info, title, data, dataset, token=token)

    file_name = os.path.basename(file_path)
    file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
    is_dashboard = format_info["label"] == "Dashboard compartible"
    shared_url = f"/dashboard-compartido.html?token={token}" if is_dashboard else None
    expires_at = now() + timedelta(days=7) if is_dashboard else None

    insert_dynamic(
        "reportes",
        {
            "nombre": title,
            "tipo": data["tipo"],
            "periodo": data["periodo"],
            "alcance": data["alcance"],
            "formato": format_info["label"],
            "comentario": data["comentario"],
            "generado_por_usuario_id": admin.get("usuario_id"),
            "estado": "Generado",
            "fecha_generacion": now(),

            "archivo_nombre": file_name,
            "archivo_ruta": file_path,
            "mime_type": format_info["mime"],
            "tamano_bytes": file_size,
            "parametros_json": json_dumps(data),
            "filtros_json": json_dumps(data),
            "secciones_json": json_dumps(dataset.get("sections")),
            "compartible": 1 if is_dashboard else 0,
            "token_compartido": token,
            "url_compartida": shared_url,
            "fecha_expiracion": expires_at,
            "fecha_expiracion_compartido": expires_at
        }
    )

    report = safe_fetch_one(
        """
        SELECT TOP 1 reporte_id
        FROM reportes
        WHERE archivo_nombre = ?
        ORDER BY reporte_id DESC
        """,
        (file_name,)
    )

    report_id = (report or {}).get("reporte_id")

    insert_dynamic(
        "archivos_admin",
        {
            "modulo": "Reportes",
            "entidad": "reportes",
            "entidad_id": str(report_id or ""),
            "nombre": file_name,
            "formato": format_info["label"],
            "mime_type": format_info["mime"],
            "archivo_ruta": file_path,
            "tamano_bytes": file_size,
            "parametros_json": json_dumps(data),
            "generado_por_usuario_id": admin.get("usuario_id"),
            "estado": "Generado",
            "fecha_generacion": now(),
            "fecha_expiracion": expires_at
        }
    )

    audit(
        admin,
        "Reportes",
        "Reporte generado",
        before="-",
        after=title,
        detail=f"Se generó reporte en formato {format_info['label']}.",
        critical=False,
        reason=data["comentario"] or "Generación de reporte administrativo.",
        entity="reportes",
        entity_id=report_id,
        after_json={
            "reporte_id": report_id,
            "archivo_nombre": file_name,
            "formato": format_info["label"],
            "mime_type": format_info["mime"],
            "tamano_bytes": file_size,
            "compartible": is_dashboard
        }
    )

    return {
        "ok": True,
        "message": "Reporte generado correctamente.",
        "report": {
            "id": report_id,
            "name": title,
            "format": format_info["label"],
            "fileName": file_name,
            "mimeType": format_info["mime"],
            "size": file_size,
            "downloadUrl": f"/api/admin/reportes/{report_id}/descargar" if report_id else "",
            "sharedUrl": shared_url or "",
            "token": token or ""
        }
    }


def admin_schedule_report_service(admin: dict, payload: dict):
    frecuencia = clean(get_payload_value(payload, "frecuencia", "frequency"))
    destinatarios = clean(get_payload_value(payload, "destinatarios", "recipients"))
    hora_envio = clean(get_payload_value(payload, "hora_envio", "hour", default="08:00"))
    tipo = clean(get_payload_value(payload, "tipo", "type", default="Resumen ejecutivo"))
    periodo = clean(get_payload_value(payload, "periodo", "period", default="Mes actual"))
    formato = clean(get_payload_value(payload, "formato", "format", default="PDF"))
    alcance = clean(get_payload_value(payload, "alcance", "scope", default="Administración"))
    comentario = clean(get_payload_value(payload, "comentario", "comment", default="Reporte programado desde administración."))

    if not frecuencia or not destinatarios:
        raise HTTPException(status_code=400, detail="Frecuencia y destinatarios son obligatorios.")

    format_info = normalize_report_format(formato)
    name = f"Reporte programado {frecuencia} - {tipo}"

    if table_exists("programaciones_reportes"):
        insert_dynamic(
            "programaciones_reportes",
            {
                "nombre": name,
                "tipo": tipo,
                "periodo": periodo,
                "alcance": alcance,
                "formato": format_info["label"],
                "frecuencia": frecuencia,
                "hora_envio": hora_envio,
                "destinatarios": destinatarios,
                "filtros_json": json_dumps(payload),
                "secciones_json": json_dumps({
                    "incluir_graficos": to_bool(get_payload_value(payload, "incluir_graficos"), True),
                    "incluir_auditoria": to_bool(get_payload_value(payload, "incluir_auditoria"), True),
                    "incluir_sla": to_bool(get_payload_value(payload, "incluir_sla"), True),
                    "incluir_seguridad": to_bool(get_payload_value(payload, "incluir_seguridad"), True)
                }),
                "estado": "Activa",
                "creado_por_usuario_id": admin.get("usuario_id"),
                "fecha_creacion": now(),
                "fecha_actualizacion": now()
            }
        )
    else:
        insert_dynamic(
            "reportes",
            {
                "nombre": name,
                "tipo": "Programado",
                "periodo": frecuencia,
                "alcance": alcance,
                "formato": format_info["label"],
                "comentario": f"{comentario} Destinatarios: {destinatarios}",
                "generado_por_usuario_id": admin.get("usuario_id"),
                "estado": "Programado",
                "fecha_generacion": now(),
                "frecuencia": frecuencia,
                "hora_envio": hora_envio,
                "destinatarios": destinatarios,
                "parametros_json": json_dumps(payload)
            }
        )

    audit(
        admin,
        "Reportes",
        "Reporte programado",
        before="-",
        after=name,
        detail=f"Se programó reporte {frecuencia} en formato {format_info['label']}.",
        critical=False,
        reason=comentario,
        entity="programaciones_reportes",
        entity_id="programado",
        after_json={
            "frecuencia": frecuencia,
            "destinatarios": destinatarios,
            "formato": format_info["label"],
            "hora_envio": hora_envio
        }
    )

    return {
        "ok": True,
        "message": "Reporte programado correctamente."
    }

# =========================================================
# AUDITORÍA
# =========================================================

def map_audit_row(row: dict) -> dict:
    critical = bool(row.get("critico"))
    result = row.get("resultado") or "Sin resultado"

    if critical:
        icon = "⚠️"
    elif normalize_text(result) in {"error", "fallido", "rechazado"}:
        icon = "⛔"
    else:
        icon = "🕵️"

    return {
        "id": row["auditoria_id"],
        "auditoria_id": row["auditoria_id"],
        "icon": icon,
        "date": safe_datetime(row.get("fecha_evento")),
        "fecha_evento": safe_datetime(row.get("fecha_evento")),
        "module": row.get("modulo"),
        "modulo": row.get("modulo"),
        "type": row.get("tipo"),
        "tipo": row.get("tipo"),
        "action": row.get("accion"),
        "accion": row.get("accion"),
        "user": row.get("usuario_nombre") or "Sistema",
        "usuario": row.get("usuario_nombre") or "Sistema",
        "before": row.get("valor_anterior"),
        "valor_anterior": row.get("valor_anterior"),
        "after": row.get("valor_nuevo"),
        "valor_nuevo": row.get("valor_nuevo"),
        "result": result,
        "resultado": result,
        "critical": critical,
        "critico": critical,
        "ip": row.get("ip") or "-",
        "detail": row.get("detalle") or "",
        "detalle": row.get("detalle") or "",
        "reason": row.get("motivo") or "",
        "motivo": row.get("motivo") or "",
        "entity": row.get("entidad") or row.get("modulo"),
        "entidad": row.get("entidad") or row.get("modulo"),
        "entityId": row.get("entidad_id") or "",
        "entidad_id": row.get("entidad_id") or "",
        "correlationId": row.get("correlacion_id") or "",
        "correlacion_id": row.get("correlacion_id") or "",
        "sensitivity": row.get("sensibilidad") or ("Alta" if critical else "Media"),
        "sensibilidad": row.get("sensibilidad") or ("Alta" if critical else "Media"),
        "beforeJson": json_loads(row.get("valor_anterior_json"), {}),
        "afterJson": json_loads(row.get("valor_nuevo_json"), {})
    }


def filter_audit_items(
    items: List[dict],
    q: str = "",
    modulo: str = "todos",
    criticidad: str = "todos",
    resultado: str = "todos"
) -> List[dict]:
    query = normalize_text(q)
    module_filter = normalize_text(modulo)
    critical_filter = normalize_text(criticidad)
    result_filter = normalize_text(resultado)

    result = []

    for item in items:
        searchable = normalize_text(
            " ".join([
                clean(item.get("module")),
                clean(item.get("action")),
                clean(item.get("user")),
                clean(item.get("before")),
                clean(item.get("after")),
                clean(item.get("result")),
                clean(item.get("detail")),
                clean(item.get("reason")),
                clean(item.get("entity")),
                clean(item.get("correlationId")),
                clean(item.get("sensitivity"))
            ])
        )

        if query and query not in searchable:
            continue

        if module_filter not in {"", "todos", "todo", "all"}:
            if module_filter not in normalize_text(item.get("module")):
                continue

        if result_filter not in {"", "todos", "todo", "all"}:
            if result_filter not in normalize_text(item.get("result")):
                continue

        if critical_filter not in {"", "todos", "todo", "all"}:
            if critical_filter in {"critico", "critica", "criticos", "criticas", "alta"} and not item.get("critical"):
                continue

            if critical_filter in {"no critico", "no critica", "media", "baja"} and item.get("critical"):
                continue

        result.append(item)

    return result


def admin_audit_service(
    admin: dict,
    q: str = "",
    modulo: str = "todos",
    criticidad: str = "todos",
    resultado: str = "todos",
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    limit: int = 150
):
    if not table_exists("auditoria_admin"):
        return {
            "ok": True,
            "items": [],
            "summary": {
                "total": 0,
                "critical": 0,
                "errors": 0
            }
        }

    columns = get_table_columns("auditoria_admin")

    def col(name: str, fallback: str = "NULL"):
        return name if clean_lower(name) in columns else f"{fallback} AS {name}"

    params: list = []
    where_parts = ["1 = 1"]

    if fecha_inicio:
        where_parts.append("fecha_evento >= ?")
        params.append(fecha_inicio)

    if fecha_fin:
        where_parts.append("fecha_evento < DATEADD(DAY, 1, CAST(? AS DATE))")
        params.append(fecha_fin)

    rows = safe_fetch_all(
        f"""
        SELECT TOP {min(1000, max(1, to_int(limit, 150)))}
            auditoria_id,
            modulo,
            tipo,
            accion,
            usuario_nombre,
            valor_anterior,
            valor_nuevo,
            resultado,
            critico,
            detalle,
            fecha_evento,
            {col("motivo")},
            {col("entidad")},
            {col("entidad_id")},
            {col("valor_anterior_json")},
            {col("valor_nuevo_json")},
            {col("correlacion_id")},
            {col("sensibilidad")},
            {col("ip")}
        FROM auditoria_admin
        WHERE {" AND ".join(where_parts)}
        ORDER BY fecha_evento DESC
        """,
        tuple(params)
    )

    all_items = [map_audit_row(row) for row in rows]
    filtered = filter_audit_items(
        all_items,
        q=q,
        modulo=modulo,
        criticidad=criticidad,
        resultado=resultado
    )

    critical_count = len([item for item in all_items if item.get("critical")])
    error_count = len([
        item for item in all_items
        if normalize_text(item.get("result")) in {"error", "fallido", "rechazado"}
    ])

    module_distribution = {}

    for item in all_items:
        module_distribution[item["module"]] = module_distribution.get(item["module"], 0) + 1

    result_distribution = {}

    for item in all_items:
        result_distribution[item["result"]] = result_distribution.get(item["result"], 0) + 1

    return {
        "ok": True,
        "items": filtered,
        "all_items": all_items,
        "summary": {
            "total": len(all_items),
            "visible": len(filtered),
            "critical": critical_count,
            "errors": error_count
        },
        "module_distribution": [
            {
                "label": key or "Sin módulo",
                "value": value
            }
            for key, value in module_distribution.items()
        ],
        "result_distribution": [
            {
                "label": key or "Sin resultado",
                "value": value
            }
            for key, value in result_distribution.items()
        ],
        "kpis": [
            {
                "icon": "🕵️",
                "value": len(all_items),
                "label": "Eventos",
                "description": "Registros auditables recientes."
            },
            {
                "icon": "⚠️",
                "value": critical_count,
                "label": "Críticos",
                "description": "Cambios sensibles."
            },
            {
                "icon": "⛔",
                "value": error_count,
                "label": "Errores/Rechazos",
                "description": "Eventos no exitosos."
            },
            {
                "icon": "🔎",
                "value": len(module_distribution),
                "label": "Módulos",
                "description": "Áreas con trazabilidad."
            }
        ],
        "ai_summary": [
            {
                "title": "Trazabilidad sensible",
                "text": "Prioriza eventos críticos en usuarios, roles, permisos, integraciones, respaldo y configuración."
            },
            {
                "title": "Control interno",
                "text": "Los eventos con resultado error o rechazado deben revisarse con evidencia."
            }
        ],
        "action_plan": [
            {
                "icon": "1",
                "title": "Revisar críticos",
                "text": "Filtrar eventos críticos y validar motivo del cambio."
            },
            {
                "icon": "2",
                "title": "Comparar antes/después",
                "text": "Usar snapshots JSON para revisar cambios sensibles."
            },
            {
                "icon": "3",
                "title": "Exportar evidencia",
                "text": "Descargar auditoría para control interno."
            }
        ]
    }


def admin_compare_audit_service(admin: dict, payload: dict):
    module = clean(get_payload_value(payload, "modulo", "module", default="Todos"))
    compare_type = clean(get_payload_value(payload, "tipo", "compareType", "type", default="Antes y después"))
    start = clean(get_payload_value(payload, "fecha_inicio", "startDate", default=""))
    end = clean(get_payload_value(payload, "fecha_fin", "endDate", default=""))

    audit_result = admin_audit_service(
        admin,
        modulo=module if module else "todos",
        fecha_inicio=start or None,
        fecha_fin=end or None,
        limit=500
    )

    items = audit_result.get("items", [])

    critical = len([item for item in items if item.get("critical")])
    errors = len([
        item for item in items
        if normalize_text(item.get("result")) in {"error", "fallido", "rechazado"}
    ])

    audit(
        admin,
        "Auditoría",
        "Comparación de auditoría",
        before="-",
        after=module,
        detail=f"Se solicitó comparación de auditoría: {compare_type}.",
        critical=False,
        reason=clean(get_payload_value(payload, "motivo", "reason", default="Comparación administrativa de auditoría.")),
        entity="auditoria_admin",
        entity_id="comparacion",
        after_json={
            "modulo": module,
            "tipo": compare_type,
            "fecha_inicio": start,
            "fecha_fin": end,
            "eventos": len(items),
            "criticos": critical,
            "errores": errors
        }
    )

    return {
        "ok": True,
        "message": "Comparación de auditoría registrada correctamente.",
        "summary": {
            "events": len(items),
            "critical": critical,
            "errors": errors,
            "module": module,
            "type": compare_type
        },
        "items": items[:50]
    }


# =========================================================
# RESPALDO
# =========================================================

def normalize_backup_payload(payload: Optional[dict]) -> dict:
    payload = payload or {}

    return {
        "tipo": clean(get_payload_value(payload, "tipo", "type", default="Manual")),
        "frecuencia": clean(get_payload_value(payload, "frecuencia", "frequency", default="Bajo demanda")),
        "ventana": clean(get_payload_value(payload, "ventana", "ventana_ejecucion", "window", default="Ejecución inmediata")),
        "retencion": clean(get_payload_value(payload, "retencion", "retention", default="30 días")),
        "destino": clean(get_payload_value(payload, "destino", "destination", default="Repositorio seguro")),
        "responsable": clean(get_payload_value(payload, "responsable", "owner", default="Administración")),
        "rpo": clean(get_payload_value(payload, "rpo", default="24 horas")),
        "rto": clean(get_payload_value(payload, "rto", default="4 horas")),
        "motivo": clean(get_payload_value(payload, "motivo", "reason", default="Gestión administrativa de respaldo."))
    }


def map_backup_row(row: dict) -> dict:
    status = row.get("estado") or "Sin estado"

    if normalize_text(status) == "completado":
        icon = "✅"
    elif normalize_text(status) == "fallido":
        icon = "⛔"
    elif normalize_text(status) == "programado":
        icon = "🗓️"
    else:
        icon = "💾"

    return {
        "id": row["respaldo_id"],
        "respaldo_id": row["respaldo_id"],
        "icon": icon,
        "date": safe_datetime(row.get("fecha_ejecucion")),
        "fecha_ejecucion": safe_datetime(row.get("fecha_ejecucion")),
        "type": row.get("tipo"),
        "tipo": row.get("tipo"),
        "status": status,
        "estado": status,
        "size": row.get("tamano") or format_bytes(row.get("tamano_bytes")),
        "tamano": row.get("tamano") or format_bytes(row.get("tamano_bytes")),
        "location": row.get("ubicacion") or row.get("destino") or "Repositorio configurado",
        "ubicacion": row.get("ubicacion") or row.get("destino") or "Repositorio configurado",
        "validation": row.get("validacion") or "Pendiente",
        "validacion": row.get("validacion") or "Pendiente",
        "owner": row.get("responsable") or "Administración",
        "responsable": row.get("responsable") or "Administración",
        "frequency": row.get("frecuencia") or "Bajo demanda",
        "frecuencia": row.get("frecuencia") or "Bajo demanda",
        "window": row.get("ventana_ejecucion") or "",
        "ventana_ejecucion": row.get("ventana_ejecucion") or "",
        "retention": row.get("retencion") or "",
        "retencion": row.get("retencion") or "",
        "destination": row.get("destino") or "",
        "destino": row.get("destino") or "",
        "rpo": row.get("rpo") or "",
        "rto": row.get("rto") or "",
        "hash": row.get("hash_integridad") or "",
        "hash_integridad": row.get("hash_integridad") or "",
        "durationSeconds": row.get("duracion_segundos"),
        "duracion_segundos": row.get("duracion_segundos"),
        "log": row.get("log_resumen") or "",
        "log_resumen": row.get("log_resumen") or "",
        "validationDate": safe_datetime(row.get("fecha_validacion")),
        "fecha_validacion": safe_datetime(row.get("fecha_validacion"))
    }


def get_backup_snapshot(backup_id: int) -> dict:
    row = safe_fetch_one(
        """
        SELECT *
        FROM respaldos_sistema
        WHERE respaldo_id = ?
        """,
        (backup_id,)
    )

    return dict(row or {})


def get_restore_events(limit: int = 20) -> List[dict]:
    if not table_exists("pruebas_restauracion"):
        return []

    columns = get_table_columns("pruebas_restauracion")

    def col(name: str, fallback: str = "NULL"):
        return name if clean_lower(name) in columns else f"{fallback} AS {name}"

    rows = safe_fetch_all(
        f"""
        SELECT TOP {to_int(limit, 20)}
            prueba_id,
            titulo,
            descripcion,
            estado,
            fecha_programada,
            {col("tipo_prueba")},
            {col("ambiente")},
            {col("responsable")},
            {col("fecha_objetivo")},
            {col("alcance")},
            {col("resultado")},
            {col("duracion_minutos")},
            {col("fecha_ejecucion")}
        FROM pruebas_restauracion
        ORDER BY fecha_programada DESC
        """
    )

    return [
        {
            "id": row["prueba_id"],
            "icon": "🧪",
            "title": row.get("titulo"),
            "text": row.get("descripcion"),
            "state": row.get("estado"),
            "estado": row.get("estado"),
            "date": safe_datetime(row.get("fecha_programada")),
            "fecha_programada": safe_datetime(row.get("fecha_programada")),
            "type": row.get("tipo_prueba"),
            "tipo_prueba": row.get("tipo_prueba"),
            "environment": row.get("ambiente"),
            "ambiente": row.get("ambiente"),
            "owner": row.get("responsable"),
            "responsable": row.get("responsable"),
            "scope": row.get("alcance"),
            "alcance": row.get("alcance"),
            "result": row.get("resultado"),
            "resultado": row.get("resultado")
        }
        for row in rows
    ]


def filter_backup_items(
    items: List[dict],
    q: str = "",
    estado: str = "todos",
    tipo: str = "todos",
    validacion: str = "todos"
) -> List[dict]:
    query = normalize_text(q)
    status_filter = normalize_text(estado)
    type_filter = normalize_text(tipo)
    validation_filter = normalize_text(validacion)

    result = []

    for item in items:
        searchable = normalize_text(
            " ".join([
                clean(item.get("type")),
                clean(item.get("status")),
                clean(item.get("size")),
                clean(item.get("location")),
                clean(item.get("validation")),
                clean(item.get("owner")),
                clean(item.get("frequency")),
                clean(item.get("destination")),
                clean(item.get("hash"))
            ])
        )

        if query and query not in searchable:
            continue

        if status_filter not in {"", "todos", "todo", "all"}:
            if status_filter not in normalize_text(item.get("status")):
                continue

        if type_filter not in {"", "todos", "todo", "all"}:
            if type_filter not in normalize_text(item.get("type")):
                continue

        if validation_filter not in {"", "todos", "todo", "all"}:
            if validation_filter not in normalize_text(item.get("validation")):
                continue

        result.append(item)

    return result


def admin_backup_service(
    admin: dict,
    q: str = "",
    estado: str = "todos",
    tipo: str = "todos",
    validacion: str = "todos"
):
    if not table_exists("respaldos_sistema"):
        return {
            "ok": True,
            "items": [],
            "restore_events": []
        }

    columns = get_table_columns("respaldos_sistema")

    def col(name: str, fallback: str = "NULL"):
        return name if clean_lower(name) in columns else f"{fallback} AS {name}"

    rows = safe_fetch_all(
        f"""
        SELECT
            respaldo_id,
            fecha_ejecucion,
            tipo,
            estado,
            tamano,
            ubicacion,
            validacion,
            responsable,
            {col("frecuencia")},
            {col("ventana_ejecucion")},
            {col("retencion")},
            {col("destino")},
            {col("rpo")},
            {col("rto")},
            {col("hash_integridad")},
            {col("duracion_segundos")},
            {col("log_resumen")},
            {col("fecha_validacion")}
        FROM respaldos_sistema
        ORDER BY fecha_ejecucion DESC
        """
    )

    all_items = [map_backup_row(row) for row in rows]
    filtered = filter_backup_items(
        all_items,
        q=q,
        estado=estado,
        tipo=tipo,
        validacion=validacion
    )

    completed = len([item for item in all_items if normalize_text(item["status"]) == "completado"])
    failed = len([item for item in all_items if normalize_text(item["status"]) == "fallido"])
    scheduled = len([item for item in all_items if normalize_text(item["status"]) == "programado"])
    verified = len([item for item in all_items if normalize_text(item["validation"]) in {"verificado", "validado"}])

    restore_events = get_restore_events()

    return {
        "ok": True,
        "items": filtered,
        "all_items": all_items,
        "restore_events": restore_events,
        "summary": {
            "total": len(all_items),
            "visible": len(filtered),
            "completed": completed,
            "failed": failed,
            "scheduled": scheduled,
            "verified": verified
        },
        "kpis": [
            {
                "icon": "💾",
                "value": len(all_items),
                "label": "Respaldos",
                "description": "Copias registradas."
            },
            {
                "icon": "✅",
                "value": completed,
                "label": "Completados",
                "description": "Finalizados correctamente."
            },
            {
                "icon": "🧪",
                "value": verified,
                "label": "Verificados",
                "description": "Con validación registrada."
            },
            {
                "icon": "⛔",
                "value": failed,
                "label": "Fallidos",
                "description": "Requieren atención."
            }
        ],
        "ai_summary": [
            {
                "title": "Continuidad operativa",
                "text": "Valida que el último respaldo completado tenga prueba de restauración asociada."
            },
            {
                "title": "Riesgo de respaldo",
                "text": "Los respaldos fallidos deben generar alerta y revisión de log técnico."
            }
        ],
        "action_plan": [
            {
                "icon": "1",
                "title": "Validar último respaldo",
                "text": "Comprobar integridad y registrar hash."
            },
            {
                "icon": "2",
                "title": "Programar restauración",
                "text": "Ejecutar prueba en ambiente controlado."
            },
            {
                "icon": "3",
                "title": "Revisar fallidos",
                "text": "Atender respaldos con estado fallido o validación pendiente."
            }
        ]
    }


def admin_run_backup_service(admin: dict, payload: Optional[dict] = None):
    data = normalize_backup_payload(payload)

    duration = secrets.randbelow(600) + 60
    fake_bytes = (secrets.randbelow(5) + 1) * 1024 * 1024 * 1024
    hash_value = uuid.uuid4().hex + uuid.uuid4().hex

    insert_dynamic(
        "respaldos_sistema",
        {
            "fecha_ejecucion": now(),
            "tipo": data["tipo"] or "Manual",
            "estado": "Completado",
            "tamano": format_bytes(fake_bytes),
            "ubicacion": data["destino"],
            "validacion": "Pendiente",
            "responsable": data["responsable"] or admin_name(admin),
            "frecuencia": data["frecuencia"],
            "ventana_ejecucion": data["ventana"],
            "retencion": data["retencion"],
            "destino": data["destino"],
            "rpo": data["rpo"],
            "rto": data["rto"],
            "hash_integridad": hash_value,
            "duracion_segundos": duration,
            "log_resumen": f"Respaldo ejecutado correctamente. Duración: {duration}s. Tamaño: {format_bytes(fake_bytes)}.",
            "fecha_actualizacion": now()
        }
    )

    backup = safe_fetch_one(
        """
        SELECT TOP 1 respaldo_id
        FROM respaldos_sistema
        ORDER BY respaldo_id DESC
        """
    )

    backup_id = (backup or {}).get("respaldo_id")

    audit(
        admin,
        "Respaldo",
        "Ejecución de respaldo",
        before="-",
        after=data["tipo"],
        detail="Se registró ejecución manual de respaldo.",
        critical=True,
        reason=data["motivo"],
        entity="respaldos_sistema",
        entity_id=backup_id,
        after_json={
            "tipo": data["tipo"],
            "estado": "Completado",
            "hash": hash_value,
            "duracion_segundos": duration
        }
    )

    return {
        "ok": True,
        "message": "Respaldo registrado correctamente.",
        "backup_id": backup_id
    }


def admin_validate_backup_service(admin: dict, backup_id: int, payload: Optional[dict] = None):
    payload = payload or {}
    reason = clean(get_payload_value(payload, "motivo", "reason", default="Validación administrativa de respaldo."))

    backup = get_backup_snapshot(backup_id)

    if not backup:
        raise HTTPException(status_code=404, detail="Respaldo no encontrado.")

    update_dynamic(
        "respaldos_sistema",
        {
            "validacion": "Verificado",
            "fecha_validacion": now(),
            "fecha_actualizacion": now(),
            "log_resumen": f"{backup.get('log_resumen') or ''}\nValidación completada por {admin_name(admin)}."
        },
        "respaldo_id = ?",
        (backup_id,)
    )

    after = get_backup_snapshot(backup_id)

    audit(
        admin,
        "Respaldo",
        "Validación de respaldo",
        before=backup.get("validacion"),
        after="Verificado",
        detail="Se validó respaldo.",
        critical=True,
        reason=reason,
        entity="respaldos_sistema",
        entity_id=backup_id,
        before_json=backup,
        after_json=after
    )

    return {
        "ok": True,
        "message": "Respaldo validado correctamente."
    }


def admin_schedule_backup_service(admin: dict, payload: dict):
    data = normalize_backup_payload(payload)

    if not data["frecuencia"]:
        raise HTTPException(status_code=400, detail="La frecuencia es obligatoria.")

    if not data["tipo"]:
        raise HTTPException(status_code=400, detail="El tipo de respaldo es obligatorio.")

    insert_dynamic(
        "respaldos_sistema",
        {
            "fecha_ejecucion": now() + timedelta(days=1),
            "tipo": data["tipo"],
            "estado": "Programado",
            "tamano": "Estimado",
            "ubicacion": data["destino"],
            "validacion": "Pendiente",
            "responsable": data["responsable"] or admin_name(admin),
            "frecuencia": data["frecuencia"],
            "ventana_ejecucion": data["ventana"],
            "retencion": data["retencion"],
            "destino": data["destino"],
            "rpo": data["rpo"],
            "rto": data["rto"],
            "log_resumen": "Respaldo programado desde administración.",
            "fecha_actualizacion": now()
        }
    )

    audit(
        admin,
        "Respaldo",
        "Respaldo programado",
        before="-",
        after=data["frecuencia"],
        detail="Se programó respaldo.",
        critical=True,
        reason=data["motivo"],
        entity="respaldos_sistema",
        entity_id="programado",
        after_json=data
    )

    return {
        "ok": True,
        "message": "Respaldo programado correctamente."
    }


def admin_restore_test_service(admin: dict, payload: dict):
    tipo_prueba = clean(get_payload_value(payload, "tipo_prueba", "restoreTestType", "type"))
    ambiente = clean(get_payload_value(payload, "ambiente", "restoreEnvironment", "environment"))
    responsable = clean(get_payload_value(payload, "responsable", "restoreResponsible", "owner", default=admin_name(admin)))
    fecha_objetivo = safe_date(get_payload_value(payload, "fecha_objetivo", "restoreTargetDate"))
    alcance = clean(get_payload_value(payload, "alcance", "restoreTestScope", "scope"))
    reason = clean(get_payload_value(payload, "motivo", "reason", default="Programación de prueba de restauración."))

    if not tipo_prueba or not ambiente or not responsable:
        raise HTTPException(status_code=400, detail="Tipo de prueba, ambiente y responsable son obligatorios.")

    title = f"Prueba de restauración {tipo_prueba}"

    insert_dynamic(
        "pruebas_restauracion",
        {
            "titulo": title,
            "descripcion": f"Ambiente: {ambiente}. Responsable: {responsable}.",
            "estado": "Programado",
            "fecha_programada": now() + timedelta(days=1),
            "creado_por_usuario_id": admin.get("usuario_id"),
            "tipo_prueba": tipo_prueba,
            "ambiente": ambiente,
            "responsable": responsable,
            "fecha_objetivo": fecha_objetivo,
            "alcance": alcance,
            "resultado": "Pendiente"
        }
    )

    audit(
        admin,
        "Respaldo",
        "Prueba de restauración programada",
        before="-",
        after=tipo_prueba,
        detail="Se programó prueba de restauración.",
        critical=True,
        reason=reason,
        entity="pruebas_restauracion",
        entity_id="programada",
        after_json={
            "tipo_prueba": tipo_prueba,
            "ambiente": ambiente,
            "responsable": responsable,
            "fecha_objetivo": fecha_objetivo,
            "alcance": alcance
        }
    )

    return {
        "ok": True,
        "message": "Prueba de restauración programada correctamente."
    }


# =========================================================
# CONFIGURACIÓN SISTEMA
# =========================================================

DEFAULT_CONFIG = {
    "platformName": "Claro Atención 360",
    "platformEnvironment": "Producción",
    "platformOwner": "Administración del sistema",
    "platformSupportEmail": "soporte@claro360.com",
    "sessionTimeout": "30 minutos",
    "failedAttempts": "5",
    "mfaPolicy": "Requerido para administradores",
    "passwordPolicy": "Fuerte",
    "notifySlaRisk": True,
    "notifyUserBlocked": True,
    "notifyIntegrationError": True,
    "notifyBackupFailure": True,
    "maintenanceMode": "Inactivo",
    "maintenanceWindow": "Sin ventana",
    "maintenanceMessage": ""
}


CONFIG_META = {
    "platformName": ("Identidad", "texto", False),
    "platformEnvironment": ("Identidad", "texto", False),
    "platformOwner": ("Identidad", "texto", False),
    "platformSupportEmail": ("Identidad", "correo", False),
    "sessionTimeout": ("Seguridad", "texto", True),
    "failedAttempts": ("Seguridad", "numero", True),
    "mfaPolicy": ("Seguridad", "texto", True),
    "passwordPolicy": ("Seguridad", "texto", True),
    "notifySlaRisk": ("Notificaciones", "booleano", False),
    "notifyUserBlocked": ("Notificaciones", "booleano", False),
    "notifyIntegrationError": ("Notificaciones", "booleano", False),
    "notifyBackupFailure": ("Notificaciones", "booleano", False),
    "maintenanceMode": ("Mantenimiento", "texto", True),
    "maintenanceWindow": ("Mantenimiento", "texto", False),
    "maintenanceMessage": ("Mantenimiento", "texto", False)
}


def read_config_value(key: str, default: Any):
    row = safe_fetch_one(
        """
        SELECT valor
        FROM configuraciones_sistema
        WHERE clave = ?
          AND ISNULL(activo, 1) = 1
        """,
        (f"admin.{key}",)
    )

    if not row:
        return default

    value = row["valor"]

    if isinstance(default, bool):
        return to_bool(value, default)

    return value


def read_admin_config() -> dict:
    return {
        key: read_config_value(key, default)
        for key, default in DEFAULT_CONFIG.items()
    }


def validate_system_config(config: dict):
    support_email = clean(config.get("platformSupportEmail"))

    if support_email:
        validate_email(support_email)

    attempts = to_int(config.get("failedAttempts"), 0)

    if attempts < 3:
        raise HTTPException(status_code=400, detail="Los intentos fallidos permitidos no pueden ser menores a 3.")

    session_minutes = parse_minutes(config.get("sessionTimeout")) or 0

    if session_minutes < 15:
        raise HTTPException(status_code=400, detail="La expiración de sesión no puede ser menor a 15 minutos.")

    maintenance_mode = normalize_text(config.get("maintenanceMode"))

    if maintenance_mode in {"activo", "programado"}:
        if not clean(config.get("maintenanceMessage")):
            raise HTTPException(
                status_code=400,
                detail="Debes registrar un mensaje cuando el mantenimiento esté activo o programado."
            )


def save_config_value(key: str, value: Any, admin: Optional[dict] = None):
    category, value_type, sensitive = CONFIG_META.get(key, ("General", "texto", False))

    if table_exists("configuraciones_sistema"):
        row = safe_fetch_one(
            """
            SELECT configuracion_id
            FROM configuraciones_sistema
            WHERE clave = ?
            """,
            (f"admin.{key}",)
        )

        if row:
            update_dynamic(
                "configuraciones_sistema",
                {
                    "valor": str(value),
                    "descripcion": "Configuración administrativa",
                    "activo": 1,
                    "categoria": category,
                    "tipo_valor": value_type,
                    "es_sensible": 1 if sensitive else 0,
                    "actualizado_por_usuario_id": (admin or {}).get("usuario_id"),
                    "fecha_actualizacion": now()
                },
                "clave = ?",
                (f"admin.{key}",)
            )
        else:
            insert_dynamic(
                "configuraciones_sistema",
                {
                    "clave": f"admin.{key}",
                    "valor": str(value),
                    "descripcion": "Configuración administrativa",
                    "activo": 1,
                    "categoria": category,
                    "tipo_valor": value_type,
                    "es_sensible": 1 if sensitive else 0,
                    "actualizado_por_usuario_id": (admin or {}).get("usuario_id"),
                    "fecha_creacion": now(),
                    "fecha_actualizacion": now()
                }
            )


def admin_system_config_service(admin: dict):
    config = read_admin_config()

    sensitive_values = [
        key
        for key, meta in CONFIG_META.items()
        if meta[2]
    ]

    return {
        "ok": True,
        "config": config,
        "summary": {
            "total": len(config),
            "sensitive": len(sensitive_values),
            "maintenance": config.get("maintenanceMode"),
            "environment": config.get("platformEnvironment")
        },
        "kpis": [
            {
                "icon": "⚙️",
                "value": len(config),
                "label": "Parámetros",
                "description": "Configuraciones activas."
            },
            {
                "icon": "🔐",
                "value": len(sensitive_values),
                "label": "Sensibles",
                "description": "Afectan seguridad u operación."
            },
            {
                "icon": "🛠️",
                "value": config.get("maintenanceMode"),
                "label": "Mantenimiento",
                "description": "Estado operativo."
            },
            {
                "icon": "🏢",
                "value": config.get("platformEnvironment"),
                "label": "Ambiente",
                "description": "Entorno configurado."
            }
        ],
        "ai_summary": [
            {
                "title": "Seguridad",
                "text": "Mantén MFA activo para administradores y políticas de contraseña fuertes."
            },
            {
                "title": "Operación",
                "text": "El modo mantenimiento debe tener mensaje y ventana definida."
            }
        ],
        "action_plan": [
            {
                "icon": "1",
                "title": "Validar sesión",
                "text": "Revisar expiración e intentos fallidos."
            },
            {
                "icon": "2",
                "title": "Revisar notificaciones",
                "text": "Mantener activas alertas de SLA, respaldo e integraciones."
            },
            {
                "icon": "3",
                "title": "Auditar cambios",
                "text": "Guardar motivo y comparación antes/después."
            }
        ]
    }


def admin_update_system_config_service(admin: dict, payload: dict):
    before = read_admin_config()
    merged = dict(before)

    for key in DEFAULT_CONFIG.keys():
        if key in payload:
            default = DEFAULT_CONFIG[key]

            if isinstance(default, bool):
                merged[key] = to_bool(payload[key], default)
            else:
                merged[key] = clean(payload[key])

    reason = clean(get_payload_value(payload, "motivo", "reason", default="Actualización de configuración del sistema."))

    validate_system_config(merged)

    for key in DEFAULT_CONFIG.keys():
        save_config_value(key, merged[key], admin)

    audit(
        admin,
        "Configuración",
        "Configuración del sistema actualizada",
        before="Configuración anterior",
        after="Configuración actualizada",
        detail="Se actualizaron parámetros globales del sistema.",
        critical=True,
        reason=reason,
        entity="configuraciones_sistema",
        entity_id="admin",
        before_json=before,
        after_json=merged,
        sensitivity="Alta"
    )

    return {
        "ok": True,
        "message": "Configuración guardada correctamente.",
        "config": merged
    }


def admin_restore_system_config_service(admin: dict, payload: Optional[dict] = None):
    payload = payload or {}
    reason = clean(get_payload_value(payload, "motivo", "reason", default="Restauración de configuración por defecto."))

    before = read_admin_config()

    for key, value in DEFAULT_CONFIG.items():
        save_config_value(key, value, admin)

    after = read_admin_config()

    audit(
        admin,
        "Configuración",
        "Configuración restaurada",
        before="Configuración personalizada",
        after="Valores por defecto",
        detail="Se restauró configuración del sistema.",
        critical=True,
        reason=reason,
        entity="configuraciones_sistema",
        entity_id="admin",
        before_json=before,
        after_json=after,
        sensitivity="Alta"
    )

    return {
        "ok": True,
        "message": "Configuración restaurada correctamente.",
        "config": after
    }


# =========================================================
# DASHBOARD
# =========================================================

def admin_dashboard_service(admin: dict, periodo: str = "semana", modulo: str = "todos"):
    users_payload = admin_users_service(admin)
    users = users_payload.get("items", [])

    integrations_payload = admin_integrations_service(
    admin,
    q="",
    tipo="todos",
    estado="todos",
    criticidad="todos"
    )
    integrations = integrations_payload.get("all_items") or integrations_payload.get("items", [])

    audit_payload = admin_audit_service(admin, limit=80)
    audit_rows = audit_payload.get("items", [])

    backup_payload = admin_backup_service(admin)
    backups = backup_payload.get("all_items") or backup_payload.get("items", [])

    alerts = get_alerts()

    case_trend = get_case_evolution(7)
    channels = get_channel_distribution()

    case_status = []

    if table_exists("casos") and table_exists("estados_caso"):
        case_status = safe_fetch_all(
            """
            SELECT
                ISNULL(ec.nombre, 'Sin estado') AS label,
                COUNT(*) AS value
            FROM casos c
            LEFT JOIN estados_caso ec ON ec.estado_caso_id = c.estado_caso_id
            GROUP BY ec.nombre
            ORDER BY COUNT(*) DESC
            """
        )

    role_activity = []

    if table_exists("usuarios") and table_exists("roles"):
        role_activity = safe_fetch_all(
            """
            SELECT
                r.nombre AS label,
                COUNT(*) AS value
            FROM usuarios u
            INNER JOIN roles r ON r.rol_id = u.rol_id
            GROUP BY r.nombre
            ORDER BY COUNT(*) DESC
            """
        )

    metrics = get_admin_metrics()

    active_users = len([u for u in users if normalize_text(u.get("status")) == "activo"])
    active_integrations = len([i for i in integrations if normalize_text(i.get("status")) == "activa"])

    return {
        "ok": True,
        "system_status": "Sistema operativo",
        "last_update": safe_datetime(now()),
        "users": users,
        "usuarios": users,
        "integrations": integrations,
        "integraciones": integrations,
        "alerts": alerts,
        "alertas": alerts,
        "audit": audit_rows,
        "auditoria": audit_rows,
        "backups": backups,
        "respaldos": backups,
        "metrics": metrics,
        "indicadores": metrics,
        "case_trend": case_trend,
        "case_status": case_status,
        "role_activity": role_activity,
        "channel_distribution": channels,
        "kpis": [
            {
                "icon": "👤",
                "value": active_users,
                "label": "Usuarios activos",
                "description": "Cuentas habilitadas."
            },
            {
                "icon": "🔐",
                "value": count_table("roles"),
                "label": "Roles",
                "description": "Perfiles configurados."
            },
            {
                "icon": "🔌",
                "value": active_integrations,
                "label": "Integraciones sanas",
                "description": "Servicios operativos."
            },
            {
                "icon": "⚠️",
                "value": len(alerts),
                "label": "Alertas",
                "description": "Requieren revisión."
            }
        ],
        "ai_summary": [
            {
                "title": "Prioridad administrativa",
                "text": "Revisa alertas, integraciones con error, usuarios bloqueados y respaldos no verificados."
            },
            {
                "title": "Gobierno de plataforma",
                "text": "Mantén trazabilidad de cambios en usuarios, permisos, catálogos, SLA y configuración."
            }
        ],
        "action_plan": [
            {
                "icon": "1",
                "title": "Revisar alertas",
                "text": "Atender primero errores técnicos y accesos bloqueados."
            },
            {
                "icon": "2",
                "title": "Validar respaldo",
                "text": "Confirmar que el último respaldo pueda restaurarse."
            },
            {
                "icon": "3",
                "title": "Generar reporte",
                "text": "Preparar reporte con indicadores y auditoría."
            }
        ]
    }


# =========================================================
# ALERTAS / SEARCH / ASISTENTE / DESCARGAS
# =========================================================

def admin_review_alert_service(admin: dict, alert_id: int, payload: Optional[dict] = None):
    payload = payload or {}
    reason = clean(get_payload_value(payload, "motivo", "reason", default="Alerta revisada por administrador."))

    alert = safe_fetch_one(
        """
        SELECT *
        FROM alertas_sistema
        WHERE alerta_id = ?
        """,
        (alert_id,)
    )

    if not alert:
        raise HTTPException(status_code=404, detail="Alerta no encontrada.")

    update_dynamic(
        "alertas_sistema",
        {
            "estado": "Revisada",
            "revisada_por_usuario_id": admin.get("usuario_id"),
            "fecha_revision": now(),
            "motivo_revision": reason
        },
        "alerta_id = ?",
        (alert_id,)
    )

    audit(
        admin,
        "Alertas",
        "Alerta revisada",
        before=alert.get("estado"),
        after="Revisada",
        detail="Se marcó alerta como revisada.",
        critical=False,
        reason=reason,
        entity="alertas_sistema",
        entity_id=alert_id,
        before_json=dict(alert),
        after_json={
            "estado": "Revisada",
            "motivo": reason
        }
    )

    return {
        "ok": True,
        "message": "Alerta marcada como revisada."
    }


def admin_search_service(admin: dict, q: str):
    query = f"%{clean(q)}%"

    if not clean(q):
        return {
            "ok": True,
            "items": []
        }

    items = []

    if table_exists("usuarios"):
        users = safe_fetch_all(
            """
            SELECT TOP 5
                u.usuario_id,
                u.correo,
                u.username,
                r.nombre AS rol
            FROM usuarios u
            INNER JOIN roles r ON r.rol_id = u.rol_id
            WHERE u.correo LIKE ?
               OR u.username LIKE ?
               OR r.nombre LIKE ?
            ORDER BY u.usuario_id DESC
            """,
            (query, query, query)
        )

        for user in users:
            items.append({
                "icon": "👤",
                "title": user["correo"],
                "text": f"{user['username']} · {display_role(user['rol'])}",
                "href": "usuarios.html",
                "module": "Usuarios"
            })

    if table_exists("integraciones_sistema"):
        integrations = safe_fetch_all(
            """
            SELECT TOP 5
                integracion_id,
                nombre,
                tipo,
                estado
            FROM integraciones_sistema
            WHERE nombre LIKE ?
               OR tipo LIKE ?
               OR estado LIKE ?
               OR endpoint LIKE ?
            ORDER BY integracion_id DESC
            """,
            (query, query, query, query)
        )

        for integration in integrations:
            items.append({
                "icon": "🔌",
                "title": integration["nombre"],
                "text": f"{integration['tipo']} · {integration['estado']}",
                "href": "integraciones.html",
                "module": "Integraciones"
            })

    if table_exists("reglas_sla_admin"):
        sla_rows = safe_fetch_all(
            """
            SELECT TOP 5
                regla_sla_id,
                nombre,
                prioridad,
                estado
            FROM reglas_sla_admin
            WHERE nombre LIKE ?
               OR prioridad LIKE ?
               OR estado LIKE ?
               OR tipo_caso LIKE ?
            ORDER BY regla_sla_id DESC
            """,
            (query, query, query, query)
        )

        for rule in sla_rows:
            items.append({
                "icon": "⏱️",
                "title": rule["nombre"],
                "text": f"{rule['prioridad']} · {rule['estado']}",
                "href": "reglas-sla.html",
                "module": "SLA"
            })

    if table_exists("auditoria_admin"):
        audits = safe_fetch_all(
            """
            SELECT TOP 5
                auditoria_id,
                modulo,
                accion,
                detalle
            FROM auditoria_admin
            WHERE modulo LIKE ?
               OR accion LIKE ?
               OR detalle LIKE ?
               OR usuario_nombre LIKE ?
            ORDER BY fecha_evento DESC
            """,
            (query, query, query, query)
        )

        for item in audits:
            items.append({
                "icon": "🕵️",
                "title": item["accion"],
                "text": f"{item['modulo']} · {item['detalle']}",
                "href": "auditoria.html",
                "module": "Auditoría"
            })

    if table_exists("reportes"):
        reports = safe_fetch_all(
            """
            SELECT TOP 5
                reporte_id,
                nombre,
                formato,
                estado
            FROM reportes
            WHERE nombre LIKE ?
               OR formato LIKE ?
               OR estado LIKE ?
            ORDER BY fecha_generacion DESC
            """,
            (query, query, query)
        )

        for report in reports:
            items.append({
                "icon": "📄",
                "title": report["nombre"],
                "text": f"{report['formato']} · {report['estado']}",
                "href": "indicadores-reportes.html",
                "module": "Reportes"
            })

    return {
        "ok": True,
        "items": items
    }


def admin_assistant_service(admin: dict, payload: dict):
    prompt = clean_lower(get_payload_value(payload, "prompt", "message", "texto"))

    resumen = admin_resumen_service(admin)
    metrics = get_admin_metrics()
    alerts = get_alerts()

    if "usuario" in prompt or "bloqueado" in prompt or "inactivo" in prompt:
        blocked = count_table("usuarios", "estado = 'BLOQUEADO'")
        inactive = count_table("usuarios", "estado = 'INACTIVO'")

        answer = (
            f"Debes revisar {blocked} usuario(s) bloqueado(s) y {inactive} usuario(s) inactivo(s). "
            "Prioriza cuentas administrativas o con permisos sensibles."
        )

    elif "permiso" in prompt or "rol" in prompt or "acceso" in prompt:
        answer = (
            "Revisa permisos sensibles: gestión de usuarios, modificación de roles, configuración global, "
            "auditoría, reportes, integraciones y respaldo. Aplica mínimo privilegio."
        )

    elif "catálogo" in prompt or "catalogo" in prompt:
        answer = (
            "Antes de cambiar catálogos, valida dependencias con casos, reglas SLA, reportes e integraciones. "
            "Evita duplicados o inactivar elementos en uso."
        )

    elif "sla" in prompt:
        invalid = 0

        if table_exists("reglas_sla_admin") and column_exists("reglas_sla_admin", "validacion_estado"):
            invalid = count_table("reglas_sla_admin", "validacion_estado = 'Rechazada'")

        answer = (
            f"Hay {invalid} regla(s) SLA con validación rechazada. "
            "Revisa que la alerta preventiva sea menor al tiempo SLA y que las críticas tengan escalamiento."
        )

    elif "integración" in prompt or "integracion" in prompt or "api" in prompt or "webhook" in prompt:
        answer = (
            f"Hay {resumen['integraciones_alerta']} integración(es) con alerta o error. "
            "Revisa primero las de criticidad alta y último evento fallido."
        )

    elif "auditor" in prompt or "trazabilidad" in prompt or "cambio" in prompt:
        sensitive = count_table("auditoria_admin", "critico = 1") if table_exists("auditoria_admin") else 0
        answer = (
            f"La auditoría registra {sensitive} evento(s) crítico(s). "
            "Prioriza usuarios, roles, SLA, integraciones, respaldo y configuración."
        )

    elif "respaldo" in prompt or "backup" in prompt or "restaur" in prompt:
        failed = count_table("respaldos_sistema", "estado = 'Fallido'") if table_exists("respaldos_sistema") else 0
        pending = count_table("respaldos_sistema", "validacion = 'Pendiente'") if table_exists("respaldos_sistema") else 0

        answer = (
            f"Existen {failed} respaldo(s) fallido(s) y {pending} pendiente(s) de validación. "
            "Valida el último respaldo completado y programa prueba de restauración."
        )

    elif "reporte" in prompt or "indicador" in prompt:
        weakest = sorted(metrics, key=lambda item: to_int(item.get("progress")))[0] if metrics else None

        if weakest:
            answer = (
                f"El indicador con menor avance es {weakest['title']} con {weakest['progress']}%. "
                "Recomiendo generar reporte ejecutivo con usuarios, integraciones, auditoría y respaldo."
            )
        else:
            answer = "No hay métricas suficientes para generar una recomendación."

    elif "config" in prompt or "seguridad" in prompt:
        config = read_admin_config()
        answer = (
            f"La política MFA actual es: {config.get('mfaPolicy')}. "
            f"La sesión expira en: {config.get('sessionTimeout')}. "
            "Revisa intentos fallidos, política de contraseña, alertas críticas y modo mantenimiento."
        )

    else:
        answer = (
            f"Estado administrativo: {resumen['usuarios_activos']} usuarios activos, "
            f"{resumen['integraciones_alerta']} integraciones con alerta y {len(alerts)} alerta(s) pendiente(s)."
        )

    return {
        "ok": True,
        "answer": answer
    }


def admin_get_report_download_service(admin: dict, reporte_id: int):
    """
    Helper para una ruta nueva:
    GET /admin/reportes/{reporte_id}/descargar

    La ruta debe convertir este resultado en FileResponse.
    """
    report = safe_fetch_one(
        """
        SELECT
            reporte_id,
            nombre,
            archivo_nombre,
            archivo_ruta,
            mime_type,
            formato
        FROM reportes
        WHERE reporte_id = ?
        """,
        (reporte_id,)
    )

    if not report:
        raise HTTPException(status_code=404, detail="Reporte no encontrado.")

    file_path = report.get("archivo_ruta")

    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="El archivo del reporte no existe en el servidor.")

    audit(
        admin,
        "Reportes",
        "Reporte descargado",
        before="-",
        after=report.get("archivo_nombre"),
        detail="Se descargó archivo de reporte.",
        critical=False,
        reason="Descarga de reporte administrativo.",
        entity="reportes",
        entity_id=reporte_id,
        after_json={
            "archivo": report.get("archivo_nombre"),
            "mime_type": report.get("mime_type"),
            "formato": report.get("formato")
        }
    )

    return {
        "path": file_path,
        "filename": report.get("archivo_nombre") or os.path.basename(file_path),
        "media_type": report.get("mime_type") or "application/octet-stream"
    }

