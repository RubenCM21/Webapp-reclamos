"""
models.py — Modelos SQLAlchemy que reflejan exactamente el schema SQL Server
creado en ClaroAtencion360.sql
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, BigInteger,
    ForeignKey, Text, UniqueConstraint, CheckConstraint, Date
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


# ─────────────────────────────────────────────────────────────────────────────
# SEGURIDAD Y ADMINISTRACIÓN
# ─────────────────────────────────────────────────────────────────────────────

class Rol(Base):
    __tablename__ = "roles"

    rol_id        = Column(Integer, primary_key=True, autoincrement=True)
    nombre        = Column(String(50), unique=True, nullable=False)
    descripcion   = Column(String(200))
    activo        = Column(Boolean, default=True, nullable=False)
    fecha_creacion = Column(DateTime, server_default=func.sysdatetime(), nullable=False)

    usuarios      = relationship("Usuario", back_populates="rol")
    permisos      = relationship("RolPermiso", back_populates="rol")


class Permiso(Base):
    __tablename__ = "permisos"

    permiso_id    = Column(Integer, primary_key=True, autoincrement=True)
    nombre        = Column(String(100), unique=True, nullable=False)
    descripcion   = Column(String(250))
    modulo        = Column(String(100))
    activo        = Column(Boolean, default=True, nullable=False)

    roles         = relationship("RolPermiso", back_populates="permiso")


class RolPermiso(Base):
    __tablename__ = "roles_permisos"
    __table_args__ = (UniqueConstraint("rol_id", "permiso_id"),)

    rol_permiso_id = Column(Integer, primary_key=True, autoincrement=True)
    rol_id         = Column(Integer, ForeignKey("roles.rol_id"), nullable=False)
    permiso_id     = Column(Integer, ForeignKey("permisos.permiso_id"), nullable=False)

    rol            = relationship("Rol", back_populates="permisos")
    permiso        = relationship("Permiso", back_populates="roles")


class Area(Base):
    __tablename__ = "areas"

    area_id       = Column(Integer, primary_key=True, autoincrement=True)
    nombre        = Column(String(100), unique=True, nullable=False)
    descripcion   = Column(String(250))
    activo        = Column(Boolean, default=True, nullable=False)
    fecha_creacion = Column(DateTime, server_default=func.sysdatetime(), nullable=False)

    usuarios      = relationship("Usuario", back_populates="area")
    personal      = relationship("Personal", back_populates="area")
    casos_area    = relationship("Caso", foreign_keys="[Caso.area_actual_id]", back_populates="area_actual")


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (
        CheckConstraint("estado IN ('ACTIVO','INACTIVO','BLOQUEADO')", name="CK_usuarios_estado"),
    )

    usuario_id            = Column(Integer, primary_key=True, autoincrement=True)
    rol_id                = Column(Integer, ForeignKey("roles.rol_id"), nullable=False)
    area_id               = Column(Integer, ForeignKey("areas.area_id"))
    username              = Column(String(50), unique=True, nullable=False)
    correo                = Column(String(150), unique=True, nullable=False)
    password_hash         = Column(String(255), nullable=False)
    estado                = Column(String(20), default="ACTIVO", nullable=False)
    ultimo_acceso         = Column(DateTime)
    fecha_creacion        = Column(DateTime, server_default=func.sysdatetime(), nullable=False)
    fecha_actualizacion   = Column(DateTime)

    rol                   = relationship("Rol", back_populates="usuarios")
    area                  = relationship("Area", back_populates="usuarios")
    personal              = relationship("Personal", back_populates="usuario", uselist=False)
    cliente               = relationship("Cliente", back_populates="usuario", uselist=False)
    sesiones              = relationship("SesionUsuario", back_populates="usuario")
    notificaciones        = relationship("Notificacion", back_populates="usuario")
    auditorias            = relationship("Auditoria", back_populates="usuario")
    reportes_generados    = relationship("Reporte", back_populates="generado_por")
    historial_registrado  = relationship("HistorialCaso", back_populates="usuario")
    casos_creados         = relationship("Caso", foreign_keys="[Caso.creado_por_usuario_id]", back_populates="creado_por")
    casos_cerrados        = relationship("Caso", foreign_keys="[Caso.cerrado_por_usuario_id]", back_populates="cerrado_por")
    casos_responsable     = relationship("Caso", foreign_keys="[Caso.responsable_actual_usuario_id]", back_populates="responsable_actual")
    asignaciones_origen   = relationship("AsignacionCaso", foreign_keys="[AsignacionCaso.usuario_origen_id]", back_populates="usuario_origen")
    asignaciones_destino  = relationship("AsignacionCaso", foreign_keys="[AsignacionCaso.usuario_destino_id]", back_populates="usuario_destino")
    asignaciones_hechas   = relationship("AsignacionCaso", foreign_keys="[AsignacionCaso.asignado_por_usuario_id]", back_populates="asignado_por")
    evidencias_cargadas   = relationship("Evidencia", back_populates="usuario")


class Personal(Base):
    __tablename__ = "personal"

    personal_id       = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id        = Column(Integer, ForeignKey("usuarios.usuario_id"), unique=True, nullable=False)
    area_id           = Column(Integer, ForeignKey("areas.area_id"))
    nombres           = Column(String(100), nullable=False)
    apellidos         = Column(String(100), nullable=False)
    documento_tipo    = Column(String(20), default="DNI", nullable=False)
    documento_numero  = Column(String(20), unique=True, nullable=False)
    telefono          = Column(String(20))
    cargo             = Column(String(100))
    activo            = Column(Boolean, default=True, nullable=False)
    fecha_creacion    = Column(DateTime, server_default=func.sysdatetime(), nullable=False)

    usuario           = relationship("Usuario", back_populates="personal")
    area              = relationship("Area", back_populates="personal")


class SesionUsuario(Base):
    __tablename__ = "sesiones_usuario"

    sesion_id     = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id    = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=False)
    token_jti     = Column(String(200), unique=True, nullable=False)
    ip_address    = Column(String(50))
    user_agent    = Column(String(500))
    fecha_inicio  = Column(DateTime, server_default=func.sysdatetime(), nullable=False)
    fecha_fin     = Column(DateTime)
    activa        = Column(Boolean, default=True, nullable=False)

    usuario       = relationship("Usuario", back_populates="sesiones")


# ─────────────────────────────────────────────────────────────────────────────
# CLIENTES Y SERVICIOS
# ─────────────────────────────────────────────────────────────────────────────

class Cliente(Base):
    __tablename__ = "clientes"
    __table_args__ = (
        CheckConstraint("tipo_cliente IN ('PERSONA','EMPRESA')", name="CK_clientes_tipo"),
    )

    cliente_id        = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id        = Column(Integer, ForeignKey("usuarios.usuario_id"), unique=True)
    tipo_cliente      = Column(String(20), default="PERSONA", nullable=False)
    nombres           = Column(String(100))
    apellidos         = Column(String(100))
    razon_social      = Column(String(200))
    documento_tipo    = Column(String(20), nullable=False)
    documento_numero  = Column(String(20), unique=True, nullable=False)
    correo            = Column(String(150), nullable=False)
    telefono          = Column(String(20))
    direccion         = Column(String(250))
    activo            = Column(Boolean, default=True, nullable=False)
    fecha_creacion    = Column(DateTime, server_default=func.sysdatetime(), nullable=False)

    usuario           = relationship("Usuario", back_populates="cliente")
    servicios         = relationship("ServicioContratado", back_populates="cliente")
    casos             = relationship("Caso", back_populates="cliente")


class Servicio(Base):
    __tablename__ = "servicios"

    servicio_id   = Column(Integer, primary_key=True, autoincrement=True)
    nombre        = Column(String(100), unique=True, nullable=False)
    descripcion   = Column(String(250))
    activo        = Column(Boolean, default=True, nullable=False)

    contratados   = relationship("ServicioContratado", back_populates="servicio")
    sla_reglas    = relationship("Sla", back_populates="servicio")


class ServicioContratado(Base):
    __tablename__ = "servicios_contratados"
    __table_args__ = (
        CheckConstraint("estado IN ('ACTIVO','SUSPENDIDO','CANCELADO')", name="CK_servicios_contratados_estado"),
    )

    servicio_contratado_id = Column(Integer, primary_key=True, autoincrement=True)
    cliente_id             = Column(Integer, ForeignKey("clientes.cliente_id"), nullable=False)
    servicio_id            = Column(Integer, ForeignKey("servicios.servicio_id"), nullable=False)
    codigo_contrato        = Column(String(50), unique=True, nullable=False)
    plan_nombre            = Column(String(100))
    estado                 = Column(String(20), default="ACTIVO", nullable=False)
    fecha_inicio           = Column(Date)
    fecha_fin              = Column(Date)
    observaciones          = Column(String(250))

    cliente                = relationship("Cliente", back_populates="servicios")
    servicio               = relationship("Servicio", back_populates="contratados")
    casos                  = relationship("Caso", back_populates="servicio_contratado")


# ─────────────────────────────────────────────────────────────────────────────
# CATÁLOGOS DEL NEGOCIO
# ─────────────────────────────────────────────────────────────────────────────

class CanalIngreso(Base):
    __tablename__ = "canales_ingreso"

    canal_ingreso_id = Column(Integer, primary_key=True, autoincrement=True)
    nombre           = Column(String(50), unique=True, nullable=False)
    descripcion      = Column(String(200))
    activo           = Column(Boolean, default=True, nullable=False)

    casos            = relationship("Caso", back_populates="canal_ingreso")


class TipoCaso(Base):
    __tablename__ = "tipos_caso"

    tipo_caso_id  = Column(Integer, primary_key=True, autoincrement=True)
    nombre        = Column(String(50), unique=True, nullable=False)
    descripcion   = Column(String(200))
    activo        = Column(Boolean, default=True, nullable=False)

    categorias    = relationship("Categoria", back_populates="tipo_caso")
    casos         = relationship("Caso", back_populates="tipo_caso")
    sla_reglas    = relationship("Sla", back_populates="tipo_caso")


class Categoria(Base):
    __tablename__ = "categorias"
    __table_args__ = (UniqueConstraint("tipo_caso_id", "nombre"),)

    categoria_id  = Column(Integer, primary_key=True, autoincrement=True)
    tipo_caso_id  = Column(Integer, ForeignKey("tipos_caso.tipo_caso_id"), nullable=False)
    nombre        = Column(String(100), nullable=False)
    descripcion   = Column(String(250))
    activo        = Column(Boolean, default=True, nullable=False)

    tipo_caso     = relationship("TipoCaso", back_populates="categorias")
    casos         = relationship("Caso", back_populates="categoria")
    sla_reglas    = relationship("Sla", back_populates="categoria")


class Prioridad(Base):
    __tablename__ = "prioridades"

    prioridad_id          = Column(Integer, primary_key=True, autoincrement=True)
    nombre                = Column(String(20), unique=True, nullable=False)
    nivel                 = Column(Integer, unique=True, nullable=False)
    descripcion           = Column(String(200))
    tiempo_objetivo_horas = Column(Integer)
    activo                = Column(Boolean, default=True, nullable=False)

    casos                 = relationship("Caso", back_populates="prioridad")
    sla_reglas            = relationship("Sla", back_populates="prioridad")


class EstadoCaso(Base):
    __tablename__ = "estados_caso"

    estado_caso_id  = Column(Integer, primary_key=True, autoincrement=True)
    nombre          = Column(String(50), unique=True, nullable=False)
    descripcion     = Column(String(200))
    es_final        = Column(Boolean, default=False, nullable=False)
    visible_cliente = Column(Boolean, default=True, nullable=False)
    orden           = Column(Integer, default=1, nullable=False)
    activo          = Column(Boolean, default=True, nullable=False)

    casos           = relationship("Caso", back_populates="estado_caso")


class Sla(Base):
    __tablename__ = "sla"

    sla_id                         = Column(Integer, primary_key=True, autoincrement=True)
    nombre                         = Column(String(100), nullable=False)
    tipo_caso_id                   = Column(Integer, ForeignKey("tipos_caso.tipo_caso_id"))
    categoria_id                   = Column(Integer, ForeignKey("categorias.categoria_id"))
    prioridad_id                   = Column(Integer, ForeignKey("prioridades.prioridad_id"))
    servicio_id                    = Column(Integer, ForeignKey("servicios.servicio_id"))
    tiempo_primera_respuesta_horas = Column(Integer, nullable=False)
    tiempo_resolucion_horas        = Column(Integer, nullable=False)
    activo                         = Column(Boolean, default=True, nullable=False)

    tipo_caso   = relationship("TipoCaso", back_populates="sla_reglas")
    categoria   = relationship("Categoria", back_populates="sla_reglas")
    prioridad   = relationship("Prioridad", back_populates="sla_reglas")
    servicio    = relationship("Servicio", back_populates="sla_reglas")
    casos       = relationship("Caso", back_populates="sla")


# ─────────────────────────────────────────────────────────────────────────────
# TABLA CENTRAL: CASOS
# ─────────────────────────────────────────────────────────────────────────────

class Caso(Base):
    __tablename__ = "casos"

    caso_id                      = Column(Integer, primary_key=True, autoincrement=True)
    codigo_caso                  = Column(String(30), unique=True, nullable=False)
    cliente_id                   = Column(Integer, ForeignKey("clientes.cliente_id"), nullable=False)
    servicio_contratado_id       = Column(Integer, ForeignKey("servicios_contratados.servicio_contratado_id"))
    tipo_caso_id                 = Column(Integer, ForeignKey("tipos_caso.tipo_caso_id"), nullable=False)
    categoria_id                 = Column(Integer, ForeignKey("categorias.categoria_id"), nullable=False)
    canal_ingreso_id             = Column(Integer, ForeignKey("canales_ingreso.canal_ingreso_id"), nullable=False)
    prioridad_id                 = Column(Integer, ForeignKey("prioridades.prioridad_id"), nullable=False)
    estado_caso_id               = Column(Integer, ForeignKey("estados_caso.estado_caso_id"), nullable=False)
    sla_id                       = Column(Integer, ForeignKey("sla.sla_id"))
    area_actual_id               = Column(Integer, ForeignKey("areas.area_id"))
    responsable_actual_usuario_id = Column(Integer, ForeignKey("usuarios.usuario_id"))
    creado_por_usuario_id        = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=False)
    cerrado_por_usuario_id       = Column(Integer, ForeignKey("usuarios.usuario_id"))
    titulo                       = Column(String(150), nullable=False)
    descripcion                  = Column(Text, nullable=False)
    fecha_registro               = Column(DateTime, server_default=func.sysdatetime(), nullable=False)
    fecha_limite_respuesta       = Column(DateTime)
    fecha_limite_resolucion      = Column(DateTime)
    fecha_ultima_actualizacion   = Column(DateTime)
    fecha_cierre                 = Column(DateTime)
    solucion_final               = Column(Text)
    pendiente_cliente            = Column(Boolean, default=False, nullable=False)

    cliente                = relationship("Cliente", back_populates="casos")
    servicio_contratado    = relationship("ServicioContratado", back_populates="casos")
    tipo_caso              = relationship("TipoCaso", back_populates="casos")
    categoria              = relationship("Categoria", back_populates="casos")
    canal_ingreso          = relationship("CanalIngreso", back_populates="casos")
    prioridad              = relationship("Prioridad", back_populates="casos")
    estado_caso            = relationship("EstadoCaso", back_populates="casos")
    sla                    = relationship("Sla", back_populates="casos")
    area_actual            = relationship("Area", foreign_keys=[area_actual_id], back_populates="casos_area")
    responsable_actual     = relationship("Usuario", foreign_keys=[responsable_actual_usuario_id], back_populates="casos_responsable")
    creado_por             = relationship("Usuario", foreign_keys=[creado_por_usuario_id], back_populates="casos_creados")
    cerrado_por            = relationship("Usuario", foreign_keys=[cerrado_por_usuario_id], back_populates="casos_cerrados")
    historial              = relationship("HistorialCaso", back_populates="caso", order_by="HistorialCaso.fecha_evento.desc()")
    evidencias             = relationship("Evidencia", back_populates="caso")
    notificaciones         = relationship("Notificacion", back_populates="caso")
    asignaciones           = relationship("AsignacionCaso", back_populates="caso", order_by="AsignacionCaso.fecha_asignacion.desc()")


# ─────────────────────────────────────────────────────────────────────────────
# TRAZABILIDAD Y OPERACIÓN
# ─────────────────────────────────────────────────────────────────────────────

class AsignacionCaso(Base):
    __tablename__ = "asignaciones_caso"
    __table_args__ = (
        CheckConstraint(
            "tipo_movimiento IN ('ASIGNACION','REASIGNACION','DERIVACION','ESCALAMIENTO')",
            name="CK_asignaciones_tipo"
        ),
    )

    asignacion_id          = Column(Integer, primary_key=True, autoincrement=True)
    caso_id                = Column(Integer, ForeignKey("casos.caso_id"), nullable=False)
    usuario_origen_id      = Column(Integer, ForeignKey("usuarios.usuario_id"))
    area_origen_id         = Column(Integer, ForeignKey("areas.area_id"))
    usuario_destino_id     = Column(Integer, ForeignKey("usuarios.usuario_id"))
    area_destino_id        = Column(Integer, ForeignKey("areas.area_id"))
    asignado_por_usuario_id = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=False)
    tipo_movimiento        = Column(String(20), nullable=False)
    motivo                 = Column(String(250))
    fecha_asignacion       = Column(DateTime, server_default=func.sysdatetime(), nullable=False)

    caso            = relationship("Caso", back_populates="asignaciones")
    usuario_origen  = relationship("Usuario", foreign_keys=[usuario_origen_id], back_populates="asignaciones_origen")
    usuario_destino = relationship("Usuario", foreign_keys=[usuario_destino_id], back_populates="asignaciones_destino")
    asignado_por    = relationship("Usuario", foreign_keys=[asignado_por_usuario_id], back_populates="asignaciones_hechas")
    area_origen     = relationship("Area", foreign_keys=[area_origen_id])
    area_destino    = relationship("Area", foreign_keys=[area_destino_id])


class HistorialCaso(Base):
    __tablename__ = "historial_caso"

    historial_id      = Column(Integer, primary_key=True, autoincrement=True)
    caso_id           = Column(Integer, ForeignKey("casos.caso_id"), nullable=False)
    usuario_id        = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=False)
    estado_anterior_id = Column(Integer, ForeignKey("estados_caso.estado_caso_id"))
    estado_nuevo_id   = Column(Integer, ForeignKey("estados_caso.estado_caso_id"))
    accion            = Column(String(100), nullable=False)
    observacion       = Column(Text)
    es_visible_cliente = Column(Boolean, default=True, nullable=False)
    fecha_evento      = Column(DateTime, server_default=func.sysdatetime(), nullable=False)

    caso              = relationship("Caso", back_populates="historial")
    usuario           = relationship("Usuario", back_populates="historial_registrado")
    estado_anterior   = relationship("EstadoCaso", foreign_keys=[estado_anterior_id])
    estado_nuevo      = relationship("EstadoCaso", foreign_keys=[estado_nuevo_id])
    evidencias        = relationship("Evidencia", back_populates="historial")


class Evidencia(Base):
    __tablename__ = "evidencias"

    evidencia_id   = Column(Integer, primary_key=True, autoincrement=True)
    caso_id        = Column(Integer, ForeignKey("casos.caso_id"), nullable=False)
    historial_id   = Column(Integer, ForeignKey("historial_caso.historial_id"))
    usuario_id     = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=False)
    nombre_archivo = Column(String(255), nullable=False)
    ruta_archivo   = Column(String(500), nullable=False)
    tipo_mime      = Column(String(100))
    tamano_bytes   = Column(BigInteger)
    descripcion    = Column(String(250))
    fecha_carga    = Column(DateTime, server_default=func.sysdatetime(), nullable=False)

    caso           = relationship("Caso", back_populates="evidencias")
    historial      = relationship("HistorialCaso", back_populates="evidencias")
    usuario        = relationship("Usuario", back_populates="evidencias_cargadas")


class Notificacion(Base):
    __tablename__ = "notificaciones"
    __table_args__ = (
        CheckConstraint("canal_envio IN ('SISTEMA','EMAIL','SMS','WHATSAPP')", name="CK_notificaciones_canal"),
        CheckConstraint("estado_envio IN ('PENDIENTE','ENVIADO','ERROR','LEIDO')", name="CK_notificaciones_estado"),
    )

    notificacion_id  = Column(Integer, primary_key=True, autoincrement=True)
    caso_id          = Column(Integer, ForeignKey("casos.caso_id"))
    usuario_id       = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=False)
    tipo             = Column(String(50), nullable=False)
    canal_envio      = Column(String(30), default="SISTEMA", nullable=False)
    titulo           = Column(String(150), nullable=False)
    mensaje          = Column(Text, nullable=False)
    leida            = Column(Boolean, default=False, nullable=False)
    fecha_generacion = Column(DateTime, server_default=func.sysdatetime(), nullable=False)
    fecha_lectura    = Column(DateTime)
    estado_envio     = Column(String(20), default="PENDIENTE", nullable=False)

    caso             = relationship("Caso", back_populates="notificaciones")
    usuario          = relationship("Usuario", back_populates="notificaciones")


class Auditoria(Base):
    __tablename__ = "auditorias"

    auditoria_id    = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id      = Column(Integer, ForeignKey("usuarios.usuario_id"))
    tabla_afectada  = Column(String(100), nullable=False)
    registro_id     = Column(String(100), nullable=False)
    accion          = Column(String(50), nullable=False)
    valores_antes   = Column(Text)
    valores_despues = Column(Text)
    ip_address      = Column(String(50))
    fecha_evento    = Column(DateTime, server_default=func.sysdatetime(), nullable=False)

    usuario         = relationship("Usuario", back_populates="auditorias")


class Reporte(Base):
    __tablename__ = "reportes"
    __table_args__ = (
        CheckConstraint("formato IN ('PDF','EXCEL','CSV')", name="CK_reportes_formato"),
        CheckConstraint(
            "periodicidad IS NULL OR periodicidad IN ('DIARIO','SEMANAL','MENSUAL')",
            name="CK_reportes_periodicidad"
        ),
    )

    reporte_id               = Column(Integer, primary_key=True, autoincrement=True)
    nombre                   = Column(String(150), nullable=False)
    descripcion              = Column(String(250))
    formato                  = Column(String(20), nullable=False)
    filtros_json             = Column(Text)
    ruta_archivo             = Column(String(500))
    generado_por_usuario_id  = Column(Integer, ForeignKey("usuarios.usuario_id"), nullable=False)
    programado               = Column(Boolean, default=False, nullable=False)
    periodicidad             = Column(String(20))
    fecha_generacion         = Column(DateTime, server_default=func.sysdatetime(), nullable=False)

    generado_por             = relationship("Usuario", back_populates="reportes_generados")
