"""
routers/asesor.py — Endpoints exclusivos del módulo Asesor.

GET /api/asesor/bandeja
GET /api/asesor/rendimiento
GET /api/asesor/notificaciones
PATCH /api/asesor/notificaciones/{id}/leida
PATCH /api/asesor/notificaciones/todas-leidas
GET /api/asesor/plantillas
GET /api/asesor/calendario-sla
"""

from datetime import datetime
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from dependencies import require_asesor
import models, utils

router = APIRouter()

# ── Plantillas hardcoded (sin tabla en BD) ───────────────────────────────────
PLANTILLAS = [
    {
        "id": "TPL-001", "icon": "📩", "category": "evidencia",
        "title": "Solicitud de evidencia adicional",
        "channel": "Portal cliente / Correo",
        "description": "Mensaje para solicitar sustento adicional al cliente.",
        "body": "Estimado/a {cliente_nombre}, para continuar con la atención del caso {codigo_caso}, necesitamos que nos envíe evidencia relacionada con {servicio_afectado}. Esta información permitirá continuar la revisión dentro del plazo indicado.",
    },
    {
        "id": "TPL-002", "icon": "📝", "category": "reclamo",
        "title": "Respuesta por revisión de facturación",
        "channel": "Correo",
        "description": "Respuesta base para reclamos comerciales de facturación.",
        "body": "Estimado/a {cliente_nombre}, hemos revisado la información asociada al caso {codigo_caso}. A continuación, detallamos el resultado de la evaluación realizada sobre el servicio {servicio_afectado}.",
    },
    {
        "id": "TPL-003", "icon": "🔀", "category": "derivacion",
        "title": "Comunicación de derivación técnica",
        "channel": "Portal cliente",
        "description": "Mensaje para informar derivación a un área responsable.",
        "body": "Estimado/a {cliente_nombre}, su caso {codigo_caso} fue derivado al área responsable para realizar una validación especializada del servicio {servicio_afectado}.",
    },
    {
        "id": "TPL-004", "icon": "✅", "category": "cierre",
        "title": "Cierre con respuesta final",
        "channel": "Correo / Portal",
        "description": "Respuesta final para cierre de caso.",
        "body": "Estimado/a {cliente_nombre}, se completó la revisión del caso {codigo_caso}. Se deja constancia del resultado y de la acción aplicada sobre el servicio {servicio_afectado}.",
    },
]


# ── GET /api/asesor/bandeja ──────────────────────────────────────────────────

@router.get("/bandeja")
def bandeja(
    estado: str = Query(default=None),
    prioridad: str = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, le=100),
    current_user=Depends(require_asesor),
    db: Session = Depends(get_db),
):
    query = db.query(models.Caso).filter(
        models.Caso.responsable_actual_usuario_id == current_user.usuario_id
    )

    if estado and estado != "todos":
        query = query.join(models.EstadoCaso).filter(
            models.EstadoCaso.nombre.ilike(f"%{estado}%")
        )
    if prioridad and prioridad != "todos":
        query = query.join(models.Prioridad).filter(
            models.Prioridad.nombre.ilike(f"%{prioridad}%")
        )

    total = query.count()
    casos = query.order_by(models.Caso.fecha_registro.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "casos": [utils.caso_to_staff_frontend(c) for c in casos],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ── GET /api/asesor/rendimiento ──────────────────────────────────────────────

@router.get("/rendimiento")
def rendimiento(
    periodo: str = Query(default="semana"),
    current_user=Depends(require_asesor),
    db: Session = Depends(get_db),
):
    from datetime import timedelta
    now = datetime.now()
    if periodo == "semana":
        desde = now - timedelta(days=7)
    elif periodo == "mes":
        desde = now - timedelta(days=30)
    else:
        desde = now - timedelta(days=7)

    # Casos atendidos (asignados al asesor en el período)
    atendidos = db.query(models.Caso).filter(
        models.Caso.responsable_actual_usuario_id == current_user.usuario_id,
        models.Caso.fecha_registro >= desde,
    ).count()

    # Casos cerrados
    cerrados = db.query(models.Caso).filter(
        models.Caso.responsable_actual_usuario_id == current_user.usuario_id,
        models.Caso.fecha_cierre >= desde,
    ).count()

    # SLA cumplido — casos cerrados antes del límite
    total_c = db.query(models.Caso).filter(
        models.Caso.responsable_actual_usuario_id == current_user.usuario_id,
        models.Caso.fecha_cierre >= desde,
        models.Caso.fecha_limite_resolucion != None,
    ).count()
    a_tiempo = db.query(models.Caso).filter(
        models.Caso.responsable_actual_usuario_id == current_user.usuario_id,
        models.Caso.fecha_cierre >= desde,
        models.Caso.fecha_cierre <= models.Caso.fecha_limite_resolucion,
    ).count()
    sla_pct = f"{int(a_tiempo/total_c*100)}%" if total_c > 0 else "—"

    kpis = [
        ["📥", str(atendidos), "Casos atendidos", f"Período: {periodo}"],
        ["✅", str(cerrados), "Casos cerrados", "Con respuesta final"],
        ["⏱️", sla_pct, "SLA cumplido", "Meta operativa"],
        ["⭐", "—", "Satisfacción", "Promedio de encuestas"],
    ]

    # Tendencia diaria (últimos 5 días)
    dias = ["Lun", "Mar", "Mié", "Jue", "Vie"]
    chart = [[d, 0] for d in dias]

    table = [
        ["Reclamo comercial", "—", "—", "—", "Calculando", "info"],
        ["Incidencia técnica", "—", "—", "—", "Calculando", "info"],
        ["Solicitudes cliente", "—", "—", "—", "Calculando", "info"],
    ]

    # Intento calcular tabla real
    tipos = db.query(models.TipoCaso).filter(models.TipoCaso.activo == True).all()
    table = []
    for t in tipos[:3]:
        cnt = db.query(models.Caso).filter(
            models.Caso.responsable_actual_usuario_id == current_user.usuario_id,
            models.Caso.tipo_caso_id == t.tipo_caso_id,
            models.Caso.fecha_registro >= desde,
        ).count()
        table.append([t.nombre, str(cnt), "—", "—", "En progreso", "info"])

    p = current_user.personal
    nombre = f"{p.nombres} {p.apellidos}".strip() if p else current_user.username
    initials = utils.get_initials(p.nombres if p else current_user.username, p.apellidos if p else "")

    return {
        "advisor": {
            "id": current_user.usuario_id,
            "name": nombre,
            "initials": initials,
            "role": current_user.rol.nombre if current_user.rol else "Asesor",
            "status": "Disponible",
            "shift": "Turno operativo",
            "lastAccess": utils.fmt_datetime(current_user.ultimo_acceso),
        },
        "performance": {
            "kpis": kpis,
            "chart": chart,
            "table": table,
        },
    }


# ── GET /api/asesor/notificaciones ───────────────────────────────────────────

@router.get("/notificaciones")
def notificaciones(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, le=100),
    current_user=Depends(require_asesor),
    db: Session = Depends(get_db),
):
    query = db.query(models.Notificacion).filter(
        models.Notificacion.usuario_id == current_user.usuario_id
    )
    total = query.count()
    items = query.order_by(models.Notificacion.fecha_generacion.desc()).offset((page - 1) * limit).limit(limit).all()
    unread = db.query(models.Notificacion).filter(
        models.Notificacion.usuario_id == current_user.usuario_id,
        models.Notificacion.leida == False,
    ).count()

    return {
        "notificaciones": [utils.notificacion_to_frontend(n) for n in items],
        "total": total,
        "unread": unread,
        "page": page,
        "limit": limit,
    }


# ── PATCH /api/asesor/notificaciones/{id}/leida ──────────────────────────────

@router.patch("/notificaciones/{notif_id}/leida")
def marcar_notificacion(
    notif_id: int,
    current_user=Depends(require_asesor),
    db: Session = Depends(get_db),
):
    n = db.query(models.Notificacion).filter(
        models.Notificacion.notificacion_id == notif_id,
        models.Notificacion.usuario_id == current_user.usuario_id,
    ).first()
    if n:
        n.leida = True
        n.fecha_lectura = datetime.now()
        db.commit()
    return {"detail": "Notificación marcada como leída."}


# ── PATCH /api/asesor/notificaciones/todas-leidas ────────────────────────────

@router.patch("/notificaciones/todas-leidas")
def marcar_todas(
    current_user=Depends(require_asesor),
    db: Session = Depends(get_db),
):
    db.query(models.Notificacion).filter(
        models.Notificacion.usuario_id == current_user.usuario_id,
        models.Notificacion.leida == False,
    ).update({"leida": True, "fecha_lectura": datetime.now()})
    db.commit()
    return {"detail": "Todas marcadas como leídas."}


# ── GET /api/asesor/plantillas ───────────────────────────────────────────────

@router.get("/plantillas")
def plantillas(
    categoria: str = Query(default=None),
    current_user=Depends(require_asesor),
):
    result = PLANTILLAS
    if categoria and categoria != "todas":
        result = [p for p in PLANTILLAS if p["category"] == categoria]
    return {"plantillas": result, "total": len(result)}


# ── GET /api/asesor/calendario-sla ───────────────────────────────────────────

@router.get("/calendario-sla")
def calendario_sla(
    filtro: str = Query(default="todos"),
    current_user=Depends(require_asesor),
    db: Session = Depends(get_db),
):
    casos = db.query(models.Caso).filter(
        models.Caso.responsable_actual_usuario_id == current_user.usuario_id,
        models.Caso.fecha_limite_resolucion != None,
        ~models.Caso.estado_caso.has(models.EstadoCaso.es_final == True),
    ).order_by(models.Caso.fecha_limite_resolucion.asc()).all()

    grupos = {"hoy": [], "mañana": [], "semana": [], "vencido": []}
    for c in casos:
        sla_text, sla_hours = utils.calcular_sla_restante(c.fecha_limite_resolucion)
        grupo = utils.sla_group(sla_hours)
        item = utils.caso_to_staff_frontend(c)
        grupos[grupo].append(item)

    if filtro != "todos" and filtro in grupos:
        return {"casos": grupos[filtro], "grupos": {filtro: len(grupos[filtro])}}

    all_casos = grupos["vencido"] + grupos["hoy"] + grupos["mañana"] + grupos["semana"]
    return {
        "casos": all_casos,
        "grupos": {k: len(v) for k, v in grupos.items()},
        "total": len(all_casos),
    }
