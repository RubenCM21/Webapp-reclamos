from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, PlainTextResponse

from app.asesor.service import (
    asesor_me_service,
    asesor_resumen_service,
    asesor_dashboard_service,
    asesor_catalogos_service,
    asesor_list_cases_service,
    asesor_case_detail_service,
    asesor_update_case_service,
    asesor_request_info_service,
    asesor_derive_case_service,
    asesor_close_case_service,
    asesor_sla_reminder_service,
    asesor_sla_follow_service,
    asesor_templates_service,
    asesor_create_template_service,
    asesor_template_render_service,
    asesor_use_template_service,
    asesor_send_template_service,
    asesor_notifications_service,
    asesor_mark_all_notifications_read_service,
    asesor_mark_notification_read_service,
    asesor_clear_read_notifications_service,
    asesor_performance_service,
    asesor_search_service,
    asesor_assistant_service,
    asesor_case_certificate_service,
    asesor_export_service,
)
from app.utils.auth_dependency import get_current_advisor


router = APIRouter(prefix="/asesor", tags=["Asesor"])


# =========================================================
# PERFIL / SHELL
# =========================================================

@router.get("/me")
def asesor_me(asesor: dict = Depends(get_current_advisor)):
    return asesor_me_service(asesor)


@router.get("/resumen")
def asesor_resumen(asesor: dict = Depends(get_current_advisor)):
    return asesor_resumen_service(asesor)


@router.get("/dashboard")
def asesor_dashboard(asesor: dict = Depends(get_current_advisor)):
    return asesor_dashboard_service(asesor)


@router.get("/catalogos")
def asesor_catalogos(asesor: dict = Depends(get_current_advisor)):
    return asesor_catalogos_service(asesor)


# =========================================================
# BÚSQUEDA
# Importante: estas rutas van antes de /casos/{case_id}
# para evitar que "buscar" sea interpretado como case_id.
# =========================================================

@router.get("/search")
def asesor_search(
    q: str = Query("", description="Texto de búsqueda"),
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_search_service(asesor, q)


@router.get("/buscar")
def asesor_search_alias(
    q: str = Query("", description="Texto de búsqueda"),
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_search_service(asesor, q)


@router.get("/casos/buscar")
def asesor_search_cases(
    q: str = Query("", description="Texto de búsqueda"),
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_search_service(asesor, q)


# =========================================================
# CASOS
# =========================================================

@router.get("/casos")
def asesor_list_cases(
    q: str = Query("", description="Búsqueda por caso, cliente, documento o servicio"),
    estado: str = Query("", description="Filtro por estado"),
    prioridad: str = Query("", description="Filtro por prioridad"),
    tipo: str = Query("", description="Filtro por tipo de caso"),
    sla: str = Query("", description="Filtro por grupo SLA"),
    asesor: dict = Depends(get_current_advisor),
):
    filters = {
        "q": q,
        "estado": estado,
        "prioridad": prioridad,
        "tipo": tipo,
        "sla": sla,
    }
    return asesor_list_cases_service(asesor, filters)


@router.get("/casos/{case_id}")
def asesor_case_detail(case_id: str, asesor: dict = Depends(get_current_advisor)):
    return asesor_case_detail_service(asesor, case_id)


@router.patch("/casos/{case_id}/actualizar")
def asesor_update_case(
    case_id: str,
    payload: dict,
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_update_case_service(asesor, case_id, payload)


# Endpoint nuevo usado por el frontend corregido.
@router.post("/casos/{case_id}/solicitar-informacion")
def asesor_request_info_new(
    case_id: str,
    payload: dict,
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_request_info_service(asesor, case_id, payload)


# Alias para mantener compatibilidad con el endpoint antiguo.
@router.post("/casos/{case_id}/solicitud")
def asesor_request_info_old(
    case_id: str,
    payload: dict,
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_request_info_service(asesor, case_id, payload)


@router.post("/casos/{case_id}/derivar")
def asesor_derive_case(
    case_id: str,
    payload: dict,
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_derive_case_service(asesor, case_id, payload)


@router.post("/casos/{case_id}/cerrar")
def asesor_close_case(
    case_id: str,
    payload: dict,
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_close_case_service(asesor, case_id, payload)


@router.post("/casos/{case_id}/recordatorio-sla")
def asesor_sla_reminder(
    case_id: str,
    payload: dict,
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_sla_reminder_service(asesor, case_id, payload)


@router.post("/casos/{case_id}/seguimiento-sla")
def asesor_sla_follow(
    case_id: str,
    payload: dict,
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_sla_follow_service(asesor, case_id, payload)


@router.get("/casos/{case_id}/constancia")
def asesor_case_certificate(
    case_id: str,
    formato: str = Query("pdf", description="pdf, txt, html"),
    asesor: dict = Depends(get_current_advisor)
):
    content, media_type, filename = asesor_case_certificate_service(
        asesor=asesor,
        case_id=case_id,
        formato=formato
    )

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


# =========================================================
# PLANTILLAS
# =========================================================

@router.get("/plantillas")
def asesor_templates(asesor: dict = Depends(get_current_advisor)):
    return asesor_templates_service(asesor)


@router.post("/plantillas")
def asesor_create_template(payload: dict, asesor: dict = Depends(get_current_advisor)):
    return asesor_create_template_service(asesor, payload)


@router.post("/plantillas/{template_id}/renderizar")
def asesor_template_render(
    template_id: int,
    payload: dict,
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_template_render_service(asesor, template_id, payload)


@router.post("/plantillas/{template_id}/usar")
def asesor_use_template(
    template_id: int,
    payload: dict,
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_use_template_service(asesor, template_id, payload)


# Alias antiguo: permite que pantallas previas sigan funcionando.
@router.post("/plantillas/enviar")
def asesor_send_template(payload: dict, asesor: dict = Depends(get_current_advisor)):
    return asesor_send_template_service(asesor, payload)


# =========================================================
# NOTIFICACIONES
# =========================================================

@router.get("/notificaciones")
def asesor_notifications(
    estado: str = Query("", description="todas, no_leidas, leidas"),
    tipo: str = Query("", description="SLA, SOLICITUD, CASO, ASIGNACION"),
    asesor: dict = Depends(get_current_advisor),
):
    filters = {
        "estado": estado,
        "tipo": tipo,
    }
    return asesor_notifications_service(asesor, filters)


# Endpoint nuevo.
@router.patch("/notificaciones/marcar-todas-leidas")
def asesor_mark_all_notifications_read_new(asesor: dict = Depends(get_current_advisor)):
    return asesor_mark_all_notifications_read_service(asesor)


# Alias antiguo.
@router.patch("/notificaciones/mark-all-read")
def asesor_mark_all_notifications_read_old(asesor: dict = Depends(get_current_advisor)):
    return asesor_mark_all_notifications_read_service(asesor)


# Endpoint nuevo.
@router.patch("/notificaciones/{notification_id}/leer")
def asesor_mark_notification_read_new(
    notification_id: int,
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_mark_notification_read_service(asesor, notification_id)


# Alias antiguo.
@router.patch("/notificaciones/{notification_id}/read")
def asesor_mark_notification_read_old(
    notification_id: int,
    asesor: dict = Depends(get_current_advisor)
):
    return asesor_mark_notification_read_service(asesor, notification_id)


# Endpoint nuevo: no elimina físicamente, solo limpia la vista.
@router.patch("/notificaciones/limpiar-leidas")
def asesor_clear_read_notifications_new(asesor: dict = Depends(get_current_advisor)):
    return asesor_clear_read_notifications_service(asesor)


# Alias antiguo: se mantiene para no romper frontend previo.
@router.delete("/notificaciones/read")
def asesor_clear_read_notifications_old(asesor: dict = Depends(get_current_advisor)):
    return asesor_clear_read_notifications_service(asesor)


# =========================================================
# RENDIMIENTO
# =========================================================

@router.get("/rendimiento")
def asesor_rendimiento(
    period: str | None = Query(None),
    periodo: str | None = Query(None),
    asesor=Depends(get_current_advisor)
):
    periodo_final = period or periodo or "semana"
    return asesor_performance_service(asesor, periodo_final)

# =========================================================
# EXPORTACIONES
# =========================================================

@router.get("/exportar/{reporte}")
def asesor_exportar(
    reporte: str,
    formato: str = Query("excel"),
    period: str | None = Query(None),
    periodo: str | None = Query(None),
    asesor=Depends(get_current_advisor)
):
    periodo_final = period or periodo or "semana"

    content, media_type, filename = asesor_export_service(
        asesor=asesor,
        reporte=reporte,
        formato=formato,
        periodo=periodo_final
    )

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


# =========================================================
# ASISTENTE
# =========================================================

@router.post("/asistente")
def asesor_assistant(payload: dict, asesor: dict = Depends(get_current_advisor)):
    return asesor_assistant_service(asesor, payload)





