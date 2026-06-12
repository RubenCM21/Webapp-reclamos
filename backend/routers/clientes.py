"""
routers/clientes.py — Endpoints del módulo Cliente.

GET  /api/clientes/me
PUT  /api/clientes/me
GET  /api/clientes/me/servicios
GET  /api/clientes/me/servicios/{id}
GET  /api/clientes/me/casos
GET  /api/clientes/me/casos/{id}
GET  /api/clientes/me/notificaciones
PATCH /api/clientes/me/notificaciones/{id}/leida
PATCH /api/clientes/me/notificaciones/todas-leidas
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
import models, schemas, utils

router = APIRouter()


def _get_cliente(current_user: models.Usuario, db: Session) -> models.Cliente:
    cliente = db.query(models.Cliente).filter(
        models.Cliente.usuario_id == current_user.usuario_id
    ).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Perfil de cliente no encontrado.")
    return cliente


# ── GET /api/clientes/me ─────────────────────────────────────────────────────

@router.get("/me")
def perfil_cliente(
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cliente = _get_cliente(current_user, db)

    nombre = ""
    if cliente.tipo_cliente == "PERSONA":
        nombre = f"{cliente.nombres or ''} {cliente.apellidos or ''}".strip()
    else:
        nombre = cliente.razon_social or ""

    initials = utils.get_initials(
        cliente.nombres or nombre,
        cliente.apellidos or ""
    )

    return {
        "cliente_id": cliente.cliente_id,
        "tipo_cliente": cliente.tipo_cliente,
        "nombres": cliente.nombres,
        "apellidos": cliente.apellidos,
        "razon_social": cliente.razon_social,
        "documento_tipo": cliente.documento_tipo,
        "documento_numero": cliente.documento_numero,
        "correo": cliente.correo,
        "telefono": cliente.telefono,
        "direccion": cliente.direccion,
        # Campos compatibles con Mock.user
        "name": nombre or current_user.username,
        "initials": initials,
        "type": "Cliente " + cliente.tipo_cliente.capitalize(),
        "type_label": "Cliente " + cliente.tipo_cliente.capitalize(),
        "segment": "Personas" if cliente.tipo_cliente == "PERSONA" else "Empresas",
        "document": f"{cliente.documento_tipo} {cliente.documento_numero}",
        "email": cliente.correo,
        "phone": cliente.telefono or "",
        "address": cliente.direccion or "",
        "channel": "Portal cliente",
        "security": "Alta",
    }


# ── PUT /api/clientes/me ─────────────────────────────────────────────────────

@router.put("/me")
def actualizar_perfil(
    payload: schemas.ClienteUpdateRequest,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cliente = _get_cliente(current_user, db)

    if payload.nombres is not None:
        cliente.nombres = payload.nombres
    if payload.apellidos is not None:
        cliente.apellidos = payload.apellidos
    if payload.razon_social is not None:
        cliente.razon_social = payload.razon_social
    if payload.telefono is not None:
        cliente.telefono = payload.telefono
    if payload.direccion is not None:
        cliente.direccion = payload.direccion
    if payload.correo is not None:
        cliente.correo = payload.correo
        current_user.correo = payload.correo

    current_user.fecha_actualizacion = datetime.now()
    db.commit()

    return {"detail": "Perfil actualizado correctamente."}


# ── GET /api/clientes/me/servicios ───────────────────────────────────────────

@router.get("/me/servicios")
def mis_servicios(
    estado: str = Query(default=None),
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cliente = _get_cliente(current_user, db)

    query = db.query(models.ServicioContratado).filter(
        models.ServicioContratado.cliente_id == cliente.cliente_id
    )
    if estado:
        query = query.filter(models.ServicioContratado.estado == estado.upper())

    servicios = query.all()

    result = []
    for s in servicios:
        # Contar casos abiertos
        casos_abiertos = db.query(models.Caso).filter(
            models.Caso.servicio_contratado_id == s.servicio_contratado_id,
            ~models.Caso.estado_caso.has(models.EstadoCaso.es_final == True)
        ).count()

        last_caso = db.query(models.Caso).filter(
            models.Caso.servicio_contratado_id == s.servicio_contratado_id
        ).order_by(models.Caso.fecha_registro.desc()).first()

        nombre_servicio = s.servicio.nombre if s.servicio else "Servicio"
        st_map = {"ACTIVO": "success", "SUSPENDIDO": "warning", "CANCELADO": "danger"}

        result.append({
            "id": s.servicio_contratado_id,
            "icon": utils.get_service_icon(nombre_servicio),
            "code": s.codigo_contrato,
            "name": nombre_servicio,
            "type": nombre_servicio,
            "plan": s.plan_nombre or "—",
            "description": (s.servicio.descripcion if s.servicio else "") or "",
            "status": s.estado.capitalize(),
            "statusType": st_map.get(s.estado, "info"),
            "location": "Lima, Perú",
            "cases": casos_abiertos,
            "last": utils.fmt_datetime(last_caso.fecha_registro) if last_caso else "Sin casos",
            "recommendation": (
                "Revisar casos abiertos antes de crear uno nuevo."
                if casos_abiertos > 0
                else "Servicio estable." if s.estado == "ACTIVO"
                else "Contacta al soporte para reactivar."
            ),
        })

    return {"servicios": result, "total": len(result)}


# ── GET /api/clientes/me/servicios/{id} ──────────────────────────────────────

@router.get("/me/servicios/{servicio_id}")
def detalle_servicio(
    servicio_id: int,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cliente = _get_cliente(current_user, db)

    s = db.query(models.ServicioContratado).filter(
        models.ServicioContratado.servicio_contratado_id == servicio_id,
        models.ServicioContratado.cliente_id == cliente.cliente_id,
    ).first()

    if not s:
        raise HTTPException(status_code=404, detail="Servicio no encontrado.")

    nombre_servicio = s.servicio.nombre if s.servicio else "Servicio"
    st_map = {"ACTIVO": "success", "SUSPENDIDO": "warning", "CANCELADO": "danger"}

    return {
        "id": s.servicio_contratado_id,
        "icon": utils.get_service_icon(nombre_servicio),
        "code": s.codigo_contrato,
        "name": nombre_servicio,
        "type": nombre_servicio,
        "plan": s.plan_nombre or "—",
        "description": (s.servicio.descripcion if s.servicio else "") or "",
        "status": s.estado.capitalize(),
        "statusType": st_map.get(s.estado, "info"),
        "fecha_inicio": utils.fmt_fecha(s.fecha_inicio),
        "fecha_fin": utils.fmt_fecha(s.fecha_fin),
        "observaciones": s.observaciones,
    }


# ── GET /api/clientes/me/casos ───────────────────────────────────────────────

@router.get("/me/casos")
def mis_casos(
    tipo_caso_id: int = Query(default=None),
    estado_caso_id: int = Query(default=None),
    prioridad_id: int = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, le=100),
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cliente = _get_cliente(current_user, db)

    query = db.query(models.Caso).filter(
        models.Caso.cliente_id == cliente.cliente_id
    )
    if tipo_caso_id:
        query = query.filter(models.Caso.tipo_caso_id == tipo_caso_id)
    if estado_caso_id:
        query = query.filter(models.Caso.estado_caso_id == estado_caso_id)
    if prioridad_id:
        query = query.filter(models.Caso.prioridad_id == prioridad_id)

    total = query.count()
    casos = query.order_by(models.Caso.fecha_registro.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "casos": [utils.caso_to_frontend_cliente(c) for c in casos],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ── GET /api/clientes/me/casos/{id} ─────────────────────────────────────────

@router.get("/me/casos/{caso_id}")
def detalle_caso_cliente(
    caso_id: int,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cliente = _get_cliente(current_user, db)

    caso = db.query(models.Caso).filter(
        models.Caso.caso_id == caso_id,
        models.Caso.cliente_id == cliente.cliente_id,
    ).first()

    if not caso:
        raise HTTPException(status_code=404, detail="Caso no encontrado.")

    data = utils.caso_to_frontend_cliente(caso)

    # Agregar historial visible al cliente
    historial = [
        {
            "icon": utils.get_historial_icon(h.accion),
            "title": h.accion,
            "text": h.observacion or "",
            "date": utils.fmt_datetime(h.fecha_evento),
        }
        for h in caso.historial
        if h.es_visible_cliente
    ]

    evidencias = [
        {
            "icon": "📎",
            "name": e.nombre_archivo,
            "detail": e.descripcion or "",
            "fecha": utils.fmt_datetime(e.fecha_carga),
        }
        for e in caso.evidencias
    ]

    data["historial"] = historial
    data["evidencias"] = evidencias
    data["solucion_final"] = caso.solucion_final or ""
    return data


# ── GET /api/clientes/me/notificaciones ──────────────────────────────────────

@router.get("/me/notificaciones")
def mis_notificaciones(
    leida: bool = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, le=100),
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Notificacion).filter(
        models.Notificacion.usuario_id == current_user.usuario_id
    )
    if leida is not None:
        query = query.filter(models.Notificacion.leida == leida)

    total = query.count()
    notifs = query.order_by(models.Notificacion.fecha_generacion.desc()).offset((page - 1) * limit).limit(limit).all()
    unread = db.query(models.Notificacion).filter(
        models.Notificacion.usuario_id == current_user.usuario_id,
        models.Notificacion.leida == False
    ).count()

    return {
        "notificaciones": [utils.notificacion_to_frontend(n) for n in notifs],
        "total": total,
        "unread": unread,
        "page": page,
        "limit": limit,
    }


# ── PATCH /api/clientes/me/notificaciones/{id}/leida ────────────────────────

@router.patch("/me/notificaciones/{notif_id}/leida")
def marcar_notificacion(
    notif_id: int,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    n = db.query(models.Notificacion).filter(
        models.Notificacion.notificacion_id == notif_id,
        models.Notificacion.usuario_id == current_user.usuario_id,
    ).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notificación no encontrada.")

    n.leida = True
    n.fecha_lectura = datetime.now()
    n.estado_envio = "LEIDO"
    db.commit()

    return {"detail": "Notificación marcada como leída."}


# ── PATCH /api/clientes/me/notificaciones/todas-leidas ───────────────────────

@router.patch("/me/notificaciones/todas-leidas")
def marcar_todas(
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now()
    db.query(models.Notificacion).filter(
        models.Notificacion.usuario_id == current_user.usuario_id,
        models.Notificacion.leida == False,
    ).update({"leida": True, "fecha_lectura": now, "estado_envio": "LEIDO"})
    db.commit()

    return {"detail": "Todas las notificaciones marcadas como leídas."}
