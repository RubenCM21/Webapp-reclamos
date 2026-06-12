"""
routers/supervisor.py — Endpoints del módulo Supervisor.

GET /api/supervisor/indicadores
GET /api/supervisor/sla
GET /api/supervisor/carga-asesores
GET /api/supervisor/casos-pendientes
GET /api/supervisor/asesores
GET /api/supervisor/reportes
POST /api/supervisor/reportes
GET /api/supervisor/auditoria
"""

from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from dependencies import require_supervisor
import models, utils, schemas

router = APIRouter()


# ── GET /api/supervisor/indicadores ─────────────────────────────────────────

@router.get("/indicadores")
def indicadores(
    periodo: str = Query(default="hoy"),
    current_user=Depends(require_supervisor),
    db: Session = Depends(get_db),
):
    now = datetime.now()
    if periodo == "hoy":
        desde = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif periodo == "semana":
        desde = now - timedelta(days=7)
    elif periodo == "mes":
        desde = now - timedelta(days=30)
    else:
        desde = now.replace(hour=0, minute=0, second=0, microsecond=0)

    total = db.query(models.Caso).filter(models.Caso.fecha_registro >= desde).count()
    abiertos = db.query(models.Caso).filter(
        ~models.Caso.estado_caso.has(models.EstadoCaso.es_final == True)
    ).count()
    criticos = db.query(models.Caso).join(models.Prioridad).filter(
        models.Prioridad.nombre.in_(["Crítica", "Alta"]),
        ~models.Caso.estado_caso.has(models.EstadoCaso.es_final == True),
    ).count()
    vencidos = db.query(models.Caso).filter(
        models.Caso.fecha_limite_resolucion < now,
        ~models.Caso.estado_caso.has(models.EstadoCaso.es_final == True),
    ).count()
    sin_asignar = db.query(models.Caso).filter(
        models.Caso.responsable_actual_usuario_id == None,
        ~models.Caso.estado_caso.has(models.EstadoCaso.es_final == True),
    ).count()
    cerrados = db.query(models.Caso).filter(
        models.Caso.fecha_cierre >= desde,
        models.Caso.estado_caso.has(models.EstadoCaso.es_final == True),
    ).count()

    kpis = [
        ["📥", str(total), "Casos registrados", f"Período: {periodo}"],
        ["🔓", str(abiertos), "Casos abiertos", "Sin cierre"],
        ["🔥", str(criticos), "Críticos / Altos", "Requieren atención"],
        ["⏰", str(vencidos), "SLA vencido", "Fuera de plazo"],
        ["❓", str(sin_asignar), "Sin asignar", "Pendientes"],
        ["✅", str(cerrados), "Cerrados", f"Período: {periodo}"],
    ]

    # Distribución por estado
    estados_dist = (
        db.query(models.EstadoCaso.nombre, func.count(models.Caso.caso_id))
        .join(models.Caso, models.Caso.estado_caso_id == models.EstadoCaso.estado_caso_id)
        .group_by(models.EstadoCaso.nombre)
        .all()
    )
    estados = [{"nombre": e[0], "cantidad": e[1]} for e in estados_dist]

    # Distribución por prioridad
    prior_dist = (
        db.query(models.Prioridad.nombre, func.count(models.Caso.caso_id))
        .join(models.Caso, models.Caso.prioridad_id == models.Prioridad.prioridad_id)
        .filter(~models.Caso.estado_caso.has(models.EstadoCaso.es_final == True))
        .group_by(models.Prioridad.nombre)
        .all()
    )
    prioridades = [{"nombre": p[0], "cantidad": p[1]} for p in prior_dist]

    tendencia = [["Lun", 0], ["Mar", 0], ["Mié", 0], ["Jue", 0], ["Vie", 0]]

    p = current_user.personal
    nombre = f"{p.nombres} {p.apellidos}".strip() if p else current_user.username
    initials = utils.get_initials(p.nombres if p else current_user.username, p.apellidos if p else "")

    return {
        "supervisor": {
            "id": current_user.usuario_id,
            "name": nombre,
            "initials": initials,
            "role": current_user.rol.nombre if current_user.rol else "Supervisor",
            "status": "Supervisión activa",
            "lastUpdate": utils.fmt_datetime(current_user.ultimo_acceso),
        },
        "indicators": {
            "kpis": kpis,
            "estados": estados,
            "prioridades": prioridades,
            "tendencia": tendencia,
        },
    }


# ── GET /api/supervisor/sla ──────────────────────────────────────────────────

@router.get("/sla")
def monitoreo_sla(
    riesgo: str = Query(default="todos"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, le=100),
    current_user=Depends(require_supervisor),
    db: Session = Depends(get_db),
):
    now = datetime.now()
    query = db.query(models.Caso).filter(
        models.Caso.fecha_limite_resolucion != None,
        ~models.Caso.estado_caso.has(models.EstadoCaso.es_final == True),
    )

    if riesgo == "vencido":
        query = query.filter(models.Caso.fecha_limite_resolucion < now)
    elif riesgo == "critico":
        limite = now + timedelta(hours=4)
        query = query.filter(
            models.Caso.fecha_limite_resolucion >= now,
            models.Caso.fecha_limite_resolucion <= limite,
        )
    elif riesgo == "alto":
        limite = now + timedelta(hours=8)
        query = query.filter(
            models.Caso.fecha_limite_resolucion >= now,
            models.Caso.fecha_limite_resolucion <= limite,
        )

    total = query.count()
    casos = query.order_by(models.Caso.fecha_limite_resolucion.asc()).offset((page - 1) * limit).limit(limit).all()

    items = []
    for c in casos:
        sla_text, sla_hours = utils.calcular_sla_restante(c.fecha_limite_resolucion)
        resp = "Sin asignar"
        if c.responsable_actual:
            p = c.responsable_actual.personal
            resp = f"{p.nombres} {p.apellidos}".strip() if p else c.responsable_actual.username
        items.append({
            "id": c.caso_id,
            "code": c.codigo_caso,
            "title": c.titulo,
            "clientName": (
                f"{c.cliente.nombres or ''} {c.cliente.apellidos or ''}".strip()
                if c.cliente and c.cliente.tipo_cliente == "PERSONA"
                else c.cliente.razon_social if c.cliente else "—"
            ),
            "priority": c.prioridad.nombre if c.prioridad else "Media",
            "slaHours": sla_hours,
            "slaText": sla_text,
            "riskLevel": utils.sla_risk_level(sla_hours),
            "assignedTo": resp,
            "status": c.estado_caso.nombre if c.estado_caso else "—",
        })

    return {"casos": items, "total": total, "page": page, "limit": limit}


# ── GET /api/supervisor/carga-asesores ───────────────────────────────────────

@router.get("/carga-asesores")
def carga_asesores(
    current_user=Depends(require_supervisor),
    db: Session = Depends(get_db),
):
    # Obtener asesores del sistema
    rol_asesor = db.query(models.Rol).filter(models.Rol.nombre == "asesor").first()
    if not rol_asesor:
        return {"asesores": []}

    usuarios = db.query(models.Usuario).filter(
        models.Usuario.rol_id == rol_asesor.rol_id,
        models.Usuario.estado == "ACTIVO",
    ).all()

    result = []
    for u in usuarios:
        p = u.personal
        nombre = f"{p.nombres} {p.apellidos}".strip() if p else u.username
        initials = utils.get_initials(p.nombres if p else u.username, p.apellidos if p else "")
        cargo = p.cargo if p else "Asesor de Atención"

        total_casos = db.query(models.Caso).filter(
            models.Caso.responsable_actual_usuario_id == u.usuario_id,
            ~models.Caso.estado_caso.has(models.EstadoCaso.es_final == True),
        ).count()

        criticos = db.query(models.Caso).join(models.Prioridad).filter(
            models.Caso.responsable_actual_usuario_id == u.usuario_id,
            models.Prioridad.nombre.in_(["Crítica"]),
            ~models.Caso.estado_caso.has(models.EstadoCaso.es_final == True),
        ).count()

        now = datetime.now()
        sla_risk = db.query(models.Caso).filter(
            models.Caso.responsable_actual_usuario_id == u.usuario_id,
            models.Caso.fecha_limite_resolucion <= now + timedelta(hours=8),
            models.Caso.fecha_limite_resolucion >= now,
            ~models.Caso.estado_caso.has(models.EstadoCaso.es_final == True),
        ).count()

        capacity = min(100, total_casos * 8)  # Aproximado: max ~12 casos = 100%

        result.append({
            "id": u.usuario_id,
            "name": nombre,
            "initials": initials,
            "specialty": cargo or "Atención general",
            "status": "Disponible" if total_casos < 10 else "Ocupado",
            "cases": total_casos,
            "critical": criticos,
            "slaRisk": sla_risk,
            "productivity": 85,  # Placeholder
            "capacity": capacity,
        })

    return {"asesores": result, "total": len(result)}


# ── GET /api/supervisor/casos-pendientes ─────────────────────────────────────

@router.get("/casos-pendientes")
def casos_pendientes(
    tipo: str = Query(default="todos"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, le=100),
    current_user=Depends(require_supervisor),
    db: Session = Depends(get_db),
):
    query = db.query(models.Caso).filter(
        ~models.Caso.estado_caso.has(models.EstadoCaso.es_final == True)
    )

    if tipo == "sin_clasificar":
        query = query.filter(models.Caso.area_actual_id == None)
    elif tipo == "sin_asignar":
        query = query.filter(models.Caso.responsable_actual_usuario_id == None)
    elif tipo == "observados":
        query = query.filter(models.Caso.pendiente_cliente == True)

    total = query.count()
    casos = query.order_by(models.Caso.fecha_registro.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "casos": [utils.caso_to_staff_frontend(c) for c in casos],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ── GET /api/supervisor/asesores ─────────────────────────────────────────────

@router.get("/asesores")
def asesores_disponibles(
    current_user=Depends(require_supervisor),
    db: Session = Depends(get_db),
):
    rol_asesor = db.query(models.Rol).filter(models.Rol.nombre == "asesor").first()
    if not rol_asesor:
        return {"asesores": []}

    usuarios = db.query(models.Usuario).filter(
        models.Usuario.rol_id == rol_asesor.rol_id,
        models.Usuario.estado == "ACTIVO",
    ).all()

    result = []
    for u in usuarios:
        p = u.personal
        nombre = f"{p.nombres} {p.apellidos}".strip() if p else u.username
        result.append({
            "id": u.usuario_id,
            "name": nombre,
            "username": u.username,
            "area": u.area.nombre if u.area else "—",
            "cargo": p.cargo if p else "Asesor",
        })

    return {"asesores": result, "total": len(result)}


# ── GET /api/supervisor/reportes ─────────────────────────────────────────────

@router.get("/reportes")
def listar_reportes(
    current_user=Depends(require_supervisor),
    db: Session = Depends(get_db),
):
    reportes = db.query(models.Reporte).order_by(
        models.Reporte.fecha_generacion.desc()
    ).limit(20).all()

    result = [
        {
            "id": r.reporte_id,
            "nombre": r.nombre,
            "descripcion": r.descripcion,
            "formato": r.formato,
            "fecha": utils.fmt_datetime(r.fecha_generacion),
            "generado_por": r.generado_por.username if r.generado_por else "—",
        }
        for r in reportes
    ]
    return {"reportes": result, "total": len(result)}


# ── POST /api/supervisor/reportes ────────────────────────────────────────────

@router.post("/reportes", status_code=201)
def generar_reporte(
    payload: schemas.ReporteCreateRequest,
    current_user=Depends(require_supervisor),
    db: Session = Depends(get_db),
):
    r = models.Reporte(
        nombre=payload.nombre,
        descripcion=payload.descripcion,
        formato=payload.formato,
        filtros_json=payload.filtros_json,
        generado_por_usuario_id=current_user.usuario_id,
    )
    db.add(r)
    db.commit()
    return {"reporte_id": r.reporte_id, "detail": "Reporte generado."}


# ── GET /api/supervisor/auditoria ────────────────────────────────────────────

@router.get("/auditoria")
def auditoria_casos(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, le=100),
    current_user=Depends(require_supervisor),
    db: Session = Depends(get_db),
):
    query = db.query(models.Auditoria).filter(
        models.Auditoria.tabla_afectada == "casos"
    )
    total = query.count()
    items = query.order_by(models.Auditoria.fecha_evento.desc()).offset((page - 1) * limit).limit(limit).all()

    result = [
        {
            "id": a.auditoria_id,
            "tabla": a.tabla_afectada,
            "registro": a.registro_id,
            "accion": a.accion,
            "usuario": a.usuario.username if a.usuario else "Sistema",
            "ip": a.ip_address,
            "fecha": utils.fmt_datetime(a.fecha_evento),
        }
        for a in items
    ]
    return {"auditorias": result, "total": total, "page": page, "limit": limit}
