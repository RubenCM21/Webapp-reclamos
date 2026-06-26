from fastapi import APIRouter, Depends, Body, Query

from app.utils.auth_dependency import get_current_supervisor

from app.supervisor.service import (
    supervisor_me_service,
    supervisor_resumen_service,
    supervisor_catalogs_service,

    supervisor_dashboard_service,

    supervisor_cases_service,
    supervisor_pending_cases_service,
    supervisor_assignments_service,
    supervisor_sla_monitor_service,
    supervisor_case_detail_service,

    supervisor_classify_case_service,
    supervisor_change_priority_service,
    supervisor_observe_case_service,
    supervisor_send_assignment_service,
    supervisor_assign_case_service,
    supervisor_reassign_case_service,
    supervisor_derive_case_service,
    supervisor_escalate_case_service,

    supervisor_pending_bulk_action_service,

    supervisor_sla_follow_service,
    supervisor_sla_alert_service,
    supervisor_mass_sla_alert_preview_service,
    supervisor_mass_sla_alert_service,

    supervisor_advisors_service,
    supervisor_advisor_detail_service,
    supervisor_advisor_load_service,
    supervisor_update_advisor_availability_service,
    supervisor_bulk_advisor_availability_service,

    supervisor_mass_assignment_preview_service,
    supervisor_mass_assignment_apply_service,
    supervisor_redistribute_load_preview_service,
    supervisor_redistribute_load_apply_service,

    supervisor_indicators_service,
    supervisor_advisor_performance_service,
    supervisor_compare_indicators_service,

    supervisor_reports_service,
    supervisor_recent_reports_service,
    supervisor_report_preview_service,
    supervisor_generate_report_service,
    supervisor_schedule_report_service,
    supervisor_download_report_service,
    supervisor_export_service,

    supervisor_audit_service,
    supervisor_compare_audit_service,

    supervisor_config_service,
    supervisor_simulate_priority_service,
    supervisor_create_config_change_request_service,
    supervisor_config_change_requests_service,

    supervisor_search_service,
    supervisor_assistant_service,
)


router = APIRouter(
    prefix="/supervisor",
    tags=["Supervisor"]
)


# =========================================================
# SESIÓN / SHELL / CATÁLOGOS
# =========================================================

@router.get("/me")
def supervisor_me(
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_me_service(supervisor)


@router.get("/resumen")
def supervisor_resumen(
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_resumen_service(supervisor)


@router.get("/catalogos")
def supervisor_catalogs(
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_catalogs_service(supervisor)


# =========================================================
# DASHBOARD
# =========================================================

@router.get("/dashboard")
def supervisor_dashboard(
    periodo: str = Query("hoy"),
    area: str = Query("todos"),
    prioridad: str = Query("todos"),
    estado: str = Query("todos"),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_dashboard_service(
        supervisor=supervisor,
        periodo=periodo,
        area=area,
        prioridad=prioridad,
        estado=estado
    )


# =========================================================
# CASOS GENERALES
# =========================================================

@router.get("/casos")
def supervisor_cases(
    scope: str = Query("all"),
    q: str = Query(""),
    estado: str = Query("todos"),
    prioridad: str = Query("todos"),
    tipo: str = Query("todos"),
    asesor: str = Query("todos"),
    area: str = Query("todos"),
    canal: str = Query("todos"),
    tipo_cliente: str = Query("todos"),
    sla: str = Query("todos"),
    riesgo: str = Query("todos"),
    seguimiento: str = Query("todos"),
    fecha_desde: str = Query(""),
    fecha_hasta: str = Query(""),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_cases_service(
        supervisor=supervisor,
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


@router.get("/casos/{case_id}")
def supervisor_case_detail(
    case_id: str,
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_case_detail_service(supervisor, case_id)


# =========================================================
# CASOS PENDIENTES
# =========================================================

@router.get("/casos-pendientes")
def supervisor_pending_cases(
    filtro: str = Query("todos"),
    q: str = Query(""),
    estado: str = Query("todos"),
    prioridad: str = Query("todos"),
    tipo: str = Query("todos"),
    canal: str = Query("todos"),
    tipo_cliente: str = Query("todos"),
    sla: str = Query("todos"),
    fecha_desde: str = Query(""),
    fecha_hasta: str = Query(""),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_pending_cases_service(
        supervisor=supervisor,
        filtro=filtro,
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


@router.post("/casos-pendientes/accion-masiva")
def supervisor_pending_bulk_action(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_pending_bulk_action_service(supervisor, payload)


# =========================================================
# ACCIONES DE CASO
# =========================================================

@router.post("/casos/{case_id}/clasificar")
def supervisor_classify_case(
    case_id: str,
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_classify_case_service(supervisor, case_id, payload)


@router.post("/casos/{case_id}/prioridad")
def supervisor_change_priority(
    case_id: str,
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_change_priority_service(supervisor, case_id, payload)


@router.post("/casos/{case_id}/observar")
def supervisor_observe_case(
    case_id: str,
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_observe_case_service(supervisor, case_id, payload)


@router.post("/casos/{case_id}/enviar-asignacion")
def supervisor_send_assignment(
    case_id: str,
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_send_assignment_service(supervisor, case_id, payload)


@router.post("/casos/{case_id}/asignar")
def supervisor_assign_case(
    case_id: str,
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_assign_case_service(supervisor, case_id, payload)


@router.post("/casos/{case_id}/reasignar")
def supervisor_reassign_case(
    case_id: str,
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_reassign_case_service(supervisor, case_id, payload)


@router.post("/casos/{case_id}/derivar")
def supervisor_derive_case(
    case_id: str,
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_derive_case_service(supervisor, case_id, payload)


@router.post("/casos/{case_id}/escalar")
def supervisor_escalate_case(
    case_id: str,
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_escalate_case_service(supervisor, case_id, payload)


# =========================================================
# ASIGNACIONES
# =========================================================

@router.get("/asignaciones")
def supervisor_assignments(
    filtro: str = Query("todos"),
    q: str = Query(""),
    estado: str = Query("todos"),
    prioridad: str = Query("todos"),
    tipo: str = Query("todos"),
    asesor: str = Query("todos"),
    area: str = Query("todos"),
    sla: str = Query("todos"),
    fecha_desde: str = Query(""),
    fecha_hasta: str = Query(""),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_assignments_service(
        supervisor=supervisor,
        filtro=filtro,
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


@router.post("/asignaciones/masiva/preview")
def supervisor_mass_assignment_preview(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_mass_assignment_preview_service(supervisor, payload)


@router.post("/asignaciones/masiva")
def supervisor_mass_assignment_apply(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_mass_assignment_apply_service(supervisor, payload)


# =========================================================
# CARGA DE ASESORES
# =========================================================

@router.get("/asesores")
def supervisor_advisors(
    q: str = Query(""),
    area: str = Query("todos"),
    especialidad: str = Query("todos"),
    disponibilidad: str = Query("todos"),
    carga: str = Query("todos"),
    turno: str = Query("todos"),
    productividad: str = Query("todos"),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_advisors_service(
        supervisor=supervisor,
        q=q,
        area=area,
        especialidad=especialidad,
        disponibilidad=disponibilidad,
        carga=carga,
        turno=turno,
        productividad=productividad
    )


@router.get("/asesores/{advisor_id}")
def supervisor_advisor_detail(
    advisor_id: int,
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_advisor_detail_service(supervisor, advisor_id)


@router.get("/carga-asesores")
def supervisor_advisor_load(
    filtro: str = Query("todos"),
    q: str = Query(""),
    area: str = Query("todos"),
    especialidad: str = Query("todos"),
    disponibilidad: str = Query("todos"),
    carga: str = Query("todos"),
    turno: str = Query("todos"),
    productividad: str = Query("todos"),
    min_criticos: str = Query(""),
    min_sla: str = Query(""),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_advisor_load_service(
        supervisor=supervisor,
        filtro=filtro,
        q=q,
        area=area,
        especialidad=especialidad,
        disponibilidad=disponibilidad,
        carga=carga,
        turno=turno,
        productividad=productividad,
        min_criticos=min_criticos,
        min_sla=min_sla
    )


@router.patch("/asesores/{advisor_id}/disponibilidad")
def supervisor_update_advisor_availability(
    advisor_id: int,
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_update_advisor_availability_service(supervisor, advisor_id, payload)


@router.post("/asesores/disponibilidad-masiva")
def supervisor_bulk_advisor_availability(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_bulk_advisor_availability_service(supervisor, payload)


@router.post("/asesores/redistribuir/preview")
def supervisor_redistribute_load_preview(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_redistribute_load_preview_service(supervisor, payload)


@router.post("/asesores/redistribuir")
def supervisor_redistribute_load_apply(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_redistribute_load_apply_service(supervisor, payload)


# =========================================================
# MONITOREO SLA
# =========================================================

@router.get("/monitoreo-sla")
def supervisor_sla_monitor(
    filtro: str = Query("todos"),
    q: str = Query(""),
    estado: str = Query("todos"),
    prioridad: str = Query("todos"),
    tipo: str = Query("todos"),
    asesor: str = Query("todos"),
    area: str = Query("todos"),
    canal: str = Query("todos"),
    riesgo: str = Query("todos"),
    seguimiento: str = Query("todos"),
    fecha_desde: str = Query(""),
    fecha_hasta: str = Query(""),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_sla_monitor_service(
        supervisor=supervisor,
        filtro=filtro,
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


@router.post("/casos/{case_id}/seguimiento-sla")
def supervisor_sla_follow_case(
    case_id: str,
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    payload = {
        **payload,
        "caso_id": case_id,
        "case_id": case_id
    }

    return supervisor_sla_follow_service(supervisor, payload)


@router.post("/casos/{case_id}/alerta-sla")
def supervisor_sla_alert_case(
    case_id: str,
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    payload = {
        **payload,
        "caso_id": case_id,
        "case_id": case_id
    }

    return supervisor_sla_alert_service(supervisor, payload)


@router.post("/sla/alerta-masiva/preview")
def supervisor_mass_sla_alert_preview(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_mass_sla_alert_preview_service(supervisor, payload)


@router.post("/sla/alerta-masiva")
def supervisor_mass_sla_alert(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_mass_sla_alert_service(supervisor, payload)


@router.post("/sla/seguimiento")
def supervisor_sla_follow(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_sla_follow_service(supervisor, payload)


# =========================================================
# INDICADORES
# =========================================================

@router.get("/indicadores")
def supervisor_indicators(
    periodo: str = Query("semana"),
    asesor: str = Query("todos"),
    area: str = Query("todos"),
    tipo_caso: str = Query("todos"),
    canal: str = Query("todos"),
    prioridad: str = Query("todos"),
    estado: str = Query("todos"),
    grupo: str = Query("todos"),
    fecha_desde: str = Query(""),
    fecha_hasta: str = Query(""),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_indicators_service(
        supervisor=supervisor,
        periodo=periodo,
        asesor=asesor,
        area=area,
        tipo_caso=tipo_caso,
        canal=canal,
        prioridad=prioridad,
        estado=estado,
        grupo=grupo,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )


@router.get("/indicadores/desempeno-asesor/{advisor_id}")
def supervisor_advisor_performance(
    advisor_id: int,
    periodo: str = Query("semana"),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_advisor_performance_service(
        supervisor=supervisor,
        advisor_id=advisor_id,
        periodo=periodo
    )


@router.post("/indicadores/comparar")
def supervisor_compare_indicators(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_compare_indicators_service(supervisor, payload)


# =========================================================
# REPORTES
# =========================================================

@router.get("/reportes")
def supervisor_reports(
    q: str = Query(""),
    tipo: str = Query("todos"),
    periodo: str = Query("todos"),
    alcance: str = Query("todos"),
    estado: str = Query("todos"),
    fecha_desde: str = Query(""),
    fecha_hasta: str = Query(""),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_reports_service(
        supervisor=supervisor,
        q=q,
        tipo=tipo,
        periodo=periodo,
        alcance=alcance,
        estado=estado,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )


@router.get("/reportes/recientes")
def supervisor_recent_reports(
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_recent_reports_service(supervisor)


@router.post("/reportes/preview")
def supervisor_report_preview(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_report_preview_service(supervisor, payload)


@router.post("/reportes/generar")
def supervisor_generate_report(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_generate_report_service(supervisor, payload)


@router.post("/reportes/programar")
def supervisor_schedule_report(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_schedule_report_service(supervisor, payload)


@router.get("/reportes/{report_id}/descargar")
def supervisor_download_report(
    report_id: int,
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_download_report_service(supervisor, report_id)


# =========================================================
# EXPORTACIONES
# =========================================================

@router.post("/exportar/{module_name}")
def supervisor_export_module(
    module_name: str,
    payload: dict = Body(default={}),
    supervisor: dict = Depends(get_current_supervisor)
):
    payload = payload or {}
    payload = {
        **payload,
        "module": module_name,
        "modulo": module_name
    }

    return supervisor_export_service(
        supervisor=supervisor,
        module_name=module_name,
        payload=payload
    )


# =========================================================
# AUDITORÍA
# =========================================================

@router.get("/auditoria")
def supervisor_audit(
    q: str = Query(""),
    type: str = Query("todos"),
    usuario: str = Query("todos"),
    rol: str = Query("todos"),
    accion: str = Query("todos"),
    criticidad: str = Query("todos"),
    resultado: str = Query("todos"),
    modulo: str = Query("todos"),
    fecha_desde: str = Query(""),
    fecha_hasta: str = Query(""),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_audit_service(
        supervisor=supervisor,
        q=q,
        type=type,
        usuario=usuario,
        rol=rol,
        accion=accion,
        criticidad=criticidad,
        resultado=resultado,
        modulo=modulo,
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta
    )


@router.post("/auditoria/comparar")
def supervisor_compare_audit(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_compare_audit_service(supervisor, payload)


# =========================================================
# CONFIGURACIÓN DE SUPERVISIÓN
# =========================================================

@router.get("/configuracion")
def supervisor_config(
    q: str = Query(""),
    filtro: str = Query("todos"),
    categoria: str = Query("todos"),
    estado: str = Query("todos"),
    responsable: str = Query("todos"),
    impacto: str = Query("todos"),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_config_service(
        supervisor=supervisor,
        q=q,
        filtro=filtro,
        categoria=categoria,
        estado=estado,
        responsable=responsable,
        impacto=impacto
    )


@router.post("/configuracion/simular-prioridad")
def supervisor_simulate_priority(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_simulate_priority_service(supervisor, payload)


@router.post("/configuracion/solicitar-cambio")
def supervisor_create_config_change_request(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_create_config_change_request_service(supervisor, payload)


@router.get("/configuracion/solicitudes")
def supervisor_config_change_requests(
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_config_change_requests_service(supervisor)


# =========================================================
# BUSCADOR / ASISTENTE
# =========================================================

@router.get("/search")
def supervisor_search(
    q: str = Query(""),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_search_service(supervisor, q)


@router.post("/asistente")
def supervisor_assistant(
    payload: dict = Body(...),
    supervisor: dict = Depends(get_current_supervisor)
):
    return supervisor_assistant_service(supervisor, payload)