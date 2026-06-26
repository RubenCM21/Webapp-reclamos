from fastapi import APIRouter

from app.public.service import (
    public_home_service,
    public_lookup_case_service,
    public_service_status_service,
    public_service_diagnostic_service,
    public_help_center_service,
    public_help_diagnostic_service,
    public_search_service,
    public_assistant_service,
)


router = APIRouter(prefix="/public", tags=["Público"])


@router.get("/home")
def public_home(segment: str = "personas"):
    return public_home_service(segment)


@router.get("/consulta-caso/{codigo_caso}")
def public_lookup_case(codigo_caso: str):
    return public_lookup_case_service(codigo_caso)


@router.get("/estado-servicios")
def public_service_status(
    segment: str = "personas",
    district: str = "todos",
    service_type: str = "todos"
):
    return public_service_status_service(segment, district, service_type)


@router.post("/estado-servicios/diagnostico")
def public_service_diagnostic(payload: dict):
    return public_service_diagnostic_service(payload)


@router.get("/centro-ayuda")
def public_help_center(
    segment: str = "personas",
    q: str = "",
    category: str = "todos"
):
    return public_help_center_service(segment, q, category)


@router.post("/centro-ayuda/diagnostico")
def public_help_diagnostic(payload: dict):
    return public_help_diagnostic_service(payload)


@router.get("/search")
def public_search(q: str = ""):
    return public_search_service(q)


@router.post("/asistente")
def public_assistant(payload: dict):
    return public_assistant_service(payload)