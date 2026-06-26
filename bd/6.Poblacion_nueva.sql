USE ClaroAtencion360;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

/* =========================================================
   1. VARIABLES BASE
========================================================= */

DECLARE @admin_id INT = (
    SELECT TOP 1 usuario_id
    FROM usuarios
    WHERE username = N'admin.sistema'
);

DECLARE @supervisor_id INT = (
    SELECT TOP 1 usuario_id
    FROM usuarios
    WHERE username IN (N'carolina.vargas', N'miguel.torres')
    ORDER BY usuario_id
);

DECLARE @asesor_id INT = (
    SELECT TOP 1 usuario_id
    FROM usuarios
    WHERE username IN (N'valeria.mendoza', N'jose.quispe', N'luis.ramirez', N'diego.castillo')
    ORDER BY usuario_id
);

IF @admin_id IS NULL
    SET @admin_id = (SELECT TOP 1 usuario_id FROM usuarios ORDER BY usuario_id);

IF @supervisor_id IS NULL
    SET @supervisor_id = @admin_id;

IF @asesor_id IS NULL
    SET @asesor_id = @admin_id;


/* =========================================================
   2. CATÁLOGOS UI FALTANTES PARA ADMIN
   El backend usa grupos en plural:
   formatos_exportacion, ambientes, criticidades,
   frecuencias, metodos_autenticacion, tipos_acceso_usuario
========================================================= */

IF OBJECT_ID('dbo.catalogos_ui', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'formatos_exportacion' AND codigo = N'PDF')
    BEGIN
        INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
        VALUES
        (N'formatos_exportacion', N'PDF', N'PDF', N'Documento PDF profesional.', 1, 1),
        (N'formatos_exportacion', N'WORD', N'Word', N'Documento editable Word .docx.', 2, 1),
        (N'formatos_exportacion', N'EXCEL', N'Excel', N'Archivo Excel .xlsx para análisis.', 3, 1),
        (N'formatos_exportacion', N'CSV', N'CSV', N'Archivo plano separado por comas.', 4, 1),
        (N'formatos_exportacion', N'PNG', N'Imagen PNG', N'Imagen del reporte o dashboard.', 5, 1),
        (N'formatos_exportacion', N'DASHBOARD', N'Dashboard compartible', N'Enlace temporal con token.', 6, 1);
    END;

    IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'ambientes' AND codigo = N'PROD')
    BEGIN
        INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
        VALUES
        (N'ambientes', N'PROD', N'Producción', N'Ambiente productivo.', 1, 1),
        (N'ambientes', N'PRE', N'Preproducción', N'Ambiente previo a producción.', 2, 1),
        (N'ambientes', N'QA', N'QA', N'Ambiente de pruebas.', 3, 1),
        (N'ambientes', N'DEV', N'Desarrollo', N'Ambiente de desarrollo.', 4, 1);
    END;

    IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'criticidades' AND codigo = N'CRITICA')
    BEGIN
        INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
        VALUES
        (N'criticidades', N'CRITICA', N'Crítica', N'Impacto crítico en operación.', 1, 1),
        (N'criticidades', N'ALTA', N'Alta', N'Impacto alto.', 2, 1),
        (N'criticidades', N'MEDIA', N'Media', N'Impacto medio.', 3, 1),
        (N'criticidades', N'BAJA', N'Baja', N'Impacto bajo.', 4, 1);
    END;

    IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'frecuencias' AND codigo = N'DIARIO')
    BEGIN
        INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
        VALUES
        (N'frecuencias', N'DIARIO', N'Diario', N'Ejecución diaria.', 1, 1),
        (N'frecuencias', N'SEMANAL', N'Semanal', N'Ejecución semanal.', 2, 1),
        (N'frecuencias', N'MENSUAL', N'Mensual', N'Ejecución mensual.', 3, 1),
        (N'frecuencias', N'BAJO_DEMANDA', N'Bajo demanda', N'Ejecución manual.', 4, 1);
    END;

    IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'metodos_autenticacion' AND codigo = N'API_KEY')
    BEGIN
        INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
        VALUES
        (N'metodos_autenticacion', N'API_KEY', N'API Key', N'Autenticación por llave API.', 1, 1),
        (N'metodos_autenticacion', N'BEARER', N'Bearer Token', N'Autenticación por token.', 2, 1),
        (N'metodos_autenticacion', N'OAUTH2', N'OAuth 2.0', N'Autenticación OAuth 2.0.', 3, 1),
        (N'metodos_autenticacion', N'BASIC', N'Basic Auth', N'Usuario y contraseña.', 4, 1),
        (N'metodos_autenticacion', N'CERT', N'Certificado', N'Autenticación por certificado.', 5, 1);
    END;

    IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'tipos_acceso_usuario' AND codigo = N'ADMIN')
    BEGIN
        INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
        VALUES
        (N'tipos_acceso_usuario', N'ESTANDAR', N'Acceso estándar', N'Acceso base del sistema.', 1, 1),
        (N'tipos_acceso_usuario', N'OPERATIVO', N'Acceso operativo', N'Acceso para asesores.', 2, 1),
        (N'tipos_acceso_usuario', N'SUPERVISOR', N'Acceso supervisor', N'Acceso de supervisión.', 3, 1),
        (N'tipos_acceso_usuario', N'ADMIN', N'Acceso administrativo', N'Acceso crítico de administración.', 4, 1);
    END;
END;


/* =========================================================
   3. NORMALIZAR ENDPOINTS DE INTEGRACIONES
   Tu población inicial tenía endpoints sin http/https.
   El service.py valida y prueba mejor con URLs completas.
========================================================= */

IF OBJECT_ID('dbo.integraciones_sistema', 'U') IS NOT NULL
BEGIN
    UPDATE integraciones_sistema
    SET endpoint = N'https://smtp.claro360.local/api/status'
    WHERE nombre = N'Correo transaccional'
      AND endpoint NOT LIKE N'http%';

    UPDATE integraciones_sistema
    SET endpoint = N'https://auth.claro360.local/api/health'
    WHERE nombre = N'Autenticación de usuarios'
      AND endpoint NOT LIKE N'http%';

    UPDATE integraciones_sistema
    SET endpoint = N'https://billing.claro360.local/api/status'
    WHERE nombre = N'API de facturación'
      AND endpoint NOT LIKE N'http%';

    UPDATE integraciones_sistema
    SET endpoint = N'https://technical.claro360.local/api/status'
    WHERE nombre = N'API de servicios técnicos'
      AND endpoint NOT LIKE N'http%';

    UPDATE integraciones_sistema
    SET endpoint = N'https://webhooks.claro360.local/api/events'
    WHERE nombre = N'Webhooks de notificación'
      AND endpoint NOT LIKE N'http%';
END;


/* =========================================================
   4. COMPLETAR CAMPOS NUEVOS DE INTEGRACIONES
========================================================= */

IF OBJECT_ID('dbo.integraciones_sistema', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.integraciones_sistema', 'ambiente') IS NOT NULL
    BEGIN
        UPDATE integraciones_sistema
        SET ambiente = ISNULL(ambiente, N'Producción')
        WHERE ambiente IS NULL;
    END;

    IF COL_LENGTH('dbo.integraciones_sistema', 'metodo_autenticacion') IS NOT NULL
    BEGIN
        UPDATE integraciones_sistema
        SET metodo_autenticacion = ISNULL(metodo_autenticacion, N'API Key')
        WHERE metodo_autenticacion IS NULL;
    END;

    IF COL_LENGTH('dbo.integraciones_sistema', 'timeout_segundos') IS NOT NULL
    BEGIN
        UPDATE integraciones_sistema
        SET timeout_segundos = ISNULL(timeout_segundos, 30)
        WHERE timeout_segundos IS NULL;
    END;

    IF COL_LENGTH('dbo.integraciones_sistema', 'politica_reintentos') IS NOT NULL
    BEGIN
        UPDATE integraciones_sistema
        SET politica_reintentos = ISNULL(politica_reintentos, N'3 reintentos')
        WHERE politica_reintentos IS NULL;
    END;

    IF COL_LENGTH('dbo.integraciones_sistema', 'metodo_http') IS NOT NULL
    BEGIN
        UPDATE integraciones_sistema
        SET metodo_http = ISNULL(metodo_http, N'GET')
        WHERE metodo_http IS NULL;
    END;

    IF COL_LENGTH('dbo.integraciones_sistema', 'codigo_http') IS NOT NULL
    BEGIN
        UPDATE integraciones_sistema
        SET codigo_http =
            CASE
                WHEN estado = N'Con alerta' THEN 202
                WHEN estado = N'Error' THEN 500
                ELSE 200
            END
        WHERE codigo_http IS NULL;
    END;

    IF COL_LENGTH('dbo.integraciones_sistema', 'latencia_ms') IS NOT NULL
    BEGIN
        UPDATE integraciones_sistema
        SET latencia_ms =
            CASE
                WHEN estado = N'Con alerta' THEN 780
                WHEN estado = N'Error' THEN 1200
                ELSE 180
            END
        WHERE latencia_ms IS NULL;
    END;

    IF COL_LENGTH('dbo.integraciones_sistema', 'ultima_prueba') IS NOT NULL
    BEGIN
        UPDATE integraciones_sistema
        SET ultima_prueba = ISNULL(ultima_prueba, DATEADD(MINUTE, -30, SYSDATETIME()))
        WHERE ultima_prueba IS NULL;
    END;

    IF COL_LENGTH('dbo.integraciones_sistema', 'resultado_ultima_prueba') IS NOT NULL
    BEGIN
        UPDATE integraciones_sistema
        SET resultado_ultima_prueba =
            CASE
                WHEN estado = N'Con alerta' THEN N'Con alerta'
                WHEN estado = N'Error' THEN N'Fallido'
                ELSE N'Exitoso'
            END
        WHERE resultado_ultima_prueba IS NULL;
    END;

    IF COL_LENGTH('dbo.integraciones_sistema', 'credencial_alias') IS NOT NULL
    BEGIN
        UPDATE integraciones_sistema
        SET credencial_alias = ISNULL(credencial_alias, N'Credencial protegida')
        WHERE credencial_alias IS NULL;
    END;
END;


/* =========================================================
   5. NUEVAS INTEGRACIONES ADMIN REALISTAS
========================================================= */

IF OBJECT_ID('dbo.integraciones_sistema', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM integraciones_sistema WHERE nombre = N'Pasarela SMS')
    BEGIN
        INSERT INTO integraciones_sistema (
            nombre,
            tipo,
            estado,
            criticidad,
            endpoint,
            descripcion,
            responsable,
            ultima_sincronizacion,
            creado_por_usuario_id,
            fecha_creacion,
            fecha_actualizacion
        )
        VALUES
        (
            N'Pasarela SMS',
            N'SMS',
            N'Activa',
            N'Media',
            N'https://sms.claro360.local/api/status',
            N'Envío de mensajes SMS para alertas de caso y verificación.',
            N'Administración',
            DATEADD(MINUTE, -18, SYSDATETIME()),
            @admin_id,
            SYSDATETIME(),
            SYSDATETIME()
        );
    END;

    IF NOT EXISTS (SELECT 1 FROM integraciones_sistema WHERE nombre = N'Motor de SLA')
    BEGIN
        INSERT INTO integraciones_sistema (
            nombre,
            tipo,
            estado,
            criticidad,
            endpoint,
            descripcion,
            responsable,
            ultima_sincronizacion,
            creado_por_usuario_id,
            fecha_creacion,
            fecha_actualizacion
        )
        VALUES
        (
            N'Motor de SLA',
            N'Servicio interno',
            N'Activa',
            N'Alta',
            N'https://sla.claro360.local/api/health',
            N'Servicio interno para cálculo de vencimientos, alertas y escalamiento SLA.',
            N'Supervisión',
            DATEADD(MINUTE, -8, SYSDATETIME()),
            @admin_id,
            SYSDATETIME(),
            SYSDATETIME()
        );
    END;
END;


/* =========================================================
   6. EVENTOS DE INTEGRACIÓN MÁS COMPLETOS
========================================================= */

IF OBJECT_ID('dbo.eventos_integracion', 'U') IS NOT NULL
BEGIN
    INSERT INTO eventos_integracion (
        integracion_id,
        titulo,
        descripcion,
        estado,
        fecha_evento
    )
    SELECT
        i.integracion_id,
        N'Prueba automática registrada',
        CONCAT(N'Prueba de salud ejecutada para ', i.nombre, N'. Estado actual: ', i.estado, N'.'),
        CASE
            WHEN i.estado = N'Activa' THEN N'Exitoso'
            WHEN i.estado = N'Con alerta' THEN N'Con alerta'
            ELSE N'Fallido'
        END,
        DATEADD(MINUTE, -10, SYSDATETIME())
    FROM integraciones_sistema i
    WHERE NOT EXISTS (
        SELECT 1
        FROM eventos_integracion e
        WHERE e.integracion_id = i.integracion_id
          AND e.titulo = N'Prueba automática registrada'
    );
END;


/* =========================================================
   7. COMPLETAR CAMPOS NUEVOS DE REGLAS SLA
========================================================= */

IF OBJECT_ID('dbo.reglas_sla_admin', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.reglas_sla_admin', 'categoria') IS NOT NULL
    BEGIN
        UPDATE reglas_sla_admin
        SET categoria =
            CASE
                WHEN tipo_caso LIKE N'%Incidencia%' THEN N'Técnico'
                WHEN tipo_caso LIKE N'%Reclamo%' THEN N'Reclamo'
                ELSE N'General'
            END
        WHERE categoria IS NULL;
    END;

    IF COL_LENGTH('dbo.reglas_sla_admin', 'tiempo_sla_minutos') IS NOT NULL
    BEGIN
        UPDATE reglas_sla_admin
        SET tiempo_sla_minutos =
            CASE
                WHEN tiempo_sla LIKE N'%72%' THEN 4320
                WHEN tiempo_sla LIKE N'%48%' THEN 2880
                WHEN tiempo_sla LIKE N'%24%' THEN 1440
                WHEN tiempo_sla LIKE N'%12%' THEN 720
                WHEN tiempo_sla LIKE N'%8%' THEN 480
                ELSE 1440
            END
        WHERE tiempo_sla_minutos IS NULL;
    END;

    IF COL_LENGTH('dbo.reglas_sla_admin', 'alerta_minutos') IS NOT NULL
    BEGIN
        UPDATE reglas_sla_admin
        SET alerta_minutos =
            CASE
                WHEN alerta LIKE N'%24%' THEN 1440
                WHEN alerta LIKE N'%12%' THEN 720
                WHEN alerta LIKE N'%6%' THEN 360
                WHEN alerta LIKE N'%3%' THEN 180
                WHEN alerta LIKE N'%2%' THEN 120
                ELSE 60
            END
        WHERE alerta_minutos IS NULL;
    END;

    IF COL_LENGTH('dbo.reglas_sla_admin', 'vigencia_inicio') IS NOT NULL
    BEGIN
        UPDATE reglas_sla_admin
        SET vigencia_inicio = CAST(SYSDATETIME() AS DATE)
        WHERE vigencia_inicio IS NULL;
    END;

    IF COL_LENGTH('dbo.reglas_sla_admin', 'vigencia_fin') IS NOT NULL
    BEGIN
        UPDATE reglas_sla_admin
        SET vigencia_fin = DATEADD(YEAR, 1, CAST(SYSDATETIME() AS DATE))
        WHERE vigencia_fin IS NULL;
    END;

    IF COL_LENGTH('dbo.reglas_sla_admin', 'area_escalamiento') IS NOT NULL
    BEGIN
        UPDATE reglas_sla_admin
        SET area_escalamiento =
            CASE
                WHEN prioridad IN (N'Crítica', N'Alta') THEN N'Supervisión'
                ELSE area
            END
        WHERE area_escalamiento IS NULL;
    END;

    IF COL_LENGTH('dbo.reglas_sla_admin', 'nivel_escalamiento') IS NOT NULL
    BEGIN
        UPDATE reglas_sla_admin
        SET nivel_escalamiento =
            CASE
                WHEN prioridad = N'Crítica' THEN N'Jefatura'
                WHEN prioridad = N'Alta' THEN N'Supervisor'
                ELSE N'Operativo'
            END
        WHERE nivel_escalamiento IS NULL;
    END;

    IF COL_LENGTH('dbo.reglas_sla_admin', 'validacion_estado') IS NOT NULL
    BEGIN
        UPDATE reglas_sla_admin
        SET validacion_estado = N'Correcta'
        WHERE validacion_estado IS NULL;
    END;

    IF COL_LENGTH('dbo.reglas_sla_admin', 'validacion_mensaje') IS NOT NULL
    BEGIN
        UPDATE reglas_sla_admin
        SET validacion_mensaje = N'Regla válida.'
        WHERE validacion_mensaje IS NULL;
    END;
END;


/* =========================================================
   8. RESPALDOS: COMPLETAR CAMPOS PROFESIONALES
========================================================= */

IF OBJECT_ID('dbo.respaldos_sistema', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.respaldos_sistema', 'frecuencia') IS NOT NULL
    BEGIN
        UPDATE respaldos_sistema
        SET frecuencia = ISNULL(frecuencia, N'Diario')
        WHERE frecuencia IS NULL;
    END;

    IF COL_LENGTH('dbo.respaldos_sistema', 'ventana_ejecucion') IS NOT NULL
    BEGIN
        UPDATE respaldos_sistema
        SET ventana_ejecucion = ISNULL(ventana_ejecucion, N'02:00 - 04:00')
        WHERE ventana_ejecucion IS NULL;
    END;

    IF COL_LENGTH('dbo.respaldos_sistema', 'retencion') IS NOT NULL
    BEGIN
        UPDATE respaldos_sistema
        SET retencion = ISNULL(retencion, N'30 días')
        WHERE retencion IS NULL;
    END;

    IF COL_LENGTH('dbo.respaldos_sistema', 'destino') IS NOT NULL
    BEGIN
        UPDATE respaldos_sistema
        SET destino = ISNULL(destino, ubicacion)
        WHERE destino IS NULL;
    END;

    IF COL_LENGTH('dbo.respaldos_sistema', 'rpo') IS NOT NULL
    BEGIN
        UPDATE respaldos_sistema
        SET rpo = ISNULL(rpo, N'24 horas')
        WHERE rpo IS NULL;
    END;

    IF COL_LENGTH('dbo.respaldos_sistema', 'rto') IS NOT NULL
    BEGIN
        UPDATE respaldos_sistema
        SET rto = ISNULL(rto, N'4 horas')
        WHERE rto IS NULL;
    END;

    IF COL_LENGTH('dbo.respaldos_sistema', 'hash_integridad') IS NOT NULL
    BEGIN
        UPDATE respaldos_sistema
        SET hash_integridad = ISNULL(hash_integridad, CONVERT(NVARCHAR(100), NEWID()))
        WHERE hash_integridad IS NULL;
    END;

    IF COL_LENGTH('dbo.respaldos_sistema', 'duracion_segundos') IS NOT NULL
    BEGIN
        UPDATE respaldos_sistema
        SET duracion_segundos = ISNULL(duracion_segundos, 420)
        WHERE duracion_segundos IS NULL;
    END;

    IF COL_LENGTH('dbo.respaldos_sistema', 'log_resumen') IS NOT NULL
    BEGIN
        UPDATE respaldos_sistema
        SET log_resumen = ISNULL(log_resumen, N'Respaldo registrado y disponible para validación.')
        WHERE log_resumen IS NULL;
    END;

    IF COL_LENGTH('dbo.respaldos_sistema', 'fecha_validacion') IS NOT NULL
    BEGIN
        UPDATE respaldos_sistema
        SET fecha_validacion =
            CASE
                WHEN validacion IN (N'Verificado', N'Validado') THEN DATEADD(HOUR, 1, fecha_ejecucion)
                ELSE NULL
            END
        WHERE fecha_validacion IS NULL;
    END;
END;


/* =========================================================
   9. REPORTES ADMIN CON FORMATOS COMPLETOS
========================================================= */

IF OBJECT_ID('dbo.reportes', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM reportes WHERE nombre = N'Reporte administrador PDF')
    BEGIN
        INSERT INTO reportes (
            nombre,
            tipo,
            periodo,
            alcance,
            formato,
            comentario,
            generado_por_usuario_id,
            estado,
            fecha_generacion
        )
        VALUES
        (N'Reporte administrador PDF', N'Resumen ejecutivo', N'Semana actual', N'Administrador', N'PDF', N'Reporte ejecutivo para administración.', @admin_id, N'Generado', SYSDATETIME()),
        (N'Reporte administrador Word', N'Resumen ejecutivo', N'Semana actual', N'Administrador', N'Word', N'Reporte editable para revisión interna.', @admin_id, N'Generado', SYSDATETIME()),
        (N'Reporte administrador Excel', N'Indicadores', N'Mes actual', N'Administrador', N'Excel', N'Dataset de indicadores administrativos.', @admin_id, N'Generado', SYSDATETIME()),
        (N'Reporte administrador CSV', N'Auditoría', N'Mes actual', N'Administrador', N'CSV', N'Exportación plana de auditoría.', @admin_id, N'Generado', SYSDATETIME()),
        (N'Reporte administrador Imagen', N'Dashboard', N'Día actual', N'Administrador', N'Imagen PNG', N'Captura visual de indicadores.', @admin_id, N'Generado', SYSDATETIME()),
        (N'Dashboard compartible administrador', N'Dashboard compartible', N'Semana actual', N'Administrador', N'Dashboard compartible', N'Enlace temporal para dashboard administrativo.', @admin_id, N'Generado', SYSDATETIME());
    END;
END;


/* =========================================================
   10. AUDITORÍA ADMIN COMPLEMENTARIA
========================================================= */

IF OBJECT_ID('dbo.auditoria_admin', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM auditoria_admin
        WHERE accion = N'Carga complementaria administrador'
    )
    BEGIN
        INSERT INTO auditoria_admin (
            modulo,
            tipo,
            accion,
            usuario_id,
            usuario_nombre,
            valor_anterior,
            valor_nuevo,
            resultado,
            critico,
            detalle,
            fecha_evento
        )
        VALUES
        (
            N'Administrador',
            N'poblacion',
            N'Carga complementaria administrador',
            @admin_id,
            N'Administrador Sistema',
            N'-',
            N'Datos complementarios Admin cargados',
            N'Exitoso',
            1,
            N'Se agregaron catálogos UI, integraciones, SLA, reportes, respaldo y auditoría para el módulo administrador.',
            SYSDATETIME()
        );
    END;
END;


/* =========================================================
   11. ALERTAS ADMIN REALISTAS
========================================================= */

IF OBJECT_ID('dbo.alertas_sistema', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM alertas_sistema
        WHERE titulo = N'Revisión de permisos administrativos'
    )
    BEGIN
        INSERT INTO alertas_sistema (
            modulo,
            titulo,
            mensaje,
            severidad,
            estado,
            href,
            fecha_creacion
        )
        VALUES
        (
            N'Roles',
            N'Revisión de permisos administrativos',
            N'Validar que solo perfiles autorizados tengan permisos sensibles de administración.',
            N'Alta',
            N'Pendiente',
            N'roles-permisos.html',
            SYSDATETIME()
        ),
        (
            N'SLA',
            N'Validación de reglas SLA',
            N'Revisar reglas críticas y escalamiento asociado.',
            N'Media',
            N'Pendiente',
            N'reglas-sla.html',
            SYSDATETIME()
        ),
        (
            N'Configuración',
            N'Revisión de configuración de seguridad',
            N'Validar expiración de sesión, MFA, intentos fallidos y mantenimiento.',
            N'Alta',
            N'Pendiente',
            N'configuracion-sistema.html',
            SYSDATETIME()
        );
    END;
END;


/* =========================================================
   12. VALIDACIÓN FINAL
========================================================= */

COMMIT TRANSACTION;
GO

SELECT 'Población Admin complementaria ejecutada correctamente' AS resultado;

SELECT COUNT(*) AS total_catalogos_ui FROM catalogos_ui;
SELECT COUNT(*) AS total_integraciones FROM integraciones_sistema;
SELECT COUNT(*) AS total_eventos_integracion FROM eventos_integracion;
SELECT COUNT(*) AS total_reglas_sla_admin FROM reglas_sla_admin;
SELECT COUNT(*) AS total_respaldos FROM respaldos_sistema;
SELECT COUNT(*) AS total_reportes FROM reportes;
SELECT COUNT(*) AS total_alertas FROM alertas_sistema;
SELECT COUNT(*) AS total_auditoria_admin FROM auditoria_admin;
GO