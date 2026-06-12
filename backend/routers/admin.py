"""
routers/admin.py — Endpoints del módulo Administrador.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_admin
import models, schemas, utils
from auth import hash_password

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# PERFIL DEL ADMIN (GET /api/admin/me implícito vía /api/auth/me)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/dashboard")
def dashboard(current_user=Depends(require_admin), db: Session = Depends(get_db)):
    from sqlalchemy import func
    p = current_user.personal
    nombre = f"{p.nombres} {p.apellidos}".strip() if p else current_user.username
    initials = utils.get_initials(p.nombres if p else current_user.username, p.apellidos if p else "")

    total_users = db.query(models.Usuario).count()
    total_casos = db.query(models.Caso).count()
    total_roles = db.query(models.Rol).count()
    total_sla = db.query(models.Sla).filter(models.Sla.activo == True).count()

    return {
        "admin": {
            "id": current_user.usuario_id,
            "name": nombre,
            "initials": initials,
            "role": "Administrador del sistema",
            "status": "Sistema operativo",
            "lastUpdate": utils.fmt_datetime(current_user.ultimo_acceso),
        },
        "stats": {
            "total_users": total_users,
            "total_casos": total_casos,
            "total_roles": total_roles,
            "total_sla_rules": total_sla,
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# USUARIOS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/usuarios")
def listar_usuarios(
    rol_id: int = Query(default=None),
    estado: str = Query(default=None),
    q: str = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, le=100),
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Usuario)
    if rol_id:
        query = query.filter(models.Usuario.rol_id == rol_id)
    if estado:
        query = query.filter(models.Usuario.estado == estado.upper())
    if q:
        query = query.filter(
            (models.Usuario.username.ilike(f"%{q}%")) |
            (models.Usuario.correo.ilike(f"%{q}%"))
        )

    total = query.count()
    usuarios = query.order_by(models.Usuario.fecha_creacion.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "usuarios": [utils.usuario_to_frontend(u) for u in usuarios],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/usuarios/{user_id}")
def detalle_usuario(
    user_id: int,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    u = db.query(models.Usuario).filter(models.Usuario.usuario_id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return utils.usuario_to_frontend(u)


@router.post("/usuarios", status_code=201)
def crear_usuario(
    payload: schemas.UsuarioCreateRequest,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.query(models.Usuario).filter(models.Usuario.correo == payload.correo).first():
        raise HTTPException(status_code=400, detail="El correo ya está registrado.")

    nuevo = models.Usuario(
        rol_id=payload.rol_id,
        area_id=payload.area_id,
        username=payload.username,
        correo=payload.correo,
        password_hash=hash_password(payload.password),
        estado="ACTIVO",
    )
    db.add(nuevo)
    db.flush()

    personal = models.Personal(
        usuario_id=nuevo.usuario_id,
        area_id=payload.area_id,
        nombres=payload.nombres,
        apellidos=payload.apellidos,
        documento_tipo=payload.documento_tipo,
        documento_numero=payload.documento_numero,
        telefono=payload.telefono,
        cargo=payload.cargo,
    )
    db.add(personal)
    db.commit()

    utils.registrar_auditoria(db, "usuarios", str(nuevo.usuario_id), "INSERT", current_user.usuario_id)
    db.commit()

    return {"usuario_id": nuevo.usuario_id, "detail": "Usuario creado correctamente."}


@router.put("/usuarios/{user_id}")
def actualizar_usuario(
    user_id: int,
    payload: schemas.UsuarioUpdateRequest,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    u = db.query(models.Usuario).filter(models.Usuario.usuario_id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    if payload.rol_id:
        u.rol_id = payload.rol_id
    if payload.area_id is not None:
        u.area_id = payload.area_id
    if payload.correo:
        u.correo = payload.correo
    if payload.username:
        u.username = payload.username

    u.fecha_actualizacion = datetime.now()

    p = u.personal
    if p:
        if payload.nombres:
            p.nombres = payload.nombres
        if payload.apellidos:
            p.apellidos = payload.apellidos
        if payload.telefono is not None:
            p.telefono = payload.telefono
        if payload.cargo is not None:
            p.cargo = payload.cargo

    db.commit()
    utils.registrar_auditoria(db, "usuarios", str(user_id), "UPDATE", current_user.usuario_id)
    db.commit()

    return {"detail": "Usuario actualizado."}


@router.patch("/usuarios/{user_id}/estado")
def cambiar_estado_usuario(
    user_id: int,
    payload: schemas.UsuarioEstadoRequest,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    if payload.estado.upper() not in ("ACTIVO", "INACTIVO", "BLOQUEADO"):
        raise HTTPException(status_code=400, detail="Estado no válido.")

    u = db.query(models.Usuario).filter(models.Usuario.usuario_id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    u.estado = payload.estado.upper()
    u.fecha_actualizacion = datetime.now()
    db.commit()

    return {"detail": f"Estado actualizado a {u.estado}."}


# ─────────────────────────────────────────────────────────────────────────────
# ROLES Y PERMISOS
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/roles")
def listar_roles(current_user=Depends(require_admin), db: Session = Depends(get_db)):
    roles = db.query(models.Rol).filter(models.Rol.activo == True).all()
    result = []
    for r in roles:
        usuarios_count = db.query(models.Usuario).filter(models.Usuario.rol_id == r.rol_id).count()
        permisos_count = len(r.permisos)
        result.append({
            "id": r.rol_id,
            "name": r.nombre,
            "description": r.descripcion or "",
            "users": usuarios_count,
            "permissions": permisos_count,
            "status": "Activo" if r.activo else "Inactivo",
        })
    return {"roles": result, "total": len(result)}


@router.get("/permisos")
def listar_permisos(current_user=Depends(require_admin), db: Session = Depends(get_db)):
    permisos = db.query(models.Permiso).filter(models.Permiso.activo == True).all()
    result = [
        {
            "id": p.permiso_id,
            "nombre": p.nombre,
            "modulo": p.modulo or "General",
            "descripcion": p.descripcion or "",
        }
        for p in permisos
    ]
    return {"permisos": result, "total": len(result)}


@router.put("/roles/{rol_id}/permisos")
def asignar_permisos(
    rol_id: int,
    payload: schemas.AsignarPermisosRequest,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    rol = db.query(models.Rol).filter(models.Rol.rol_id == rol_id).first()
    if not rol:
        raise HTTPException(status_code=404, detail="Rol no encontrado.")

    # Eliminar permisos actuales
    db.query(models.RolPermiso).filter(models.RolPermiso.rol_id == rol_id).delete()

    # Agregar nuevos
    for pid in payload.permiso_ids:
        rp = models.RolPermiso(rol_id=rol_id, permiso_id=pid)
        db.add(rp)

    db.commit()
    return {"detail": f"Permisos del rol '{rol.nombre}' actualizados."}


# ─────────────────────────────────────────────────────────────────────────────
# CATÁLOGOS GENÉRICOS
# Soporta: areas, tipos-caso, categorias, prioridades, estados-caso, canales, servicios
# ─────────────────────────────────────────────────────────────────────────────

CATALOGO_MAP = {
    "areas": models.Area,
    "tipos-caso": models.TipoCaso,
    "categorias": models.Categoria,
    "prioridades": models.Prioridad,
    "estados-caso": models.EstadoCaso,
    "canales": models.CanalIngreso,
    "servicios": models.Servicio,
}


def _get_model(catalog: str):
    m = CATALOGO_MAP.get(catalog)
    if not m:
        raise HTTPException(status_code=404, detail=f"Catálogo '{catalog}' no existe.")
    return m


@router.get("/catalogos/{catalog}")
def listar_catalogo(
    catalog: str,
    activo: bool = Query(default=None),
    tipo_caso_id: int = Query(default=None),
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    model = _get_model(catalog)
    query = db.query(model)

    if hasattr(model, "activo") and activo is not None:
        query = query.filter(model.activo == activo)
    if catalog == "categorias" and tipo_caso_id:
        query = query.filter(model.tipo_caso_id == tipo_caso_id)

    items = query.all()
    result = []
    for item in items:
        d = {c.name: getattr(item, c.name) for c in item.__table__.columns}
        result.append(d)

    return {"items": result, "total": len(result)}


@router.post("/catalogos/{catalog}", status_code=201)
def crear_catalogo_item(
    catalog: str,
    payload: schemas.CatalogoItemCreate,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    model = _get_model(catalog)
    kwargs = {"nombre": payload.nombre}

    if payload.descripcion is not None:
        kwargs["descripcion"] = payload.descripcion
    if hasattr(model, "activo"):
        kwargs["activo"] = payload.activo

    # Campos específicos
    if catalog == "categorias" and payload.tipo_caso_id:
        kwargs["tipo_caso_id"] = payload.tipo_caso_id
    if catalog == "prioridades" and payload.nivel is not None:
        kwargs["nivel"] = payload.nivel
        if payload.tiempo_objetivo_horas:
            kwargs["tiempo_objetivo_horas"] = payload.tiempo_objetivo_horas
    if catalog == "estados-caso":
        if payload.es_final is not None:
            kwargs["es_final"] = payload.es_final
        if payload.visible_cliente is not None:
            kwargs["visible_cliente"] = payload.visible_cliente
        if payload.orden is not None:
            kwargs["orden"] = payload.orden

    item = model(**kwargs)
    db.add(item)
    db.commit()

    pk_col = item.__table__.primary_key.columns.keys()[0]
    return {"id": getattr(item, pk_col), "detail": "Ítem creado."}


@router.put("/catalogos/{catalog}/{item_id}")
def actualizar_catalogo_item(
    catalog: str,
    item_id: int,
    payload: schemas.CatalogoItemUpdate,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    model = _get_model(catalog)
    pk_col = model.__table__.primary_key.columns.keys()[0]
    item = db.query(model).filter(getattr(model, pk_col) == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado.")

    for field, val in payload.model_dump(exclude_none=True).items():
        if hasattr(item, field):
            setattr(item, field, val)

    db.commit()
    return {"detail": "Ítem actualizado."}


@router.delete("/catalogos/{catalog}/{item_id}")
def eliminar_catalogo_item(
    catalog: str,
    item_id: int,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    model = _get_model(catalog)
    pk_col = model.__table__.primary_key.columns.keys()[0]
    item = db.query(model).filter(getattr(model, pk_col) == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado.")

    if hasattr(item, "activo"):
        item.activo = False   # Soft delete
    else:
        db.delete(item)

    db.commit()
    return {"detail": "Ítem eliminado."}


# ─────────────────────────────────────────────────────────────────────────────
# SLA
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/sla")
def listar_sla(
    activo: bool = Query(default=None),
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Sla)
    if activo is not None:
        query = query.filter(models.Sla.activo == activo)

    items = query.all()
    result = [
        {
            "sla_id": s.sla_id,
            "nombre": s.nombre,
            "tipo_caso": s.tipo_caso.nombre if s.tipo_caso else "Todos",
            "categoria": s.categoria.nombre if s.categoria else "Todas",
            "prioridad": s.prioridad.nombre if s.prioridad else "Todas",
            "servicio": s.servicio.nombre if s.servicio else "Todos",
            "tiempo_primera_respuesta_horas": s.tiempo_primera_respuesta_horas,
            "tiempo_resolucion_horas": s.tiempo_resolucion_horas,
            "activo": s.activo,
        }
        for s in items
    ]
    return {"sla": result, "total": len(result)}


@router.post("/sla", status_code=201)
def crear_sla(
    payload: schemas.SlaCreateRequest,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    s = models.Sla(**payload.model_dump())
    db.add(s)
    db.commit()
    return {"sla_id": s.sla_id, "detail": "Regla SLA creada."}


@router.put("/sla/{sla_id}")
def actualizar_sla(
    sla_id: int,
    payload: schemas.SlaUpdateRequest,
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    s = db.query(models.Sla).filter(models.Sla.sla_id == sla_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Regla SLA no encontrada.")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()
    return {"detail": "Regla SLA actualizada."}


# ─────────────────────────────────────────────────────────────────────────────
# AUDITORÍA
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/auditoria")
def auditoria(
    tabla: str = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=30, le=100),
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(models.Auditoria)
    if tabla:
        query = query.filter(models.Auditoria.tabla_afectada == tabla)
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
            "valores_antes": a.valores_antes,
            "valores_despues": a.valores_despues,
        }
        for a in items
    ]
    return {"auditorias": result, "total": total, "page": page, "limit": limit}


# ─────────────────────────────────────────────────────────────────────────────
# REPORTES
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/reportes")
def reportes(
    current_user=Depends(require_admin),
    db: Session = Depends(get_db),
):
    items = db.query(models.Reporte).order_by(models.Reporte.fecha_generacion.desc()).limit(50).all()
    return {
        "reportes": [
            {
                "id": r.reporte_id,
                "nombre": r.nombre,
                "formato": r.formato,
                "fecha": utils.fmt_datetime(r.fecha_generacion),
                "generado_por": r.generado_por.username if r.generado_por else "—",
            }
            for r in items
        ]
    }


@router.post("/reportes", status_code=201)
def generar_reporte(
    payload: schemas.ReporteCreateRequest,
    current_user=Depends(require_admin),
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


# ─────────────────────────────────────────────────────────────────────────────
# INTEGRACIONES (en memoria / estáticas para demo)
# ─────────────────────────────────────────────────────────────────────────────

_integraciones = [
    {"id": 1, "nombre": "SMTP Email", "tipo": "email", "estado": "activo", "host": "smtp.gmail.com"},
    {"id": 2, "nombre": "SMS Gateway", "tipo": "sms", "estado": "inactivo", "host": ""},
    {"id": 3, "nombre": "WhatsApp Business", "tipo": "whatsapp", "estado": "inactivo", "host": ""},
]


@router.get("/integraciones")
def listar_integraciones(current_user=Depends(require_admin)):
    return {"integraciones": _integraciones, "total": len(_integraciones)}


@router.post("/integraciones")
def guardar_integracion(payload: dict, current_user=Depends(require_admin)):
    return {"detail": "Integración guardada (demo)."}


@router.post("/integraciones/{int_id}/test")
def probar_integracion(int_id: int, current_user=Depends(require_admin)):
    return {"detail": "Conexión probada (demo). Estado: OK"}


# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURACIÓN DEL SISTEMA
# ─────────────────────────────────────────────────────────────────────────────

_config_sistema = {
    "nombre_sistema": "ClaroAtencion360",
    "empresa": "Claro Perú",
    "zona_horaria": "America/Lima",
    "idioma": "es-PE",
    "max_file_size_mb": 10,
    "session_timeout_minutes": 480,
    "notificaciones_email": True,
    "notificaciones_sms": False,
    "modo_mantenimiento": False,
}


@router.get("/configuracion")
def obtener_configuracion(current_user=Depends(require_admin)):
    return {"configuracion": _config_sistema}


@router.put("/configuracion")
def guardar_configuracion(payload: dict, current_user=Depends(require_admin)):
    _config_sistema.update(payload)
    return {"detail": "Configuración guardada.", "configuracion": _config_sistema}
