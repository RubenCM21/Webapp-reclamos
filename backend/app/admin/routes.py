from __future__ import annotations
from fastapi.responses import FileResponse

import inspect
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, Path, Query

from app.admin.service import (
    admin_me_service,
    admin_resumen_service,
    admin_dashboard_service,
    admin_users_service,
    admin_create_user_service,
    admin_update_user_service,
    admin_change_user_status_service,
    admin_reset_user_access_service,
    admin_bulk_user_action_service,
    admin_roles_permissions_service,
    admin_create_role_service,
    admin_update_role_service,
    admin_save_permission_matrix_service,
    admin_catalogs_service,
    admin_create_catalog_item_service,
    admin_update_catalog_item_service,
    admin_change_catalog_status_service,
    admin_sla_rules_service,
    admin_create_sla_rule_service,
    admin_update_sla_rule_service,
    admin_duplicate_sla_rule_service,
    admin_indicators_reports_service,
    admin_generate_report_service,
    admin_schedule_report_service,
    admin_integrations_service,
    admin_create_integration_service,
    admin_update_integration_service,
    admin_test_integration_service,
    admin_test_all_integrations_service,
    admin_integration_logs_service,
    admin_audit_service,
    admin_compare_audit_service,
    admin_backup_service,
    admin_run_backup_service,
    admin_validate_backup_service,
    admin_schedule_backup_service,
    admin_restore_test_service,
    admin_system_config_service,
    admin_update_system_config_service,
    admin_restore_system_config_service,
    admin_search_service,
    admin_assistant_service,
    admin_review_alert_service,
    admin_get_report_download_service,
)
from app.utils.auth_dependency import get_current_admin


router = APIRouter(
    prefix="/admin",
    tags=["Administrador"],
)

JsonDict = Dict[str, Any]


# =========================================================
# HELPERS DE COMPATIBILIDAD
# =========================================================

def clean_payload(payload: Optional[JsonDict]) -> JsonDict:
    """
    Evita errores cuando el frontend ejecuta POST/PATCH sin body.
    """
    return payload if isinstance(payload, dict) else {}


def call_service(service_fn, *args, **kwargs):
    """
    Permite evolucionar service.py sin romper routes.py.

    Si el service actual no acepta algunos filtros/payloads, se ignoran.
    Cuando actualicemos service.py, las mismas rutas ya podrán enviarlos.
    """
    signature = inspect.signature(service_fn)
    accepted_kwargs = {
        key: value
        for key, value in kwargs.items()
        if key in signature.parameters
    }

    return service_fn(*args, **accepted_kwargs)


# =========================================================
# SHELL / SESIÓN ADMIN
# =========================================================

@router.get("/me")
def admin_me(admin: dict = Depends(get_current_admin)):
    return admin_me_service(admin)


@router.get("/resumen")
def admin_resumen(admin: dict = Depends(get_current_admin)):
    return admin_resumen_service(admin)


@router.get("/dashboard")
def admin_dashboard(
    periodo: str = Query("semana", description="Periodo de consulta del dashboard."),
    modulo: str = Query("todos", description="Módulo administrativo."),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_dashboard_service,
        admin,
        periodo=periodo,
        modulo=modulo,
    )


# =========================================================
# USUARIOS
# =========================================================

@router.get("/usuarios")
def admin_users(
    q: str = Query("", description="Búsqueda por nombre, correo, usuario, rol o área."),
    rol: str = Query("todos", description="Filtro por rol."),
    estado: str = Query("todos", description="Filtro por estado."),
    area: str = Query("todos", description="Filtro por área."),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_users_service,
        admin,
        q=q,
        rol=rol,
        estado=estado,
        area=area,
        page=page,
        page_size=page_size,
    )


@router.post("/usuarios", status_code=201)
def admin_create_user(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_create_user_service(admin, payload)


@router.put("/usuarios/{user_id}")
def admin_update_user(
    user_id: int = Path(..., ge=1),
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_update_user_service(admin, user_id, payload)


@router.patch("/usuarios/{user_id}/estado")
def admin_change_user_status(
    user_id: int = Path(..., ge=1),
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_change_user_status_service(admin, user_id, payload)


@router.post("/usuarios/{user_id}/reset-acceso")
def admin_reset_user_access(
    user_id: int = Path(..., ge=1),
    payload: Optional[JsonDict] = Body(default=None),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_reset_user_access_service,
        admin,
        user_id,
        payload=clean_payload(payload),
    )


@router.post("/usuarios/accion-masiva")
def admin_bulk_user_action(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_bulk_user_action_service(admin, payload)


# =========================================================
# ROLES Y PERMISOS
# =========================================================

@router.get("/roles-permisos")
def admin_roles_permissions(
    q: str = Query("", description="Búsqueda por rol, permiso o módulo."),
    filtro: str = Query("todos", description="Filtro de permisos."),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_roles_permissions_service,
        admin,
        q=q,
        filtro=filtro,
    )


@router.post("/roles", status_code=201)
def admin_create_role(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_create_role_service(admin, payload)


@router.put("/roles/{role_id}")
def admin_update_role(
    role_id: int = Path(..., ge=1),
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_update_role_service(admin, role_id, payload)


@router.put("/roles-permisos/matriz")
def admin_save_permission_matrix(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_save_permission_matrix_service(admin, payload)


# =========================================================
# CATÁLOGOS
# =========================================================

@router.get("/catalogos")
def admin_catalogs(
    q: str = Query("", description="Búsqueda por catálogo."),
    tipo: str = Query("todos", description="Tipo de catálogo."),
    estado: str = Query("todos", description="Estado del catálogo."),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_catalogs_service,
        admin,
        q=q,
        tipo=tipo,
        estado=estado,
    )


@router.post("/catalogos", status_code=201)
def admin_create_catalog_item(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_create_catalog_item_service(admin, payload)


@router.put("/catalogos/{catalog_id}")
def admin_update_catalog_item(
    catalog_id: str,
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_update_catalog_item_service(admin, catalog_id, payload)


@router.patch("/catalogos/{catalog_id}/estado")
def admin_change_catalog_status(
    catalog_id: str,
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_change_catalog_status_service(admin, catalog_id, payload)


# =========================================================
# REGLAS SLA
# =========================================================

@router.get("/reglas-sla")
def admin_sla_rules(
    q: str = Query("", description="Búsqueda por regla SLA."),
    prioridad: str = Query("todos", description="Filtro por prioridad."),
    estado: str = Query("todos", description="Filtro por estado."),
    canal: str = Query("todos", description="Filtro por canal."),
    tipo_caso: str = Query("todos", description="Filtro por tipo de caso."),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_sla_rules_service,
        admin,
        q=q,
        prioridad=prioridad,
        estado=estado,
        canal=canal,
        tipo_caso=tipo_caso,
    )


@router.post("/reglas-sla", status_code=201)
def admin_create_sla_rule(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_create_sla_rule_service(admin, payload)


@router.put("/reglas-sla/{rule_id}")
def admin_update_sla_rule(
    rule_id: int = Path(..., ge=1),
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_update_sla_rule_service(admin, rule_id, payload)


@router.post("/reglas-sla/{rule_id}/duplicar")
def admin_duplicate_sla_rule(
    rule_id: int = Path(..., ge=1),
    payload: Optional[JsonDict] = Body(default=None),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_duplicate_sla_rule_service,
        admin,
        rule_id,
        payload=clean_payload(payload),
    )


# =========================================================
# INDICADORES Y REPORTES
# =========================================================

@router.get("/indicadores-reportes")
def admin_indicators_reports(
    period: str = Query("semana", description="Periodo usado por el frontend."),
    periodo: Optional[str] = Query(None, description="Alias de period."),
    module: str = Query("todos", description="Módulo usado por el frontend."),
    modulo: Optional[str] = Query(None, description="Alias de module."),
    role: str = Query("todos", description="Rol usado por el frontend."),
    rol: Optional[str] = Query(None, description="Alias de role."),
    channel: str = Query("todos", description="Canal usado por el frontend."),
    canal: Optional[str] = Query(None, description="Alias de channel."),
    admin: dict = Depends(get_current_admin),
):
    return admin_indicators_reports_service(
        admin,
        periodo or period,
        modulo or module,
        rol or role,
        canal or channel,
    )


@router.post("/reportes/generar")
def admin_generate_report(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_generate_report_service(admin, payload)

@router.get("/reportes/{reporte_id}/descargar")
def admin_download_report(
    reporte_id: int = Path(..., ge=1),
    admin: dict = Depends(get_current_admin),
):
    file_data = admin_get_report_download_service(admin, reporte_id)

    return FileResponse(
        path=file_data["path"],
        filename=file_data["filename"],
        media_type=file_data["media_type"]
    )

@router.post("/reportes/programar")
def admin_schedule_report(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_schedule_report_service(admin, payload)


# =========================================================
# INTEGRACIONES
# =========================================================

@router.get("/integraciones")
def admin_integrations(
    q: str = Query("", description="Búsqueda por integración."),
    tipo: str = Query("todos", description="Filtro por tipo."),
    estado: str = Query("todos", description="Filtro por estado."),
    criticidad: str = Query("todos", description="Filtro por criticidad."),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_integrations_service,
        admin,
        q=q,
        tipo=tipo,
        estado=estado,
        criticidad=criticidad,
    )


@router.post("/integraciones", status_code=201)
def admin_create_integration(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_create_integration_service(admin, payload)


@router.put("/integraciones/{integration_id}")
def admin_update_integration(
    integration_id: int = Path(..., ge=1),
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_update_integration_service(admin, integration_id, payload)


@router.post("/integraciones/{integration_id}/probar")
def admin_test_integration(
    integration_id: int = Path(..., ge=1),
    payload: Optional[JsonDict] = Body(default=None),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_test_integration_service,
        admin,
        integration_id,
        payload=clean_payload(payload),
    )


@router.post("/integraciones/probar-todas")
def admin_test_all_integrations(
    payload: Optional[JsonDict] = Body(default=None),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_test_all_integrations_service,
        admin,
        payload=clean_payload(payload),
    )


@router.get("/integraciones/{integration_id}/logs")
def admin_integration_logs(
    integration_id: int = Path(..., ge=1),
    limit: int = Query(50, ge=1, le=500),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_integration_logs_service,
        admin,
        integration_id,
        limit=limit,
    )


# =========================================================
# AUDITORÍA
# =========================================================

@router.get("/auditoria")
def admin_audit(
    q: str = Query("", description="Búsqueda por evento."),
    modulo: str = Query("todos", description="Filtro por módulo."),
    criticidad: str = Query("todos", description="Filtro por criticidad."),
    resultado: str = Query("todos", description="Filtro por resultado."),
    fecha_inicio: Optional[str] = Query(None),
    fecha_fin: Optional[str] = Query(None),
    limit: int = Query(150, ge=1, le=1000),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_audit_service,
        admin,
        q=q,
        modulo=modulo,
        criticidad=criticidad,
        resultado=resultado,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        limit=limit,
    )


@router.post("/auditoria/comparar")
def admin_compare_audit(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_compare_audit_service(admin, payload)


# =========================================================
# RESPALDO
# =========================================================

@router.get("/respaldo")
def admin_backup(
    q: str = Query("", description="Búsqueda por respaldo."),
    estado: str = Query("todos", description="Filtro por estado."),
    tipo: str = Query("todos", description="Filtro por tipo."),
    validacion: str = Query("todos", description="Filtro por validación."),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_backup_service,
        admin,
        q=q,
        estado=estado,
        tipo=tipo,
        validacion=validacion,
    )


@router.post("/respaldo/ejecutar")
def admin_run_backup(
    payload: Optional[JsonDict] = Body(default=None),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_run_backup_service,
        admin,
        payload=clean_payload(payload),
    )


@router.post("/respaldo/{backup_id}/validar")
def admin_validate_backup(
    backup_id: int = Path(..., ge=1),
    payload: Optional[JsonDict] = Body(default=None),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_validate_backup_service,
        admin,
        backup_id,
        payload=clean_payload(payload),
    )


@router.post("/respaldo/programar")
def admin_schedule_backup(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_schedule_backup_service(admin, payload)


@router.post("/respaldo/prueba-restauracion")
def admin_restore_test(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_restore_test_service(admin, payload)


# =========================================================
# CONFIGURACIÓN DEL SISTEMA
# =========================================================

@router.get("/configuracion-sistema")
def admin_system_config(admin: dict = Depends(get_current_admin)):
    return admin_system_config_service(admin)


@router.put("/configuracion-sistema")
def admin_update_system_config(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_update_system_config_service(admin, payload)


@router.post("/configuracion-sistema/restaurar")
def admin_restore_system_config(
    payload: Optional[JsonDict] = Body(default=None),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_restore_system_config_service,
        admin,
        payload=clean_payload(payload),
    )


# =========================================================
# BÚSQUEDA GLOBAL / ASISTENTE
# =========================================================

@router.get("/search")
def admin_search(
    q: str = Query("", description="Texto de búsqueda global."),
    admin: dict = Depends(get_current_admin),
):
    return admin_search_service(admin, q)


@router.post("/asistente")
def admin_assistant(
    payload: JsonDict = Body(...),
    admin: dict = Depends(get_current_admin),
):
    return admin_assistant_service(admin, payload)


# =========================================================
# ALERTAS
# =========================================================

@router.patch("/alertas/{alert_id}/revisar")
def admin_review_alert(
    alert_id: int = Path(..., ge=1),
    payload: Optional[JsonDict] = Body(default=None),
    admin: dict = Depends(get_current_admin),
):
    return call_service(
        admin_review_alert_service,
        admin,
        alert_id,
        payload=clean_payload(payload),
    )