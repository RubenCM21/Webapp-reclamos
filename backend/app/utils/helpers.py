import re
import uuid


ROLE_MAP = {
    "cliente-persona": "CLIENTE",
    "cliente-empresa": "CLIENTE",
    "asesor": "ASESOR",
    "supervisor": "SUPERVISOR",
    "admin": "ADMINISTRADOR",
}

CLIENT_TYPE_MAP = {
    "cliente-persona": "PERSONA",
    "cliente-empresa": "EMPRESA",
    "persona": "PERSONA",
    "empresa": "EMPRESA",
}

SERVICE_MAP = {
    "movil": "Móvil Postpago",
    "hogar": "Internet Hogar",
    "tv": "Claro TV",
    "empresa": "Servicios Empresas",
}


def normalize_text(value: str | None) -> str:
    return str(value or "").strip()


def normalize_email(value: str | None) -> str:
    return normalize_text(value).lower()


def generate_username_from_email(email: str) -> str:
    prefix = email.split("@")[0]
    username = re.sub(r"[^a-zA-Z0-9_.]", "", prefix).lower()

    if not username:
        username = f"user_{uuid.uuid4().hex[:8]}"

    return username


def map_selected_role(selected_role: str) -> str | None:
    return ROLE_MAP.get(selected_role)


def map_client_type(value: str) -> str | None:
    return CLIENT_TYPE_MAP.get(value)


def map_service_name(service_type: str) -> str:
    return SERVICE_MAP.get(service_type, "Móvil Postpago")


def build_redirect_url(role: str, tipo_cliente: str | None = None) -> str:
    if role == "CLIENTE":
        return "cliente/dashboard.html"

    if role == "ASESOR":
        return "asesor/dashboard.html"

    if role == "SUPERVISOR":
        return "supervisor/dashboard.html"

    if role == "ADMINISTRADOR":
        return "admin/dashboard.html"

    return "login.html"