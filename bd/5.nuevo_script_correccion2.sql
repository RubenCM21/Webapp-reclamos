/* =========================================================
   CLARO ATENCIÓN 360
   SCRIPT 02 - MEJORAS ADMINISTRADOR
   ---------------------------------------------------------
   Objetivo:
   - Agregar columnas faltantes para pantallas Admin.
   - Mantener compatibilidad con la BD actual.
   - No borrar data existente.
   - Preparar backend real: reportes, SLA, integraciones,
     respaldo, auditoría, configuración y catálogos UI.
========================================================= */

USE CLARO_ATENCION_360;
GO

/* =========================================================
   1. USUARIOS
========================================================= */

IF COL_LENGTH('dbo.usuarios', 'motivo_ultimo_cambio') IS NULL
BEGIN
    ALTER TABLE dbo.usuarios
    ADD motivo_ultimo_cambio NVARCHAR(500) NULL;
END
GO

IF COL_LENGTH('dbo.usuarios', 'reset_token') IS NULL
BEGIN
    ALTER TABLE dbo.usuarios
    ADD reset_token NVARCHAR(200) NULL;
END
GO

IF COL_LENGTH('dbo.usuarios', 'reset_token_expira') IS NULL
BEGIN
    ALTER TABLE dbo.usuarios
    ADD reset_token_expira DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.usuarios', 'ultimo_ip') IS NULL
BEGIN
    ALTER TABLE dbo.usuarios
    ADD ultimo_ip NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.usuarios', 'ultimo_user_agent') IS NULL
BEGIN
    ALTER TABLE dbo.usuarios
    ADD ultimo_user_agent NVARCHAR(500) NULL;
END
GO


/* =========================================================
   2. ROLES
========================================================= */

IF COL_LENGTH('dbo.roles', 'alcance_funcional') IS NULL
BEGIN
    ALTER TABLE dbo.roles
    ADD alcance_funcional NVARCHAR(150) NULL;
END
GO

IF COL_LENGTH('dbo.roles', 'nivel_acceso') IS NULL
BEGIN
    ALTER TABLE dbo.roles
    ADD nivel_acceso NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.roles', 'es_sistema') IS NULL
BEGIN
    ALTER TABLE dbo.roles
    ADD es_sistema BIT NOT NULL DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.roles', 'fecha_actualizacion') IS NULL
BEGIN
    ALTER TABLE dbo.roles
    ADD fecha_actualizacion DATETIME2 NULL;
END
GO


/* =========================================================
   3. PERMISOS
========================================================= */

IF COL_LENGTH('dbo.permisos', 'codigo') IS NULL
BEGIN
    ALTER TABLE dbo.permisos
    ADD codigo NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.permisos', 'riesgo') IS NULL
BEGIN
    ALTER TABLE dbo.permisos
    ADD riesgo NVARCHAR(30) NULL;
END
GO

IF COL_LENGTH('dbo.permisos', 'orden') IS NULL
BEGIN
    ALTER TABLE dbo.permisos
    ADD orden INT NULL;
END
GO


/* =========================================================
   4. REGLAS SLA ADMIN
========================================================= */

IF COL_LENGTH('dbo.reglas_sla_admin', 'categoria') IS NULL
BEGIN
    ALTER TABLE dbo.reglas_sla_admin
    ADD categoria NVARCHAR(150) NULL;
END
GO

IF COL_LENGTH('dbo.reglas_sla_admin', 'tiempo_sla_minutos') IS NULL
BEGIN
    ALTER TABLE dbo.reglas_sla_admin
    ADD tiempo_sla_minutos INT NULL;
END
GO

IF COL_LENGTH('dbo.reglas_sla_admin', 'alerta_minutos') IS NULL
BEGIN
    ALTER TABLE dbo.reglas_sla_admin
    ADD alerta_minutos INT NULL;
END
GO

IF COL_LENGTH('dbo.reglas_sla_admin', 'vigencia_inicio') IS NULL
BEGIN
    ALTER TABLE dbo.reglas_sla_admin
    ADD vigencia_inicio DATE NULL;
END
GO

IF COL_LENGTH('dbo.reglas_sla_admin', 'vigencia_fin') IS NULL
BEGIN
    ALTER TABLE dbo.reglas_sla_admin
    ADD vigencia_fin DATE NULL;
END
GO

IF COL_LENGTH('dbo.reglas_sla_admin', 'area_escalamiento') IS NULL
BEGIN
    ALTER TABLE dbo.reglas_sla_admin
    ADD area_escalamiento NVARCHAR(150) NULL;
END
GO

IF COL_LENGTH('dbo.reglas_sla_admin', 'nivel_escalamiento') IS NULL
BEGIN
    ALTER TABLE dbo.reglas_sla_admin
    ADD nivel_escalamiento NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.reglas_sla_admin', 'validacion_estado') IS NULL
BEGIN
    ALTER TABLE dbo.reglas_sla_admin
    ADD validacion_estado NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH('dbo.reglas_sla_admin', 'validacion_mensaje') IS NULL
BEGIN
    ALTER TABLE dbo.reglas_sla_admin
    ADD validacion_mensaje NVARCHAR(1000) NULL;
END
GO

IF COL_LENGTH('dbo.reglas_sla_admin', 'motivo_ultimo_cambio') IS NULL
BEGIN
    ALTER TABLE dbo.reglas_sla_admin
    ADD motivo_ultimo_cambio NVARCHAR(500) NULL;
END
GO


/* =========================================================
   5. INTEGRACIONES
========================================================= */

IF COL_LENGTH('dbo.integraciones_sistema', 'ambiente') IS NULL
BEGIN
    ALTER TABLE dbo.integraciones_sistema
    ADD ambiente NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.integraciones_sistema', 'metodo_autenticacion') IS NULL
BEGIN
    ALTER TABLE dbo.integraciones_sistema
    ADD metodo_autenticacion NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.integraciones_sistema', 'timeout_segundos') IS NULL
BEGIN
    ALTER TABLE dbo.integraciones_sistema
    ADD timeout_segundos INT NULL;
END
GO

IF COL_LENGTH('dbo.integraciones_sistema', 'politica_reintentos') IS NULL
BEGIN
    ALTER TABLE dbo.integraciones_sistema
    ADD politica_reintentos NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.integraciones_sistema', 'metodo_http') IS NULL
BEGIN
    ALTER TABLE dbo.integraciones_sistema
    ADD metodo_http NVARCHAR(20) NULL;
END
GO

IF COL_LENGTH('dbo.integraciones_sistema', 'codigo_http') IS NULL
BEGIN
    ALTER TABLE dbo.integraciones_sistema
    ADD codigo_http INT NULL;
END
GO

IF COL_LENGTH('dbo.integraciones_sistema', 'latencia_ms') IS NULL
BEGIN
    ALTER TABLE dbo.integraciones_sistema
    ADD latencia_ms INT NULL;
END
GO

IF COL_LENGTH('dbo.integraciones_sistema', 'ultima_prueba') IS NULL
BEGIN
    ALTER TABLE dbo.integraciones_sistema
    ADD ultima_prueba DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.integraciones_sistema', 'resultado_ultima_prueba') IS NULL
BEGIN
    ALTER TABLE dbo.integraciones_sistema
    ADD resultado_ultima_prueba NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.integraciones_sistema', 'credencial_alias') IS NULL
BEGIN
    ALTER TABLE dbo.integraciones_sistema
    ADD credencial_alias NVARCHAR(150) NULL;
END
GO

IF COL_LENGTH('dbo.integraciones_sistema', 'motivo_ultimo_cambio') IS NULL
BEGIN
    ALTER TABLE dbo.integraciones_sistema
    ADD motivo_ultimo_cambio NVARCHAR(500) NULL;
END
GO


/* =========================================================
   6. EVENTOS DE INTEGRACIÓN
========================================================= */

IF COL_LENGTH('dbo.eventos_integracion', 'codigo_http') IS NULL
BEGIN
    ALTER TABLE dbo.eventos_integracion
    ADD codigo_http INT NULL;
END
GO

IF COL_LENGTH('dbo.eventos_integracion', 'latencia_ms') IS NULL
BEGIN
    ALTER TABLE dbo.eventos_integracion
    ADD latencia_ms INT NULL;
END
GO

IF COL_LENGTH('dbo.eventos_integracion', 'endpoint') IS NULL
BEGIN
    ALTER TABLE dbo.eventos_integracion
    ADD endpoint NVARCHAR(500) NULL;
END
GO

IF COL_LENGTH('dbo.eventos_integracion', 'request_id') IS NULL
BEGIN
    ALTER TABLE dbo.eventos_integracion
    ADD request_id NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.eventos_integracion', 'respuesta') IS NULL
BEGIN
    ALTER TABLE dbo.eventos_integracion
    ADD respuesta NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.eventos_integracion', 'nivel') IS NULL
BEGIN
    ALTER TABLE dbo.eventos_integracion
    ADD nivel NVARCHAR(30) NULL;
END
GO


/* =========================================================
   7. REPORTES
========================================================= */

IF COL_LENGTH('dbo.reportes', 'archivo_nombre') IS NULL
BEGIN
    ALTER TABLE dbo.reportes
    ADD archivo_nombre NVARCHAR(255) NULL;
END
GO

IF COL_LENGTH('dbo.reportes', 'archivo_ruta') IS NULL
BEGIN
    ALTER TABLE dbo.reportes
    ADD archivo_ruta NVARCHAR(600) NULL;
END
GO

IF COL_LENGTH('dbo.reportes', 'mime_type') IS NULL
BEGIN
    ALTER TABLE dbo.reportes
    ADD mime_type NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.reportes', 'tamano_bytes') IS NULL
BEGIN
    ALTER TABLE dbo.reportes
    ADD tamano_bytes BIGINT NULL;
END
GO

IF COL_LENGTH('dbo.reportes', 'filtros_json') IS NULL
BEGIN
    ALTER TABLE dbo.reportes
    ADD filtros_json NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.reportes', 'secciones_json') IS NULL
BEGIN
    ALTER TABLE dbo.reportes
    ADD secciones_json NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.reportes', 'frecuencia') IS NULL
BEGIN
    ALTER TABLE dbo.reportes
    ADD frecuencia NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.reportes', 'hora_envio') IS NULL
BEGIN
    ALTER TABLE dbo.reportes
    ADD hora_envio TIME NULL;
END
GO

IF COL_LENGTH('dbo.reportes', 'destinatarios') IS NULL
BEGIN
    ALTER TABLE dbo.reportes
    ADD destinatarios NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.reportes', 'token_compartido') IS NULL
BEGIN
    ALTER TABLE dbo.reportes
    ADD token_compartido NVARCHAR(200) NULL;
END
GO

IF COL_LENGTH('dbo.reportes', 'url_compartida') IS NULL
BEGIN
    ALTER TABLE dbo.reportes
    ADD url_compartida NVARCHAR(600) NULL;
END
GO

IF COL_LENGTH('dbo.reportes', 'fecha_expiracion') IS NULL
BEGIN
    ALTER TABLE dbo.reportes
    ADD fecha_expiracion DATETIME2 NULL;
END
GO


/* =========================================================
   8. RESPALDOS
========================================================= */

IF COL_LENGTH('dbo.respaldos_sistema', 'frecuencia') IS NULL
BEGIN
    ALTER TABLE dbo.respaldos_sistema
    ADD frecuencia NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.respaldos_sistema', 'ventana_ejecucion') IS NULL
BEGIN
    ALTER TABLE dbo.respaldos_sistema
    ADD ventana_ejecucion NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.respaldos_sistema', 'retencion') IS NULL
BEGIN
    ALTER TABLE dbo.respaldos_sistema
    ADD retencion NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.respaldos_sistema', 'destino') IS NULL
BEGIN
    ALTER TABLE dbo.respaldos_sistema
    ADD destino NVARCHAR(150) NULL;
END
GO

IF COL_LENGTH('dbo.respaldos_sistema', 'rpo') IS NULL
BEGIN
    ALTER TABLE dbo.respaldos_sistema
    ADD rpo NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.respaldos_sistema', 'rto') IS NULL
BEGIN
    ALTER TABLE dbo.respaldos_sistema
    ADD rto NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.respaldos_sistema', 'hash_integridad') IS NULL
BEGIN
    ALTER TABLE dbo.respaldos_sistema
    ADD hash_integridad NVARCHAR(200) NULL;
END
GO

IF COL_LENGTH('dbo.respaldos_sistema', 'duracion_segundos') IS NULL
BEGIN
    ALTER TABLE dbo.respaldos_sistema
    ADD duracion_segundos INT NULL;
END
GO

IF COL_LENGTH('dbo.respaldos_sistema', 'log_resumen') IS NULL
BEGIN
    ALTER TABLE dbo.respaldos_sistema
    ADD log_resumen NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.respaldos_sistema', 'fecha_validacion') IS NULL
BEGIN
    ALTER TABLE dbo.respaldos_sistema
    ADD fecha_validacion DATETIME2 NULL;
END
GO

IF COL_LENGTH('dbo.respaldos_sistema', 'fecha_actualizacion') IS NULL
BEGIN
    ALTER TABLE dbo.respaldos_sistema
    ADD fecha_actualizacion DATETIME2 NULL;
END
GO


/* =========================================================
   9. PRUEBAS DE RESTAURACIÓN
========================================================= */

IF COL_LENGTH('dbo.pruebas_restauracion', 'respaldo_id') IS NULL
BEGIN
    ALTER TABLE dbo.pruebas_restauracion
    ADD respaldo_id INT NULL;
END
GO

IF COL_LENGTH('dbo.pruebas_restauracion', 'tipo_prueba') IS NULL
BEGIN
    ALTER TABLE dbo.pruebas_restauracion
    ADD tipo_prueba NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.pruebas_restauracion', 'ambiente') IS NULL
BEGIN
    ALTER TABLE dbo.pruebas_restauracion
    ADD ambiente NVARCHAR(100) NULL;
END
GO

IF COL_LENGTH('dbo.pruebas_restauracion', 'responsable') IS NULL
BEGIN
    ALTER TABLE dbo.pruebas_restauracion
    ADD responsable NVARCHAR(150) NULL;
END
GO

IF COL_LENGTH('dbo.pruebas_restauracion', 'fecha_objetivo') IS NULL
BEGIN
    ALTER TABLE dbo.pruebas_restauracion
    ADD fecha_objetivo DATE NULL;
END
GO

IF COL_LENGTH('dbo.pruebas_restauracion', 'alcance') IS NULL
BEGIN
    ALTER TABLE dbo.pruebas_restauracion
    ADD alcance NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.pruebas_restauracion', 'resultado') IS NULL
BEGIN
    ALTER TABLE dbo.pruebas_restauracion
    ADD resultado NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.pruebas_restauracion', 'duracion_minutos') IS NULL
BEGIN
    ALTER TABLE dbo.pruebas_restauracion
    ADD duracion_minutos INT NULL;
END
GO

IF COL_LENGTH('dbo.pruebas_restauracion', 'fecha_ejecucion') IS NULL
BEGIN
    ALTER TABLE dbo.pruebas_restauracion
    ADD fecha_ejecucion DATETIME2 NULL;
END
GO


/* =========================================================
   10. AUDITORÍA ADMIN
========================================================= */

IF COL_LENGTH('dbo.auditoria_admin', 'motivo') IS NULL
BEGIN
    ALTER TABLE dbo.auditoria_admin
    ADD motivo NVARCHAR(500) NULL;
END
GO

IF COL_LENGTH('dbo.auditoria_admin', 'entidad') IS NULL
BEGIN
    ALTER TABLE dbo.auditoria_admin
    ADD entidad NVARCHAR(150) NULL;
END
GO

IF COL_LENGTH('dbo.auditoria_admin', 'entidad_id') IS NULL
BEGIN
    ALTER TABLE dbo.auditoria_admin
    ADD entidad_id NVARCHAR(80) NULL;
END
GO

IF COL_LENGTH('dbo.auditoria_admin', 'valor_anterior_json') IS NULL
BEGIN
    ALTER TABLE dbo.auditoria_admin
    ADD valor_anterior_json NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.auditoria_admin', 'valor_nuevo_json') IS NULL
BEGIN
    ALTER TABLE dbo.auditoria_admin
    ADD valor_nuevo_json NVARCHAR(MAX) NULL;
END
GO

IF COL_LENGTH('dbo.auditoria_admin', 'correlacion_id') IS NULL
BEGIN
    ALTER TABLE dbo.auditoria_admin
    ADD correlacion_id NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.auditoria_admin', 'sensibilidad') IS NULL
BEGIN
    ALTER TABLE dbo.auditoria_admin
    ADD sensibilidad NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH('dbo.auditoria_admin', 'user_agent') IS NULL
BEGIN
    ALTER TABLE dbo.auditoria_admin
    ADD user_agent NVARCHAR(500) NULL;
END
GO


/* =========================================================
   11. ALERTAS
========================================================= */

IF COL_LENGTH('dbo.alertas_sistema', 'accion') IS NULL
BEGIN
    ALTER TABLE dbo.alertas_sistema
    ADD accion NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.alertas_sistema', 'prioridad') IS NULL
BEGIN
    ALTER TABLE dbo.alertas_sistema
    ADD prioridad NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH('dbo.alertas_sistema', 'motivo_revision') IS NULL
BEGIN
    ALTER TABLE dbo.alertas_sistema
    ADD motivo_revision NVARCHAR(500) NULL;
END
GO

IF COL_LENGTH('dbo.alertas_sistema', 'entidad') IS NULL
BEGIN
    ALTER TABLE dbo.alertas_sistema
    ADD entidad NVARCHAR(150) NULL;
END
GO

IF COL_LENGTH('dbo.alertas_sistema', 'entidad_id') IS NULL
BEGIN
    ALTER TABLE dbo.alertas_sistema
    ADD entidad_id NVARCHAR(80) NULL;
END
GO


/* =========================================================
   12. CONFIGURACIONES
========================================================= */

IF COL_LENGTH('dbo.configuraciones_sistema', 'categoria') IS NULL
BEGIN
    ALTER TABLE dbo.configuraciones_sistema
    ADD categoria NVARCHAR(120) NULL;
END
GO

IF COL_LENGTH('dbo.configuraciones_sistema', 'tipo_valor') IS NULL
BEGIN
    ALTER TABLE dbo.configuraciones_sistema
    ADD tipo_valor NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH('dbo.configuraciones_sistema', 'es_sensible') IS NULL
BEGIN
    ALTER TABLE dbo.configuraciones_sistema
    ADD es_sensible BIT NOT NULL DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.configuraciones_sistema', 'actualizado_por_usuario_id') IS NULL
BEGIN
    ALTER TABLE dbo.configuraciones_sistema
    ADD actualizado_por_usuario_id INT NULL;
END
GO


/* =========================================================
   13. TABLA PARA PROGRAMACIÓN DE REPORTES
========================================================= */

IF OBJECT_ID('dbo.programaciones_reportes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.programaciones_reportes (
        programacion_id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(200) NOT NULL,
        tipo NVARCHAR(120) NOT NULL,
        periodo NVARCHAR(120) NOT NULL,
        alcance NVARCHAR(200) NULL,
        formato NVARCHAR(80) NOT NULL,
        frecuencia NVARCHAR(80) NOT NULL,
        hora_envio TIME NULL,
        destinatarios NVARCHAR(MAX) NOT NULL,
        filtros_json NVARCHAR(MAX) NULL,
        secciones_json NVARCHAR(MAX) NULL,
        estado NVARCHAR(50) NOT NULL DEFAULT 'Activa',
        creado_por_usuario_id INT NULL,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        fecha_actualizacion DATETIME2 NULL,
        ultima_ejecucion DATETIME2 NULL,
        proxima_ejecucion DATETIME2 NULL
    );
END
GO


/* =========================================================
   14. TABLA PARA ARCHIVOS ADMIN GENERADOS
========================================================= */

IF OBJECT_ID('dbo.archivos_admin', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.archivos_admin (
        archivo_id INT IDENTITY(1,1) PRIMARY KEY,
        modulo NVARCHAR(120) NOT NULL,
        entidad NVARCHAR(150) NULL,
        entidad_id NVARCHAR(80) NULL,
        nombre NVARCHAR(255) NOT NULL,
        formato NVARCHAR(50) NOT NULL,
        mime_type NVARCHAR(120) NOT NULL,
        archivo_ruta NVARCHAR(700) NULL,
        contenido VARBINARY(MAX) NULL,
        tamano_bytes BIGINT NULL,
        parametros_json NVARCHAR(MAX) NULL,
        generado_por_usuario_id INT NULL,
        estado NVARCHAR(50) NOT NULL DEFAULT 'Generado',
        fecha_generacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        fecha_expiracion DATETIME2 NULL
    );
END
GO


/* =========================================================
   15. CATÁLOGOS UI - OPCIONES ADMINISTRADOR
   ---------------------------------------------------------
   Esta tabla ya existe en tu script actual.
   Aquí agregamos opciones usadas por las pantallas.
========================================================= */

IF OBJECT_ID('dbo.catalogos_ui', 'U') IS NOT NULL
BEGIN
    /* Formatos de exportación */
    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'formatos_exportacion' AND codigo = 'PDF')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('formatos_exportacion', 'PDF', 'PDF', 'Documento PDF', 1, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'formatos_exportacion' AND codigo = 'WORD')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('formatos_exportacion', 'WORD', 'Word', 'Documento Word .docx', 2, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'formatos_exportacion' AND codigo = 'EXCEL')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('formatos_exportacion', 'EXCEL', 'Excel', 'Libro Excel .xlsx', 3, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'formatos_exportacion' AND codigo = 'CSV')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('formatos_exportacion', 'CSV', 'CSV', 'Archivo separado por comas', 4, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'formatos_exportacion' AND codigo = 'PNG')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('formatos_exportacion', 'PNG', 'Imagen PNG', 'Imagen del tablero o reporte', 5, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'formatos_exportacion' AND codigo = 'DASHBOARD')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('formatos_exportacion', 'DASHBOARD', 'Dashboard compartible', 'Link temporal con token', 6, 1, SYSDATETIME());


    /* Ambientes */
    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'ambientes' AND codigo = 'PROD')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('ambientes', 'PROD', 'Producción', 'Ambiente productivo', 1, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'ambientes' AND codigo = 'PRE')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('ambientes', 'PRE', 'Preproducción', 'Ambiente preproductivo', 2, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'ambientes' AND codigo = 'QA')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('ambientes', 'QA', 'QA', 'Ambiente de pruebas', 3, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'ambientes' AND codigo = 'DEV')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('ambientes', 'DEV', 'Desarrollo', 'Ambiente de desarrollo', 4, 1, SYSDATETIME());


    /* Criticidades */
    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'criticidades' AND codigo = 'CRITICA')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('criticidades', 'CRITICA', 'Crítica', 'Impacto crítico en operación', 1, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'criticidades' AND codigo = 'ALTA')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('criticidades', 'ALTA', 'Alta', 'Impacto alto en operación', 2, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'criticidades' AND codigo = 'MEDIA')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('criticidades', 'MEDIA', 'Media', 'Impacto medio', 3, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'criticidades' AND codigo = 'BAJA')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('criticidades', 'BAJA', 'Baja', 'Impacto bajo', 4, 1, SYSDATETIME());


    /* Frecuencias */
    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'frecuencias' AND codigo = 'DIARIO')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('frecuencias', 'DIARIO', 'Diario', 'Ejecución diaria', 1, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'frecuencias' AND codigo = 'SEMANAL')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('frecuencias', 'SEMANAL', 'Semanal', 'Ejecución semanal', 2, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'frecuencias' AND codigo = 'MENSUAL')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('frecuencias', 'MENSUAL', 'Mensual', 'Ejecución mensual', 3, 1, SYSDATETIME());


    /* Métodos de autenticación */
    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'metodos_autenticacion' AND codigo = 'API_KEY')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('metodos_autenticacion', 'API_KEY', 'API Key', 'Autenticación por llave API', 1, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'metodos_autenticacion' AND codigo = 'BEARER')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('metodos_autenticacion', 'BEARER', 'Bearer Token', 'Autenticación por token', 2, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'metodos_autenticacion' AND codigo = 'OAUTH2')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('metodos_autenticacion', 'OAUTH2', 'OAuth 2.0', 'Autenticación OAuth 2.0', 3, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'metodos_autenticacion' AND codigo = 'BASIC')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('metodos_autenticacion', 'BASIC', 'Basic Auth', 'Usuario y contraseña', 4, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'metodos_autenticacion' AND codigo = 'CERT')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('metodos_autenticacion', 'CERT', 'Certificado', 'Autenticación por certificado', 5, 1, SYSDATETIME());


    /* Políticas de acceso */
    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'tipos_acceso_usuario' AND codigo = 'ESTANDAR')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('tipos_acceso_usuario', 'ESTANDAR', 'Acceso estándar', 'Acceso base', 1, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'tipos_acceso_usuario' AND codigo = 'OPERATIVO')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('tipos_acceso_usuario', 'OPERATIVO', 'Acceso operativo', 'Acceso para operación', 2, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'tipos_acceso_usuario' AND codigo = 'SUPERVISOR')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('tipos_acceso_usuario', 'SUPERVISOR', 'Acceso supervisor', 'Acceso de supervisión', 3, 1, SYSDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.catalogos_ui WHERE grupo = 'tipos_acceso_usuario' AND codigo = 'ADMIN')
        INSERT INTO dbo.catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo, fecha_creacion)
        VALUES ('tipos_acceso_usuario', 'ADMIN', 'Acceso administrativo', 'Acceso crítico de administración', 4, 1, SYSDATETIME());
END
GO


/* =========================================================
   16. ÍNDICES RECOMENDADOS
========================================================= */

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_auditoria_admin_fecha_modulo'
      AND object_id = OBJECT_ID('dbo.auditoria_admin')
)
BEGIN
    CREATE INDEX IX_auditoria_admin_fecha_modulo
    ON dbo.auditoria_admin (fecha_evento DESC, modulo);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_alertas_sistema_estado_fecha'
      AND object_id = OBJECT_ID('dbo.alertas_sistema')
)
BEGIN
    CREATE INDEX IX_alertas_sistema_estado_fecha
    ON dbo.alertas_sistema (estado, fecha_creacion DESC);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_integraciones_estado_criticidad'
      AND object_id = OBJECT_ID('dbo.integraciones_sistema')
)
BEGIN
    CREATE INDEX IX_integraciones_estado_criticidad
    ON dbo.integraciones_sistema (estado, criticidad);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_reglas_sla_estado_prioridad'
      AND object_id = OBJECT_ID('dbo.reglas_sla_admin')
)
BEGIN
    CREATE INDEX IX_reglas_sla_estado_prioridad
    ON dbo.reglas_sla_admin (estado, prioridad);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_reportes_estado_fecha'
      AND object_id = OBJECT_ID('dbo.reportes')
)
BEGIN
    CREATE INDEX IX_reportes_estado_fecha
    ON dbo.reportes (estado, fecha_generacion DESC);
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_respaldos_estado_fecha'
      AND object_id = OBJECT_ID('dbo.respaldos_sistema')
)
BEGIN
    CREATE INDEX IX_respaldos_estado_fecha
    ON dbo.respaldos_sistema (estado, fecha_ejecucion DESC);
END
GO


/* =========================================================
   FIN SCRIPT 02
========================================================= */

PRINT 'SCRIPT 02_ADMIN_MEJORAS_ESTRUCTURA ejecutado correctamente.';
GO