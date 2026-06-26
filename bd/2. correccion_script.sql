/* =========================================================
   CLARO ATENCIÓN 360
   SCRIPT 01 - RESET COMPLETO DE BASE DE DATOS
   Crea estructura limpia desde cero
   Roles válidos:
   - CLIENTE_PERSONA
   - CLIENTE_EMPRESA
   - ASESOR
   - SUPERVISOR
   - ADMINISTRADOR
========================================================= */

USE master;
GO

IF DB_ID('ClaroAtencion360') IS NOT NULL
BEGIN
    ALTER DATABASE ClaroAtencion360 SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE ClaroAtencion360;
END
GO

CREATE DATABASE ClaroAtencion360;
GO

USE ClaroAtencion360;
GO

/* =========================================================
   1. SEGURIDAD, ROLES Y USUARIOS
========================================================= */

CREATE TABLE roles (
    rol_id INT IDENTITY(1,1) PRIMARY KEY,
    codigo NVARCHAR(50) NOT NULL UNIQUE,
    nombre NVARCHAR(80) NOT NULL,
    nombre_visual NVARCHAR(100) NOT NULL,
    frontend_role NVARCHAR(50) NOT NULL,
    descripcion NVARCHAR(250) NULL,
    dashboard_url NVARCHAR(200) NULL,
    activo BIT NOT NULL DEFAULT 1,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE areas (
    area_id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(120) NOT NULL UNIQUE,
    descripcion NVARCHAR(250) NULL,
    activo BIT NOT NULL DEFAULT 1,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion DATETIME2 NULL
);
GO

CREATE TABLE permisos (
    permiso_id INT IDENTITY(1,1) PRIMARY KEY,
    modulo NVARCHAR(100) NOT NULL,
    nombre NVARCHAR(120) NOT NULL,
    descripcion NVARCHAR(250) NULL,
    es_sensible BIT NOT NULL DEFAULT 0,
    activo BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE roles_permisos (
    rol_permiso_id INT IDENTITY(1,1) PRIMARY KEY,
    rol_id INT NOT NULL,
    permiso_id INT NOT NULL,

    CONSTRAINT FK_roles_permisos_rol
        FOREIGN KEY (rol_id) REFERENCES roles(rol_id),

    CONSTRAINT FK_roles_permisos_permiso
        FOREIGN KEY (permiso_id) REFERENCES permisos(permiso_id),

    CONSTRAINT UQ_roles_permisos
        UNIQUE (rol_id, permiso_id)
);
GO

CREATE TABLE usuarios (
    usuario_id INT IDENTITY(1,1) PRIMARY KEY,
    rol_id INT NOT NULL,
    area_id INT NULL,

    username NVARCHAR(80) NOT NULL UNIQUE,
    correo NVARCHAR(150) NOT NULL UNIQUE,
    password_hash NVARCHAR(300) NOT NULL,

    estado NVARCHAR(30) NOT NULL DEFAULT 'ACTIVO',
    tipo_acceso NVARCHAR(80) NULL,

    correo_verificado BIT NOT NULL DEFAULT 1,
    requiere_cambio_password BIT NOT NULL DEFAULT 0,
    intentos_fallidos INT NOT NULL DEFAULT 0,
    bloqueado_hasta DATETIME2 NULL,

    ultimo_acceso DATETIME2 NULL,
    ultimo_cambio_password DATETIME2 NULL,

    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion DATETIME2 NULL,

    CONSTRAINT FK_usuarios_roles
        FOREIGN KEY (rol_id) REFERENCES roles(rol_id),

    CONSTRAINT FK_usuarios_areas
        FOREIGN KEY (area_id) REFERENCES areas(area_id),

    CONSTRAINT CK_usuarios_estado
        CHECK (estado IN ('ACTIVO', 'INACTIVO', 'BLOQUEADO'))
);
GO

CREATE TABLE refresh_tokens (
    refresh_token_id INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id INT NOT NULL,
    token_hash NVARCHAR(300) NOT NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_expiracion DATETIME2 NOT NULL,
    revocado BIT NOT NULL DEFAULT 0,

    CONSTRAINT FK_refresh_tokens_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
);
GO

CREATE TABLE otp_verificacion (
    otp_id INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id INT NOT NULL,
    codigo NVARCHAR(20) NOT NULL,
    tipo NVARCHAR(50) NOT NULL,
    usado BIT NOT NULL DEFAULT 0,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_expiracion DATETIME2 NOT NULL,

    CONSTRAINT FK_otp_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
);
GO

/* =========================================================
   2. CLIENTES Y PERSONAL INTERNO
========================================================= */

CREATE TABLE clientes (
    cliente_id INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id INT NOT NULL UNIQUE,

    tipo_cliente NVARCHAR(20) NOT NULL,

    nombres NVARCHAR(120) NULL,
    apellidos NVARCHAR(120) NULL,
    razon_social NVARCHAR(180) NULL,

    documento_tipo NVARCHAR(20) NOT NULL,
    documento_numero NVARCHAR(30) NOT NULL UNIQUE,

    correo NVARCHAR(150) NOT NULL,
    telefono NVARCHAR(30) NULL,
    direccion NVARCHAR(250) NULL,

    activo BIT NOT NULL DEFAULT 1,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion DATETIME2 NULL,

    CONSTRAINT FK_clientes_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id),

    CONSTRAINT CK_clientes_tipo
        CHECK (tipo_cliente IN ('PERSONA', 'EMPRESA'))
);
GO

CREATE TABLE personal (
    personal_id INT IDENTITY(1,1) PRIMARY KEY,
    usuario_id INT NOT NULL UNIQUE,
    area_id INT NULL,

    nombres NVARCHAR(120) NOT NULL,
    apellidos NVARCHAR(120) NOT NULL,

    documento_tipo NVARCHAR(20) NULL,
    documento_numero NVARCHAR(30) NULL,

    telefono NVARCHAR(30) NULL,
    cargo NVARCHAR(120) NOT NULL,

    activo BIT NOT NULL DEFAULT 1,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion DATETIME2 NULL,

    CONSTRAINT FK_personal_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id),

    CONSTRAINT FK_personal_area
        FOREIGN KEY (area_id) REFERENCES areas(area_id)
);
GO

/* =========================================================
   3. CATÁLOGOS OPERATIVOS
========================================================= */

CREATE TABLE tipos_caso (
    tipo_caso_id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE,
    descripcion NVARCHAR(250) NULL,
    activo BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE categorias (
    categoria_id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(100) NOT NULL UNIQUE,
    descripcion NVARCHAR(250) NULL,
    activo BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE prioridades (
    prioridad_id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(50) NOT NULL UNIQUE,
    descripcion NVARCHAR(250) NULL,
    horas_sla INT NOT NULL DEFAULT 48,
    activo BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE estados_caso (
    estado_caso_id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE,
    descripcion NVARCHAR(250) NULL,
    orden INT NOT NULL DEFAULT 1,
    es_final BIT NOT NULL DEFAULT 0,
    activo BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE canales_ingreso (
    canal_ingreso_id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(80) NOT NULL UNIQUE,
    descripcion NVARCHAR(250) NULL,
    activo BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE motivos_catalogo (
    motivo_id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(120) NOT NULL,
    descripcion NVARCHAR(250) NULL,
    activo BIT NOT NULL DEFAULT 1
);
GO

/* =========================================================
   4. SERVICIOS Y CONTRATOS
========================================================= */

CREATE TABLE servicios (
    servicio_id INT IDENTITY(1,1) PRIMARY KEY,
    nombre NVARCHAR(120) NOT NULL,
    tipo_servicio NVARCHAR(60) NOT NULL,
    segmento NVARCHAR(30) NOT NULL,
    descripcion NVARCHAR(250) NULL,
    activo BIT NOT NULL DEFAULT 1,

    CONSTRAINT CK_servicios_segmento
        CHECK (segmento IN ('PERSONAS', 'EMPRESAS', 'AMBOS'))
);
GO

CREATE TABLE servicios_contratados (
    servicio_contratado_id INT IDENTITY(1,1) PRIMARY KEY,
    cliente_id INT NOT NULL,
    servicio_id INT NOT NULL,

    codigo_contrato NVARCHAR(50) NOT NULL UNIQUE,
    plan_nombre NVARCHAR(150) NOT NULL,

    estado NVARCHAR(50) NOT NULL DEFAULT 'ACTIVO',
    direccion_instalacion NVARCHAR(250) NULL,
    distrito NVARCHAR(100) NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NULL,

    monto_mensual DECIMAL(12,2) NULL,
    moneda NVARCHAR(10) NOT NULL DEFAULT 'PEN',

    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion DATETIME2 NULL,

    CONSTRAINT FK_servicios_contratados_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id),

    CONSTRAINT FK_servicios_contratados_servicio
        FOREIGN KEY (servicio_id) REFERENCES servicios(servicio_id),

    CONSTRAINT CK_servicios_contratados_estado
        CHECK (estado IN ('ACTIVO', 'SUSPENDIDO', 'BAJA', 'PENDIENTE'))
);
GO

/* =========================================================
   5. CASOS, HISTORIAL, EVIDENCIAS Y NOTIFICACIONES
========================================================= */

CREATE TABLE casos (
    caso_id INT IDENTITY(1,1) PRIMARY KEY,
    codigo_caso NVARCHAR(40) NOT NULL UNIQUE,

    cliente_id INT NOT NULL,
    servicio_contratado_id INT NULL,

    tipo_caso_id INT NOT NULL,
    categoria_id INT NOT NULL,
    prioridad_id INT NOT NULL,
    estado_caso_id INT NOT NULL,
    canal_ingreso_id INT NULL,

    titulo NVARCHAR(180) NOT NULL,
    descripcion NVARCHAR(MAX) NOT NULL,

    responsable_actual_usuario_id INT NULL,

    pendiente_cliente BIT NOT NULL DEFAULT 0,
    solucion_final NVARCHAR(MAX) NULL,

    fecha_registro DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_limite_resolucion DATETIME2 NULL,
    fecha_actualizacion DATETIME2 NULL,
    fecha_cierre DATETIME2 NULL,

    calificacion_cliente INT NULL,
    comentario_calificacion NVARCHAR(500) NULL,

    CONSTRAINT FK_casos_cliente
        FOREIGN KEY (cliente_id) REFERENCES clientes(cliente_id),

    CONSTRAINT FK_casos_servicio_contratado
        FOREIGN KEY (servicio_contratado_id) REFERENCES servicios_contratados(servicio_contratado_id),

    CONSTRAINT FK_casos_tipo
        FOREIGN KEY (tipo_caso_id) REFERENCES tipos_caso(tipo_caso_id),

    CONSTRAINT FK_casos_categoria
        FOREIGN KEY (categoria_id) REFERENCES categorias(categoria_id),

    CONSTRAINT FK_casos_prioridad
        FOREIGN KEY (prioridad_id) REFERENCES prioridades(prioridad_id),

    CONSTRAINT FK_casos_estado
        FOREIGN KEY (estado_caso_id) REFERENCES estados_caso(estado_caso_id),

    CONSTRAINT FK_casos_canal
        FOREIGN KEY (canal_ingreso_id) REFERENCES canales_ingreso(canal_ingreso_id),

    CONSTRAINT FK_casos_responsable
        FOREIGN KEY (responsable_actual_usuario_id) REFERENCES usuarios(usuario_id)
);
GO

CREATE TABLE asignaciones_caso (
    asignacion_id INT IDENTITY(1,1) PRIMARY KEY,
    caso_id INT NOT NULL,
    asesor_usuario_id INT NOT NULL,
    supervisor_usuario_id INT NULL,

    motivo NVARCHAR(300) NULL,
    activo BIT NOT NULL DEFAULT 1,
    fecha_asignacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_fin DATETIME2 NULL,

    CONSTRAINT FK_asignaciones_caso
        FOREIGN KEY (caso_id) REFERENCES casos(caso_id),

    CONSTRAINT FK_asignaciones_asesor
        FOREIGN KEY (asesor_usuario_id) REFERENCES usuarios(usuario_id),

    CONSTRAINT FK_asignaciones_supervisor
        FOREIGN KEY (supervisor_usuario_id) REFERENCES usuarios(usuario_id)
);
GO

CREATE TABLE historial_caso (
    historial_id INT IDENTITY(1,1) PRIMARY KEY,
    caso_id INT NOT NULL,
    usuario_id INT NULL,

    accion NVARCHAR(150) NOT NULL,
    observacion NVARCHAR(MAX) NULL,

    es_visible_cliente BIT NOT NULL DEFAULT 0,
    fecha_evento DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_historial_caso
        FOREIGN KEY (caso_id) REFERENCES casos(caso_id),

    CONSTRAINT FK_historial_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
);
GO

CREATE TABLE evidencias (
    evidencia_id INT IDENTITY(1,1) PRIMARY KEY,
    caso_id INT NOT NULL,
    usuario_id INT NULL,

    nombre_archivo NVARCHAR(180) NOT NULL,
    ruta_archivo NVARCHAR(400) NULL,

    tipo_archivo NVARCHAR(80) NULL,
    tipo_mime NVARCHAR(120) NULL,
    tamano_bytes INT NULL,

    descripcion NVARCHAR(300) NULL,
    es_visible_cliente BIT NOT NULL DEFAULT 1,

    fecha_subida DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_carga DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_evidencias_caso
        FOREIGN KEY (caso_id) REFERENCES casos(caso_id),

    CONSTRAINT FK_evidencias_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
);
GO

CREATE TABLE notificaciones (
    notificacion_id INT IDENTITY(1,1) PRIMARY KEY,
    caso_id INT NULL,
    usuario_id INT NOT NULL,

    tipo NVARCHAR(80) NOT NULL DEFAULT 'SISTEMA',
    canal_envio NVARCHAR(80) NOT NULL DEFAULT 'SISTEMA',

    titulo NVARCHAR(180) NOT NULL,
    mensaje NVARCHAR(MAX) NOT NULL,

    leida BIT NOT NULL DEFAULT 0,
    estado_envio NVARCHAR(50) NOT NULL DEFAULT 'ENVIADO',

    fecha_generacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_lectura DATETIME2 NULL,

    CONSTRAINT FK_notificaciones_caso
        FOREIGN KEY (caso_id) REFERENCES casos(caso_id),

    CONSTRAINT FK_notificaciones_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
);
GO

CREATE TABLE plantillas_respuesta (
    plantilla_id INT IDENTITY(1,1) PRIMARY KEY,

    nombre NVARCHAR(150) NOT NULL,
    categoria NVARCHAR(80) NOT NULL,
    canal NVARCHAR(80) NULL,

    descripcion NVARCHAR(300) NULL,
    contenido NVARCHAR(MAX) NOT NULL,

    creado_por_usuario_id INT NULL,
    activo BIT NOT NULL DEFAULT 1,

    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion DATETIME2 NULL,

    CONSTRAINT FK_plantillas_usuario
        FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(usuario_id)
);
GO

/* =========================================================
   6. REPORTES, SUPERVISIÓN Y CONFIGURACIÓN
========================================================= */

CREATE TABLE reportes (
    reporte_id INT IDENTITY(1,1) PRIMARY KEY,

    nombre NVARCHAR(180) NOT NULL,
    tipo NVARCHAR(100) NOT NULL,
    periodo NVARCHAR(80) NOT NULL,
    alcance NVARCHAR(120) NULL,
    formato NVARCHAR(50) NOT NULL,

    comentario NVARCHAR(MAX) NULL,
    generado_por_usuario_id INT NULL,

    estado NVARCHAR(50) NOT NULL DEFAULT 'Generado',
    fecha_generacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_reportes_usuario
        FOREIGN KEY (generado_por_usuario_id) REFERENCES usuarios(usuario_id)
);
GO

CREATE TABLE rutas_supervision (
    ruta_id INT IDENTITY(1,1) PRIMARY KEY,

    nombre NVARCHAR(150) NOT NULL,
    condicion NVARCHAR(250) NULL,
    area_destino NVARCHAR(120) NULL,
    sla_interno NVARCHAR(80) NULL,
    escalamiento NVARCHAR(150) NULL,

    estado NVARCHAR(50) NOT NULL DEFAULT 'Activo',
    creado_por_usuario_id INT NULL,

    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion DATETIME2 NULL,

    CONSTRAINT FK_rutas_supervision_usuario
        FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(usuario_id)
);
GO

CREATE TABLE configuraciones_sistema (
    configuracion_id INT IDENTITY(1,1) PRIMARY KEY,

    clave NVARCHAR(120) NOT NULL UNIQUE,
    valor NVARCHAR(MAX) NOT NULL,
    descripcion NVARCHAR(250) NULL,

    activo BIT NOT NULL DEFAULT 1,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion DATETIME2 NULL
);
GO

/* =========================================================
   7. ADMINISTRACIÓN, AUDITORÍA, INTEGRACIONES Y RESPALDO
========================================================= */

CREATE TABLE auditoria_admin (
    auditoria_id INT IDENTITY(1,1) PRIMARY KEY,

    modulo NVARCHAR(100) NOT NULL,
    tipo NVARCHAR(100) NOT NULL,
    accion NVARCHAR(150) NOT NULL,

    usuario_id INT NULL,
    usuario_nombre NVARCHAR(150) NULL,

    valor_anterior NVARCHAR(MAX) NULL,
    valor_nuevo NVARCHAR(MAX) NULL,

    resultado NVARCHAR(50) NOT NULL DEFAULT 'Exitoso',
    critico BIT NOT NULL DEFAULT 0,
    detalle NVARCHAR(MAX) NULL,

    ip_origen NVARCHAR(80) NULL,
    fecha_evento DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_auditoria_admin_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
);
GO

CREATE TABLE alertas_sistema (
    alerta_id INT IDENTITY(1,1) PRIMARY KEY,

    modulo NVARCHAR(100) NOT NULL,
    titulo NVARCHAR(180) NOT NULL,
    mensaje NVARCHAR(MAX) NOT NULL,

    severidad NVARCHAR(50) NOT NULL DEFAULT 'Media',
    estado NVARCHAR(50) NOT NULL DEFAULT 'Pendiente',
    href NVARCHAR(200) NULL,

    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    revisada_por_usuario_id INT NULL,
    fecha_revision DATETIME2 NULL,

    CONSTRAINT FK_alertas_sistema_usuario
        FOREIGN KEY (revisada_por_usuario_id) REFERENCES usuarios(usuario_id)
);
GO

CREATE TABLE integraciones_sistema (
    integracion_id INT IDENTITY(1,1) PRIMARY KEY,

    nombre NVARCHAR(150) NOT NULL,
    tipo NVARCHAR(80) NOT NULL,
    estado NVARCHAR(50) NOT NULL DEFAULT 'Activa',
    criticidad NVARCHAR(50) NOT NULL DEFAULT 'Media',

    endpoint NVARCHAR(300) NOT NULL,
    descripcion NVARCHAR(MAX) NULL,
    responsable NVARCHAR(120) NULL,

    ultima_sincronizacion DATETIME2 NULL,

    creado_por_usuario_id INT NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion DATETIME2 NULL,

    CONSTRAINT FK_integraciones_sistema_usuario
        FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(usuario_id)
);
GO

CREATE TABLE eventos_integracion (
    evento_id INT IDENTITY(1,1) PRIMARY KEY,

    integracion_id INT NOT NULL,
    titulo NVARCHAR(180) NOT NULL,
    descripcion NVARCHAR(MAX) NULL,
    estado NVARCHAR(50) NOT NULL DEFAULT 'Exitoso',
    fecha_evento DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_eventos_integracion_integracion
        FOREIGN KEY (integracion_id) REFERENCES integraciones_sistema(integracion_id)
);
GO

CREATE TABLE respaldos_sistema (
    respaldo_id INT IDENTITY(1,1) PRIMARY KEY,

    fecha_ejecucion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    tipo NVARCHAR(80) NOT NULL,
    estado NVARCHAR(50) NOT NULL DEFAULT 'Programado',

    tamano NVARCHAR(80) NULL,
    ubicacion NVARCHAR(250) NULL,
    validacion NVARCHAR(80) NOT NULL DEFAULT 'Pendiente',
    responsable NVARCHAR(150) NULL
);
GO

CREATE TABLE pruebas_restauracion (
    prueba_id INT IDENTITY(1,1) PRIMARY KEY,

    titulo NVARCHAR(180) NOT NULL,
    descripcion NVARCHAR(MAX) NULL,
    estado NVARCHAR(50) NOT NULL DEFAULT 'Programado',

    fecha_programada DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    creado_por_usuario_id INT NULL,

    CONSTRAINT FK_pruebas_restauracion_usuario
        FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(usuario_id)
);
GO

CREATE TABLE reglas_sla_admin (
    regla_sla_id INT IDENTITY(1,1) PRIMARY KEY,

    nombre NVARCHAR(180) NOT NULL,
    tipo_caso NVARCHAR(100) NOT NULL,
    prioridad NVARCHAR(80) NOT NULL,
    canal NVARCHAR(100) NOT NULL,

    tiempo_sla NVARCHAR(80) NOT NULL,
    alerta NVARCHAR(80) NOT NULL,
    area NVARCHAR(120) NOT NULL,

    estado NVARCHAR(50) NOT NULL DEFAULT 'Activo',
    descripcion NVARCHAR(MAX) NULL,

    creado_por_usuario_id INT NULL,
    fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    fecha_actualizacion DATETIME2 NULL,

    CONSTRAINT FK_reglas_sla_admin_usuario
        FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(usuario_id)
);
GO

/* =========================================================
   8. TABLAS PÚBLICAS: INDEX, AYUDA Y ESTADO SERVICIOS
========================================================= */

CREATE TABLE public_quick_actions (
    accion_id INT IDENTITY(1,1) PRIMARY KEY,

    segmento NVARCHAR(30) NOT NULL,
    icono NVARCHAR(20) NOT NULL,
    titulo NVARCHAR(120) NOT NULL,
    descripcion NVARCHAR(250) NOT NULL,
    href NVARCHAR(250) NOT NULL,

    orden INT NOT NULL DEFAULT 1,
    activo BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE public_solutions (
    solucion_id INT IDENTITY(1,1) PRIMARY KEY,

    segmento NVARCHAR(30) NOT NULL,
    etiqueta NVARCHAR(80) NOT NULL,
    titulo NVARCHAR(150) NOT NULL,
    descripcion NVARCHAR(250) NOT NULL,
    imagen_url NVARCHAR(500) NOT NULL,
    href NVARCHAR(250) NOT NULL,

    orden INT NOT NULL DEFAULT 1,
    activo BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE public_service_status (
    servicio_estado_id INT IDENTITY(1,1) PRIMARY KEY,

    segmento NVARCHAR(30) NOT NULL,
    tipo_servicio NVARCHAR(50) NOT NULL,

    icono NVARCHAR(20) NOT NULL,
    nombre NVARCHAR(150) NOT NULL,
    descripcion NVARCHAR(300) NOT NULL,

    estado NVARCHAR(80) NOT NULL,
    salud INT NOT NULL DEFAULT 100,

    zona NVARCHAR(120) NOT NULL,
    zona_grupo NVARCHAR(80) NOT NULL,

    orden INT NOT NULL DEFAULT 1,
    activo BIT NOT NULL DEFAULT 1,

    fecha_actualizacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);
GO

CREATE TABLE public_service_events (
    evento_id INT IDENTITY(1,1) PRIMARY KEY,

    codigo_evento NVARCHAR(40) NOT NULL UNIQUE,
    segmento NVARCHAR(30) NOT NULL,

    servicio NVARCHAR(150) NOT NULL,
    zona NVARCHAR(120) NOT NULL,
    tipo NVARCHAR(50) NOT NULL,
    estado NVARCHAR(80) NOT NULL,

    descripcion NVARCHAR(500) NOT NULL,

    fecha_inicio DATETIME2 NOT NULL,
    fecha_estimada DATETIME2 NULL,

    activo BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE public_service_zones (
    zona_id INT IDENTITY(1,1) PRIMARY KEY,

    segmento NVARCHAR(30) NOT NULL,
    nombre NVARCHAR(120) NOT NULL,
    estado NVARCHAR(80) NOT NULL,

    posicion_top INT NOT NULL DEFAULT 20,
    posicion_left INT NOT NULL DEFAULT 20,

    activo BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE public_help_categories (
    categoria_ayuda_id INT IDENTITY(1,1) PRIMARY KEY,

    segmento NVARCHAR(30) NOT NULL,
    icono NVARCHAR(20) NOT NULL,
    titulo NVARCHAR(120) NOT NULL,
    descripcion NVARCHAR(300) NOT NULL,
    etiqueta NVARCHAR(80) NOT NULL,

    orden INT NOT NULL DEFAULT 1,
    activo BIT NOT NULL DEFAULT 1
);
GO

CREATE TABLE public_help_articles (
    articulo_id INT IDENTITY(1,1) PRIMARY KEY,

    segmento NVARCHAR(30) NOT NULL,
    categoria_ayuda_id INT NULL,

    icono NVARCHAR(20) NOT NULL,
    etiqueta NVARCHAR(80) NOT NULL,

    titulo NVARCHAR(180) NOT NULL,
    descripcion NVARCHAR(400) NOT NULL,

    orden INT NOT NULL DEFAULT 1,
    activo BIT NOT NULL DEFAULT 1,

    CONSTRAINT FK_public_help_articles_category
        FOREIGN KEY (categoria_ayuda_id) REFERENCES public_help_categories(categoria_ayuda_id)
);
GO

CREATE TABLE public_help_article_steps (
    paso_id INT IDENTITY(1,1) PRIMARY KEY,

    articulo_id INT NOT NULL,
    paso NVARCHAR(400) NOT NULL,
    orden INT NOT NULL DEFAULT 1,

    CONSTRAINT FK_public_help_article_steps_article
        FOREIGN KEY (articulo_id) REFERENCES public_help_articles(articulo_id)
);
GO

CREATE TABLE public_help_faq (
    faq_id INT IDENTITY(1,1) PRIMARY KEY,

    segmento NVARCHAR(30) NOT NULL,
    categoria NVARCHAR(80) NOT NULL,

    pregunta NVARCHAR(250) NOT NULL,
    respuesta NVARCHAR(MAX) NOT NULL,

    orden INT NOT NULL DEFAULT 1,
    activo BIT NOT NULL DEFAULT 1
);
GO

/* =========================================================
   9. ÍNDICES PARA RENDIMIENTO
========================================================= */

CREATE INDEX IX_usuarios_correo ON usuarios(correo);
CREATE INDEX IX_usuarios_username ON usuarios(username);
CREATE INDEX IX_usuarios_rol ON usuarios(rol_id);

CREATE INDEX IX_clientes_documento ON clientes(documento_numero);
CREATE INDEX IX_clientes_usuario ON clientes(usuario_id);

CREATE INDEX IX_casos_codigo ON casos(codigo_caso);
CREATE INDEX IX_casos_cliente ON casos(cliente_id);
CREATE INDEX IX_casos_estado ON casos(estado_caso_id);
CREATE INDEX IX_casos_responsable ON casos(responsable_actual_usuario_id);
CREATE INDEX IX_casos_fecha_registro ON casos(fecha_registro);
CREATE INDEX IX_casos_fecha_limite ON casos(fecha_limite_resolucion);

CREATE INDEX IX_historial_caso ON historial_caso(caso_id);
CREATE INDEX IX_evidencias_caso ON evidencias(caso_id);
CREATE INDEX IX_notificaciones_usuario ON notificaciones(usuario_id, leida);

CREATE INDEX IX_public_service_status_segmento ON public_service_status(segmento);
CREATE INDEX IX_public_service_events_segmento ON public_service_events(segmento, activo);
CREATE INDEX IX_public_help_articles_segmento ON public_help_articles(segmento, activo);
CREATE INDEX IX_public_help_faq_segmento ON public_help_faq(segmento, activo);
GO

/* =========================================================
   10. VALIDACIÓN FINAL
========================================================= */

SELECT
    'ClaroAtencion360 creada correctamente' AS resultado,
    DB_NAME() AS base_datos,
    SYSDATETIME() AS fecha_creacion;
GO

/* =========================================================
   11. COMPLEMENTO CORREGIDO 2026
   Tablas y columnas necesarias para frontend/backend real:
   asesor, supervisor, administrador, cliente, reportes,
   exportaciones, plantillas, SLA, trazabilidad y dashboard.

   NOTA:
   Se usa ALTER/CREATE condicional para que el script sea más robusto.
   Como este archivo reinicia la BD desde cero, estas estructuras quedarán
   disponibles desde la primera ejecución.
========================================================= */

/* ---------- Configuración recomendada de BD ---------- */
ALTER DATABASE ClaroAtencion360 SET RECOVERY SIMPLE;
GO

ALTER DATABASE ClaroAtencion360 SET READ_COMMITTED_SNAPSHOT ON;
GO

USE ClaroAtencion360;
GO

/* =========================================================
   11.1. AJUSTES A TABLAS EXISTENTES
========================================================= */

/* ---------- USUARIOS ---------- */
IF COL_LENGTH('usuarios', 'avatar_url') IS NULL
    ALTER TABLE usuarios ADD avatar_url NVARCHAR(500) NULL;
GO

IF COL_LENGTH('usuarios', 'ultimo_ip') IS NULL
    ALTER TABLE usuarios ADD ultimo_ip NVARCHAR(80) NULL;
GO

/* ---------- PERSONAL ---------- */
IF COL_LENGTH('personal', 'codigo_empleado') IS NULL
    ALTER TABLE personal ADD codigo_empleado NVARCHAR(40) NULL;
GO

IF COL_LENGTH('personal', 'turno') IS NULL
    ALTER TABLE personal ADD turno NVARCHAR(80) NULL;
GO

IF COL_LENGTH('personal', 'nivel') IS NULL
    ALTER TABLE personal ADD nivel NVARCHAR(80) NULL;
GO

/* ---------- MOTIVOS ---------- */
IF COL_LENGTH('motivos_catalogo', 'categoria_id') IS NULL
    ALTER TABLE motivos_catalogo ADD categoria_id INT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_motivos_categoria'
)
BEGIN
    ALTER TABLE motivos_catalogo
    ADD CONSTRAINT FK_motivos_categoria
        FOREIGN KEY (categoria_id) REFERENCES categorias(categoria_id);
END
GO

/* ---------- CASOS ---------- */
IF COL_LENGTH('casos', 'motivo_id') IS NULL
    ALTER TABLE casos ADD motivo_id INT NULL;
GO

IF COL_LENGTH('casos', 'area_actual_id') IS NULL
    ALTER TABLE casos ADD area_actual_id INT NULL;
GO

IF COL_LENGTH('casos', 'creado_por_usuario_id') IS NULL
    ALTER TABLE casos ADD creado_por_usuario_id INT NULL;
GO

IF COL_LENGTH('casos', 'cerrado_por_usuario_id') IS NULL
    ALTER TABLE casos ADD cerrado_por_usuario_id INT NULL;
GO

IF COL_LENGTH('casos', 'origen') IS NULL
    ALTER TABLE casos ADD origen NVARCHAR(80) NOT NULL CONSTRAINT DF_casos_origen DEFAULT 'Sistema';
GO

IF COL_LENGTH('casos', 'sla_estado') IS NULL
    ALTER TABLE casos ADD sla_estado NVARCHAR(50) NOT NULL CONSTRAINT DF_casos_sla_estado DEFAULT 'Vigente';
GO

IF COL_LENGTH('casos', 'fecha_primera_respuesta') IS NULL
    ALTER TABLE casos ADD fecha_primera_respuesta DATETIME2 NULL;
GO

IF COL_LENGTH('casos', 'fecha_ultima_accion') IS NULL
    ALTER TABLE casos ADD fecha_ultima_accion DATETIME2 NULL;
GO

IF COL_LENGTH('casos', 'fecha_reapertura') IS NULL
    ALTER TABLE casos ADD fecha_reapertura DATETIME2 NULL;
GO

IF COL_LENGTH('casos', 'reabierto') IS NULL
    ALTER TABLE casos ADD reabierto BIT NOT NULL CONSTRAINT DF_casos_reabierto DEFAULT 0;
GO

IF COL_LENGTH('casos', 'tags') IS NULL
    ALTER TABLE casos ADD tags NVARCHAR(500) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_casos_motivo')
BEGIN
    ALTER TABLE casos
    ADD CONSTRAINT FK_casos_motivo
        FOREIGN KEY (motivo_id) REFERENCES motivos_catalogo(motivo_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_casos_area_actual')
BEGIN
    ALTER TABLE casos
    ADD CONSTRAINT FK_casos_area_actual
        FOREIGN KEY (area_actual_id) REFERENCES areas(area_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_casos_creado_por')
BEGIN
    ALTER TABLE casos
    ADD CONSTRAINT FK_casos_creado_por
        FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(usuario_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_casos_cerrado_por')
BEGIN
    ALTER TABLE casos
    ADD CONSTRAINT FK_casos_cerrado_por
        FOREIGN KEY (cerrado_por_usuario_id) REFERENCES usuarios(usuario_id);
END
GO

/* ---------- ASIGNACIONES ---------- */
IF COL_LENGTH('asignaciones_caso', 'area_origen_id') IS NULL
    ALTER TABLE asignaciones_caso ADD area_origen_id INT NULL;
GO

IF COL_LENGTH('asignaciones_caso', 'area_destino_id') IS NULL
    ALTER TABLE asignaciones_caso ADD area_destino_id INT NULL;
GO

IF COL_LENGTH('asignaciones_caso', 'estado') IS NULL
    ALTER TABLE asignaciones_caso ADD estado NVARCHAR(50) NOT NULL CONSTRAINT DF_asignaciones_estado DEFAULT 'Activa';
GO

IF COL_LENGTH('asignaciones_caso', 'prioridad') IS NULL
    ALTER TABLE asignaciones_caso ADD prioridad NVARCHAR(50) NULL;
GO

IF COL_LENGTH('asignaciones_caso', 'observacion_cierre') IS NULL
    ALTER TABLE asignaciones_caso ADD observacion_cierre NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_asignaciones_area_origen')
BEGIN
    ALTER TABLE asignaciones_caso
    ADD CONSTRAINT FK_asignaciones_area_origen
        FOREIGN KEY (area_origen_id) REFERENCES areas(area_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_asignaciones_area_destino')
BEGIN
    ALTER TABLE asignaciones_caso
    ADD CONSTRAINT FK_asignaciones_area_destino
        FOREIGN KEY (area_destino_id) REFERENCES areas(area_id);
END
GO

/* ---------- HISTORIAL ---------- */
IF COL_LENGTH('historial_caso', 'tipo_evento') IS NULL
    ALTER TABLE historial_caso ADD tipo_evento NVARCHAR(80) NULL;
GO

IF COL_LENGTH('historial_caso', 'canal') IS NULL
    ALTER TABLE historial_caso ADD canal NVARCHAR(80) NULL;
GO

IF COL_LENGTH('historial_caso', 'metadata_json') IS NULL
    ALTER TABLE historial_caso ADD metadata_json NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('historial_caso', 'ip_origen') IS NULL
    ALTER TABLE historial_caso ADD ip_origen NVARCHAR(80) NULL;
GO

/* ---------- EVIDENCIAS ---------- */
IF COL_LENGTH('evidencias', 'estado_validacion') IS NULL
    ALTER TABLE evidencias ADD estado_validacion NVARCHAR(50) NOT NULL CONSTRAINT DF_evidencias_estado_validacion DEFAULT 'Pendiente';
GO

IF COL_LENGTH('evidencias', 'validado_por_usuario_id') IS NULL
    ALTER TABLE evidencias ADD validado_por_usuario_id INT NULL;
GO

IF COL_LENGTH('evidencias', 'fecha_validacion') IS NULL
    ALTER TABLE evidencias ADD fecha_validacion DATETIME2 NULL;
GO

IF COL_LENGTH('evidencias', 'comentario_validacion') IS NULL
    ALTER TABLE evidencias ADD comentario_validacion NVARCHAR(400) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_evidencias_validado_por')
BEGIN
    ALTER TABLE evidencias
    ADD CONSTRAINT FK_evidencias_validado_por
        FOREIGN KEY (validado_por_usuario_id) REFERENCES usuarios(usuario_id);
END
GO

/* ---------- NOTIFICACIONES ---------- */
IF COL_LENGTH('notificaciones', 'prioridad') IS NULL
    ALTER TABLE notificaciones ADD prioridad NVARCHAR(50) NOT NULL CONSTRAINT DF_notificaciones_prioridad DEFAULT 'Media';
GO

IF COL_LENGTH('notificaciones', 'url_destino') IS NULL
    ALTER TABLE notificaciones ADD url_destino NVARCHAR(300) NULL;
GO

IF COL_LENGTH('notificaciones', 'fecha_ocultado') IS NULL
    ALTER TABLE notificaciones ADD fecha_ocultado DATETIME2 NULL;
GO

IF COL_LENGTH('notificaciones', 'metadata_json') IS NULL
    ALTER TABLE notificaciones ADD metadata_json NVARCHAR(MAX) NULL;
GO

/* ---------- PLANTILLAS ---------- */
IF COL_LENGTH('plantillas_respuesta', 'asunto') IS NULL
    ALTER TABLE plantillas_respuesta ADD asunto NVARCHAR(180) NULL;
GO

IF COL_LENGTH('plantillas_respuesta', 'variables_json') IS NULL
    ALTER TABLE plantillas_respuesta ADD variables_json NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('plantillas_respuesta', 'uso_total') IS NULL
    ALTER TABLE plantillas_respuesta ADD uso_total INT NOT NULL CONSTRAINT DF_plantillas_uso_total DEFAULT 0;
GO

IF COL_LENGTH('plantillas_respuesta', 'requiere_aprobacion') IS NULL
    ALTER TABLE plantillas_respuesta ADD requiere_aprobacion BIT NOT NULL CONSTRAINT DF_plantillas_requiere_aprobacion DEFAULT 0;
GO

IF COL_LENGTH('plantillas_respuesta', 'estado_aprobacion') IS NULL
    ALTER TABLE plantillas_respuesta ADD estado_aprobacion NVARCHAR(50) NOT NULL CONSTRAINT DF_plantillas_estado_aprobacion DEFAULT 'Aprobada';
GO

IF COL_LENGTH('plantillas_respuesta', 'aprobado_por_usuario_id') IS NULL
    ALTER TABLE plantillas_respuesta ADD aprobado_por_usuario_id INT NULL;
GO

IF COL_LENGTH('plantillas_respuesta', 'fecha_aprobacion') IS NULL
    ALTER TABLE plantillas_respuesta ADD fecha_aprobacion DATETIME2 NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_plantillas_aprobado_por')
BEGIN
    ALTER TABLE plantillas_respuesta
    ADD CONSTRAINT FK_plantillas_aprobado_por
        FOREIGN KEY (aprobado_por_usuario_id) REFERENCES usuarios(usuario_id);
END
GO

/* ---------- REPORTES ---------- */
IF COL_LENGTH('reportes', 'archivo_nombre') IS NULL
    ALTER TABLE reportes ADD archivo_nombre NVARCHAR(250) NULL;
GO

IF COL_LENGTH('reportes', 'archivo_ruta') IS NULL
    ALTER TABLE reportes ADD archivo_ruta NVARCHAR(500) NULL;
GO

IF COL_LENGTH('reportes', 'mime_type') IS NULL
    ALTER TABLE reportes ADD mime_type NVARCHAR(150) NULL;
GO

IF COL_LENGTH('reportes', 'tamano_bytes') IS NULL
    ALTER TABLE reportes ADD tamano_bytes BIGINT NULL;
GO

IF COL_LENGTH('reportes', 'parametros_json') IS NULL
    ALTER TABLE reportes ADD parametros_json NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('reportes', 'compartible') IS NULL
    ALTER TABLE reportes ADD compartible BIT NOT NULL CONSTRAINT DF_reportes_compartible DEFAULT 0;
GO

IF COL_LENGTH('reportes', 'token_compartido') IS NULL
    ALTER TABLE reportes ADD token_compartido NVARCHAR(120) NULL;
GO

IF COL_LENGTH('reportes', 'fecha_expiracion_compartido') IS NULL
    ALTER TABLE reportes ADD fecha_expiracion_compartido DATETIME2 NULL;
GO

/* =========================================================
   11.2. NUEVAS TABLAS OPERATIVAS
========================================================= */

/* ---------- COMUNICACIONES DEL CASO ---------- */
IF OBJECT_ID('comunicaciones_caso', 'U') IS NULL
BEGIN
    CREATE TABLE comunicaciones_caso (
        comunicacion_id INT IDENTITY(1,1) PRIMARY KEY,
        caso_id INT NOT NULL,
        usuario_id INT NULL,
        plantilla_id INT NULL,

        tipo NVARCHAR(80) NOT NULL DEFAULT 'Mensaje',
        canal NVARCHAR(80) NOT NULL DEFAULT 'Sistema',
        asunto NVARCHAR(180) NULL,
        mensaje NVARCHAR(MAX) NOT NULL,

        destinatario NVARCHAR(180) NULL,
        estado NVARCHAR(50) NOT NULL DEFAULT 'Registrado',
        es_visible_cliente BIT NOT NULL DEFAULT 1,

        fecha_envio DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        metadata_json NVARCHAR(MAX) NULL,

        CONSTRAINT FK_comunicaciones_caso
            FOREIGN KEY (caso_id) REFERENCES casos(caso_id),

        CONSTRAINT FK_comunicaciones_usuario
            FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id),

        CONSTRAINT FK_comunicaciones_plantilla
            FOREIGN KEY (plantilla_id) REFERENCES plantillas_respuesta(plantilla_id)
    );
END
GO

/* ---------- SOLICITUDES DE INFORMACIÓN ---------- */
IF OBJECT_ID('solicitudes_informacion', 'U') IS NULL
BEGIN
    CREATE TABLE solicitudes_informacion (
        solicitud_id INT IDENTITY(1,1) PRIMARY KEY,
        caso_id INT NOT NULL,
        solicitada_por_usuario_id INT NOT NULL,

        canal NVARCHAR(80) NOT NULL,
        asunto NVARCHAR(180) NOT NULL,
        mensaje NVARCHAR(MAX) NOT NULL,
        plazo NVARCHAR(80) NULL,
        fecha_limite DATETIME2 NULL,

        estado NVARCHAR(50) NOT NULL DEFAULT 'Pendiente',
        respuesta_cliente NVARCHAR(MAX) NULL,
        fecha_respuesta DATETIME2 NULL,

        fecha_solicitud DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        fecha_actualizacion DATETIME2 NULL,

        CONSTRAINT FK_solicitudes_info_caso
            FOREIGN KEY (caso_id) REFERENCES casos(caso_id),

        CONSTRAINT FK_solicitudes_info_usuario
            FOREIGN KEY (solicitada_por_usuario_id) REFERENCES usuarios(usuario_id)
    );
END
GO

/* ---------- DERIVACIONES ---------- */
IF OBJECT_ID('derivaciones_caso', 'U') IS NULL
BEGIN
    CREATE TABLE derivaciones_caso (
        derivacion_id INT IDENTITY(1,1) PRIMARY KEY,
        caso_id INT NOT NULL,
        derivado_por_usuario_id INT NOT NULL,
        area_destino_id INT NULL,

        area_destino NVARCHAR(120) NOT NULL,
        prioridad NVARCHAR(50) NULL,
        motivo NVARCHAR(MAX) NOT NULL,

        estado NVARCHAR(50) NOT NULL DEFAULT 'Derivado',
        respuesta_area NVARCHAR(MAX) NULL,
        fecha_respuesta DATETIME2 NULL,

        fecha_derivacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        fecha_actualizacion DATETIME2 NULL,

        CONSTRAINT FK_derivaciones_caso
            FOREIGN KEY (caso_id) REFERENCES casos(caso_id),

        CONSTRAINT FK_derivaciones_usuario
            FOREIGN KEY (derivado_por_usuario_id) REFERENCES usuarios(usuario_id),

        CONSTRAINT FK_derivaciones_area_destino
            FOREIGN KEY (area_destino_id) REFERENCES areas(area_id)
    );
END
GO

/* ---------- SEGUIMIENTOS SLA ---------- */
IF OBJECT_ID('seguimientos_sla', 'U') IS NULL
BEGIN
    CREATE TABLE seguimientos_sla (
        seguimiento_sla_id INT IDENTITY(1,1) PRIMARY KEY,
        caso_id INT NOT NULL,
        usuario_id INT NOT NULL,

        tipo NVARCHAR(80) NOT NULL DEFAULT 'Seguimiento',
        canal NVARCHAR(80) NULL,
        mensaje NVARCHAR(MAX) NOT NULL,
        plazo NVARCHAR(80) NULL,

        es_visible_cliente BIT NOT NULL DEFAULT 0,
        fecha_registro DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_seguimientos_sla_caso
            FOREIGN KEY (caso_id) REFERENCES casos(caso_id),

        CONSTRAINT FK_seguimientos_sla_usuario
            FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
    );
END
GO

/* ---------- CONSTANCIAS ---------- */
IF OBJECT_ID('constancias_caso', 'U') IS NULL
BEGIN
    CREATE TABLE constancias_caso (
        constancia_id INT IDENTITY(1,1) PRIMARY KEY,
        caso_id INT NOT NULL,
        generado_por_usuario_id INT NULL,

        codigo_constancia NVARCHAR(60) NOT NULL UNIQUE,
        formato NVARCHAR(40) NOT NULL DEFAULT 'pdf',
        archivo_nombre NVARCHAR(250) NULL,
        archivo_ruta NVARCHAR(500) NULL,
        mime_type NVARCHAR(150) NULL,
        tamano_bytes BIGINT NULL,

        fecha_generacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_constancias_caso
            FOREIGN KEY (caso_id) REFERENCES casos(caso_id),

        CONSTRAINT FK_constancias_usuario
            FOREIGN KEY (generado_por_usuario_id) REFERENCES usuarios(usuario_id)
    );
END
GO

/* ---------- EXPORTACIONES ---------- */
IF OBJECT_ID('exportaciones_reporte', 'U') IS NULL
BEGIN
    CREATE TABLE exportaciones_reporte (
        exportacion_id INT IDENTITY(1,1) PRIMARY KEY,
        reporte_id INT NULL,
        generado_por_usuario_id INT NULL,

        modulo NVARCHAR(80) NOT NULL,
        nombre NVARCHAR(180) NOT NULL,
        formato NVARCHAR(50) NOT NULL,
        estado NVARCHAR(50) NOT NULL DEFAULT 'Generado',

        archivo_nombre NVARCHAR(250) NULL,
        archivo_ruta NVARCHAR(500) NULL,
        mime_type NVARCHAR(150) NULL,
        tamano_bytes BIGINT NULL,
        parametros_json NVARCHAR(MAX) NULL,

        fecha_generacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_exportaciones_reporte
            FOREIGN KEY (reporte_id) REFERENCES reportes(reporte_id),

        CONSTRAINT FK_exportaciones_usuario
            FOREIGN KEY (generado_por_usuario_id) REFERENCES usuarios(usuario_id)
    );
END
GO

/* ---------- DASHBOARDS COMPARTIDOS ---------- */
IF OBJECT_ID('dashboard_compartidos', 'U') IS NULL
BEGIN
    CREATE TABLE dashboard_compartidos (
        dashboard_compartido_id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(180) NOT NULL,
        descripcion NVARCHAR(400) NULL,
        modulo NVARCHAR(80) NOT NULL DEFAULT 'Supervisor',

        token NVARCHAR(120) NOT NULL UNIQUE,
        url_publica NVARCHAR(500) NULL,
        filtros_json NVARCHAR(MAX) NULL,

        creado_por_usuario_id INT NULL,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        fecha_expiracion DATETIME2 NULL,

        CONSTRAINT FK_dashboard_compartidos_usuario
            FOREIGN KEY (creado_por_usuario_id) REFERENCES usuarios(usuario_id)
    );
END
GO

/* ---------- AUDITORÍA OPERATIVA GENERAL ---------- */
IF OBJECT_ID('auditoria_operativa', 'U') IS NULL
BEGIN
    CREATE TABLE auditoria_operativa (
        auditoria_operativa_id INT IDENTITY(1,1) PRIMARY KEY,
        usuario_id INT NULL,
        modulo NVARCHAR(100) NOT NULL,
        entidad NVARCHAR(100) NULL,
        entidad_id NVARCHAR(80) NULL,
        accion NVARCHAR(150) NOT NULL,
        detalle NVARCHAR(MAX) NULL,
        ip_origen NVARCHAR(80) NULL,
        user_agent NVARCHAR(400) NULL,
        fecha_evento DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_auditoria_operativa_usuario
            FOREIGN KEY (usuario_id) REFERENCES usuarios(usuario_id)
    );
END
GO

/* ---------- CATÁLOGOS UI / CONFIGURABLES ---------- */
IF OBJECT_ID('catalogos_ui', 'U') IS NULL
BEGIN
    CREATE TABLE catalogos_ui (
        catalogo_ui_id INT IDENTITY(1,1) PRIMARY KEY,
        grupo NVARCHAR(80) NOT NULL,
        codigo NVARCHAR(80) NOT NULL,
        etiqueta NVARCHAR(150) NOT NULL,
        descripcion NVARCHAR(300) NULL,
        orden INT NOT NULL DEFAULT 1,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT UQ_catalogos_ui_grupo_codigo UNIQUE (grupo, codigo)
    );
END
GO

/* =========================================================
   11.3. ÍNDICES ADICIONALES
========================================================= */

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_casos_area_actual' AND object_id = OBJECT_ID('casos'))
    CREATE INDEX IX_casos_area_actual ON casos(area_actual_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_casos_sla_estado' AND object_id = OBJECT_ID('casos'))
    CREATE INDEX IX_casos_sla_estado ON casos(sla_estado, fecha_limite_resolucion);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_casos_responsable_estado_sla' AND object_id = OBJECT_ID('casos'))
    CREATE INDEX IX_casos_responsable_estado_sla ON casos(responsable_actual_usuario_id, estado_caso_id, fecha_limite_resolucion);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_historial_caso_fecha' AND object_id = OBJECT_ID('historial_caso'))
    CREATE INDEX IX_historial_caso_fecha ON historial_caso(caso_id, fecha_evento DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_notificaciones_usuario_estado' AND object_id = OBJECT_ID('notificaciones'))
    CREATE INDEX IX_notificaciones_usuario_estado ON notificaciones(usuario_id, leida, estado_envio, fecha_generacion DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_comunicaciones_caso_fecha' AND object_id = OBJECT_ID('comunicaciones_caso'))
    CREATE INDEX IX_comunicaciones_caso_fecha ON comunicaciones_caso(caso_id, fecha_envio DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_solicitudes_info_caso_estado' AND object_id = OBJECT_ID('solicitudes_informacion'))
    CREATE INDEX IX_solicitudes_info_caso_estado ON solicitudes_informacion(caso_id, estado, fecha_solicitud DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_derivaciones_caso_estado' AND object_id = OBJECT_ID('derivaciones_caso'))
    CREATE INDEX IX_derivaciones_caso_estado ON derivaciones_caso(caso_id, estado, fecha_derivacion DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_seguimientos_sla_caso_fecha' AND object_id = OBJECT_ID('seguimientos_sla'))
    CREATE INDEX IX_seguimientos_sla_caso_fecha ON seguimientos_sla(caso_id, fecha_registro DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_reportes_usuario_fecha' AND object_id = OBJECT_ID('reportes'))
    CREATE INDEX IX_reportes_usuario_fecha ON reportes(generado_por_usuario_id, fecha_generacion DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_exportaciones_usuario_fecha' AND object_id = OBJECT_ID('exportaciones_reporte'))
    CREATE INDEX IX_exportaciones_usuario_fecha ON exportaciones_reporte(generado_por_usuario_id, fecha_generacion DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_dashboard_compartidos_token' AND object_id = OBJECT_ID('dashboard_compartidos'))
    CREATE INDEX IX_dashboard_compartidos_token ON dashboard_compartidos(token, activo);
GO

/* =========================================================
   11.4. VALIDACIÓN FINAL CORREGIDA
========================================================= */

SELECT
    'ClaroAtencion360 corregida correctamente' AS resultado,
    DB_NAME() AS base_datos,
    (SELECT COUNT(*) FROM sys.tables) AS total_tablas,
    SYSDATETIME() AS fecha_validacion;
GO
