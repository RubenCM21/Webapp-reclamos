from typing import List, Optional
from io import BytesIO

from fastapi import APIRouter, Depends, UploadFile, File, Form, Body, Query
from fastapi.responses import StreamingResponse

from app.utils.auth_dependency import get_current_client

from app.cliente.service import (
    cliente_me_service,
    cliente_dashboard_service,
    cliente_claim_catalogs_service,
    cliente_incident_catalogs_service,
    cliente_cases_service,
    cliente_cases_summary_service,
    cliente_case_detail_service,
    cliente_case_export_service,
    cliente_services_service,
    cliente_services_summary_service,
    cliente_service_detail_service,
    cliente_service_cases_service,
    cliente_services_diagnostic_service,
    cliente_services_export_service,
    cliente_notifications_service,
    cliente_notifications_summary_service,
    cliente_mark_all_notifications_read_service,
    cliente_mark_notification_read_service,
    cliente_hide_read_notifications_service,
    cliente_profile_service,
    cliente_update_profile_service,
    cliente_profile_security_service,
    cliente_profile_accesses_service,
    cliente_profile_preferences_service,
    cliente_create_claim_service,
    cliente_validate_claim_service,
    cliente_save_claim_draft_service,
    cliente_create_incident_service,
    cliente_incident_diagnostic_service,
    cliente_save_incident_draft_service,
    cliente_upload_case_evidence_service,
    cliente_send_advisor_response_service,
    cliente_submit_survey_service,
    cliente_case_certificate_service,
    cliente_share_case_service,
    cliente_search_service,
    cliente_assistant_service,
)


router = APIRouter(
    prefix="/cliente",
    tags=["Cliente"]
)


# =========================================================
# PERFIL BASE / DASHBOARD
# =========================================================

@router.get("/me")
def me(current_user: dict = Depends(get_current_client)):
    return cliente_me_service(current_user)


@router.get("/dashboard")
def dashboard(current_user: dict = Depends(get_current_client)):
    return cliente_dashboard_service(current_user)


# =========================================================
# CATÁLOGOS
# =========================================================

@router.get("/catalogos/reclamo")
@router.get("/reclamos/catalogos")
def catalogos_reclamo(current_user: dict = Depends(get_current_client)):
    return cliente_claim_catalogs_service(current_user)


@router.get("/catalogos/incidencia")
@router.get("/incidencias/catalogos")
def catalogos_incidencia(current_user: dict = Depends(get_current_client)):
    return cliente_incident_catalogs_service(current_user)


@router.get("/casos/catalogos")
def catalogos_casos(current_user: dict = Depends(get_current_client)):
    data = cliente_claim_catalogs_service(current_user)
    incident = cliente_incident_catalogs_service(current_user)

    data["sintomas"] = incident.get("sintomas", [])
    data["impactos"] = incident.get("impactos", [])
    data["urgencias"] = incident.get("urgencias", [])

    return data


# =========================================================
# CASOS
# =========================================================

@router.get("/casos/resumen")
def casos_resumen(current_user: dict = Depends(get_current_client)):
    return cliente_cases_summary_service(current_user)


@router.get("/casos")
def casos(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: str = "",
    tipo: str = "",
    estado: str = "",
    prioridad: str = "",
    fecha_desde: str = "",
    fecha_hasta: str = "",
    current_user: dict = Depends(get_current_client),
):
    return cliente_cases_service(
        current_user=current_user,
        page=page,
        page_size=page_size,
        q=q,
        tipo=tipo,
        estado=estado,
        prioridad=prioridad,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
    )


@router.post("/casos/exportar")
def exportar_casos(
    payload: dict = Body(default={}),
    current_user: dict = Depends(get_current_client),
):
    content, filename, media_type = cliente_case_export_service(current_user, payload)

    return StreamingResponse(
        BytesIO(content),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.get("/casos/{case_id}")
def caso_detalle(
    case_id: str,
    current_user: dict = Depends(get_current_client),
):
    return cliente_case_detail_service(current_user, case_id)


@router.post("/casos/{case_id}/evidencias")
async def subir_evidencias(
    case_id: str,
    files: Optional[List[UploadFile]] = File(None),
    evidence: Optional[List[UploadFile]] = File(None),
    current_user: dict = Depends(get_current_client),
):
    upload_files = []

    if files:
        upload_files.extend(files)

    if evidence:
        upload_files.extend(evidence)

    return await cliente_upload_case_evidence_service(
        current_user=current_user,
        case_id=case_id,
        files=upload_files,
    )


@router.post("/casos/{case_id}/respuestas")
@router.post("/casos/{case_id}/solicitudes/{request_id}/responder")
async def responder_asesor(
    case_id: str,
    request_id: Optional[int] = None,
    response: str = Form(""),
    respuesta: str = Form(""),
    files: Optional[List[UploadFile]] = File(None),
    evidence: Optional[List[UploadFile]] = File(None),
    current_user: dict = Depends(get_current_client),
):
    upload_files = []

    if files:
        upload_files.extend(files)

    if evidence:
        upload_files.extend(evidence)

    return await cliente_send_advisor_response_service(
        current_user=current_user,
        case_id=case_id,
        response=response or respuesta,
        files=upload_files,
        request_id=request_id,
    )


@router.post("/casos/{case_id}/encuesta")
def encuesta(
    case_id: str,
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_client),
):
    return cliente_submit_survey_service(current_user, case_id, payload)


@router.get("/casos/{case_id}/constancia")
def constancia(
    case_id: str,
    formato: str = "pdf",
    current_user: dict = Depends(get_current_client),
):
    file_bytes, filename, media_type = cliente_case_certificate_service(
        current_user=current_user,
        case_id=case_id,
        formato=formato,
    )

    return StreamingResponse(
        BytesIO(file_bytes),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.post("/casos/{case_id}/compartir")
def compartir_caso(
    case_id: str,
    payload: dict = Body(default={}),
    current_user: dict = Depends(get_current_client),
):
    return cliente_share_case_service(current_user, case_id, payload)


# =========================================================
# RECLAMOS / INCIDENCIAS
# =========================================================

@router.post("/reclamos/validar")
def validar_reclamo(
    payload: dict = Body(default={}),
    current_user: dict = Depends(get_current_client),
):
    return cliente_validate_claim_service(current_user, payload)


@router.post("/reclamos/borrador")
def guardar_borrador_reclamo(
    payload: dict = Body(default={}),
    current_user: dict = Depends(get_current_client),
):
    return cliente_save_claim_draft_service(current_user, payload)


@router.post("/reclamos")
async def registrar_reclamo(
    servicio_contratado_id: str = Form(""),
    servicio_id: str = Form(""),
    service: str = Form(""),
    categoria_id: str = Form(""),
    category: str = Form(""),
    motivo_id: str = Form(""),
    priority: str = Form(""),
    prioridad_id: str = Form(""),
    contact: str = Form(""),
    canal_contacto_preferido: str = Form(""),
    title: str = Form(""),
    titulo: str = Form(""),
    amount: str = Form(""),
    monto_reclamado: str = Form(""),
    event_date: str = Form(""),
    fecha_hecho: str = Form(""),
    description: str = Form(""),
    descripcion: str = Form(""),
    pretension_cliente: str = Form(""),
    solucion_esperada: str = Form(""),
    files: Optional[List[UploadFile]] = File(None),
    evidence: Optional[List[UploadFile]] = File(None),
    current_user: dict = Depends(get_current_client),
):
    upload_files = []

    if files:
        upload_files.extend(files)

    if evidence:
        upload_files.extend(evidence)

    payload = {
        "servicio_contratado_id": servicio_contratado_id or servicio_id or service,
        "categoria_id": categoria_id or category,
        "motivo_id": motivo_id,
        "prioridad_id": prioridad_id or priority,
        "canal_contacto_preferido": canal_contacto_preferido or contact,
        "titulo": titulo or title,
        "monto_reclamado": monto_reclamado or amount,
        "fecha_hecho": fecha_hecho or event_date,
        "descripcion": descripcion or description,
        "pretension_cliente": pretension_cliente or solucion_esperada,
    }

    return await cliente_create_claim_service(
        current_user=current_user,
        payload=payload,
        files=upload_files,
    )


@router.post("/incidencias/diagnostico")
def diagnostico_incidencia(
    payload: dict = Body(default={}),
    current_user: dict = Depends(get_current_client),
):
    return cliente_incident_diagnostic_service(current_user, payload)


@router.post("/incidencias/borrador")
def guardar_borrador_incidencia(
    payload: dict = Body(default={}),
    current_user: dict = Depends(get_current_client),
):
    return cliente_save_incident_draft_service(current_user, payload)


@router.post("/incidencias")
async def registrar_incidencia(
    servicio_contratado_id: str = Form(""),
    service: str = Form(""),
    sintoma_id: str = Form(""),
    symptom: str = Form(""),
    impact: str = Form(""),
    impacto_cliente: str = Form(""),
    urgency: str = Form(""),
    urgencia_cliente: str = Form(""),
    address: str = Form(""),
    ubicacion_referencial: str = Form(""),
    start_date: str = Form(""),
    fecha_hecho: str = Form(""),
    title: str = Form(""),
    titulo: str = Form(""),
    description: str = Form(""),
    descripcion: str = Form(""),
    files: Optional[List[UploadFile]] = File(None),
    evidence: Optional[List[UploadFile]] = File(None),
    current_user: dict = Depends(get_current_client),
):
    upload_files = []

    if files:
        upload_files.extend(files)

    if evidence:
        upload_files.extend(evidence)

    payload = {
        "servicio_contratado_id": servicio_contratado_id or service,
        "sintoma_id": sintoma_id or symptom,
        "impacto_cliente": impacto_cliente or impact,
        "urgencia_cliente": urgencia_cliente or urgency,
        "ubicacion_referencial": ubicacion_referencial or address,
        "fecha_hecho": fecha_hecho or start_date,
        "titulo": titulo or title,
        "descripcion": descripcion or description,
    }

    return await cliente_create_incident_service(
        current_user=current_user,
        payload=payload,
        files=upload_files,
    )


# =========================================================
# SERVICIOS CONTRATADOS
# =========================================================

@router.get("/servicios-contratados/resumen")
def servicios_resumen(current_user: dict = Depends(get_current_client)):
    return cliente_services_summary_service(current_user)


@router.get("/servicios-contratados/diagnostico")
@router.get("/servicios/diagnostico")
def diagnostico_servicios(current_user: dict = Depends(get_current_client)):
    return cliente_services_diagnostic_service(current_user)


@router.get("/servicios-contratados")
@router.get("/servicios")
def servicios(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str = "",
    tipo: str = "",
    estado: str = "",
    current_user: dict = Depends(get_current_client),
):
    return cliente_services_service(
        current_user=current_user,
        page=page,
        page_size=page_size,
        q=q,
        tipo=tipo,
        estado=estado,
    )


@router.post("/servicios-contratados/exportar")
def exportar_servicios(
    payload: dict = Body(default={}),
    current_user: dict = Depends(get_current_client),
):
    content, filename, media_type = cliente_services_export_service(current_user, payload)

    return StreamingResponse(
        BytesIO(content),
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.get("/servicios-contratados/{service_id}")
@router.get("/servicios/{service_id}")
def detalle_servicio(
    service_id: str,
    current_user: dict = Depends(get_current_client),
):
    return cliente_service_detail_service(current_user, service_id)


@router.get("/servicios-contratados/{service_id}/casos")
@router.get("/servicios/{service_id}/casos")
def casos_por_servicio(
    service_id: str,
    current_user: dict = Depends(get_current_client),
):
    return cliente_service_cases_service(current_user, service_id)


# =========================================================
# NOTIFICACIONES
# =========================================================

@router.get("/notificaciones/resumen")
def notificaciones_resumen(current_user: dict = Depends(get_current_client)):
    return cliente_notifications_summary_service(current_user)


@router.get("/notificaciones")
def notificaciones(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: dict = Depends(get_current_client),
):
    return cliente_notifications_service(
        current_user=current_user,
        page=page,
        page_size=page_size,
    )


@router.patch("/notificaciones/marcar-todas-leidas")
@router.patch("/notificaciones/mark-all-read")
def marcar_todas_leidas(current_user: dict = Depends(get_current_client)):
    return cliente_mark_all_notifications_read_service(current_user)


@router.patch("/notificaciones/ocultar-leidas")
@router.delete("/notificaciones/read")
def ocultar_leidas(current_user: dict = Depends(get_current_client)):
    return cliente_hide_read_notifications_service(current_user)


@router.patch("/notificaciones/{notification_id}/leer")
@router.patch("/notificaciones/{notification_id}/read")
def marcar_leida(
    notification_id: int,
    current_user: dict = Depends(get_current_client),
):
    return cliente_mark_notification_read_service(current_user, notification_id)


# =========================================================
# PERFIL
# =========================================================

@router.get("/perfil")
def perfil(current_user: dict = Depends(get_current_client)):
    return cliente_profile_service(current_user)


@router.put("/perfil")
def actualizar_perfil(
    payload: dict = Body(...),
    current_user: dict = Depends(get_current_client),
):
    return cliente_update_profile_service(current_user, payload)


@router.get("/perfil/seguridad")
def perfil_seguridad(current_user: dict = Depends(get_current_client)):
    return cliente_profile_security_service(current_user)


@router.get("/perfil/accesos")
def perfil_accesos(current_user: dict = Depends(get_current_client)):
    return cliente_profile_accesses_service(current_user)


@router.post("/perfil/preferencias")
def perfil_preferencias(
    payload: dict = Body(default={}),
    current_user: dict = Depends(get_current_client),
):
    return cliente_profile_preferences_service(current_user, payload)


# =========================================================
# BÚSQUEDA / ASISTENTE
# =========================================================

@router.get("/buscar")
@router.get("/search")
def search(
    q: str = "",
    current_user: dict = Depends(get_current_client),
):
    return cliente_search_service(current_user, q)


@router.post("/asistente")
def asistente(
    payload: dict = Body(default={}),
    current_user: dict = Depends(get_current_client),
):
    return cliente_assistant_service(current_user, payload)





