"""
utils.py — Helpers compartidos entre routers.

Contiene:
  - Generador de código de caso
  - Formateo de fechas
  - Mapas de iconos y estilos
  - Cálculo de SLA restante
  - Transformadores de modelos a schemas frontend
  - Registro de auditoría
"""

import json
import random
import string
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
import models


# ─────────────────────────────────────────────────────────────────────────────
# GENERADOR DE CÓDIGO DE CASO
# ─────────────────────────────────────────────────────────────────────────────

def generar_codigo_caso(tipo_nombre: str, db: Session) -> str:
    """Genera código único tipo REC-2026-000001 o INC-2026-000001."""
    prefix = "REC" if "reclamo" in tipo_nombre.lower() else "INC"
    year = datetime.now().year
    # Contar casos del año para el secuencial
    count = db.query(models.Caso).filter(
        models.Caso.codigo_caso.like(f"{prefix}-{year}-%")
    ).count()
    seq = str(count + 1).zfill(6)
    return f"{prefix}-{year}-{seq}"


# ─────────────────────────────────────────────────────────────────────────────
# FORMATEO DE FECHAS
# ─────────────────────────────────────────────────────────────────────────────

def fmt_fecha(dt: Optional[datetime]) -> str:
    if not dt:
        return "—"
    return dt.strftime("%d/%m/%Y")


def fmt_datetime(dt: Optional[datetime]) -> str:
    if not dt:
        return "—"
    now = datetime.now()
    diff = now - dt
    if diff.days == 0:
        hm = dt.strftime("%H:%M")
        return f"Hoy {hm}"
    elif diff.days == 1:
        hm = dt.strftime("%H:%M")
        return f"Ayer {hm}"
    return dt.strftime("%d/%m/%Y %H:%M")


def fmt_tiempo_relativo(dt: Optional[datetime]) -> str:
    if not dt:
        return "—"
    now = datetime.now()
    diff = now - dt
    total_minutes = int(diff.total_seconds() / 60)
    if total_minutes < 1:
        return "Justo ahora"
    if total_minutes < 60:
        return f"Hace {total_minutes} min"
    hours = total_minutes // 60
    if hours < 24:
        return f"Hace {hours}h"
    days = hours // 24
    return f"Hace {days} días"


# ─────────────────────────────────────────────────────────────────────────────
# CÁLCULO DE SLA
# ─────────────────────────────────────────────────────────────────────────────

def calcular_sla_restante(fecha_limite: Optional[datetime]) -> tuple[str, float]:
    """Retorna (texto_sla, horas_restantes)."""
    if not fecha_limite:
        return ("Sin SLA", 9999.0)
    now = datetime.now()
    diff = fecha_limite - now
    if diff.total_seconds() <= 0:
        return ("Vencido", -1.0)
    total_hours = diff.total_seconds() / 3600
    if total_hours < 1:
        mins = int(diff.total_seconds() / 60)
        return (f"{mins} min restantes", round(total_hours, 2))
    return (f"{int(total_hours):02d}h restantes", round(total_hours, 2))


def sla_group(horas: float) -> str:
    if horas <= 0:
        return "vencido"
    if horas <= 8:
        return "hoy"
    if horas <= 24:
        return "mañana"
    return "semana"


def sla_risk_level(horas: float) -> str:
    if horas <= 0:
        return "Vencido"
    if horas <= 4:
        return "Riesgo crítico"
    if horas <= 8:
        return "Riesgo alto"
    if horas <= 24:
        return "Riesgo medio"
    return "Controlado"


# ─────────────────────────────────────────────────────────────────────────────
# MAPAS DE ESTILOS
# ─────────────────────────────────────────────────────────────────────────────

STATUS_TYPE_MAP = {
    "Registrado": "warning",
    "En atención": "info",
    "En revisión técnica": "info",
    "Pendiente por cliente": "warning",
    "Derivado": "purple",
    "Listo para cierre": "info",
    "Resuelto": "success",
    "Cerrado": "success",
}

PROGRESS_MAP = {
    "Registrado": 10,
    "En atención": 40,
    "En revisión técnica": 55,
    "Pendiente por cliente": 50,
    "Derivado": 60,
    "Listo para cierre": 88,
    "Resuelto": 100,
    "Cerrado": 100,
}

SERVICE_ICON_MAP = {
    "internet hogar": "🏠",
    "hogar": "🏠",
    "móvil": "📱",
    "movil": "📱",
    "red móvil": "📡",
    "tv": "📺",
    "claro tv": "📺",
    "empresa": "🏢",
    "servicio empresa": "🏢",
    "cloud": "☁️",
    "correo": "📧",
    "conectividad": "🌐",
    "facturación": "💳",
    "facturacion": "💳",
}

TYPE_ICON_MAP = {
    "reclamo": "📝",
    "incidencia": "⚠️",
}

PRIORITY_TYPE_MAP = {
    "Crítica": "danger",
    "Alta": "warning",
    "Media": "info",
    "Baja": "success",
}

NOTIF_ICON_MAP = {
    "actualizacion": "🔔",
    "sla": "🔥",
    "asignacion": "📥",
    "derivacion": "🔀",
    "cliente": "📩",
    "cierre": "✅",
    "escalamiento": "⚡",
    "default": "📬",
}

HISTORIAL_ICON_MAP = {
    "asignado": "📥",
    "creado": "📋",
    "actualizado": "✏️",
    "derivado": "🔀",
    "escalado": "⚡",
    "cerrado": "✅",
    "resuelto": "✅",
    "pendiente": "📩",
    "evidencia": "📎",
    "revisión": "🔎",
    "default": "🔹",
}


def get_service_icon(service_name: str) -> str:
    if not service_name:
        return "📋"
    sl = service_name.lower()
    for key, icon in SERVICE_ICON_MAP.items():
        if key in sl:
            return icon
    return "📋"


def get_type_icon(type_name: str, priority_name: str = "") -> str:
    tl = type_name.lower()
    pl = priority_name.lower()
    if "incidencia" in tl:
        if "crítica" in pl or "critica" in pl:
            return "🔥"
        if "alta" in pl:
            return "⚠️"
        return "⚠️"
    return TYPE_ICON_MAP.get(tl, "📋")


def get_historial_icon(accion: str) -> str:
    al = accion.lower()
    for key, icon in HISTORIAL_ICON_MAP.items():
        if key in al:
            return icon
    return HISTORIAL_ICON_MAP["default"]


def get_initials(nombres: str, apellidos: str = "") -> str:
    parts = (f"{nombres} {apellidos}").split()
    return "".join(p[0].upper() for p in parts[:2]) if parts else "??"


def get_action_sugerida(estado: str, pendiente_cliente: bool = False) -> str:
    if pendiente_cliente:
        return "Esperar respuesta del cliente"
    actions = {
        "Registrado": "Asignar asesor y clasificar caso",
        "En atención": "Revisar avance y preparar respuesta",
        "En revisión técnica": "Coordinar revisión técnica en campo",
        "Pendiente por cliente": "Adjuntar evidencia técnica solicitada",
        "Derivado": "Dar seguimiento a respuesta del área",
        "Listo para cierre": "Validar respuesta final y cerrar",
        "Resuelto": "Encuesta de satisfacción disponible",
        "Cerrado": "Caso cerrado",
    }
    return actions.get(estado, "Revisar estado del caso")


def get_status_type(estado: str) -> str:
    return STATUS_TYPE_MAP.get(estado, "info")


def get_progress(estado: str) -> int:
    return PROGRESS_MAP.get(estado, 20)


# ─────────────────────────────────────────────────────────────────────────────
# TRANSFORMADORES: ORM → Frontend
# ─────────────────────────────────────────────────────────────────────────────

def caso_to_frontend_cliente(caso: models.Caso) -> dict:
    """Transforma un Caso ORM al formato que espera el Mock.cases del cliente."""
    sla_text, sla_hours = calcular_sla_restante(caso.fecha_limite_resolucion)
    if caso.estado_caso and caso.estado_caso.es_final:
        sla_text = "Cerrado"
        sla_hours = 999.0

    responsable = "Pendiente"
    if caso.responsable_actual:
        p = caso.responsable_actual.personal
        responsable = (f"{p.nombres} {p.apellidos}".strip()) if p else caso.responsable_actual.username

    return {
        "id": caso.caso_id,
        "code": caso.codigo_caso,
        "type": caso.tipo_caso.nombre if caso.tipo_caso else "—",
        "icon": get_type_icon(
            caso.tipo_caso.nombre if caso.tipo_caso else "",
            caso.prioridad.nombre if caso.prioridad else ""
        ),
        "title": caso.titulo,
        "description": caso.descripcion[:120] + "..." if len(caso.descripcion) > 120 else caso.descripcion,
        "service": (
            caso.servicio_contratado.servicio.nombre
            if caso.servicio_contratado and caso.servicio_contratado.servicio
            else "General"
        ),
        "status": caso.estado_caso.nombre if caso.estado_caso else "—",
        "statusType": get_status_type(caso.estado_caso.nombre if caso.estado_caso else ""),
        "priority": caso.prioridad.nombre if caso.prioridad else "Media",
        "priorityValue": caso.prioridad.nivel if caso.prioridad else 2,
        "date": fmt_fecha(caso.fecha_registro),
        "sla": sla_text,
        "slaHours": sla_hours,
        "advisor": responsable,
        "channel": caso.canal_ingreso.nombre if caso.canal_ingreso else "Portal cliente",
        "action": get_action_sugerida(
            caso.estado_caso.nombre if caso.estado_caso else "",
            caso.pendiente_cliente
        ),
        "progress": get_progress(caso.estado_caso.nombre if caso.estado_caso else ""),
    }


def caso_to_staff_frontend(caso: models.Caso) -> dict:
    """Transforma un Caso ORM al formato que espera Mock.cases del asesor/supervisor."""
    sla_text, sla_hours = calcular_sla_restante(caso.fecha_limite_resolucion)
    if caso.estado_caso and caso.estado_caso.es_final:
        sla_text = "Cerrado"
        sla_hours = 999.0

    responsable = "Sin asignar"
    if caso.responsable_actual:
        p = caso.responsable_actual.personal
        responsable = (f"{p.nombres} {p.apellidos}".strip()) if p else caso.responsable_actual.username

    cliente = caso.cliente
    client_name = "—"
    client_type = "Persona"
    doc = "—"
    if cliente:
        client_type = cliente.tipo_cliente.capitalize()
        if cliente.tipo_cliente == "PERSONA":
            client_name = f"{cliente.nombres or ''} {cliente.apellidos or ''}".strip() or cliente.correo
            doc = f"{cliente.documento_tipo} {cliente.documento_numero}"
        else:
            client_name = cliente.razon_social or cliente.correo
            doc = f"RUC {cliente.documento_numero}"

    history = []
    for h in (caso.historial or [])[:5]:
        history.append({
            "icon": get_historial_icon(h.accion),
            "title": h.accion,
            "text": h.observacion or "",
            "date": fmt_datetime(h.fecha_evento),
        })

    evidence = []
    for e in (caso.evidencias or [])[:5]:
        evidence.append({
            "icon": "📎",
            "name": e.nombre_archivo,
            "detail": e.descripcion or "Archivo adjunto",
        })

    area_nombre = caso.area_actual.nombre if caso.area_actual else "Mesa de entrada"

    return {
        "id": caso.caso_id,
        "code": caso.codigo_caso,
        "icon": get_type_icon(
            caso.tipo_caso.nombre if caso.tipo_caso else "",
            caso.prioridad.nombre if caso.prioridad else ""
        ),
        "type": caso.tipo_caso.nombre if caso.tipo_caso else "—",
        "clientType": client_type,
        "clientName": client_name,
        "document": doc,
        "title": caso.titulo,
        "description": caso.descripcion[:120] + "..." if len(caso.descripcion) > 120 else caso.descripcion,
        "reason": caso.descripcion,
        "service": (
            caso.servicio_contratado.servicio.nombre
            if caso.servicio_contratado and caso.servicio_contratado.servicio
            else "General"
        ),
        "channel": caso.canal_ingreso.nombre if caso.canal_ingreso else "Portal",
        "priority": caso.prioridad.nombre if caso.prioridad else "Media",
        "status": caso.estado_caso.nombre if caso.estado_caso else "—",
        "queueStatus": caso.estado_caso.nombre if caso.estado_caso else "—",
        "slaHours": sla_hours,
        "slaText": sla_text,
        "slaGroup": sla_group(sla_hours),
        "createdAt": fmt_datetime(caso.fecha_registro),
        "updatedAt": fmt_datetime(caso.fecha_ultima_actualizacion or caso.fecha_registro),
        "assignedTo": responsable,
        "action": get_action_sugerida(
            caso.estado_caso.nombre if caso.estado_caso else "",
            caso.pendiente_cliente
        ),
        "area": area_nombre,
        "evidence": evidence,
        "history": history,
        # Flags para supervisor
        "advisorId": caso.responsable_actual_usuario_id,
        "advisorName": responsable,
        "classificationStatus": "Sin clasificar" if not caso.area_actual_id else "Clasificado",
        "assignmentStatus": "Sin asesor" if not caso.responsable_actual_usuario_id else "Asignado",
        "assignmentFlow": _get_assignment_flow(caso),
        "riskType": _get_risk_type(sla_hours),
        "pendingType": _get_pending_type(caso),
        "blocked": caso.pendiente_cliente,
        "escalated": False,
        "derived": (caso.estado_caso.nombre == "Derivado") if caso.estado_caso else False,
        "observed": False,
        "slaRisk": sla_risk_level(sla_hours),
    }


def _get_assignment_flow(caso: models.Caso) -> str:
    estado = caso.estado_caso.nombre if caso.estado_caso else ""
    if not caso.responsable_actual_usuario_id:
        return "Pendiente asignación"
    if estado == "Derivado":
        return "Derivado"
    if caso.pendiente_cliente:
        return "Requiere decisión"
    return "Asignado"


def _get_risk_type(horas: float) -> str:
    if horas <= 0:
        return "vencidos"
    if horas <= 8:
        return "riesgo_alto"
    if horas <= 24:
        return "riesgo_medio"
    return "todos"


def _get_pending_type(caso: models.Caso) -> str:
    estado = caso.estado_caso.nombre if caso.estado_caso else ""
    if not caso.area_actual_id:
        return "sin_clasificar"
    if not caso.responsable_actual_usuario_id:
        return "sin_asignar"
    if estado == "Pendiente por cliente" or caso.pendiente_cliente:
        return "pendiente_cliente"
    if estado in ("Observado", "Derivado"):
        return "observados"
    return "general"


def notificacion_to_frontend(n: models.Notificacion) -> dict:
    return {
        "id": n.notificacion_id,
        "icon": NOTIF_ICON_MAP.get(n.tipo.lower(), NOTIF_ICON_MAP["default"]),
        "title": n.titulo,
        "message": n.mensaje,
        "type": n.tipo,
        "priority": "alta" if not n.leida else "normal",
        "case": n.caso.codigo_caso if n.caso else None,
        "date": fmt_tiempo_relativo(n.fecha_generacion),
        "read": n.leida,
        "unread": not n.leida,
        "action": "Ver caso" if n.caso_id else "Ver detalle",
        "caseId": n.caso.codigo_caso if n.caso else None,
    }


def usuario_to_frontend(u: models.Usuario) -> dict:
    p = u.personal
    nombre = f"{p.nombres} {p.apellidos}".strip() if p else u.username
    initials = get_initials(p.nombres if p else u.username, p.apellidos if p else "")
    area = u.area.nombre if u.area else "—"
    role = u.rol.nombre if u.rol else "—"
    last = fmt_datetime(u.ultimo_acceso) if u.ultimo_acceso else "Nunca"

    role_access = {
        "administrador": "Acceso administrativo",
        "admin": "Acceso administrativo",
        "supervisor": "Acceso supervisor",
        "asesor": "Acceso operativo",
        "cliente": "Acceso estándar",
        "cliente-persona": "Acceso estándar",
        "cliente-empresa": "Acceso estándar",
    }

    return {
        "id": u.usuario_id,
        "initials": initials,
        "name": nombre,
        "email": u.correo,
        "role": role.capitalize(),
        "area": area,
        "status": u.estado.capitalize() if u.estado else "—",
        "accessType": role_access.get(role.lower(), "Acceso estándar"),
        "lastAccess": last,
        "createdAt": fmt_fecha(u.fecha_creacion),
        "risk": "Alto" if role.lower() in ("administrador", "admin") else "Medio",
        "activity": 0,  # Conteo de acciones (simplificado)
    }


# ─────────────────────────────────────────────────────────────────────────────
# AUDITORÍA
# ─────────────────────────────────────────────────────────────────────────────

def registrar_auditoria(
    db: Session,
    tabla: str,
    registro_id: str,
    accion: str,
    usuario_id: Optional[int] = None,
    valores_antes: Optional[dict] = None,
    valores_despues: Optional[dict] = None,
    ip: str = "0.0.0.0",
):
    entrada = models.Auditoria(
        usuario_id=usuario_id,
        tabla_afectada=tabla,
        registro_id=registro_id,
        accion=accion,
        valores_antes=json.dumps(valores_antes, default=str) if valores_antes else None,
        valores_despues=json.dumps(valores_despues, default=str) if valores_despues else None,
        ip_address=ip,
    )
    db.add(entrada)


# ─────────────────────────────────────────────────────────────────────────────
# NOTIFICACIONES — creador rápido
# ─────────────────────────────────────────────────────────────────────────────

def crear_notificacion(
    db: Session,
    usuario_id: int,
    titulo: str,
    mensaje: str,
    tipo: str,
    caso_id: Optional[int] = None,
):
    n = models.Notificacion(
        usuario_id=usuario_id,
        caso_id=caso_id,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        canal_envio="SISTEMA",
        estado_envio="ENVIADO",
    )
    db.add(n)
