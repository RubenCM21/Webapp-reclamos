from datetime import datetime, timedelta
import csv
import io
import html
import re

from fastapi import HTTPException

from app.database import fetch_one, fetch_all, execute, get_connection


# =========================================================
# HELPERS GENERALES
# =========================================================

def clean(value):
    return str(value or "").strip()


def lower_clean(value):
    return clean(value).lower()


def now():
    return datetime.now()


def advisor_name(asesor: dict):
    full = f"{asesor.get('nombres') or ''} {asesor.get('apellidos') or ''}".strip()
    return full or asesor.get("nombre") or asesor.get("username") or asesor.get("correo") or "Asesor"


def advisor_initials(asesor: dict):
    name = advisor_name(asesor)
    initials = "".join([part[0].upper() for part in name.split()[:2] if part])
    return initials or "AS"


def normalize_identifier(case_id: str):
    value = clean(case_id)

    if value.isdigit():
        return int(value), value

    return -1, value


def as_int(value, default=0):
    try:
        return int(value)
    except Exception:
        return default


def format_dt(value):
    if not value:
        return "-"

    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")

    return str(value)


def date_or_none(value):
    if not value:
        return None

    if isinstance(value, datetime):
        return value

    try:
        return datetime.fromisoformat(str(value))
    except Exception:
        return None


def to_bool(value):
    if isinstance(value, bool):
        return value

    if value in [1, "1", "true", "TRUE", "Sí", "SI", "si", "S"]:
        return True

    return False


def safe_fetch_all(sql: str, params=None, fallback=None):
    try:
        return fetch_all(sql, params or ())
    except Exception:
        return fallback or []


def safe_fetch_one(sql: str, params=None, fallback=None):
    try:
        return fetch_one(sql, params or ())
    except Exception:
        return fallback


def safe_execute(sql: str, params=None):
    return execute(sql, params or ())


def response_ok(message: str, **extra):
    return {
        "ok": True,
        "message": message,
        **extra
    }


# =========================================================
# CATÁLOGOS / SELECTS DEL FRONTEND
# =========================================================

def catalog_item(value, label=None, extra=None):
    return {
        "value": clean(value),
        "label": clean(label or value),
        **(extra or {})
    }


def rows_to_catalog(rows, id_key, label_key):
    items = []

    for row in rows or []:
        value = row.get(label_key) or row.get(id_key)
        label = row.get(label_key) or row.get(id_key)

        if value:
            items.append(catalog_item(value, label))

    return items


def safe_table_catalog(table, id_col, name_col, where="activo = 1", order_col=None):
    order = order_col or name_col
    where_sql = f"WHERE {where}" if where else ""

    rows = safe_fetch_all(
        f"""
        SELECT
            {id_col} AS id,
            {name_col} AS nombre
        FROM {table}
        {where_sql}
        ORDER BY {order}
        """
    )

    return rows_to_catalog(rows, "id", "nombre")


def fallback_catalogos():
    return {
        "estadosCaso": [
            catalog_item("Registrado"),
            catalog_item("En atención"),
            catalog_item("Pendiente cliente"),
            catalog_item("Derivado"),
            catalog_item("Listo para cierre"),
            catalog_item("Cerrado")
        ],
        "prioridades": [
            catalog_item("Crítica"),
            catalog_item("Alta"),
            catalog_item("Media"),
            catalog_item("Baja")
        ],
        "tiposCaso": [
            catalog_item("Reclamo"),
            catalog_item("Incidencia"),
            catalog_item("Solicitud"),
            catalog_item("Consulta")
        ],
        "categoriasCaso": [
            catalog_item("Facturación"),
            catalog_item("Servicio móvil"),
            catalog_item("Servicio hogar"),
            catalog_item("Atención comercial"),
            catalog_item("Soporte técnico")
        ],
        "canales": [
            catalog_item("Portal cliente"),
            catalog_item("Correo electrónico"),
            catalog_item("Llamada telefónica"),
            catalog_item("WhatsApp"),
            catalog_item("Presencial")
        ],
        "visibilidades": [
            catalog_item("Visible para cliente"),
            catalog_item("Interno")
        ],
        "plazosRespuesta": [
            catalog_item("24 horas"),
            catalog_item("48 horas"),
            catalog_item("72 horas"),
            catalog_item("5 días hábiles")
        ],
        "areasDerivacion": [
            catalog_item("Soporte técnico"),
            catalog_item("Facturación"),
            catalog_item("Back Office"),
            catalog_item("Retenciones"),
            catalog_item("Supervisión de atención")
        ],
        "categoriasPlantilla": [
            catalog_item("evidencia", "Evidencia"),
            catalog_item("reclamo", "Reclamo"),
            catalog_item("derivacion", "Derivación"),
            catalog_item("cierre", "Cierre"),
            catalog_item("seguimiento", "Seguimiento")
        ],
        "formatosExportacion": [
            catalog_item("pdf", "PDF"),
            catalog_item("word", "Word"),
            catalog_item("excel", "Excel"),
            catalog_item("csv", "CSV"),
            catalog_item("imagen", "Imagen SVG")
        ],
        "variablesPlantilla": [
            {
                "value": "{cliente_nombre}",
                "label": "{cliente_nombre}",
                "description": "Nombre completo o razón social del cliente."
            },
            {
                "value": "{codigo_caso}",
                "label": "{codigo_caso}",
                "description": "Código único del caso."
            },
            {
                "value": "{servicio_afectado}",
                "label": "{servicio_afectado}",
                "description": "Servicio vinculado al caso."
            },
            {
                "value": "{estado_caso}",
                "label": "{estado_caso}",
                "description": "Estado actual del caso."
            },
            {
                "value": "{prioridad}",
                "label": "{prioridad}",
                "description": "Prioridad registrada."
            },
            {
                "value": "{sla}",
                "label": "{sla}",
                "description": "Tiempo SLA restante o estado de vencimiento."
            },
            {
                "value": "{asesor_nombre}",
                "label": "{asesor_nombre}",
                "description": "Nombre del asesor responsable."
            }
        ]
    }


def asesor_catalogos_service(asesor: dict):
    fallback = fallback_catalogos()

    estados = safe_table_catalog(
        table="estados_caso",
        id_col="estado_caso_id",
        name_col="nombre",
        where="activo = 1",
        order_col="estado_caso_id"
    ) or fallback["estadosCaso"]

    prioridades = safe_table_catalog(
        table="prioridades",
        id_col="prioridad_id",
        name_col="nombre",
        where="activo = 1",
        order_col="prioridad_id"
    ) or fallback["prioridades"]

    tipos = safe_table_catalog(
        table="tipos_caso",
        id_col="tipo_caso_id",
        name_col="nombre",
        where="activo = 1",
        order_col="tipo_caso_id"
    ) or fallback["tiposCaso"]

    categorias = safe_table_catalog(
        table="categorias",
        id_col="categoria_id",
        name_col="nombre",
        where="activo = 1",
        order_col="categoria_id"
    ) or fallback["categoriasCaso"]

    canales = safe_table_catalog(
        table="canales_ingreso",
        id_col="canal_ingreso_id",
        name_col="nombre",
        where="activo = 1",
        order_col="canal_ingreso_id"
    ) or fallback["canales"]

    # Las áreas pueden existir como tabla propia o no, por eso se usa fallback.
    areas = (
        safe_table_catalog(
            table="areas",
            id_col="area_id",
            name_col="nombre",
            where="activo = 1",
            order_col="nombre"
        )
        or safe_table_catalog(
            table="areas_derivacion",
            id_col="area_derivacion_id",
            name_col="nombre",
            where="activo = 1",
            order_col="nombre"
        )
        or fallback["areasDerivacion"]
    )

    return {
        "ok": True,
        "catalogos": {
            **fallback,
            "estadosCaso": estados,
            "prioridades": prioridades,
            "tiposCaso": tipos,
            "categoriasCaso": categorias,
            "canales": canales,
            "areasDerivacion": areas,
        },
        # También se envían arriba por compatibilidad con JS que lea directo.
        **{
            **fallback,
            "estadosCaso": estados,
            "prioridades": prioridades,
            "tiposCaso": tipos,
            "categoriasCaso": categorias,
            "canales": canales,
            "areasDerivacion": areas,
        }
    }


# =========================================================
# ESTADOS / PRIORIDADES / SLA
# =========================================================

def get_estado_id(nombre: str):
    requested = clean(nombre)

    aliases = {
        "Nuevo": ["Nuevo", "Registrado", "En atención"],
        "Registrado": ["Registrado", "Nuevo"],
        "En atencion": ["En atención", "En atencion", "Atención", "En proceso"],
        "En atención": ["En atención", "En atencion", "Atención", "En proceso"],
        "Pendiente cliente": ["Pendiente cliente", "Pendiente por cliente"],
        "Pendiente por cliente": ["Pendiente por cliente", "Pendiente cliente"],
        "Listo para cierre": ["Listo para cierre", "En atención", "Resuelto"],
        "Cerrado": ["Cerrado", "Resuelto"],
        "Resuelto": ["Resuelto", "Cerrado"],
        "Derivado": ["Derivado", "Escalado"]
    }

    candidates = aliases.get(requested, [requested])

    for candidate in candidates:
        row = safe_fetch_one(
            """
            SELECT TOP 1 estado_caso_id
            FROM estados_caso
            WHERE nombre = ?
              AND activo = 1
            """,
            (candidate,)
        )

        if row:
            return row["estado_caso_id"]

    fallback = safe_fetch_one(
        """
        SELECT TOP 1 estado_caso_id
        FROM estados_caso
        WHERE activo = 1
        ORDER BY estado_caso_id
        """
    )

    if not fallback:
        raise HTTPException(
            status_code=500,
            detail="No existen estados de caso activos registrados en la base de datos."
        )

    return fallback["estado_caso_id"]


def get_prioridad_id(nombre: str):
    prioridad = clean(nombre)

    row = safe_fetch_one(
        """
        SELECT TOP 1 prioridad_id
        FROM prioridades
        WHERE nombre = ?
          AND activo = 1
        """,
        (prioridad,)
    )

    return row["prioridad_id"] if row else None


def priority_order(priority):
    value = lower_clean(priority)

    if "crítica" in value or "critica" in value:
        return 4

    if "alta" in value:
        return 3

    if "media" in value:
        return 2

    return 1


def normalize_queue_status(status: str):
    value = clean(status)

    if value == "Registrado":
        return "Nuevo"

    if value == "Pendiente por cliente":
        return "Pendiente cliente"

    return value or "Nuevo"


def is_closed_status(status: str):
    value = lower_clean(status)
    return "cerrado" in value or "resuelto" in value


def remaining_hours(deadline):
    if not deadline:
        return 999

    parsed = date_or_none(deadline)

    if not parsed:
        return 999

    diff = parsed - now()
    return int(diff.total_seconds() // 3600)


def sla_group(hours: int):
    if hours <= 0:
        return "vencido"

    if hours <= 8:
        return "hoy"

    if hours <= 24:
        return "mañana"

    return "semana"


def sla_text(status: str, hours: int):
    if is_closed_status(status):
        return "Cerrado"

    if hours <= 0:
        return "SLA vencido"

    if hours == 1:
        return "1h restante"

    if hours >= 999:
        return "Sin plazo"

    return f"{hours}h restantes"


def suggested_action(status: str, hours: int = 999):
    value = lower_clean(status)

    if is_closed_status(status):
        return "Caso finalizado. Revisar constancia si es necesario."

    if hours <= 0:
        return "Registrar seguimiento inmediato por SLA vencido."

    if hours <= 8:
        return "Atender de forma prioritaria por riesgo SLA."

    if "pendiente" in value:
        return "Solicitar o revisar información del cliente."

    if "derivado" in value:
        return "Dar seguimiento al área responsable."

    if "listo" in value:
        return "Validar respuesta final y cerrar."

    return "Revisar información y registrar avance."


def case_icon(tipo_caso: str, prioridad: str):
    tipo = lower_clean(tipo_caso)
    prioridad_value = priority_order(prioridad)

    if prioridad_value == 4:
        return "🔥"

    if "incidencia" in tipo:
        return "⚠️"

    if "solicitud" in tipo:
        return "📩"

    if "consulta" in tipo:
        return "💬"

    return "📝"


# =========================================================
# CONSULTA BASE DE CASOS
# =========================================================

CASE_SELECT_SQL = """
    SELECT
        c.caso_id,
        c.codigo_caso,
        c.cliente_id,
        c.servicio_contratado_id,
        c.titulo,
        c.descripcion,
        c.fecha_registro,
        c.fecha_limite_resolucion,
        c.fecha_actualizacion,
        c.fecha_cierre,
        c.solucion_final,
        c.pendiente_cliente,
        c.responsable_actual_usuario_id,
        tc.nombre AS tipo_caso,
        cat.nombre AS categoria,
        pr.nombre AS prioridad,
        ec.nombre AS estado,
        ci.nombre AS canal,
        s.nombre AS servicio,
        sc.codigo_contrato,
        sc.plan_nombre,
        cli.tipo_cliente,
        cli.nombres,
        cli.apellidos,
        cli.razon_social,
        cli.documento_tipo,
        cli.documento_numero,
        cli.correo AS cliente_correo,
        cli.telefono AS cliente_telefono
    FROM casos c
    INNER JOIN tipos_caso tc ON tc.tipo_caso_id = c.tipo_caso_id
    INNER JOIN categorias cat ON cat.categoria_id = c.categoria_id
    INNER JOIN prioridades pr ON pr.prioridad_id = c.prioridad_id
    INNER JOIN estados_caso ec ON ec.estado_caso_id = c.estado_caso_id
    LEFT JOIN canales_ingreso ci ON ci.canal_ingreso_id = c.canal_ingreso_id
    LEFT JOIN servicios_contratados sc ON sc.servicio_contratado_id = c.servicio_contratado_id
    LEFT JOIN servicios s ON s.servicio_id = sc.servicio_id
    INNER JOIN clientes cli ON cli.cliente_id = c.cliente_id
"""


def get_cliente_nombre(row: dict):
    if row.get("tipo_cliente") == "EMPRESA":
        return row.get("razon_social") or "Cliente empresa"

    return f"{row.get('nombres') or ''} {row.get('apellidos') or ''}".strip() or "Cliente"


def get_cliente_documento(row: dict):
    tipo = clean(row.get("documento_tipo"))
    numero = clean(row.get("documento_numero"))

    if tipo and numero:
        return f"{tipo} {numero}"

    return numero or "-"


def map_case(row: dict):
    status = row.get("estado") or "Registrado"
    priority = row.get("prioridad") or "Media"
    hours = remaining_hours(row.get("fecha_limite_resolucion"))
    cliente = get_cliente_nombre(row)
    servicio = row.get("servicio") or row.get("plan_nombre") or "Servicio asociado"
    code = row.get("codigo_caso") or f"CASO-{row.get('caso_id')}"

    return {
        "id": row["caso_id"],
        "case_id": row["caso_id"],
        "caseId": row["caso_id"],
        "code": code,
        "codigo_caso": code,
        "codigo": code,
        "icon": case_icon(row.get("tipo_caso"), priority),
        "type": row.get("tipo_caso") or "Caso",
        "tipo_caso": row.get("tipo_caso") or "Caso",
        "category": row.get("categoria") or "General",
        "categoria": row.get("categoria") or "General",
        "clientType": row.get("tipo_cliente") or "Cliente",
        "tipo_cliente": row.get("tipo_cliente") or "Cliente",
        "clientName": cliente,
        "cliente_nombre": cliente,
        "cliente": cliente,
        "document": get_cliente_documento(row),
        "documento": row.get("documento_numero") or "-",
        "documento_numero": row.get("documento_numero") or "-",
        "cliente_correo": row.get("cliente_correo"),
        "cliente_telefono": row.get("cliente_telefono"),
        "title": row.get("titulo") or code,
        "titulo": row.get("titulo") or code,
        "description": row.get("descripcion") or "",
        "descripcion": row.get("descripcion") or "",
        "reason": row.get("descripcion") or "",
        "motivo": row.get("descripcion") or "",
        "service": servicio,
        "servicio": servicio,
        "servicio_nombre": servicio,
        "contrato": row.get("codigo_contrato") or "-",
        "plan": row.get("plan_nombre") or "-",
        "channel": row.get("canal") or "Portal cliente",
        "canal": row.get("canal") or "Portal cliente",
        "priority": priority,
        "prioridad": priority,
        "status": status,
        "estado": status,
        "estado_caso": status,
        "queueStatus": normalize_queue_status(status),
        "queue_status": normalize_queue_status(status),
        "estado_cola": normalize_queue_status(status),
        "slaHours": hours,
        "sla_hours": hours,
        "horas_sla": hours,
        "slaText": sla_text(status, hours),
        "sla": sla_text(status, hours),
        "sla_text": sla_text(status, hours),
        "slaGroup": sla_group(hours),
        "sla_group": sla_group(hours),
        "deadline": row.get("fecha_limite_resolucion"),
        "fecha_limite_resolucion": row.get("fecha_limite_resolucion"),
        "createdAt": row.get("fecha_registro"),
        "fecha_registro": row.get("fecha_registro"),
        "created_at": row.get("fecha_registro"),
        "updatedAt": row.get("fecha_actualizacion"),
        "fecha_actualizacion": row.get("fecha_actualizacion"),
        "updated_at": row.get("fecha_actualizacion"),
        "closedAt": row.get("fecha_cierre"),
        "fecha_cierre": row.get("fecha_cierre"),
        "assignedTo": row.get("responsable_actual_usuario_id"),
        "responsable": row.get("responsable_actual_usuario_id"),
        "pendiente_cliente": bool(row.get("pendiente_cliente")),
        "solucion_final": row.get("solucion_final"),
        "action": suggested_action(status, hours),
        "accion": suggested_action(status, hours),
        "proximo_paso": suggested_action(status, hours)
    }


def get_case_for_advisor(asesor: dict, case_id: str):
    numeric_id, code = normalize_identifier(case_id)

    row = fetch_one(
        f"""
        {CASE_SELECT_SQL}
        WHERE (
              c.responsable_actual_usuario_id = ?
              OR c.responsable_actual_usuario_id IS NULL
        )
          AND (
              c.caso_id = ?
              OR c.codigo_caso = ?
          )
        """,
        (
            asesor["usuario_id"],
            numeric_id,
            code
        )
    )

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Caso no encontrado o no asignado al asesor."
        )

    return row


def get_case_cliente_user_id(case_id: int):
    row = safe_fetch_one(
        """
        SELECT cli.usuario_id
        FROM casos c
        INNER JOIN clientes cli ON cli.cliente_id = c.cliente_id
        WHERE c.caso_id = ?
        """,
        (case_id,)
    )

    return row["usuario_id"] if row else None


def insert_history(cursor, case_id, user_id, action, observation, visible=True):
    cursor.execute(
        """
        INSERT INTO historial_caso (
            caso_id,
            usuario_id,
            accion,
            observacion,
            es_visible_cliente,
            fecha_evento
        )
        OUTPUT INSERTED.historial_id
        VALUES (?, ?, ?, ?, ?, SYSDATETIME())
        """,
        (
            case_id,
            user_id,
            clean(action) or "Actualización de caso",
            clean(observation) or "Sin observación registrada.",
            1 if visible else 0
        )
    )

    return cursor.fetchone()[0]


def create_notification(cursor, case_id, user_id, tipo, titulo, mensaje):
    if not user_id:
        return

    cursor.execute(
        """
        INSERT INTO notificaciones (
            caso_id,
            usuario_id,
            tipo,
            canal_envio,
            titulo,
            mensaje,
            leida,
            fecha_generacion,
            estado_envio
        )
        VALUES (?, ?, ?, 'SISTEMA', ?, ?, 0, SYSDATETIME(), 'ENVIADO')
        """,
        (
            case_id,
            user_id,
            clean(tipo) or "CASO",
            clean(titulo) or "Notificación del sistema",
            clean(mensaje) or "Se registró una actualización."
        )
    )


def create_advisor_notification(cursor, case_id, advisor_user_id, tipo, titulo, mensaje):
    create_notification(
        cursor=cursor,
        case_id=case_id,
        user_id=advisor_user_id,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje
    )

# =========================================================
# SHELL / PERFIL
# =========================================================

def asesor_me_service(asesor: dict):
    name = advisor_name(asesor)

    return {
        "ok": True,
        "advisor": {
            "usuario_id": asesor["usuario_id"],
            "personal_id": asesor.get("personal_id"),
            "username": asesor.get("username"),
            "correo": asesor.get("correo"),
            "nombre": name,
            "initials": advisor_initials(asesor),
            "role": asesor.get("cargo") or "Asesor de Atención",
            "cargo": asesor.get("cargo") or "Asesor de Atención",
            "area": asesor.get("area_nombre") or "Atención al Cliente",
            "status": "Disponible",
            "shift": "Turno operativo",
            "last_access": asesor.get("ultimo_acceso")
        }
    }


def asesor_resumen_service(asesor: dict):
    assigned = safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos
        WHERE responsable_actual_usuario_id = ?
          AND fecha_cierre IS NULL
        """,
        (asesor["usuario_id"],),
        {"total": 0}
    )

    unread = safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM notificaciones
        WHERE usuario_id = ?
          AND leida = 0
        """,
        (asesor["usuario_id"],),
        {"total": 0}
    )

    sla_risk = safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos
        WHERE responsable_actual_usuario_id = ?
          AND fecha_cierre IS NULL
          AND fecha_limite_resolucion <= DATEADD(HOUR, 8, SYSDATETIME())
        """,
        (asesor["usuario_id"],),
        {"total": 0}
    )

    return {
        "ok": True,
        "asignados": as_int(assigned.get("total")),
        "no_leidas": as_int(unread.get("total")),
        "riesgo_sla": as_int(sla_risk.get("total")),
    }


# =========================================================
# CASOS / FILTROS
# =========================================================

def build_case_filters(asesor: dict, filters=None):
    filters = filters or {}

    where = [
        """
        (
            c.responsable_actual_usuario_id = ?
            OR c.responsable_actual_usuario_id IS NULL
        )
        """
    ]

    params = [asesor["usuario_id"]]

    q = clean(filters.get("q"))
    estado = clean(filters.get("estado"))
    prioridad = clean(filters.get("prioridad"))
    tipo = clean(filters.get("tipo"))
    sla = clean(filters.get("sla"))

    if q:
        like = f"%{q}%"
        where.append(
            """
            (
                c.codigo_caso LIKE ?
                OR c.titulo LIKE ?
                OR c.descripcion LIKE ?
                OR cli.nombres LIKE ?
                OR cli.apellidos LIKE ?
                OR cli.razon_social LIKE ?
                OR cli.documento_numero LIKE ?
                OR s.nombre LIKE ?
                OR sc.plan_nombre LIKE ?
            )
            """
        )
        params.extend([like, like, like, like, like, like, like, like, like])

    if estado:
        where.append("ec.nombre = ?")
        params.append(estado)

    if prioridad:
        where.append("pr.nombre = ?")
        params.append(prioridad)

    if tipo:
        where.append("tc.nombre = ?")
        params.append(tipo)

    if sla:
        sla_value = lower_clean(sla)

        if sla_value in ["vencido", "vencidos"]:
            where.append("c.fecha_cierre IS NULL AND c.fecha_limite_resolucion < SYSDATETIME()")

        elif sla_value in ["hoy", "riesgo", "sla_riesgo", "critico", "crítico"]:
            where.append(
                """
                c.fecha_cierre IS NULL
                AND c.fecha_limite_resolucion >= SYSDATETIME()
                AND c.fecha_limite_resolucion <= DATEADD(HOUR, 8, SYSDATETIME())
                """
            )

        elif sla_value in ["mañana", "manana"]:
            where.append(
                """
                c.fecha_cierre IS NULL
                AND c.fecha_limite_resolucion > DATEADD(HOUR, 8, SYSDATETIME())
                AND c.fecha_limite_resolucion <= DATEADD(HOUR, 24, SYSDATETIME())
                """
            )

        elif sla_value in ["semana"]:
            where.append(
                """
                c.fecha_cierre IS NULL
                AND c.fecha_limite_resolucion > DATEADD(HOUR, 24, SYSDATETIME())
                """
            )

    return " AND ".join(where), tuple(params)


def asesor_list_cases_service(asesor: dict, filters=None):
    where_sql, params = build_case_filters(asesor, filters)

    rows = fetch_all(
        f"""
        {CASE_SELECT_SQL}
        WHERE {where_sql}
        ORDER BY
            CASE
                WHEN c.fecha_cierre IS NULL
                 AND c.fecha_limite_resolucion < SYSDATETIME()
                THEN 0
                ELSE 1
            END,
            c.fecha_limite_resolucion ASC,
            pr.prioridad_id ASC,
            c.fecha_registro DESC
        """,
        params
    )

    items = [map_case(row) for row in rows]

    return {
        "ok": True,
        "items": items,
        "total": len(items),
        "kpis": build_case_kpis(items),
        "summary": build_queue_summary(items),
    }


def asesor_case_detail_service(asesor: dict, case_id: str):
    case = get_case_for_advisor(asesor, case_id)
    mapped = map_case(case)

    historial = safe_fetch_all(
        """
        SELECT
            hc.historial_id,
            hc.accion,
            hc.observacion,
            hc.es_visible_cliente,
            hc.fecha_evento,
            u.username,
            u.correo
        FROM historial_caso hc
        LEFT JOIN usuarios u ON u.usuario_id = hc.usuario_id
        WHERE hc.caso_id = ?
        ORDER BY hc.fecha_evento DESC
        """,
        (case["caso_id"],)
    )

    evidencias = safe_fetch_all(
        """
        SELECT
            evidencia_id,
            nombre_archivo,
            ruta_archivo,
            tipo_mime,
            tamano_bytes,
            descripcion,
            fecha_carga
        FROM evidencias
        WHERE caso_id = ?
        ORDER BY fecha_carga DESC
        """,
        (case["caso_id"],)
    )

    history = [
        {
            "id": row.get("historial_id"),
            "icon": "🕘",
            "title": row.get("accion") or "Evento registrado",
            "text": row.get("observacion") or "Sin observación.",
            "date": row.get("fecha_evento"),
            "user": row.get("username") or row.get("correo") or "Sistema",
            "visible_cliente": bool(row.get("es_visible_cliente"))
        }
        for row in historial
    ]

    evidence = [
        {
            "id": row.get("evidencia_id"),
            "icon": "📎",
            "name": row.get("nombre_archivo") or "Evidencia",
            "title": row.get("nombre_archivo") or "Evidencia",
            "detail": row.get("descripcion") or row.get("tipo_mime") or "Evidencia registrada",
            "description": row.get("descripcion") or "Evidencia registrada",
            "date": row.get("fecha_carga"),
            "size": row.get("tamano_bytes"),
            "url": row.get("ruta_archivo")
        }
        for row in evidencias
    ]

    checklist = build_case_checklist(mapped, history, evidence)

    return {
        "ok": True,
        "case": {
            **mapped,
            "customer": {
                "name": mapped["clientName"],
                "document": mapped["document"],
                "email": mapped.get("cliente_correo"),
                "phone": mapped.get("cliente_telefono"),
                "type": mapped.get("clientType")
            },
            "history": history,
            "historial": history,
            "evidence": evidence,
            "evidencias": evidence,
            "checklist": checklist,
            "sla_alerts": build_case_sla_alerts(mapped),
            "ai_summary": build_case_ai_summary(mapped, history, evidence),
        }
    }


def build_case_checklist(case: dict, history: list, evidence: list):
    has_evidence = len(evidence) > 0
    has_history = len(history) > 0
    has_solution = bool(clean(case.get("solucion_final")))
    is_closed = is_closed_status(case.get("status"))

    return [
        {
            "icon": "📎" if has_evidence else "⚠️",
            "title": "Evidencia registrada" if has_evidence else "Evidencia pendiente",
            "text": "El caso cuenta con sustento adjunto." if has_evidence else "Revisar si se debe solicitar evidencia adicional."
        },
        {
            "icon": "🕘" if has_history else "⚠️",
            "title": "Historial trazable" if has_history else "Sin trazabilidad suficiente",
            "text": "Existen eventos registrados para seguimiento." if has_history else "Registrar un avance antes de derivar o cerrar."
        },
        {
            "icon": "✅" if has_solution or is_closed else "📝",
            "title": "Respuesta final" if has_solution or is_closed else "Respuesta en preparación",
            "text": "Existe respuesta final registrada." if has_solution or is_closed else "Preparar respuesta final antes del cierre."
        }
    ]


def build_case_sla_alerts(case: dict):
    hours = as_int(case.get("slaHours"), 999)

    if is_closed_status(case.get("status")):
        return [
            {
                "icon": "✅",
                "title": "Caso cerrado",
                "text": "El SLA ya no requiere seguimiento activo.",
                "type": "success"
            }
        ]

    if hours <= 0:
        return [
            {
                "icon": "🚨",
                "title": "SLA vencido",
                "text": "Registrar seguimiento y atención prioritaria.",
                "type": "danger"
            }
        ]

    if hours <= 8:
        return [
            {
                "icon": "⏱️",
                "title": "Riesgo SLA alto",
                "text": f"Quedan {hours}h para el vencimiento.",
                "type": "warning"
            }
        ]

    return [
        {
            "icon": "✅",
            "title": "SLA controlado",
            "text": case.get("slaText") or "Dentro del plazo.",
            "type": "success"
        }
    ]


def build_case_ai_summary(case: dict, history: list, evidence: list):
    return [
        {
            "title": "Estado actual",
            "text": f"El caso {case.get('code')} está en estado {case.get('status')} con prioridad {case.get('priority')}."
        },
        {
            "title": "Riesgo SLA",
            "text": case.get("slaText") or "Sin información SLA."
        },
        {
            "title": "Siguiente acción",
            "text": case.get("action") or "Registrar avance operativo."
        },
        {
            "title": "Sustento",
            "text": f"El caso tiene {len(evidence)} evidencia(s) y {len(history)} evento(s) de historial."
        }
    ]


# =========================================================
# ACCIONES DE CASO
# =========================================================

def asesor_update_case_service(asesor: dict, case_id: str, payload: dict):
    case = get_case_for_advisor(asesor, case_id)

    estado = clean(
        payload.get("estado")
        or payload.get("status")
        or payload.get("nuevo_estado")
    )

    visibilidad = clean(
        payload.get("visibilidad")
        or payload.get("visibility")
        or "Interno"
    )

    resumen = clean(
        payload.get("resumen")
        or payload.get("summary")
        or payload.get("titulo")
    )

    detalle = clean(
        payload.get("detalle")
        or payload.get("detail")
        or payload.get("comentario")
        or payload.get("observacion")
    )

    if not estado:
        raise HTTPException(status_code=400, detail="Debes seleccionar un estado.")

    if not detalle:
        raise HTTPException(status_code=400, detail="Debes ingresar el detalle de atención.")

    estado_id = get_estado_id(estado)
    visible = lower_clean(visibilidad).startswith("visible")

    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE casos
            SET estado_caso_id = ?,
                responsable_actual_usuario_id = ?,
                pendiente_cliente = ?,
                fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
            """,
            (
                estado_id,
                asesor["usuario_id"],
                1 if "pendiente" in lower_clean(estado) else 0,
                case["caso_id"]
            )
        )

        insert_history(
            cursor=cursor,
            case_id=case["caso_id"],
            user_id=asesor["usuario_id"],
            action=resumen or f"Actualización a {estado}",
            observation=detalle,
            visible=visible
        )

        cliente_user_id = get_case_cliente_user_id(case["caso_id"])

        if visible and cliente_user_id:
            create_notification(
                cursor=cursor,
                case_id=case["caso_id"],
                user_id=cliente_user_id,
                tipo="CASO",
                titulo="Actualización de tu caso",
                mensaje=f"Tu caso {case['codigo_caso']} fue actualizado: {resumen or estado}."
            )

        conn.commit()

        return response_ok(
            "Caso actualizado correctamente.",
            case_id=case["caso_id"],
            codigo_caso=case["codigo_caso"]
        )

    except HTTPException:
        conn.rollback()
        raise

    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo actualizar el caso: {str(exc)}"
        )

    finally:
        conn.close()


def asesor_request_info_service(asesor: dict, case_id: str, payload: dict):
    case = get_case_for_advisor(asesor, case_id)

    canal = clean(payload.get("canal") or payload.get("channel"))
    plazo = clean(payload.get("plazo") or payload.get("deadline"))
    asunto = clean(payload.get("asunto") or payload.get("subject")) or "Solicitud de información adicional"
    mensaje = clean(payload.get("mensaje") or payload.get("message"))

    if not canal or not plazo or not mensaje:
        raise HTTPException(status_code=400, detail="Completa canal, plazo y mensaje.")

    estado_id = get_estado_id("Pendiente por cliente")
    cliente_user_id = get_case_cliente_user_id(case["caso_id"])

    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE casos
            SET estado_caso_id = ?,
                pendiente_cliente = 1,
                responsable_actual_usuario_id = ?,
                fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
            """,
            (
                estado_id,
                asesor["usuario_id"],
                case["caso_id"]
            )
        )

        insert_history(
            cursor=cursor,
            case_id=case["caso_id"],
            user_id=asesor["usuario_id"],
            action=asunto,
            observation=f"{mensaje}\n\nCanal: {canal}. Plazo: {plazo}.",
            visible=True
        )

        if cliente_user_id:
            create_notification(
                cursor=cursor,
                case_id=case["caso_id"],
                user_id=cliente_user_id,
                tipo="SOLICITUD",
                titulo=asunto,
                mensaje=mensaje
            )

        create_advisor_notification(
            cursor=cursor,
            case_id=case["caso_id"],
            advisor_user_id=asesor["usuario_id"],
            tipo="SOLICITUD",
            titulo="Solicitud registrada",
            mensaje=f"Se solicitó información al cliente para el caso {case['codigo_caso']}."
        )

        conn.commit()

        return response_ok(
            "Solicitud registrada correctamente.",
            case_id=case["caso_id"],
            codigo_caso=case["codigo_caso"]
        )

    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo registrar la solicitud: {str(exc)}"
        )

    finally:
        conn.close()


def asesor_derive_case_service(asesor: dict, case_id: str, payload: dict):
    case = get_case_for_advisor(asesor, case_id)

    area = clean(payload.get("area") or payload.get("area_destino"))
    prioridad = clean(payload.get("prioridad") or payload.get("priority"))
    motivo = clean(payload.get("motivo") or payload.get("reason") or payload.get("detalle"))

    if not area or not prioridad or not motivo:
        raise HTTPException(status_code=400, detail="Completa área, prioridad y motivo.")

    estado_id = get_estado_id("Derivado")
    prioridad_id = get_prioridad_id(prioridad)

    conn = get_connection()

    try:
        cursor = conn.cursor()

        if prioridad_id:
            cursor.execute(
                """
                UPDATE casos
                SET estado_caso_id = ?,
                    prioridad_id = ?,
                    responsable_actual_usuario_id = ?,
                    fecha_actualizacion = SYSDATETIME()
                WHERE caso_id = ?
                """,
                (
                    estado_id,
                    prioridad_id,
                    asesor["usuario_id"],
                    case["caso_id"]
                )
            )
        else:
            cursor.execute(
                """
                UPDATE casos
                SET estado_caso_id = ?,
                    responsable_actual_usuario_id = ?,
                    fecha_actualizacion = SYSDATETIME()
                WHERE caso_id = ?
                """,
                (
                    estado_id,
                    asesor["usuario_id"],
                    case["caso_id"]
                )
            )

        insert_history(
            cursor=cursor,
            case_id=case["caso_id"],
            user_id=asesor["usuario_id"],
            action=f"Derivación a {area}",
            observation=f"Prioridad: {prioridad}. Motivo: {motivo}",
            visible=True
        )

        create_advisor_notification(
            cursor=cursor,
            case_id=case["caso_id"],
            advisor_user_id=asesor["usuario_id"],
            tipo="DERIVACION",
            titulo="Caso derivado",
            mensaje=f"El caso {case['codigo_caso']} fue derivado a {area}."
        )

        conn.commit()

        return response_ok(
            "Caso derivado correctamente.",
            case_id=case["caso_id"],
            codigo_caso=case["codigo_caso"]
        )

    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo derivar el caso: {str(exc)}"
        )

    finally:
        conn.close()


def asesor_close_case_service(asesor: dict, case_id: str, payload: dict):
    case = get_case_for_advisor(asesor, case_id)

    respuesta = clean(
        payload.get("respuesta_final")
        or payload.get("respuesta")
        or payload.get("response")
        or payload.get("mensaje")
    )

    if not respuesta:
        raise HTTPException(status_code=400, detail="Ingresa la respuesta final.")

    if len(respuesta) < 30:
        raise HTTPException(
            status_code=400,
            detail="La respuesta final es muy corta. Agrega conclusión, sustento y resultado."
        )

    estado_id = get_estado_id("Cerrado")
    cliente_user_id = get_case_cliente_user_id(case["caso_id"])

    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE casos
            SET estado_caso_id = ?,
                solucion_final = ?,
                fecha_cierre = SYSDATETIME(),
                responsable_actual_usuario_id = ?,
                pendiente_cliente = 0,
                fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
            """,
            (
                estado_id,
                respuesta,
                asesor["usuario_id"],
                case["caso_id"]
            )
        )

        insert_history(
            cursor=cursor,
            case_id=case["caso_id"],
            user_id=asesor["usuario_id"],
            action="Cierre de caso",
            observation=respuesta,
            visible=True
        )

        if cliente_user_id:
            create_notification(
                cursor=cursor,
                case_id=case["caso_id"],
                user_id=cliente_user_id,
                tipo="CASO",
                titulo="Caso cerrado",
                mensaje=f"Tu caso {case['codigo_caso']} fue cerrado con respuesta final."
            )

        create_advisor_notification(
            cursor=cursor,
            case_id=case["caso_id"],
            advisor_user_id=asesor["usuario_id"],
            tipo="CASO",
            titulo="Cierre registrado",
            mensaje=f"Se cerró correctamente el caso {case['codigo_caso']}."
        )

        conn.commit()

        return response_ok(
            "Caso cerrado correctamente.",
            case_id=case["caso_id"],
            codigo_caso=case["codigo_caso"]
        )

    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo cerrar el caso: {str(exc)}"
        )

    finally:
        conn.close()


def asesor_sla_reminder_service(asesor: dict, case_id: str, payload: dict):
    case = get_case_for_advisor(asesor, case_id)

    canal = clean(payload.get("canal") or payload.get("channel"))
    plazo = clean(payload.get("plazo") or payload.get("deadline"))
    mensaje = clean(payload.get("mensaje") or payload.get("message"))

    if not canal or not plazo or not mensaje:
        raise HTTPException(status_code=400, detail="Completa canal, plazo y mensaje.")

    cliente_user_id = get_case_cliente_user_id(case["caso_id"])

    conn = get_connection()

    try:
        cursor = conn.cursor()

        insert_history(
            cursor=cursor,
            case_id=case["caso_id"],
            user_id=asesor["usuario_id"],
            action="Recordatorio SLA enviado",
            observation=f"{mensaje}\n\nCanal: {canal}. Plazo: {plazo}.",
            visible=True
        )

        cursor.execute(
            """
            UPDATE casos
            SET fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
            """,
            (case["caso_id"],)
        )

        if cliente_user_id:
            create_notification(
                cursor=cursor,
                case_id=case["caso_id"],
                user_id=cliente_user_id,
                tipo="SLA",
                titulo="Recordatorio de información pendiente",
                mensaje=mensaje
            )

        create_advisor_notification(
            cursor=cursor,
            case_id=case["caso_id"],
            advisor_user_id=asesor["usuario_id"],
            tipo="SLA",
            titulo="Recordatorio SLA registrado",
            mensaje=f"Se registró recordatorio SLA para el caso {case['codigo_caso']}."
        )

        conn.commit()

        return response_ok(
            "Recordatorio SLA registrado correctamente.",
            case_id=case["caso_id"],
            codigo_caso=case["codigo_caso"]
        )

    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo enviar recordatorio: {str(exc)}"
        )

    finally:
        conn.close()


def asesor_sla_follow_service(asesor: dict, case_id: str, payload: dict):
    case = get_case_for_advisor(asesor, case_id)

    detalle = clean(
        payload.get("detalle")
        or payload.get("seguimiento")
        or payload.get("mensaje")
        or payload.get("text")
    )

    if not detalle:
        raise HTTPException(status_code=400, detail="Ingresa el seguimiento SLA.")

    conn = get_connection()

    try:
        cursor = conn.cursor()

        insert_history(
            cursor=cursor,
            case_id=case["caso_id"],
            user_id=asesor["usuario_id"],
            action="Seguimiento SLA",
            observation=detalle,
            visible=False
        )

        cursor.execute(
            """
            UPDATE casos
            SET fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
            """,
            (case["caso_id"],)
        )

        create_advisor_notification(
            cursor=cursor,
            case_id=case["caso_id"],
            advisor_user_id=asesor["usuario_id"],
            tipo="SLA",
            titulo="Seguimiento SLA registrado",
            mensaje=f"Se registró seguimiento interno para el caso {case['codigo_caso']}."
        )

        conn.commit()

        return response_ok(
            "Seguimiento SLA registrado correctamente.",
            case_id=case["caso_id"],
            codigo_caso=case["codigo_caso"]
        )

    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo registrar seguimiento SLA: {str(exc)}"
        )

    finally:
        conn.close()

# =========================================================
# DASHBOARD / KPIS / COLA
# =========================================================

def build_case_kpis(cases):
    total = len(cases)
    critical = len([c for c in cases if priority_order(c.get("priority")) == 4])
    sla_risk = len([
        c for c in cases
        if not is_closed_status(c.get("status")) and as_int(c.get("slaHours"), 999) <= 8
    ])
    vencidos = len([
        c for c in cases
        if not is_closed_status(c.get("status")) and as_int(c.get("slaHours"), 999) <= 0
    ])
    close_ready = len([
        c for c in cases
        if "listo" in lower_clean(c.get("status")) or "resuelto" in lower_clean(c.get("status"))
    ])

    return [
        {
            "icon": "📥",
            "value": total,
            "label": "Casos asignados",
            "description": "Carga activa del asesor"
        },
        {
            "icon": "🔥",
            "value": critical,
            "label": "Críticos",
            "description": "Mayor prioridad operativa"
        },
        {
            "icon": "⏱️",
            "value": sla_risk,
            "label": "Riesgo SLA",
            "description": "Vencen en 8 horas o menos"
        },
        {
            "icon": "🚨",
            "value": vencidos,
            "label": "SLA vencido",
            "description": "Requieren regularización"
        },
        {
            "icon": "✅",
            "value": close_ready,
            "label": "Listos cierre",
            "description": "Pendientes de validación final"
        }
    ]


def build_queue_summary(cases):
    groups = {
        "Nuevo": 0,
        "En atención": 0,
        "Pendiente cliente": 0,
        "Derivado": 0,
        "Listo para cierre": 0,
        "Cerrado": 0
    }

    for case in cases:
        status = clean(case.get("queueStatus") or case.get("estado_cola") or case.get("status"))

        if is_closed_status(status):
            groups["Cerrado"] += 1
        elif "pendiente" in lower_clean(status):
            groups["Pendiente cliente"] += 1
        elif "derivado" in lower_clean(status):
            groups["Derivado"] += 1
        elif "listo" in lower_clean(status) or "resuelto" in lower_clean(status):
            groups["Listo para cierre"] += 1
        elif "registrado" in lower_clean(status) or "nuevo" in lower_clean(status):
            groups["Nuevo"] += 1
        else:
            groups["En atención"] += 1

    return {
        "total": len(cases),
        "groups": groups,
        "risk": len([
            c for c in cases
            if not is_closed_status(c.get("status")) and as_int(c.get("slaHours"), 999) <= 8
        ]),
        "critical": len([c for c in cases if priority_order(c.get("priority")) == 4])
    }


def recent_activity_for_advisor(asesor: dict, limit=8):
    rows = safe_fetch_all(
        f"""
        SELECT TOP {int(limit)}
            hc.accion,
            hc.observacion,
            hc.fecha_evento,
            hc.es_visible_cliente,
            c.codigo_caso
        FROM historial_caso hc
        INNER JOIN casos c ON c.caso_id = hc.caso_id
        WHERE c.responsable_actual_usuario_id = ?
        ORDER BY hc.fecha_evento DESC
        """,
        (asesor["usuario_id"],)
    )

    return [
        {
            "icon": "🕘",
            "title": f"{row.get('accion') or 'Evento'} · {row.get('codigo_caso') or '-'}",
            "text": row.get("observacion") or "Sin observación registrada.",
            "date": row.get("fecha_evento"),
            "visible_cliente": bool(row.get("es_visible_cliente"))
        }
        for row in rows
    ]


def build_dashboard_ai_summary(cases):
    total = len(cases)
    risk = [c for c in cases if not is_closed_status(c.get("status")) and as_int(c.get("slaHours"), 999) <= 8]
    vencidos = [c for c in cases if not is_closed_status(c.get("status")) and as_int(c.get("slaHours"), 999) <= 0]
    pending = [c for c in cases if "pendiente" in lower_clean(c.get("status"))]
    close_ready = [c for c in cases if "listo" in lower_clean(c.get("status")) or "resuelto" in lower_clean(c.get("status"))]

    if vencidos:
        recommendation = "Regulariza primero los casos con SLA vencido y registra seguimiento interno."
    elif risk:
        recommendation = "Atiende primero los casos con vencimiento menor a 8 horas."
    elif close_ready:
        recommendation = "Valida respuesta final y cierra los casos listos."
    elif pending:
        recommendation = "Haz seguimiento a los clientes con evidencia pendiente."
    else:
        recommendation = "La carga se encuentra controlada. Mantén actualización de historial."

    return [
        {
            "title": "Carga asignada",
            "text": f"Tienes {total} caso(s) visibles en tu bandeja de trabajo."
        },
        {
            "title": "Riesgo SLA",
            "text": f"{len(risk)} caso(s) requieren atención prioritaria por vencimiento cercano."
        },
        {
            "title": "Pendientes por cliente",
            "text": f"{len(pending)} caso(s) dependen de información o evidencia del cliente."
        },
        {
            "title": "Recomendación operativa",
            "text": recommendation
        }
    ]


def asesor_dashboard_service(asesor: dict):
    cases_response = asesor_list_cases_service(asesor, {})
    cases = cases_response["items"]

    priority_cases = sorted(
        cases,
        key=lambda item: (
            as_int(item.get("slaHours"), 999),
            -priority_order(item.get("priority"))
        )
    )[:8]

    sla_alerts = [
        case for case in cases
        if not is_closed_status(case.get("status")) and as_int(case.get("slaHours"), 999) <= 24
    ]

    return {
        "ok": True,
        "advisor": asesor_me_service(asesor)["advisor"],
        "kpis": build_case_kpis(cases),
        "priority_cases": priority_cases,
        "priorityCases": priority_cases,
        "activity": recent_activity_for_advisor(asesor),
        "recent_activity": recent_activity_for_advisor(asesor),
        "sla_alerts": sla_alerts,
        "slaAlerts": sla_alerts,
        "queue": cases,
        "cases": cases,
        "summary": build_queue_summary(cases),
        "ai_summary": build_dashboard_ai_summary(cases),
        "aiSummary": build_dashboard_ai_summary(cases),
    }


# =========================================================
# PLANTILLAS
# =========================================================

def template_icon(category):
    value = lower_clean(category)

    if value == "evidencia":
        return "📩"

    if value == "reclamo":
        return "📝"

    if value == "derivacion" or value == "derivación":
        return "🔀"

    if value == "cierre":
        return "✅"

    if value == "seguimiento":
        return "🕘"

    return "💬"


def template_category_label(category):
    value = lower_clean(category)

    labels = {
        "evidencia": "Evidencia",
        "reclamo": "Reclamo",
        "derivacion": "Derivación",
        "derivación": "Derivación",
        "cierre": "Cierre",
        "seguimiento": "Seguimiento"
    }

    return labels.get(value, clean(category) or "General")


def map_template(row: dict):
    category = row.get("categoria") or "General"

    return {
        "id": row.get("plantilla_id"),
        "plantilla_id": row.get("plantilla_id"),
        "icon": template_icon(category),
        "category": lower_clean(category) or "general",
        "categoria": row.get("categoria") or "General",
        "categoryLabel": template_category_label(category),
        "title": row.get("nombre") or "Plantilla",
        "nombre": row.get("nombre") or "Plantilla",
        "channel": row.get("canal") or "Portal cliente",
        "canal": row.get("canal") or "Portal cliente",
        "description": row.get("descripcion") or "Plantilla de respuesta operativa.",
        "descripcion": row.get("descripcion") or "Plantilla de respuesta operativa.",
        "body": row.get("contenido") or "",
        "contenido": row.get("contenido") or "",
        "active": bool(row.get("activo", True)),
        "fecha_creacion": row.get("fecha_creacion"),
    }


def get_template_by_id(template_id: int):
    row = fetch_one(
        """
        SELECT
            plantilla_id,
            nombre,
            categoria,
            canal,
            descripcion,
            contenido,
            activo,
            fecha_creacion
        FROM plantillas_respuesta
        WHERE plantilla_id = ?
          AND activo = 1
        """,
        (template_id,)
    )

    if not row:
        raise HTTPException(status_code=404, detail="Plantilla no encontrada o inactiva.")

    return row


def asesor_templates_service(asesor: dict):
    rows = safe_fetch_all(
        """
        SELECT
            plantilla_id,
            nombre,
            categoria,
            canal,
            descripcion,
            contenido,
            activo,
            fecha_creacion
        FROM plantillas_respuesta
        WHERE activo = 1
        ORDER BY categoria, nombre
        """
    )

    items = [map_template(row) for row in rows]

    category_counts = {}

    for item in items:
        key = item["category"]
        category_counts[key] = category_counts.get(key, 0) + 1

    return {
        "ok": True,
        "items": items,
        "total": len(items),
        "kpis": [
            {
                "icon": "💬",
                "value": len(items),
                "label": "Plantillas activas",
                "description": "Disponibles para el asesor"
            },
            {
                "icon": "📩",
                "value": category_counts.get("evidencia", 0),
                "label": "Evidencia",
                "description": "Solicitudes al cliente"
            },
            {
                "icon": "✅",
                "value": category_counts.get("cierre", 0),
                "label": "Cierre",
                "description": "Respuestas finales"
            },
            {
                "icon": "🔀",
                "value": category_counts.get("derivacion", 0) + category_counts.get("derivación", 0),
                "label": "Derivación",
                "description": "Escalamiento interno"
            }
        ],
        "ai_summary": [
            {
                "title": "Uso recomendado",
                "text": "Selecciona una plantilla, vincúlala a un caso real y valida el mensaje antes de enviarlo."
            },
            {
                "title": "Variables",
                "text": "Puedes usar {cliente_nombre}, {codigo_caso}, {servicio_afectado}, {estado_caso}, {sla} y {asesor_nombre}."
            }
        ],
        "variables": fallback_catalogos()["variablesPlantilla"]
    }


def asesor_create_template_service(asesor: dict, payload: dict):
    nombre = clean(
        payload.get("nombre")
        or payload.get("name")
        or payload.get("title")
    )

    categoria = clean(
        payload.get("categoria")
        or payload.get("category")
    )

    contenido = clean(
        payload.get("contenido")
        or payload.get("body")
        or payload.get("mensaje")
    )

    canal = clean(
        payload.get("canal")
        or payload.get("channel")
        or "Portal cliente"
    )

    descripcion = clean(
        payload.get("descripcion")
        or payload.get("description")
        or f"Plantilla creada por {advisor_name(asesor)}"
    )

    if not nombre or not categoria or not contenido:
        raise HTTPException(status_code=400, detail="Completa nombre, categoría y contenido.")

    execute(
        """
        INSERT INTO plantillas_respuesta (
            nombre,
            categoria,
            canal,
            descripcion,
            contenido,
            creado_por_usuario_id,
            activo,
            fecha_creacion
        )
        VALUES (?, ?, ?, ?, ?, ?, 1, SYSDATETIME())
        """,
        (
            nombre,
            categoria,
            canal,
            descripcion,
            contenido,
            asesor["usuario_id"]
        )
    )

    return response_ok("Plantilla registrada correctamente.")


def template_variables_from_case(case: dict, asesor: dict):
    return {
        "{cliente_nombre}": case.get("clientName") or "cliente",
        "{codigo_caso}": case.get("code") or "-",
        "{servicio_afectado}": case.get("service") or "servicio",
        "{estado_caso}": case.get("status") or "estado actual",
        "{prioridad}": case.get("priority") or "prioridad",
        "{sla}": case.get("slaText") or "SLA",
        "{asesor_nombre}": advisor_name(asesor),
        "{canal}": case.get("channel") or "Portal cliente",
        "{fecha_actual}": now().strftime("%d/%m/%Y"),
        "{descripcion_caso}": case.get("description") or ""
    }


def replace_template_variables(content: str, case: dict, asesor: dict):
    result = clean(content)
    variables = template_variables_from_case(case, asesor)

    for key, value in variables.items():
        result = result.replace(key, clean(value))

    return result


def asesor_template_render_service(asesor: dict, template_id: int, payload: dict):
    template = map_template(get_template_by_id(template_id))

    codigo_caso = clean(
        payload.get("codigo_caso")
        or payload.get("case_code")
        or payload.get("caseId")
        or payload.get("case_id")
    )

    if not codigo_caso:
        raise HTTPException(status_code=400, detail="Debes seleccionar un caso para renderizar la plantilla.")

    case_row = get_case_for_advisor(asesor, codigo_caso)
    case = map_case(case_row)

    message = replace_template_variables(template["body"], case, asesor)

    return {
        "ok": True,
        "template": template,
        "case": case,
        "message": message,
        "mensaje": message,
        "rendered": message,
        "subject": f"{template['title']} - {case['code']}",
        "asunto": f"{template['title']} - {case['code']}"
    }


def asesor_use_template_service(asesor: dict, template_id: int, payload: dict):
    template = map_template(get_template_by_id(template_id))

    codigo_caso = clean(
        payload.get("codigo_caso")
        or payload.get("case_code")
        or payload.get("caseId")
        or payload.get("case_id")
    )

    canal = clean(
        payload.get("canal")
        or payload.get("channel")
        or template.get("channel")
        or "Portal cliente"
    )

    mensaje_payload = clean(
        payload.get("mensaje")
        or payload.get("message")
        or payload.get("contenido")
    )

    if not codigo_caso:
        raise HTTPException(status_code=400, detail="Debes seleccionar un caso.")

    if not canal:
        raise HTTPException(status_code=400, detail="Debes seleccionar un canal.")

    case_row = get_case_for_advisor(asesor, codigo_caso)
    case = map_case(case_row)

    mensaje = mensaje_payload or replace_template_variables(template["body"], case, asesor)

    if not mensaje:
        raise HTTPException(status_code=400, detail="La plantilla no contiene mensaje.")

    cliente_user_id = get_case_cliente_user_id(case["id"])

    conn = get_connection()

    try:
        cursor = conn.cursor()

        insert_history(
            cursor=cursor,
            case_id=case["id"],
            user_id=asesor["usuario_id"],
            action=f"Mensaje enviado con plantilla: {template['title']}",
            observation=f"Canal: {canal}. Mensaje: {mensaje}",
            visible=True
        )

        cursor.execute(
            """
            UPDATE casos
            SET fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
            """,
            (case["id"],)
        )

        if cliente_user_id:
            create_notification(
                cursor=cursor,
                case_id=case["id"],
                user_id=cliente_user_id,
                tipo="CASO",
                titulo=template["title"],
                mensaje=mensaje
            )

        create_advisor_notification(
            cursor=cursor,
            case_id=case["id"],
            advisor_user_id=asesor["usuario_id"],
            tipo="CASO",
            titulo="Plantilla enviada",
            mensaje=f"Se envió una plantilla al cliente para el caso {case['code']}."
        )

        conn.commit()

        return response_ok(
            "Mensaje enviado correctamente.",
            case_id=case["id"],
            codigo_caso=case["code"]
        )

    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"No se pudo usar la plantilla: {str(exc)}")

    finally:
        conn.close()


def asesor_send_template_service(asesor: dict, payload: dict):
    """
    Alias compatible con el endpoint antiguo:
    POST /asesor/plantillas/enviar

    Puede recibir:
    - codigo_caso
    - canal
    - mensaje
    - plantilla_id opcional
    """
    template_id = payload.get("plantilla_id") or payload.get("template_id")

    if template_id:
        return asesor_use_template_service(asesor, int(template_id), payload)

    codigo_caso = clean(
        payload.get("codigo_caso")
        or payload.get("case_code")
        or payload.get("caseId")
        or payload.get("case_id")
    )

    canal = clean(payload.get("canal") or payload.get("channel"))
    mensaje = clean(payload.get("mensaje") or payload.get("message"))

    if not codigo_caso or not canal or not mensaje:
        raise HTTPException(status_code=400, detail="Completa código de caso, canal y mensaje.")

    case_row = get_case_for_advisor(asesor, codigo_caso)
    case = map_case(case_row)
    cliente_user_id = get_case_cliente_user_id(case["id"])

    conn = get_connection()

    try:
        cursor = conn.cursor()

        insert_history(
            cursor=cursor,
            case_id=case["id"],
            user_id=asesor["usuario_id"],
            action="Mensaje enviado con plantilla",
            observation=f"Canal: {canal}. Mensaje: {mensaje}",
            visible=True
        )

        cursor.execute(
            """
            UPDATE casos
            SET fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
            """,
            (case["id"],)
        )

        if cliente_user_id:
            create_notification(
                cursor=cursor,
                case_id=case["id"],
                user_id=cliente_user_id,
                tipo="CASO",
                titulo="Mensaje del asesor",
                mensaje=mensaje
            )

        conn.commit()

        return response_ok(
            "Mensaje enviado correctamente.",
            case_id=case["id"],
            codigo_caso=case["code"]
        )

    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"No se pudo enviar la plantilla: {str(exc)}")

    finally:
        conn.close()

# =========================================================
# NOTIFICACIONES
# =========================================================

def notification_icon(tipo):
    value = clean(tipo).upper()

    if value == "SLA":
        return "⏱️"

    if value == "SOLICITUD":
        return "📩"

    if value == "ASIGNACION":
        return "📥"

    if value == "DERIVACION":
        return "🔀"

    if value == "CASO":
        return "🧾"

    return "🔔"


def notification_priority(tipo, mensaje=""):
    value = clean(tipo).upper()
    msg = lower_clean(mensaje)

    if value == "SLA" or "venc" in msg or "urgente" in msg:
        return "critica"

    if value in ["SOLICITUD", "ASIGNACION", "DERIVACION"]:
        return "alta"

    return "media"


def notification_type_filter(tipo):
    value = lower_clean(tipo)

    if value == "sla":
        return "sla"

    if value == "solicitud":
        return "cliente"

    if value == "asignacion":
        return "asignacion"

    if value == "derivacion":
        return "derivacion"

    if value == "caso":
        return "caso"

    return value or "general"


def asesor_notifications_service(asesor: dict, filters=None):
    filters = filters or {}

    where = [
        "n.usuario_id = ?",
        """
        (
            n.estado_envio IS NULL
            OR n.estado_envio <> 'OCULTO'
        )
        """
    ]

    params = [asesor["usuario_id"]]

    estado = lower_clean(filters.get("estado"))
    tipo = clean(filters.get("tipo"))

    if estado in ["no_leidas", "unread", "pendientes"]:
        where.append("n.leida = 0")

    elif estado in ["leidas", "read"]:
        where.append("n.leida = 1")

    if tipo:
        where.append("n.tipo = ?")
        params.append(tipo)

    rows = safe_fetch_all(
        f"""
        SELECT
            n.notificacion_id,
            n.tipo,
            n.titulo,
            n.mensaje,
            n.leida,
            n.fecha_generacion,
            n.fecha_lectura,
            n.estado_envio,
            c.caso_id,
            c.codigo_caso,
            c.titulo AS titulo_caso
        FROM notificaciones n
        LEFT JOIN casos c ON c.caso_id = n.caso_id
        WHERE {" AND ".join(where)}
        ORDER BY
            CASE WHEN n.leida = 0 THEN 0 ELSE 1 END,
            n.fecha_generacion DESC
        """,
        tuple(params)
    )

    items = []

    for row in rows:
        tipo_row = row.get("tipo")
        mensaje = row.get("mensaje") or ""

        items.append({
            "id": row.get("notificacion_id"),
            "notification_id": row.get("notificacion_id"),
            "icon": notification_icon(tipo_row),
            "type": notification_type_filter(tipo_row),
            "tipo": tipo_row,
            "priority": notification_priority(tipo_row, mensaje),
            "prioridad": notification_priority(tipo_row, mensaje),
            "unread": not bool(row.get("leida")),
            "leida": bool(row.get("leida")),
            "caseId": row.get("codigo_caso") or "-",
            "case_id": row.get("caso_id"),
            "codigo_caso": row.get("codigo_caso") or "-",
            "caseTitle": row.get("titulo_caso") or "-",
            "title": row.get("titulo") or "Notificación",
            "titulo": row.get("titulo") or "Notificación",
            "text": mensaje,
            "mensaje": mensaje,
            "date": row.get("fecha_generacion"),
            "fecha_generacion": row.get("fecha_generacion"),
            "fecha_lectura": row.get("fecha_lectura"),
            "estado_envio": row.get("estado_envio") or "ENVIADO"
        })

    unread = len([item for item in items if item["unread"]])
    critical = len([item for item in items if item["priority"] == "critica"])
    sla = len([item for item in items if item["type"] == "sla"])

    return {
        "ok": True,
        "items": items,
        "total": len(items),
        "unread": unread,
        "no_leidas": unread,
        "kpis": [
            {
                "icon": "🔔",
                "value": len(items),
                "label": "Alertas activas",
                "description": "Notificaciones visibles"
            },
            {
                "icon": "📬",
                "value": unread,
                "label": "No leídas",
                "description": "Pendientes de revisión"
            },
            {
                "icon": "🚨",
                "value": critical,
                "label": "Críticas",
                "description": "Requieren atención prioritaria"
            },
            {
                "icon": "⏱️",
                "value": sla,
                "label": "SLA",
                "description": "Relacionadas a vencimientos"
            }
        ],
        "ai_summary": build_notifications_ai_summary(items),
        "action_plan": build_notifications_action_plan(items)
    }


def build_notifications_ai_summary(items):
    unread = [item for item in items if item.get("unread")]
    critical = [item for item in items if item.get("priority") == "critica"]
    sla = [item for item in items if item.get("type") == "sla"]

    if critical:
        recommendation = "Atiende primero las alertas críticas y abre el caso relacionado para registrar acción."
    elif unread:
        recommendation = "Revisa las notificaciones no leídas para evitar pérdida de seguimiento."
    else:
        recommendation = "No existen alertas pendientes críticas en este momento."

    return [
        {
            "title": "Alertas pendientes",
            "text": f"Tienes {len(unread)} notificación(es) sin leer."
        },
        {
            "title": "Riesgo operativo",
            "text": f"{len(critical)} alerta(s) están clasificadas como críticas."
        },
        {
            "title": "Alertas SLA",
            "text": f"{len(sla)} alerta(s) están asociadas a vencimientos o seguimiento SLA."
        },
        {
            "title": "Recomendación",
            "text": recommendation
        }
    ]


def build_notifications_action_plan(items):
    critical = [item for item in items if item.get("priority") == "critica"]
    unread = [item for item in items if item.get("unread")]
    sla = [item for item in items if item.get("type") == "sla"]

    return [
        {
            "icon": "1",
            "title": "Atender críticas",
            "text": f"Revisar {len(critical)} alerta(s) críticas antes de limpiar la bandeja."
        },
        {
            "icon": "2",
            "title": "Abrir casos relacionados",
            "text": "Toda alerta crítica debe llevar a detalle de caso y registrar seguimiento."
        },
        {
            "icon": "3",
            "title": "Control SLA",
            "text": f"Validar {len(sla)} alerta(s) vinculadas a vencimiento o seguimiento SLA."
        },
        {
            "icon": "4",
            "title": "Marcar como leído",
            "text": f"Después de revisar, puedes marcar {len(unread)} alerta(s) como leídas."
        }
    ]


def asesor_mark_all_notifications_read_service(asesor: dict):
    execute(
        """
        UPDATE notificaciones
        SET leida = 1,
            fecha_lectura = SYSDATETIME(),
            estado_envio = 'LEIDO'
        WHERE usuario_id = ?
          AND leida = 0
          AND (
              estado_envio IS NULL
              OR estado_envio <> 'OCULTO'
          )
        """,
        (asesor["usuario_id"],)
    )

    return response_ok("Notificaciones marcadas como leídas.")


def asesor_mark_notification_read_service(asesor: dict, notification_id: int):
    row = safe_fetch_one(
        """
        SELECT TOP 1 notificacion_id
        FROM notificaciones
        WHERE usuario_id = ?
          AND notificacion_id = ?
        """,
        (
            asesor["usuario_id"],
            notification_id
        )
    )

    if not row:
        raise HTTPException(status_code=404, detail="Notificación no encontrada.")

    execute(
        """
        UPDATE notificaciones
        SET leida = 1,
            fecha_lectura = SYSDATETIME(),
            estado_envio = 'LEIDO'
        WHERE usuario_id = ?
          AND notificacion_id = ?
        """,
        (
            asesor["usuario_id"],
            notification_id
        )
    )

    return response_ok("Notificación marcada como leída.")


def asesor_clear_read_notifications_service(asesor: dict):
    """
    Limpia la vista, pero NO borra físicamente.
    Usa estado_envio = 'OCULTO' para preservar trazabilidad.
    """
    execute(
        """
        UPDATE notificaciones
        SET estado_envio = 'OCULTO'
        WHERE usuario_id = ?
          AND leida = 1
        """,
        (asesor["usuario_id"],)
    )

    return response_ok("Notificaciones leídas ocultadas correctamente.")


# =========================================================
# RENDIMIENTO
# =========================================================

def period_days(period: str):
    value = lower_clean(period)

    if value in ["mes", "mensual", "month"]:
        return 30

    return 7


def period_label(period: str):
    return "mes" if period_days(period) == 30 else "semana"


def count_period_cases(asesor: dict, days_back: int):
    return safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos
        WHERE responsable_actual_usuario_id = ?
          AND fecha_actualizacion >= DATEADD(DAY, ?, SYSDATETIME())
        """,
        (
            asesor["usuario_id"],
            -days_back
        ),
        {"total": 0}
    )


def count_period_closed_cases(asesor: dict, days_back: int):
    return safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos
        WHERE responsable_actual_usuario_id = ?
          AND fecha_cierre IS NOT NULL
          AND fecha_cierre >= DATEADD(DAY, ?, SYSDATETIME())
        """,
        (
            asesor["usuario_id"],
            -days_back
        ),
        {"total": 0}
    )


def count_period_history(asesor: dict, days_back: int):
    return safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM historial_caso hc
        INNER JOIN casos c ON c.caso_id = hc.caso_id
        WHERE c.responsable_actual_usuario_id = ?
          AND hc.fecha_evento >= DATEADD(DAY, ?, SYSDATETIME())
        """,
        (
            asesor["usuario_id"],
            -days_back
        ),
        {"total": 0}
    )


def calculate_sla_percent(active_cases):
    open_cases = [
        c for c in active_cases
        if not is_closed_status(c.get("status"))
    ]

    if not open_cases:
        return 100

    vencidos = [
        c for c in open_cases
        if as_int(c.get("slaHours"), 999) <= 0
    ]

    risk = [
        c for c in open_cases
        if 0 < as_int(c.get("slaHours"), 999) <= 8
    ]

    penalty = (len(vencidos) * 12) + (len(risk) * 4)
    return max(0, min(100, 100 - penalty))


def build_performance_chart(asesor: dict, days_back: int):
    rows = safe_fetch_all(
        """
        SELECT
            CONVERT(date, hc.fecha_evento) AS fecha,
            COUNT(*) AS total
        FROM historial_caso hc
        INNER JOIN casos c ON c.caso_id = hc.caso_id
        WHERE c.responsable_actual_usuario_id = ?
          AND hc.fecha_evento >= DATEADD(DAY, ?, SYSDATETIME())
        GROUP BY CONVERT(date, hc.fecha_evento)
        ORDER BY fecha ASC
        """,
        (
            asesor["usuario_id"],
            -days_back
        )
    )

    row_map = {}

    for row in rows:
        fecha = row.get("fecha")

        if isinstance(fecha, datetime):
            key = fecha.date().isoformat()
        else:
            key = str(fecha)

        row_map[key] = as_int(row.get("total"))

    chart = []

    # Para mes, no mostramos 30 barras enormes; agrupamos visualmente en 10 puntos.
    visual_points = 10 if days_back == 30 else 7
    step = max(1, days_back // visual_points)

    for i in range(visual_points - 1, -1, -1):
        start_date = now() - timedelta(days=i * step)
        key = start_date.date().isoformat()
        label = start_date.strftime("%d/%m")

        if days_back == 30:
            value = 0

            for j in range(step):
                day_key = (start_date - timedelta(days=j)).date().isoformat()
                value += row_map.get(day_key, 0)
        else:
            value = row_map.get(key, 0)

        chart.append({
            "label": label,
            "value": value
        })

    return chart


def build_performance_table(active_cases, sla_percent):
    tipos = {}

    for case in active_cases:
        tipo = case.get("type") or "Otros"

        if tipo not in tipos:
            tipos[tipo] = {
                "tipo": tipo,
                "casos": 0,
                "riesgo": 0,
                "cerrados": 0
            }

        tipos[tipo]["casos"] += 1

        if as_int(case.get("slaHours"), 999) <= 8 and not is_closed_status(case.get("status")):
            tipos[tipo]["riesgo"] += 1

        if is_closed_status(case.get("status")):
            tipos[tipo]["cerrados"] += 1

    table = []

    for tipo, data in tipos.items():
        riesgo = data["riesgo"]

        if riesgo >= 3:
            estado = "Vigilar"
            status_type = "warning"
        elif riesgo >= 1:
            estado = "Atención"
            status_type = "info"
        else:
            estado = "Controlado"
            status_type = "success"

        table.append({
            "tipo": tipo,
            "casos": data["casos"],
            "tiempo_promedio": "Según historial",
            "sla": f"{sla_percent}%",
            "estado": estado,
            "status_type": status_type
        })

    if not table:
        table.append({
            "tipo": "Sin casos activos",
            "casos": 0,
            "tiempo_promedio": "-",
            "sla": "100%",
            "estado": "Controlado",
            "status_type": "success"
        })

    return table


def build_performance_ai_summary(total_value, closed_value, sla_percent, active_cases):
    risk = [
        c for c in active_cases
        if not is_closed_status(c.get("status")) and as_int(c.get("slaHours"), 999) <= 8
    ]

    critical = [
        c for c in active_cases
        if priority_order(c.get("priority")) == 4
    ]

    if sla_percent < 80:
        recommendation = "Hay riesgo de cumplimiento. Prioriza vencidos, críticos y pendientes por cliente."
    elif risk:
        recommendation = "El rendimiento es estable, pero debes atender los casos con SLA cercano."
    else:
        recommendation = "El rendimiento se encuentra controlado. Mantén actualización constante de historial."

    return [
        {
            "title": "Productividad",
            "text": f"Se registraron {total_value} caso(s) con actividad y {closed_value} cierre(s) en el periodo."
        },
        {
            "title": "Cumplimiento SLA",
            "text": f"El cumplimiento operativo estimado es {sla_percent}%."
        },
        {
            "title": "Carga crítica",
            "text": f"Tienes {len(critical)} caso(s) crítico(s) y {len(risk)} con riesgo SLA."
        },
        {
            "title": "Recomendación",
            "text": recommendation
        }
    ]


def build_performance_action_plan(active_cases, sla_percent):
    risk = [
        c for c in active_cases
        if not is_closed_status(c.get("status")) and as_int(c.get("slaHours"), 999) <= 8
    ]

    pending = [
        c for c in active_cases
        if "pendiente" in lower_clean(c.get("status"))
    ]

    close_ready = [
        c for c in active_cases
        if "listo" in lower_clean(c.get("status")) or "resuelto" in lower_clean(c.get("status"))
    ]

    return [
        {
            "icon": "1",
            "title": "Atender SLA crítico",
            "text": f"Resolver o registrar avance en {len(risk)} caso(s) con vencimiento cercano."
        },
        {
            "icon": "2",
            "title": "Reducir pendientes cliente",
            "text": f"Dar seguimiento a {len(pending)} caso(s) que dependen de evidencia o respuesta."
        },
        {
            "icon": "3",
            "title": "Cerrar casos listos",
            "text": f"Validar y cerrar {len(close_ready)} caso(s) con respuesta final preparada."
        },
        {
            "icon": "4",
            "title": "Sostener cumplimiento",
            "text": f"Mantener SLA por encima de 90%. Nivel actual: {sla_percent}%."
        }
    ]


def asesor_performance_service(asesor: dict, period: str):
    days_back = period_days(period)
    label = period_label(period)

    total = count_period_cases(asesor, days_back)
    closed = count_period_closed_cases(asesor, days_back)
    history = count_period_history(asesor, days_back)

    active_cases = asesor_list_cases_service(asesor, {})["items"]

    total_value = as_int(total.get("total"))
    closed_value = as_int(closed.get("total"))
    history_value = as_int(history.get("total"))

    sla_percent = calculate_sla_percent(active_cases)

    critical_count = len([
        c for c in active_cases
        if priority_order(c.get("priority")) == 4
    ])

    risk_count = len([
        c for c in active_cases
        if not is_closed_status(c.get("status")) and as_int(c.get("slaHours"), 999) <= 8
    ])

    chart = build_performance_chart(asesor, days_back)

    return {
        "ok": True,
        "period": label,
        "summary_title": "Rendimiento operativo",
        "summary_text": f"Periodo analizado: {label}. Se consideran casos, cierres, historial y SLA activo.",
        "trend": "Actualizado",
        "total_cases": total_value,
        "closed_cases": closed_value,
        "history_events": history_value,
        "sla_percent": sla_percent,
        "sla_text": "Cumplimiento calculado según casos activos, vencidos y riesgo SLA.",
        "kpis": [
            {
                "icon": "📥",
                "value": total_value,
                "label": "Casos atendidos",
                "description": f"Periodo {label}"
            },
            {
                "icon": "✅",
                "value": closed_value,
                "label": "Casos cerrados",
                "description": "Con respuesta final"
            },
            {
                "icon": "🕘",
                "value": history_value,
                "label": "Eventos registrados",
                "description": "Historial operativo"
            },
            {
                "icon": "⏱️",
                "value": f"{sla_percent}%",
                "label": "SLA cumplido",
                "description": "Estimación operativa"
            },
            {
                "icon": "🔥",
                "value": critical_count,
                "label": "Críticos activos",
                "description": "Mayor prioridad"
            },
            {
                "icon": "🚨",
                "value": risk_count,
                "label": "Riesgo SLA",
                "description": "Vencen pronto o vencidos"
            }
        ],
        "chart": chart,
        "priorities": [
            {
                "label": "Crítica",
                "value": len([c for c in active_cases if priority_order(c.get("priority")) == 4])
            },
            {
                "label": "Alta",
                "value": len([c for c in active_cases if priority_order(c.get("priority")) == 3])
            },
            {
                "label": "Media",
                "value": len([c for c in active_cases if priority_order(c.get("priority")) == 2])
            },
            {
                "label": "Baja",
                "value": len([c for c in active_cases if priority_order(c.get("priority")) == 1])
            }
        ],
        "table": build_performance_table(active_cases, sla_percent),
        "ai_summary": build_performance_ai_summary(
            total_value,
            closed_value,
            sla_percent,
            active_cases
        ),
        "action_plan": build_performance_action_plan(active_cases, sla_percent)
    }

# =========================================================
# BÚSQUEDA GLOBAL
# =========================================================

def asesor_search_service(asesor: dict, q: str):
    query_text = clean(q)

    if not query_text:
        return {
            "ok": True,
            "items": [
                {
                    "icon": "📊",
                    "title": "Dashboard",
                    "text": "Resumen de carga, SLA y prioridad.",
                    "href": "dashboard.html"
                },
                {
                    "icon": "📥",
                    "title": "Bandeja",
                    "text": "Casos asignados al asesor.",
                    "href": "bandeja.html"
                },
                {
                    "icon": "⏱️",
                    "title": "Calendario SLA",
                    "text": "Seguimiento de vencimientos.",
                    "href": "calendario-sla.html"
                },
                {
                    "icon": "💬",
                    "title": "Plantillas",
                    "text": "Respuestas predefinidas para casos.",
                    "href": "plantillas-respuesta.html"
                }
            ]
        }

    query = f"%{query_text}%"

    cases = safe_fetch_all(
        f"""
        SELECT TOP 10
            c.caso_id,
            c.codigo_caso,
            c.titulo,
            c.descripcion,
            cli.nombres,
            cli.apellidos,
            cli.razon_social,
            cli.documento_numero
        FROM casos c
        INNER JOIN clientes cli ON cli.cliente_id = c.cliente_id
        WHERE (
              c.responsable_actual_usuario_id = ?
              OR c.responsable_actual_usuario_id IS NULL
        )
          AND (
              c.codigo_caso LIKE ?
              OR c.titulo LIKE ?
              OR c.descripcion LIKE ?
              OR cli.nombres LIKE ?
              OR cli.apellidos LIKE ?
              OR cli.razon_social LIKE ?
              OR cli.documento_numero LIKE ?
          )
        ORDER BY c.fecha_registro DESC
        """,
        (
            asesor["usuario_id"],
            query,
            query,
            query,
            query,
            query,
            query,
            query
        )
    )

    templates = safe_fetch_all(
        """
        SELECT TOP 5
            plantilla_id,
            nombre,
            categoria,
            descripcion
        FROM plantillas_respuesta
        WHERE activo = 1
          AND (
              nombre LIKE ?
              OR categoria LIKE ?
              OR descripcion LIKE ?
              OR contenido LIKE ?
          )
        ORDER BY nombre
        """,
        (
            query,
            query,
            query,
            query
        )
    )

    items = []

    for row in cases:
        cliente = (
            row.get("razon_social")
            or f"{row.get('nombres') or ''} {row.get('apellidos') or ''}".strip()
            or "Cliente"
        )

        items.append({
            "icon": "🎫",
            "title": row.get("codigo_caso") or "Caso",
            "text": f"{row.get('titulo') or 'Caso registrado'} · {cliente}",
            "href": f"detalle-atencion.html?id={row.get('caso_id')}"
        })

    for row in templates:
        items.append({
            "icon": "💬",
            "title": row.get("nombre") or "Plantilla",
            "text": f"{row.get('categoria') or 'General'} · {row.get('descripcion') or 'Plantilla de respuesta'}",
            "href": "plantillas-respuesta.html"
        })

    return {
        "ok": True,
        "items": items
    }


# =========================================================
# ASISTENTE IA SIMPLE
# =========================================================

def asesor_assistant_service(asesor: dict, payload: dict):
    prompt = lower_clean(payload.get("prompt"))
    cases = asesor_list_cases_service(asesor, {})["items"]

    risk = [
        case for case in cases
        if not is_closed_status(case.get("status")) and as_int(case.get("slaHours"), 999) <= 8
    ]

    vencidos = [
        case for case in cases
        if not is_closed_status(case.get("status")) and as_int(case.get("slaHours"), 999) <= 0
    ]

    closeable = [
        case for case in cases
        if "listo" in lower_clean(case.get("status")) or "resuelto" in lower_clean(case.get("status"))
    ]

    pending = [
        case for case in cases
        if "pendiente" in lower_clean(case.get("status"))
    ]

    critical = [
        case for case in cases
        if priority_order(case.get("priority")) == 4
    ]

    if "sla" in prompt or "riesgo" in prompt or "vence" in prompt or "vencimiento" in prompt:
        if vencidos:
            first = sorted(vencidos, key=lambda c: as_int(c.get("slaHours"), 999))[0]
            answer = (
                f"El caso más urgente es {first['code']}: {first['title']}. "
                "Tiene SLA vencido. Debes abrirlo, registrar seguimiento y priorizar la respuesta."
            )
        elif risk:
            first = sorted(risk, key=lambda c: as_int(c.get("slaHours"), 999))[0]
            answer = (
                f"El caso con mayor riesgo SLA es {first['code']}: {first['title']}. "
                f"Tiene {first['slaText']}. Debes atenderlo antes de avanzar con casos de menor prioridad."
            )
        else:
            answer = "No hay casos con riesgo SLA crítico en este momento."

    elif "cerrar" in prompt or "cierre" in prompt:
        if closeable:
            first = closeable[0]
            answer = (
                f"Puedes revisar el cierre de {first['code']}. "
                "Antes de cerrar valida evidencia, respuesta final y trazabilidad en historial."
            )
        else:
            answer = "No hay casos listos para cierre en este momento."

    elif "cliente" in prompt or "evidencia" in prompt or "solicitar" in prompt:
        if pending:
            first = pending[0]
            answer = (
                f"El caso {first['code']} está pendiente del cliente. "
                "Solicita evidencia clara, indicando qué falta, por qué se necesita y el plazo de respuesta."
            )
        else:
            answer = "No hay casos pendientes por cliente con la carga actual."

    elif "plantilla" in prompt or "redacta" in prompt or "mensaje" in prompt:
        answer = (
            "Una buena plantilla debe incluir saludo, código de caso, información requerida, "
            "motivo de la solicitud, plazo, canal de respuesta y cierre cordial."
        )

    elif "rendimiento" in prompt or "productividad" in prompt:
        answer = (
            "Para mejorar rendimiento, prioriza SLA crítico, reduce pendientes por cliente, "
            "registra avances en historial y cierra casos con respuesta final lista."
        )

    elif "critico" in prompt or "crítico" in prompt or "prioridad" in prompt:
        if critical:
            first = sorted(
                critical,
                key=lambda c: as_int(c.get("slaHours"), 999)
            )[0]
            answer = (
                f"El caso crítico principal es {first['code']}: {first['title']}. "
                f"Estado actual: {first['status']}. Acción recomendada: {first['action']}"
            )
        else:
            answer = "No tienes casos críticos activos en este momento."

    else:
        answer = (
            f"Tienes {len(cases)} caso(s) visibles. "
            "Prioriza por este orden: SLA vencido, SLA menor a 8 horas, prioridad crítica, pendientes por cliente y cierres listos."
        )

    return {
        "ok": True,
        "answer": answer
    }


# =========================================================
# CONSTANCIA DE ATENCIÓN
# =========================================================

def certificate_lines(asesor: dict, case_id: str):
    case = map_case(get_case_for_advisor(asesor, case_id))

    return [
        "CLARO ATENCIÓN 360",
        "CONSTANCIA DE ATENCIÓN",
        "",
        f"Código de caso: {case['code']}",
        f"Tipo de caso: {case['type']}",
        f"Categoría: {case['category']}",
        f"Cliente: {case['clientName']}",
        f"Documento: {case['document']}",
        f"Servicio: {case['service']}",
        f"Canal: {case['channel']}",
        f"Estado: {case['status']}",
        f"Prioridad: {case['priority']}",
        f"SLA: {case['slaText']}",
        f"Fecha de registro: {format_dt(case['createdAt'])}",
        f"Fecha de actualización: {format_dt(case['updatedAt'])}",
        f"Asesor responsable: {advisor_name(asesor)}",
        "",
        "Descripción:",
        case["description"] or "-",
        "",
        "Respuesta final:",
        case.get("solucion_final") or "Pendiente de respuesta final.",
        "",
        "Generado por el sistema Claro Atención 360."
    ]


def asesor_case_certificate_service(asesor: dict, case_id: str, formato: str = "pdf"):
    fmt = lower_clean(formato) or "pdf"
    lines = certificate_lines(asesor, case_id)
    case_code = clean(case_id).replace("/", "-").replace("\\", "-")

    if fmt == "txt":
        return (
            "\n".join(lines).encode("utf-8"),
            "text/plain; charset=utf-8",
            f"constancia-{case_code}.txt"
        )

    if fmt == "html":
        body = "".join(f"<p>{html.escape(line) if line else '&nbsp;'}</p>" for line in lines)

        content = f"""
        <!doctype html>
        <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>Constancia {html.escape(case_code)}</title>
          <style>
            body {{
              font-family: Arial, sans-serif;
              color: #111827;
              padding: 32px;
            }}
            h1 {{
              color: #e2231a;
            }}
            p {{
              margin: 6px 0;
              line-height: 1.4;
            }}
          </style>
        </head>
        <body>
          <h1>Claro Atención 360</h1>
          {body}
        </body>
        </html>
        """.strip()

        return (
            content.encode("utf-8"),
            "text/html; charset=utf-8",
            f"constancia-{case_code}.html"
        )

    return (
        make_pdf_bytes(lines, title="Constancia de Atención"),
        "application/pdf",
        f"constancia-{case_code}.pdf"
    )


# =========================================================
# EXPORTACIONES
# =========================================================

def normalize_report_name(reporte: str):
    value = lower_clean(reporte)

    aliases = {
        "bandeja": "bandeja",
        "casos": "bandeja",
        "cola": "cola",
        "cola-trabajo": "cola",
        "sla": "sla",
        "calendario-sla": "sla",
        "plantillas": "plantillas",
        "plantillas-respuesta": "plantillas",
        "rendimiento": "rendimiento",
        "dashboard": "dashboard",
        "resumen": "dashboard",
    }

    return aliases.get(value, value or "bandeja")


def normalize_export_format(formato: str):
    value = lower_clean(formato)

    aliases = {
        "xlsx": "excel",
        "xls": "excel",
        "excel": "excel",
        "csv": "csv",
        "pdf": "pdf",
        "word": "word",
        "doc": "word",
        "docx": "word",
        "imagen": "imagen",
        "image": "imagen",
        "png": "imagen",
        "svg": "imagen",
    }

    return aliases.get(value, "excel")


def report_title(reporte: str):
    titles = {
        "bandeja": "Reporte de Bandeja de Casos",
        "cola": "Reporte de Cola de Trabajo",
        "sla": "Reporte de Calendario SLA",
        "plantillas": "Reporte de Plantillas",
        "rendimiento": "Reporte de Rendimiento",
        "dashboard": "Reporte Ejecutivo Dashboard"
    }

    return titles.get(reporte, "Reporte Asesor")


def build_export_dataset(asesor: dict, reporte: str, periodo: str):
    report = normalize_report_name(reporte)

    if report in ["bandeja", "cola", "sla", "dashboard"]:
        cases = asesor_list_cases_service(asesor, {})["items"]

        if report == "sla":
            cases = sorted(
                [
                    c for c in cases
                    if not is_closed_status(c.get("status"))
                ],
                key=lambda c: as_int(c.get("slaHours"), 999)
            )

        rows = []

        for case in cases:
            rows.append({
                "Código": case.get("code"),
                "Cliente": case.get("clientName"),
                "Documento": case.get("document"),
                "Tipo": case.get("type"),
                "Categoría": case.get("category"),
                "Servicio": case.get("service"),
                "Prioridad": case.get("priority"),
                "Estado": case.get("status"),
                "SLA": case.get("slaText"),
                "Registro": format_dt(case.get("createdAt")),
                "Actualización": format_dt(case.get("updatedAt")),
                "Acción sugerida": case.get("action"),
            })

        return rows

    if report == "plantillas":
        templates = asesor_templates_service(asesor)["items"]

        return [
            {
                "ID": item.get("id"),
                "Nombre": item.get("title"),
                "Categoría": item.get("categoria"),
                "Canal": item.get("channel"),
                "Descripción": item.get("description"),
                "Activa": "Sí" if item.get("active") else "No",
            }
            for item in templates
        ]

    if report == "rendimiento":
        data = asesor_performance_service(asesor, periodo)

        rows = []

        for item in data.get("kpis", []):
            rows.append({
                "Indicador": item.get("label"),
                "Valor": item.get("value"),
                "Descripción": item.get("description")
            })

        for item in data.get("table", []):
            rows.append({
                "Indicador": item.get("tipo"),
                "Valor": item.get("casos"),
                "Descripción": f"SLA {item.get('sla')} · Estado {item.get('estado')}"
            })

        return rows

    return []


def asesor_export_service(asesor: dict, reporte: str, formato: str, periodo: str = "semana"):
    report = normalize_report_name(reporte)
    fmt = normalize_export_format(formato)
    title = report_title(report)
    rows = build_export_dataset(asesor, report, periodo)

    generated = now().strftime("%Y%m%d_%H%M%S")
    base_filename = f"{report}_{generated}"

    if fmt == "pdf":
        lines = export_lines(title, rows, asesor)
        return (
            make_pdf_bytes(lines, title=title),
            "application/pdf",
            f"{base_filename}.pdf"
        )

    if fmt == "word":
        return (
            make_word_bytes(title, rows, asesor),
            "application/msword",
            f"{base_filename}.doc"
        )

    if fmt == "csv":
        return (
            make_csv_bytes(rows),
            "text/csv; charset=utf-8",
            f"{base_filename}.csv"
        )

    if fmt == "imagen":
        return (
            make_svg_bytes(title, rows, asesor),
            "image/svg+xml",
            f"{base_filename}.svg"
        )

    return (
        make_excel_html_bytes(title, rows, asesor),
        "application/vnd.ms-excel",
        f"{base_filename}.xls"
    )


# =========================================================
# GENERADORES DE ARCHIVOS
# =========================================================

def export_lines(title: str, rows: list, asesor: dict):
    lines = [
        "CLARO ATENCIÓN 360",
        title,
        f"Asesor: {advisor_name(asesor)}",
        f"Fecha de generación: {now().strftime('%d/%m/%Y %H:%M')}",
        f"Total de registros: {len(rows)}",
        ""
    ]

    if not rows:
        lines.append("No se encontraron registros para exportar.")
        return lines

    for index, row in enumerate(rows[:80], start=1):
        lines.append(f"Registro {index}")

        for key, value in row.items():
            lines.append(f"{key}: {value}")

        lines.append("")

    if len(rows) > 80:
        lines.append(f"Se muestran los primeros 80 de {len(rows)} registros.")

    return lines


def make_csv_bytes(rows: list):
    output = io.StringIO()

    if not rows:
        output.write("mensaje\nSin registros\n")
        return output.getvalue().encode("utf-8-sig")

    headers = list(rows[0].keys())
    writer = csv.DictWriter(output, fieldnames=headers, extrasaction="ignore")
    writer.writeheader()

    for row in rows:
        writer.writerow({
            key: clean(value)
            for key, value in row.items()
        })

    return output.getvalue().encode("utf-8-sig")


def make_word_bytes(title: str, rows: list, asesor: dict):
    table_html = rows_to_html_table(rows)

    content = f"""
    <!doctype html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>{html.escape(title)}</title>
      <style>
        body {{
          font-family: Arial, sans-serif;
          color: #111827;
          padding: 28px;
        }}
        h1 {{
          color: #e2231a;
          margin-bottom: 4px;
        }}
        p {{
          color: #475467;
          font-size: 13px;
        }}
        table {{
          width: 100%;
          border-collapse: collapse;
          margin-top: 18px;
          font-size: 12px;
        }}
        th {{
          background: #e2231a;
          color: white;
          text-align: left;
          padding: 8px;
        }}
        td {{
          border: 1px solid #e5e7eb;
          padding: 8px;
          vertical-align: top;
        }}
      </style>
    </head>
    <body>
      <h1>{html.escape(title)}</h1>
      <p>Claro Atención 360</p>
      <p>Asesor: {html.escape(advisor_name(asesor))}</p>
      <p>Fecha de generación: {now().strftime('%d/%m/%Y %H:%M')}</p>
      {table_html}
    </body>
    </html>
    """.strip()

    return content.encode("utf-8")


def make_excel_html_bytes(title: str, rows: list, asesor: dict):
    table_html = rows_to_html_table(rows)

    content = f"""
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <style>
        table {{
          border-collapse: collapse;
          font-family: Arial, sans-serif;
          font-size: 12px;
        }}
        th {{
          background: #e2231a;
          color: #ffffff;
          border: 1px solid #c81913;
          padding: 8px;
        }}
        td {{
          border: 1px solid #d0d5dd;
          padding: 8px;
          mso-number-format:"\\@";
        }}
      </style>
    </head>
    <body>
      <h2>{html.escape(title)}</h2>
      <p>Claro Atención 360</p>
      <p>Asesor: {html.escape(advisor_name(asesor))}</p>
      <p>Fecha de generación: {now().strftime('%d/%m/%Y %H:%M')}</p>
      {table_html}
    </body>
    </html>
    """.strip()

    return content.encode("utf-8")


def rows_to_html_table(rows: list):
    if not rows:
        return "<p>No se encontraron registros.</p>"

    headers = list(rows[0].keys())

    thead = "".join(f"<th>{html.escape(clean(header))}</th>" for header in headers)

    body = ""

    for row in rows:
        cells = "".join(
            f"<td>{html.escape(clean(row.get(header)))}</td>"
            for header in headers
        )
        body += f"<tr>{cells}</tr>"

    return f"""
    <table>
      <thead>
        <tr>{thead}</tr>
      </thead>
      <tbody>
        {body}
      </tbody>
    </table>
    """


def make_svg_bytes(title: str, rows: list, asesor: dict):
    total = len(rows)
    subtitle = f"Asesor: {advisor_name(asesor)} · Registros: {total}"
    generated = now().strftime("%d/%m/%Y %H:%M")

    sample = rows[:6]

    row_svg = ""
    y = 190

    if sample:
        for index, row in enumerate(sample, start=1):
            first_key = list(row.keys())[0]
            second_key = list(row.keys())[1] if len(row.keys()) > 1 else first_key

            text_1 = clean(row.get(first_key))[:54]
            text_2 = clean(row.get(second_key))[:70]

            row_svg += f"""
            <rect x="64" y="{y}" width="1072" height="58" rx="14" fill="#ffffff" stroke="#e4e7ec"/>
            <text x="88" y="{y + 25}" font-size="16" font-weight="700" fill="#111827">{html.escape(text_1)}</text>
            <text x="88" y="{y + 46}" font-size="13" fill="#667085">{html.escape(text_2)}</text>
            """
            y += 70
    else:
        row_svg = """
        <rect x="64" y="190" width="1072" height="70" rx="14" fill="#ffffff" stroke="#e4e7ec"/>
        <text x="88" y="232" font-size="18" font-weight="700" fill="#667085">No se encontraron registros.</text>
        """

    svg = f"""
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
      <rect width="1200" height="720" fill="#f4f6fb"/>
      <circle cx="1060" cy="90" r="180" fill="#fff1f0"/>
      <rect x="40" y="40" width="1120" height="640" rx="28" fill="#ffffff" stroke="#e4e7ec"/>
      <text x="64" y="92" font-size="34" font-weight="900" fill="#e2231a">Claro Atención 360</text>
      <text x="64" y="132" font-size="26" font-weight="800" fill="#111827">{html.escape(title)}</text>
      <text x="64" y="160" font-size="15" fill="#667085">{html.escape(subtitle)}</text>
      <text x="920" y="160" font-size="14" fill="#98a2b3">{html.escape(generated)}</text>
      {row_svg}
    </svg>
    """.strip()

    return svg.encode("utf-8")


# =========================================================
# PDF SIMPLE SIN DEPENDENCIAS EXTERNAS
# Genera un PDF básico válido para reportes/constancias.
# =========================================================

def pdf_escape(text):
    value = clean(text)
    value = value.replace("\\", "\\\\")
    value = value.replace("(", "\\(")
    value = value.replace(")", "\\)")
    value = value.replace("\r", " ")
    value = value.replace("\n", " ")
    return value


def chunk_pdf_lines(lines, max_lines_per_page=42):
    chunks = []

    for i in range(0, len(lines), max_lines_per_page):
        chunks.append(lines[i:i + max_lines_per_page])

    return chunks or [[]]


def make_pdf_page_stream(lines):
    stream_lines = [
        "BT",
        "/F1 11 Tf",
        "50 790 Td",
        "14 TL"
    ]

    for line in lines:
        safe_line = pdf_escape(line)

        if len(safe_line) > 95:
            pieces = [safe_line[i:i + 95] for i in range(0, len(safe_line), 95)]
        else:
            pieces = [safe_line]

        for piece in pieces:
            stream_lines.append(f"({piece}) Tj")
            stream_lines.append("T*")

    stream_lines.append("ET")
    return "\n".join(stream_lines).encode("latin-1", errors="ignore")


def make_pdf_bytes(lines: list, title="Reporte"):
    clean_lines = [clean(line) for line in lines]
    pages = chunk_pdf_lines(clean_lines)

    objects = []

    # 1 Catalog
    objects.append("<< /Type /Catalog /Pages 2 0 R >>".encode("latin-1"))

    # 2 Pages, se completa luego
    page_object_numbers = []
    content_object_numbers = []

    next_obj = 3

    for _ in pages:
        page_object_numbers.append(next_obj)
        content_object_numbers.append(next_obj + 1)
        next_obj += 2

    font_obj_number = next_obj

    kids = " ".join(f"{num} 0 R" for num in page_object_numbers)
    objects.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(page_object_numbers)} >>".encode("latin-1"))

    for page_index, page_lines in enumerate(pages):
        page_num = page_object_numbers[page_index]
        content_num = content_object_numbers[page_index]

        page_obj = (
            f"<< /Type /Page /Parent 2 0 R "
            f"/MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 {font_obj_number} 0 R >> >> "
            f"/Contents {content_num} 0 R >>"
        ).encode("latin-1")

        stream = make_pdf_page_stream(page_lines)

        content_obj = (
            b"<< /Length " + str(len(stream)).encode("latin-1") + b" >>\n"
            b"stream\n" + stream + b"\nendstream"
        )

        objects.append(page_obj)
        objects.append(content_obj)

    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    pdf = bytearray()
    pdf.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    offsets = [0]

    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode("latin-1"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    xref_position = len(pdf)

    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")

    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))

    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_position}\n%%EOF"
        .encode("latin-1")
    )

    return bytes(pdf)

# =========================================================
# OVERRIDE FINAL - CONSTANCIA Y PDF PROFESIONAL
# Pegar al FINAL de backend/app/asesor/service.py
# =========================================================

def normalize_pdf_text(value):
    value = clean(value)
    value = value.replace("–", "-").replace("—", "-")
    value = value.replace("“", '"').replace("”", '"')
    value = value.replace("’", "'")
    return value.encode("latin-1", errors="ignore").decode("latin-1")


def pdf_escape(text):
    value = normalize_pdf_text(text)
    value = value.replace("\\", "\\\\")
    value = value.replace("(", "\\(")
    value = value.replace(")", "\\)")
    value = value.replace("\r", " ")
    value = value.replace("\n", " ")
    return value


def wrap_pdf_text(text, max_chars=86):
    text = normalize_pdf_text(text)

    if not text:
        return [""]

    words = text.split()
    lines = []
    current = ""

    for word in words:
        candidate = f"{current} {word}".strip()

        if len(candidate) <= max_chars:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word

    if current:
        lines.append(current)

    return lines or [""]


def certificate_lines(asesor: dict, case_id: str):
    case = map_case(get_case_for_advisor(asesor, case_id))

    return [
        "CONSTANCIA DE ATENCION",
        "",
        "DATOS DEL CASO",
        f"Codigo de caso: {case['code']}",
        f"Tipo de caso: {case['type']}",
        f"Categoria: {case['category']}",
        f"Estado actual: {case['status']}",
        f"Prioridad: {case['priority']}",
        f"SLA: {case['slaText']}",
        "",
        "DATOS DEL CLIENTE",
        f"Cliente: {case['clientName']}",
        f"Documento: {case['document']}",
        f"Servicio: {case['service']}",
        f"Canal de ingreso: {case['channel']}",
        "",
        "FECHAS Y RESPONSABLE",
        f"Fecha de registro: {format_dt(case['createdAt'])}",
        f"Fecha de actualizacion: {format_dt(case['updatedAt'])}",
        f"Fecha de cierre: {format_dt(case.get('closedAt'))}",
        f"Asesor responsable: {advisor_name(asesor)}",
        "",
        "DESCRIPCION DEL CASO",
        case["description"] or "-",
        "",
        "RESPUESTA FINAL",
        case.get("solucion_final") or "Pendiente de respuesta final.",
        "",
        "Documento generado automaticamente por Claro Atencion 360."
    ]


def asesor_case_certificate_service(asesor: dict, case_id: str, formato: str = "pdf"):
    fmt = lower_clean(formato) or "pdf"
    lines = certificate_lines(asesor, case_id)
    safe_case_code = clean(case_id).replace("/", "-").replace("\\", "-")

    if fmt == "txt":
        return (
            "\n".join(lines).encode("utf-8"),
            "text/plain; charset=utf-8",
            f"constancia-{safe_case_code}.txt"
        )

    if fmt == "html":
        body = ""

        for line in lines:
            if not line:
                body += "<br>"
            elif line.isupper() and len(line) <= 35:
                body += f"<h2>{html.escape(line)}</h2>"
            elif ":" in line:
                key, value = line.split(":", 1)
                body += f"""
                <div class="row">
                  <span>{html.escape(key)}</span>
                  <strong>{html.escape(value.strip())}</strong>
                </div>
                """
            else:
                body += f"<p>{html.escape(line)}</p>"

        content = f"""
        <!doctype html>
        <html lang="es">
        <head>
          <meta charset="utf-8">
          <title>Constancia {html.escape(safe_case_code)}</title>
          <style>
            body {{
              margin: 0;
              padding: 0;
              background: #f4f6fb;
              font-family: Arial, sans-serif;
              color: #111827;
            }}
            .page {{
              width: 820px;
              margin: 32px auto;
              background: #fff;
              border: 1px solid #e5e7eb;
              border-radius: 22px;
              overflow: hidden;
              box-shadow: 0 18px 48px rgba(15,23,42,.12);
            }}
            .header {{
              padding: 26px 34px;
              background: linear-gradient(135deg, #e2231a, #98120e);
              color: #fff;
            }}
            .header h1 {{
              margin: 0;
              font-size: 28px;
              letter-spacing: -.5px;
            }}
            .header p {{
              margin: 6px 0 0;
              color: rgba(255,255,255,.86);
            }}
            .content {{
              padding: 30px 34px 36px;
            }}
            h2 {{
              margin: 22px 0 12px;
              color: #e2231a;
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: .08em;
            }}
            .row {{
              display: grid;
              grid-template-columns: 210px 1fr;
              gap: 12px;
              padding: 11px 0;
              border-bottom: 1px solid #eef2f7;
            }}
            .row span {{
              color: #667085;
              font-size: 13px;
              font-weight: 700;
            }}
            .row strong {{
              color: #101828;
              font-size: 14px;
              line-height: 1.45;
            }}
            p {{
              color: #344054;
              line-height: 1.55;
              font-size: 14px;
            }}
            .footer {{
              padding: 18px 34px;
              background: #f8fafc;
              color: #667085;
              font-size: 12px;
            }}
          </style>
        </head>
        <body>
          <main class="page">
            <section class="header">
              <h1>Claro Atención 360</h1>
              <p>Constancia oficial de atención generada por el sistema</p>
            </section>
            <section class="content">
              {body}
            </section>
            <section class="footer">
              Generado el {now().strftime('%d/%m/%Y %H:%M')} · Uso interno / atención al cliente
            </section>
          </main>
        </body>
        </html>
        """.strip()

        return (
            content.encode("utf-8"),
            "text/html; charset=utf-8",
            f"constancia-{safe_case_code}.html"
        )

    return (
        make_pdf_bytes(lines, title="Constancia de Atencion"),
        "application/pdf",
        f"constancia-{safe_case_code}.pdf"
    )


def chunk_pdf_lines(lines, max_lines_per_page=34):
    chunks = []

    for i in range(0, len(lines), max_lines_per_page):
        chunks.append(lines[i:i + max_lines_per_page])

    return chunks or [[]]


def make_pdf_page_stream(lines, page_number, total_pages, title):
    commands = []

    # Fondo
    commands.append("0.96 0.97 0.98 rg")
    commands.append("0 0 595 842 re f")

    # Página blanca
    commands.append("1 1 1 rg")
    commands.append("34 34 527 774 re f")

    # Header rojo
    commands.append("0.89 0.14 0.10 rg")
    commands.append("34 752 527 56 re f")

    # Marca
    commands.append("1 1 1 rg")
    commands.append("BT /F2 18 Tf 54 785 Td (Claro Atencion 360) Tj ET")
    commands.append("BT /F1 9 Tf 54 768 Td (Sistema integral de gestion de reclamos y atencion) Tj ET")

    # Título
    commands.append("0.06 0.09 0.16 rg")
    commands.append(f"BT /F2 18 Tf 54 720 Td ({pdf_escape(title)}) Tj ET")

    # Fecha y página
    generated = now().strftime("%d/%m/%Y %H:%M")
    commands.append("0.40 0.44 0.52 rg")
    commands.append(f"BT /F1 9 Tf 54 704 Td (Generado: {pdf_escape(generated)}) Tj ET")
    commands.append(f"BT /F1 9 Tf 455 704 Td (Pagina {page_number} de {total_pages}) Tj ET")

    y = 675

    for raw_line in lines:
        line = normalize_pdf_text(raw_line)

        if y < 74:
            break

        if not line:
            y -= 12
            continue

        is_section = line.isupper() and len(line) <= 40

        if is_section:
            y -= 10
            commands.append("0.89 0.14 0.10 rg")
            commands.append(f"BT /F2 10 Tf 54 {y} Td ({pdf_escape(line)}) Tj ET")
            y -= 14
            commands.append("0.90 0.91 0.94 rg")
            commands.append(f"54 {y + 5} 487 1 re f")
            continue

        if ":" in line and len(line) <= 120:
            key, value = line.split(":", 1)

            commands.append("0.40 0.44 0.52 rg")
            commands.append(f"BT /F2 9 Tf 54 {y} Td ({pdf_escape(key + ':')}) Tj ET")

            value_lines = wrap_pdf_text(value.strip(), 68)
            first = True

            for value_line in value_lines:
                if not first:
                    y -= 12

                commands.append("0.06 0.09 0.16 rg")
                commands.append(f"BT /F1 9 Tf 190 {y} Td ({pdf_escape(value_line)}) Tj ET")
                first = False

            y -= 16
            continue

        wrapped = wrap_pdf_text(line, 90)

        for wrapped_line in wrapped:
            commands.append("0.18 0.22 0.30 rg")
            commands.append(f"BT /F1 9 Tf 54 {y} Td ({pdf_escape(wrapped_line)}) Tj ET")
            y -= 13

    # Footer
    commands.append("0.89 0.14 0.10 rg")
    commands.append("34 34 527 4 re f")
    commands.append("0.40 0.44 0.52 rg")
    commands.append("BT /F1 8 Tf 54 52 Td (Documento generado automaticamente. La informacion corresponde al registro disponible en la base de datos.) Tj ET")

    return "\n".join(commands).encode("latin-1", errors="ignore")


def make_pdf_bytes(lines: list, title="Reporte"):
    prepared_lines = []

    for line in lines:
        line = normalize_pdf_text(line)

        if len(line) > 120 and ":" not in line:
            prepared_lines.extend(wrap_pdf_text(line, 96))
        else:
            prepared_lines.append(line)

    pages = chunk_pdf_lines(prepared_lines, 34)

    objects = []

    # 1 Catalog
    objects.append("<< /Type /Catalog /Pages 2 0 R >>".encode("latin-1"))

    page_object_numbers = []
    content_object_numbers = []

    next_obj = 3

    for _ in pages:
        page_object_numbers.append(next_obj)
        content_object_numbers.append(next_obj + 1)
        next_obj += 2

    font_regular_obj = next_obj
    font_bold_obj = next_obj + 1

    kids = " ".join(f"{num} 0 R" for num in page_object_numbers)

    # 2 Pages
    objects.append(
        f"<< /Type /Pages /Kids [{kids}] /Count {len(page_object_numbers)} >>".encode("latin-1")
    )

    for page_index, page_lines in enumerate(pages):
        content_num = content_object_numbers[page_index]

        page_obj = (
            f"<< /Type /Page /Parent 2 0 R "
            f"/MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 {font_regular_obj} 0 R /F2 {font_bold_obj} 0 R >> >> "
            f"/Contents {content_num} 0 R >>"
        ).encode("latin-1")

        stream = make_pdf_page_stream(
            lines=page_lines,
            page_number=page_index + 1,
            total_pages=len(pages),
            title=title
        )

        content_obj = (
            b"<< /Length " + str(len(stream)).encode("latin-1") + b" >>\n"
            b"stream\n" + stream + b"\nendstream"
        )

        objects.append(page_obj)
        objects.append(content_obj)

    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

    pdf = bytearray()
    pdf.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")

    offsets = [0]

    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode("latin-1"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    xref_position = len(pdf)

    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")

    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("latin-1"))

    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_position}\n%%EOF"
        .encode("latin-1")
    )

    return bytes(pdf)