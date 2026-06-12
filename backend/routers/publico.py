"""
routers/publico.py — Endpoints públicos (sin autenticación).

GET /api/publico/consultar-caso
GET /api/publico/estado-servicios
GET /api/publico/centro-ayuda
GET /api/publico/catalogos-formulario
"""

from fastapi import APIRouter, Query
from sqlalchemy.orm import Session
from fastapi import Depends

from database import get_db
import models, utils

router = APIRouter()


# ── GET /api/publico/consultar-caso ─────────────────────────────────────────

@router.get("/consultar-caso")
def consultar_caso(
    codigo_caso: str = Query(..., description="Código del caso, ej: REC-2026-000001"),
    documento_numero: str = Query(..., description="DNI o RUC del titular"),
    db: Session = Depends(get_db),
):
    caso = db.query(models.Caso).filter(
        models.Caso.codigo_caso == codigo_caso.upper().strip()
    ).first()

    if not caso:
        return {"found": False, "message": "No encontramos un caso con ese código."}

    cliente = caso.cliente
    if not cliente or cliente.documento_numero != documento_numero.strip():
        return {"found": False, "message": "El documento no coincide con el titular del caso."}

    area = caso.area_actual.nombre if caso.area_actual else "Mesa de entrada"

    return {
        "found": True,
        "code": caso.codigo_caso,
        "type": caso.tipo_caso.nombre if caso.tipo_caso else "—",
        "title": caso.titulo,
        "status": caso.estado_caso.nombre if caso.estado_caso else "—",
        "statusType": utils.get_status_type(caso.estado_caso.nombre if caso.estado_caso else ""),
        "lastUpdate": utils.fmt_datetime(caso.fecha_ultima_actualizacion or caso.fecha_registro),
        "assignedArea": area,
        "channel": caso.canal_ingreso.nombre if caso.canal_ingreso else "—",
        "created": utils.fmt_fecha(caso.fecha_registro),
        "priority": caso.prioridad.nombre if caso.prioridad else "—",
    }


# ── GET /api/publico/estado-servicios ───────────────────────────────────────

@router.get("/estado-servicios")
def estado_servicios(db: Session = Depends(get_db)):
    """
    Devuelve el estado operativo de los servicios para la página estado-servicios.html.
    Basado en la tabla 'servicios' y la cantidad de incidencias abiertas por servicio.
    """
    servicios = db.query(models.Servicio).filter(models.Servicio.activo == True).all()

    result = []
    for s in servicios:
        # Contar incidencias activas para este servicio
        incidencias_activas = (
            db.query(models.Caso)
            .join(models.TipoCaso)
            .join(models.ServicioContratado, isouter=True)
            .filter(
                models.ServicioContratado.servicio_id == s.servicio_id,
                models.TipoCaso.nombre == "Incidencia",
                ~models.Caso.estado_caso.has(models.EstadoCaso.es_final == True),
            )
            .count()
        )

        estado = "Operativo"
        estado_type = "success"
        if incidencias_activas >= 5:
            estado = "Degradado"
            estado_type = "danger"
        elif incidencias_activas >= 2:
            estado = "Intermitente"
            estado_type = "warning"

        result.append({
            "id": s.servicio_id,
            "nombre": s.nombre,
            "descripcion": s.descripcion or "",
            "estado": estado,
            "estadoType": estado_type,
            "incidencias_activas": incidencias_activas,
            "icon": utils.get_service_icon(s.nombre),
        })

    # Resumen global
    total_degradados = sum(1 for r in result if r["estadoType"] in ("danger", "warning"))
    estado_global = "Todos los servicios operativos" if total_degradados == 0 else f"{total_degradados} servicio(s) con incidencias"

    return {
        "servicios": result,
        "total": len(result),
        "estado_global": estado_global,
        "estado_global_type": "success" if total_degradados == 0 else "warning",
    }


# ── GET /api/publico/centro-ayuda ────────────────────────────────────────────

@router.get("/centro-ayuda")
def centro_ayuda(
    q: str = Query(default=None),
    categoria: str = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, le=50),
):
    """
    Artículos de ayuda estáticos para la página centro-ayuda.html.
    En producción se conectaría a un CMS o base de conocimiento.
    """
    articulos = [
        {
            "id": 1, "categoria": "reclamos",
            "titulo": "¿Cómo registrar un reclamo?",
            "resumen": "Aprende a registrar un reclamo paso a paso desde el portal de clientes.",
            "contenido": "Para registrar un reclamo: 1) Inicia sesión con tu cuenta de cliente. 2) Ve a 'Registrar Reclamo'. 3) Selecciona el servicio afectado. 4) Describe el problema y adjunta evidencia. 5) Envía el reclamo.",
            "tags": ["reclamo", "registro", "pasos"],
        },
        {
            "id": 2, "categoria": "incidencias",
            "titulo": "¿Cómo reportar una incidencia técnica?",
            "resumen": "Guía para reportar fallas en servicios de internet, móvil o TV.",
            "contenido": "Para reportar una incidencia: 1) Accede a 'Registrar Incidencia'. 2) Selecciona el servicio afectado. 3) Indica el síntoma y el impacto. 4) Describe el problema. 5) Envía el reporte.",
            "tags": ["incidencia", "falla", "técnico"],
        },
        {
            "id": 3, "categoria": "consultas",
            "titulo": "¿Cómo consultar el estado de mi caso?",
            "resumen": "Puedes revisar el estado de cualquier caso desde el portal o con tu DNI.",
            "contenido": "Tienes dos opciones: 1) Si tienes cuenta, ingresa a 'Mis Casos' en el portal. 2) Sin cuenta, usa la 'Consulta Rápida' con el código del caso y tu DNI.",
            "tags": ["consulta", "estado", "seguimiento"],
        },
        {
            "id": 4, "categoria": "cuenta",
            "titulo": "¿Cómo recuperar mi contraseña?",
            "resumen": "Si olvidaste tu contraseña, puedes restablecerla desde el inicio de sesión.",
            "contenido": "1) Ve a la página de inicio de sesión. 2) Haz clic en '¿Olvidaste tu contraseña?'. 3) Ingresa tu correo registrado. 4) Recibirás un enlace para crear una nueva contraseña.",
            "tags": ["contraseña", "recuperar", "acceso"],
        },
        {
            "id": 5, "categoria": "reclamos",
            "titulo": "¿Cuánto tiempo demora la atención de un reclamo?",
            "resumen": "Los plazos de atención dependen del tipo y prioridad del reclamo.",
            "contenido": "Los plazos estándar son: Prioridad Crítica: hasta 4 horas. Alta: hasta 8 horas. Media: hasta 24 horas. Baja: hasta 72 horas. Estos plazos son de referencia y pueden variar.",
            "tags": ["plazo", "tiempo", "SLA"],
        },
        {
            "id": 6, "categoria": "servicios",
            "titulo": "¿Cómo ver mis servicios contratados?",
            "resumen": "Consulta todos tus servicios activos, planes y contratos desde el portal.",
            "contenido": "Ingresa a tu cuenta de cliente y ve a la sección 'Mis Servicios' para ver todos tus servicios activos, planes contratados y su estado actual.",
            "tags": ["servicios", "contratos", "planes"],
        },
    ]

    filtered = articulos
    if q:
        q_lower = q.lower()
        filtered = [a for a in articulos if q_lower in a["titulo"].lower() or q_lower in a["resumen"].lower() or any(q_lower in t for t in a["tags"])]
    if categoria:
        filtered = [a for a in filtered if a["categoria"] == categoria]

    total = len(filtered)
    start = (page - 1) * limit
    paginated = filtered[start:start + limit]

    categorias_unicas = list(set(a["categoria"] for a in articulos))

    return {
        "articulos": paginated,
        "total": total,
        "page": page,
        "limit": limit,
        "categorias": categorias_unicas,
    }


# ── GET /api/publico/catalogos-formulario ────────────────────────────────────

@router.get("/catalogos-formulario")
def catalogos_formulario(db: Session = Depends(get_db)):
    """
    Retorna los catálogos necesarios para llenar los formularios de reclamo/incidencia.
    No requiere autenticación.
    """
    tipos = db.query(models.TipoCaso).filter(models.TipoCaso.activo == True).all()
    categorias = db.query(models.Categoria).filter(models.Categoria.activo == True).all()
    servicios = db.query(models.Servicio).filter(models.Servicio.activo == True).all()
    canales = db.query(models.CanalIngreso).filter(models.CanalIngreso.activo == True).all()
    prioridades = db.query(models.Prioridad).filter(models.Prioridad.activo == True).all()

    return {
        "tipos_caso": [{"id": t.tipo_caso_id, "nombre": t.nombre} for t in tipos],
        "categorias": [
            {"id": c.categoria_id, "nombre": c.nombre, "tipo_caso_id": c.tipo_caso_id}
            for c in categorias
        ],
        "servicios": [{"id": s.servicio_id, "nombre": s.nombre} for s in servicios],
        "canales_ingreso": [{"id": c.canal_ingreso_id, "nombre": c.nombre} for c in canales],
        "prioridades": [
            {"id": p.prioridad_id, "nombre": p.nombre, "nivel": p.nivel}
            for p in sorted(prioridades, key=lambda x: x.nivel, reverse=True)
        ],
    }
