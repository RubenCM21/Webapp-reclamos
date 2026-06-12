"""
schemas.py — Schemas Pydantic para validación de requests y serialización de responses.

Convención de nombres:
  - XxxCreate  → payload para crear
  - XxxUpdate  → payload para actualizar
  - XxxResponse → lo que retorna la API
  - XxxFrontend → respuesta adaptada al formato que espera el frontend (Mock-compatible)
"""

from __future__ import annotations
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List, Any
from datetime import datetime, date


# ─────────────────────────────────────────────────────────────────────────────
# AUTH
# ─────────────────────────────────────────────────────────────────────────────

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    username: str
    role: str
    nombre_completo: str


class RegisterClienteCreate(BaseModel):
    account_type: str          # "persona" | "empresa"
    document_type: str         # "DNI" | "RUC" | "CE"
    document_number: str
    names: Optional[str] = None
    last_names: Optional[str] = None
    company_name: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    address: Optional[str] = None
    password: str
    service: Optional[str] = None   # Servicio de interés inicial

    @field_validator("document_number")
    @classmethod
    def validate_doc(cls, v, info):
        v = v.strip()
        data = info.data
        dtype = data.get("document_type", "")
        atype = data.get("account_type", "persona")
        if dtype == "DNI" and len(v) != 8:
            raise ValueError("El DNI debe tener 8 dígitos.")
        if atype == "empresa" and dtype == "RUC" and len(v) != 11:
            raise ValueError("El RUC debe tener 11 dígitos.")
        return v


class VerifyAccountRequest(BaseModel):
    code: str
    correo: Optional[str] = None   # Si no viene en token, se envía explícito


class ResendCodeRequest(BaseModel):
    correo: str


class RecuperarPasswordRequest(BaseModel):
    correo: EmailStr


class RestablecerPasswordRequest(BaseModel):
    token: str
    nueva_password: str


class ChangePasswordRequest(BaseModel):
    password_actual: str
    password_nueva: str


class MeResponse(BaseModel):
    user_id: int
    username: str
    correo: str
    role: str
    nombre_completo: str
    area: Optional[str] = None
    estado: str
    ultimo_acceso: Optional[str] = None

    model_config = {"from_attributes": True}


# ─────────────────────────────────────────────────────────────────────────────
# CLIENTES
# ─────────────────────────────────────────────────────────────────────────────

class ClienteUpdateRequest(BaseModel):
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    razon_social: Optional[str] = None
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    correo: Optional[EmailStr] = None


class ClientePerfilResponse(BaseModel):
    cliente_id: int
    tipo_cliente: str
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    razon_social: Optional[str] = None
    documento_tipo: str
    documento_numero: str
    correo: str
    telefono: Optional[str] = None
    direccion: Optional[str] = None
    # Campos compatibles con Mock.user
    name: str = ""
    initials: str = ""
    type_label: str = ""
    segment: str = ""
    document: str = ""
    email: str = ""
    phone: str = ""
    address: str = ""

    model_config = {"from_attributes": True}


class ServicioContratadoFrontend(BaseModel):
    id: int
    icon: str
    code: str
    name: str
    type: str
    plan: str
    description: str
    status: str
    statusType: str
    location: str
    cases: int
    last: str
    recommendation: str


class CasoClienteFrontend(BaseModel):
    id: int
    code: str
    type: str
    icon: str
    title: str
    description: str
    service: str
    status: str
    statusType: str
    priority: str
    priorityValue: int
    date: str
    sla: str
    slaHours: float
    advisor: str
    channel: str
    action: str
    progress: int


# ─────────────────────────────────────────────────────────────────────────────
# CASOS
# ─────────────────────────────────────────────────────────────────────────────

class CasoCreateRequest(BaseModel):
    servicio_contratado_id: Optional[int] = None
    tipo_caso_id: int
    categoria_id: int
    canal_ingreso_id: int
    prioridad_id: int
    titulo: str
    descripcion: str


class CasoUpdateRequest(BaseModel):
    estado_caso_id: Optional[int] = None
    prioridad_id: Optional[int] = None
    solucion_final: Optional[str] = None
    area_actual_id: Optional[int] = None
    pendiente_cliente: Optional[bool] = None


class CasoCerrarRequest(BaseModel):
    solucion_final: str
    observacion: Optional[str] = None


class HistorialCreateRequest(BaseModel):
    accion: str
    observacion: Optional[str] = None
    es_visible_cliente: bool = True
    nuevo_estado_id: Optional[int] = None


class AsignarCasoRequest(BaseModel):
    usuario_destino_id: Optional[int] = None
    area_destino_id: Optional[int] = None
    tipo_movimiento: str = "ASIGNACION"   # ASIGNACION|REASIGNACION|DERIVACION|ESCALAMIENTO
    motivo: Optional[str] = None


class CasoStaffFrontend(BaseModel):
    id: int          # caso_id
    code: str
    icon: str
    type: str
    clientType: str
    clientName: str
    document: str
    title: str
    description: str
    reason: str
    service: str
    channel: str
    priority: str
    status: str
    queueStatus: str
    slaHours: float
    slaText: str
    slaGroup: str
    createdAt: str
    updatedAt: str
    assignedTo: str
    action: str
    area: str
    evidence: List[dict] = []
    history: List[dict] = []


class HistorialItemFrontend(BaseModel):
    icon: str
    title: str
    text: str
    date: str
    visible_cliente: bool = True


class EvidenciaResponse(BaseModel):
    evidencia_id: int
    icon: str
    name: str
    detail: str
    tipo_mime: Optional[str] = None
    fecha_carga: str


# ─────────────────────────────────────────────────────────────────────────────
# NOTIFICACIONES
# ─────────────────────────────────────────────────────────────────────────────

class NotificacionFrontend(BaseModel):
    id: int
    icon: str
    title: str
    message: str
    type: str
    priority: str
    case: Optional[str] = None
    date: str
    read: bool
    action: str
    unread: bool   # Alias inverso de read (compatibilidad asesor/supervisor)


# ─────────────────────────────────────────────────────────────────────────────
# ASESOR
# ─────────────────────────────────────────────────────────────────────────────

class RendimientoResponse(BaseModel):
    kpis: List[List[Any]]
    chart: List[List[Any]]
    table: List[List[Any]]


class PlantillaResponse(BaseModel):
    id: str
    icon: str
    category: str
    title: str
    channel: str
    description: str
    body: str


# ─────────────────────────────────────────────────────────────────────────────
# SUPERVISOR
# ─────────────────────────────────────────────────────────────────────────────

class AsesorCargaItem(BaseModel):
    id: str
    name: str
    initials: str
    specialty: str
    status: str
    cases: int
    critical: int
    slaRisk: int
    productivity: int
    capacity: int


class IndicadoresResponse(BaseModel):
    kpis: List[List[Any]]
    estados: List[dict]
    prioridades: List[dict]
    tendencia: List[List[Any]]


class SlaMonitoreoItem(BaseModel):
    id: int
    code: str
    title: str
    clientName: str
    priority: str
    slaHours: float
    slaText: str
    riskLevel: str
    assignedTo: str
    status: str


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN — Usuarios
# ─────────────────────────────────────────────────────────────────────────────

class UsuarioCreateRequest(BaseModel):
    rol_id: int
    area_id: Optional[int] = None
    username: str
    correo: EmailStr
    password: str
    nombres: str
    apellidos: str
    documento_tipo: str = "DNI"
    documento_numero: str
    telefono: Optional[str] = None
    cargo: Optional[str] = None


class UsuarioUpdateRequest(BaseModel):
    rol_id: Optional[int] = None
    area_id: Optional[int] = None
    username: Optional[str] = None
    correo: Optional[EmailStr] = None
    nombres: Optional[str] = None
    apellidos: Optional[str] = None
    telefono: Optional[str] = None
    cargo: Optional[str] = None


class UsuarioEstadoRequest(BaseModel):
    estado: str   # ACTIVO | INACTIVO | BLOQUEADO


class UsuarioFrontend(BaseModel):
    id: int
    initials: str
    name: str
    email: str
    role: str
    area: str
    status: str
    accessType: str
    lastAccess: str
    createdAt: str
    risk: str
    activity: int


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN — Catálogos
# ─────────────────────────────────────────────────────────────────────────────

class CatalogoItemCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    activo: bool = True
    # Campos opcionales según catálogo
    tipo_caso_id: Optional[int] = None   # Para categorias
    nivel: Optional[int] = None          # Para prioridades
    tiempo_objetivo_horas: Optional[int] = None
    es_final: Optional[bool] = None      # Para estados_caso
    visible_cliente: Optional[bool] = None
    orden: Optional[int] = None


class CatalogoItemUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    activo: Optional[bool] = None
    tipo_caso_id: Optional[int] = None
    nivel: Optional[int] = None
    tiempo_objetivo_horas: Optional[int] = None
    es_final: Optional[bool] = None
    visible_cliente: Optional[bool] = None
    orden: Optional[int] = None


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN — SLA
# ─────────────────────────────────────────────────────────────────────────────

class SlaCreateRequest(BaseModel):
    nombre: str
    tipo_caso_id: Optional[int] = None
    categoria_id: Optional[int] = None
    prioridad_id: Optional[int] = None
    servicio_id: Optional[int] = None
    tiempo_primera_respuesta_horas: int
    tiempo_resolucion_horas: int
    activo: bool = True


class SlaUpdateRequest(BaseModel):
    nombre: Optional[str] = None
    tipo_caso_id: Optional[int] = None
    categoria_id: Optional[int] = None
    prioridad_id: Optional[int] = None
    servicio_id: Optional[int] = None
    tiempo_primera_respuesta_horas: Optional[int] = None
    tiempo_resolucion_horas: Optional[int] = None
    activo: Optional[bool] = None


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN — Roles/Permisos
# ─────────────────────────────────────────────────────────────────────────────

class AsignarPermisosRequest(BaseModel):
    permiso_ids: List[int]


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN — Reportes
# ─────────────────────────────────────────────────────────────────────────────

class ReporteCreateRequest(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    formato: str = "PDF"
    filtros_json: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN — Configuración del sistema
# ─────────────────────────────────────────────────────────────────────────────

class ConfiguracionUpdate(BaseModel):
    clave: str
    valor: Any


# ─────────────────────────────────────────────────────────────────────────────
# PÚBLICO
# ─────────────────────────────────────────────────────────────────────────────

class ConsultaPublicaRequest(BaseModel):
    codigo_caso: str
    documento_numero: str


class ConsultaPublicaResponse(BaseModel):
    found: bool
    code: Optional[str] = None
    type: Optional[str] = None
    title: Optional[str] = None
    status: Optional[str] = None
    lastUpdate: Optional[str] = None
    assignedArea: Optional[str] = None
    channel: Optional[str] = None
    created: Optional[str] = None


# ─────────────────────────────────────────────────────────────────────────────
# PAGINACIÓN GENÉRICA
# ─────────────────────────────────────────────────────────────────────────────

class PaginatedResponse(BaseModel):
    items: List[Any]
    total: int
    page: int
    limit: int
    pages: int
