from datetime import datetime, timedelta
import json
import csv
import io
import re

from fastapi import HTTPException, Response

from app.database import fetch_one, fetch_all, execute, get_connection


# =========================================================
# HELPERS GENERALES
# =========================================================

def clean(value):
    return str(value or "").strip()


def lower(value):
    return clean(value).lower()


def as_int(value, default=0):
    try:
        if value is None or value == "":
            return default
        return int(value)
    except Exception:
        return default


def as_bool(value):
    if isinstance(value, bool):
        return value

    if isinstance(value, int):
        return value == 1

    return lower(value) in [
        "1",
        "true",
        "si",
        "sí",
        "yes",
        "activo",
        "activa",
        "checked",
        "on"
    ]


def is_all(value):
    return lower(value) in ["", "todos", "todas", "all", "null", "none"]


def response_ok(message="Operación realizada correctamente.", **extra):
    return {
        "ok": True,
        "success": True,
        "message": message,
        **extra
    }


def supervisor_name(supervisor: dict):
    full = f"{supervisor.get('nombres') or ''} {supervisor.get('apellidos') or ''}".strip()

    return (
        full
        or supervisor.get("nombre")
        or supervisor.get("username")
        or supervisor.get("correo")
        or "Supervisor"
    )


def initials(name: str):
    return "".join(part[0].upper() for part in clean(name).split()[:2]) or "SU"


def normalize_identifier(value):
    text = clean(value)

    if text.isdigit():
        return int(text), text

    return -1, text


def parse_date(value):
    text = clean(value)

    if not text:
        return None

    try:
        return datetime.fromisoformat(text)
    except Exception:
        try:
            return datetime.strptime(text, "%Y-%m-%d")
        except Exception:
            return None


def remaining_hours(deadline):
    if not deadline:
        return 999

    try:
        diff = deadline - datetime.now()
        return int(diff.total_seconds() // 3600)
    except Exception:
        return 999


def priority_order(priority):
    value = lower(priority)

    if "crítica" in value or "critica" in value:
        return 4

    if "alta" in value:
        return 3

    if "media" in value:
        return 2

    return 1


def sla_group(hours: int):
    if hours < 0:
        return "vencido"

    if hours <= 8:
        return "vence_hoy"

    if hours <= 24:
        return "vence_manana"

    return "semana"


def get_scope_dates(period: str):
    value = lower(period or "semana")
    today = datetime.now()

    if value in ["hoy", "dia", "día", "today"]:
        return today.replace(hour=0, minute=0, second=0, microsecond=0)

    if value in ["mes", "month", "mes_actual"]:
        return today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    if value in ["trimestre", "quarter", "trimestre_actual"]:
        month = ((today.month - 1) // 3) * 3 + 1
        return today.replace(month=month, day=1, hour=0, minute=0, second=0, microsecond=0)

    if value in ["semana_anterior"]:
        return today - timedelta(days=14)

    if value in ["mes_anterior"]:
        first_day = today.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        return first_day - timedelta(days=31)

    return today - timedelta(days=7)


def safe_filename(value, fallback="reporte"):
    text = lower(value or fallback)
    text = re.sub(r"[^a-z0-9áéíóúñ]+", "-", text, flags=re.IGNORECASE)
    text = text.strip("-")
    return text or fallback


def extract_case_code(text):
    value = clean(text)

    for token in value.split():
        clean_token = token.strip(".,;:()[]{}")
        upper = clean_token.upper()

        if upper.startswith("CASO-") or upper.startswith("CLA-"):
            return clean_token

    return "-"


def audit_icon(value):
    text = lower(value)

    if "reasign" in text:
        return "🔁"

    if "asign" in text:
        return "👥"

    if "deriv" in text:
        return "🧭"

    if "escal" in text:
        return "🚨"

    if "sla" in text:
        return "⏱️"

    if "prioridad" in text:
        return "🔥"

    if "clasific" in text:
        return "📋"

    if "reporte" in text or "export" in text:
        return "📊"

    if "config" in text:
        return "⚙️"

    return "🕘"


def has_table(table_name: str):
    try:
        row = fetch_one(
            """
            SELECT COUNT(*) AS total
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME = ?
            """,
            (table_name,)
        )
        return bool(row and int(row["total"] or 0) > 0)
    except Exception:
        return False


def safe_fetch_all(query: str, params: tuple = ()):
    try:
        return fetch_all(query, params)
    except Exception:
        return []


def safe_fetch_one(query: str, params: tuple = ()):
    try:
        return fetch_one(query, params)
    except Exception:
        return None


# =========================================================
# HELPERS SQL / CATÁLOGOS
# =========================================================

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


def catalog_from_table(table, id_column, label_column="nombre", where="activo = 1"):
    if not has_table(table):
        return []

    rows = safe_fetch_all(
        f"""
        SELECT
            {id_column} AS id,
            {label_column} AS label
        FROM {table}
        WHERE {where}
        ORDER BY {label_column}
        """
    )

    return [
        {
            "id": row["id"],
            "value": row["label"],
            "label": row["label"],
            "nombre": row["label"]
        }
        for row in rows
    ]


def static_catalog(items):
    result = []

    for item in items:
        if isinstance(item, dict):
            result.append(item)
        else:
            result.append({
                "id": item,
                "value": item,
                "label": item,
                "nombre": item
            })

    return result


def get_catalog_id(table, id_column, name, fallback=None):
    wanted = clean(name)

    if wanted and has_table(table):
        row = fetch_one(
            f"""
            SELECT TOP 1 {id_column} AS id
            FROM {table}
            WHERE LOWER(nombre) = LOWER(?)
              AND activo = 1
            """,
            (wanted,)
        )

        if row:
            return row["id"]

    if fallback and has_table(table):
        row = fetch_one(
            f"""
            SELECT TOP 1 {id_column} AS id
            FROM {table}
            WHERE LOWER(nombre) = LOWER(?)
              AND activo = 1
            """,
            (fallback,)
        )

        if row:
            return row["id"]

    if has_table(table):
        row = fetch_one(
            f"""
            SELECT TOP 1 {id_column} AS id
            FROM {table}
            WHERE activo = 1
            ORDER BY {id_column}
            """
        )

        if row:
            return row["id"]

    raise HTTPException(
        status_code=500,
        detail=f"No existe catálogo activo en {table}."
    )


def get_estado_id(nombre: str):
    aliases = {
        "Nuevo": "Registrado",
        "Pendiente clasificación": "Registrado",
        "Sin clasificar": "Registrado",
        "Observado": "Pendiente por cliente",
        "Enviado a asignación": "Registrado",
        "Asignado": "En atención",
        "Reasignado": "En atención",
        "Derivado": "Derivado",
        "Escalado": "Derivado",
        "Seguimiento SLA": "En atención",
        "Listo para cierre": "En atención",
        "Cerrado": "Cerrado",
        "Resuelto": "Cerrado",
    }

    return get_catalog_id(
        "estados_caso",
        "estado_caso_id",
        nombre,
        aliases.get(nombre, "Registrado")
    )


def get_tipo_caso_id(nombre: str):
    value = clean(nombre) or "Reclamo"
    low = lower(value)

    if value not in ["Reclamo", "Incidencia", "Solicitud"]:
        if "incid" in low or "falla" in low or "aver" in low:
            value = "Incidencia"
        elif "solic" in low:
            value = "Solicitud"
        else:
            value = "Reclamo"

    return get_catalog_id(
        "tipos_caso",
        "tipo_caso_id",
        value,
        "Reclamo"
    )


def get_categoria_id(nombre: str):
    value = clean(nombre)

    if value and has_table("categorias"):
        row = fetch_one(
            """
            SELECT TOP 1 categoria_id
            FROM categorias
            WHERE LOWER(nombre) = LOWER(?)
              AND activo = 1
            """,
            (value,)
        )

        if row:
            return row["categoria_id"]

    low = lower(value)

    if "fact" in low or "cobro" in low or "monto" in low:
        fallback = "Facturación"
    elif "internet" in low or "servicio" in low or "señal" in low or "lent" in low or "técn" in low:
        fallback = "Soporte técnico"
    else:
        fallback = "Atención al cliente"

    return get_catalog_id(
        "categorias",
        "categoria_id",
        fallback,
        None
    )


def get_prioridad_id(nombre: str):
    value = clean(nombre) or "Media"
    low = lower(value)

    if "crít" in low or "crit" in low:
        value = "Crítica"
    elif "alt" in low:
        value = "Alta"
    elif "baj" in low:
        value = "Baja"
    else:
        value = "Media"

    return get_catalog_id(
        "prioridades",
        "prioridad_id",
        value,
        "Media"
    )


def get_priority_hours(nombre: str):
    value = clean(nombre) or "Media"

    row = safe_fetch_one(
        """
        SELECT TOP 1 horas_sla
        FROM prioridades
        WHERE LOWER(nombre) = LOWER(?)
          AND activo = 1
        """,
        (value,)
    )

    return int(row["horas_sla"] or 48) if row else 48


def supervisor_catalogs_service(supervisor: dict):
    advisors = supervisor_advisors_service(supervisor).get("items", [])

    advisors_catalog = [
        {
            "id": item["id"],
            "value": item["id"],
            "label": item["name"],
            "nombre": item["name"],
            "estado": item.get("status"),
            "capacidad": item.get("capacity")
        }
        for item in advisors
    ]

    available_advisors_catalog = [
        item
        for item in advisors_catalog
        if lower(item.get("estado")) in ["disponible", "activo"]
    ]

    areas = catalog_from_table("areas", "area_id")
    tipos_caso = catalog_from_table("tipos_caso", "tipo_caso_id")
    categorias = catalog_from_table("categorias", "categoria_id")
    prioridades = catalog_from_table("prioridades", "prioridad_id")
    canales = catalog_from_table("canales_ingreso", "canal_ingreso_id")
    estados = catalog_from_table("estados_caso", "estado_caso_id")
    roles = catalog_from_table("roles", "rol_id")

    catalogos = {
        # Casos
        "tipos_caso": tipos_caso or static_catalog(["Reclamo", "Incidencia", "Solicitud"]),
        "categorias_caso": categorias or static_catalog(["Facturación", "Soporte técnico", "Atención al cliente"]),
        "prioridades_caso": prioridades or static_catalog(["Baja", "Media", "Alta", "Crítica"]),
        "canales_atencion": canales or static_catalog(["Portal cliente", "Teléfono", "Correo", "WhatsApp", "Presencial"]),
        "estados_caso_supervisor": estados or static_catalog(["Registrado", "En atención", "Derivado", "Pendiente por cliente", "Cerrado"]),

        # Asesores / carga
        "asesores": advisors_catalog,
        "asesores_con_carga": advisors_catalog,
        "asesores_disponibles": available_advisors_catalog,
        "areas_operativas": areas or static_catalog(["Atención al Cliente", "Soporte técnico", "Facturación", "Backoffice"]),
        "colas_operativas": areas or static_catalog(["Mesa de entrada", "Soporte técnico", "Facturación", "Mesa crítica"]),
        "especialidades_asesor": areas or static_catalog(["Atención al Cliente", "Soporte técnico", "Facturación"]),
        "estados_disponibilidad_asesor": static_catalog(["Disponible", "Ocupado", "Sobrecargado", "No disponible"]),
        "motivos_disponibilidad_asesor": static_catalog(["Turno", "Descanso", "Capacitación", "Sobrecarga", "Soporte interno"]),
        "niveles_carga_asesor": static_catalog(["Baja", "Media", "Alta", "Sobrecarga"]),
        "turnos_asesor": static_catalog(["Mañana", "Tarde", "Noche", "Rotativo"]),
        "rangos_productividad": static_catalog(["Baja", "Media", "Alta"]),

        # Clasificación / asignación
        "rutas_operativas": static_catalog(["Mesa de entrada", "Soporte técnico", "Facturación", "Backoffice", "Mesa crítica"]),
        "motivos_cambio_prioridad": static_catalog(["SLA cercano", "Cliente crítico", "Impacto de servicio", "Reclasificación operativa"]),
        "motivos_observacion": static_catalog(["Información incompleta", "Evidencia insuficiente", "Validación requerida", "Datos inconsistentes"]),
        "criterios_envio_asignacion": static_catalog(["Menor carga", "Especialidad", "SLA más cercano", "Prioridad crítica"]),
        "criterios_asignacion": static_catalog(["menor_carga", "especialidad", "sla_cercano", "prioridad"]),
        "visibilidades_asignacion": static_catalog(["asesor", "supervisor", "interno"]),
        "motivos_reasignacion": static_catalog(["sobrecarga", "especialidad", "ausencia", "riesgo_sla"]),
        "prioridades_movimiento": static_catalog(["Baja", "Media", "Alta", "Crítica"]),
        "areas_derivacion": areas or static_catalog(["Soporte técnico", "Facturación", "Backoffice"]),
        "reglas_sla_interno": static_catalog(["4 horas", "8 horas", "24 horas", "48 horas"]),
        "niveles_escalamiento": static_catalog(["Supervisor senior", "Jefatura", "Gerencia", "Mesa crítica"]),
        "motivos_escalamiento": static_catalog(["SLA vencido", "Cliente crítico", "Bloqueo operativo", "Reincidencia"]),
        "canales_alerta": static_catalog(["SISTEMA", "CORREO", "SMS", "WHATSAPP"]),

        # SLA
        "rangos_sla_supervisor": static_catalog(["vencido", "menos_4h", "menos_8h", "menos_24h", "mayor_24h"]),
        "niveles_riesgo_sla": static_catalog(["Vencido", "Riesgo alto", "Riesgo medio", "Controlado"]),
        "destinatarios_alerta_sla": static_catalog(["asesor", "supervisor", "jefatura", "mesa_critica"]),
        "plantillas_alerta_sla": static_catalog(["Alerta preventiva", "SLA vencido", "Escalamiento requerido"]),
        "acciones_seguimiento_sla": static_catalog(["Contactar asesor", "Solicitar avance", "Escalar", "Registrar bloqueo"]),
        "resultados_seguimiento_sla": static_catalog(["Avance registrado", "Sin respuesta", "Bloqueado", "Escalado"]),

        # Indicadores / reportes
        "periodos_indicadores": static_catalog(["semana", "mes", "trimestre"]),
        "periodos_indicadores_base": static_catalog(["semana_actual", "mes_actual", "trimestre_actual"]),
        "periodos_indicadores_comparacion": static_catalog(["semana_anterior", "mes_anterior", "trimestre_anterior"]),
        "grupos_indicadores_supervisor": static_catalog(["SLA", "Productividad", "Asignación", "Calidad", "Carga"]),
        "tipos_indicador_supervisor": static_catalog(["Operativo", "Ejecutivo", "Auditable"]),
        "tipos_reporte_supervisor": static_catalog(["dashboard", "casos_pendientes", "asignaciones", "carga_asesores", "monitoreo_sla", "indicadores", "auditoria"]),
        "periodos_reporte": static_catalog(["hoy", "semana", "mes", "trimestre", "personalizado"]),
        "alcances_reporte": static_catalog(["vista_actual", "filtros_actuales", "todo_modulo", "resumen_ejecutivo"]),
        "estados_reporte": static_catalog(["Generado", "Disponible", "Programado", "En proceso", "Error"]),
        "niveles_detalle_reporte": static_catalog(["operativo", "ejecutivo", "auditable"]),
        "frecuencias_reporte": static_catalog(["diario", "semanal", "quincenal", "mensual"]),
        "formatos_exportacion_supervisor": static_catalog([
            {"id": "pdf", "value": "pdf", "label": "PDF ejecutivo"},
            {"id": "docx", "value": "docx", "label": "Word informe"},
            {"id": "xlsx", "value": "xlsx", "label": "Excel analítico"},
            {"id": "png", "value": "png", "label": "Imagen"},
            {"id": "csv", "value": "csv", "label": "CSV datos"},
            {"id": "dashboard", "value": "dashboard", "label": "Dashboard compartible"},
        ]),
        "alcances_exportacion_supervisor": static_catalog(["vista_actual", "filtrados", "seleccionados", "todos"]),
        "destinos_exportacion": static_catalog(["descarga_local", "historial_reportes", "compartir_enlace"]),

        # Auditoría / configuración
        "usuarios_auditables": catalog_from_table("usuarios", "usuario_id", "username", "estado IN ('ACTIVO', 'INACTIVO', 'BLOQUEADO')"),
        "roles": roles or static_catalog(["ASESOR", "SUPERVISOR", "ADMINISTRADOR", "CLIENTE"]),
        "acciones_auditoria_caso": static_catalog(["Asignación", "Reasignación", "Derivación", "Escalamiento", "Cambio de prioridad", "Exportación", "Configuración"]),
        "criticidades_auditoria": static_catalog(["Baja", "Media", "Alta", "Crítica"]),
        "resultados_auditoria": static_catalog(["Exitoso", "Error", "Advertencia"]),
        "modulos_auditoria": static_catalog(["Supervisor", "Casos", "SLA", "Asignaciones", "Reportes", "Configuración"]),
        "categorias_config_supervision": static_catalog(["sla", "prioridad", "asignacion", "alerta", "ruta", "general"]),
        "estados_configuracion": static_catalog(["Activo", "Inactivo", "Pendiente"]),
        "responsables_configuracion": static_catalog(["Administrador", "Supervisor", "Sistema"]),
        "impactos_configuracion": static_catalog(["bajo", "medio", "alto", "critico"]),
        "tipos_solicitud_configuracion": static_catalog(["sla", "prioridad", "ruta", "asignacion", "alerta", "otro"]),
        "tipos_cliente": static_catalog(["PERSONA", "EMPRESA"]),
        "niveles_impacto_caso": static_catalog(["bajo", "medio", "alto", "critico"]),
    }

    return response_ok(
        "Catálogos cargados.",
        catalogs=catalogos,
        catalogos=catalogos,
        **catalogos
    )


# =========================================================
# NOMBRES / FORMATEADORES DE CASO Y ASESOR
# =========================================================

def get_cliente_nombre(row: dict):
    if row.get("tipo_cliente") == "EMPRESA":
        return row.get("razon_social") or "Cliente empresa"

    return f"{row.get('nombres') or ''} {row.get('apellidos') or ''}".strip() or "Cliente"


def advisor_full_name(row: dict):
    full = f"{row.get('nombres') or ''} {row.get('apellidos') or ''}".strip()

    return full or row.get("username") or row.get("correo") or "Asesor"


def case_advisor_name(row: dict):
    full = f"{row.get('asesor_nombres') or ''} {row.get('asesor_apellidos') or ''}".strip()

    return (
        full
        or row.get("asesor_username")
        or row.get("asesor_correo")
        or "Sin asignar"
    )


def suggested_action(estado: str, asignado: bool, hours: int):
    value = lower(estado)

    if not asignado:
        return "Asignar asesor responsable."

    if hours < 0:
        return "Escalar por SLA vencido."

    if hours <= 8:
        return "Registrar seguimiento y alertar responsable."

    if "pendiente" in value:
        return "Desbloquear caso pendiente."

    if "derivado" in value:
        return "Dar seguimiento al área derivada."

    if "cerrado" in value or "resuelto" in value:
        return "Caso finalizado."

    return "Monitorear avance del caso."


def risk_type(row: dict, hours: int):
    estado = lower(row.get("estado"))

    if hours < 0:
        return "vencidos"

    if hours <= 8:
        return "riesgo_alto"

    if row.get("pendiente_cliente") or "pendiente" in estado:
        return "bloqueados"

    if "derivado" in estado:
        return "derivados"

    if "escal" in estado:
        return "escalados"

    return "todos"


def map_case(row: dict):
    hours = remaining_hours(row.get("fecha_limite_resolucion"))
    estado = row.get("estado") or "Registrado"
    prioridad = row.get("prioridad") or "Media"
    tipo = row.get("tipo_caso") or "Caso"

    asesor_nombre = case_advisor_name(row)
    asignado = row.get("responsable_actual_usuario_id") is not None

    derived = "derivado" in lower(estado)
    escalated = "escal" in lower(estado)
    observed = "observ" in lower(estado) or bool(row.get("pendiente_cliente"))
    blocked = bool(row.get("pendiente_cliente")) or "pendiente" in lower(estado)

    cliente_nombre = get_cliente_nombre(row)

    classification_status = "Clasificado" if tipo and tipo != "Caso" else "Sin clasificar"
    assignment_status = "Asignado" if asignado else "Sin asesor"

    sla_text = "Vencido" if hours < 0 else ("Sin plazo" if hours == 999 else f"{hours}h restantes")

    sla_risk = (
        "Vencido"
        if hours < 0
        else "Riesgo alto"
        if hours <= 8
        else "Riesgo medio"
        if hours <= 24
        else "Controlado"
    )

    assignment_flow = (
        "Escalado"
        if escalated
        else "Derivado"
        if derived
        else "Asignado"
        if asignado
        else "Pendiente asignación"
    )

    pending_type = (
        "sin_asignar"
        if not asignado
        else "observados"
        if observed
        else "sin_clasificar"
        if classification_status == "Sin clasificar"
        else "todos"
    )

    return {
        "id": row["caso_id"],
        "case_id": row["caso_id"],
        "caso_id": row["caso_id"],

        "code": row["codigo_caso"],
        "codigo_caso": row["codigo_caso"],
        "codigo": row["codigo_caso"],

        "icon": "🔥" if priority_order(prioridad) == 4 else ("⚠️" if tipo == "Incidencia" else "📝"),

        "type": tipo,
        "tipo": tipo,
        "tipo_caso": tipo,

        "category": row.get("categoria"),
        "categoria": row.get("categoria"),

        "clientName": cliente_nombre,
        "cliente_nombre": cliente_nombre,
        "cliente": cliente_nombre,

        "clientType": row.get("tipo_cliente") or "Cliente",
        "tipo_cliente": row.get("tipo_cliente") or "Cliente",

        "documento": f"{row.get('documento_tipo') or ''} {row.get('documento_numero') or ''}".strip(),
        "correo_cliente": row.get("cliente_correo"),
        "telefono_cliente": row.get("cliente_telefono"),

        "channel": row.get("canal") or "Portal cliente",
        "canal": row.get("canal") or "Portal cliente",

        "service": row.get("servicio") or row.get("plan_nombre") or "Servicio asociado",
        "servicio": row.get("servicio") or row.get("plan_nombre") or "Servicio asociado",

        "title": row.get("titulo") or row["codigo_caso"],
        "titulo": row.get("titulo") or row["codigo_caso"],

        "description": row.get("descripcion") or "",
        "descripcion": row.get("descripcion") or "",

        "status": estado,
        "estado": estado,

        "classificationStatus": classification_status,
        "estado_clasificacion": classification_status,

        "assignmentStatus": assignment_status,
        "estado_asignacion": assignment_status,

        "assignmentFlow": assignment_flow,
        "flujo_asignacion": assignment_flow,

        "advisorId": row.get("responsable_actual_usuario_id"),
        "asesor_id": row.get("responsable_actual_usuario_id"),

        "advisorName": asesor_nombre,
        "asesor_nombre": asesor_nombre,
        "responsable": asesor_nombre,

        "area": row.get("area_nombre") or "Mesa de entrada",
        "area_nombre": row.get("area_nombre") or "Mesa de entrada",

        "priority": prioridad,
        "prioridad": prioridad,

        "slaHours": hours,
        "sla_hours": hours,
        "horas_sla": hours,

        "slaText": sla_text,
        "sla": sla_text,

        "slaRisk": sla_risk,
        "riesgo_sla": sla_risk,

        "slaGroup": sla_group(hours),
        "sla_group": sla_group(hours),

        "riskType": risk_type(row, hours),
        "tipo_riesgo": risk_type(row, hours),

        "pendingType": pending_type,
        "tipo_pendiente": pending_type,

        "followupStatus": row.get("estado_seguimiento") or "Sin seguimiento",
        "estado_seguimiento": row.get("estado_seguimiento") or "Sin seguimiento",

        "blocked": blocked,
        "bloqueado": blocked,

        "escalated": escalated,
        "escalado": escalated,

        "derived": derived,
        "derivado": derived,

        "observed": observed,
        "observado": observed,

        "createdAt": row.get("fecha_registro"),
        "fecha_registro": row.get("fecha_registro"),

        "updatedAt": row.get("fecha_actualizacion"),
        "fecha_actualizacion": row.get("fecha_actualizacion"),

        "deadline": row.get("fecha_limite_resolucion"),
        "fecha_limite_resolucion": row.get("fecha_limite_resolucion"),

        "action": suggested_action(estado, asignado, hours),
        "proximo_paso": suggested_action(estado, asignado, hours),

        "reason": row.get("descripcion") or "",
        "motivo": row.get("descripcion") or "",
    }


def map_advisor(row: dict):
    name = advisor_full_name(row)

    cases = int(row.get("casos_asignados") or 0)
    critical = int(row.get("casos_criticos") or 0)
    sla_risk = int(row.get("casos_sla_riesgo") or 0)
    closed = int(row.get("casos_cerrados_semana") or 0)

    capacity = min(100, cases * 7)
    productivity = min(100, 55 + closed * 8)

    user_state = row.get("estado") or "ACTIVO"

    if user_state != "ACTIVO":
        status = "No disponible"
    elif capacity >= 90:
        status = "Sobrecargado"
    elif capacity >= 75:
        status = "Ocupado"
    else:
        status = "Disponible"

    return {
        "id": row["usuario_id"],
        "usuario_id": row["usuario_id"],
        "advisor_id": row["usuario_id"],

        "name": name,
        "nombre": name,

        "initials": initials(name),
        "iniciales": initials(name),

        "specialty": row.get("area_nombre") or row.get("cargo") or "Atención al Cliente",
        "especialidad": row.get("area_nombre") or row.get("cargo") or "Atención al Cliente",

        "status": status,
        "estado": status,
        "estado_usuario": user_state,

        "cases": cases,
        "casos": cases,
        "casos_asignados": cases,

        "critical": critical,
        "criticos": critical,
        "casos_criticos": critical,

        "slaRisk": sla_risk,
        "riesgo_sla": sla_risk,
        "casos_sla_riesgo": sla_risk,

        "closed": closed,
        "cerrados": closed,

        "productivity": productivity,
        "productividad": productivity,

        "capacity": capacity,
        "capacidad": capacity,

        "email": row.get("correo"),
        "correo": row.get("correo"),

        "area": row.get("area_nombre") or "",
        "area_nombre": row.get("area_nombre") or "",

        "shift": row.get("turno") or row.get("shift") or "Rotativo",
        "turno": row.get("turno") or row.get("shift") or "Rotativo",
    }


# =========================================================
# CONSULTA BASE DE CASOS Y ASESORES
# =========================================================

BASE_CASE_SELECT = """
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
        ec.es_final AS estado_final,
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
        cli.telefono AS cliente_telefono,
        cli.usuario_id AS cliente_usuario_id,

        u.username AS asesor_username,
        u.correo AS asesor_correo,
        p.nombres AS asesor_nombres,
        p.apellidos AS asesor_apellidos,
        a.nombre AS area_nombre,

        'Sin seguimiento' AS estado_seguimiento
    FROM casos c
    INNER JOIN tipos_caso tc
        ON tc.tipo_caso_id = c.tipo_caso_id
    INNER JOIN categorias cat
        ON cat.categoria_id = c.categoria_id
    INNER JOIN prioridades pr
        ON pr.prioridad_id = c.prioridad_id
    INNER JOIN estados_caso ec
        ON ec.estado_caso_id = c.estado_caso_id
    LEFT JOIN canales_ingreso ci
        ON ci.canal_ingreso_id = c.canal_ingreso_id
    LEFT JOIN servicios_contratados sc
        ON sc.servicio_contratado_id = c.servicio_contratado_id
    LEFT JOIN servicios s
        ON s.servicio_id = sc.servicio_id
    INNER JOIN clientes cli
        ON cli.cliente_id = c.cliente_id
    LEFT JOIN usuarios u
        ON u.usuario_id = c.responsable_actual_usuario_id
    LEFT JOIN personal p
        ON p.usuario_id = u.usuario_id
    LEFT JOIN areas a
        ON a.area_id = p.area_id
"""


def get_case(case_id: str):
    numeric_id, code = normalize_identifier(case_id)

    row = fetch_one(
        f"""
        {BASE_CASE_SELECT}
        WHERE c.caso_id = ?
           OR c.codigo_caso = ?
        """,
        (numeric_id, code)
    )

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Caso no encontrado."
        )

    return row


def get_advisor(advisor_id: int, require_active=True):
    row = fetch_one(
        """
        SELECT TOP 1
            u.usuario_id,
            u.username,
            u.correo,
            u.estado,
            p.personal_id,
            p.nombres,
            p.apellidos,
            p.cargo,
            p.area_id,
            a.nombre AS area_nombre
        FROM usuarios u
        INNER JOIN roles r
            ON r.rol_id = u.rol_id
        LEFT JOIN personal p
            ON p.usuario_id = u.usuario_id
        LEFT JOIN areas a
            ON a.area_id = p.area_id
        WHERE u.usuario_id = ?
          AND (
                r.codigo = 'ASESOR'
                OR UPPER(r.nombre) = 'ASESOR'
          )
        """,
        (advisor_id,)
    )

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Asesor no encontrado."
        )

    if require_active and row.get("estado") != "ACTIVO":
        raise HTTPException(
            status_code=400,
            detail="El asesor seleccionado no está activo."
        )

    return row


def build_case_where(
    scope="all",
    q="",
    estado="todos",
    prioridad="todos",
    tipo="todos",
    asesor="todos",
    area="todos",
    canal="todos",
    tipo_cliente="todos",
    sla="todos",
    riesgo="todos",
    seguimiento="todos",
    fecha_desde="",
    fecha_hasta=""
):
    where = ["1 = 1"]
    params = []

    if scope in ["all", "pending", "assignments", "sla"]:
        where.append("c.fecha_cierre IS NULL")

    if scope == "pending":
        where.append(
            """
            (
                c.responsable_actual_usuario_id IS NULL
                OR ec.es_final = 0
                OR pr.nombre = 'Crítica'
                OR c.fecha_limite_resolucion <= DATEADD(HOUR, 8, SYSDATETIME())
                OR c.pendiente_cliente = 1
            )
            """
        )

    elif scope == "assignments":
        where.append(
            """
            (
                c.responsable_actual_usuario_id IS NULL
                OR ec.nombre IN ('Derivado', 'Escalado', 'Pendiente por cliente')
                OR pr.nombre = 'Crítica'
                OR c.fecha_limite_resolucion <= DATEADD(HOUR, 24, SYSDATETIME())
            )
            """
        )

    elif scope == "sla":
        where.append(
            """
            c.fecha_limite_resolucion IS NOT NULL
            AND (
                c.fecha_limite_resolucion <= DATEADD(HOUR, 24, SYSDATETIME())
                OR ec.nombre IN ('Derivado', 'Escalado', 'Pendiente por cliente')
                OR pr.nombre = 'Crítica'
            )
            """
        )

    if clean(q):
        term = f"%{clean(q)}%"

        where.append(
            """
            (
                c.codigo_caso LIKE ?
                OR c.titulo LIKE ?
                OR c.descripcion LIKE ?
                OR cli.nombres LIKE ?
                OR cli.apellidos LIKE ?
                OR cli.razon_social LIKE ?
                OR u.username LIKE ?
                OR p.nombres LIKE ?
                OR p.apellidos LIKE ?
            )
            """
        )

        params.extend([term] * 9)

    if not is_all(estado):
        where.append("LOWER(ec.nombre) = LOWER(?)")
        params.append(clean(estado))

    if not is_all(prioridad):
        where.append("LOWER(pr.nombre) = LOWER(?)")
        params.append(clean(prioridad))

    if not is_all(tipo):
        where.append("LOWER(tc.nombre) = LOWER(?)")
        params.append(clean(tipo))

    if not is_all(canal):
        where.append("LOWER(ci.nombre) = LOWER(?)")
        params.append(clean(canal))

    if not is_all(tipo_cliente):
        where.append("LOWER(cli.tipo_cliente) = LOWER(?)")
        params.append(clean(tipo_cliente))

    if not is_all(area):
        where.append("LOWER(a.nombre) = LOWER(?)")
        params.append(clean(area))

    if not is_all(asesor):
        if clean(asesor).isdigit():
            where.append("c.responsable_actual_usuario_id = ?")
            params.append(int(asesor))
        else:
            term = f"%{clean(asesor)}%"
            where.append("(u.username LIKE ? OR p.nombres LIKE ? OR p.apellidos LIKE ?)")
            params.extend([term, term, term])

    start_date = parse_date(fecha_desde)
    end_date = parse_date(fecha_hasta)

    if start_date:
        where.append("c.fecha_registro >= ?")
        params.append(start_date)

    if end_date:
        where.append("c.fecha_registro < DATEADD(DAY, 1, ?)")
        params.append(end_date)

    if not is_all(sla):
        value = lower(sla)

        if value == "vencido":
            where.append("c.fecha_limite_resolucion < SYSDATETIME()")
        elif value == "menos_4h":
            where.append("c.fecha_limite_resolucion BETWEEN SYSDATETIME() AND DATEADD(HOUR, 4, SYSDATETIME())")
        elif value == "menos_8h":
            where.append("c.fecha_limite_resolucion BETWEEN SYSDATETIME() AND DATEADD(HOUR, 8, SYSDATETIME())")
        elif value == "menos_24h":
            where.append("c.fecha_limite_resolucion BETWEEN SYSDATETIME() AND DATEADD(HOUR, 24, SYSDATETIME())")

    if not is_all(riesgo):
        value = lower(riesgo)

        if "vencido" in value:
            where.append("c.fecha_limite_resolucion < SYSDATETIME()")
        elif "alto" in value:
            where.append("c.fecha_limite_resolucion BETWEEN SYSDATETIME() AND DATEADD(HOUR, 8, SYSDATETIME())")
        elif "medio" in value:
            where.append("c.fecha_limite_resolucion BETWEEN DATEADD(HOUR, 8, SYSDATETIME()) AND DATEADD(HOUR, 24, SYSDATETIME())")

    return " AND ".join(where), params


def supervisor_cases_service(
    supervisor: dict,
    scope: str = "all",
    q: str = "",
    estado: str = "todos",
    prioridad: str = "todos",
    tipo: str = "todos",
    asesor: str = "todos",
    area: str = "todos",
    canal: str = "todos",
    tipo_cliente: str = "todos",
    sla: str = "todos",
    riesgo: str = "todos",
    seguimiento: str = "todos",
    fecha_desde: str = "",
    fecha_hasta: str = ""
):
    where_sql, params = build_case_where(
        scope=scope,
        q=q,
        estado=estado,
        prioridad=prioridad,
        tipo=tipo,
        asesor=asesor,
        area=area,
        canal=canal,
        tipo_cliente=tipo_cliente,
        sla=sla,
        riesgo=riesgo,
        seguimiento=seguimiento,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )

    rows = fetch_all(
        f"""
        {BASE_CASE_SELECT}
        WHERE {where_sql}
        ORDER BY
            CASE WHEN c.fecha_limite_resolucion IS NULL THEN 1 ELSE 0 END,
            c.fecha_limite_resolucion ASC,
            c.fecha_registro DESC
        """,
        tuple(params)
    )

    items = [map_case(row) for row in rows]

    return response_ok(
        "Casos cargados.",
        items=items,
        cases=items,
        casos=items,
        total=len(items)
    )


def supervisor_pending_cases_service(
    supervisor: dict,
    filtro: str = "todos",
    q: str = "",
    estado: str = "todos",
    prioridad: str = "todos",
    tipo: str = "todos",
    canal: str = "todos",
    tipo_cliente: str = "todos",
    sla: str = "todos",
    fecha_desde: str = "",
    fecha_hasta: str = ""
):
    response = supervisor_cases_service(
        supervisor=supervisor,
        scope="pending",
        q=q,
        estado=estado,
        prioridad=prioridad,
        tipo=tipo,
        canal=canal,
        tipo_cliente=tipo_cliente,
        sla=sla,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )

    items = response["items"]
    value = lower(filtro)

    if value == "sin_clasificar":
        items = [item for item in items if item.get("classificationStatus") == "Sin clasificar"]
    elif value == "sin_asignar":
        items = [item for item in items if not item.get("advisorId")]
    elif value == "observados":
        items = [item for item in items if item.get("observed")]
    elif value == "criticos":
        items = [item for item in items if priority_order(item.get("priority")) == 4]
    elif value == "sla_riesgo":
        items = [item for item in items if item.get("slaHours", 999) <= 8]

    return response_ok(
        "Casos pendientes cargados.",
        items=items,
        cases=items,
        casos=items,
        pending_cases=items,
        casos_pendientes=items,
        total=len(items)
    )


def supervisor_assignments_service(
    supervisor: dict,
    filtro: str = "todos",
    q: str = "",
    estado: str = "todos",
    prioridad: str = "todos",
    tipo: str = "todos",
    asesor: str = "todos",
    area: str = "todos",
    sla: str = "todos",
    fecha_desde: str = "",
    fecha_hasta: str = ""
):
    response = supervisor_cases_service(
        supervisor=supervisor,
        scope="assignments",
        q=q,
        estado=estado,
        prioridad=prioridad,
        tipo=tipo,
        asesor=asesor,
        area=area,
        sla=sla,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )

    items = response["items"]
    value = lower(filtro)

    if value == "sin_asesor":
        items = [item for item in items if not item.get("advisorId")]
    elif value == "reasignar":
        items = [item for item in items if item.get("blocked")]
    elif value == "derivados":
        items = [item for item in items if item.get("derived")]
    elif value == "escalados":
        items = [item for item in items if item.get("escalated")]
    elif value == "criticos":
        items = [item for item in items if priority_order(item.get("priority")) == 4]

    return response_ok(
        "Asignaciones cargadas.",
        items=items,
        cases=items,
        casos=items,
        assignments=items,
        asignaciones=items,
        total=len(items)
    )


def supervisor_sla_monitor_service(
    supervisor: dict,
    filtro: str = "todos",
    q: str = "",
    estado: str = "todos",
    prioridad: str = "todos",
    tipo: str = "todos",
    asesor: str = "todos",
    area: str = "todos",
    canal: str = "todos",
    riesgo: str = "todos",
    seguimiento: str = "todos",
    fecha_desde: str = "",
    fecha_hasta: str = ""
):
    response = supervisor_cases_service(
        supervisor=supervisor,
        scope="sla",
        q=q,
        estado=estado,
        prioridad=prioridad,
        tipo=tipo,
        asesor=asesor,
        area=area,
        canal=canal,
        riesgo=riesgo,
        seguimiento=seguimiento,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )

    items = response["items"]
    value = lower(filtro)

    if value == "vencidos":
        items = [item for item in items if item.get("slaHours", 999) < 0]
    elif value == "riesgo_alto":
        items = [item for item in items if 0 <= item.get("slaHours", 999) <= 8]
    elif value == "vence_hoy":
        items = [item for item in items if item.get("slaGroup") == "vence_hoy"]
    elif value == "bloqueados":
        items = [item for item in items if item.get("blocked")]
    elif value == "derivados":
        items = [item for item in items if item.get("derived")]

    return response_ok(
        "Monitoreo SLA cargado.",
        items=items,
        cases=items,
        casos=items,
        sla_cases=items,
        casos_sla=items,
        total=len(items)
    )


def supervisor_case_detail_service(supervisor: dict, case_id: str):
    row = get_case(case_id)
    item = map_case(row)

    history = safe_fetch_all(
        """
        SELECT
            h.historial_id,
            h.accion,
            h.observacion,
            h.es_visible_cliente,
            h.fecha_evento,
            u.username,
            u.correo
        FROM historial_caso h
        LEFT JOIN usuarios u
            ON u.usuario_id = h.usuario_id
        WHERE h.caso_id = ?
        ORDER BY h.fecha_evento ASC
        """,
        (row["caso_id"],)
    )

    evidence = safe_fetch_all(
        """
        SELECT
            evidencia_id,
            nombre_archivo,
            ruta_archivo,
            tipo_archivo,
            tipo_mime,
            tamano_bytes,
            descripcion,
            fecha_subida
        FROM evidencias
        WHERE caso_id = ?
        ORDER BY fecha_subida DESC
        """,
        (row["caso_id"],)
    )

    trace = [
        {
            "id": h.get("historial_id"),
            "icon": audit_icon(h.get("accion")),
            "title": h.get("accion"),
            "text": h.get("observacion"),
            "date": h.get("fecha_evento"),
            "user": h.get("username") or "Sistema"
        }
        for h in history
    ]

    item["history"] = history
    item["historial"] = history
    item["trace"] = trace
    item["trazabilidad"] = trace
    item["evidence"] = evidence
    item["evidencias"] = evidence

    return response_ok(
        "Detalle cargado.",
        case=item,
        caso=item,
        item=item
    )


def supervisor_advisors_service(
    supervisor: dict,
    q: str = "",
    area: str = "todos",
    especialidad: str = "todos",
    disponibilidad: str = "todos",
    carga: str = "todos",
    turno: str = "todos",
    productividad: str = "todos"
):
    rows = fetch_all(
        """
        SELECT
            u.usuario_id,
            u.username,
            u.correo,
            u.estado,
            p.personal_id,
            p.nombres,
            p.apellidos,
            p.cargo,
            p.area_id,
            a.nombre AS area_nombre,

            (
                SELECT COUNT(*)
                FROM casos c
                INNER JOIN estados_caso ec
                    ON ec.estado_caso_id = c.estado_caso_id
                WHERE c.responsable_actual_usuario_id = u.usuario_id
                  AND c.fecha_cierre IS NULL
                  AND ec.es_final = 0
            ) AS casos_asignados,

            (
                SELECT COUNT(*)
                FROM casos c
                INNER JOIN prioridades pr
                    ON pr.prioridad_id = c.prioridad_id
                INNER JOIN estados_caso ec
                    ON ec.estado_caso_id = c.estado_caso_id
                WHERE c.responsable_actual_usuario_id = u.usuario_id
                  AND c.fecha_cierre IS NULL
                  AND ec.es_final = 0
                  AND pr.nombre = 'Crítica'
            ) AS casos_criticos,

            (
                SELECT COUNT(*)
                FROM casos c
                INNER JOIN estados_caso ec
                    ON ec.estado_caso_id = c.estado_caso_id
                WHERE c.responsable_actual_usuario_id = u.usuario_id
                  AND c.fecha_cierre IS NULL
                  AND ec.es_final = 0
                  AND c.fecha_limite_resolucion IS NOT NULL
                  AND c.fecha_limite_resolucion <= DATEADD(HOUR, 8, SYSDATETIME())
            ) AS casos_sla_riesgo,

            (
                SELECT COUNT(*)
                FROM casos c
                WHERE c.responsable_actual_usuario_id = u.usuario_id
                  AND c.fecha_cierre >= DATEADD(DAY, -7, SYSDATETIME())
            ) AS casos_cerrados_semana
        FROM usuarios u
        INNER JOIN roles r
            ON r.rol_id = u.rol_id
        LEFT JOIN personal p
            ON p.usuario_id = u.usuario_id
        LEFT JOIN areas a
            ON a.area_id = p.area_id
        WHERE (
                r.codigo = 'ASESOR'
                OR UPPER(r.nombre) = 'ASESOR'
              )
          AND u.estado IN ('ACTIVO', 'BLOQUEADO', 'INACTIVO')
        ORDER BY casos_asignados DESC, p.nombres ASC
        """
    )

    items = [map_advisor(row) for row in rows]

    if clean(q):
        term = lower(q)
        items = [
            item for item in items
            if term in lower(item.get("name"))
            or term in lower(item.get("email"))
            or term in lower(item.get("specialty"))
        ]

    if not is_all(area):
        items = [
            item for item in items
            if lower(item.get("area")) == lower(area)
            or lower(item.get("specialty")) == lower(area)
        ]

    if not is_all(especialidad):
        items = [
            item for item in items
            if lower(item.get("specialty")) == lower(especialidad)
        ]

    if not is_all(disponibilidad):
        items = [
            item for item in items
            if lower(item.get("status")) == lower(disponibilidad)
        ]

    if not is_all(carga):
        value = lower(carga)

        if "baja" in value:
            items = [item for item in items if item.get("capacity", 0) < 50]
        elif "media" in value:
            items = [item for item in items if 50 <= item.get("capacity", 0) < 75]
        elif "alta" in value:
            items = [item for item in items if 75 <= item.get("capacity", 0) < 90]
        elif "sobrecarga" in value:
            items = [item for item in items if item.get("capacity", 0) >= 90]

    if not is_all(productividad):
        value = lower(productividad)

        if "baja" in value:
            items = [item for item in items if item.get("productivity", 0) < 70]
        elif "media" in value:
            items = [item for item in items if 70 <= item.get("productivity", 0) < 90]
        elif "alta" in value:
            items = [item for item in items if item.get("productivity", 0) >= 90]

    return response_ok(
        "Asesores cargados.",
        items=items,
        advisors=items,
        asesores=items,
        team=items,
        equipo=items,
        total=len(items)
    )


def supervisor_advisor_detail_service(supervisor: dict, advisor_id: int):
    advisor_row = get_advisor(int(advisor_id), require_active=False)
    advisor = map_advisor({
        **advisor_row,
        "casos_asignados": 0,
        "casos_criticos": 0,
        "casos_sla_riesgo": 0,
        "casos_cerrados_semana": 0
    })

    cases_response = supervisor_cases_service(
        supervisor=supervisor,
        scope="all",
        asesor=str(advisor_id)
    )

    cases = cases_response["items"]

    advisor["cases"] = len(cases)
    advisor["casos"] = len(cases)
    advisor["critical"] = len([item for item in cases if priority_order(item.get("priority")) == 4])
    advisor["criticos"] = advisor["critical"]
    advisor["slaRisk"] = len([item for item in cases if item.get("slaHours", 999) <= 8])
    advisor["riesgo_sla"] = advisor["slaRisk"]
    advisor["capacity"] = min(100, advisor["cases"] * 7)
    advisor["capacidad"] = advisor["capacity"]

    return response_ok(
        "Detalle de asesor cargado.",
        advisor=advisor,
        asesor=advisor,
        cases=cases,
        casos=cases
    )


def supervisor_advisor_load_service(
    supervisor: dict,
    filtro: str = "todos",
    q: str = "",
    area: str = "todos",
    especialidad: str = "todos",
    disponibilidad: str = "todos",
    carga: str = "todos",
    turno: str = "todos",
    productividad: str = "todos",
    min_criticos: str = "",
    min_sla: str = ""
):
    response = supervisor_advisors_service(
        supervisor=supervisor,
        q=q,
        area=area,
        especialidad=especialidad,
        disponibilidad=disponibilidad,
        carga=carga,
        turno=turno,
        productividad=productividad
    )

    items = response["items"]
    value = lower(filtro)

    if value == "disponibles":
        items = [item for item in items if lower(item.get("status")) == "disponible"]
    elif value == "sobrecargados":
        items = [item for item in items if item.get("capacity", 0) >= 85]
    elif value == "criticos":
        items = [item for item in items if item.get("critical", 0) > 0]
    elif value == "sla_riesgo":
        items = [item for item in items if item.get("slaRisk", 0) > 0]
    elif value == "no_disponibles":
        items = [item for item in items if lower(item.get("status")) == "no disponible"]

    min_critical = as_int(min_criticos, 0)
    min_sla_value = as_int(min_sla, 0)

    if min_critical:
        items = [item for item in items if item.get("critical", 0) >= min_critical]

    if min_sla_value:
        items = [item for item in items if item.get("slaRisk", 0) >= min_sla_value]

    cases = supervisor_cases_service(supervisor, scope="assignments")["items"]

    kpis = [
        {
            "icon": "👥",
            "value": len(items),
            "label": "Asesores visibles",
            "description": "Resultado de filtros."
        },
        {
            "icon": "🟢",
            "value": len([a for a in items if lower(a.get("status")) == "disponible"]),
            "label": "Disponibles",
            "description": "Pueden recibir casos."
        },
        {
            "icon": "⚠️",
            "value": len([a for a in items if a.get("capacity", 0) >= 85]),
            "label": "Sobrecargados",
            "description": "Carga alta."
        },
        {
            "icon": "⏱️",
            "value": sum(a.get("slaRisk", 0) for a in items),
            "label": "SLA en riesgo",
            "description": "Casos próximos a vencer."
        }
    ]

    ai_summary = [
        {
            "title": "Balance de carga",
            "text": f"{len([a for a in items if a.get('capacity', 0) >= 85])} asesores presentan carga alta."
        },
        {
            "title": "Recomendación",
            "text": "Usa redistribución con vista previa antes de mover casos."
        }
    ]

    return response_ok(
        "Carga de asesores cargada.",
        items=items,
        advisors=items,
        asesores=items,
        cases=cases,
        casos=cases,
        kpis=kpis,
        ai_summary=ai_summary,
        resumen_ia=ai_summary,
        total=len(items)
    )


# =========================================================
# HISTORIAL / NOTIFICACIONES / AUDITORÍA
# =========================================================

def insert_history(cursor, case_id, user_id, action, observation, visible=False):
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
        VALUES (?, ?, ?, ?, ?, SYSDATETIME())
        """,
        (
            case_id,
            user_id,
            action,
            observation,
            1 if visible else 0
        )
    )


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
            tipo,
            titulo,
            mensaje
        )
    )


def insert_audit(
    cursor,
    supervisor: dict,
    tipo: str,
    accion: str,
    detalle: str,
    valor_anterior="-",
    valor_nuevo="-",
    critico=False
):
    cursor.execute(
        """
        INSERT INTO auditoria_admin (
            modulo,
            tipo,
            accion,
            usuario_id,
            usuario_nombre,
            valor_anterior,
            valor_nuevo,
            resultado,
            critico,
            detalle,
            fecha_evento
        )
        VALUES ('Supervisor', ?, ?, ?, ?, ?, ?, 'Exitoso', ?, ?, SYSDATETIME())
        """,
        (
            tipo,
            accion,
            supervisor.get("usuario_id"),
            supervisor_name(supervisor),
            clean(valor_anterior),
            clean(valor_nuevo),
            1 if critico else 0,
            detalle,
        )
    )


def run_case_action(
    case_id: str,
    supervisor: dict,
    action_name: str,
    payload: dict,
    update_sql: str,
    params: tuple,
    visible=False,
    audit_type="caso",
    notify_client=False
):
    case = get_case(case_id)
    conn = get_connection()

    try:
        cursor = conn.cursor()
        cursor.execute(update_sql, params)

        observation = (
            payload.get("comentario")
            or payload.get("motivo")
            or payload.get("mensaje")
            or payload.get("razon")
            or payload.get("detalle")
            or action_name
        )

        insert_history(
            cursor=cursor,
            case_id=case["caso_id"],
            user_id=supervisor.get("usuario_id"),
            action=action_name,
            observation=observation,
            visible=visible
        )

        insert_audit(
            cursor=cursor,
            supervisor=supervisor,
            tipo=audit_type,
            accion=action_name,
            detalle=f"Caso {case['codigo_caso']}: {observation}",
            valor_anterior=case.get("estado"),
            valor_nuevo=action_name,
            critico=priority_order(case.get("prioridad")) == 4
        )

        if notify_client:
            create_notification(
                cursor=cursor,
                case_id=case["caso_id"],
                user_id=case.get("cliente_usuario_id"),
                tipo="SEGUIMIENTO",
                titulo=action_name,
                mensaje=f"Tu caso {case['codigo_caso']} tiene una actualización: {action_name}."
            )

        conn.commit()

        return response_ok(f"{action_name} registrado correctamente.")

    except HTTPException:
        conn.rollback()
        raise

    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo registrar la acción: {str(exc)}"
        )

    finally:
        conn.close()


# =========================================================
# SHELL
# =========================================================

def supervisor_me_service(supervisor: dict):
    name = supervisor_name(supervisor)

    return response_ok(
        "Supervisor cargado correctamente.",
        supervisor={
            "usuario_id": supervisor.get("usuario_id"),
            "personal_id": supervisor.get("personal_id"),
            "username": supervisor.get("username"),
            "correo": supervisor.get("correo"),

            "nombre": name,
            "name": name,
            "initials": initials(name),
            "iniciales": initials(name),

            "role": supervisor.get("cargo") or "Supervisor de Atención",
            "cargo": supervisor.get("cargo") or "Supervisor de Atención",

            "area": supervisor.get("area_nombre") or "Atención al Cliente",

            "status": "Supervisión activa",
            "estado": "Supervisión activa",

            "last_access": supervisor.get("ultimo_acceso"),
            "ultimo_acceso": supervisor.get("ultimo_acceso"),
        },
        permissions=[
            "SUPERVISOR_VIEW_DASHBOARD",
            "SUPERVISOR_VIEW_PENDING_CASES",
            "SUPERVISOR_CLASSIFY_CASE",
            "SUPERVISOR_CHANGE_PRIORITY",
            "SUPERVISOR_OBSERVE_CASE",
            "SUPERVISOR_SEND_TO_ASSIGNMENT",
            "SUPERVISOR_VIEW_ASSIGNMENTS",
            "SUPERVISOR_ASSIGN_CASE",
            "SUPERVISOR_REASSIGN_CASE",
            "SUPERVISOR_DERIVE_CASE",
            "SUPERVISOR_ESCALATE_CASE",
            "SUPERVISOR_MASS_ASSIGNMENT",
            "SUPERVISOR_VIEW_ADVISOR_LOAD",
            "SUPERVISOR_CHANGE_ADVISOR_AVAILABILITY",
            "SUPERVISOR_VIEW_SLA",
            "SUPERVISOR_SEND_SLA_ALERT",
            "SUPERVISOR_REGISTER_SLA_FOLLOWUP",
            "SUPERVISOR_VIEW_INDICATORS",
            "SUPERVISOR_VIEW_ADVISOR_PERFORMANCE",
            "SUPERVISOR_COMPARE_INDICATORS",
            "SUPERVISOR_VIEW_REPORTS",
            "SUPERVISOR_GENERATE_REPORT",
            "SUPERVISOR_SCHEDULE_REPORT",
            "SUPERVISOR_DOWNLOAD_REPORT",
            "SUPERVISOR_VIEW_AUDIT",
            "SUPERVISOR_COMPARE_AUDIT",
            "SUPERVISOR_VIEW_CONFIG",
            "SUPERVISOR_SIMULATE_CONFIG",
            "SUPERVISOR_REQUEST_CONFIG_CHANGE",
            "SUPERVISOR_EXPORT_CONFIG"
        ]
    )


def supervisor_resumen_service(supervisor: dict):
    pendientes = safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos c
        INNER JOIN estados_caso ec
            ON ec.estado_caso_id = c.estado_caso_id
        INNER JOIN prioridades pr
            ON pr.prioridad_id = c.prioridad_id
        WHERE c.fecha_cierre IS NULL
          AND (
                c.responsable_actual_usuario_id IS NULL
                OR ec.es_final = 0
                OR pr.nombre = 'Crítica'
          )
        """
    )

    sla = safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos c
        INNER JOIN estados_caso ec
            ON ec.estado_caso_id = c.estado_caso_id
        WHERE ec.es_final = 0
          AND c.fecha_cierre IS NULL
          AND c.fecha_limite_resolucion IS NOT NULL
          AND c.fecha_limite_resolucion <= DATEADD(HOUR, 8, SYSDATETIME())
        """
    )

    pending_total = int(pendientes["total"] or 0) if pendientes else 0
    sla_total = int(sla["total"] or 0) if sla else 0

    return response_ok(
        "Resumen cargado.",
        pendientes=pending_total,
        pending=pending_total,
        casos_pendientes=pending_total,

        sla_riesgo=sla_total,
        slaRisk=sla_total,
        sla=sla_total,
    )

# =========================================================
# DASHBOARD / INDICADORES BASE
# =========================================================

def build_indicators_from_cases(cases, advisors, closed_week=0):
    total = len(cases)
    sla_risk = len([c for c in cases if c.get("slaHours", 999) <= 8])
    vencidos = len([c for c in cases if c.get("slaHours", 999) < 0])
    asignados = len([c for c in cases if c.get("advisorId")])
    criticos = len([c for c in cases if priority_order(c.get("priority")) == 4])

    cumplimiento_sla = 100
    if total:
        cumplimiento_sla = max(0, round(((total - vencidos) / total) * 100))

    asignacion = 0
    if total:
        asignacion = round((asignados / total) * 100)

    productividad = 0
    if advisors:
        productividad = round(
            sum(a.get("productivity", 0) for a in advisors) / len(advisors)
        )

    return [
        {
            "id": "sla",
            "icon": "⏱️",
            "title": "Cumplimiento SLA",
            "titulo": "Cumplimiento SLA",
            "value": f"{cumplimiento_sla}%",
            "valor": f"{cumplimiento_sla}%",
            "target": "≥ 95%",
            "meta": "≥ 95%",
            "trend": "Operación semanal",
            "tendencia": "Operación semanal",
            "status": "danger" if cumplimiento_sla < 85 else "warning" if cumplimiento_sla < 95 else "success",
            "estado": "danger" if cumplimiento_sla < 85 else "warning" if cumplimiento_sla < 95 else "success",
            "progress": cumplimiento_sla,
            "avance": cumplimiento_sla,
            "description": f"{sla_risk} casos se encuentran en riesgo SLA.",
            "descripcion": f"{sla_risk} casos se encuentran en riesgo SLA."
        },
        {
            "id": "asignacion",
            "icon": "👥",
            "title": "Casos asignados",
            "titulo": "Casos asignados",
            "value": f"{asignacion}%",
            "valor": f"{asignacion}%",
            "target": "≥ 90%",
            "meta": "≥ 90%",
            "trend": "Carga distribuida",
            "tendencia": "Carga distribuida",
            "status": "danger" if asignacion < 70 else "warning" if asignacion < 90 else "success",
            "estado": "danger" if asignacion < 70 else "warning" if asignacion < 90 else "success",
            "progress": asignacion,
            "avance": asignacion,
            "description": f"{asignados} de {total} casos tienen responsable.",
            "descripcion": f"{asignados} de {total} casos tienen responsable."
        },
        {
            "id": "productividad",
            "icon": "📈",
            "title": "Productividad promedio",
            "titulo": "Productividad promedio",
            "value": f"{productividad}%",
            "valor": f"{productividad}%",
            "target": "≥ 85%",
            "meta": "≥ 85%",
            "trend": "Equipo de atención",
            "tendencia": "Equipo de atención",
            "status": "danger" if productividad < 70 else "warning" if productividad < 85 else "success",
            "estado": "danger" if productividad < 70 else "warning" if productividad < 85 else "success",
            "progress": productividad,
            "avance": productividad,
            "description": "Promedio calculado con cierres recientes y carga activa.",
            "descripcion": "Promedio calculado con cierres recientes y carga activa."
        },
        {
            "id": "criticos",
            "icon": "🔥",
            "title": "Casos críticos",
            "titulo": "Casos críticos",
            "value": criticos,
            "valor": criticos,
            "target": "0 críticos detenidos",
            "meta": "0 críticos detenidos",
            "trend": "Prioridad alta",
            "tendencia": "Prioridad alta",
            "status": "danger" if criticos > 5 else "warning" if criticos > 0 else "success",
            "estado": "danger" if criticos > 5 else "warning" if criticos > 0 else "success",
            "progress": max(0, 100 - criticos * 10),
            "avance": max(0, 100 - criticos * 10),
            "description": "Casos que requieren intervención del supervisor.",
            "descripcion": "Casos que requieren intervención del supervisor."
        },
        {
            "id": "cierres",
            "icon": "✅",
            "title": "Cierres últimos 7 días",
            "titulo": "Cierres últimos 7 días",
            "value": closed_week,
            "valor": closed_week,
            "target": "Mayor al periodo anterior",
            "meta": "Mayor al periodo anterior",
            "trend": "Resolución semanal",
            "tendencia": "Resolución semanal",
            "status": "success" if closed_week > 0 else "warning",
            "estado": "success" if closed_week > 0 else "warning",
            "progress": min(100, closed_week * 10),
            "avance": min(100, closed_week * 10),
            "description": "Casos cerrados durante la última semana.",
            "descripcion": "Casos cerrados durante la última semana."
        }
    ]


def build_supervisor_ai_summary(cases, advisors):
    without_advisor = len([c for c in cases if not c.get("advisorId")])
    sla_risk = len([c for c in cases if c.get("slaHours", 999) <= 8])
    critical = len([c for c in cases if priority_order(c.get("priority")) == 4])
    overloaded = len([a for a in advisors if a.get("capacity", 0) >= 90])

    rows = []

    if sla_risk:
        rows.append({
            "title": "Riesgo SLA detectado",
            "text": f"{sla_risk} casos requieren seguimiento urgente antes de vencer o ya están vencidos."
        })

    if without_advisor:
        rows.append({
            "title": "Asignación pendiente",
            "text": f"{without_advisor} casos aún no tienen responsable asignado."
        })

    if critical:
        rows.append({
            "title": "Casos críticos",
            "text": f"{critical} casos tienen prioridad crítica y deben revisarse primero."
        })

    if overloaded:
        rows.append({
            "title": "Sobrecarga operativa",
            "text": f"{overloaded} asesores presentan carga alta. Conviene redistribuir casos."
        })

    if not rows:
        rows.append({
            "title": "Operación controlada",
            "text": "La bandeja no muestra riesgos graves en este momento."
        })

    return rows


def supervisor_dashboard_service(
    supervisor: dict,
    periodo: str = "hoy",
    area: str = "todos",
    prioridad: str = "todos",
    estado: str = "todos"
):
    cases_response = supervisor_cases_service(
        supervisor=supervisor,
        scope="all",
        area=area,
        prioridad=prioridad,
        estado=estado
    )

    advisors_response = supervisor_advisors_service(
        supervisor=supervisor,
        area=area
    )

    cases = cases_response["items"]
    advisors = advisors_response["items"]

    critical_cases = [
        c for c in cases
        if priority_order(c.get("priority")) == 4
        or c.get("slaHours", 999) <= 8
        or c.get("observed")
        or not c.get("advisorId")
    ]

    sla_alerts = [
        c for c in cases
        if c.get("slaHours", 999) <= 24
    ]

    pending = [
        c for c in cases
        if not c.get("advisorId")
        or c.get("observed")
        or c.get("slaHours", 999) <= 8
    ]

    closed_week_row = safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos
        WHERE fecha_cierre >= DATEADD(DAY, -7, SYSDATETIME())
        """
    )

    closed_week = int(closed_week_row["total"] or 0) if closed_week_row else 0

    kpis = [
        {
            "icon": "📋",
            "value": len(pending),
            "label": "Pendientes",
            "title": "Casos pendientes",
            "description": "Requieren decisión o seguimiento."
        },
        {
            "icon": "🔥",
            "value": len([c for c in critical_cases if priority_order(c.get("priority")) == 4]),
            "label": "Críticos",
            "title": "Casos críticos",
            "description": "Prioridad máxima o impacto alto."
        },
        {
            "icon": "⏱️",
            "value": len(sla_alerts),
            "label": "Riesgo SLA",
            "title": "Alertas SLA",
            "description": "Vencidos o próximos a vencer."
        },
        {
            "icon": "👥",
            "value": len(advisors),
            "label": "Asesores",
            "title": "Equipo operativo",
            "description": "Asesores registrados para atención."
        }
    ]

    indicators = build_indicators_from_cases(cases, advisors, closed_week)

    activity_rows = safe_fetch_all(
        """
        SELECT TOP 12
            h.historial_id,
            h.accion,
            h.observacion,
            h.fecha_evento,
            c.codigo_caso,
            u.username
        FROM historial_caso h
        INNER JOIN casos c
            ON c.caso_id = h.caso_id
        LEFT JOIN usuarios u
            ON u.usuario_id = h.usuario_id
        ORDER BY h.fecha_evento DESC
        """
    )

    activity = [
        {
            "id": row["historial_id"],
            "icon": audit_icon(row.get("accion")),
            "title": f"{row.get('accion')} · {row.get('codigo_caso')}",
            "text": row.get("observacion") or "Movimiento registrado.",
            "date": row.get("fecha_evento"),
            "user": row.get("username") or "Sistema"
        }
        for row in activity_rows
    ]

    ai_summary = build_supervisor_ai_summary(cases, advisors)

    return response_ok(
        "Dashboard cargado.",
        supervisor=supervisor_me_service(supervisor)["supervisor"],
        last_update=datetime.now(),
        hero_eyebrow="Supervisión operativa",
        hero_title=f"Hola, {supervisor_name(supervisor)}",
        hero_text="Controla pendientes, asignaciones, carga del equipo, SLA, indicadores y trazabilidad desde una vista ejecutiva.",

        kpis=kpis,

        cases=critical_cases[:12],
        casos=critical_cases[:12],
        critical_cases=critical_cases[:12],
        casos_criticos=critical_cases[:12],

        advisors=advisors,
        asesores=advisors,
        team=advisors,
        equipo=advisors,

        sla_alerts=sla_alerts[:12],
        alertas_sla=sla_alerts[:12],

        indicators=indicators,
        indicadores=indicators,

        activity=activity,
        actividad=activity,

        ai_summary=ai_summary,
        resumen_ia=ai_summary
    )


# =========================================================
# ACCIONES DE CASO
# =========================================================

def supervisor_classify_case_service(supervisor: dict, case_id: str, payload: dict):
    case = get_case(case_id)

    tipo = clean(payload.get("tipo_caso") or payload.get("type"))
    categoria = clean(payload.get("categoria") or payload.get("category"))
    prioridad = clean(payload.get("prioridad") or payload.get("priority"))
    ruta = clean(payload.get("ruta") or payload.get("route"))
    motivo = clean(payload.get("motivo") or payload.get("comentario") or payload.get("reason"))

    if not tipo or not categoria or not prioridad or not ruta or not motivo:
        raise HTTPException(
            status_code=400,
            detail="Completa tipo, categoría, prioridad, ruta y motivo."
        )

    tipo_id = get_tipo_caso_id(tipo)
    categoria_id = get_categoria_id(categoria)
    prioridad_id = get_prioridad_id(prioridad)
    estado_id = get_estado_id("Registrado")
    horas = get_priority_hours(prioridad)

    return run_case_action(
        case_id=case_id,
        supervisor=supervisor,
        action_name="Clasificación de caso",
        payload={
            "motivo": (
                f"Tipo: {tipo}. "
                f"Categoría: {categoria}. "
                f"Prioridad: {prioridad}. "
                f"Ruta: {ruta}. "
                f"Motivo: {motivo}"
            )
        },
        update_sql="""
            UPDATE casos
            SET tipo_caso_id = ?,
                categoria_id = ?,
                prioridad_id = ?,
                estado_caso_id = ?,
                fecha_limite_resolucion = CASE
                    WHEN fecha_limite_resolucion IS NULL
                        THEN DATEADD(HOUR, ?, SYSDATETIME())
                    ELSE fecha_limite_resolucion
                END,
                fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
        """,
        params=(
            tipo_id,
            categoria_id,
            prioridad_id,
            estado_id,
            horas,
            case["caso_id"]
        ),
        audit_type="clasificacion",
        notify_client=False,
    )


def supervisor_change_priority_service(supervisor: dict, case_id: str, payload: dict):
    case = get_case(case_id)

    prioridad = clean(payload.get("prioridad") or payload.get("priority"))
    comentario = clean(payload.get("comentario") or payload.get("motivo") or payload.get("reason"))

    if not prioridad or not comentario:
        raise HTTPException(
            status_code=400,
            detail="Completa prioridad y comentario."
        )

    prioridad_id = get_prioridad_id(prioridad)
    horas = get_priority_hours(prioridad)

    return run_case_action(
        case_id=case_id,
        supervisor=supervisor,
        action_name="Cambio de prioridad",
        payload={
            "comentario": f"Nueva prioridad: {prioridad}. {comentario}"
        },
        update_sql="""
            UPDATE casos
            SET prioridad_id = ?,
                fecha_limite_resolucion = DATEADD(HOUR, ?, SYSDATETIME()),
                fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
        """,
        params=(
            prioridad_id,
            horas,
            case["caso_id"]
        ),
        audit_type="prioridad",
        notify_client=True,
    )


def supervisor_observe_case_service(supervisor: dict, case_id: str, payload: dict):
    case = get_case(case_id)

    motivo = clean(payload.get("motivo") or payload.get("reason"))
    retorno = clean(payload.get("retorno") or payload.get("return_to"))
    comentario = clean(payload.get("comentario") or payload.get("comment"))

    if not motivo or not comentario:
        raise HTTPException(
            status_code=400,
            detail="Completa motivo y comentario."
        )

    estado_id = get_estado_id("Observado")

    return run_case_action(
        case_id=case_id,
        supervisor=supervisor,
        action_name="Caso observado",
        payload={
            "comentario": (
                f"Motivo: {motivo}. "
                f"Retorno: {retorno or 'Mesa de entrada'}. "
                f"Comentario: {comentario}"
            )
        },
        update_sql="""
            UPDATE casos
            SET estado_caso_id = ?,
                pendiente_cliente = 1,
                fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
        """,
        params=(
            estado_id,
            case["caso_id"]
        ),
        audit_type="observacion",
        notify_client=True,
        visible=True,
    )


def supervisor_send_assignment_service(supervisor: dict, case_id: str, payload: dict):
    case = get_case(case_id)

    sugerencia = clean(payload.get("sugerencia") or payload.get("suggestion"))
    cola = clean(payload.get("cola") or payload.get("queue"))

    if not sugerencia or not cola:
        raise HTTPException(
            status_code=400,
            detail="Completa sugerencia y cola."
        )

    estado_id = get_estado_id("Registrado")

    return run_case_action(
        case_id=case_id,
        supervisor=supervisor,
        action_name="Envío a asignación",
        payload={
            "comentario": f"Cola: {cola}. Sugerencia: {sugerencia}"
        },
        update_sql="""
            UPDATE casos
            SET estado_caso_id = ?,
                fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
        """,
        params=(
            estado_id,
            case["caso_id"]
        ),
        audit_type="asignacion",
    )


def supervisor_assign_case_service(supervisor: dict, case_id: str, payload: dict):
    case = get_case(case_id)

    advisor_id = as_int(payload.get("asesor_id") or payload.get("advisor_id"))
    cola = clean(payload.get("cola") or payload.get("queue"))
    criterio = clean(payload.get("criterio") or payload.get("criterion"))
    comentario = clean(payload.get("comentario") or payload.get("comment"))

    if not advisor_id or not cola or not criterio or not comentario:
        raise HTTPException(
            status_code=400,
            detail="Completa asesor, cola, criterio y comentario."
        )

    advisor = get_advisor(advisor_id)
    estado_id = get_estado_id("En atención")

    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE asignaciones_caso
            SET activo = 0,
                fecha_fin = SYSDATETIME()
            WHERE caso_id = ?
              AND activo = 1
            """,
            (case["caso_id"],)
        )

        cursor.execute(
            """
            INSERT INTO asignaciones_caso (
                caso_id,
                asesor_usuario_id,
                supervisor_usuario_id,
                motivo,
                activo,
                fecha_asignacion
            )
            VALUES (?, ?, ?, ?, 1, SYSDATETIME())
            """,
            (
                case["caso_id"],
                advisor["usuario_id"],
                supervisor.get("usuario_id"),
                f"Cola: {cola}. Criterio: {criterio}. {comentario}"
            )
        )

        cursor.execute(
            """
            UPDATE casos
            SET responsable_actual_usuario_id = ?,
                estado_caso_id = ?,
                pendiente_cliente = 0,
                fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
            """,
            (
                advisor["usuario_id"],
                estado_id,
                case["caso_id"]
            )
        )

        insert_history(
            cursor=cursor,
            case_id=case["caso_id"],
            user_id=supervisor.get("usuario_id"),
            action="Asignación de asesor",
            observation=(
                f"Asesor: {advisor_full_name(advisor)}. "
                f"Cola: {cola}. "
                f"Criterio: {criterio}. "
                f"Comentario: {comentario}"
            ),
            visible=False
        )

        insert_audit(
            cursor=cursor,
            supervisor=supervisor,
            tipo="asignacion",
            accion="Asignación de asesor",
            detalle=f"Caso {case['codigo_caso']} asignado a {advisor_full_name(advisor)}.",
            valor_anterior=case_advisor_name(case),
            valor_nuevo=advisor_full_name(advisor),
            critico=priority_order(case.get("prioridad")) == 4
        )

        create_notification(
            cursor=cursor,
            case_id=case["caso_id"],
            user_id=advisor["usuario_id"],
            tipo="ASIGNACION",
            titulo="Nuevo caso asignado",
            mensaje=f"Se te asignó el caso {case['codigo_caso']}."
        )

        conn.commit()

        return response_ok("Caso asignado correctamente.")

    except HTTPException:
        conn.rollback()
        raise

    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo asignar el caso: {str(exc)}"
        )

    finally:
        conn.close()


def supervisor_reassign_case_service(supervisor: dict, case_id: str, payload: dict):
    case = get_case(case_id)

    advisor_id = as_int(payload.get("asesor_id") or payload.get("advisor_id"))
    motivo = clean(payload.get("motivo") or payload.get("reason"))
    prioridad = clean(payload.get("prioridad") or payload.get("priority") or case.get("prioridad"))
    comentario = clean(payload.get("comentario") or payload.get("comment"))

    if not advisor_id or not motivo or not prioridad or not comentario:
        raise HTTPException(
            status_code=400,
            detail="Completa nuevo asesor, motivo, prioridad y comentario."
        )

    advisor = get_advisor(advisor_id)
    prioridad_id = get_prioridad_id(prioridad)
    estado_id = get_estado_id("En atención")

    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE asignaciones_caso
            SET activo = 0,
                fecha_fin = SYSDATETIME()
            WHERE caso_id = ?
              AND activo = 1
            """,
            (case["caso_id"],)
        )

        cursor.execute(
            """
            INSERT INTO asignaciones_caso (
                caso_id,
                asesor_usuario_id,
                supervisor_usuario_id,
                motivo,
                activo,
                fecha_asignacion
            )
            VALUES (?, ?, ?, ?, 1, SYSDATETIME())
            """,
            (
                case["caso_id"],
                advisor["usuario_id"],
                supervisor.get("usuario_id"),
                f"Reasignación. Motivo: {motivo}. Prioridad: {prioridad}. {comentario}"
            )
        )

        cursor.execute(
            """
            UPDATE casos
            SET responsable_actual_usuario_id = ?,
                prioridad_id = ?,
                estado_caso_id = ?,
                fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
            """,
            (
                advisor["usuario_id"],
                prioridad_id,
                estado_id,
                case["caso_id"]
            )
        )

        insert_history(
            cursor=cursor,
            case_id=case["caso_id"],
            user_id=supervisor.get("usuario_id"),
            action="Reasignación de caso",
            observation=(
                f"Nuevo asesor: {advisor_full_name(advisor)}. "
                f"Motivo: {motivo}. "
                f"Prioridad: {prioridad}. "
                f"Comentario: {comentario}"
            ),
            visible=False
        )

        insert_audit(
            cursor=cursor,
            supervisor=supervisor,
            tipo="reasignacion",
            accion="Reasignación de caso",
            detalle=f"Caso {case['codigo_caso']} reasignado a {advisor_full_name(advisor)}.",
            valor_anterior=case_advisor_name(case),
            valor_nuevo=advisor_full_name(advisor),
            critico=priority_order(prioridad) == 4
        )

        create_notification(
            cursor=cursor,
            case_id=case["caso_id"],
            user_id=advisor["usuario_id"],
            tipo="ASIGNACION",
            titulo="Caso reasignado",
            mensaje=f"Se te reasignó el caso {case['codigo_caso']}."
        )

        conn.commit()

        return response_ok("Caso reasignado correctamente.")

    except HTTPException:
        conn.rollback()
        raise

    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo reasignar el caso: {str(exc)}"
        )

    finally:
        conn.close()


def supervisor_derive_case_service(supervisor: dict, case_id: str, payload: dict):
    case = get_case(case_id)

    area = clean(payload.get("area") or payload.get("area_destino"))
    sla = clean(payload.get("sla") or payload.get("sla_interno"))
    motivo = clean(payload.get("motivo") or payload.get("reason"))

    if not area or not sla or not motivo:
        raise HTTPException(
            status_code=400,
            detail="Completa área, SLA interno y motivo."
        )

    estado_id = get_estado_id("Derivado")

    return run_case_action(
        case_id=case_id,
        supervisor=supervisor,
        action_name="Derivación de caso",
        payload={
            "comentario": f"Área destino: {area}. SLA interno: {sla}. Motivo: {motivo}"
        },
        update_sql="""
            UPDATE casos
            SET estado_caso_id = ?,
                fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
        """,
        params=(
            estado_id,
            case["caso_id"]
        ),
        audit_type="derivacion",
        notify_client=False,
    )


def supervisor_escalate_case_service(supervisor: dict, case_id: str, payload: dict):
    case = get_case(case_id)

    nivel = clean(payload.get("nivel") or payload.get("level"))
    motivo = clean(payload.get("motivo") or payload.get("reason"))
    comentario = clean(payload.get("comentario") or payload.get("comment"))

    if not nivel or not motivo or not comentario:
        raise HTTPException(
            status_code=400,
            detail="Completa nivel, motivo y comentario."
        )

    estado_id = get_estado_id("Escalado")

    return run_case_action(
        case_id=case_id,
        supervisor=supervisor,
        action_name="Escalamiento de caso",
        payload={
            "comentario": f"Nivel: {nivel}. Motivo: {motivo}. Comentario: {comentario}"
        },
        update_sql="""
            UPDATE casos
            SET estado_caso_id = ?,
                fecha_actualizacion = SYSDATETIME()
            WHERE caso_id = ?
        """,
        params=(
            estado_id,
            case["caso_id"]
        ),
        audit_type="escalamiento",
        notify_client=True,
        visible=True,
    )


# =========================================================
# ACCIONES MASIVAS DE CASOS PENDIENTES
# =========================================================

def supervisor_pending_bulk_action_service(supervisor: dict, payload: dict):
    accion = clean(payload.get("accion") or payload.get("action"))
    selected_ids = payload.get("selected_ids") or payload.get("case_ids") or []

    if not accion:
        raise HTTPException(
            status_code=400,
            detail="Selecciona una acción masiva."
        )

    if not selected_ids:
        filters = payload.get("filters") or {}
        response = supervisor_pending_cases_service(
            supervisor=supervisor,
            filtro=filters.get("filtro_rapido") or "todos",
            q=filters.get("busqueda") or "",
            estado=filters.get("status") or filters.get("estado") or "todos",
            prioridad=filters.get("priority") or filters.get("prioridad") or "todos",
            tipo=filters.get("type") or filters.get("tipo") or "todos",
            canal=filters.get("channel") or filters.get("canal") or "todos"
        )
        selected_ids = [item["id"] for item in response["items"]]

    processed = 0
    errors = []

    for case_id in selected_ids:
        try:
            if accion in ["enviar_asignacion", "enviar-asignacion", "asignacion"]:
                supervisor_send_assignment_service(
                    supervisor,
                    str(case_id),
                    {
                        "sugerencia": payload.get("criterio") or "Acción masiva",
                        "cola": payload.get("cola") or "Mesa de entrada"
                    }
                )

            elif accion in ["cambiar_prioridad", "prioridad"]:
                supervisor_change_priority_service(
                    supervisor,
                    str(case_id),
                    {
                        "prioridad": payload.get("prioridad") or "Alta",
                        "comentario": payload.get("comentario") or "Cambio masivo de prioridad."
                    }
                )

            elif accion in ["observar", "observacion"]:
                supervisor_observe_case_service(
                    supervisor,
                    str(case_id),
                    {
                        "motivo": payload.get("motivo") or "Revisión masiva",
                        "retorno": payload.get("cola") or "Mesa de entrada",
                        "comentario": payload.get("comentario") or "Caso observado desde acción masiva."
                    }
                )

            else:
                raise HTTPException(
                    status_code=400,
                    detail=f"Acción masiva no soportada: {accion}"
                )

            processed += 1

        except Exception as exc:
            errors.append({
                "case_id": case_id,
                "error": str(exc)
            })

    return response_ok(
        "Acción masiva procesada.",
        processed=processed,
        procesados=processed,
        errors=errors,
        errores=errors
    )


# =========================================================
# ASIGNACIÓN MASIVA CON PREVIEW
# =========================================================

def get_cases_for_mass_assignment(supervisor: dict, payload: dict):
    selected_ids = payload.get("selected_ids") or payload.get("case_ids") or []
    alcance = lower(payload.get("alcance") or payload.get("scope") or "sin_asesor")

    cases = supervisor_assignments_service(supervisor, filtro="todos")["items"]

    if selected_ids:
        selected_set = {str(item) for item in selected_ids}
        cases = [case for case in cases if str(case.get("id")) in selected_set]

    elif alcance in ["sin_asesor", "sin asesor", "no_asignados"]:
        cases = [case for case in cases if not case.get("advisorId")]

    elif alcance in ["criticos", "críticos", "critico", "crítico"]:
        cases = [
            case for case in cases
            if not case.get("advisorId")
            and priority_order(case.get("priority")) == 4
        ]

    elif alcance in ["sla", "sla_riesgo"]:
        cases = [
            case for case in cases
            if not case.get("advisorId")
            and case.get("slaHours", 999) <= 8
        ]

    return cases


def choose_advisor_for_case(case, advisors, criterion="menor_carga"):
    available = [
        advisor for advisor in advisors
        if advisor.get("estado_usuario") == "ACTIVO"
        and lower(advisor.get("status")) in ["disponible", "ocupado"]
    ]

    if not available:
        available = [
            advisor for advisor in advisors
            if advisor.get("estado_usuario") == "ACTIVO"
        ]

    if not available:
        return None

    criterion_text = lower(criterion)

    if "sla" in criterion_text:
        return sorted(
            available,
            key=lambda item: (item.get("slaRisk", 0), item.get("cases", 0), item.get("capacity", 0))
        )[0]

    if "especial" in criterion_text:
        case_area = lower(case.get("area"))
        same_area = [
            advisor for advisor in available
            if case_area and case_area in lower(advisor.get("specialty"))
        ]

        if same_area:
            return sorted(
                same_area,
                key=lambda item: (item.get("cases", 0), item.get("capacity", 0))
            )[0]

    return sorted(
        available,
        key=lambda item: (item.get("cases", 0), item.get("capacity", 0), item.get("slaRisk", 0))
    )[0]


def supervisor_mass_assignment_preview_service(supervisor: dict, payload: dict):
    criterion = clean(payload.get("criterio") or payload.get("criteria") or "menor_carga")
    cases = get_cases_for_mass_assignment(supervisor, payload)
    advisors = supervisor_advisors_service(supervisor)["items"]

    if not cases:
        return response_ok(
            "No existen casos para asignación masiva.",
            items=[],
            preview=[],
            propuesta=[]
        )

    if not advisors:
        raise HTTPException(
            status_code=400,
            detail="No existen asesores disponibles para preparar la asignación."
        )

    preview = []

    working_advisors = [dict(item) for item in advisors]

    for case in sorted(cases, key=lambda item: (item.get("slaHours", 999), -priority_order(item.get("priority")))):
        advisor = choose_advisor_for_case(case, working_advisors, criterion)

        if not advisor:
            preview.append({
                "id": case["id"],
                "case_id": case["id"],
                "codigo_caso": case["code"],
                "cliente": case["clientName"],
                "asesor_id": None,
                "asesor_sugerido": "Sin asesor disponible",
                "motivo": "No existen asesores activos disponibles.",
                "resultado": "No asignable"
            })
            continue

        advisor["cases"] = advisor.get("cases", 0) + 1
        advisor["capacity"] = min(100, advisor.get("capacity", 0) + 7)

        preview.append({
            "id": case["id"],
            "case_id": case["id"],
            "codigo_caso": case["code"],
            "cliente": case["clientName"],
            "prioridad": case["priority"],
            "sla": case["slaText"],
            "asesor_id": advisor["id"],
            "asesor_sugerido": advisor["name"],
            "motivo": f"Criterio aplicado: {criterion}. Carga estimada destino: {advisor['capacity']}%.",
            "resultado": "Incluido"
        })

    return response_ok(
        "Vista previa de asignación generada.",
        items=preview,
        preview=preview,
        propuesta=preview,
        total=len(preview),
        criterio=criterion
    )


def supervisor_mass_assignment_apply_service(supervisor: dict, payload: dict):
    preview_payload = payload.get("preview") or payload
    rows = (
        preview_payload.get("items")
        or preview_payload.get("preview")
        or preview_payload.get("propuesta")
        or []
    )

    if not rows:
        preview_response = supervisor_mass_assignment_preview_service(supervisor, payload)
        rows = preview_response.get("items", [])

    assigned = 0
    errors = []

    for row in rows:
        advisor_id = as_int(row.get("asesor_id") or row.get("advisor_id"))
        case_id = row.get("case_id") or row.get("id")

        if not case_id or not advisor_id:
            continue

        try:
            supervisor_assign_case_service(
                supervisor,
                str(case_id),
                {
                    "asesor_id": advisor_id,
                    "cola": payload.get("cola") or "Asignación masiva",
                    "criterio": payload.get("criterio") or payload.get("criteria") or "Asignación masiva",
                    "comentario": row.get("motivo") or "Asignación masiva aplicada desde preview."
                }
            )
            assigned += 1

        except Exception as exc:
            errors.append({
                "case_id": case_id,
                "advisor_id": advisor_id,
                "error": str(exc)
            })

    return response_ok(
        "Asignación masiva aplicada.",
        assigned=assigned,
        asignados=assigned,
        errors=errors,
        errores=errors
    )


# =========================================================
# REDISTRIBUCIÓN DE CARGA CON PREVIEW
# =========================================================

def supervisor_redistribute_load_preview_service(supervisor: dict, payload: dict):
    source_id = as_int(
        payload.get("asesor_origen_id")
        or payload.get("from_advisor_id")
        or payload.get("origen")
    )

    target_id = as_int(
        payload.get("asesor_destino_id")
        or payload.get("to_advisor_id")
        or payload.get("destino")
    )

    max_count = as_int(
        payload.get("cantidad_maxima")
        or payload.get("cantidad")
        or payload.get("count"),
        3
    )

    criterion = clean(payload.get("criterio") or payload.get("criteria") or "menor_sla")

    if not source_id or not target_id:
        raise HTTPException(
            status_code=400,
            detail="Selecciona asesor origen y asesor destino."
        )

    if source_id == target_id:
        raise HTTPException(
            status_code=400,
            detail="El asesor origen y destino no pueden ser el mismo."
        )

    source = get_advisor(source_id, require_active=False)
    target = get_advisor(target_id, require_active=True)

    source_cases = supervisor_cases_service(
        supervisor=supervisor,
        scope="assignments",
        asesor=str(source_id)
    )["items"]

    if "crit" in lower(criterion):
        source_cases = sorted(
            source_cases,
            key=lambda item: (-priority_order(item.get("priority")), item.get("slaHours", 999))
        )
    elif "complej" in lower(criterion):
        source_cases = sorted(
            source_cases,
            key=lambda item: (priority_order(item.get("priority")), item.get("slaHours", 999))
        )
    else:
        source_cases = sorted(
            source_cases,
            key=lambda item: item.get("slaHours", 999)
        )

    selected = source_cases[:max_count]

    preview = [
        {
            "id": case["id"],
            "case_id": case["id"],
            "codigo_caso": case["code"],
            "cliente": case["clientName"],
            "prioridad": case["priority"],
            "sla": case["slaText"],
            "origen_id": source_id,
            "origen": advisor_full_name(source),
            "destino_id": target_id,
            "destino": advisor_full_name(target),
            "motivo": f"Criterio: {criterion}. Redistribución por balance de carga."
        }
        for case in selected
    ]

    return response_ok(
        "Vista previa de redistribución generada.",
        items=preview,
        preview=preview,
        casos=preview,
        source={
            "id": source_id,
            "name": advisor_full_name(source)
        },
        target={
            "id": target_id,
            "name": advisor_full_name(target)
        },
        criterio=criterion,
        total=len(preview)
    )


def supervisor_redistribute_load_apply_service(supervisor: dict, payload: dict):
    preview_payload = payload.get("preview") or payload
    rows = (
        preview_payload.get("items")
        or preview_payload.get("preview")
        or preview_payload.get("casos")
        or []
    )

    selected_case_ids = payload.get("selected_case_ids") or payload.get("case_ids") or []

    if selected_case_ids:
        selected_set = {str(item) for item in selected_case_ids}
        rows = [
            row for row in rows
            if str(row.get("case_id") or row.get("id")) in selected_set
        ]

    if not rows:
        preview_response = supervisor_redistribute_load_preview_service(supervisor, payload)
        rows = preview_response.get("items", [])

    moved = 0
    errors = []

    for row in rows:
        case_id = row.get("case_id") or row.get("id")
        target_id = as_int(row.get("destino_id") or row.get("asesor_destino_id") or payload.get("asesor_destino_id"))

        if not case_id or not target_id:
            continue

        try:
            case = get_case(str(case_id))

            supervisor_reassign_case_service(
                supervisor,
                str(case_id),
                {
                    "asesor_id": target_id,
                    "motivo": payload.get("motivo") or payload.get("comentario") or "Redistribución de carga",
                    "prioridad": case.get("prioridad") or "Media",
                    "comentario": row.get("motivo") or "Redistribución aplicada desde vista previa."
                }
            )

            moved += 1

        except Exception as exc:
            errors.append({
                "case_id": case_id,
                "target_id": target_id,
                "error": str(exc)
            })

    return response_ok(
        "Redistribución aplicada.",
        moved=moved,
        movidos=moved,
        errors=errors,
        errores=errors
    )


# =========================================================
# DISPONIBILIDAD DE ASESORES
# =========================================================

def normalize_availability_state(value):
    text = lower(value)

    if "bloq" in text:
        return "BLOQUEADO"

    if "no disponible" in text or "inactivo" in text or "descanso" in text:
        return "INACTIVO"

    return "ACTIVO"


def supervisor_update_advisor_availability_service(supervisor: dict, advisor_id: int, payload: dict):
    advisor = get_advisor(int(advisor_id), require_active=False)

    estado = normalize_availability_state(payload.get("estado") or payload.get("status") or "ACTIVO")
    motivo = clean(payload.get("motivo") or payload.get("reason"))
    comentario = clean(payload.get("comentario") or payload.get("comment"))

    if not motivo and not comentario:
        raise HTTPException(
            status_code=400,
            detail="Completa motivo o comentario de disponibilidad."
        )

    conn = get_connection()

    try:
        cursor = conn.cursor()

        cursor.execute(
            """
            UPDATE usuarios
            SET estado = ?,
                fecha_actualizacion = SYSDATETIME()
            WHERE usuario_id = ?
            """,
            (
                estado,
                advisor["usuario_id"]
            )
        )

        insert_audit(
            cursor=cursor,
            supervisor=supervisor,
            tipo="asesores",
            accion="Cambio de disponibilidad",
            detalle=(
                f"Asesor {advisor_full_name(advisor)} cambió a {estado}. "
                f"Motivo: {motivo or 'No indicado'}. "
                f"Comentario: {comentario or 'Sin comentario'}."
            ),
            valor_anterior=advisor.get("estado"),
            valor_nuevo=estado
        )

        conn.commit()

        return response_ok("Disponibilidad actualizada correctamente.")

    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo actualizar disponibilidad: {str(exc)}"
        )

    finally:
        conn.close()


def supervisor_bulk_advisor_availability_service(supervisor: dict, payload: dict):
    advisor_ids = payload.get("asesor_ids") or payload.get("advisor_ids") or []
    estado = payload.get("estado") or payload.get("status")
    motivo = clean(payload.get("motivo") or payload.get("reason"))
    comentario = clean(payload.get("comentario") or payload.get("comment"))

    if not advisor_ids or not estado:
        raise HTTPException(
            status_code=400,
            detail="Selecciona asesores y estado."
        )

    updated = 0
    errors = []

    for advisor_id in advisor_ids:
        try:
            supervisor_update_advisor_availability_service(
                supervisor,
                int(advisor_id),
                {
                    "estado": estado,
                    "motivo": motivo or "Cambio masivo de disponibilidad",
                    "comentario": comentario or "Cambio aplicado desde acción masiva."
                }
            )
            updated += 1

        except Exception as exc:
            errors.append({
                "advisor_id": advisor_id,
                "error": str(exc)
            })

    return response_ok(
        "Disponibilidad masiva procesada.",
        updated=updated,
        actualizados=updated,
        errors=errors,
        errores=errors
    )


# =========================================================
# SLA: ALERTAS Y SEGUIMIENTO
# =========================================================

def get_cases_for_sla_action(supervisor: dict, payload: dict):
    case_id = payload.get("caso_id") or payload.get("case_id")
    selected_ids = payload.get("selected_ids") or payload.get("case_ids") or []

    if case_id:
        return [map_case(get_case(str(case_id)))]

    if selected_ids:
        selected = []
        for item in selected_ids:
            try:
                selected.append(map_case(get_case(str(item))))
            except Exception:
                continue
        return selected

    filters = payload.get("filters") or {}

    response = supervisor_sla_monitor_service(
        supervisor=supervisor,
        filtro=filters.get("filtro_rapido") or filters.get("filtro") or "todos",
        q=filters.get("busqueda") or "",
        estado=filters.get("status") or filters.get("estado") or "todos",
        prioridad=filters.get("priority") or filters.get("prioridad") or "todos",
        tipo=filters.get("type") or filters.get("tipo") or "todos",
        asesor=filters.get("advisor") or filters.get("asesor") or "todos",
        area=filters.get("area") or "todos",
        canal=filters.get("channel") or filters.get("canal") or "todos",
        riesgo=filters.get("risk") or filters.get("riesgo") or "todos",
        seguimiento=filters.get("followup") or filters.get("seguimiento") or "todos"
    )

    return response["items"]


def supervisor_sla_alert_service(supervisor: dict, payload: dict):
    cases = get_cases_for_sla_action(supervisor, payload)

    if not cases:
        raise HTTPException(
            status_code=400,
            detail="No se encontraron casos para enviar alerta SLA."
        )

    canal = clean(payload.get("canal") or payload.get("channel") or "SISTEMA")
    mensaje = clean(payload.get("mensaje") or payload.get("message"))

    if not mensaje:
        raise HTTPException(
            status_code=400,
            detail="Completa el mensaje de alerta."
        )

    conn = get_connection()

    try:
        cursor = conn.cursor()
        sent = 0

        for item in cases:
            case = get_case(str(item["id"]))

            insert_history(
                cursor=cursor,
                case_id=case["caso_id"],
                user_id=supervisor.get("usuario_id"),
                action="Alerta SLA enviada",
                observation=f"Canal: {canal}. Mensaje: {mensaje}",
                visible=False
            )

            insert_audit(
                cursor=cursor,
                supervisor=supervisor,
                tipo="sla",
                accion="Alerta SLA enviada",
                detalle=f"Caso {case['codigo_caso']}. Canal: {canal}. Mensaje: {mensaje}",
                critico=True
            )

            if case.get("responsable_actual_usuario_id"):
                create_notification(
                    cursor=cursor,
                    case_id=case["caso_id"],
                    user_id=case.get("responsable_actual_usuario_id"),
                    tipo="SLA",
                    titulo="Alerta SLA",
                    mensaje=mensaje
                )

            sent += 1

        conn.commit()

        return response_ok(
            "Alerta SLA enviada correctamente.",
            sent=sent,
            enviados=sent
        )

    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo enviar la alerta SLA: {str(exc)}"
        )

    finally:
        conn.close()


def supervisor_mass_sla_alert_preview_service(supervisor: dict, payload: dict):
    cases = get_cases_for_sla_action(supervisor, payload)

    rows = []

    for case in cases:
        rows.append({
            "id": case["id"],
            "case_id": case["id"],
            "codigo_caso": case["code"],
            "cliente": case["clientName"],
            "responsable": case["advisorName"],
            "asesor": case["advisorName"],
            "sla": case["slaText"],
            "riesgo": case["slaRisk"],
            "destino": payload.get("destinatario") or payload.get("target") or "asesor",
            "resultado": "Incluido"
        })

    return response_ok(
        "Vista previa de alerta SLA generada.",
        items=rows,
        preview=rows,
        casos=rows,
        total=len(rows)
    )


def supervisor_mass_sla_alert_service(supervisor: dict, payload: dict):
    preview_payload = payload.get("preview") or payload
    preview_rows = (
        preview_payload.get("items")
        or preview_payload.get("preview")
        or preview_payload.get("casos")
        or []
    )

    selected_ids = [
        row.get("case_id") or row.get("id")
        for row in preview_rows
        if row.get("case_id") or row.get("id")
    ]

    payload = {
        **payload,
        "selected_ids": selected_ids or payload.get("selected_ids") or [],
        "mensaje": payload.get("mensaje") or payload.get("message") or "Tienes casos con riesgo SLA. Revisa tu bandeja de atención."
    }

    return supervisor_sla_alert_service(supervisor, payload)


def supervisor_sla_follow_service(supervisor: dict, payload: dict):
    cases = get_cases_for_sla_action(supervisor, payload)

    accion = clean(payload.get("accion") or payload.get("action"))
    resultado = clean(payload.get("resultado") or payload.get("result"))
    comentario = clean(payload.get("comentario") or payload.get("comment"))

    if not accion or not comentario:
        raise HTTPException(
            status_code=400,
            detail="Completa acción y comentario de seguimiento."
        )

    conn = get_connection()

    try:
        cursor = conn.cursor()
        processed = 0

        for item in cases:
            case = get_case(str(item["id"]))

            observation = (
                f"Acción: {accion}. "
                f"Resultado: {resultado or 'No indicado'}. "
                f"Comentario: {comentario}"
            )

            insert_history(
                cursor=cursor,
                case_id=case["caso_id"],
                user_id=supervisor.get("usuario_id"),
                action="Seguimiento SLA",
                observation=observation,
                visible=False
            )

            insert_audit(
                cursor=cursor,
                supervisor=supervisor,
                tipo="sla",
                accion="Seguimiento SLA",
                detalle=f"Caso {case['codigo_caso']}: {observation}",
                critico=remaining_hours(case.get("fecha_limite_resolucion")) <= 8
            )

            cursor.execute(
                """
                UPDATE casos
                SET fecha_actualizacion = SYSDATETIME()
                WHERE caso_id = ?
                """,
                (case["caso_id"],)
            )

            processed += 1

        conn.commit()

        return response_ok(
            "Seguimiento SLA registrado.",
            processed=processed,
            procesados=processed
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
# INDICADORES
# =========================================================

def supervisor_indicators_service(
    supervisor: dict,
    periodo: str = "semana",
    asesor: str = "todos",
    area: str = "todos",
    tipo_caso: str = "todos",
    canal: str = "todos",
    prioridad: str = "todos",
    estado: str = "todos",
    grupo: str = "todos",
    fecha_desde: str = "",
    fecha_hasta: str = ""
):
    start_date = parse_date(fecha_desde) or get_scope_dates(periodo)
    end_date = parse_date(fecha_hasta) or datetime.now()

    cases_response = supervisor_cases_service(
        supervisor=supervisor,
        scope="all",
        asesor=asesor,
        area=area,
        tipo=tipo_caso,
        canal=canal,
        prioridad=prioridad,
        estado=estado,
        fecha_desde=start_date.isoformat(),
        fecha_hasta=end_date.isoformat()
    )

    cases = cases_response["items"]
    advisors = supervisor_advisors_service(supervisor, area=area)["items"]

    closed_row = safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos
        WHERE fecha_cierre >= ?
          AND fecha_cierre < DATEADD(DAY, 1, ?)
        """,
        (start_date, end_date)
    )

    closed_count = int(closed_row["total"] or 0) if closed_row else 0

    indicators = build_indicators_from_cases(cases, advisors, closed_count)

    if not is_all(grupo):
        group_text = lower(grupo)
        indicators = [
            item for item in indicators
            if group_text in lower(item.get("title"))
            or group_text in lower(item.get("description"))
            or group_text in lower(item.get("id"))
        ]

    trend_rows = safe_fetch_all(
        """
        SELECT
            CAST(fecha_registro AS DATE) AS fecha,
            COUNT(*) AS total
        FROM casos
        WHERE fecha_registro >= ?
          AND fecha_registro < DATEADD(DAY, 1, ?)
        GROUP BY CAST(fecha_registro AS DATE)
        ORDER BY fecha ASC
        """,
        (start_date, end_date)
    )

    trend = [
        {
            "label": str(row["fecha"]),
            "fecha": row["fecha"],
            "value": int(row["total"] or 0),
            "valor": int(row["total"] or 0)
        }
        for row in trend_rows
    ]

    priority_rows = safe_fetch_all(
        """
        SELECT
            pr.nombre AS prioridad,
            COUNT(*) AS total
        FROM casos c
        INNER JOIN prioridades pr
            ON pr.prioridad_id = c.prioridad_id
        WHERE c.fecha_registro >= ?
          AND c.fecha_registro < DATEADD(DAY, 1, ?)
        GROUP BY pr.nombre
        ORDER BY total DESC
        """,
        (start_date, end_date)
    )

    priority_distribution = [
        {
            "label": row["prioridad"],
            "prioridad": row["prioridad"],
            "value": int(row["total"] or 0),
            "valor": int(row["total"] or 0)
        }
        for row in priority_rows
    ]

    ai_summary = [
        {
            "title": "Lectura general",
            "text": f"Se analizaron {len(cases)} casos y {len(advisors)} asesores para el periodo seleccionado."
        },
        {
            "title": "SLA",
            "text": f"{len([c for c in cases if c.get('slaHours', 999) <= 8])} casos están vencidos o próximos a vencer."
        },
        {
            "title": "Productividad",
            "text": "Revisa desempeño por asesor para explicar desviaciones de cierre, SLA y carga."
        }
    ]

    action_plan = [
        {
            "icon": "1",
            "title": "Revisar indicadores bajo meta",
            "text": "Abre el detalle de cada indicador en riesgo."
        },
        {
            "icon": "2",
            "title": "Analizar desempeño",
            "text": "Usa Ver desempeño para revisar asesor, carga y casos relacionados."
        },
        {
            "icon": "3",
            "title": "Generar reporte",
            "text": "Exporta un resumen ejecutivo o analítico según el destinatario."
        }
    ]

    return response_ok(
        "Indicadores cargados.",
        items=indicators,
        indicators=indicators,
        indicadores=indicators,
        kpis=indicators[:4],
        trend=trend,
        tendencia=trend,
        priority_distribution=priority_distribution,
        prioridades=priority_distribution,
        advisors=advisors,
        asesores=advisors,
        advisor_performance=advisors,
        desempeno_asesores=advisors,
        ai_summary=ai_summary,
        resumen_ia=ai_summary,
        action_plan=action_plan,
        plan_accion=action_plan
    )


def supervisor_advisor_performance_service(
    supervisor: dict,
    advisor_id: int,
    periodo: str = "semana"
):
    advisor_response = supervisor_advisor_detail_service(supervisor, advisor_id)
    advisor = advisor_response["advisor"]

    start_date = get_scope_dates(periodo)

    cases = supervisor_cases_service(
        supervisor=supervisor,
        scope="all",
        asesor=str(advisor_id),
        fecha_desde=start_date.isoformat()
    )["items"]

    closed = len([
        item for item in cases
        if lower(item.get("status")) in ["cerrado", "resuelto"]
    ])

    total = len(cases)
    vencidos = len([item for item in cases if item.get("slaHours", 999) < 0])
    sla_ok = 100 if total == 0 else max(0, round(((total - vencidos) / total) * 100))

    productivity = advisor.get("productivity", 0)

    kpis = [
        {
            "icon": "📋",
            "value": total,
            "label": "Casos",
            "description": "Casos del periodo."
        },
        {
            "icon": "✅",
            "value": closed,
            "label": "Cerrados",
            "description": "Casos finalizados."
        },
        {
            "icon": "⏱️",
            "value": f"{sla_ok}%",
            "label": "SLA cumplido",
            "description": "Cumplimiento estimado."
        },
        {
            "icon": "📈",
            "value": f"{productivity}%",
            "label": "Productividad",
            "description": "Score operativo."
        }
    ]

    insight = [
        {
            "title": "Desempeño del asesor",
            "text": (
                f"{advisor.get('name')} tiene {total} casos visibles, "
                f"{advisor.get('slaRisk', 0)} con riesgo SLA y productividad estimada de {productivity}%."
            )
        }
    ]

    return response_ok(
        "Desempeño de asesor cargado.",
        advisor=advisor,
        asesor=advisor,
        cases=cases,
        casos=cases,
        kpis=kpis,
        insight=insight,
        analisis=insight,
        cerrados=closed,
        sla_cumplido=f"{sla_ok}%"
    )


def supervisor_compare_indicators_service(supervisor: dict, payload: dict):
    base_period = clean(payload.get("periodo_base") or payload.get("base"))
    target_period = clean(payload.get("periodo_comparativo") or payload.get("comparativo"))

    if not base_period or not target_period:
        raise HTTPException(
            status_code=400,
            detail="Selecciona periodo base y periodo comparativo."
        )

    base = supervisor_indicators_service(supervisor, periodo=base_period)["items"]
    target = supervisor_indicators_service(supervisor, periodo=target_period)["items"]

    target_map = {
        item["id"]: item
        for item in target
    }

    comparison = []

    for item in base:
        other = target_map.get(item["id"], {})

        base_value = clean(item.get("value")).replace("%", "")
        target_value = clean(other.get("value")).replace("%", "")

        try:
            base_number = float(base_value)
            target_number = float(target_value)
            variation = round(target_number - base_number, 2)
            variation_text = f"{variation:+.2f}"
        except Exception:
            variation_text = "-"

        comparison.append({
            "indicador": item.get("title"),
            "name": item.get("title"),
            "base": item.get("value"),
            "comparativo": other.get("value", "-"),
            "variacion": variation_text,
            "estado": other.get("status", item.get("status", "Calculado"))
        })

    return response_ok(
        "Comparación de indicadores generada.",
        items=comparison,
        comparacion=comparison,
        comparison=comparison,
        resultados=comparison
    )


# =========================================================
# REPORTES
# =========================================================

def report_templates():
    return [
        {
            "id": "dashboard",
            "icon": "🏠",
            "nombre": "Dashboard",
            "tipo": "Ejecutivo",
            "descripcion": "Vista integral de KPIs, casos críticos, SLA, asesores, indicadores y actividad."
        },
        {
            "id": "casos_pendientes",
            "icon": "📋",
            "nombre": "Casos pendientes",
            "tipo": "Operativo",
            "descripcion": "Casos por clasificar, observar, priorizar o enviar a asignación."
        },
        {
            "id": "asignaciones",
            "icon": "👥",
            "nombre": "Asignaciones",
            "tipo": "Operativo",
            "descripcion": "Casos sin asesor, reasignaciones, derivaciones y escalados."
        },
        {
            "id": "carga_asesores",
            "icon": "⚖️",
            "nombre": "Carga asesores",
            "tipo": "Analítico",
            "descripcion": "Carga, capacidad, productividad, criticidad y riesgo SLA por asesor."
        },
        {
            "id": "monitoreo_sla",
            "icon": "⏱️",
            "nombre": "Monitoreo SLA",
            "tipo": "Crítico",
            "descripcion": "Casos vencidos, próximos a vencer, bloqueados y derivados."
        },
        {
            "id": "indicadores",
            "icon": "📈",
            "nombre": "Indicadores",
            "tipo": "Ejecutivo",
            "descripcion": "KPIs, tendencias, productividad, cumplimiento SLA y desempeño."
        },
        {
            "id": "auditoria",
            "icon": "🕵️",
            "nombre": "Auditoría",
            "tipo": "Auditable",
            "descripcion": "Eventos, cambios sensibles, usuarios, resultados y trazabilidad."
        }
    ]


def report_key(value):
    text = lower(value)
    text = (
        text.replace("á", "a")
        .replace("é", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ú", "u")
        .replace("ñ", "n")
    )
    text = re.sub(r"[^a-z0-9]+", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    return text


def normalize_report_type(value):
    text = report_key(value)

    aliases = {
        "dashboard": "dashboard",
        "tablero": "dashboard",
        "panel": "dashboard",
        "resumen_dashboard": "dashboard",

        "casos": "casos_pendientes",
        "casos_pendientes": "casos_pendientes",
        "pendientes": "casos_pendientes",
        "bandeja": "casos_pendientes",

        "asignacion": "asignaciones",
        "asignaciones": "asignaciones",

        "carga": "carga_asesores",
        "carga_asesores": "carga_asesores",
        "carga_asesor": "carga_asesores",
        "asesores": "carga_asesores",

        "monitoreo_sla": "monitoreo_sla",
        "sla": "monitoreo_sla",
        "monitoreo": "monitoreo_sla",

        "indicador": "indicadores",
        "indicadores": "indicadores",

        "auditoria": "auditoria",
        "auditoria_casos": "auditoria",
        "trazabilidad": "auditoria",

        "reportes": "reportes",
        "historial_reportes": "reportes",

        "configuracion": "configuracion",
        "configuracion_supervision": "configuracion",
    }

    return aliases.get(text, text or "dashboard")


def normalize_report_period(value):
    text = report_key(value)

    if text in ["hoy", "dia", "today"]:
        return "hoy"

    if text in ["semana", "1_semana", "una_semana", "7_dias", "semana_actual"]:
        return "semana"

    if text in ["mes", "1_mes", "un_mes", "30_dias", "mes_actual"]:
        return "mes"

    if text in ["3_meses", "tres_meses", "trimestre", "90_dias"]:
        return "3_meses"

    if text in ["personalizado", "rango", "rango_personalizado"]:
        return "personalizado"

    return text or "semana"


def normalize_report_scope(value):
    text = report_key(value)

    if text in ["vista_actual", "vista", "actual"]:
        return "vista_actual"

    if text in ["filtros_actuales", "filtrados", "filtro_actual"]:
        return "filtros_actuales"

    if text in ["todo_modulo", "todos", "todo", "all"]:
        return "todo_modulo"

    if text in ["resumen_ejecutivo", "ejecutivo", "summary"]:
        return "resumen_ejecutivo"

    return text or "vista_actual"


def normalize_report_detail(value):
    text = report_key(value)

    if text in ["ejecutivo", "executive"]:
        return "ejecutivo"

    if text in ["auditable", "auditoria", "audit"]:
        return "auditable"

    return "operativo"


def normalize_report_destination(value):
    text = report_key(value)

    if text in ["historial", "historial_reportes", "guardar_historial"]:
        return "historial_reportes"

    if text in ["compartir", "compartir_enlace", "link"]:
        return "compartir_enlace"

    return "descarga_local"


def report_value(payload: dict, *keys, default=""):
    for key in keys:
        if key in payload and payload.get(key) not in [None, ""]:
            return payload.get(key)

    return default


def report_bool(payload: dict, *keys, default=False):
    for key in keys:
        if key in payload:
            return as_bool(payload.get(key))

    return default


def report_payload_options(payload: dict):
    payload = payload or {}
    filters = payload.get("filters") or payload.get("filtros") or {}

    report_type = normalize_report_type(
        report_value(payload, "tipo", "type", "reportType", default="dashboard")
    )

    period = normalize_report_period(
        report_value(payload, "periodo", "period", "reportPeriod", default="semana")
    )

    scope = normalize_report_scope(
        report_value(payload, "alcance", "scope", "reportScope", default="vista_actual")
    )

    detail = normalize_report_detail(
        report_value(payload, "detalle", "detail", "nivel_detalle", "detailLevel", default="operativo")
    )

    destination = normalize_report_destination(
        report_value(payload, "destino", "destination", "reportDestination", default="descarga_local")
    )

    fmt = clean(
        report_value(payload, "formato", "format", "reportFormat", default="pdf")
    )

    reason = clean(
        report_value(
            payload,
            "motivo",
            "reason",
            "comentario",
            "comment",
            "reportComment",
            default="Generación formal de reporte supervisor"
        )
    )

    return {
        "type": report_type,
        "period": period,
        "scope": scope,
        "detail": detail,
        "destination": destination,
        "format": fmt,
        "reason": reason,
        "date_from": clean(
            report_value(payload, "fecha_desde", "dateFrom", "desde", default="")
            or filters.get("fecha_desde")
            or filters.get("dateFrom")
            or ""
        ),
        "date_to": clean(
            report_value(payload, "fecha_hasta", "dateTo", "hasta", default="")
            or filters.get("fecha_hasta")
            or filters.get("dateTo")
            or ""
        ),
        "include_kpis": report_bool(payload, "includeKpis", "incluir_kpis", "include_kpis", default=True),
        "include_charts": report_bool(payload, "includeCharts", "incluir_graficos", "include_charts", default=False),
        "include_detail": report_bool(payload, "includeOperationalDetail", "incluir_detalle_operativo", "includeCases", "incluir_casos", default=True),
        "include_sla": report_bool(payload, "includeSla", "incluir_sla", "include_sla", default=False),
        "include_trace": report_bool(payload, "includeTrace", "incluir_trazabilidad", "includeAudit", "incluir_auditoria", default=False),
        "filters": filters
    }


def report_period_dates(options: dict):
    period = options.get("period") or "semana"
    now = datetime.now()

    if period == "hoy":
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now
        return start, end

    if period == "semana":
        return now - timedelta(days=7), now

    if period == "mes":
        return now - timedelta(days=30), now

    if period == "3_meses":
        return now - timedelta(days=90), now

    if period == "personalizado":
        start = parse_date(options.get("date_from"))
        end = parse_date(options.get("date_to"))

        if not start or not end:
            raise HTTPException(
                status_code=400,
                detail="Para periodo personalizado debes indicar fecha desde y fecha hasta."
            )

        if start > end:
            raise HTTPException(
                status_code=400,
                detail="La fecha desde no puede ser mayor que la fecha hasta."
            )

        return start, end

    return get_scope_dates(period), now


def report_base_filters(options: dict):
    filters = options.get("filters") or {}

    start, end = report_period_dates(options)

    scope = options.get("scope") or "vista_actual"

    use_current_filters = scope in ["vista_actual", "filtros_actuales", "resumen_ejecutivo"]

    if use_current_filters:
        q = (
            filters.get("busqueda")
            or filters.get("q")
            or filters.get("search")
            or filters.get("reportSearch")
            or ""
        )

        estado = (
            filters.get("estado")
            or filters.get("status")
            or filters.get("reportStatus")
            or "todos"
        )

        prioridad = (
            filters.get("prioridad")
            or filters.get("priority")
            or "todos"
        )

        tipo = (
            filters.get("tipo_caso")
            or filters.get("tipo")
            or filters.get("type")
            or "todos"
        )

        asesor = (
            filters.get("asesor")
            or filters.get("advisor")
            or "todos"
        )

        area = filters.get("area") or "todos"

        canal = (
            filters.get("canal")
            or filters.get("channel")
            or "todos"
        )

        riesgo = (
            filters.get("riesgo")
            or filters.get("risk")
            or "todos"
        )

        sla = (
            filters.get("sla")
            or filters.get("riesgo_sla")
            or "todos"
        )

        filtro_rapido = (
            filters.get("filtro_rapido")
            or filters.get("filtro")
            or "todos"
        )

    else:
        q = ""
        estado = "todos"
        prioridad = "todos"
        tipo = "todos"
        asesor = "todos"
        area = "todos"
        canal = "todos"
        riesgo = "todos"
        sla = "todos"
        filtro_rapido = "todos"

    return {
        "q": q,
        "estado": estado,
        "prioridad": prioridad,
        "tipo": tipo,
        "asesor": asesor,
        "area": area,
        "canal": canal,
        "riesgo": riesgo,
        "sla": sla,
        "filtro": filtro_rapido,
        "fecha_desde": start.isoformat(),
        "fecha_hasta": end.isoformat(),
    }


def report_row(section: str, row: dict):
    if not isinstance(row, dict):
        return {
            "seccion": section,
            "valor": row
        }

    return {
        "seccion": section,
        **row
    }


def report_kpi_rows(kpis):
    rows = []

    for item in kpis or []:
        if not isinstance(item, dict):
            continue

        rows.append({
            "seccion": "KPIs",
            "indicador": item.get("label") or item.get("title") or item.get("titulo") or item.get("nombre") or item.get("id"),
            "valor": item.get("value") or item.get("valor"),
            "descripcion": item.get("description") or item.get("descripcion") or item.get("text") or "",
            "estado": item.get("status") or item.get("estado") or ""
        })

    return rows


def report_summary_rows(summary):
    rows = []

    for item in summary or []:
        if not isinstance(item, dict):
            continue

        rows.append({
            "seccion": "Resumen ejecutivo",
            "hallazgo": item.get("title") or item.get("titulo") or "Hallazgo",
            "detalle": item.get("text") or item.get("descripcion") or item.get("detail") or ""
        })

    return rows


def report_chart_rows(title: str, rows):
    result = []

    for item in rows or []:
        if not isinstance(item, dict):
            continue

        result.append({
            "seccion": f"Gráfico - {title}",
            "etiqueta": item.get("label") or item.get("fecha") or item.get("prioridad") or item.get("nombre") or "-",
            "valor": item.get("value") or item.get("valor") or item.get("total") or 0
        })

    return result


def report_limit_rows_by_detail(rows, options: dict):
    detail = options.get("detail")
    scope = options.get("scope")

    if scope == "resumen_ejecutivo":
        return rows[:80]

    if detail == "ejecutivo":
        return rows[:120]

    if detail == "operativo":
        return rows[:800]

    if detail == "auditable":
        return rows[:1500]

    return rows


def report_add_context_rows(options: dict):
    return [
        {
            "seccion": "Parámetros del reporte",
            "campo": "Tipo",
            "valor": options.get("type")
        },
        {
            "seccion": "Parámetros del reporte",
            "campo": "Periodo",
            "valor": options.get("period")
        },
        {
            "seccion": "Parámetros del reporte",
            "campo": "Alcance",
            "valor": options.get("scope")
        },
        {
            "seccion": "Parámetros del reporte",
            "campo": "Nivel de detalle",
            "valor": options.get("detail")
        },
        {
            "seccion": "Parámetros del reporte",
            "campo": "Destino",
            "valor": options.get("destination")
        },
        {
            "seccion": "Parámetros del reporte",
            "campo": "Incluir KPIs",
            "valor": "Sí" if options.get("include_kpis") else "No"
        },
        {
            "seccion": "Parámetros del reporte",
            "campo": "Incluir gráficos",
            "valor": "Sí" if options.get("include_charts") else "No"
        },
        {
            "seccion": "Parámetros del reporte",
            "campo": "Incluir detalle operativo",
            "valor": "Sí" if options.get("include_detail") else "No"
        },
        {
            "seccion": "Parámetros del reporte",
            "campo": "Incluir trazabilidad",
            "valor": "Sí" if options.get("include_trace") else "No"
        }
    ]


def build_report_summary(title: str, rows: list, options: dict):
    critical = len([
        row for row in rows
        if isinstance(row, dict)
        and (
            priority_order(row.get("priority") or row.get("prioridad")) == 4
            or lower(row.get("severity") or row.get("criticidad")) in ["alta", "crítica", "critica"]
        )
    ])

    sla_risk = len([
        row for row in rows
        if isinstance(row, dict)
        and (
            as_int(row.get("slaHours") or row.get("horas_sla"), 999) <= 8
            or "vencido" in lower(row.get("sla") or row.get("slaText"))
            or "riesgo" in lower(row.get("slaRisk") or row.get("riesgo_sla"))
        )
    ])

    summary = [
        {
            "title": "Alcance aplicado",
            "text": (
                f"Tipo: {options.get('type')}. "
                f"Periodo: {options.get('period')}. "
                f"Alcance: {options.get('scope')}. "
                f"Detalle: {options.get('detail')}."
            )
        },
        {
            "title": "Registros incluidos",
            "text": f"{len(rows)} registros consolidados desde la base de datos."
        },
        {
            "title": "Criticidad",
            "text": f"{critical} registros requieren revisión prioritaria."
        },
        {
            "title": "Riesgo SLA",
            "text": f"{sla_risk} registros presentan riesgo, vencimiento o alerta SLA."
        }
    ]

    if options.get("destination") == "historial_reportes":
        summary.append({
            "title": "Destino",
            "text": "El reporte queda auditado para historial de reportes."
        })

    elif options.get("destination") == "compartir_enlace":
        summary.append({
            "title": "Destino",
            "text": "El reporte fue solicitado como versión compartible."
        })

    return summary


def report_dataset_dashboard(supervisor: dict, options: dict):
    filters = report_base_filters(options)

    data = supervisor_dashboard_service(
        supervisor=supervisor,
        periodo=options.get("period"),
        area=filters.get("area"),
        prioridad=filters.get("prioridad"),
        estado=filters.get("estado")
    )

    rows = []

    if options.get("include_kpis"):
        rows.extend(report_kpi_rows(data.get("kpis", [])))

    if options.get("include_charts"):
        rows.extend(report_kpi_rows(data.get("indicators", [])))

    if options.get("include_detail"):
        rows.extend([report_row("Casos críticos", row) for row in data.get("critical_cases", [])])
        rows.extend([report_row("Alertas SLA", row) for row in data.get("sla_alerts", [])])
        rows.extend([report_row("Equipo asesor", row) for row in data.get("advisors", [])])

    if options.get("include_trace") or options.get("detail") == "auditable":
        rows.extend([report_row("Actividad reciente", row) for row in data.get("activity", [])])

    if not rows:
        rows.extend(report_summary_rows(data.get("ai_summary", [])))

    rows = report_limit_rows_by_detail(rows, options)

    return {
        "title": "Dashboard supervisor",
        "rows": rows,
        "summary": build_report_summary("Dashboard supervisor", rows, options)
    }


def report_dataset_cases(supervisor: dict, options: dict):
    filters = report_base_filters(options)

    rows = supervisor_pending_cases_service(
        supervisor=supervisor,
        filtro=filters.get("filtro"),
        q=filters.get("q"),
        estado=filters.get("estado"),
        prioridad=filters.get("prioridad"),
        tipo=filters.get("tipo"),
        canal=filters.get("canal"),
        sla=filters.get("sla"),
        fecha_desde=filters.get("fecha_desde"),
        fecha_hasta=filters.get("fecha_hasta")
    ).get("items", [])

    result = []

    if options.get("include_kpis"):
        result.extend(report_kpi_rows([
            {
                "label": "Casos pendientes",
                "value": len(rows),
                "description": "Casos visibles con los filtros seleccionados."
            },
            {
                "label": "Críticos",
                "value": len([r for r in rows if priority_order(r.get("priority")) == 4]),
                "description": "Casos con prioridad crítica."
            },
            {
                "label": "Riesgo SLA",
                "value": len([r for r in rows if r.get("slaHours", 999) <= 8]),
                "description": "Casos vencidos o próximos a vencer."
            }
        ]))

    if options.get("include_detail") or options.get("detail") in ["operativo", "auditable"]:
        result.extend([report_row("Detalle operativo", row) for row in rows])

    if options.get("include_trace") or options.get("detail") == "auditable":
        for row in rows[:80]:
            try:
                detail = supervisor_case_detail_service(supervisor, str(row.get("id"))).get("case", {})
                result.extend([
                    report_row("Trazabilidad", {
                        "codigo_caso": row.get("code"),
                        "accion": trace.get("title"),
                        "detalle": trace.get("text"),
                        "fecha": trace.get("date"),
                        "usuario": trace.get("user")
                    })
                    for trace in detail.get("trace", [])
                ])
            except Exception:
                continue

    result = result or [report_row("Detalle operativo", row) for row in rows]
    result = report_limit_rows_by_detail(result, options)

    return {
        "title": "Casos pendientes",
        "rows": result,
        "summary": build_report_summary("Casos pendientes", rows, options)
    }


def report_dataset_assignments(supervisor: dict, options: dict):
    filters = report_base_filters(options)

    rows = supervisor_assignments_service(
        supervisor=supervisor,
        filtro=filters.get("filtro"),
        q=filters.get("q"),
        estado=filters.get("estado"),
        prioridad=filters.get("prioridad"),
        tipo=filters.get("tipo"),
        asesor=filters.get("asesor"),
        area=filters.get("area"),
        sla=filters.get("sla"),
        fecha_desde=filters.get("fecha_desde"),
        fecha_hasta=filters.get("fecha_hasta")
    ).get("items", [])

    result = []

    if options.get("include_kpis"):
        result.extend(report_kpi_rows([
            {
                "label": "Casos en asignación",
                "value": len(rows),
                "description": "Resultado de filtros aplicados."
            },
            {
                "label": "Sin asesor",
                "value": len([r for r in rows if not r.get("advisorId")]),
                "description": "Casos pendientes de responsable."
            },
            {
                "label": "Derivados/Escalados",
                "value": len([r for r in rows if r.get("derived") or r.get("escalated")]),
                "description": "Casos con movimiento operativo."
            }
        ]))

    if options.get("include_detail") or options.get("detail") != "ejecutivo":
        result.extend([report_row("Detalle de asignaciones", row) for row in rows])

    result = result or [report_row("Detalle de asignaciones", row) for row in rows]
    result = report_limit_rows_by_detail(result, options)

    return {
        "title": "Asignaciones",
        "rows": result,
        "summary": build_report_summary("Asignaciones", rows, options)
    }


def report_dataset_advisor_load(supervisor: dict, options: dict):
    filters = report_base_filters(options)

    rows = supervisor_advisor_load_service(
        supervisor=supervisor,
        filtro=filters.get("filtro"),
        q=filters.get("q"),
        area=filters.get("area"),
        disponibilidad=filters.get("estado"),
        carga=(options.get("filters") or {}).get("carga", "todos"),
        productividad=(options.get("filters") or {}).get("productividad", "todos")
    ).get("items", [])

    result = []

    if options.get("include_kpis"):
        result.extend(report_kpi_rows([
            {
                "label": "Asesores analizados",
                "value": len(rows),
                "description": "Asesores visibles en el reporte."
            },
            {
                "label": "Sobrecargados",
                "value": len([r for r in rows if r.get("capacity", 0) >= 85]),
                "description": "Asesores con carga alta."
            },
            {
                "label": "SLA en riesgo",
                "value": sum(r.get("slaRisk", 0) for r in rows),
                "description": "Casos en riesgo asociados a asesores."
            }
        ]))

    if options.get("include_detail") or options.get("detail") != "ejecutivo":
        result.extend([report_row("Carga de asesores", row) for row in rows])

    result = result or [report_row("Carga de asesores", row) for row in rows]
    result = report_limit_rows_by_detail(result, options)

    return {
        "title": "Carga de asesores",
        "rows": result,
        "summary": build_report_summary("Carga de asesores", rows, options)
    }


def report_dataset_sla(supervisor: dict, options: dict):
    filters = report_base_filters(options)

    rows = supervisor_sla_monitor_service(
        supervisor=supervisor,
        filtro=filters.get("filtro"),
        q=filters.get("q"),
        estado=filters.get("estado"),
        prioridad=filters.get("prioridad"),
        tipo=filters.get("tipo"),
        asesor=filters.get("asesor"),
        area=filters.get("area"),
        canal=filters.get("canal"),
        riesgo=filters.get("riesgo"),
        fecha_desde=filters.get("fecha_desde"),
        fecha_hasta=filters.get("fecha_hasta")
    ).get("items", [])

    result = []

    if options.get("include_kpis"):
        result.extend(report_kpi_rows([
            {
                "label": "Casos SLA visibles",
                "value": len(rows),
                "description": "Casos con riesgo o seguimiento SLA."
            },
            {
                "label": "Vencidos",
                "value": len([r for r in rows if r.get("slaHours", 999) < 0]),
                "description": "Casos fuera de plazo."
            },
            {
                "label": "Riesgo alto",
                "value": len([r for r in rows if 0 <= r.get("slaHours", 999) <= 8]),
                "description": "Casos próximos a vencer."
            }
        ]))

    if options.get("include_detail") or options.get("include_sla") or options.get("detail") != "ejecutivo":
        result.extend([report_row("Monitoreo SLA", row) for row in rows])

    result = result or [report_row("Monitoreo SLA", row) for row in rows]
    result = report_limit_rows_by_detail(result, options)

    return {
        "title": "Monitoreo SLA",
        "rows": result,
        "summary": build_report_summary("Monitoreo SLA", rows, options)
    }


def report_dataset_indicators(supervisor: dict, options: dict):
    filters = report_base_filters(options)

    indicators = supervisor_indicators_service(
        supervisor=supervisor,
        periodo=options.get("period"),
        asesor=filters.get("asesor"),
        area=filters.get("area"),
        tipo_caso=filters.get("tipo"),
        canal=filters.get("canal"),
        prioridad=filters.get("prioridad"),
        estado=filters.get("estado"),
        fecha_desde=filters.get("fecha_desde"),
        fecha_hasta=filters.get("fecha_hasta")
    )

    rows = indicators.get("items", [])
    advisors = indicators.get("advisor_performance") or indicators.get("advisors") or []

    result = []

    if options.get("include_kpis"):
        result.extend(report_kpi_rows(rows))

    if options.get("include_charts"):
        result.extend(report_chart_rows("Tendencia", indicators.get("trend") or indicators.get("tendencia") or []))
        result.extend(report_chart_rows("Distribución prioridad", indicators.get("priority_distribution") or indicators.get("prioridades") or []))

    if options.get("include_detail") or options.get("detail") != "ejecutivo":
        result.extend([report_row("Indicadores", row) for row in rows])
        result.extend([report_row("Desempeño asesor", row) for row in advisors])

    result = result or [report_row("Indicadores", row) for row in rows]
    result = report_limit_rows_by_detail(result, options)

    return {
        "title": "Indicadores",
        "rows": result,
        "summary": indicators.get("ai_summary") or build_report_summary("Indicadores", rows, options)
    }


def report_dataset_audit(supervisor: dict, options: dict):
    filters = options.get("filters") or {}
    base_filters = report_base_filters(options)

    rows = supervisor_audit_service(
        supervisor=supervisor,
        q=base_filters.get("q"),
        type=filters.get("type") or filters.get("tipo") or "todos",
        usuario=filters.get("usuario") or "todos",
        rol=filters.get("rol") or "todos",
        accion=filters.get("accion") or "todos",
        criticidad=filters.get("criticidad") or "todos",
        resultado=filters.get("resultado") or filters.get("estado") or "todos",
        modulo=filters.get("modulo") or "todos",
        fecha_desde=base_filters.get("fecha_desde"),
        fecha_hasta=base_filters.get("fecha_hasta")
    ).get("items", [])

    result = []

    if options.get("include_kpis"):
        result.extend(report_kpi_rows([
            {
                "label": "Eventos auditables",
                "value": len(rows),
                "description": "Eventos encontrados con filtros aplicados."
            },
            {
                "label": "Alta criticidad",
                "value": len([r for r in rows if "alta" in lower(r.get("severity"))]),
                "description": "Eventos sensibles."
            },
            {
                "label": "Usuarios",
                "value": len(set(r.get("user") for r in rows)),
                "description": "Usuarios con actividad."
            }
        ]))

    if options.get("include_detail") or options.get("include_trace") or options.get("detail") == "auditable":
        result.extend([report_row("Auditoría", row) for row in rows])

    result = result or [report_row("Auditoría", row) for row in rows]
    result = report_limit_rows_by_detail(result, options)

    return {
        "title": "Auditoría",
        "rows": result,
        "summary": build_report_summary("Auditoría", rows, options)
    }


def report_dataset_reports(supervisor: dict, options: dict):
    filters = options.get("filters") or {}

    data = supervisor_reports_service(
        supervisor=supervisor,
        q=filters.get("busqueda") or "",
        tipo=filters.get("tipo") or "todos",
        periodo=filters.get("periodo") or "todos",
        alcance=filters.get("alcance") or "todos",
        estado=filters.get("estado") or "todos",
        fecha_desde=filters.get("fecha_desde") or "",
        fecha_hasta=filters.get("fecha_hasta") or ""
    )

    rows = data.get("items", [])
    result = []

    if options.get("include_kpis"):
        result.extend(report_kpi_rows(data.get("kpis", [])))

    if options.get("include_detail") or options.get("detail") != "ejecutivo":
        result.extend([report_row("Historial de reportes", row) for row in rows])

    result = result or [report_row("Historial de reportes", row) for row in rows]

    return {
        "title": "Historial de reportes",
        "rows": result,
        "summary": data.get("ai_summary") or build_report_summary("Historial de reportes", rows, options)
    }


def report_dataset_config(supervisor: dict, options: dict):
    data = supervisor_config_service(supervisor)

    rows = []
    rows.extend([report_row("Reglas", row) for row in data.get("rules", [])])
    rows.extend([report_row("Rutas", row) for row in data.get("routes", [])])

    if options.get("include_trace") or options.get("detail") == "auditable":
        rows.extend([report_row("Solicitudes", row) for row in data.get("requests", [])])

    rows = report_limit_rows_by_detail(rows, options)

    return {
        "title": "Configuración de supervisión",
        "rows": rows,
        "summary": data.get("ai_summary") or build_report_summary("Configuración de supervisión", rows, options)
    }


def get_report_dataset(supervisor: dict, report_type: str, payload: dict = None):
    payload = payload or {}
    options = report_payload_options({
        **payload,
        "tipo": report_type or payload.get("tipo") or payload.get("type")
    })

    report_type_value = options["type"]

    if report_type_value == "dashboard":
        dataset = report_dataset_dashboard(supervisor, options)

    elif report_type_value == "casos_pendientes":
        dataset = report_dataset_cases(supervisor, options)

    elif report_type_value == "asignaciones":
        dataset = report_dataset_assignments(supervisor, options)

    elif report_type_value == "carga_asesores":
        dataset = report_dataset_advisor_load(supervisor, options)

    elif report_type_value == "monitoreo_sla":
        dataset = report_dataset_sla(supervisor, options)

    elif report_type_value == "indicadores":
        dataset = report_dataset_indicators(supervisor, options)

    elif report_type_value == "auditoria":
        dataset = report_dataset_audit(supervisor, options)

    elif report_type_value == "reportes":
        dataset = report_dataset_reports(supervisor, options)

    elif report_type_value == "configuracion":
        dataset = report_dataset_config(supervisor, options)

    else:
        base_filters = report_base_filters(options)
        rows = supervisor_cases_service(
            supervisor=supervisor,
            scope="all",
            q=base_filters.get("q"),
            estado=base_filters.get("estado"),
            prioridad=base_filters.get("prioridad"),
            tipo=base_filters.get("tipo"),
            asesor=base_filters.get("asesor"),
            area=base_filters.get("area"),
            canal=base_filters.get("canal"),
            sla=base_filters.get("sla"),
            riesgo=base_filters.get("riesgo"),
            fecha_desde=base_filters.get("fecha_desde"),
            fecha_hasta=base_filters.get("fecha_hasta")
        ).get("items", [])

        dataset = {
            "title": "Reporte general de supervisión",
            "rows": [report_row("Casos", row) for row in rows],
            "summary": build_report_summary("Reporte general de supervisión", rows, options)
        }

    rows = dataset.get("rows", [])

    if options.get("scope") == "resumen_ejecutivo":
        context_rows = report_add_context_rows(options)
        summary_rows = report_summary_rows(dataset.get("summary", []))
        dataset["rows"] = context_rows + summary_rows + rows[:30]

    else:
        dataset["rows"] = report_add_context_rows(options) + rows

    dataset["options"] = options

    return dataset


def extract_format_from_text(text: str):
    value = lower(text)

    if "pdf" in value:
        return "pdf"

    if "word" in value or "docx" in value or "doc" in value:
        return "docx"

    if "excel" in value or "xlsx" in value or "xls" in value:
        return "xlsx"

    if "csv" in value:
        return "csv"

    if "imagen" in value or "png" in value or "image" in value:
        return "png"

    if "dashboard" in value or "html" in value:
        return "dashboard"

    return "pdf"


def map_report_from_audit(row: dict):
    detail = clean(row.get("detalle") or row.get("accion") or "Reporte")
    fmt = extract_format_from_text(detail or row.get("valor_nuevo") or "")

    return {
        "id": row.get("auditoria_id") or row.get("id"),
        "name": detail[:120],
        "nombre": detail[:120],
        "type": row.get("tipo") or row.get("modulo") or "Reporte",
        "tipo": row.get("tipo") or row.get("modulo") or "Reporte",
        "period": "Generado",
        "periodo": "Generado",
        "scope": "Historial",
        "alcance": "Historial",
        "format": fmt,
        "formato": fmt,
        "owner": row.get("usuario_nombre") or "Supervisor",
        "generado_por": row.get("usuario_nombre") or "Supervisor",
        "status": row.get("resultado") or "Disponible",
        "estado": row.get("resultado") or "Disponible",
        "date": row.get("fecha_evento"),
        "fecha": row.get("fecha_evento"),
        "fecha_generacion": row.get("fecha_evento")
    }


def supervisor_reports_service(
    supervisor: dict,
    q: str = "",
    tipo: str = "todos",
    periodo: str = "todos",
    alcance: str = "todos",
    estado: str = "todos",
    fecha_desde: str = "",
    fecha_hasta: str = ""
):
    rows = safe_fetch_all(
        """
        SELECT TOP 120
            auditoria_id,
            modulo,
            tipo,
            accion,
            usuario_nombre,
            resultado,
            detalle,
            valor_nuevo,
            fecha_evento
        FROM auditoria_admin
        WHERE (
                LOWER(accion) LIKE '%reporte%'
                OR LOWER(accion) LIKE '%export%'
                OR LOWER(detalle) LIKE '%reporte%'
                OR LOWER(detalle) LIKE '%export%'
              )
        ORDER BY fecha_evento DESC
        """
    )

    reports = [map_report_from_audit(row) for row in rows]

    if clean(q):
        term = lower(q)
        reports = [
            item for item in reports
            if term in lower(item.get("name"))
            or term in lower(item.get("type"))
            or term in lower(item.get("format"))
            or term in lower(item.get("owner"))
            or term in lower(item.get("status"))
        ]

    if not is_all(tipo):
        reports = [
            item for item in reports
            if lower(tipo) in lower(item.get("type"))
            or lower(tipo) in lower(item.get("name"))
        ]

    if not is_all(periodo):
        reports = [
            item for item in reports
            if lower(periodo) in lower(item.get("period"))
            or lower(periodo) in lower(item.get("name"))
        ]

    if not is_all(alcance):
        reports = [
            item for item in reports
            if lower(alcance) in lower(item.get("scope"))
            or lower(alcance) in lower(item.get("name"))
        ]

    if not is_all(estado):
        reports = [
            item for item in reports
            if lower(estado) in lower(item.get("status"))
        ]

    start_date = parse_date(fecha_desde)
    end_date = parse_date(fecha_hasta)

    if start_date:
        reports = [
            item for item in reports
            if item.get("date") and item.get("date") >= start_date
        ]

    if end_date:
        reports = [
            item for item in reports
            if item.get("date") and item.get("date") < end_date + timedelta(days=1)
        ]

    kpis = [
        {
            "icon": "📊",
            "value": len(reports),
            "label": "Reportes",
            "description": "Historial visible."
        },
        {
            "icon": "✅",
            "value": len([
                r for r in reports
                if "exitoso" in lower(r.get("status"))
                or "disponible" in lower(r.get("status"))
            ]),
            "label": "Disponibles",
            "description": "Listos para descarga."
        },
        {
            "icon": "📄",
            "value": len(report_templates()),
            "label": "Plantillas",
            "description": "Tipos disponibles."
        },
        {
            "icon": "🔒",
            "value": "Auditado",
            "label": "Control",
            "description": "Toda descarga se registra."
        }
    ]

    ai_summary = [
        {
            "title": "Reportes conectados a BD",
            "text": "La generación formal usa datos consultados desde backend y deja auditoría."
        },
        {
            "title": "Historial",
            "text": f"{len(reports)} reportes o exportaciones aparecen con los filtros actuales."
        }
    ]

    return response_ok(
        "Reportes cargados.",
        items=reports,
        reports=reports,
        reportes=reports,
        recent_reports=reports[:10],
        reportes_recientes=reports[:10],
        templates=report_templates(),
        plantillas=report_templates(),
        report_templates=report_templates(),
        plantillas_reporte=report_templates(),
        kpis=kpis,
        ai_summary=ai_summary,
        resumen_ia=ai_summary
    )


def supervisor_recent_reports_service(supervisor: dict):
    return supervisor_reports_service(supervisor)


def supervisor_report_preview_service(supervisor: dict, payload: dict):
    report_type = clean(payload.get("tipo") or payload.get("type") or "dashboard")
    options = report_payload_options(payload)
    dataset = get_report_dataset(supervisor, report_type, payload)
    rows = dataset.get("rows", [])
    summary = dataset.get("summary", [])

    if len(rows) > 300:
        suggested_format = "xlsx"
    elif options.get("detail") == "auditable":
        suggested_format = "pdf"
    else:
        suggested_format = options.get("format") or "pdf"

    return response_ok(
        "Vista previa generada.",
        tipo=options.get("type"),
        periodo=options.get("period"),
        alcance=options.get("scope"),
        detalle=options.get("detail"),
        destino=options.get("destination"),
        formato=options.get("format"),
        total=len(rows),
        registros=len(rows),
        formato_sugerido=suggested_format,
        observacion="Vista previa calculada con filtros, periodo, alcance, detalle y checks seleccionados.",
        include_kpis=options.get("include_kpis"),
        include_charts=options.get("include_charts"),
        include_detail=options.get("include_detail"),
        include_trace=options.get("include_trace"),
        summary=summary,
        resumen=summary,
        preview=rows[:20],
        vista_previa=rows[:20]
    )


# =========================================================
# AUDITORÍA
# =========================================================

def map_audit(row: dict):
    return {
        "id": row.get("auditoria_id") or row.get("id"),
        "auditoria_id": row.get("auditoria_id") or row.get("id"),

        "date": row.get("fecha_evento"),
        "fecha": row.get("fecha_evento"),

        "caseId": extract_case_code(row.get("detalle")),
        "codigo_caso": extract_case_code(row.get("detalle")),
        "caso": extract_case_code(row.get("detalle")),

        "type": row.get("tipo") or row.get("modulo") or "general",
        "tipo": row.get("tipo") or row.get("modulo") or "general",
        "modulo": row.get("modulo") or "Supervisor",

        "action": row.get("accion") or "Evento registrado",
        "accion": row.get("accion") or "Evento registrado",

        "user": row.get("usuario_nombre") or row.get("username") or "Sistema",
        "usuario": row.get("usuario_nombre") or row.get("username") or "Sistema",

        "role": row.get("rol") or "Supervisor",
        "rol": row.get("rol") or "Supervisor",

        "before": row.get("valor_anterior") or "-",
        "antes": row.get("valor_anterior") or "-",

        "after": row.get("valor_nuevo") or "-",
        "despues": row.get("valor_nuevo") or "-",

        "result": row.get("resultado") or "Exitoso",
        "resultado": row.get("resultado") or "Exitoso",

        "severity": "Alta" if row.get("critico") else "Media",
        "criticidad": "Alta" if row.get("critico") else "Media",

        "detail": row.get("detalle") or "",
        "detalle": row.get("detalle") or "",

        "icon": audit_icon(row.get("accion") or row.get("tipo") or row.get("modulo"))
    }


def supervisor_audit_service(
    supervisor: dict,
    q: str = "",
    type: str = "todos",
    usuario: str = "todos",
    rol: str = "todos",
    accion: str = "todos",
    criticidad: str = "todos",
    resultado: str = "todos",
    modulo: str = "todos",
    fecha_desde: str = "",
    fecha_hasta: str = ""
):
    rows = safe_fetch_all(
        """
        SELECT TOP 300
            a.auditoria_id,
            a.modulo,
            a.tipo,
            a.accion,
            a.usuario_id,
            a.usuario_nombre,
            a.valor_anterior,
            a.valor_nuevo,
            a.resultado,
            a.critico,
            a.detalle,
            a.fecha_evento,
            r.nombre AS rol
        FROM auditoria_admin a
        LEFT JOIN usuarios u
            ON u.usuario_id = a.usuario_id
        LEFT JOIN roles r
            ON r.rol_id = u.rol_id
        ORDER BY a.fecha_evento DESC
        """
    )

    items = [map_audit(row) for row in rows]

    if clean(q):
        term = lower(q)
        items = [
            item for item in items
            if term in lower(item.get("caseId"))
            or term in lower(item.get("action"))
            or term in lower(item.get("user"))
            or term in lower(item.get("detail"))
            or term in lower(item.get("result"))
        ]

    if not is_all(type):
        items = [
            item for item in items
            if lower(type) in lower(item.get("type"))
            or lower(type) in lower(item.get("action"))
        ]

    if not is_all(usuario):
        items = [item for item in items if lower(usuario) in lower(item.get("user"))]

    if not is_all(rol):
        items = [item for item in items if lower(rol) in lower(item.get("role"))]

    if not is_all(accion):
        items = [item for item in items if lower(accion) in lower(item.get("action"))]

    if not is_all(criticidad):
        items = [item for item in items if lower(criticidad) in lower(item.get("severity"))]

    if not is_all(resultado):
        items = [item for item in items if lower(resultado) in lower(item.get("result"))]

    if not is_all(modulo):
        items = [item for item in items if lower(modulo) in lower(item.get("modulo"))]

    start_date = parse_date(fecha_desde)
    end_date = parse_date(fecha_hasta)

    if start_date:
        items = [
            item for item in items
            if item.get("date") and item.get("date") >= start_date
        ]

    if end_date:
        items = [
            item for item in items
            if item.get("date") and item.get("date") < end_date + timedelta(days=1)
        ]

    kpis = [
        {
            "icon": "🕵️",
            "value": len(items),
            "label": "Eventos visibles",
            "description": "Resultado del filtro."
        },
        {
            "icon": "⚠️",
            "value": len([i for i in items if lower(i.get("severity")) == "alta"]),
            "label": "Alta criticidad",
            "description": "Eventos sensibles."
        },
        {
            "icon": "👤",
            "value": len(set(i.get("user") for i in items)),
            "label": "Usuarios",
            "description": "Con actividad registrada."
        },
        {
            "icon": "✅",
            "value": len([i for i in items if "exitoso" in lower(i.get("result"))]),
            "label": "Correctos",
            "description": "Procesados sin error."
        }
    ]

    ai_summary = [
        {
            "title": "Auditoría revisada",
            "text": f"Se encontraron {len(items)} eventos según los filtros aplicados."
        },
        {
            "title": "Eventos sensibles",
            "text": f"{len([i for i in items if lower(i.get('severity')) == 'alta'])} eventos tienen criticidad alta."
        }
    ]

    action_plan = [
        {
            "icon": "1",
            "title": "Revisar criticidad alta",
            "text": "Prioriza cambios de prioridad, exportaciones y escalamiento."
        },
        {
            "icon": "2",
            "title": "Comparar caso",
            "text": "Usa comparación para revisar valores antes/después."
        },
        {
            "icon": "3",
            "title": "Exportar evidencia",
            "text": "Genera PDF o Excel auditable si requiere sustento."
        }
    ]

    return response_ok(
        "Auditoría cargada.",
        items=items,
        audit=items,
        auditoria=items,
        events=items,
        eventos=items,
        trace=items,
        trazabilidad=items,
        kpis=kpis,
        ai_summary=ai_summary,
        resumen_ia=ai_summary,
        action_plan=action_plan,
        plan_accion=action_plan
    )


def supervisor_compare_audit_service(supervisor: dict, payload: dict):
    case_id = clean(payload.get("caso_id") or payload.get("case_id"))

    if not case_id:
        raise HTTPException(
            status_code=400,
            detail="Ingresa un caso para comparar auditoría."
        )

    case = get_case(case_id)

    rows = safe_fetch_all(
        """
        SELECT
            h.accion,
            h.observacion,
            h.fecha_evento,
            u.username
        FROM historial_caso h
        LEFT JOIN usuarios u
            ON u.usuario_id = h.usuario_id
        WHERE h.caso_id = ?
        ORDER BY h.fecha_evento ASC
        """,
        (case["caso_id"],)
    )

    changes = []

    for row in rows:
        changes.append({
            "campo": row.get("accion"),
            "field": row.get("accion"),
            "antes": "-",
            "before": "-",
            "despues": row.get("observacion"),
            "after": row.get("observacion"),
            "usuario": row.get("username") or "Sistema",
            "user": row.get("username") or "Sistema",
            "fecha": row.get("fecha_evento"),
            "date": row.get("fecha_evento")
        })

    return response_ok(
        "Comparación de auditoría generada.",
        items=changes,
        comparacion=changes,
        changes=changes,
        cambios=changes
    )


# =========================================================
# CONFIGURACIÓN
# =========================================================

def supervisor_config_service(
    supervisor: dict,
    q: str = "",
    filtro: str = "todos",
    categoria: str = "todos",
    estado: str = "todos",
    responsable: str = "todos",
    impacto: str = "todos"
):
    prioridades = catalog_from_table("prioridades", "prioridad_id") or static_catalog(["Baja", "Media", "Alta", "Crítica"])
    estados_caso = catalog_from_table("estados_caso", "estado_caso_id") or static_catalog(["Registrado", "En atención", "Derivado", "Pendiente por cliente", "Cerrado"])
    areas = catalog_from_table("areas", "area_id") or static_catalog(["Mesa de entrada", "Soporte técnico", "Facturación", "Backoffice"])

    rules = []

    for item in prioridades:
        rules.append({
            "id": f"prioridad-{item['id']}",
            "codigo": f"prioridad-{item['id']}",
            "nombre": f"Prioridad {item['label']}",
            "name": f"Prioridad {item['label']}",
            "categoria": "prioridad",
            "category": "prioridad",
            "valor": item["label"],
            "value": item["label"],
            "descripcion": "Regla de clasificación de prioridad para casos.",
            "description": "Regla de clasificación de prioridad para casos.",
            "estado": "Activo",
            "status": "Activo",
            "responsable": "Administrador",
            "owner": "Administrador",
            "impacto": "medio",
            "impact": "medio"
        })

    for item in estados_caso:
        rules.append({
            "id": f"estado-{item['id']}",
            "codigo": f"estado-{item['id']}",
            "nombre": f"Estado {item['label']}",
            "name": f"Estado {item['label']}",
            "categoria": "flujo",
            "category": "flujo",
            "valor": item["label"],
            "value": item["label"],
            "descripcion": "Estado operativo del ciclo de vida del caso.",
            "description": "Estado operativo del ciclo de vida del caso.",
            "estado": "Activo",
            "status": "Activo",
            "responsable": "Administrador",
            "owner": "Administrador",
            "impacto": "medio",
            "impact": "medio"
        })

    routes = []

    for area_item in areas:
        routes.append({
            "id": f"ruta-{area_item['id']}",
            "codigo": f"ruta-{area_item['id']}",
            "nombre": f"Ruta hacia {area_item['label']}",
            "name": f"Ruta hacia {area_item['label']}",
            "origen": "Mesa de entrada",
            "destino": area_item["label"],
            "criterio": "Según tipo, categoría y especialidad",
            "sla": "24 horas",
            "sla_interno": "24 horas",
            "descripcion": f"Derivación operativa hacia {area_item['label']}.",
            "description": f"Derivación operativa hacia {area_item['label']}.",
            "estado": "Activo",
            "status": "Activo",
            "responsable": "Administrador",
            "owner": "Administrador",
            "impacto": "medio",
            "impact": "medio"
        })

    requests = supervisor_config_change_requests_service(supervisor).get("items", [])

    all_rules = rules

    if clean(q):
        term = lower(q)
        all_rules = [
            item for item in all_rules
            if term in lower(item.get("nombre"))
            or term in lower(item.get("descripcion"))
            or term in lower(item.get("categoria"))
            or term in lower(item.get("valor"))
        ]

        routes = [
            item for item in routes
            if term in lower(item.get("nombre"))
            or term in lower(item.get("descripcion"))
            or term in lower(item.get("destino"))
        ]

    if not is_all(filtro):
        term = lower(filtro)
        all_rules = [
            item for item in all_rules
            if term in lower(item.get("categoria"))
            or term in lower(item.get("nombre"))
            or term in lower(item.get("descripcion"))
        ]

        routes = [
            item for item in routes
            if term in lower(item.get("nombre"))
            or term in lower(item.get("descripcion"))
            or term in lower(item.get("destino"))
        ]

    if not is_all(categoria):
        all_rules = [item for item in all_rules if lower(categoria) in lower(item.get("categoria"))]
        routes = [item for item in routes if lower(categoria) in lower(item.get("nombre")) or lower(categoria) in lower(item.get("descripcion"))]

    if not is_all(estado):
        all_rules = [item for item in all_rules if lower(estado) in lower(item.get("estado"))]
        routes = [item for item in routes if lower(estado) in lower(item.get("estado"))]

    if not is_all(responsable):
        all_rules = [item for item in all_rules if lower(responsable) in lower(item.get("responsable"))]
        routes = [item for item in routes if lower(responsable) in lower(item.get("responsable"))]

    if not is_all(impacto):
        all_rules = [item for item in all_rules if lower(impacto) in lower(item.get("impacto"))]
        routes = [item for item in routes if lower(impacto) in lower(item.get("impacto"))]

    kpis = [
        {
            "icon": "⚙️",
            "value": len(all_rules),
            "label": "Reglas visibles",
            "description": "Configuración activa."
        },
        {
            "icon": "🧭",
            "value": len(routes),
            "label": "Rutas",
            "description": "Rutas operativas."
        },
        {
            "icon": "📝",
            "value": len(requests),
            "label": "Solicitudes",
            "description": "Cambios solicitados."
        },
        {
            "icon": "🔒",
            "value": "Solo lectura",
            "label": "Modo supervisor",
            "description": "Los cambios van a Administrador."
        }
    ]

    ai_summary = [
        {
            "title": "Modo seguro",
            "text": "El Supervisor consulta y solicita cambios; no edita reglas globales directamente."
        },
        {
            "title": "Recomendación",
            "text": "Simula prioridad o ruta antes de enviar una solicitud al Administrador."
        }
    ]

    action_plan = [
        {
            "icon": "1",
            "title": "Consultar regla",
            "text": "Revisa la configuración vigente."
        },
        {
            "icon": "2",
            "title": "Simular impacto",
            "text": "Valida prioridad o ruta con datos de prueba."
        },
        {
            "icon": "3",
            "title": "Solicitar cambio",
            "text": "Envía la propuesta al Administrador para aprobación."
        }
    ]

    return response_ok(
        "Configuración cargada.",
        items=all_rules,
        rules=all_rules,
        reglas=all_rules,
        config_rules=all_rules,
        configuraciones=all_rules,
        routes=routes,
        rutas=routes,
        route_rules=routes,
        reglas_ruta=routes,
        requests=requests,
        solicitudes=requests,
        change_requests=requests,
        solicitudes_cambio=requests,
        kpis=kpis,
        ai_summary=ai_summary,
        resumen_ia=ai_summary,
        action_plan=action_plan,
        plan_accion=action_plan
    )


def supervisor_simulate_priority_service(supervisor: dict, payload: dict):
    tipo = clean(payload.get("tipo_caso") or payload.get("type"))
    canal = clean(payload.get("canal") or payload.get("channel"))
    tipo_cliente = clean(payload.get("tipo_cliente") or payload.get("client_type"))
    impacto = clean(payload.get("impacto") or payload.get("impact"))
    sla = clean(payload.get("sla") or payload.get("sla_range"))

    if not tipo or not canal or not tipo_cliente or not impacto:
        raise HTTPException(
            status_code=400,
            detail="Completa tipo, canal, tipo de cliente e impacto."
        )

    score = 0

    if lower(impacto) in ["critico", "crítico"]:
        score += 4
    elif lower(impacto) == "alto":
        score += 3
    elif lower(impacto) == "medio":
        score += 2
    else:
        score += 1

    if lower(tipo_cliente) == "empresa":
        score += 1

    if lower(sla) in ["vencido", "menos_4h", "menos_8h"]:
        score += 2
    elif lower(sla) == "menos_24h":
        score += 1

    if score >= 6:
        prioridad = "Crítica"
        sla_sugerido = "4 horas"
        ruta = "Mesa crítica"
    elif score >= 4:
        prioridad = "Alta"
        sla_sugerido = "8 horas"
        ruta = "Soporte técnico" if "técn" in lower(tipo) or "incid" in lower(tipo) else "Backoffice"
    elif score >= 2:
        prioridad = "Media"
        sla_sugerido = "24 horas"
        ruta = "Mesa de entrada"
    else:
        prioridad = "Baja"
        sla_sugerido = "48 horas"
        ruta = "Mesa de entrada"

    return response_ok(
        "Simulación generada.",
        prioridad=prioridad,
        priority=prioridad,
        sla=sla_sugerido,
        sla_sugerido=sla_sugerido,
        ruta=ruta,
        route=ruta,
        regla=f"Score operativo {score}: tipo={tipo}, canal={canal}, cliente={tipo_cliente}, impacto={impacto}",
        rule=f"Score operativo {score}: tipo={tipo}, canal={canal}, cliente={tipo_cliente}, impacto={impacto}"
    )


def supervisor_create_config_change_request_service(supervisor: dict, payload: dict):
    tipo = clean(payload.get("tipo") or payload.get("type"))
    motivo = clean(payload.get("motivo") or payload.get("reason"))
    propuesta = clean(payload.get("propuesta") or payload.get("proposal"))

    if not tipo or not motivo or not propuesta:
        raise HTTPException(
            status_code=400,
            detail="Completa tipo, motivo y propuesta."
        )

    conn = get_connection()

    try:
        cursor = conn.cursor()

        insert_audit(
            cursor=cursor,
            supervisor=supervisor,
            tipo="configuracion",
            accion="Solicitud de cambio de configuración",
            detalle=(
                f"Tipo: {tipo}. "
                f"Regla: {payload.get('regla_id') or 'No especificada'}. "
                f"Impacto: {payload.get('impacto') or 'No indicado'}. "
                f"Motivo: {motivo}. "
                f"Propuesta: {propuesta}. "
                f"Comentario: {payload.get('comentario') or ''}"
            ),
            valor_anterior="-",
            valor_nuevo=propuesta,
            critico=lower(payload.get("impacto")) in ["alto", "critico", "crítico"]
        )

        conn.commit()

        return response_ok(
            "Solicitud enviada al Administrador.",
            request={
                "tipo": tipo,
                "motivo": motivo,
                "propuesta": propuesta,
                "estado": "Registrada",
                "fecha": datetime.now()
            },
            solicitud={
                "tipo": tipo,
                "motivo": motivo,
                "propuesta": propuesta,
                "estado": "Registrada",
                "fecha": datetime.now()
            }
        )

    except Exception as exc:
        conn.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"No se pudo registrar la solicitud: {str(exc)}"
        )

    finally:
        conn.close()


def supervisor_config_change_requests_service(supervisor: dict):
    rows = safe_fetch_all(
        """
        SELECT TOP 40
            auditoria_id,
            accion,
            detalle,
            valor_nuevo,
            resultado,
            critico,
            fecha_evento
        FROM auditoria_admin
        WHERE accion = 'Solicitud de cambio de configuración'
        ORDER BY fecha_evento DESC
        """
    )

    items = []

    for row in rows:
        items.append({
            "id": row.get("auditoria_id"),
            "titulo": row.get("accion"),
            "title": row.get("accion"),
            "tipo": "Solicitud",
            "descripcion": row.get("detalle"),
            "description": row.get("detalle"),
            "motivo": row.get("detalle"),
            "estado": row.get("resultado") or "Registrada",
            "status": row.get("resultado") or "Registrada",
            "fecha": row.get("fecha_evento"),
            "date": row.get("fecha_evento"),
            "impacto": "alto" if row.get("critico") else "medio"
        })

    return response_ok(
        "Solicitudes cargadas.",
        items=items,
        requests=items,
        solicitudes=items,
        change_requests=items,
        solicitudes_cambio=items
    )


# =========================================================
# BUSCADOR GLOBAL
# =========================================================

def supervisor_search_service(supervisor: dict, q: str):
    term = clean(q)

    if not term:
        return response_ok("Sin búsqueda.", items=[])

    results = []

    cases = supervisor_cases_service(supervisor, scope="all", q=term)["items"][:8]

    for case in cases:
        results.append({
            "icon": "📋",
            "title": f"{case['code']} · {case['clientName']}",
            "titulo": f"{case['code']} · {case['clientName']}",
            "text": f"{case['type']} · {case['priority']} · {case['status']}",
            "descripcion": f"{case['type']} · {case['priority']} · {case['status']}",
            "href": f"casos-pendientes.html?case={case['id']}&action=classify"
        })

    advisors = supervisor_advisors_service(supervisor, q=term)["items"][:5]

    for advisor in advisors:
        results.append({
            "icon": "👤",
            "title": advisor["name"],
            "titulo": advisor["name"],
            "text": f"{advisor['specialty']} · {advisor['status']} · {advisor['capacity']}% carga",
            "descripcion": f"{advisor['specialty']} · {advisor['status']} · {advisor['capacity']}% carga",
            "href": f"carga-asesores.html?advisor={advisor['id']}"
        })

    audit = supervisor_audit_service(supervisor, q=term)["items"][:5]

    for item in audit:
        results.append({
            "icon": item.get("icon") or "🕵️",
            "title": item.get("action"),
            "titulo": item.get("action"),
            "text": item.get("detail"),
            "descripcion": item.get("detail"),
            "href": "auditoria-casos.html"
        })

    return response_ok(
        "Búsqueda completada.",
        items=results,
        results=results,
        resultados=results,
        total=len(results)
    )


# =========================================================
# ASISTENTE IA
# =========================================================

def supervisor_assistant_service(supervisor: dict, payload: dict):
    prompt = lower(payload.get("prompt") or payload.get("message") or "")
    page = clean(payload.get("page") or "")
    case_id = payload.get("case_id")
    advisor_id = payload.get("advisor_id")
    indicator_id = payload.get("indicator_id")

    if "sla" in prompt:
        sla = supervisor_sla_monitor_service(supervisor)["items"]
        vencidos = len([item for item in sla if item.get("slaHours", 999) < 0])
        riesgo = len([item for item in sla if 0 <= item.get("slaHours", 999) <= 8])

        answer = (
            f"Actualmente hay {vencidos} casos vencidos y {riesgo} casos en riesgo alto. "
            "La recomendación es enviar alerta SLA, registrar seguimiento y escalar los casos vencidos o críticos."
        )

    elif "carga" in prompt or "redistrib" in prompt or "asesor" in prompt:
        advisors = supervisor_advisors_service(supervisor)["items"]
        overloaded = [item for item in advisors if item.get("capacity", 0) >= 85]
        available = [item for item in advisors if lower(item.get("status")) == "disponible"]

        answer = (
            f"Se encontraron {len(overloaded)} asesores con carga alta y {len(available)} asesores disponibles. "
            "Conviene usar redistribución con vista previa, moviendo primero casos con menor complejidad o SLA más cercano según el criterio operativo."
        )

    elif "reporte" in prompt or "export" in prompt:
        answer = (
            "Para jefatura conviene PDF ejecutivo. Para análisis operativo usa Excel o CSV. "
            "Para compartir una vista de seguimiento usa dashboard compartible. Toda generación debe incluir motivo y quedar auditada."
        )

    elif "config" in prompt or "regla" in prompt:
        answer = (
            "El Supervisor debe consultar reglas, simular impacto y enviar solicitudes de cambio al Administrador. "
            "No debe editar reglas globales directamente para mantener control y trazabilidad."
        )

    elif "indicador" in prompt or "desempeño" in prompt or "desempeno" in prompt:
        indicators = supervisor_indicators_service(supervisor)["items"]
        risk = [
            item for item in indicators
            if item.get("status") in ["danger", "warning"]
        ]

        answer = (
            f"Hay {len(risk)} indicadores en riesgo o advertencia. "
            "Revisa Cumplimiento SLA, Casos asignados y Productividad promedio. Luego abre el desempeño por asesor para encontrar la causa."
        )

    elif case_id:
        try:
            case = supervisor_case_detail_service(supervisor, str(case_id))["case"]
            answer = (
                f"El caso {case['code']} pertenece a {case['clientName']}, "
                f"tiene prioridad {case['priority']} y estado {case['status']}. "
                f"Sugerencia: {case['action']}"
            )
        except Exception:
            answer = "No pude cargar el caso seleccionado. Verifica que siga existiendo en la base de datos."

    elif advisor_id:
        try:
            advisor = supervisor_advisor_detail_service(supervisor, int(advisor_id))["advisor"]
            answer = (
                f"{advisor['name']} tiene {advisor['cases']} casos, "
                f"{advisor['critical']} críticos y {advisor['slaRisk']} en riesgo SLA. "
                "Revisa si requiere redistribución o ajuste de disponibilidad."
            )
        except Exception:
            answer = "No pude cargar el asesor seleccionado."

    elif indicator_id:
        answer = (
            f"El indicador seleccionado es {indicator_id}. "
            "Revisa su valor, meta, tendencia y casos relacionados antes de generar acciones."
        )

    else:
        resumen = supervisor_resumen_service(supervisor)
        answer = (
            f"La operación tiene {resumen.get('pendientes', 0)} pendientes y "
            f"{resumen.get('sla_riesgo', 0)} casos en riesgo SLA. "
            "Prioriza casos críticos, vencidos y sin asesor asignado."
        )

    return response_ok(
        "Respuesta generada.",
        answer=answer,
        respuesta=answer,
        page=page
    )
# =========================================================
# EXPORTACIONES PROFESIONALES - BLOQUE FINAL ÚNICO
# CLARO ATENCIÓN 360 - SUPERVISOR
# ---------------------------------------------------------
# Este bloque debe ir al FINAL de service.py.
# Reemplaza cualquier bloque anterior de exportaciones.
#
# Soporta:
# - PDF
# - Excel XLSX real
# - Word DOCX real
# - CSV
# - Dashboard HTML
# - Imagen PNG real simple
#
# No requiere librerías externas.
# =========================================================

def normalize_export_format(value):
    text = lower(value)

    if "pdf" in text:
        return "pdf"

    if "word" in text or "docx" in text or text == "doc":
        return "docx"

    if "excel" in text or "xlsx" in text or "xls" in text:
        return "xlsx"

    if "csv" in text:
        return "csv"

    if "imagen" in text or "image" in text or "png" in text or "jpg" in text:
        return "png"

    if "dashboard" in text or "html" in text or "compartible" in text:
        return "html"

    return "pdf"


def export_extension(format_value):
    fmt = normalize_export_format(format_value)

    return {
        "pdf": "pdf",
        "xlsx": "xlsx",
        "docx": "docx",
        "csv": "csv",
        "png": "png",
        "html": "html",
    }.get(fmt, "pdf")


def export_media_type(format_value):
    fmt = normalize_export_format(format_value)

    return {
        "pdf": "application/pdf",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "csv": "text/csv; charset=utf-8",
        "png": "image/png",
        "html": "text/html; charset=utf-8",
    }.get(fmt, "application/octet-stream")


def safe_export_filename(value, fallback="reporte-supervisor"):
    import unicodedata

    text = clean(value or fallback)
    text = unicodedata.normalize("NFD", text)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = re.sub(r"[^a-zA-Z0-9_.-]+", "_", text).strip("_.")

    return lower(text or fallback)


def export_clean_text(value, max_len=500):
    if value is None:
        return "-"

    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")

    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False, default=str)

    text = str(value)
    text = text.replace("\r", " ").replace("\n", " ")
    text = re.sub(r"\s+", " ", text).strip()

    if not text:
        return "-"

    if len(text) > max_len:
        return text[:max_len - 3] + "..."

    return text


def xml_escape(value):
    import html

    return html.escape(export_clean_text(value, 1800), quote=True)


def export_label(key):
    labels = {
        "seccion": "Sección",
        "campo": "Campo",
        "id": "ID",
        "case_id": "ID caso",
        "caso_id": "ID caso",
        "code": "Código",
        "codigo": "Código",
        "codigo_caso": "Código de caso",
        "clientName": "Cliente",
        "cliente_nombre": "Cliente",
        "cliente": "Cliente",
        "clientType": "Tipo cliente",
        "tipo_cliente": "Tipo cliente",
        "documento": "Documento",
        "correo_cliente": "Correo cliente",
        "telefono_cliente": "Teléfono cliente",
        "type": "Tipo",
        "tipo": "Tipo",
        "tipo_caso": "Tipo de caso",
        "category": "Categoría",
        "categoria": "Categoría",
        "priority": "Prioridad",
        "prioridad": "Prioridad",
        "status": "Estado",
        "estado": "Estado",
        "advisorName": "Asesor",
        "asesor_nombre": "Asesor",
        "responsable": "Responsable",
        "area": "Área",
        "area_nombre": "Área",
        "channel": "Canal",
        "canal": "Canal",
        "service": "Servicio",
        "servicio": "Servicio",
        "title": "Título",
        "titulo": "Título",
        "description": "Descripción",
        "descripcion": "Descripción",
        "slaText": "SLA",
        "sla": "SLA",
        "slaRisk": "Riesgo SLA",
        "riesgo_sla": "Riesgo SLA",
        "slaHours": "Horas SLA",
        "sla_hours": "Horas SLA",
        "horas_sla": "Horas SLA",
        "createdAt": "Fecha registro",
        "fecha_registro": "Fecha registro",
        "updatedAt": "Última actualización",
        "fecha_actualizacion": "Última actualización",
        "deadline": "Fecha límite",
        "fecha_limite_resolucion": "Fecha límite",
        "name": "Nombre",
        "nombre": "Nombre",
        "label": "Indicador",
        "indicador": "Indicador",
        "value": "Valor",
        "valor": "Valor",
        "target": "Meta",
        "meta": "Meta",
        "progress": "Avance",
        "avance": "Avance",
        "productivity": "Productividad",
        "productividad": "Productividad",
        "capacity": "Capacidad",
        "capacidad": "Capacidad",
        "cases": "Casos",
        "casos": "Casos",
        "critical": "Críticos",
        "criticos": "Críticos",
        "date": "Fecha",
        "fecha": "Fecha",
        "action": "Acción",
        "accion": "Acción",
        "user": "Usuario",
        "usuario": "Usuario",
        "role": "Rol",
        "rol": "Rol",
        "result": "Resultado",
        "resultado": "Resultado",
        "severity": "Criticidad",
        "criticidad": "Criticidad",
        "detail": "Detalle",
        "detalle": "Detalle",
        "before": "Antes",
        "antes": "Antes",
        "after": "Después",
        "despues": "Después",
        "motivo": "Motivo",
        "reason": "Motivo",
        "formato": "Formato",
        "format": "Formato",
        "alcance": "Alcance",
        "scope": "Alcance",
        "hallazgo": "Hallazgo",
        "etiqueta": "Etiqueta",
    }

    return labels.get(key, clean(key).replace("_", " ").replace("-", " ").title())


def export_excluded_keys():
    return {
        "raw",
        "raw_data",
        "history",
        "historial",
        "trace",
        "trazabilidad",
        "evidence",
        "evidencias",
        "icon",
        "icono",
    }


def normalize_export_rows(rows):
    if not rows:
        return [{"mensaje": "No hay registros disponibles para exportar con los parámetros seleccionados."}]

    normalized = []

    for row in rows:
        if isinstance(row, dict):
            normalized.append(row)
        else:
            normalized.append({"valor": row})

    return normalized


def preferred_export_columns(rows, limit=14):
    rows = normalize_export_rows(rows)

    priority = [
        "seccion",
        "campo",
        "valor",
        "code",
        "codigo_caso",
        "clientName",
        "cliente_nombre",
        "cliente",
        "clientType",
        "tipo_cliente",
        "documento",
        "type",
        "tipo",
        "tipo_caso",
        "category",
        "categoria",
        "priority",
        "prioridad",
        "status",
        "estado",
        "advisorName",
        "asesor_nombre",
        "responsable",
        "area",
        "area_nombre",
        "channel",
        "canal",
        "service",
        "servicio",
        "slaText",
        "sla",
        "slaRisk",
        "riesgo_sla",
        "slaHours",
        "horas_sla",
        "createdAt",
        "fecha_registro",
        "deadline",
        "fecha_limite_resolucion",
        "name",
        "nombre",
        "label",
        "indicador",
        "value",
        "target",
        "meta",
        "progress",
        "avance",
        "cases",
        "casos",
        "critical",
        "criticos",
        "capacity",
        "capacidad",
        "productivity",
        "productividad",
        "date",
        "fecha",
        "action",
        "accion",
        "user",
        "usuario",
        "role",
        "rol",
        "result",
        "resultado",
        "severity",
        "criticidad",
        "detail",
        "detalle",
        "before",
        "antes",
        "after",
        "despues",
        "description",
        "descripcion",
        "hallazgo",
    ]

    excluded = export_excluded_keys()
    selected = []

    for row in rows:
        if not isinstance(row, dict):
            continue

        for key in priority:
            if key in row and key not in selected and key not in excluded:
                selected.append(key)

    for row in rows:
        if not isinstance(row, dict):
            continue

        for key in row.keys():
            if key not in selected and key not in excluded:
                selected.append(key)

    return selected[:limit] if selected else ["mensaje"]


def build_export_metadata(title, format_value, rows, summary=None, payload=None):
    payload = payload or {}
    rows = normalize_export_rows(rows)
    summary = summary or []

    total = len(rows)

    critical = len([
        row for row in rows
        if isinstance(row, dict)
        and (
            priority_order(row.get("priority") or row.get("prioridad")) == 4
            or lower(row.get("severity") or row.get("criticidad")) in ["alta", "crítica", "critica"]
        )
    ])

    sla_risk = len([
        row for row in rows
        if isinstance(row, dict)
        and (
            as_int(row.get("slaHours") or row.get("horas_sla"), 999) <= 8
            or "riesgo" in lower(row.get("slaRisk") or row.get("riesgo_sla"))
            or "vencido" in lower(row.get("slaText") or row.get("sla"))
        )
    ])

    return {
        "title": clean(title) or "Reporte Supervisor",
        "format": normalize_export_format(format_value).upper(),
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "scope": clean(payload.get("scope") or payload.get("alcance") or "Vista actual"),
        "detail": clean(payload.get("detail") or payload.get("detalle") or "Operativo"),
        "destination": clean(payload.get("destination") or payload.get("destino") or "descarga_local"),
        "reason": clean(payload.get("reason") or payload.get("motivo") or payload.get("comentario") or "No especificado"),
        "period": clean(payload.get("period") or payload.get("periodo") or "-"),
        "total": total,
        "critical": critical,
        "sla_risk": sla_risk,
        "summary": summary,
    }


def build_executive_summary(metadata):
    rows = [
        {
            "title": "Registros analizados",
            "text": f"{metadata['total']} registros incluidos en el archivo."
        },
        {
            "title": "Elementos críticos",
            "text": f"{metadata['critical']} registros requieren revisión prioritaria."
        },
        {
            "title": "Riesgo SLA",
            "text": f"{metadata['sla_risk']} registros presentan vencimiento, riesgo o alerta SLA."
        },
        {
            "title": "Parámetros",
            "text": f"Periodo: {metadata['period']}. Alcance: {metadata['scope']}. Nivel: {metadata['detail']}."
        },
    ]

    for item in metadata.get("summary") or []:
        if isinstance(item, dict):
            rows.append({
                "title": export_clean_text(item.get("title") or item.get("titulo") or "Resumen", 80),
                "text": export_clean_text(item.get("text") or item.get("descripcion") or item.get("detail") or "", 250)
            })

    return rows[:8]


# =========================================================
# CSV
# =========================================================

def build_csv_bytes(rows, summary=None, payload=None):
    rows = normalize_export_rows(rows)
    columns = preferred_export_columns(rows, limit=80)

    output = io.StringIO()
    writer = csv.writer(output, delimiter=";", quotechar='"', quoting=csv.QUOTE_MINIMAL)

    writer.writerow([export_label(column) for column in columns])

    for row in rows:
        writer.writerow([export_clean_text(row.get(column), 1800) for column in columns])

    return output.getvalue().encode("utf-8-sig")


# =========================================================
# DASHBOARD HTML COMPARTIBLE
# =========================================================

def build_html_bytes(title, rows, summary=None, payload=None):
    rows = normalize_export_rows(rows)
    metadata = build_export_metadata(title, "html", rows, summary, payload)
    columns = preferred_export_columns(rows, limit=14)

    summary_cards = ""
    for item in build_executive_summary(metadata)[:4]:
        summary_cards += f"""
        <article class="card">
          <span>{xml_escape(item['title'])}</span>
          <strong>{xml_escape(item['text'])}</strong>
        </article>
        """

    table_head = "".join(f"<th>{xml_escape(export_label(column))}</th>" for column in columns)

    table_body = ""
    for row in rows[:500]:
        table_body += "<tr>"
        for column in columns:
            table_body += f"<td>{xml_escape(row.get(column))}</td>"
        table_body += "</tr>"

    html_doc = f"""
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{xml_escape(metadata['title'])}</title>
  <style>
    :root {{
      --red: #e2231a;
      --dark-red: #8f1510;
      --dark: #111827;
      --gray: #6b7280;
      --line: #e5e7eb;
      --bg: #f8fafc;
      --white: #ffffff;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      background: var(--bg);
      color: var(--dark);
      font-family: Arial, Helvetica, sans-serif;
    }}
    header {{
      padding: 34px 42px;
      color: #fff;
      background: linear-gradient(135deg, var(--red), var(--dark-red));
    }}
    header small {{
      display: block;
      opacity: .9;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: .08em;
      font-weight: 800;
    }}
    header h1 {{
      margin: 0;
      font-size: 30px;
      line-height: 1.2;
    }}
    header p {{
      margin: 10px 0 0;
      opacity: .95;
    }}
    main {{
      padding: 30px 42px 46px;
    }}
    .meta,
    .cards,
    .panel {{
      max-width: 1220px;
      margin: 0 auto 22px;
    }}
    .meta {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }}
    .meta div,
    .card,
    .panel {{
      border: 1px solid var(--line);
      border-radius: 20px;
      background: var(--white);
      box-shadow: 0 14px 32px rgba(15, 23, 42, .08);
    }}
    .meta div,
    .card {{
      padding: 18px;
    }}
    .meta span,
    .card span {{
      display: block;
      color: var(--gray);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: .06em;
    }}
    .meta strong {{
      display: block;
      margin-top: 8px;
      color: var(--red);
      font-size: 24px;
    }}
    .card strong {{
      display: block;
      margin-top: 9px;
      font-size: 15px;
      line-height: 1.35;
    }}
    .panel {{
      overflow: hidden;
    }}
    .panel h2 {{
      margin: 0;
      padding: 20px 22px;
      color: var(--red);
      border-bottom: 1px solid var(--line);
    }}
    .table-wrap {{
      overflow: auto;
    }}
    table {{
      width: 100%;
      border-collapse: collapse;
      min-width: 980px;
    }}
    th {{
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--red);
      color: #fff;
      padding: 12px;
      text-align: left;
      font-size: 12px;
    }}
    td {{
      border-bottom: 1px solid var(--line);
      padding: 11px 12px;
      font-size: 12px;
      vertical-align: top;
    }}
    tr:nth-child(even) td {{
      background: #f9fafb;
    }}
    footer {{
      max-width: 1220px;
      margin: 24px auto 0;
      color: var(--gray);
      font-size: 12px;
      text-align: center;
    }}
    @media (max-width: 900px) {{
      .meta,
      .cards {{
        grid-template-columns: 1fr;
      }}
      main {{
        padding: 20px;
      }}
    }}
  </style>
</head>
<body>
  <header>
    <small>Claro Atención 360 · Supervisor</small>
    <h1>{xml_escape(metadata['title'])}</h1>
    <p>
      Generado: {xml_escape(metadata['generated_at'])}
      · Periodo: {xml_escape(metadata['period'])}
      · Alcance: {xml_escape(metadata['scope'])}
      · Nivel: {xml_escape(metadata['detail'])}
    </p>
  </header>

  <main>
    <section class="meta">
      <div><span>Registros</span><strong>{metadata['total']}</strong></div>
      <div><span>Críticos</span><strong>{metadata['critical']}</strong></div>
      <div><span>Riesgo SLA</span><strong>{metadata['sla_risk']}</strong></div>
      <div><span>Formato</span><strong>{metadata['format']}</strong></div>
    </section>

    <section class="cards">
      {summary_cards}
    </section>

    <section class="panel">
      <h2>Detalle operativo</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>{table_head}</tr>
          </thead>
          <tbody>{table_body}</tbody>
        </table>
      </div>
    </section>

    <footer>
      Archivo compartible generado automáticamente. Uso interno operativo y auditable.
    </footer>
  </main>
</body>
</html>
"""

    return html_doc.encode("utf-8")


# =========================================================
# PDF PROFESIONAL SIMPLE SIN LIBRERÍAS EXTERNAS
# =========================================================

def pdf_escape(value):
    text = export_clean_text(value, 180)
    text = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return text.encode("latin-1", errors="replace").decode("latin-1")


def pdf_wrap(text, width=110):
    words = export_clean_text(text, 1600).split()
    lines = []
    current = ""

    for word in words:
        if len(current) + len(word) + 1 > width:
            if current:
                lines.append(current)
            current = word
        else:
            current = f"{current} {word}".strip()

    if current:
        lines.append(current)

    return lines or ["-"]


def build_pdf_page_content(page_lines, page_number, total_pages):
    page_width = 842
    page_height = 595

    commands = []

    commands.append("0.973 0.980 0.988 rg")
    commands.append(f"0 0 {page_width} {page_height} re f")

    commands.append("0.886 0.137 0.102 rg")
    commands.append(f"0 {page_height - 82} {page_width} 82 re f")

    commands.append("0.561 0.082 0.063 rg")
    commands.append(f"610 {page_height - 82} 232 82 re f")

    commands.append("1 1 1 rg")
    commands.append("BT /F2 15 Tf 42 555 Td (CLARO ATENCION 360) Tj ET")
    commands.append("BT /F1 9 Tf 42 535 Td (MODULO SUPERVISOR) Tj ET")
    commands.append(f"BT /F1 8 Tf 730 555 Td (Pagina {page_number}/{total_pages}) Tj ET")

    y = 488

    for raw_line in page_lines:
        line = export_clean_text(raw_line, 180)

        if line.startswith("## "):
            y -= 6
            commands.append("0.886 0.137 0.102 rg")
            commands.append(f"BT /F2 11 Tf 42 {y} Td ({pdf_escape(line[3:])}) Tj ET")
            y -= 18
            continue

        if line.startswith("--"):
            commands.append("0.82 0.84 0.86 RG")
            commands.append(f"0.5 w 42 {y + 4} m 800 {y + 4} l S")
            y -= 10
            continue

        commands.append("0.067 0.094 0.153 rg")
        commands.append(f"BT /F1 8 Tf 42 {y} Td ({pdf_escape(line)}) Tj ET")
        y -= 13

        if y < 50:
            break

    commands.append("0.42 0.45 0.50 rg")
    commands.append("BT /F1 7 Tf 42 24 Td (Documento generado automaticamente. Uso interno operativo y auditable.) Tj ET")

    return "\n".join(commands).encode("latin-1", errors="replace")


def build_pdf_bytes(title, rows, summary=None, payload=None):
    rows = normalize_export_rows(rows)
    metadata = build_export_metadata(title, "pdf", rows, summary, payload)
    columns = preferred_export_columns(rows, limit=6)

    lines = []

    lines.extend(pdf_wrap(metadata["title"], 100))
    lines.append(f"Generado: {metadata['generated_at']} | Periodo: {metadata['period']} | Alcance: {metadata['scope']} | Nivel: {metadata['detail']}")
    lines.append(f"Registros: {metadata['total']} | Criticos: {metadata['critical']} | Riesgo SLA: {metadata['sla_risk']}")
    lines.extend(pdf_wrap(f"Motivo: {metadata['reason']}", 110))
    lines.append("")
    lines.append("## RESUMEN EJECUTIVO")

    for item in build_executive_summary(metadata):
        for wrapped in pdf_wrap(f"- {item['title']}: {item['text']}", 110):
            lines.append(wrapped)

    lines.append("")
    lines.append("## DETALLE OPERATIVO")

    header = " | ".join(export_label(column)[:20] for column in columns)
    lines.append(header)
    lines.append("--" * 60)

    for row in rows[:120]:
        values = [export_clean_text(row.get(column), 24) for column in columns]
        lines.append(" | ".join(values))

    if len(rows) > 120:
        lines.append(f"Se muestran 120 de {len(rows)} registros. Use Excel o CSV para el detalle completo.")

    chunks = []
    per_page = 34

    for index in range(0, len(lines), per_page):
        chunks.append(lines[index:index + per_page])

    objects = []
    page_object_numbers = []
    content_object_numbers = []

    next_obj = 5

    for _ in chunks:
        page_object_numbers.append(next_obj)
        content_object_numbers.append(next_obj + 1)
        next_obj += 2

    kids = " ".join(f"{num} 0 R" for num in page_object_numbers)

    objects.append(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n")
    objects.append(f"2 0 obj\n<< /Type /Pages /Kids [{kids}] /Count {len(chunks)} >>\nendobj\n".encode("ascii"))
    objects.append(b"3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n")
    objects.append(b"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n")

    total_pages = len(chunks)

    for page_number, page_obj_num, content_obj_num, chunk in zip(
        range(1, total_pages + 1),
        page_object_numbers,
        content_object_numbers,
        chunks
    ):
        content = build_pdf_page_content(chunk, page_number, total_pages)

        page_obj = (
            f"{page_obj_num} 0 obj\n"
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] "
            f"/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> "
            f"/Contents {content_obj_num} 0 R >>\n"
            f"endobj\n"
        ).encode("ascii")

        content_obj = (
            f"{content_obj_num} 0 obj\n<< /Length {len(content)} >>\nstream\n"
        ).encode("ascii") + content + b"\nendstream\nendobj\n"

        objects.append(page_obj)
        objects.append(content_obj)

    pdf = b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"
    offsets = []

    for obj in objects:
        offsets.append(len(pdf))
        pdf += obj

    xref_position = len(pdf)
    total_objects = len(objects) + 1

    pdf += f"xref\n0 {total_objects}\n".encode("ascii")
    pdf += b"0000000000 65535 f \n"

    for offset in offsets:
        pdf += f"{offset:010d} 00000 n \n".encode("ascii")

    pdf += (
        b"trailer\n<< /Size "
        + str(total_objects).encode("ascii")
        + b" /Root 1 0 R >>\nstartxref\n"
        + str(xref_position).encode("ascii")
        + b"\n%%EOF"
    )

    return pdf

# =========================================================
# EXCEL XLSX REAL SIN OPENPYXL
# =========================================================

def excel_col(index):
    result = ""

    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result

    return result


def xlsx_cell(ref, value, style=0):
    style_attr = f' s="{style}"' if style else ""
    return f'<c r="{ref}" t="inlineStr"{style_attr}><is><t>{xml_escape(value)}</t></is></c>'


def xlsx_row(row_index, values, style=0):
    cells = []

    for col_index, value in enumerate(values, start=1):
        cells.append(xlsx_cell(f"{excel_col(col_index)}{row_index}", value, style))

    return f'<row r="{row_index}">{"".join(cells)}</row>'


def xlsx_sheet_xml(rows_xml):
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetData>{"".join(rows_xml)}</sheetData>
</worksheet>
'''


def build_xlsx_bytes(title, rows, summary=None, payload=None):
    import zipfile

    rows = normalize_export_rows(rows)
    metadata = build_export_metadata(title, "xlsx", rows, summary, payload)
    columns = preferred_export_columns(rows, limit=80)

    summary_rows = [
        xlsx_row(1, ["CLARO ATENCIÓN 360 - REPORTE DE SUPERVISIÓN"], 1),
        xlsx_row(2, [metadata["title"]], 2),
        xlsx_row(4, ["Generado", metadata["generated_at"]], 1),
        xlsx_row(5, ["Periodo", metadata["period"]], 1),
        xlsx_row(6, ["Alcance", metadata["scope"]], 1),
        xlsx_row(7, ["Nivel de detalle", metadata["detail"]], 1),
        xlsx_row(8, ["Destino", metadata["destination"]], 1),
        xlsx_row(9, ["Motivo", metadata["reason"]], 1),
        xlsx_row(11, ["Registros", "Críticos", "Riesgo SLA", "Formato"], 1),
        xlsx_row(12, [metadata["total"], metadata["critical"], metadata["sla_risk"], "Excel XLSX"], 2),
        xlsx_row(14, ["Resumen ejecutivo", "Detalle"], 1),
    ]

    current_row = 15

    for item in build_executive_summary(metadata):
        summary_rows.append(xlsx_row(current_row, [item["title"], item["text"]]))
        current_row += 1

    data_rows = [xlsx_row(1, [export_label(column) for column in columns], 1)]

    for row_index, row in enumerate(rows, start=2):
        data_rows.append(
            xlsx_row(
                row_index,
                [export_clean_text(row.get(column), 1800) for column in columns]
            )
        )

    dictionary_rows = [xlsx_row(1, ["Campo visible", "Clave técnica"], 1)]

    for row_index, column in enumerate(columns, start=2):
        dictionary_rows.append(xlsx_row(row_index, [export_label(column), column]))

    workbook_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Resumen" sheetId="1" r:id="rId1"/>
    <sheet name="Datos" sheetId="2" r:id="rId2"/>
    <sheet name="Diccionario" sheetId="3" r:id="rId3"/>
  </sheets>
</workbook>
'''

    workbook_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
'''

    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>
'''

    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>
'''

    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3">
    <font><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="13"/><color rgb="FFE2231A"/><name val="Calibri"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2231A"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border>
      <left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
    <xf numFmtId="0" fontId="2" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>
'''

    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        zf.writestr("xl/styles.xml", styles)
        zf.writestr("xl/worksheets/sheet1.xml", xlsx_sheet_xml(summary_rows))
        zf.writestr("xl/worksheets/sheet2.xml", xlsx_sheet_xml(data_rows))
        zf.writestr("xl/worksheets/sheet3.xml", xlsx_sheet_xml(dictionary_rows))

    return buffer.getvalue()


# =========================================================
# WORD DOCX REAL SIN PYTHON-DOCX
# =========================================================

def docx_paragraph(text, style=None):
    style_xml = f'<w:pStyle w:val="{style}"/>' if style else ""

    return f'''
<w:p>
  <w:pPr>{style_xml}</w:pPr>
  <w:r>
    <w:t xml:space="preserve">{xml_escape(text)}</w:t>
  </w:r>
</w:p>
'''


def docx_table(headers, data):
    rows_xml = ""

    header_cells = ""

    for header in headers:
        header_cells += f'''
<w:tc>
  <w:tcPr><w:shd w:fill="E2231A"/></w:tcPr>
  <w:p>
    <w:r>
      <w:rPr><w:b/><w:color w:val="FFFFFF"/></w:rPr>
      <w:t>{xml_escape(header)}</w:t>
    </w:r>
  </w:p>
</w:tc>
'''

    rows_xml += f"<w:tr>{header_cells}</w:tr>"

    for row in data:
        cells = ""

        for value in row:
            cells += f'''
<w:tc>
  <w:p>
    <w:r>
      <w:t xml:space="preserve">{xml_escape(value)}</w:t>
    </w:r>
  </w:p>
</w:tc>
'''

        rows_xml += f"<w:tr>{cells}</w:tr>"

    return f'''
<w:tbl>
  <w:tblPr>
    <w:tblW w:w="0" w:type="auto"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
      <w:left w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
      <w:bottom w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
      <w:right w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
      <w:insideH w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
      <w:insideV w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
    </w:tblBorders>
  </w:tblPr>
  {rows_xml}
</w:tbl>
'''


def build_docx_bytes(title, rows, summary=None, payload=None):
    import zipfile

    rows = normalize_export_rows(rows)
    metadata = build_export_metadata(title, "docx", rows, summary, payload)
    columns = preferred_export_columns(rows, limit=8)

    body = ""
    body += docx_paragraph("CLARO ATENCIÓN 360", "Title")
    body += docx_paragraph("Reporte formal de supervisión")
    body += docx_paragraph(metadata["title"], "Heading1")
    body += docx_paragraph(f"Generado: {metadata['generated_at']}")
    body += docx_paragraph(f"Periodo: {metadata['period']}")
    body += docx_paragraph(f"Alcance: {metadata['scope']}")
    body += docx_paragraph(f"Nivel de detalle: {metadata['detail']}")
    body += docx_paragraph(f"Destino: {metadata['destination']}")
    body += docx_paragraph(f"Motivo: {metadata['reason']}")

    body += docx_paragraph("Resumen ejecutivo", "Heading1")

    summary_data = [
        [item["title"], item["text"]]
        for item in build_executive_summary(metadata)
    ]

    body += docx_table(["Hallazgo", "Detalle"], summary_data)

    body += docx_paragraph("Detalle operativo", "Heading1")

    table_data = []

    for row in rows[:120]:
        table_data.append([export_clean_text(row.get(column), 220) for column in columns])

    body += docx_table([export_label(column) for column in columns], table_data)

    if len(rows) > 120:
        body += docx_paragraph(
            f"Nota: Se muestran 120 de {len(rows)} registros. Usa Excel o CSV para revisar el detalle completo."
        )

    body += docx_paragraph(
        "Documento generado automáticamente por Claro Atención 360. Uso interno operativo y auditable."
    )

    document_xml = f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {body}
    <w:sectPr>
      <w:pgSz w:w="15840" w:h="12240"/>
      <w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900"/>
    </w:sectPr>
  </w:body>
</w:document>
'''

    styles_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:sz w:val="20"/><w:color w:val="111827"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="E2231A"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="E2231A"/></w:rPr>
  </w:style>
</w:styles>
'''

    rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
'''

    doc_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>
'''

    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>
'''

    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", rels)
        zf.writestr("word/document.xml", document_xml)
        zf.writestr("word/styles.xml", styles_xml)
        zf.writestr("word/_rels/document.xml.rels", doc_rels)

    return buffer.getvalue()


# =========================================================
# IMAGEN PNG REAL SIMPLE SIN PILLOW
# =========================================================

PNG_FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
    "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
}


def png_set_pixel(img, width, height, x, y, color):
    if x < 0 or y < 0 or x >= width or y >= height:
        return

    index = (y * width + x) * 3
    img[index:index + 3] = bytes(color)


def png_rect(img, width, height, x, y, w, h, color):
    for yy in range(max(0, y), min(height, y + h)):
        start = (yy * width + max(0, x)) * 3
        end = (yy * width + min(width, x + w)) * 3
        img[start:end] = bytes(color) * max(0, min(width, x + w) - max(0, x))


def png_text(img, width, height, x, y, text, color=(17, 24, 39), scale=3):
    value = export_clean_text(text, 120).upper()
    value = (
        value.replace("Á", "A")
        .replace("É", "E")
        .replace("Í", "I")
        .replace("Ó", "O")
        .replace("Ú", "U")
        .replace("Ñ", "N")
    )

    cursor_x = x

    for char in value:
        pattern = PNG_FONT.get(char, PNG_FONT.get(" "))

        for row_index, row in enumerate(pattern):
            for col_index, bit in enumerate(row):
                if bit == "1":
                    png_rect(
                        img,
                        width,
                        height,
                        cursor_x + col_index * scale,
                        y + row_index * scale,
                        scale,
                        scale,
                        color
                    )

        cursor_x += 6 * scale


def png_chunk(chunk_type, data):
    import struct
    import zlib

    return (
        struct.pack(">I", len(data))
        + chunk_type
        + data
        + struct.pack(">I", zlib.crc32(chunk_type + data) & 0xffffffff)
    )


def encode_png_rgb(width, height, img):
    import struct
    import zlib

    raw = bytearray()

    for y in range(height):
        raw.append(0)
        row_start = y * width * 3
        raw.extend(img[row_start:row_start + width * 3])

    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + png_chunk(b"IEND", b"")
    )


def build_png_bytes(title, rows, summary=None, payload=None):
    rows = normalize_export_rows(rows)
    metadata = build_export_metadata(title, "png", rows, summary, payload)
    columns = preferred_export_columns(rows, limit=5)

    visible_rows = rows[:28]

    width = 1400
    height = 780 + len(visible_rows) * 34

    img = bytearray([248, 250, 252] * width * height)

    red = (226, 35, 26)
    dark_red = (143, 21, 16)
    white = (255, 255, 255)
    dark = (17, 24, 39)
    gray = (107, 114, 128)
    soft = (243, 244, 246)
    line = (229, 231, 235)

    png_rect(img, width, height, 0, 0, width, 150, red)
    png_rect(img, width, height, 930, 0, 470, 150, dark_red)

    png_text(img, width, height, 42, 38, "CLARO ATENCION 360 SUPERVISOR", white, 4)
    png_text(img, width, height, 42, 92, metadata["title"][:44], white, 3)

    cards = [
        ("REGISTROS", str(metadata["total"])),
        ("CRITICOS", str(metadata["critical"])),
        ("RIESGO SLA", str(metadata["sla_risk"])),
        ("FORMATO", "PNG"),
    ]

    card_x = 42

    for label, value in cards:
        png_rect(img, width, height, card_x, 190, 310, 100, white)
        png_rect(img, width, height, card_x, 190, 310, 8, red)
        png_text(img, width, height, card_x + 18, 220, label, gray, 2)
        png_text(img, width, height, card_x + 18, 254, value[:18], red, 4)
        card_x += 335

    png_text(img, width, height, 42, 340, "RESUMEN EJECUTIVO", red, 4)

    png_rect(img, width, height, 42, 390, width - 84, 92, white)
    png_rect(img, width, height, 42, 390, 8, 92, red)

    png_text(img, width, height, 70, 418, f"PERIODO {metadata['period']} ALCANCE {metadata['scope']}", dark, 2)
    png_text(img, width, height, 70, 450, f"NIVEL {metadata['detail']} DESTINO {metadata['destination']}", gray, 2)

    png_text(img, width, height, 42, 535, "DETALLE OPERATIVO", red, 4)

    table_x = 42
    table_y = 585
    table_w = width - 84
    row_h = 34
    col_w = table_w // max(1, len(columns))

    png_rect(img, width, height, table_x, table_y, table_w, row_h, red)

    for index, column in enumerate(columns):
        png_text(
            img,
            width,
            height,
            table_x + index * col_w + 10,
            table_y + 10,
            export_label(column)[:18],
            white,
            2
        )

    for row_index, row in enumerate(visible_rows):
        y = table_y + row_h + row_index * row_h

        png_rect(
            img,
            width,
            height,
            table_x,
            y,
            table_w,
            row_h,
            white if row_index % 2 == 0 else soft
        )

        png_rect(img, width, height, table_x, y + row_h - 1, table_w, 1, line)

        for col_index, column in enumerate(columns):
            png_text(
                img,
                width,
                height,
                table_x + col_index * col_w + 10,
                y + 10,
                export_clean_text(row.get(column), 20),
                dark,
                2
            )

    footer = (
        f"SE MUESTRAN {len(visible_rows)} DE {len(rows)} REGISTROS. "
        "USE EXCEL O CSV PARA DETALLE COMPLETO."
        if len(rows) > len(visible_rows)
        else "DOCUMENTO GENERADO AUTOMATICAMENTE. USO INTERNO OPERATIVO Y AUDITABLE."
    )

    png_text(img, width, height, 42, height - 48, footer, gray, 2)

    return encode_png_rgb(width, height, img)


# =========================================================
# RESPUESTA DE ARCHIVO
# =========================================================

def build_file_response(title, format_value, rows, summary=None, payload=None):
    fmt = normalize_export_format(format_value)
    filename = f"{safe_export_filename(title)}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{export_extension(fmt)}"

    if fmt == "pdf":
        content = build_pdf_bytes(title, rows, summary, payload)

    elif fmt == "xlsx":
        content = build_xlsx_bytes(title, rows, summary, payload)

    elif fmt == "docx":
        content = build_docx_bytes(title, rows, summary, payload)

    elif fmt == "csv":
        content = build_csv_bytes(rows, summary, payload)

    elif fmt == "png":
        content = build_png_bytes(title, rows, summary, payload)

    elif fmt == "html":
        content = build_html_bytes(title, rows, summary, payload)

    else:
        content = build_pdf_bytes(title, rows, summary, payload)
        fmt = "pdf"
        filename = f"{safe_export_filename(title)}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

    headers = {
        "Content-Disposition": f'attachment; filename="{filename}"',
        "X-Claro360-Format": fmt,
        "X-Claro360-Records": str(len(normalize_export_rows(rows))),
    }

    return Response(
        content=content,
        media_type=export_media_type(fmt),
        headers=headers
    )


# =========================================================
# AUDITORÍA DE REPORTES
# =========================================================

def register_report_audit(supervisor: dict, action: str, payload: dict, title: str, total_rows=0):
    conn = get_connection()

    try:
        cursor = conn.cursor()

        insert_audit(
            cursor=cursor,
            supervisor=supervisor,
            tipo="reportes",
            accion=action,
            detalle=(
                f"{title}. "
                f"Tipo: {payload.get('tipo') or payload.get('type')}. "
                f"Formato: {payload.get('formato') or payload.get('format')}. "
                f"Periodo: {payload.get('periodo') or payload.get('period')}. "
                f"Alcance: {payload.get('alcance') or payload.get('scope')}. "
                f"Detalle: {payload.get('detalle') or payload.get('detail')}. "
                f"Destino: {payload.get('destino') or payload.get('destination')}. "
                f"Registros: {total_rows}. "
                f"Motivo: {payload.get('motivo') or payload.get('reason') or payload.get('comentario') or 'No indicado'}."
            ),
            valor_anterior="-",
            valor_nuevo=payload.get("formato") or payload.get("format") or "-",
            critico=False
        )

        conn.commit()

    except Exception:
        conn.rollback()

    finally:
        conn.close()


# =========================================================
# SERVICIOS FINALES DE REPORTES / EXPORTACIONES
# =========================================================

def supervisor_generate_report_service(supervisor: dict, payload: dict):
    payload = payload or {}

    report_type = clean(payload.get("tipo") or payload.get("type") or "dashboard")
    format_value = clean(payload.get("formato") or payload.get("format") or "pdf")
    reason = clean(payload.get("motivo") or payload.get("reason") or payload.get("comentario") or "")

    if not report_type or not format_value:
        raise HTTPException(
            status_code=400,
            detail="Completa tipo y formato del reporte."
        )

    if not reason:
        payload["motivo"] = "Generación formal de reporte supervisor"
        payload["reason"] = "Generación formal de reporte supervisor"

    dataset = get_report_dataset(supervisor, report_type, payload)

    title = f"Reporte - {dataset.get('title') or report_type}"
    rows = dataset.get("rows", [])
    summary = dataset.get("summary", [])
    options = dataset.get("options") or {}

    payload_for_file = {
        **payload,
        "type": options.get("type") or report_type,
        "tipo": options.get("type") or report_type,
        "period": options.get("period") or payload.get("period"),
        "periodo": options.get("period") or payload.get("periodo"),
        "scope": options.get("scope") or payload.get("scope"),
        "alcance": options.get("scope") or payload.get("alcance"),
        "detail": options.get("detail") or payload.get("detail"),
        "detalle": options.get("detail") or payload.get("detalle"),
        "destination": options.get("destination") or payload.get("destination"),
        "destino": options.get("destination") or payload.get("destino"),
        "format": format_value,
        "formato": format_value,
    }

    register_report_audit(
        supervisor=supervisor,
        action="Generación de reporte",
        payload=payload_for_file,
        title=title,
        total_rows=len(rows)
    )

    return build_file_response(
        title=title,
        format_value=format_value,
        rows=rows,
        summary=summary,
        payload=payload_for_file
    )


def supervisor_download_report_service(supervisor: dict, report_id: int):
    row = safe_fetch_one(
        """
        SELECT TOP 1
            auditoria_id,
            modulo,
            tipo,
            accion,
            detalle,
            valor_nuevo,
            resultado,
            fecha_evento,
            usuario_nombre
        FROM auditoria_admin
        WHERE auditoria_id = ?
        """,
        (report_id,)
    )

    if not row:
        raise HTTPException(
            status_code=404,
            detail="Reporte no encontrado."
        )

    title = row.get("detalle") or "Reporte supervisor"
    fmt = extract_format_from_text(
        f"{row.get('detalle') or ''} {row.get('valor_nuevo') or ''}"
    )

    payload = {
        "tipo": row.get("tipo") or "reportes",
        "type": row.get("tipo") or "reportes",
        "periodo": "historial",
        "period": "historial",
        "alcance": "reporte_seleccionado",
        "scope": "reporte_seleccionado",
        "detalle": "auditable",
        "detail": "auditable",
        "destino": "descarga_local",
        "destination": "descarga_local",
        "formato": fmt,
        "format": fmt,
        "motivo": "Descarga reconstruida desde historial de reportes",
        "reason": "Descarga reconstruida desde historial de reportes"
    }

    rows = [
        {
            "seccion": "Historial de reporte",
            "id": row.get("auditoria_id"),
            "tipo": row.get("tipo"),
            "accion": row.get("accion"),
            "detalle": row.get("detalle"),
            "formato": row.get("valor_nuevo"),
            "resultado": row.get("resultado"),
            "fecha": row.get("fecha_evento"),
            "usuario": row.get("usuario_nombre")
        }
    ]

    return build_file_response(
        title=title,
        format_value=fmt,
        rows=rows,
        summary=[
            {
                "title": "Descarga desde historial",
                "text": "Archivo reconstruido desde la auditoría de reportes."
            }
        ],
        payload=payload
    )


def supervisor_export_service(supervisor: dict, module_name: str, payload: dict):
    payload = payload or {}

    format_value = clean(payload.get("format") or payload.get("formato") or "xlsx")
    scope = clean(payload.get("scope") or payload.get("alcance") or "filtros_actuales")
    reason = clean(payload.get("reason") or payload.get("motivo") or payload.get("comentario") or "")

    if not format_value or not scope:
        raise HTTPException(
            status_code=400,
            detail="Completa formato y alcance de exportación."
        )

    if not reason:
        payload["reason"] = "Exportación formal del módulo supervisor"
        payload["motivo"] = "Exportación formal del módulo supervisor"

    module_value = normalize_report_type(module_name or payload.get("module") or payload.get("modulo") or "dashboard")

    payload_for_dataset = {
        **payload,
        "tipo": module_value,
        "type": module_value,
        "alcance": scope,
        "scope": scope,
        "formato": format_value,
        "format": format_value,
    }

    if module_value == "reportes":
        data = supervisor_reports_service(
            supervisor=supervisor,
            q=(payload.get("filters") or {}).get("busqueda", ""),
            tipo=(payload.get("filters") or {}).get("tipo", "todos"),
            periodo=(payload.get("filters") or {}).get("periodo", "todos"),
            alcance=(payload.get("filters") or {}).get("alcance", "todos"),
            estado=(payload.get("filters") or {}).get("estado", "todos"),
            fecha_desde=(payload.get("filters") or {}).get("fecha_desde", ""),
            fecha_hasta=(payload.get("filters") or {}).get("fecha_hasta", "")
        )

        title = "Exportación - Historial de reportes"
        rows = data.get("items", [])
        summary = data.get("ai_summary", [])

    elif module_value == "configuracion":
        data = supervisor_config_service(supervisor)
        title = "Exportación - Configuración de supervisión"
        rows = []
        rows.extend([{"seccion": "Reglas", **row} for row in data.get("rules", [])])
        rows.extend([{"seccion": "Rutas", **row} for row in data.get("routes", [])])
        rows.extend([{"seccion": "Solicitudes", **row} for row in data.get("requests", [])])
        summary = data.get("ai_summary", [])

    else:
        dataset = get_report_dataset(supervisor, module_value, payload_for_dataset)
        title = f"Exportación - {dataset.get('title') or module_value}"
        rows = dataset.get("rows", [])
        summary = dataset.get("summary", [])

    selected_ids = payload.get("selected_ids") or payload.get("ids") or payload.get("case_ids") or []

    if selected_ids:
        selected_set = {str(item) for item in selected_ids}

        rows = [
            row for row in rows
            if str(
                row.get("id")
                or row.get("case_id")
                or row.get("caso_id")
                or row.get("usuario_id")
                or row.get("advisor_id")
                or row.get("auditoria_id")
            ) in selected_set
        ]

    register_report_audit(
        supervisor=supervisor,
        action="Exportación supervisor",
        payload=payload_for_dataset,
        title=title,
        total_rows=len(rows)
    )

    return build_file_response(
        title=title,
        format_value=format_value,
        rows=rows,
        summary=summary,
        payload=payload_for_dataset
    )



# =========================================================
# PROGRAMACIÓN DE REPORTES - FIX IMPORT ROUTES
# =========================================================

def supervisor_schedule_report_service(supervisor: dict, payload: dict):
    payload = payload or {}

    report_type = clean(
        payload.get("tipo")
        or payload.get("type")
        or payload.get("report_type")
        or "dashboard"
    )

    frequency = clean(
        payload.get("frecuencia")
        or payload.get("frequency")
        or payload.get("periodicidad")
        or "semanal"
    )

    recipients = clean(
        payload.get("destinatarios")
        or payload.get("recipients")
        or payload.get("correos")
        or ""
    )

    format_value = clean(
        payload.get("formato_programado")
        or payload.get("formato")
        or payload.get("format")
        or "pdf"
    )

    scope = clean(
        payload.get("alcance_programado")
        or payload.get("alcance")
        or payload.get("scope")
        or "resumen_ejecutivo"
    )

    reason = clean(
        payload.get("motivo")
        or payload.get("reason")
        or payload.get("comentario")
        or "Programación de reporte supervisor"
    )

    if not report_type or not frequency or not recipients:
        raise HTTPException(
            status_code=400,
            detail="Completa tipo de reporte, frecuencia y destinatarios."
        )

    conn = get_connection()

    try:
        cursor = conn.cursor()

        insert_audit(
            cursor=cursor,
            supervisor=supervisor,
            tipo="reportes",
            accion="Programación de reporte",
            detalle=(
                f"Tipo: {report_type}. "
                f"Frecuencia: {frequency}. "
                f"Formato: {format_value}. "
                f"Alcance: {scope}. "
                f"Destinatarios: {recipients}. "
                f"Motivo: {reason}."
            ),
            valor_anterior="-",
            valor_nuevo=frequency,
            critico=False
        )

        conn.commit()

        return response_ok(
            "Reporte programado correctamente.",
            report={
                "type": report_type,
                "frequency": frequency,
                "format": format_value,
                "scope": scope,
                "recipients": recipients,
                "status": "Programado"
            },
            reporte={
                "tipo": report_type,
                "frecuencia": frequency,
                "formato": format_value,
                "alcance": scope,
                "destinatarios": recipients,
                "estado": "Programado"
            }
        )

    except Exception as exc:
        conn.rollback()

        raise HTTPException(
            status_code=500,
            detail=f"No se pudo programar el reporte: {str(exc)}"
        )

    finally:
        conn.close()