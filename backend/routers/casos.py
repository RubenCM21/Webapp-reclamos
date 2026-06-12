"""
routers/casos.py — CRUD de casos, historial, asignaciones y evidencias.

POST /api/casos
GET  /api/casos
GET  /api/casos/{id}
PUT  /api/casos/{id}
POST /api/casos/{id}/cerrar
GET  /api/casos/{id}/historial
POST /api/casos/{id}/historial
POST /api/casos/{id}/asignar
GET  /api/casos/{id}/evidencias
POST /api/casos/{id}/evidencias
GET  /api/casos/consulta-publica
"""

import os
import shutil
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user, require_staff, get_client_ip
from config import settings
import models, schemas, utils

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _get_caso(caso_id: int, db: Session) -> models.Caso:
    caso = db.query(models.Caso).filter(models.Caso.caso_id == caso_id).first()
    if not caso:
        raise HTTPException(status_code=404, detail="Caso no encontrado.")
    return caso


def _calcular_fechas_sla(caso: models.Caso, db: Session) -> tuple:
    """Calcula fechas límite de SLA para un caso según sus atributos."""
    sla = (
        db.query(models.Sla)
        .filter(
            models.Sla.activo == True,
            (models.Sla.tipo_caso_id == caso.tipo_caso_id) | (models.Sla.tipo_caso_id == None),
            (models.Sla.prioridad_id == caso.prioridad_id) | (models.Sla.prioridad_id == None),
        )
        .order_by(
            models.Sla.tipo_caso_id.desc(),   # Más específico primero
            models.Sla.prioridad_id.desc(),
        )
        .first()
    )

    if not sla:
        # Defaults básicos si no hay SLA configurado
        defaults = {"Crítica": 4, "Alta": 8, "Media": 24, "Baja": 72}
        prioridad_nombre = caso.prioridad.nombre if caso.prioridad else "Media"
        horas = defaults.get(prioridad_nombre, 24)
        now = datetime.now()
        return (
            sla,
            now + timedelta(hours=horas // 2),
            now + timedelta(hours=horas),
        )

    now = datetime.now()
    caso.sla_id = sla.sla_id
    return (
        sla,
        now + timedelta(hours=sla.tiempo_primera_respuesta_horas),
        now + timedelta(hours=sla.tiempo_resolucion_horas),
    )


def _crear_historial(db, caso_id, usuario_id, accion, observacion=None, nuevo_estado_id=None, anterior_estado_id=None, visible=True):
    h = models.HistorialCaso(
        caso_id=caso_id,
        usuario_id=usuario_id,
        estado_anterior_id=anterior_estado_id,
        estado_nuevo_id=nuevo_estado_id,
        accion=accion,
        observacion=observacion,
        es_visible_cliente=visible,
    )
    db.add(h)


def _notificar_cliente(db, caso, titulo, mensaje, tipo):
    if caso.cliente and caso.cliente.usuario_id:
        utils.crear_notificacion(
            db, caso.cliente.usuario_id, titulo, mensaje, tipo, caso.caso_id
        )


def _notificar_responsable(db, caso, titulo, mensaje, tipo):
    if caso.responsable_actual_usuario_id:
        utils.crear_notificacion(
            db, caso.responsable_actual_usuario_id, titulo, mensaje, tipo, caso.caso_id
        )


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/casos — Crear caso (cliente o asesor)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
def crear_caso(
    payload: schemas.CasoCreateRequest,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
    request: Request = None,
):
    # Resolver cliente_id
    cliente = db.query(models.Cliente).filter(
        models.Cliente.usuario_id == current_user.usuario_id
    ).first()

    rol = current_user.rol.nombre.lower()
    if not cliente and rol in ("asesor", "supervisor", "administrador", "admin"):
        raise HTTPException(status_code=400, detail="Especifica el cliente_id para crear el caso.")

    if not cliente:
        raise HTTPException(status_code=403, detail="Solo clientes o staff pueden crear casos.")

    # Estado inicial
    estado_inicial = db.query(models.EstadoCaso).filter(
        models.EstadoCaso.nombre == "Registrado"
    ).first()
    if not estado_inicial:
        raise HTTPException(status_code=500, detail="Estado inicial no configurado. Ejecuta seed.py.")

    # Tipo de caso
    tipo = db.query(models.TipoCaso).filter(models.TipoCaso.tipo_caso_id == payload.tipo_caso_id).first()
    if not tipo:
        raise HTTPException(status_code=400, detail="Tipo de caso no válido.")

    # Prioridad
    prioridad = db.query(models.Prioridad).filter(models.Prioridad.prioridad_id == payload.prioridad_id).first()
    if not prioridad:
        raise HTTPException(status_code=400, detail="Prioridad no válida.")

    codigo = utils.generar_codigo_caso(tipo.nombre, db)

    nuevo = models.Caso(
        codigo_caso=codigo,
        cliente_id=cliente.cliente_id,
        servicio_contratado_id=payload.servicio_contratado_id,
        tipo_caso_id=payload.tipo_caso_id,
        categoria_id=payload.categoria_id,
        canal_ingreso_id=payload.canal_ingreso_id,
        prioridad_id=payload.prioridad_id,
        estado_caso_id=estado_inicial.estado_caso_id,
        creado_por_usuario_id=current_user.usuario_id,
        titulo=payload.titulo,
        descripcion=payload.descripcion,
        fecha_registro=datetime.now(),
    )
    db.add(nuevo)
    db.flush()

    # Calcular SLA
    _, fecha_resp, fecha_res = _calcular_fechas_sla(nuevo, db)
    nuevo.fecha_limite_respuesta = fecha_resp
    nuevo.fecha_limite_resolucion = fecha_res

    # Historial inicial
    _crear_historial(
        db, nuevo.caso_id, current_user.usuario_id,
        "Caso registrado",
        f"Caso creado desde {('el portal' if rol.startswith('cliente') else 'el sistema')}.",
        nuevo_estado_id=estado_inicial.estado_caso_id,
        visible=True,
    )

    db.commit()
    db.refresh(nuevo)

    # Auditoría
    utils.registrar_auditoria(
        db, "casos", str(nuevo.caso_id), "INSERT",
        usuario_id=current_user.usuario_id,
        valores_despues={"codigo_caso": nuevo.codigo_caso, "titulo": nuevo.titulo},
        ip=get_client_ip(request) if request else "0.0.0.0",
    )
    db.commit()

    return {
        "caso_id": nuevo.caso_id,
        "codigo_caso": nuevo.codigo_caso,
        "estado": estado_inicial.nombre,
        "detail": "Caso registrado correctamente.",
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/casos — Listar casos (staff)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("")
def listar_casos(
    estado_caso_id: int = Query(default=None),
    prioridad_id: int = Query(default=None),
    tipo_caso_id: int = Query(default=None),
    responsable_actual_usuario_id: int = Query(default=None),
    area_actual_id: int = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, le=100),
    current_user: models.Usuario = Depends(require_staff),
    db: Session = Depends(get_db),
):
    query = db.query(models.Caso)

    rol = current_user.rol.nombre.lower()
    # Asesores sólo ven sus casos
    if rol == "asesor":
        query = query.filter(
            models.Caso.responsable_actual_usuario_id == current_user.usuario_id
        )

    if estado_caso_id:
        query = query.filter(models.Caso.estado_caso_id == estado_caso_id)
    if prioridad_id:
        query = query.filter(models.Caso.prioridad_id == prioridad_id)
    if tipo_caso_id:
        query = query.filter(models.Caso.tipo_caso_id == tipo_caso_id)
    if responsable_actual_usuario_id:
        query = query.filter(models.Caso.responsable_actual_usuario_id == responsable_actual_usuario_id)
    if area_actual_id:
        query = query.filter(models.Caso.area_actual_id == area_actual_id)

    total = query.count()
    casos = query.order_by(models.Caso.fecha_registro.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "casos": [utils.caso_to_staff_frontend(c) for c in casos],
        "total": total,
        "page": page,
        "limit": limit,
    }


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/casos/consulta-publica
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/consulta-publica")
def consulta_publica(
    codigo_caso: str = Query(...),
    documento_numero: str = Query(...),
    db: Session = Depends(get_db),
):
    caso = db.query(models.Caso).filter(
        models.Caso.codigo_caso == codigo_caso.upper()
    ).first()

    if not caso:
        return schemas.ConsultaPublicaResponse(found=False)

    cliente = caso.cliente
    if not cliente or cliente.documento_numero != documento_numero:
        return schemas.ConsultaPublicaResponse(found=False)

    area = caso.area_actual.nombre if caso.area_actual else "Mesa de entrada"

    return schemas.ConsultaPublicaResponse(
        found=True,
        code=caso.codigo_caso,
        type=caso.tipo_caso.nombre if caso.tipo_caso else "—",
        title=caso.titulo,
        status=caso.estado_caso.nombre if caso.estado_caso else "—",
        lastUpdate=utils.fmt_datetime(caso.fecha_ultima_actualizacion or caso.fecha_registro),
        assignedArea=area,
        channel=caso.canal_ingreso.nombre if caso.canal_ingreso else "—",
        created=utils.fmt_fecha(caso.fecha_registro),
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/casos/{id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{caso_id}")
def detalle_caso(
    caso_id: int,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    caso = _get_caso(caso_id, db)
    rol = current_user.rol.nombre.lower()

    if rol.startswith("cliente"):
        cliente = db.query(models.Cliente).filter(
            models.Cliente.usuario_id == current_user.usuario_id
        ).first()
        if not cliente or caso.cliente_id != cliente.cliente_id:
            raise HTTPException(status_code=403, detail="No tienes acceso a este caso.")

    return utils.caso_to_staff_frontend(caso)


# ─────────────────────────────────────────────────────────────────────────────
# PUT /api/casos/{id}
# ─────────────────────────────────────────────────────────────────────────────

@router.put("/{caso_id}")
def actualizar_caso(
    caso_id: int,
    payload: schemas.CasoUpdateRequest,
    current_user: models.Usuario = Depends(require_staff),
    db: Session = Depends(get_db),
    request: Request = None,
):
    caso = _get_caso(caso_id, db)
    anterior_estado_id = caso.estado_caso_id

    if payload.estado_caso_id is not None:
        caso.estado_caso_id = payload.estado_caso_id
    if payload.prioridad_id is not None:
        caso.prioridad_id = payload.prioridad_id
    if payload.solucion_final is not None:
        caso.solucion_final = payload.solucion_final
    if payload.area_actual_id is not None:
        caso.area_actual_id = payload.area_actual_id
    if payload.pendiente_cliente is not None:
        caso.pendiente_cliente = payload.pendiente_cliente

    caso.fecha_ultima_actualizacion = datetime.now()

    nuevo_estado_id = caso.estado_caso_id
    nuevo_estado = db.query(models.EstadoCaso).filter(models.EstadoCaso.estado_caso_id == nuevo_estado_id).first()

    _crear_historial(
        db, caso_id, current_user.usuario_id,
        f"Caso actualizado",
        f"Actualización realizada por {current_user.username}.",
        nuevo_estado_id=nuevo_estado_id,
        anterior_estado_id=anterior_estado_id,
    )

    if payload.estado_caso_id and payload.estado_caso_id != anterior_estado_id:
        _notificar_cliente(
            db, caso,
            "Actualización de caso",
            f"Tu caso {caso.codigo_caso} cambió a {nuevo_estado.nombre if nuevo_estado else 'nuevo estado'}.",
            "actualizacion"
        )

    db.commit()
    return {"detail": "Caso actualizado.", "codigo_caso": caso.codigo_caso}


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/casos/{id}/cerrar
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{caso_id}/cerrar")
def cerrar_caso(
    caso_id: int,
    payload: schemas.CasoCerrarRequest,
    current_user: models.Usuario = Depends(require_staff),
    db: Session = Depends(get_db),
):
    caso = _get_caso(caso_id, db)

    estado_cerrado = db.query(models.EstadoCaso).filter(
        models.EstadoCaso.nombre.in_(["Cerrado", "Resuelto"])
    ).first()
    if not estado_cerrado:
        raise HTTPException(status_code=500, detail="Estado de cierre no configurado.")

    anterior_estado_id = caso.estado_caso_id
    caso.estado_caso_id = estado_cerrado.estado_caso_id
    caso.solucion_final = payload.solucion_final
    caso.fecha_cierre = datetime.now()
    caso.cerrado_por_usuario_id = current_user.usuario_id
    caso.fecha_ultima_actualizacion = datetime.now()

    _crear_historial(
        db, caso_id, current_user.usuario_id,
        "Caso cerrado",
        payload.observacion or payload.solucion_final,
        nuevo_estado_id=estado_cerrado.estado_caso_id,
        anterior_estado_id=anterior_estado_id,
    )

    _notificar_cliente(
        db, caso,
        "Caso resuelto",
        f"Tu caso {caso.codigo_caso} ha sido cerrado. {payload.solucion_final[:80]}",
        "cierre"
    )

    db.commit()
    return {"detail": "Caso cerrado correctamente.", "codigo_caso": caso.codigo_caso}


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/casos/{id}/historial
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{caso_id}/historial")
def historial_caso(
    caso_id: int,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    caso = _get_caso(caso_id, db)
    rol = current_user.rol.nombre.lower()
    solo_visible = rol.startswith("cliente")

    items = []
    for h in reversed(caso.historial):
        if solo_visible and not h.es_visible_cliente:
            continue
        items.append({
            "historial_id": h.historial_id,
            "icon": utils.get_historial_icon(h.accion),
            "title": h.accion,
            "text": h.observacion or "",
            "date": utils.fmt_datetime(h.fecha_evento),
            "usuario": h.usuario.username if h.usuario else "—",
            "estado_nuevo": h.estado_nuevo.nombre if h.estado_nuevo else None,
            "visible_cliente": h.es_visible_cliente,
        })

    return {"historial": items, "total": len(items)}


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/casos/{id}/historial
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{caso_id}/historial")
def agregar_historial(
    caso_id: int,
    payload: schemas.HistorialCreateRequest,
    current_user: models.Usuario = Depends(require_staff),
    db: Session = Depends(get_db),
):
    caso = _get_caso(caso_id, db)
    anterior_estado_id = caso.estado_caso_id

    if payload.nuevo_estado_id:
        caso.estado_caso_id = payload.nuevo_estado_id
        caso.fecha_ultima_actualizacion = datetime.now()

    _crear_historial(
        db, caso_id, current_user.usuario_id,
        payload.accion,
        payload.observacion,
        nuevo_estado_id=payload.nuevo_estado_id,
        anterior_estado_id=anterior_estado_id if payload.nuevo_estado_id else None,
        visible=payload.es_visible_cliente,
    )

    if payload.es_visible_cliente:
        _notificar_cliente(
            db, caso,
            "Actualización de tu caso",
            f"Nuevo avance en {caso.codigo_caso}: {payload.accion}",
            "actualizacion"
        )

    db.commit()
    return {"detail": "Avance registrado correctamente."}


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/casos/{id}/asignar
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{caso_id}/asignar")
def asignar_caso(
    caso_id: int,
    payload: schemas.AsignarCasoRequest,
    current_user: models.Usuario = Depends(require_staff),
    db: Session = Depends(get_db),
):
    caso = _get_caso(caso_id, db)
    anterior_usuario_id = caso.responsable_actual_usuario_id
    anterior_area_id = caso.area_actual_id

    asignacion = models.AsignacionCaso(
        caso_id=caso_id,
        usuario_origen_id=anterior_usuario_id,
        area_origen_id=anterior_area_id,
        usuario_destino_id=payload.usuario_destino_id,
        area_destino_id=payload.area_destino_id,
        asignado_por_usuario_id=current_user.usuario_id,
        tipo_movimiento=payload.tipo_movimiento.upper(),
        motivo=payload.motivo,
    )
    db.add(asignacion)

    if payload.usuario_destino_id:
        caso.responsable_actual_usuario_id = payload.usuario_destino_id
    if payload.area_destino_id:
        caso.area_actual_id = payload.area_destino_id

    # Cambiar estado según tipo de movimiento
    estado_nombre = {
        "ASIGNACION": "En atención",
        "REASIGNACION": "En atención",
        "DERIVACION": "Derivado",
        "ESCALAMIENTO": "En revisión técnica",
    }.get(payload.tipo_movimiento.upper(), "En atención")

    nuevo_estado = db.query(models.EstadoCaso).filter(
        models.EstadoCaso.nombre == estado_nombre
    ).first()
    if nuevo_estado:
        caso.estado_caso_id = nuevo_estado.estado_caso_id

    caso.fecha_ultima_actualizacion = datetime.now()

    accion_label = {
        "ASIGNACION": "Caso asignado",
        "REASIGNACION": "Caso reasignado",
        "DERIVACION": "Caso derivado",
        "ESCALAMIENTO": "Caso escalado",
    }.get(payload.tipo_movimiento.upper(), "Asignación")

    _crear_historial(
        db, caso_id, current_user.usuario_id,
        accion_label,
        payload.motivo or f"Movimiento tipo {payload.tipo_movimiento}.",
        nuevo_estado_id=nuevo_estado.estado_caso_id if nuevo_estado else None,
        anterior_estado_id=caso.estado_caso_id,
    )

    if payload.usuario_destino_id:
        utils.crear_notificacion(
            db, payload.usuario_destino_id,
            "Nuevo caso asignado",
            f"Se te asignó el caso {caso.codigo_caso}: {caso.titulo}",
            "asignacion",
            caso_id,
        )

    _notificar_cliente(
        db, caso,
        "Tu caso está siendo atendido",
        f"Tu caso {caso.codigo_caso} fue {accion_label.lower()}.",
        "actualizacion"
    )

    db.commit()
    return {"detail": f"{accion_label} correctamente.", "codigo_caso": caso.codigo_caso}


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/casos/{id}/evidencias
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{caso_id}/evidencias")
def listar_evidencias(
    caso_id: int,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    caso = _get_caso(caso_id, db)
    evidencias = [
        {
            "evidencia_id": e.evidencia_id,
            "icon": "📎",
            "name": e.nombre_archivo,
            "detail": e.descripcion or "",
            "tipo_mime": e.tipo_mime,
            "size": e.tamano_bytes,
            "fecha": utils.fmt_datetime(e.fecha_carga),
            "usuario": e.usuario.username if e.usuario else "—",
        }
        for e in caso.evidencias
    ]
    return {"evidencias": evidencias, "total": len(evidencias)}


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/casos/{id}/evidencias
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{caso_id}/evidencias", status_code=201)
async def subir_evidencia(
    caso_id: int,
    file: UploadFile = File(...),
    descripcion: str = None,
    current_user: models.Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    caso = _get_caso(caso_id, db)

    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Archivo demasiado grande. Máximo {settings.MAX_FILE_SIZE_MB}MB.")

    ext = os.path.splitext(file.filename)[1]
    nombre_guardado = f"{uuid.uuid4()}{ext}"
    carpeta = os.path.join(settings.UPLOAD_DIR, str(caso_id))
    os.makedirs(carpeta, exist_ok=True)
    ruta = os.path.join(carpeta, nombre_guardado)

    with open(ruta, "wb") as f:
        f.write(content)

    evidencia = models.Evidencia(
        caso_id=caso_id,
        usuario_id=current_user.usuario_id,
        nombre_archivo=file.filename,
        ruta_archivo=ruta,
        tipo_mime=file.content_type,
        tamano_bytes=len(content),
        descripcion=descripcion,
    )
    db.add(evidencia)

    _crear_historial(
        db, caso_id, current_user.usuario_id,
        "Evidencia adjuntada",
        f"Se adjuntó el archivo: {file.filename}",
        visible=True,
    )

    db.commit()
    return {"detail": "Evidencia subida correctamente.", "nombre_archivo": file.filename}
