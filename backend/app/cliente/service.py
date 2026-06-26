from pathlib import Path
from datetime import datetime, timedelta
from uuid import uuid4
from io import BytesIO, StringIO
import csv
import json
import os

from fastapi import HTTPException, UploadFile

from app.database import fetch_one, fetch_all, execute, get_connection


# =========================================================
# CLARO ATENCIÓN 360 - CLIENTE SERVICE
# Archivo completo corregido
# Ruta: backend/app/cliente/service.py
# =========================================================


# =========================================================
# CONFIGURACIÓN GENERAL
# =========================================================

PROJECT_DIR = Path(__file__).resolve().parents[3]

UPLOAD_ROOT = PROJECT_DIR / "storage" / "uploads"
UPLOAD_DIR = UPLOAD_ROOT / "evidencias"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_FILE_SIZE_MB = 10
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".png",
    ".jpg",
    ".jpeg",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".txt",
}

BLOCKED_EXTENSIONS = {
    ".exe",
    ".bat",
    ".cmd",
    ".sh",
    ".js",
    ".php",
    ".py",
    ".msi",
    ".scr",
    ".zip",
    ".rar",
    ".7z",
}


# =========================================================
# HELPERS GENERALES
# =========================================================

def clean(value):
    return str(value or "").strip()


def lower(value):
    return clean(value).lower()


def to_int(value, default=None):
    try:
        text = clean(value)
        if text == "":
            return default
        return int(text)
    except Exception:
        return default


def to_float(value, default=None):
    try:
        text = clean(value)
        text = text.replace("S/", "").replace("s/", "").replace(",", ".").strip()
        if text == "":
            return default
        return float(text)
    except Exception:
        return default


def to_bool(value):
    if isinstance(value, bool):
        return value

    return lower(value) in {"1", "true", "si", "sí", "yes", "on", "activo"}


def json_text(value):
    return json.dumps(value or {}, ensure_ascii=False, default=str)


def parse_datetime_or_none(value):
    text = clean(value)

    if not text:
        return None

    formats = [
        "%Y-%m-%d",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d %H:%M:%S",
        "%d/%m/%Y",
        "%d/%m/%Y %H:%M",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(text, fmt)
        except Exception:
            pass

    return None


# =========================================================
# HELPERS BD
# =========================================================

_TABLE_COLUMNS_CACHE = {}
_TABLE_EXISTS_CACHE = {}


def table_exists(table_name: str) -> bool:
    table_name = clean(table_name)

    if table_name in _TABLE_EXISTS_CACHE:
        return _TABLE_EXISTS_CACHE[table_name]

    row = fetch_one(
        """
        SELECT 1 AS existe
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME = ?
        """,
        (table_name,),
    )

    exists = bool(row)
    _TABLE_EXISTS_CACHE[table_name] = exists

    return exists


def table_columns(table_name: str) -> set:
    table_name = clean(table_name)

    if table_name in _TABLE_COLUMNS_CACHE:
        return _TABLE_COLUMNS_CACHE[table_name]

    rows = fetch_all(
        """
        SELECT COLUMN_NAME AS name
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'dbo'
          AND TABLE_NAME = ?
        """,
        (table_name,),
    )

    columns = {row["name"] for row in rows}
    _TABLE_COLUMNS_CACHE[table_name] = columns

    return columns


def has_column(table_name: str, column_name: str) -> bool:
    return column_name in table_columns(table_name)


def sql_col(table_alias: str, table_name: str, column_name: str, alias: str = None, default_sql: str = "NULL"):
    alias_name = alias or column_name

    if has_column(table_name, column_name):
        return f"{table_alias}.{column_name} AS {alias_name}"

    return f"{default_sql} AS {alias_name}"


def insert_identity(query: str, params: tuple = ()):
    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(query, params)
        cursor.execute("SELECT SCOPE_IDENTITY()")
        row = cursor.fetchone()
        conn.commit()

        return int(row[0]) if row and row[0] is not None else None

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


def insert_dynamic(table_name: str, data: dict):
    columns = table_columns(table_name)

    clean_data = {
        key: value
        for key, value in data.items()
        if key in columns
    }

    if not clean_data:
        raise HTTPException(
            status_code=500,
            detail=f"No hay columnas válidas para insertar en {table_name}."
        )

    names = list(clean_data.keys())
    placeholders = ", ".join(["?"] * len(names))

    query = f"""
        INSERT INTO {table_name} ({", ".join(names)})
        VALUES ({placeholders})
    """

    values = tuple(clean_data[name] for name in names)

    return insert_identity(query, values)

def insert_case_record(data: dict):
    """
    Inserta un caso y devuelve obligatoriamente el caso_id generado.
    Se usa OUTPUT INSERTED.caso_id para evitar que SCOPE_IDENTITY()
    devuelva NULL en SQL Server.
    """

    columns = table_columns("casos")

    clean_data = {
        key: value
        for key, value in data.items()
        if key in columns
    }

    if not clean_data:
        raise HTTPException(
            status_code=500,
            detail="No hay columnas válidas para insertar el caso."
        )

    names = list(clean_data.keys())
    placeholders = ", ".join(["?"] * len(names))

    query = f"""
        INSERT INTO casos ({", ".join(names)})
        OUTPUT INSERTED.caso_id
        VALUES ({placeholders})
    """

    values = tuple(clean_data[name] for name in names)

    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(query, values)

        row = cursor.fetchone()
        conn.commit()

        if row and row[0] is not None:
            return int(row[0])

        codigo_caso = clean_data.get("codigo_caso")

        if codigo_caso:
            found = fetch_one(
                """
                SELECT TOP 1 caso_id
                FROM casos
                WHERE codigo_caso = ?
                ORDER BY caso_id DESC
                """,
                (codigo_caso,)
            )

            if found and found.get("caso_id"):
                return int(found["caso_id"])

        raise HTTPException(
            status_code=500,
            detail="El caso fue registrado, pero no se pudo recuperar el caso_id generado."
        )

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def update_dynamic(table_name: str, data: dict, where_sql: str, where_params: tuple):
    columns = table_columns(table_name)

    clean_data = {
        key: value
        for key, value in data.items()
        if key in columns
    }

    if not clean_data:
        return False

    set_sql = ", ".join([f"{key} = ?" for key in clean_data])

    execute(
        f"""
        UPDATE {table_name}
        SET {set_sql}
        WHERE {where_sql}
        """,
        tuple(clean_data.values()) + where_params,
    )

    return True


def build_query_pagination(page: int = 1, page_size: int = 10):
    page = max(int(page or 1), 1)
    page_size = min(max(int(page_size or 10), 1), 100)
    offset = (page - 1) * page_size

    return page, page_size, offset


# =========================================================
# HELPERS CLIENTE / USUARIO
# =========================================================

def get_cliente_id(current_user: dict) -> int:
    cliente_id = current_user.get("cliente_id")

    if cliente_id:
        return int(cliente_id)

    usuario_id = (
        current_user.get("usuario_id")
        or current_user.get("user_id")
        or current_user.get("id")
    )

    if not usuario_id:
        raise HTTPException(
            status_code=403,
            detail="No se pudo identificar el usuario autenticado."
        )

    row = fetch_one(
        """
        SELECT cliente_id
        FROM clientes
        WHERE usuario_id = ?
        """,
        (usuario_id,),
    )

    if not row:
        raise HTTPException(
            status_code=403,
            detail="El usuario no tiene un cliente asociado."
        )

    return int(row["cliente_id"])


def get_usuario_id(current_user: dict) -> int:
    usuario_id = (
        current_user.get("usuario_id")
        or current_user.get("user_id")
        or current_user.get("id")
    )

    if usuario_id:
        return int(usuario_id)

    cliente_id = get_cliente_id(current_user)

    row = fetch_one(
        """
        SELECT usuario_id
        FROM clientes
        WHERE cliente_id = ?
        """,
        (cliente_id,),
    )

    if not row:
        raise HTTPException(
            status_code=403,
            detail="No se pudo identificar el usuario del cliente."
        )

    return int(row["usuario_id"])


def profile_display_name(profile: dict) -> str:
    if profile.get("tipo_cliente") == "EMPRESA":
        return profile.get("razon_social") or "Cliente Empresa"

    return (
        f"{profile.get('nombres') or ''} {profile.get('apellidos') or ''}".strip()
        or profile.get("razon_social")
        or "Cliente"
    )


# =========================================================
# HELPERS CATÁLOGOS
# =========================================================

def get_catalog_id(table: str, id_column: str, value, fallback_name: str = None):
    text = clean(value)
    number = to_int(text)

    if number:
        row = fetch_one(
            f"""
            SELECT TOP 1 {id_column} AS id
            FROM {table}
            WHERE {id_column} = ?
            """,
            (number,),
        )

        if row:
            return row["id"]

    if text:
        row = fetch_one(
            f"""
            SELECT TOP 1 {id_column} AS id
            FROM {table}
            WHERE LOWER(nombre) = LOWER(?)
               OR LOWER(nombre) LIKE LOWER(?)
            ORDER BY {id_column}
            """,
            (text, f"%{text}%"),
        )

        if row:
            return row["id"]

    if fallback_name:
        return get_catalog_id(table, id_column, fallback_name, None)

    row = fetch_one(
        f"""
        SELECT TOP 1 {id_column} AS id
        FROM {table}
        ORDER BY {id_column}
        """
    )

    if row:
        return row["id"]

    raise HTTPException(
        status_code=500,
        detail=f"No existe catálogo requerido en {table}."
    )


def get_tipo_caso_id(nombre):
    return get_catalog_id("tipos_caso", "tipo_caso_id", nombre, nombre)


def get_categoria_id(value, fallback="Atención al cliente"):
    return get_catalog_id("categorias", "categoria_id", value, fallback)


def get_motivo_id(value):
    if not clean(value):
        return None

    if not table_exists("motivos_catalogo"):
        return None

    return get_catalog_id("motivos_catalogo", "motivo_id", value, None)


def get_estado_id(nombre="Registrado"):
    return get_catalog_id("estados_caso", "estado_caso_id", nombre, "Registrado")


def get_canal_ingreso_id(nombre="Portal web"):
    return get_catalog_id("canales_ingreso", "canal_ingreso_id", nombre, "Portal web")


def get_priority(value, fallback="Media"):
    raw = clean(value) or fallback
    priority_id = get_catalog_id("prioridades", "prioridad_id", raw, fallback)

    horas_col = "horas_sla" if has_column("prioridades", "horas_sla") else "48 AS horas_sla"

    row = fetch_one(
        f"""
        SELECT
            prioridad_id,
            nombre,
            {horas_col}
        FROM prioridades
        WHERE prioridad_id = ?
        """,
        (priority_id,),
    )

    return {
        "prioridad_id": priority_id,
        "nombre": row.get("nombre") if row else fallback,
        "horas_sla": int(row.get("horas_sla") or 48) if row else 48,
    }


def catalogos_ui(grupo: str, fallback: list):
    if not table_exists("catalogos_ui"):
        return fallback

    rows = fetch_all(
        """
        SELECT
            catalogo_ui_id AS id,
            codigo,
            codigo AS value,
            etiqueta AS nombre,
            etiqueta AS label,
            descripcion
        FROM catalogos_ui
        WHERE grupo = ?
          AND activo = 1
        ORDER BY orden, etiqueta
        """,
        (grupo,),
    )

    return rows or fallback


# =========================================================
# ARCHIVOS / EVIDENCIAS
# =========================================================

def get_upload_file_size(file: UploadFile) -> int:
    try:
        current_position = file.file.tell()
        file.file.seek(0, os.SEEK_END)
        size = file.file.tell()
        file.file.seek(current_position)
        return size
    except Exception:
        return 0


def validate_uploaded_files(files: list):
    files = [
        file
        for file in (files or [])
        if file and file.filename
    ]

    if len(files) > 5:
        raise HTTPException(
            status_code=400,
            detail="Solo puedes adjuntar hasta 5 archivos por envío."
        )

    for file in files:
        original_name = Path(file.filename).name
        extension = Path(original_name).suffix.lower()
        size = get_upload_file_size(file)

        if extension in BLOCKED_EXTENSIONS or extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"El archivo {original_name} no tiene un formato permitido. "
                    "Usa PDF, PNG, JPG, JPEG, DOC, DOCX, XLS, XLSX o TXT."
                )
            )

        if size <= 0:
            raise HTTPException(
                status_code=400,
                detail=f"El archivo {original_name} está vacío o no se pudo leer."
            )

        if size > MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"El archivo {original_name} supera {MAX_FILE_SIZE_MB} MB."
            )


async def save_evidence_files(
    case_id: int,
    user_id: int,
    files: list,
    description="Evidencia cargada desde portal cliente."
):
    files = [
        file
        for file in (files or [])
        if file and file.filename
    ]

    if not files:
        return []

    validate_uploaded_files(files)

    saved_files = []

    for file in files:
        original_name = Path(file.filename).name
        extension = Path(original_name).suffix.lower()

        safe_name = (
            f"{datetime.now().strftime('%Y%m%d%H%M%S%f')}_"
            f"{uuid4().hex[:8]}_{case_id}{extension}"
        )

        absolute_path = UPLOAD_DIR / safe_name
        relative_path = str(
            Path("storage") / "uploads" / "evidencias" / safe_name
        ).replace("\\", "/")

        content = await file.read()

        if not content:
            raise HTTPException(
                status_code=400,
                detail=f"El archivo {original_name} está vacío."
            )

        absolute_path.write_bytes(content)

        evidencia_id = insert_dynamic(
            "evidencias",
            {
                "caso_id": case_id,
                "usuario_id": user_id,
                "nombre_archivo": original_name,
                "ruta_archivo": relative_path,
                "tipo_archivo": "EVIDENCIA",
                "tipo_mime": file.content_type or "application/octet-stream",
                "tamano_bytes": len(content),
                "descripcion": description,
                "es_visible_cliente": 1,
                "fecha_subida": datetime.now(),
                "fecha_carga": datetime.now(),
                "fecha_creacion": datetime.now(),
                "fecha_registro": datetime.now(),
            },
        )

        saved_files.append({
            "id": evidencia_id,
            "evidencia_id": evidencia_id,
            "name": original_name,
            "nombre_archivo": original_name,
            "ruta_archivo": relative_path,
            "size": len(content),
            "tamano_bytes": len(content),
            "type": file.content_type or "application/octet-stream",
            "tipo_mime": file.content_type or "application/octet-stream",
        })

    return saved_files


# =========================================================
# QUERIES BASE
# =========================================================

def case_select_sql():
    es_final_sql = (
        "ec.es_final"
        if has_column("estados_caso", "es_final")
        else "CASE WHEN ec.nombre IN ('Resuelto', 'Cerrado') THEN 1 ELSE 0 END"
    )

    horas_sla_sql = (
        "pr.horas_sla"
        if has_column("prioridades", "horas_sla")
        else "48"
    )

    motivo_join = ""
    motivo_select = "NULL AS motivo"

    if table_exists("motivos_catalogo") and has_column("casos", "motivo_id"):
        motivo_join = "LEFT JOIN motivos_catalogo m ON m.motivo_id = ca.motivo_id"
        motivo_select = "m.nombre AS motivo"

    personal_join = ""
    responsable_select = """
        NULL AS responsable_nombres,
        NULL AS responsable_apellidos
    """

    if table_exists("personal"):
        personal_join = """
        LEFT JOIN personal p
            ON p.usuario_id = up.usuario_id
        """
        responsable_select = """
            p.nombres AS responsable_nombres,
            p.apellidos AS responsable_apellidos
        """

    responsable_join = ""

    if has_column("casos", "responsable_actual_usuario_id"):
        responsable_join = """
        LEFT JOIN usuarios up
            ON up.usuario_id = ca.responsable_actual_usuario_id
        """
    else:
        responsable_join = """
        LEFT JOIN usuarios up
            ON 1 = 0
        """

    return f"""
        SELECT
            ca.*,
            tc.nombre AS tipo_caso,
            cat.nombre AS categoria,
            pr.nombre AS prioridad,
            {horas_sla_sql} AS horas_sla,
            ec.nombre AS estado_caso,
            {es_final_sql} AS es_final,
            ci.nombre AS canal,
            sc.codigo_contrato,
            sc.plan_nombre,
            s.nombre AS servicio_nombre,
            {motivo_select},
            up.correo AS responsable_correo,
            {responsable_select}
        FROM casos ca
        INNER JOIN tipos_caso tc
            ON tc.tipo_caso_id = ca.tipo_caso_id
        INNER JOIN categorias cat
            ON cat.categoria_id = ca.categoria_id
        INNER JOIN prioridades pr
            ON pr.prioridad_id = ca.prioridad_id
        INNER JOIN estados_caso ec
            ON ec.estado_caso_id = ca.estado_caso_id
        LEFT JOIN canales_ingreso ci
            ON ci.canal_ingreso_id = ca.canal_ingreso_id
        LEFT JOIN servicios_contratados sc
            ON sc.servicio_contratado_id = ca.servicio_contratado_id
        LEFT JOIN servicios s
            ON s.servicio_id = sc.servicio_id
        {motivo_join}
        {responsable_join}
        {personal_join}
    """


def get_case_for_client(cliente_id: int, case_id: str):
    raw = clean(case_id)

    row = fetch_one(
        case_select_sql()
        + """
        WHERE ca.cliente_id = ?
          AND (
                ca.codigo_caso = ?
                OR ca.caso_id = TRY_CONVERT(INT, ?)
          )
        """,
        (cliente_id, raw, raw),
    )

    if not row:
        raise HTTPException(
            status_code=404,
            detail="No se encontró el caso solicitado."
        )

    return row


def get_service_contract(cliente_id: int, service_value: str):
    raw = clean(service_value)

    if raw:
        row = fetch_one(
            """
            SELECT TOP 1
                sc.servicio_contratado_id,
                sc.codigo_contrato,
                sc.plan_nombre,
                sc.estado,
                sc.direccion_instalacion,
                sc.distrito,
                s.nombre AS servicio_nombre,
                s.tipo_servicio
            FROM servicios_contratados sc
            INNER JOIN servicios s
                ON s.servicio_id = sc.servicio_id
            WHERE sc.cliente_id = ?
              AND (
                    CONVERT(NVARCHAR(50), sc.servicio_contratado_id) = ?
                    OR LOWER(sc.codigo_contrato) = LOWER(?)
                    OR LOWER(sc.plan_nombre) = LOWER(?)
                    OR LOWER(s.nombre) = LOWER(?)
                    OR LOWER(s.tipo_servicio) = LOWER(?)
              )
            ORDER BY sc.servicio_contratado_id
            """,
            (cliente_id, raw, raw, raw, raw, raw),
        )

        if row:
            return row

    return fetch_one(
        """
        SELECT TOP 1
            sc.servicio_contratado_id,
            sc.codigo_contrato,
            sc.plan_nombre,
            sc.estado,
            sc.direccion_instalacion,
            sc.distrito,
            s.nombre AS servicio_nombre,
            s.tipo_servicio
        FROM servicios_contratados sc
        INNER JOIN servicios s
            ON s.servicio_id = sc.servicio_id
        WHERE sc.cliente_id = ?
        ORDER BY sc.servicio_contratado_id
        """,
        (cliente_id,),
    )


def generate_case_code(tipo_caso: str):
    if lower(tipo_caso).startswith("recl"):
        prefix = "REC"
    elif lower(tipo_caso).startswith("incid"):
        prefix = "INC"
    else:
        prefix = "CAS"

    row = fetch_one(
        """
        SELECT ISNULL(MAX(caso_id), 0) + 1 AS next_id
        FROM casos
        """
    )

    next_id = int(row.get("next_id") or 1)

    return f"{prefix}-2026-{next_id:06d}"


def insert_history(case_id: int, user_id: int, action: str, observation: str, visible=True):
    return insert_dynamic(
        "historial_caso",
        {
            "caso_id": case_id,
            "usuario_id": user_id,
            "accion": action,
            "observacion": observation,
            "es_visible_cliente": 1 if visible else 0,
            "fecha_evento": datetime.now(),
            "fecha_registro": datetime.now(),
            "fecha_creacion": datetime.now(),
        },
    )


def insert_notification(
    case_id: int,
    user_id: int,
    tipo: str,
    titulo: str,
    mensaje: str,
    prioridad="Media",
    codigo_caso=None
):
    return insert_dynamic(
        "notificaciones",
        {
            "caso_id": case_id,
            "usuario_id": user_id,
            "tipo": tipo,
            "canal_envio": "SISTEMA",
            "titulo": titulo,
            "mensaje": mensaje,
            "leida": 0,
            "estado_envio": "ENVIADO",
            "prioridad": prioridad,
            "url_accion": f"detalle-caso.html?codigo={codigo_caso}" if codigo_caso else None,
            "fecha_generacion": datetime.now(),
            "fecha_creacion": datetime.now(),
        },
    )


# =========================================================
# NORMALIZADORES
# =========================================================

def build_sla_text(row: dict):
    estado = clean(row.get("estado_caso"))

    if estado in {"Resuelto", "Cerrado"}:
        return "Finalizado"

    limit_date = row.get("fecha_limite_resolucion")

    if not limit_date:
        return "SLA no definido"

    try:
        diff = limit_date - datetime.now()
        hours = int(diff.total_seconds() // 3600)

        if hours < 0:
            return "SLA vencido"

        if hours <= 8:
            return f"SLA crítico: {hours}h restantes"

        return f"{hours}h restantes"

    except Exception:
        return "SLA monitoreado"


def progress_by_status(status: str):
    values = {
        "Registrado": 15,
        "Clasificado": 30,
        "En atención": 55,
        "Pendiente por cliente": 60,
        "Derivado": 65,
        "Escalado": 70,
        "Resuelto": 90,
        "Cerrado": 100,
    }

    return values.get(clean(status), 20)


def next_action(row: dict):
    status = clean(row.get("estado_caso"))

    if status == "Pendiente por cliente":
        return "Responder solicitud del asesor"
    if status == "Registrado":
        return "Esperar clasificación"
    if status == "Clasificado":
        return "Esperar asignación o atención"
    if status == "En atención":
        return "Esperar respuesta del asesor"
    if status == "Derivado":
        return "Seguimiento por área especializada"
    if status == "Escalado":
        return "Seguimiento prioritario"
    if status in {"Resuelto", "Cerrado"}:
        return "Caso finalizado"

    return "Revisar seguimiento"


def case_icon(tipo: str):
    text = lower(tipo)

    if "incid" in text:
        return "⚠️"
    if "solic" in text:
        return "📩"

    return "📝"


def normalize_case(row: dict):
    advisor = "Pendiente"

    if row.get("responsable_nombres") or row.get("responsable_apellidos"):
        advisor = (
            f"{row.get('responsable_nombres') or ''} "
            f"{row.get('responsable_apellidos') or ''}"
        ).strip()
    elif row.get("responsable_correo"):
        advisor = row.get("responsable_correo")

    service_name = row.get("servicio_nombre") or row.get("plan_nombre") or "-"
    code = row.get("codigo_caso")

    return {
        "id": row.get("caso_id"),
        "caso_id": row.get("caso_id"),
        "case_id": row.get("caso_id"),

        "codigo_caso": code,
        "codigo": code,
        "code": code,

        "icon": case_icon(row.get("tipo_caso")),

        "tipo": row.get("tipo_caso"),
        "tipo_caso": row.get("tipo_caso"),
        "type": row.get("tipo_caso"),

        "categoria": row.get("categoria"),
        "motivo": row.get("motivo"),

        "titulo": row.get("titulo"),
        "title": row.get("titulo"),

        "descripcion": row.get("descripcion"),
        "description": row.get("descripcion"),

        "estado": row.get("estado_caso"),
        "estado_caso": row.get("estado_caso"),
        "status": row.get("estado_caso"),

        "prioridad": row.get("prioridad"),
        "priority": row.get("prioridad"),

        "servicio": service_name,
        "servicio_nombre": service_name,
        "service": service_name,

        "codigo_contrato": row.get("codigo_contrato"),

        "canal": row.get("canal") or "Portal web",
        "channel": row.get("canal") or "Portal web",

        "asesor": advisor,
        "advisor": advisor,

        "fecha_registro": row.get("fecha_registro"),
        "date": row.get("fecha_registro"),

        "fecha_limite_resolucion": row.get("fecha_limite_resolucion"),
        "last_update": row.get("fecha_actualizacion") or row.get("fecha_registro"),

        "sla": build_sla_text(row),
        "sla_text": build_sla_text(row),

        "horas_sla": row.get("horas_sla"),
        "sla_hours": row.get("horas_sla"),

        "pendiente_cliente": bool(row.get("pendiente_cliente")),
        "pending_client": bool(row.get("pendiente_cliente")),

        "proximo_paso": next_action(row),
        "action": next_action(row),

        "avance": progress_by_status(row.get("estado_caso")),
        "progress": progress_by_status(row.get("estado_caso")),

        "monto_reclamado": row.get("monto_reclamado"),
        "fecha_hecho": row.get("fecha_hecho"),
        "pretension_cliente": row.get("pretension_cliente"),
        "solucion_final": row.get("solucion_final"),

        "calificacion_cliente": row.get("calificacion_cliente"),
        "comentario_calificacion": row.get("comentario_calificacion"),
    }


def normalize_service_status(status: str):
    value = clean(status).upper()

    if value == "ACTIVO":
        return "Activo"
    if value == "SUSPENDIDO":
        return "Suspendido"
    if value == "BAJA":
        return "Baja"
    if value == "PENDIENTE":
        return "Pendiente"

    return clean(status) or "-"


def service_icon(tipo: str):
    text = lower(tipo)

    if "mov" in text:
        return "📱"
    if "tv" in text:
        return "📺"
    if "cloud" in text or "correo" in text or "seguridad" in text:
        return "☁️"

    return "📡"


def normalize_service(row: dict):
    status = normalize_service_status(row.get("estado"))
    service_name = row.get("servicio_nombre") or row.get("nombre") or row.get("plan_nombre")
    location = row.get("direccion_instalacion") or row.get("distrito") or "-"

    return {
        "id": row.get("servicio_contratado_id"),
        "servicio_contratado_id": row.get("servicio_contratado_id"),

        "code": row.get("codigo_contrato"),
        "codigo_contrato": row.get("codigo_contrato"),

        "icon": service_icon(row.get("tipo_servicio")),

        "name": service_name,
        "nombre": service_name,
        "servicio_nombre": service_name,

        "type": row.get("tipo_servicio"),
        "tipo": row.get("tipo_servicio"),

        "plan": row.get("plan_nombre"),
        "plan_nombre": row.get("plan_nombre"),

        "description": row.get("descripcion"),
        "descripcion": row.get("descripcion"),

        "status": status,
        "estado": status,
        "estado_bd": row.get("estado"),

        "location": location,
        "direccion": row.get("direccion_instalacion"),
        "distrito": row.get("distrito"),

        "start": row.get("fecha_inicio"),
        "fecha_inicio": row.get("fecha_inicio"),

        "monthly": row.get("monto_mensual"),
        "monto_mensual": row.get("monto_mensual"),

        "cases": row.get("casos_asociados") or 0,
        "casos": row.get("casos_asociados") or 0,

        "last": row.get("ultima_atencion"),
        "recommendation": "Reporta una incidencia si el servicio presenta fallas técnicas.",
    }


def notification_type(tipo: str):
    value = lower(tipo)

    if "solic" in value or "pendiente" in value:
        return "solicitud"
    if "sla" in value:
        return "sla"
    if "sistema" in value:
        return "sistema"
    if "evid" in value:
        return "evidencia"
    if "cierre" in value or "resuelto" in value:
        return "cierre"

    return "caso"


def notification_icon(tipo_ui: str):
    return {
        "solicitud": "📩",
        "sla": "⏱️",
        "sistema": "🔔",
        "evidencia": "📎",
        "cierre": "✅",
        "caso": "🎫",
    }.get(tipo_ui, "🔔")


def normalize_notification(row: dict):
    tipo_ui = notification_type(row.get("tipo"))
    code = row.get("codigo_caso")

    return {
        "id": row.get("notificacion_id"),
        "notificacion_id": row.get("notificacion_id"),

        "icon": notification_icon(tipo_ui),

        "title": row.get("titulo"),
        "titulo": row.get("titulo"),

        "message": row.get("mensaje"),
        "mensaje": row.get("mensaje"),

        "type": tipo_ui,
        "tipo": tipo_ui,
        "tipo_bd": row.get("tipo"),

        "priority": lower(row.get("prioridad") or "media"),
        "prioridad": row.get("prioridad") or "Media",

        "case": code or "-",
        "caseCode": code or "-",
        "codigo_caso": code,

        "date": row.get("fecha_generacion"),
        "fecha_generacion": row.get("fecha_generacion"),

        "read": bool(row.get("leida")),
        "leida": bool(row.get("leida")),

        "action": "Ver caso asociado" if code else "Revisar notificación",
        "url_accion": (
            row.get("url_accion")
            or (f"detalle-caso.html?codigo={code}" if code else "notificaciones.html")
        ),
    }


# =========================================================
# PERFIL / ME
# =========================================================

def cliente_me_service(current_user: dict):
    cliente_id = get_cliente_id(current_user)

    segmento_col = sql_col("c", "clientes", "segmento_cliente", "segmento_cliente", "NULL")
    canal_pref_col = sql_col("c", "clientes", "canal_preferido", "canal_preferido", "NULL")
    correo_verificado_col = sql_col("u", "usuarios", "correo_verificado", "correo_verificado", "0")
    ultimo_acceso_col = sql_col("u", "usuarios", "ultimo_acceso", "ultimo_acceso", "NULL")

    profile = fetch_one(
        f"""
        SELECT
            c.cliente_id,
            c.tipo_cliente,
            c.nombres,
            c.apellidos,
            c.razon_social,
            c.documento_tipo,
            c.documento_numero,
            c.correo,
            c.telefono,
            c.direccion,
            {segmento_col},
            {canal_pref_col},
            c.activo,
            u.usuario_id,
            u.username,
            u.estado AS estado_usuario,
            {ultimo_acceso_col},
            {correo_verificado_col},
            r.codigo AS rol
        FROM clientes c
        INNER JOIN usuarios u
            ON u.usuario_id = c.usuario_id
        INNER JOIN roles r
            ON r.rol_id = u.rol_id
        WHERE c.cliente_id = ?
        """,
        (cliente_id,),
    )

    if not profile:
        raise HTTPException(
            status_code=404,
            detail="Cliente no encontrado."
        )

    name = profile_display_name(profile)

    profile["nombre"] = name
    profile["nombre_completo"] = name
    profile["nombres_completos"] = name
    profile["estado"] = "Cuenta activa" if profile.get("activo") else "Cuenta inactiva"
    profile["segmento"] = (
        profile.get("segmento_cliente")
        or ("Residencial" if profile.get("tipo_cliente") == "PERSONA" else "Empresa")
    )

    return {
        "success": True,
        "user": {
            **current_user,
            "cliente_id": cliente_id,
            "tipo_cliente": profile.get("tipo_cliente"),
            "nombre_completo": name,
        },
        "profile": profile,
        "cliente": profile,
    }


def get_preferences(cliente_id: int):
    fallback = {
        "Correo": True,
        "SMS": False,
        "WhatsApp": True,
        "Llamada": False,
    }

    if not table_exists("preferencias_notificacion_cliente"):
        return fallback

    rows = fetch_all(
        """
        SELECT canal, activo
        FROM preferencias_notificacion_cliente
        WHERE cliente_id = ?
        """,
        (cliente_id,),
    )

    if not rows:
        return fallback

    prefs = fallback.copy()

    for row in rows:
        prefs[row.get("canal")] = bool(row.get("activo"))

    return prefs


def cliente_profile_accesses_service(current_user: dict):
    usuario_id = get_usuario_id(current_user)

    rows = []

    if table_exists("accesos_usuario"):
        rows = fetch_all(
            """
            SELECT TOP 8
                acceso_id,
                canal,
                dispositivo,
                navegador,
                ip_origen,
                ubicacion_aproximada,
                resultado,
                fecha_acceso
            FROM accesos_usuario
            WHERE usuario_id = ?
            ORDER BY fecha_acceso DESC
            """,
            (usuario_id,),
        )

    if not rows:
        row = fetch_one(
            """
            SELECT ultimo_acceso
            FROM usuarios
            WHERE usuario_id = ?
            """,
            (usuario_id,),
        )

        rows = [
            {
                "acceso_id": 0,
                "canal": "Web",
                "dispositivo": "Navegador",
                "navegador": "Portal Cliente",
                "ip_origen": "127.0.0.1",
                "ubicacion_aproximada": "Lima, Perú",
                "resultado": "EXITOSO",
                "fecha_acceso": row.get("ultimo_acceso") if row else datetime.now(),
            }
        ]

    items = []

    for row in rows:
        items.append({
            "id": row.get("acceso_id"),
            "icon": "💻",
            "title": f"Acceso {row.get('canal') or 'Web'}",
            "text": (
                f"{row.get('dispositivo') or 'Dispositivo'} · "
                f"{row.get('navegador') or 'Navegador'} · "
                f"{row.get('ubicacion_aproximada') or 'Ubicación no registrada'}"
            ),
            "fecha": row.get("fecha_acceso"),
            "date": row.get("fecha_acceso"),
            "resultado": row.get("resultado") or "EXITOSO",
            "ip": row.get("ip_origen") or "-",
        })

    return {
        "success": True,
        "items": items,
        "accesos": items,
    }


def cliente_profile_service(current_user: dict):
    data = cliente_me_service(current_user)
    profile = data["profile"]
    cliente_id = profile["cliente_id"]

    prefs = get_preferences(cliente_id)

    profile["canal_preferido"] = profile.get("canal_preferido") or "Correo"
    profile["notificaciones_activas"] = any(prefs.values())
    profile["nivel_seguridad"] = "Alta" if profile.get("correo_verificado") else "Media"
    profile["seguridad"] = "Cuenta verificada" if profile.get("correo_verificado") else "Verificación pendiente"

    profile["pref_email"] = prefs.get("Correo", True)
    profile["pref_sms"] = prefs.get("SMS", False)
    profile["pref_whatsapp"] = prefs.get("WhatsApp", True)
    profile["pref_call"] = prefs.get("Llamada", False)

    profile["accesos_recientes"] = cliente_profile_accesses_service(current_user).get("items", [])

    profile["ai_summary"] = [
        {
            "title": "Datos de contacto",
            "text": "Mantén correo, celular y dirección actualizados para recibir alertas de tus casos.",
        },
        {
            "title": "Preferencias",
            "text": "Puedes configurar correo, SMS, WhatsApp o llamada como canales de comunicación.",
        },
    ]

    return profile


def cliente_update_profile_service(current_user: dict, payload: dict):
    cliente_id = get_cliente_id(current_user)

    cliente = fetch_one(
        """
        SELECT cliente_id, usuario_id
        FROM clientes
        WHERE cliente_id = ?
        """,
        (cliente_id,),
    )

    if not cliente:
        raise HTTPException(
            status_code=404,
            detail="Cliente no encontrado."
        )

    correo = clean(payload.get("correo") or payload.get("email"))
    telefono = clean(payload.get("telefono") or payload.get("phone"))
    direccion = clean(payload.get("direccion") or payload.get("address"))
    canal_preferido = clean(
        payload.get("canal_preferido")
        or payload.get("preferred_channel")
        or "Correo"
    )

    if not correo:
        raise HTTPException(
            status_code=400,
            detail="El correo es obligatorio."
        )

    if not telefono:
        raise HTTPException(
            status_code=400,
            detail="El celular de contacto es obligatorio."
        )

    if not direccion:
        raise HTTPException(
            status_code=400,
            detail="La dirección es obligatoria."
        )

    update_dynamic(
        "clientes",
        {
            "correo": correo,
            "telefono": telefono,
            "direccion": direccion,
            "canal_preferido": canal_preferido,
            "fecha_actualizacion": datetime.now(),
        },
        "cliente_id = ?",
        (cliente_id,),
    )

    update_dynamic(
        "usuarios",
        {
            "correo": correo,
            "fecha_actualizacion": datetime.now(),
        },
        "usuario_id = ?",
        (cliente["usuario_id"],),
    )

    cliente_profile_preferences_service(current_user, payload)

    return {
        "success": True,
        "message": "Perfil actualizado correctamente.",
        "profile": cliente_profile_service(current_user),
    }


def cliente_profile_preferences_service(current_user: dict, payload: dict):
    cliente_id = get_cliente_id(current_user)

    if not table_exists("preferencias_notificacion_cliente"):
        return {
            "success": True,
            "message": "Preferencias recibidas. Ejecuta el script incremental para persistirlas."
        }

    mapping = {
        "Correo": payload.get("preferencia_correo", payload.get("pref_email", payload.get("email", True))),
        "SMS": payload.get("preferencia_sms", payload.get("pref_sms", payload.get("sms", False))),
        "WhatsApp": payload.get("preferencia_whatsapp", payload.get("pref_whatsapp", payload.get("whatsapp", False))),
        "Llamada": payload.get("preferencia_llamada", payload.get("pref_call", payload.get("call", False))),
    }

    for canal, active in mapping.items():
        exists = fetch_one(
            """
            SELECT preferencia_id
            FROM preferencias_notificacion_cliente
            WHERE cliente_id = ?
              AND canal = ?
            """,
            (cliente_id, canal),
        )

        if exists:
            execute(
                """
                UPDATE preferencias_notificacion_cliente
                SET activo = ?,
                    fecha_actualizacion = SYSDATETIME()
                WHERE cliente_id = ?
                  AND canal = ?
                """,
                (1 if to_bool(active) else 0, cliente_id, canal),
            )
        else:
            insert_dynamic(
                "preferencias_notificacion_cliente",
                {
                    "cliente_id": cliente_id,
                    "canal": canal,
                    "activo": 1 if to_bool(active) else 0,
                    "fecha_creacion": datetime.now(),
                },
            )

    return {
        "success": True,
        "message": "Preferencias actualizadas correctamente."
    }


def cliente_profile_security_service(current_user: dict):
    profile = cliente_me_service(current_user)["profile"]

    return {
        "success": True,
        "cuenta": "Activa" if profile.get("activo") else "Inactiva",
        "correo": "Verificado" if profile.get("correo_verificado") else "Pendiente de verificación",
        "doble_validacion": "Recomendada",
        "ultimo_acceso": profile.get("ultimo_acceso"),
        "recomendaciones": [
            "Mantén actualizado tu correo y celular.",
            "Revisa accesos recientes si notas actividad inusual.",
            "Usa el flujo de recuperación para cambiar contraseña.",
        ],
    }


# =========================================================
# CASOS
# =========================================================

def cliente_cases_summary_service(current_user: dict):
    cliente_id = get_cliente_id(current_user)

    es_final_expr = (
        "ec.es_final"
        if has_column("estados_caso", "es_final")
        else "CASE WHEN ec.nombre IN ('Resuelto', 'Cerrado') THEN 1 ELSE 0 END"
    )

    row = fetch_one(
        f"""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN {es_final_expr} = 0 THEN 1 ELSE 0 END) AS activos,
            SUM(CASE WHEN ISNULL(ca.pendiente_cliente, 0) = 1 THEN 1 ELSE 0 END) AS pendientes_cliente,
            SUM(CASE WHEN ec.nombre IN ('Resuelto', 'Cerrado') THEN 1 ELSE 0 END) AS resueltos,
            SUM(
                CASE
                    WHEN ca.fecha_limite_resolucion IS NOT NULL
                     AND ca.fecha_limite_resolucion < SYSDATETIME()
                     AND {es_final_expr} = 0
                    THEN 1 ELSE 0
                END
            ) AS sla_vencidos
        FROM casos ca
        INNER JOIN estados_caso ec
            ON ec.estado_caso_id = ca.estado_caso_id
        WHERE ca.cliente_id = ?
        """,
        (cliente_id,),
    )

    return {
        "success": True,
        "total": row.get("total") or 0,
        "activos": row.get("activos") or 0,
        "en_atencion": row.get("activos") or 0,
        "pendientes_cliente": row.get("pendientes_cliente") or 0,
        "resueltos": row.get("resueltos") or 0,
        "sla_criticos": row.get("sla_vencidos") or 0,
    }


def cliente_cases_service(
    current_user: dict,
    page=1,
    page_size=10,
    q="",
    tipo="",
    estado="",
    prioridad="",
    fecha_desde="",
    fecha_hasta=""
):
    cliente_id = get_cliente_id(current_user)
    page, page_size, offset = build_query_pagination(page, page_size)

    where = ["ca.cliente_id = ?"]
    params = [cliente_id]

    if clean(q):
        where.append(
            """
            (
                ca.codigo_caso LIKE ?
                OR ca.titulo LIKE ?
                OR ca.descripcion LIKE ?
                OR s.nombre LIKE ?
                OR sc.plan_nombre LIKE ?
            )
            """
        )
        like = f"%{clean(q)}%"
        params.extend([like, like, like, like, like])

    if clean(tipo) and lower(tipo) not in {"todos", "todas"}:
        where.append("LOWER(tc.nombre) LIKE LOWER(?)")
        params.append(f"%{clean(tipo)}%")

    if clean(estado) and lower(estado) not in {"todos", "todas"}:
        where.append("LOWER(ec.nombre) LIKE LOWER(?)")
        params.append(f"%{clean(estado)}%")

    if clean(prioridad) and lower(prioridad) not in {"todos", "todas"}:
        where.append("LOWER(pr.nombre) LIKE LOWER(?)")
        params.append(f"%{clean(prioridad)}%")

    if clean(fecha_desde):
        where.append("CAST(ca.fecha_registro AS DATE) >= TRY_CONVERT(DATE, ?)")
        params.append(clean(fecha_desde))

    if clean(fecha_hasta):
        where.append("CAST(ca.fecha_registro AS DATE) <= TRY_CONVERT(DATE, ?)")
        params.append(clean(fecha_hasta))

    where_sql = " AND ".join(where)

    total = fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos ca
        INNER JOIN tipos_caso tc
            ON tc.tipo_caso_id = ca.tipo_caso_id
        INNER JOIN categorias cat
            ON cat.categoria_id = ca.categoria_id
        INNER JOIN prioridades pr
            ON pr.prioridad_id = ca.prioridad_id
        INNER JOIN estados_caso ec
            ON ec.estado_caso_id = ca.estado_caso_id
        LEFT JOIN servicios_contratados sc
            ON sc.servicio_contratado_id = ca.servicio_contratado_id
        LEFT JOIN servicios s
            ON s.servicio_id = sc.servicio_id
        WHERE """ + where_sql,
        tuple(params),
    ).get("total")

    rows = fetch_all(
        case_select_sql()
        + f"""
        WHERE {where_sql}
        ORDER BY ca.fecha_registro DESC
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """,
        tuple(params + [offset, page_size]),
    )

    items = [normalize_case(row) for row in rows]
    summary = cliente_cases_summary_service(current_user)

    return {
        "success": True,
        "items": items,
        "cases": items,
        "casos": items,
        "page": page,
        "page_size": page_size,
        "total": total or 0,
        "summary": summary,
        "ai_summary": [
            {
                "title": "Casos cargados",
                "text": f"Se encontraron {total or 0} caso(s) vinculados a tu cuenta.",
            },
            {
                "title": "Pendientes",
                "text": f"Tienes {summary.get('pendientes_cliente', 0)} caso(s) pendientes por cliente.",
            },
        ],
    }


def build_default_steps(status: str):
    order = ["Registrado", "Clasificado", "En atención", "Resuelto", "Cerrado"]
    current_progress = progress_by_status(status)
    steps = []

    for name in order:
        value = progress_by_status(name)

        if value < current_progress:
            state = "done"
        elif name == status:
            state = "current"
        else:
            state = "pending"

        steps.append({
            "icon": "✓" if state == "done" else "●",
            "title": name,
            "text": f"Etapa {name.lower()} del caso.",
            "state": state,
        })

    return steps


def cliente_case_detail_service(current_user: dict, case_id: str):
    cliente_id = get_cliente_id(current_user)
    row = get_case_for_client(cliente_id, case_id)
    detail = normalize_case(row)

    historial = fetch_all(
        """
        SELECT
            h.historial_id,
            h.accion AS title,
            h.accion,
            h.observacion AS text,
            h.observacion,
            h.fecha_evento AS date,
            h.fecha_evento,
            '🕘' AS icon
        FROM historial_caso h
        WHERE h.caso_id = ?
          AND h.es_visible_cliente = 1
        ORDER BY h.fecha_evento ASC
        """,
        (row["caso_id"],),
    )

    evidencias = fetch_all(
        """
        SELECT
            evidencia_id AS id,
            evidencia_id,
            nombre_archivo AS name,
            nombre_archivo,
            ruta_archivo,
            tipo_archivo,
            tipo_mime,
            tamano_bytes AS size,
            tamano_bytes,
            descripcion,
            fecha_subida AS date,
            fecha_subida AS fecha
        FROM evidencias
        WHERE caso_id = ?
          AND es_visible_cliente = 1
        ORDER BY fecha_subida DESC
        """,
        (row["caso_id"],),
    )

    solicitudes = []

    if table_exists("solicitudes_informacion") and has_column("solicitudes_informacion", "caso_id"):
        cols = table_columns("solicitudes_informacion")

        solicitud_id_sql = (
            "solicitud_id"
            if "solicitud_id" in cols
            else "solicitud_informacion_id"
            if "solicitud_informacion_id" in cols
            else "0"
        )

        titulo_sql = (
            "titulo"
            if "titulo" in cols
            else "asunto"
            if "asunto" in cols
            else "'Solicitud de información adicional'"
        )

        mensaje_sql = (
            "mensaje"
            if "mensaje" in cols
            else "descripcion"
            if "descripcion" in cols
            else "observacion"
            if "observacion" in cols
            else "detalle"
            if "detalle" in cols
            else "'El asesor requiere información adicional para continuar con la atención del caso.'"
        )

        estado_sql = (
            "estado"
            if "estado" in cols
            else "'Pendiente'"
        )

        fecha_sql = (
            "fecha_solicitud"
            if "fecha_solicitud" in cols
            else "fecha_creacion"
            if "fecha_creacion" in cols
            else "fecha_registro"
            if "fecha_registro" in cols
            else "SYSDATETIME()"
        )

        solicitudes = fetch_all(
            f"""
            SELECT
                {solicitud_id_sql} AS id,
                {solicitud_id_sql} AS solicitud_id,
                {titulo_sql} AS title,
                {titulo_sql} AS titulo,
                {mensaje_sql} AS text,
                {mensaje_sql} AS mensaje,
                {estado_sql} AS estado,
                {fecha_sql} AS date,
                {fecha_sql} AS fecha_solicitud
            FROM solicitudes_informacion
            WHERE caso_id = ?
            ORDER BY {fecha_sql} DESC
            """,
            (row["caso_id"],),
        )

    if not solicitudes and row.get("pendiente_cliente"):
        solicitudes = [
            {
                "id": None,
                "solicitud_id": None,
                "title": "Solicitud de información adicional",
                "titulo": "Solicitud de información adicional",
                "text": "El asesor requiere información adicional para continuar con la atención del caso.",
                "mensaje": "El asesor requiere información adicional para continuar con la atención del caso.",
                "estado": "Pendiente",
                "date": row.get("fecha_actualizacion") or row.get("fecha_registro"),
                "fecha_solicitud": row.get("fecha_actualizacion") or row.get("fecha_registro"),
            }
        ]

    detail["historial"] = historial
    detail["timeline"] = historial
    detail["evidencias"] = evidencias
    detail["evidence"] = evidencias
    detail["solicitudes"] = solicitudes
    detail["requests"] = solicitudes
    detail["steps"] = build_default_steps(row.get("estado_caso"))
    detail["ai_summary"] = [
        {
            "title": "Estado actual",
            "text": f"El caso {row.get('codigo_caso')} está en estado {row.get('estado_caso')}.",
        },
        {
            "title": "Próximo paso",
            "text": next_action(row),
        },
    ]

    return {
        "success": True,
        "case": detail,
        "caso": detail,
    }


def cliente_case_export_service(current_user: dict, payload: dict):
    response = cliente_cases_service(
        current_user,
        page=1,
        page_size=1000,
    )

    items = response.get("items", [])

    output = StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Código",
        "Tipo",
        "Categoría",
        "Servicio",
        "Estado",
        "Prioridad",
        "Fecha registro",
        "SLA",
    ])

    for item in items:
        writer.writerow([
            item.get("codigo_caso"),
            item.get("tipo"),
            item.get("categoria"),
            item.get("servicio"),
            item.get("estado"),
            item.get("prioridad"),
            item.get("fecha_registro"),
            item.get("sla"),
        ])

    return output.getvalue().encode("utf-8-sig"), "mis-casos.csv", "text/csv"


# =========================================================
# SERVICIOS
# =========================================================

def cliente_services_summary_service(current_user: dict):
    cliente_id = get_cliente_id(current_user)

    row = fetch_one(
        """
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN estado = 'ACTIVO' THEN 1 ELSE 0 END) AS activos,
            SUM(CASE WHEN estado IN ('SUSPENDIDO', 'PENDIENTE') THEN 1 ELSE 0 END) AS observados
        FROM servicios_contratados
        WHERE cliente_id = ?
        """,
        (cliente_id,),
    )

    casos = fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos ca
        INNER JOIN servicios_contratados sc
            ON sc.servicio_contratado_id = ca.servicio_contratado_id
        WHERE sc.cliente_id = ?
        """,
        (cliente_id,),
    )

    activos = row.get("activos") or 0
    observados = row.get("observados") or 0

    return {
        "success": True,
        "total": row.get("total") or 0,
        "activos": activos,
        "active": activos,
        "casos_asociados": casos.get("total") or 0,
        "cases": casos.get("total") or 0,
        "estables": max(activos - observados, 0),
        "observados": observados,
    }


def cliente_services_service(
    current_user: dict,
    page=1,
    page_size=20,
    q="",
    tipo="",
    estado=""
):
    cliente_id = get_cliente_id(current_user)
    page, page_size, offset = build_query_pagination(page, page_size)

    fecha_fin_select = sql_col("sc", "servicios_contratados", "fecha_fin", "fecha_fin", "NULL")
    monto_select = sql_col("sc", "servicios_contratados", "monto_mensual", "monto_mensual", "NULL")
    moneda_select = sql_col("sc", "servicios_contratados", "moneda", "moneda", "'PEN'")

    where = ["sc.cliente_id = ?"]
    params = [cliente_id]

    if clean(q):
        where.append(
            """
            (
                sc.codigo_contrato LIKE ?
                OR sc.plan_nombre LIKE ?
                OR sc.direccion_instalacion LIKE ?
                OR sc.distrito LIKE ?
                OR s.nombre LIKE ?
                OR s.tipo_servicio LIKE ?
            )
            """
        )
        like = f"%{clean(q)}%"
        params.extend([like, like, like, like, like, like])

    if clean(tipo) and lower(tipo) not in {"todos", "todas"}:
        where.append(
            """
            (
                LOWER(s.tipo_servicio) LIKE LOWER(?)
                OR LOWER(s.nombre) LIKE LOWER(?)
                OR LOWER(sc.plan_nombre) LIKE LOWER(?)
            )
            """
        )
        like = f"%{clean(tipo)}%"
        params.extend([like, like, like])

    if clean(estado) and lower(estado) not in {"todos", "todas"}:
        where.append("LOWER(sc.estado) LIKE LOWER(?)")
        params.append(f"%{clean(estado)}%")

    where_sql = " AND ".join(where)

    total = fetch_one(
        f"""
        SELECT COUNT(*) AS total
        FROM servicios_contratados sc
        INNER JOIN servicios s
            ON s.servicio_id = sc.servicio_id
        WHERE {where_sql}
        """,
        tuple(params),
    ).get("total")

    rows = fetch_all(
        f"""
        SELECT
            sc.servicio_contratado_id,
            sc.codigo_contrato,
            sc.plan_nombre,
            sc.estado,
            sc.direccion_instalacion,
            sc.distrito,
            sc.fecha_inicio,
            {fecha_fin_select},
            {monto_select},
            {moneda_select},
            s.nombre AS servicio_nombre,
            s.tipo_servicio,
            s.descripcion,
            (
                SELECT COUNT(*)
                FROM casos ca
                WHERE ca.servicio_contratado_id = sc.servicio_contratado_id
            ) AS casos_asociados,
            (
                SELECT MAX(ca.fecha_actualizacion)
                FROM casos ca
                WHERE ca.servicio_contratado_id = sc.servicio_contratado_id
            ) AS ultima_atencion
        FROM servicios_contratados sc
        INNER JOIN servicios s
            ON s.servicio_id = sc.servicio_id
        WHERE {where_sql}
        ORDER BY sc.servicio_contratado_id DESC
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """,
        tuple(params + [offset, page_size]),
    )

    items = [normalize_service(row) for row in rows]
    summary = cliente_services_summary_service(current_user)

    return {
        "success": True,
        "items": items,
        "servicios": items,
        "services": items,
        "page": page,
        "page_size": page_size,
        "total": total or 0,
        "summary": summary,
        "ai_summary": [
            {
                "title": "Servicios cargados",
                "text": f"Se encontraron {total or 0} servicio(s) asociados a tu cuenta.",
            },
            {
                "title": "Recomendación",
                "text": "Si un servicio tiene casos abiertos, revisa primero el seguimiento antes de registrar uno nuevo.",
            },
        ],
    }


def cliente_service_detail_service(current_user: dict, service_id: str):
    cliente_id = get_cliente_id(current_user)

    fecha_fin_select = sql_col("sc", "servicios_contratados", "fecha_fin", "fecha_fin", "NULL")
    monto_select = sql_col("sc", "servicios_contratados", "monto_mensual", "monto_mensual", "NULL")
    moneda_select = sql_col("sc", "servicios_contratados", "moneda", "moneda", "'PEN'")

    row = fetch_one(
        f"""
        SELECT
            sc.servicio_contratado_id,
            sc.codigo_contrato,
            sc.plan_nombre,
            sc.estado,
            sc.direccion_instalacion,
            sc.distrito,
            sc.fecha_inicio,
            {fecha_fin_select},
            {monto_select},
            {moneda_select},
            s.nombre AS servicio_nombre,
            s.tipo_servicio,
            s.descripcion,
            (
                SELECT COUNT(*)
                FROM casos ca
                WHERE ca.servicio_contratado_id = sc.servicio_contratado_id
            ) AS casos_asociados,
            (
                SELECT MAX(ca.fecha_actualizacion)
                FROM casos ca
                WHERE ca.servicio_contratado_id = sc.servicio_contratado_id
            ) AS ultima_atencion
        FROM servicios_contratados sc
        INNER JOIN servicios s
            ON s.servicio_id = sc.servicio_id
        WHERE sc.cliente_id = ?
          AND (
                sc.servicio_contratado_id = TRY_CONVERT(INT, ?)
                OR sc.codigo_contrato = ?
          )
        """,
        (cliente_id, clean(service_id), clean(service_id)),
    )

    if not row:
        raise HTTPException(
            status_code=404,
            detail="No se encontró el servicio contratado solicitado."
        )

    service = normalize_service(row)

    return {
        "success": True,
        "service": service,
        "servicio": service,
    }


def cliente_service_cases_service(current_user: dict, service_id: str):
    cliente_id = get_cliente_id(current_user)

    rows = fetch_all(
        case_select_sql()
        + """
        WHERE ca.cliente_id = ?
          AND ca.servicio_contratado_id = TRY_CONVERT(INT, ?)
        ORDER BY ca.fecha_registro DESC
        """,
        (cliente_id, clean(service_id)),
    )

    items = [normalize_case(row) for row in rows]

    return {
        "success": True,
        "items": items,
        "casos": items,
        "cases": items,
    }


def cliente_services_diagnostic_service(current_user: dict):
    summary = cliente_services_summary_service(current_user)

    services = cliente_services_service(
        current_user,
        page=1,
        page_size=100,
    ).get("items", [])

    open_cases = sum(int(service.get("cases") or 0) for service in services)

    suggested = "Tus servicios se encuentran sin observaciones críticas."

    if summary.get("observados", 0) > 0:
        suggested = "Revisa los servicios en observación y sus casos asociados."

    if open_cases > 0:
        suggested = "Revisa primero los casos abiertos antes de registrar una nueva incidencia."

    return {
        "success": True,
        "active_services": summary.get("activos", 0),
        "observed_services": summary.get("observados", 0),
        "open_cases": open_cases,
        "suggested_action": suggested,
        "ai_summary": [
            {
                "title": "Diagnóstico general",
                "text": suggested,
            }
        ],
    }


def cliente_services_export_service(current_user: dict, payload: dict):
    response = cliente_services_service(
        current_user,
        page=1,
        page_size=1000,
    )

    items = response.get("items", [])

    output = StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Código contrato",
        "Servicio",
        "Tipo",
        "Plan",
        "Estado",
        "Ubicación",
        "Casos asociados",
        "Fecha inicio",
        "Monto mensual",
    ])

    for item in items:
        writer.writerow([
            item.get("codigo_contrato"),
            item.get("servicio_nombre"),
            item.get("tipo"),
            item.get("plan_nombre"),
            item.get("estado"),
            item.get("location"),
            item.get("cases"),
            item.get("fecha_inicio"),
            item.get("monto_mensual"),
        ])

    return output.getvalue().encode("utf-8-sig"), "servicios-contratados.csv", "text/csv"


# =========================================================
# NOTIFICACIONES
# =========================================================

def notification_hidden_condition(alias="n"):
    if has_column("notificaciones", "oculta_cliente"):
        return f"AND ISNULL({alias}.oculta_cliente, 0) = 0"

    return ""


def cliente_notifications_summary_service(current_user: dict):
    cliente_id = get_cliente_id(current_user)
    hidden_sql = notification_hidden_condition("n")

    row = fetch_one(
        f"""
        SELECT
            COUNT(*) AS total,
            SUM(CASE WHEN n.leida = 0 THEN 1 ELSE 0 END) AS no_leidas,
            SUM(CASE WHEN n.caso_id IS NOT NULL THEN 1 ELSE 0 END) AS asociadas_casos,
            SUM(CASE WHEN UPPER(n.tipo) LIKE '%SLA%' THEN 1 ELSE 0 END) AS sla
        FROM notificaciones n
        INNER JOIN clientes c
            ON c.usuario_id = n.usuario_id
        WHERE c.cliente_id = ?
          {hidden_sql}
        """,
        (cliente_id,),
    )

    return {
        "success": True,
        "total": row.get("total") or 0,
        "no_leidas": row.get("no_leidas") or 0,
        "unread": row.get("no_leidas") or 0,
        "asociadas_casos": row.get("asociadas_casos") or 0,
        "case_notifications": row.get("asociadas_casos") or 0,
        "sla": row.get("sla") or 0,
        "sla_notifications": row.get("sla") or 0,
    }


def cliente_notifications_service(current_user: dict, page=1, page_size=20):
    cliente_id = get_cliente_id(current_user)
    page, page_size, offset = build_query_pagination(page, page_size)

    hidden_sql = notification_hidden_condition("n")
    prioridad_select = sql_col("n", "notificaciones", "prioridad", "prioridad", "'Media'")
    url_select = sql_col("n", "notificaciones", "url_accion", "url_accion", "NULL")

    total = fetch_one(
        f"""
        SELECT COUNT(*) AS total
        FROM notificaciones n
        INNER JOIN clientes c
            ON c.usuario_id = n.usuario_id
        WHERE c.cliente_id = ?
          {hidden_sql}
        """,
        (cliente_id,),
    ).get("total")

    rows = fetch_all(
        f"""
        SELECT
            n.notificacion_id,
            n.tipo,
            n.titulo,
            n.mensaje,
            n.leida,
            n.fecha_generacion,
            n.estado_envio,
            {prioridad_select},
            {url_select},
            ca.codigo_caso
        FROM notificaciones n
        LEFT JOIN casos ca
            ON ca.caso_id = n.caso_id
        INNER JOIN clientes c
            ON c.usuario_id = n.usuario_id
        WHERE c.cliente_id = ?
          {hidden_sql}
        ORDER BY n.fecha_generacion DESC
        OFFSET ? ROWS FETCH NEXT ? ROWS ONLY
        """,
        (cliente_id, offset, page_size),
    )

    items = [normalize_notification(row) for row in rows]
    summary = cliente_notifications_summary_service(current_user)

    return {
        "success": True,
        "items": items,
        "notificaciones": items,
        "notifications": items,
        "page": page,
        "page_size": page_size,
        "total": total or 0,
        "summary": summary,
        "ai_summary": [
            {
                "title": "Alertas pendientes",
                "text": f"Tienes {summary.get('no_leidas', 0)} notificación(es) no leída(s).",
            },
            {
                "title": "Prioridad",
                "text": "Revisa primero solicitudes del asesor y alertas SLA.",
            },
        ],
    }


def cliente_mark_all_notifications_read_service(current_user: dict):
    cliente_id = get_cliente_id(current_user)
    hidden_sql = notification_hidden_condition("n")

    execute(
        f"""
        UPDATE n
        SET n.leida = 1,
            n.fecha_lectura = SYSDATETIME()
        FROM notificaciones n
        INNER JOIN clientes c
            ON c.usuario_id = n.usuario_id
        WHERE c.cliente_id = ?
          {hidden_sql}
        """,
        (cliente_id,),
    )

    return {
        "success": True,
        "message": "Todas las notificaciones fueron marcadas como leídas."
    }


def cliente_mark_notification_read_service(current_user: dict, notification_id: int):
    cliente_id = get_cliente_id(current_user)

    execute(
        """
        UPDATE n
        SET n.leida = 1,
            n.fecha_lectura = SYSDATETIME()
        FROM notificaciones n
        INNER JOIN clientes c
            ON c.usuario_id = n.usuario_id
        WHERE c.cliente_id = ?
          AND n.notificacion_id = ?
        """,
        (cliente_id, notification_id),
    )

    return {
        "success": True,
        "message": "Notificación marcada como leída."
    }


def cliente_hide_read_notifications_service(current_user: dict):
    cliente_id = get_cliente_id(current_user)

    if has_column("notificaciones", "oculta_cliente"):
        execute(
            """
            UPDATE n
            SET n.oculta_cliente = 1,
                n.fecha_oculta_cliente = SYSDATETIME()
            FROM notificaciones n
            INNER JOIN clientes c
                ON c.usuario_id = n.usuario_id
            WHERE c.cliente_id = ?
              AND n.leida = 1
            """,
            (cliente_id,),
        )
    else:
        execute(
            """
            DELETE n
            FROM notificaciones n
            INNER JOIN clientes c
                ON c.usuario_id = n.usuario_id
            WHERE c.cliente_id = ?
              AND n.leida = 1
            """,
            (cliente_id,),
        )

    return {
        "success": True,
        "message": "Notificaciones leídas ocultadas correctamente."
    }


def cliente_delete_read_notifications_service(current_user: dict):
    return cliente_hide_read_notifications_service(current_user)


# =========================================================
# DASHBOARD
# =========================================================

def cliente_dashboard_service(current_user: dict):
    cliente_id = get_cliente_id(current_user)

    profile = cliente_me_service(current_user)["profile"]
    summary_cases = cliente_cases_summary_service(current_user)
    summary_services = cliente_services_summary_service(current_user)
    summary_notifications = cliente_notifications_summary_service(current_user)

    recent_cases_rows = fetch_all(
        case_select_sql()
        + """
        WHERE ca.cliente_id = ?
        ORDER BY ca.fecha_registro DESC
        OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY
        """,
        (cliente_id,),
    )

    recent_cases = [normalize_case(row) for row in recent_cases_rows]

    services = cliente_services_service(
        current_user=current_user,
        page=1,
        page_size=4,
    ).get("items", [])

    notifications = cliente_notifications_service(
        current_user=current_user,
        page=1,
        page_size=5,
    ).get("items", [])

    activity = fetch_all(
        """
        SELECT TOP 8
            h.historial_id,
            h.accion AS title,
            h.accion,
            h.observacion AS text,
            h.observacion,
            h.fecha_evento AS date,
            h.fecha_evento,
            '🕘' AS icon,
            ca.codigo_caso
        FROM historial_caso h
        INNER JOIN casos ca
            ON ca.caso_id = h.caso_id
        WHERE ca.cliente_id = ?
          AND h.es_visible_cliente = 1
        ORDER BY h.fecha_evento DESC
        """,
        (cliente_id,),
    )

    open_cases = summary_cases.get("activos", 0)
    unread_notifications = summary_notifications.get("no_leidas", 0)

    return {
        "success": True,
        "profile": profile,
        "cliente": profile,
        "user": {
            "cliente_id": cliente_id,
            "nombre_completo": profile.get("nombre_completo"),
            "tipo_cliente": profile.get("tipo_cliente"),
        },
        "last_access": profile.get("ultimo_acceso"),
        "open_cases": open_cases,
        "active_cases": open_cases,
        "sla_status": "SLA monitoreado",
        "sla_text": (
            "Revisa tus casos activos y pendientes por cliente para evitar retrasos."
            if open_cases
            else "No tienes casos activos con seguimiento pendiente."
        ),
        "kpis": [
            {
                "icon": "🎫",
                "value": summary_cases.get("total", 0),
                "label": "Casos registrados",
                "description": "Total de casos vinculados a tu cuenta",
            },
            {
                "icon": "⏳",
                "value": summary_cases.get("activos", 0),
                "label": "Casos activos",
                "description": "Casos en atención o pendientes",
            },
            {
                "icon": "📡",
                "value": summary_services.get("activos", 0),
                "label": "Servicios activos",
                "description": "Servicios contratados vigentes",
            },
            {
                "icon": "🔔",
                "value": unread_notifications,
                "label": "Alertas no leídas",
                "description": "Notificaciones pendientes de revisión",
            },
        ],
        "summary": {
            "cases": summary_cases,
            "services": summary_services,
            "notifications": summary_notifications,
        },
        "recent_cases": recent_cases,
        "cases": recent_cases,
        "services": services,
        "servicios": services,
        "notifications": notifications,
        "notificaciones": notifications,
        "activity": activity,
        "timeline": activity,
        "ai_summary": [
            {
                "title": "Resumen de atención",
                "text": (
                    f"Tienes {summary_cases.get('total', 0)} caso(s) registrado(s), "
                    f"{summary_cases.get('activos', 0)} activo(s) y "
                    f"{summary_cases.get('pendientes_cliente', 0)} pendiente(s) por cliente."
                ),
            },
            {
                "title": "Servicios",
                "text": (
                    f"Tienes {summary_services.get('activos', 0)} servicio(s) activo(s) "
                    f"y {summary_services.get('observados', 0)} en observación."
                ),
            },
            {
                "title": "Alertas",
                "text": (
                    f"Tienes {summary_notifications.get('no_leidas', 0)} notificación(es) no leída(s). "
                    "Revisa primero solicitudes del asesor y alertas SLA."
                ),
            },
        ],
    }


# =========================================================
# CATÁLOGOS
# =========================================================

def cliente_claim_catalogs_service(current_user: dict):
    services = cliente_services_service(
        current_user,
        page=1,
        page_size=100,
    ).get("items", [])

    categorias = fetch_all(
        """
        SELECT
            categoria_id AS id,
            categoria_id,
            nombre,
            nombre AS label,
            descripcion
        FROM categorias
        WHERE activo = 1
        ORDER BY nombre
        """
    )

    motivos = []

    if table_exists("motivos_catalogo"):
        categoria_col = ", categoria_id" if has_column("motivos_catalogo", "categoria_id") else ""

        motivos = fetch_all(
            f"""
            SELECT
                motivo_id AS id,
                motivo_id,
                nombre,
                nombre AS label,
                descripcion
                {categoria_col}
            FROM motivos_catalogo
            WHERE activo = 1
            ORDER BY nombre
            """
        )

    horas_col = ", horas_sla" if has_column("prioridades", "horas_sla") else ""

    prioridades = fetch_all(
        f"""
        SELECT
            prioridad_id AS id,
            prioridad_id,
            nombre,
            nombre AS label,
            descripcion
            {horas_col}
        FROM prioridades
        WHERE activo = 1
        ORDER BY prioridad_id
        """
    )

    contactos = catalogos_ui(
        "canal_contacto_cliente",
        [
            {"id": "Correo", "codigo": "Correo", "nombre": "Correo electrónico", "label": "Correo electrónico"},
            {"id": "SMS", "codigo": "SMS", "nombre": "SMS", "label": "SMS"},
            {"id": "WhatsApp", "codigo": "WhatsApp", "nombre": "WhatsApp", "label": "WhatsApp"},
            {"id": "Llamada", "codigo": "Llamada", "nombre": "Llamada telefónica", "label": "Llamada telefónica"},
        ],
    )

    return {
        "success": True,
        "servicios": services,
        "services": services,
        "categorias": categorias,
        "categories": categorias,
        "motivos": motivos,
        "reasons": motivos,
        "prioridades": prioridades,
        "priorities": prioridades,
        "contactos": contactos,
        "canales_contacto": contactos,
    }


def cliente_incident_catalogs_service(current_user: dict):
    services = cliente_services_service(
        current_user,
        page=1,
        page_size=100,
    ).get("items", [])

    if table_exists("sintomas_incidencia"):
        sintomas = fetch_all(
            """
            SELECT
                sintoma_id AS id,
                sintoma_id,
                nombre,
                nombre AS label,
                descripcion,
                tipo_servicio
            FROM sintomas_incidencia
            WHERE activo = 1
            ORDER BY nombre
            """
        )
    else:
        sintomas = [
            {"id": "Sin servicio", "nombre": "Sin servicio", "label": "Sin servicio"},
            {"id": "Servicio intermitente", "nombre": "Servicio intermitente", "label": "Servicio intermitente"},
            {"id": "Lentitud del servicio", "nombre": "Lentitud del servicio", "label": "Lentitud del servicio"},
            {"id": "Problemas de señal", "nombre": "Problemas de señal", "label": "Problemas de señal"},
            {"id": "Error de acceso", "nombre": "Error de acceso", "label": "Error de acceso"},
        ]

    impactos = catalogos_ui(
        "impacto_incidencia",
        [
            {"id": "Individual", "codigo": "Individual", "nombre": "Afecta solo a un usuario", "label": "Afecta solo a un usuario"},
            {"id": "Hogar", "codigo": "Hogar", "nombre": "Afecta a todo el hogar", "label": "Afecta a todo el hogar"},
            {"id": "Empresa", "codigo": "Empresa", "nombre": "Afecta operación de empresa", "label": "Afecta operación de empresa"},
            {"id": "Masivo", "codigo": "Masivo", "nombre": "Posible afectación masiva", "label": "Posible afectación masiva"},
        ],
    )

    urgencias = catalogos_ui(
        "urgencia_incidencia",
        [
            {"id": "Baja", "codigo": "Baja", "nombre": "Baja", "label": "Baja"},
            {"id": "Media", "codigo": "Media", "nombre": "Media", "label": "Media"},
            {"id": "Alta", "codigo": "Alta", "nombre": "Alta", "label": "Alta"},
            {"id": "Crítica", "codigo": "Crítica", "nombre": "Crítica", "label": "Crítica"},
        ],
    )

    return {
        "success": True,
        "servicios": services,
        "services": services,
        "sintomas": sintomas,
        "symptoms": sintomas,
        "impactos": impactos,
        "impacts": impactos,
        "urgencias": urgencias,
        "urgencies": urgencias,
    }


# =========================================================
# CREACIÓN DE RECLAMOS / INCIDENCIAS
# =========================================================

def get_sintoma_name(value):
    raw = clean(value)
    number = to_int(raw)

    if number and table_exists("sintomas_incidencia"):
        row = fetch_one(
            """
            SELECT nombre
            FROM sintomas_incidencia
            WHERE sintoma_id = ?
            """,
            (number,),
        )

        if row:
            return row.get("nombre")

    return raw or "Falla de servicio"


def infer_incident_priority(impacto: str, urgencia: str):
    text = f"{impacto} {urgencia}".lower()

    if "crítica" in text or "critica" in text or "masivo" in text or "empresa" in text:
        return "Crítica"
    if "alta" in text:
        return "Alta"
    if "baja" in text:
        return "Baja"

    return "Media"


def find_recent_duplicate_case(
    cliente_id: int,
    tipo_caso_id: int,
    servicio_contratado_id: int,
    title: str,
    description: str,
    minutes: int = 30
):
    title = clean(title)
    description_sample = clean(description)[:120]

    return fetch_one(
        """
        SELECT TOP 1
            ca.caso_id,
            ca.codigo_caso,
            ca.titulo,
            ca.fecha_registro
        FROM casos ca
        INNER JOIN estados_caso ec
            ON ec.estado_caso_id = ca.estado_caso_id
        WHERE ca.cliente_id = ?
          AND ca.tipo_caso_id = ?
          AND ca.servicio_contratado_id = ?
          AND ca.fecha_registro >= DATEADD(MINUTE, -?, SYSDATETIME())
          AND (
                LOWER(LTRIM(RTRIM(ca.titulo))) = LOWER(LTRIM(RTRIM(?)))
                OR LOWER(ca.descripcion) LIKE LOWER(?)
          )
        ORDER BY ca.fecha_registro DESC
        """,
        (
            cliente_id,
            tipo_caso_id,
            servicio_contratado_id,
            minutes,
            title,
            f"%{description_sample}%" if description_sample else "%%",
        ),
    )


def cliente_validate_claim_service(current_user: dict, payload: dict):
    cliente_id = get_cliente_id(current_user)

    servicio = get_service_contract(
        cliente_id,
        payload.get("servicio_contratado_id")
        or payload.get("service")
        or payload.get("servicio")
    )

    if not servicio:
        raise HTTPException(
            status_code=400,
            detail="Selecciona un servicio contratado válido."
        )

    if not clean(payload.get("descripcion") or payload.get("description")):
        raise HTTPException(
            status_code=400,
            detail="La descripción del reclamo es obligatoria."
        )

    return {
        "success": True,
        "message": "El reclamo puede ser registrado.",
        "service": servicio,
    }


def cliente_save_claim_draft_service(current_user: dict, payload: dict):
    cliente_id = get_cliente_id(current_user)

    if table_exists("borradores_caso"):
        insert_dynamic(
            "borradores_caso",
            {
                "cliente_id": cliente_id,
                "tipo_caso": "Reclamo",
                "payload_json": json_text(payload),
                "activo": 1,
                "fecha_creacion": datetime.now(),
            },
        )

    return {
        "success": True,
        "message": "Borrador de reclamo guardado correctamente."
    }


def cliente_save_incident_draft_service(current_user: dict, payload: dict):
    cliente_id = get_cliente_id(current_user)

    if table_exists("borradores_caso"):
        insert_dynamic(
            "borradores_caso",
            {
                "cliente_id": cliente_id,
                "tipo_caso": "Incidencia",
                "payload_json": json_text(payload),
                "activo": 1,
                "fecha_creacion": datetime.now(),
            },
        )

    return {
        "success": True,
        "message": "Borrador de incidencia guardado correctamente."
    }


async def cliente_create_claim_service(
    current_user: dict,
    service: str = "",
    category: str = "",
    priority: str = "",
    contact: str = "",
    title: str = "",
    amount: str = "",
    event_date: str = "",
    description: str = "",
    files: list = None,
    payload: dict = None,
):
    payload = payload or {}

    service_value = payload.get("servicio_contratado_id") or payload.get("service") or service
    category_value = payload.get("categoria_id") or payload.get("category") or category or "Facturación"
    motivo_value = payload.get("motivo_id")
    priority_value = payload.get("prioridad_id") or payload.get("prioridad") or payload.get("priority") or priority or "Media"

    title_value = clean(payload.get("titulo") or payload.get("title") or title) or "Reclamo registrado por cliente"
    description_value = clean(payload.get("descripcion") or payload.get("description") or description)

    if not description_value:
        raise HTTPException(
            status_code=400,
            detail="La descripción del reclamo es obligatoria."
        )

    return await create_case_common(
        current_user=current_user,
        tipo_caso="Reclamo",
        servicio_value=service_value,
        categoria_value=category_value,
        motivo_value=motivo_value,
        prioridad_value=priority_value,
        titulo=title_value,
        descripcion=description_value,
        files=files or [],
        extra_fields={
            "monto_reclamado": to_float(payload.get("monto_reclamado") or payload.get("amount") or amount),
            "fecha_hecho": parse_datetime_or_none(payload.get("fecha_hecho") or payload.get("event_date") or event_date),
            "canal_contacto_preferido": clean(payload.get("canal_contacto_preferido") or payload.get("contact") or contact),
            "pretension_cliente": clean(payload.get("pretension_cliente") or payload.get("solucion_esperada")),
        },
    )


def cliente_incident_diagnostic_service(current_user: dict, payload: dict):
    sintoma = get_sintoma_name(payload.get("sintoma_id") or payload.get("symptom"))
    impacto = clean(payload.get("impacto_cliente") or payload.get("impact"))
    urgencia = clean(payload.get("urgencia_cliente") or payload.get("urgency"))

    priority = infer_incident_priority(impacto, urgencia)
    evidence = "Captura, foto del equipo o prueba de velocidad"

    if "sin servicio" in sintoma.lower():
        evidence = "Foto del equipo, luces del router o captura del error"
    if "lentitud" in sintoma.lower():
        evidence = "Prueba de velocidad y captura de hora del evento"

    return {
        "success": True,
        "priority": priority,
        "prioridad": priority,
        "affectation": impacto or "No indicado",
        "evidence": evidence,
        "action": "Completar datos y registrar incidencia",
        "diagnosis": (
            f"Síntoma: {sintoma}. Impacto: {impacto or 'No indicado'}. "
            f"Urgencia estimada: {priority}."
        ),
    }


async def cliente_create_incident_service(
    current_user: dict,
    service: str = "",
    symptom: str = "",
    impact: str = "",
    urgency: str = "",
    address: str = "",
    start_date: str = "",
    description: str = "",
    files: list = None,
    payload: dict = None,
):
    payload = payload or {}

    service_value = payload.get("servicio_contratado_id") or payload.get("service") or service
    sintoma = get_sintoma_name(payload.get("sintoma_id") or payload.get("symptom") or symptom)

    description_value = clean(payload.get("descripcion") or payload.get("description") or description)

    if not description_value:
        raise HTTPException(
            status_code=400,
            detail="La descripción de la incidencia es obligatoria."
        )

    title_value = (
        clean(payload.get("titulo") or payload.get("title"))
        or f"Incidencia técnica: {sintoma}"
    )

    impacto = clean(payload.get("impacto_cliente") or payload.get("impact") or impact)
    urgencia = clean(payload.get("urgencia_cliente") or payload.get("urgency") or urgency)
    prioridad = infer_incident_priority(impacto, urgencia)

    diagnostic = cliente_incident_diagnostic_service(
        current_user,
        {
            "sintoma_id": sintoma,
            "impacto_cliente": impacto,
            "urgencia_cliente": urgencia,
        },
    )

    return await create_case_common(
        current_user=current_user,
        tipo_caso="Incidencia",
        servicio_value=service_value,
        categoria_value=sintoma,
        motivo_value=None,
        prioridad_value=prioridad,
        titulo=title_value,
        descripcion=description_value,
        files=files or [],
        extra_fields={
            "fecha_hecho": parse_datetime_or_none(payload.get("fecha_hecho") or payload.get("start_date") or start_date),
            "impacto_cliente": impacto,
            "urgencia_cliente": urgencia,
            "ubicacion_referencial": clean(payload.get("ubicacion_referencial") or payload.get("address") or address),
            "diagnostico_preliminar": diagnostic.get("diagnosis"),
        },
    )


async def create_case_common(
    current_user: dict,
    tipo_caso: str,
    servicio_value,
    categoria_value,
    motivo_value,
    prioridad_value,
    titulo: str,
    descripcion: str,
    files: list,
    extra_fields: dict,
):
    cliente_id = get_cliente_id(current_user)
    usuario_id = get_usuario_id(current_user)

    validate_uploaded_files(files or [])

    service_contract = get_service_contract(cliente_id, servicio_value)

    if not service_contract:
        raise HTTPException(
            status_code=400,
            detail="No se encontró un servicio contratado asociado al cliente."
        )

    tipo_caso_id = get_tipo_caso_id(tipo_caso)
    fallback_category = "Facturación" if tipo_caso == "Reclamo" else "Internet hogar"

    try:
        categoria_id = get_categoria_id(categoria_value, fallback_category)
    except Exception:
        categoria_id = get_categoria_id(fallback_category, "Atención al cliente")

    try:
        motivo_id = get_motivo_id(motivo_value)
    except Exception:
        motivo_id = None

    priority = get_priority(prioridad_value, "Media")
    estado_caso_id = get_estado_id("Registrado")
    canal_ingreso_id = get_canal_ingreso_id("Portal web")

    duplicate = find_recent_duplicate_case(
        cliente_id=cliente_id,
        tipo_caso_id=tipo_caso_id,
        servicio_contratado_id=service_contract["servicio_contratado_id"],
        title=titulo,
        description=descripcion,
        minutes=30,
    )

    if duplicate:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Ya existe un caso similar registrado recientemente: "
                f"{duplicate.get('codigo_caso')}. Revisa Mis casos antes de crear uno nuevo."
            ),
        )

    codigo = generate_case_code(tipo_caso)
    fecha_limite = datetime.now() + timedelta(hours=priority["horas_sla"])

    case_data = {
        "codigo_caso": codigo,
        "cliente_id": cliente_id,
        "servicio_contratado_id": service_contract["servicio_contratado_id"],
        "tipo_caso_id": tipo_caso_id,
        "categoria_id": categoria_id,
        "motivo_id": motivo_id,
        "prioridad_id": priority["prioridad_id"],
        "estado_caso_id": estado_caso_id,
        "canal_ingreso_id": canal_ingreso_id,
        "titulo": clean(titulo),
        "descripcion": clean(descripcion),
        "pendiente_cliente": 0,
        "fecha_registro": datetime.now(),
        "fecha_limite_resolucion": fecha_limite,
        "fecha_actualizacion": datetime.now(),

        "monto_reclamado": extra_fields.get("monto_reclamado"),
        "fecha_hecho": extra_fields.get("fecha_hecho"),
        "canal_contacto_preferido": extra_fields.get("canal_contacto_preferido"),
        "pretension_cliente": extra_fields.get("pretension_cliente"),
        "impacto_cliente": extra_fields.get("impacto_cliente"),
        "urgencia_cliente": extra_fields.get("urgencia_cliente"),
        "ubicacion_referencial": extra_fields.get("ubicacion_referencial"),
        "diagnostico_preliminar": extra_fields.get("diagnostico_preliminar"),
    }

    case_id = insert_case_record(case_data)

    insert_history(
        case_id=case_id,
        user_id=usuario_id,
        action="Caso registrado",
        observation=f"El cliente registró un {tipo_caso.lower()} desde el portal web.",
        visible=True,
    )

    saved_files = await save_evidence_files(
        case_id=case_id,
        user_id=usuario_id,
        files=files or [],
        description=f"Evidencia adjuntada al registrar {tipo_caso.lower()} desde portal cliente.",
    )

    if saved_files:
        insert_history(
            case_id=case_id,
            user_id=usuario_id,
            action="Evidencia adjuntada",
            observation=f"Se adjuntaron {len(saved_files)} archivo(s) de evidencia al registrar el caso.",
            visible=True,
        )

    insert_notification(
        case_id=case_id,
        user_id=usuario_id,
        tipo="SEGUIMIENTO",
        titulo="Caso registrado correctamente",
        mensaje=f"Tu caso {codigo} fue registrado y se encuentra pendiente de clasificación.",
        prioridad=priority["nombre"],
        codigo_caso=codigo,
    )

    return {
        "success": True,
        "message": f"{tipo_caso} registrado correctamente.",
        "caso_id": case_id,
        "id": case_id,
        "codigo_caso": codigo,
        "codigo": codigo,
        "code": codigo,
        "case_code": codigo,
        "archivos": saved_files,
        "evidencias": saved_files,
        "evidence_count": len(saved_files),
    }


# =========================================================
# ACCIONES DETALLE CASO
# =========================================================

async def cliente_upload_case_evidence_service(current_user: dict, case_id: str, files: list):
    cliente_id = get_cliente_id(current_user)
    usuario_id = get_usuario_id(current_user)

    case_row = get_case_for_client(cliente_id, case_id)

    if not files:
        raise HTTPException(
            status_code=400,
            detail="No se recibieron archivos."
        )

    saved_files = await save_evidence_files(
        case_id=case_row["caso_id"],
        user_id=usuario_id,
        files=files,
        description="Evidencia adicional cargada desde detalle del caso.",
    )

    insert_history(
        case_id=case_row["caso_id"],
        user_id=usuario_id,
        action="Evidencia enviada",
        observation=f"El cliente adjuntó {len(saved_files)} archivo(s) de evidencia al caso.",
        visible=True,
    )

    execute(
        """
        UPDATE casos
        SET fecha_actualizacion = SYSDATETIME()
        WHERE caso_id = ?
        """,
        (case_row["caso_id"],),
    )

    return {
        "success": True,
        "message": "Evidencia registrada correctamente.",
        "files": saved_files,
        "evidencias": saved_files,
    }


async def cliente_send_advisor_response_service(
    current_user: dict,
    case_id: str,
    response: str,
    files: list,
    request_id=None,
):
    cliente_id = get_cliente_id(current_user)
    usuario_id = get_usuario_id(current_user)

    case_row = get_case_for_client(cliente_id, case_id)

    if not clean(response):
        raise HTTPException(
            status_code=400,
            detail="La respuesta no puede estar vacía."
        )

    insert_history(
        case_id=case_row["caso_id"],
        user_id=usuario_id,
        action="Respuesta del cliente",
        observation=clean(response),
        visible=True,
    )

    saved_files = await save_evidence_files(
        case_id=case_row["caso_id"],
        user_id=usuario_id,
        files=files or [],
        description="Evidencia adjuntada a la respuesta del cliente.",
    )

    execute(
        """
        UPDATE casos
        SET pendiente_cliente = 0,
            fecha_actualizacion = SYSDATETIME()
        WHERE caso_id = ?
        """,
        (case_row["caso_id"],),
    )

    if request_id and table_exists("solicitudes_informacion"):
        update_dynamic(
            "solicitudes_informacion",
            {
                "estado": "Respondida",
                "fecha_respuesta": datetime.now(),
                "respuesta_cliente": clean(response),
            },
            "solicitud_id = ? AND caso_id = ?",
            (request_id, case_row["caso_id"]),
        )

    insert_notification(
        case_id=case_row["caso_id"],
        user_id=usuario_id,
        tipo="SEGUIMIENTO",
        titulo="Respuesta enviada",
        mensaje=f"Tu respuesta fue registrada en el caso {case_row.get('codigo_caso')}.",
        prioridad="Media",
        codigo_caso=case_row.get("codigo_caso"),
    )

    return {
        "success": True,
        "message": "Respuesta enviada correctamente.",
        "files": saved_files,
        "evidencias": saved_files,
    }


def cliente_submit_survey_service(current_user: dict, case_id: str, payload: dict):
    cliente_id = get_cliente_id(current_user)
    usuario_id = get_usuario_id(current_user)
    case_row = get_case_for_client(cliente_id, case_id)

    estado = clean(case_row.get("estado_caso"))

    if estado not in {"Resuelto", "Cerrado"}:
        raise HTTPException(
            status_code=400,
            detail="La encuesta solo está disponible cuando el caso está resuelto o cerrado."
        )

    rating = int(payload.get("rating") or payload.get("calificacion") or 0)
    comment = clean(payload.get("comment") or payload.get("comentario"))

    if rating < 1 or rating > 5:
        raise HTTPException(
            status_code=400,
            detail="La calificación debe estar entre 1 y 5."
        )

    update_dynamic(
        "casos",
        {
            "calificacion_cliente": rating,
            "comentario_calificacion": comment,
            "fecha_actualizacion": datetime.now(),
        },
        "caso_id = ?",
        (case_row["caso_id"],),
    )

    insert_history(
        case_id=case_row["caso_id"],
        user_id=usuario_id,
        action="Encuesta registrada",
        observation=f"El cliente calificó la atención con {rating} estrella(s).",
        visible=True,
    )

    return {
        "success": True,
        "message": "Encuesta registrada correctamente."
    }


def cliente_share_case_service(current_user: dict, case_id: str, payload: dict):
    cliente_id = get_cliente_id(current_user)
    usuario_id = get_usuario_id(current_user)
    case_row = get_case_for_client(cliente_id, case_id)

    token = uuid4().hex + uuid4().hex[:12]
    expires = datetime.now() + timedelta(days=int(payload.get("dias") or 7))

    if table_exists("enlaces_compartidos_caso"):
        insert_dynamic(
            "enlaces_compartidos_caso",
            {
                "caso_id": case_row["caso_id"],
                "token": token,
                "creado_por_usuario_id": usuario_id,
                "fecha_creacion": datetime.now(),
                "fecha_expiracion": expires,
                "activo": 1,
            },
        )

    return {
        "success": True,
        "message": "Enlace generado correctamente.",
        "token": token,
        "expires": expires,
        "url": f"detalle-caso.html?codigo={case_row.get('codigo_caso')}&share={token}",
    }


# =========================================================
# CONSTANCIA
# =========================================================

def cliente_case_certificate_service(current_user: dict, case_id: str):
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import (
            SimpleDocTemplate,
            Paragraph,
            Spacer,
            Table,
            TableStyle,
        )
        from reportlab.lib.units import cm
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="Falta instalar reportlab. Ejecuta: pip install reportlab"
        )

    cliente_id = get_cliente_id(current_user)
    row = get_case_for_client(cliente_id, case_id)
    cliente = cliente_me_service(current_user)["profile"]

    cliente_nombre = (
        cliente.get("nombre_completo")
        or cliente.get("nombre")
        or cliente.get("razon_social")
        or "Cliente"
    )

    buffer = BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2 * cm,
        leftMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ClaroTitle",
        parent=styles["Title"],
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#D71920"),
        spaceAfter=16,
    )

    subtitle_style = ParagraphStyle(
        "ClaroSubtitle",
        parent=styles["Heading2"],
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#222222"),
        spaceBefore=12,
        spaceAfter=8,
    )

    normal_style = ParagraphStyle(
        "ClaroNormal",
        parent=styles["BodyText"],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#333333"),
    )

    story = []

    story.append(Paragraph("CLARO ATENCIÓN 360", title_style))
    story.append(Paragraph("Constancia de registro y seguimiento de caso", styles["Heading2"]))
    story.append(Spacer(1, 12))

    case_data = [
        ["Código de caso", str(row.get("codigo_caso") or "-")],
        ["Tipo de caso", str(row.get("tipo_caso") or "-")],
        ["Categoría", str(row.get("categoria") or "-")],
        ["Motivo", str(row.get("motivo") or "-")],
        ["Estado actual", str(row.get("estado_caso") or "-")],
        ["Prioridad", str(row.get("prioridad") or "-")],
        ["Servicio", str(row.get("servicio_nombre") or row.get("plan_nombre") or "-")],
        ["Fecha de registro", str(row.get("fecha_registro") or "-")],
        ["SLA", build_sla_text(row)],
    ]

    client_data = [
        ["Cliente", str(cliente_nombre or "-")],
        ["Documento", f"{cliente.get('documento_tipo') or ''} {cliente.get('documento_numero') or ''}".strip()],
        ["Correo", str(cliente.get("correo") or "-")],
        ["Teléfono", str(cliente.get("telefono") or "-")],
    ]

    def build_table(data):
        table = Table(data, colWidths=[5 * cm, 10 * cm])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F3F4F6")),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#111111")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#CCCCCC")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        return table

    story.append(Paragraph("Datos del caso", subtitle_style))
    story.append(build_table(case_data))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Datos del cliente", subtitle_style))
    story.append(build_table(client_data))
    story.append(Spacer(1, 14))

    story.append(Paragraph("Descripción registrada", subtitle_style))
    story.append(Paragraph(str(row.get("descripcion") or "Sin descripción registrada."), normal_style))
    story.append(Spacer(1, 18))

    story.append(Paragraph(
        "Esta constancia fue generada automáticamente desde la plataforma Claro Atención 360. "
        "El documento resume la información registrada en el sistema al momento de la emisión.",
        normal_style,
    ))

    story.append(Spacer(1, 10))

    story.append(Paragraph(
        f"Fecha de emisión: {datetime.now().strftime('%d/%m/%Y %H:%M')}",
        normal_style,
    ))

    doc.build(story)

    pdf = buffer.getvalue()
    buffer.close()

    filename = f"constancia-{row.get('codigo_caso')}.pdf"

    return pdf, filename


# =========================================================
# BÚSQUEDA / ASISTENTE
# =========================================================

def cliente_search_service(current_user: dict, q: str):
    query = clean(q)
    cliente_id = get_cliente_id(current_user)

    if not query:
        return {
            "success": True,
            "items": []
        }

    like = f"%{query}%"

    cases = fetch_all(
        """
        SELECT TOP 5
            codigo_caso,
            titulo,
            descripcion
        FROM casos
        WHERE cliente_id = ?
          AND (
                codigo_caso LIKE ?
                OR titulo LIKE ?
                OR descripcion LIKE ?
          )
        ORDER BY fecha_registro DESC
        """,
        (cliente_id, like, like, like),
    )

    services = fetch_all(
        """
        SELECT TOP 5
            sc.servicio_contratado_id,
            sc.codigo_contrato,
            sc.plan_nombre,
            s.nombre AS servicio_nombre
        FROM servicios_contratados sc
        INNER JOIN servicios s
            ON s.servicio_id = sc.servicio_id
        WHERE sc.cliente_id = ?
          AND (
                sc.codigo_contrato LIKE ?
                OR sc.plan_nombre LIKE ?
                OR s.nombre LIKE ?
          )
        ORDER BY sc.servicio_contratado_id DESC
        """,
        (cliente_id, like, like, like),
    )

    hidden_sql = notification_hidden_condition("n")

    notifications = fetch_all(
        f"""
        SELECT TOP 5
            n.notificacion_id,
            n.titulo,
            n.mensaje
        FROM notificaciones n
        INNER JOIN clientes c
            ON c.usuario_id = n.usuario_id
        WHERE c.cliente_id = ?
          {hidden_sql}
          AND (
                n.titulo LIKE ?
                OR n.mensaje LIKE ?
          )
        ORDER BY n.fecha_generacion DESC
        """,
        (cliente_id, like, like),
    )

    items = []

    for row in cases:
        items.append({
            "icon": "🎫",
            "title": row.get("codigo_caso"),
            "text": row.get("titulo"),
            "href": f"detalle-caso.html?codigo={row.get('codigo_caso')}",
        })

    for row in services:
        items.append({
            "icon": "📡",
            "title": row.get("servicio_nombre"),
            "text": row.get("plan_nombre") or row.get("codigo_contrato"),
            "href": f"servicios-contratados.html?servicio_contratado_id={row.get('servicio_contratado_id')}",
        })

    for row in notifications:
        items.append({
            "icon": "🔔",
            "title": row.get("titulo"),
            "text": row.get("mensaje"),
            "href": "notificaciones.html",
        })

    return {
        "success": True,
        "items": items,
    }


def cliente_assistant_service(current_user: dict, payload: dict):
    page = clean(payload.get("page"))
    prompt = clean(payload.get("prompt") or payload.get("message"))

    cliente_id = get_cliente_id(current_user)

    summary = cliente_cases_summary_service(current_user)
    services = cliente_services_summary_service(current_user)
    notifications = cliente_notifications_summary_service(current_user)

    answer = (
        f"Revisé tu información como cliente. "
        f"Tienes {summary.get('total', 0)} caso(s), "
        f"{summary.get('pendientes_cliente', 0)} pendiente(s) por cliente, "
        f"{services.get('activos', 0)} servicio(s) activo(s) y "
        f"{notifications.get('no_leidas', 0)} notificación(es) no leída(s)."
    )

    if "reclamo" in lower(prompt) and "incidencia" in lower(prompt):
        answer = (
            "Usa reclamo cuando el problema sea por cobros, facturación, atención o condiciones contratadas. "
            "Usa incidencia cuando exista una falla técnica como lentitud, intermitencia, señal o servicio caído."
        )

    elif "evidencia" in lower(prompt):
        answer = (
            "Puedes adjuntar recibos, capturas, fotos, pruebas de velocidad, correos o documentos. "
            "Los formatos permitidos son PDF, PNG, JPG, JPEG, DOC, DOCX, XLS, XLSX y TXT."
        )

    elif "sla" in lower(prompt):
        answer = (
            f"Tienes {summary.get('sla_criticos', 0)} caso(s) con posible alerta SLA. "
            "Prioriza revisar casos pendientes por cliente o vencidos."
        )

    elif "servicio" in lower(prompt):
        answer = (
            f"Tienes {services.get('activos', 0)} servicio(s) activo(s). "
            "Si el problema es técnico, reporta una incidencia desde el servicio afectado."
        )

    elif "notificación" in lower(prompt) or "notificacion" in lower(prompt) or "alerta" in lower(prompt):
        answer = (
            f"Tienes {notifications.get('no_leidas', 0)} notificación(es) no leída(s). "
            "Revisa primero solicitudes del asesor y alertas SLA."
        )

    return {
        "success": True,
        "answer": answer,
        "prompt": prompt,
        "page": page,
        "cliente_id": cliente_id,
    }