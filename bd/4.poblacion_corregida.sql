USE ClaroAtencion360;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

/* =========================================================
   POBLACIÓN COMPLEMENTARIA CORREGIDA
   Ejecutar DESPUÉS de tu población actual.

   Objetivo:
   - No cambiar tus datos existentes.
   - Agregar datos para las tablas nuevas/corregidas.
   - Conectar asesor, supervisor, reportes, plantillas,
     notificaciones, SLA, constancias, exportaciones y dashboard.
========================================================= */

/* =========================================================
   1. VARIABLES BASE
========================================================= */

DECLARE @admin_id INT = (
    SELECT TOP 1 usuario_id
    FROM usuarios
    WHERE username = 'admin.sistema'
);

DECLARE @supervisor_id INT = (
    SELECT TOP 1 usuario_id
    FROM usuarios
    WHERE username IN ('carolina.vargas', 'miguel.torres')
    ORDER BY usuario_id
);

DECLARE @asesor_1 INT = (
    SELECT TOP 1 usuario_id
    FROM usuarios
    WHERE username IN ('valeria.mendoza', 'jose.quispe', 'luis.ramirez', 'diego.castillo')
    ORDER BY usuario_id
);

DECLARE @asesor_2 INT = (
    SELECT TOP 1 usuario_id
    FROM usuarios
    WHERE username IN ('jose.quispe', 'luis.ramirez', 'diego.castillo')
    ORDER BY usuario_id
);

DECLARE @area_soporte INT = (
    SELECT TOP 1 area_id
    FROM areas
    WHERE nombre IN ('Soporte Técnico', 'Soporte Tecnico')
);

DECLARE @area_facturacion INT = (
    SELECT TOP 1 area_id
    FROM areas
    WHERE nombre = 'Facturación'
);

DECLARE @area_backoffice INT = (
    SELECT TOP 1 area_id
    FROM areas
    WHERE nombre IN ('Backoffice', 'Back Office')
);

DECLARE @area_supervision INT = (
    SELECT TOP 1 area_id
    FROM areas
    WHERE nombre = 'Supervisión'
);

IF @admin_id IS NULL
    SET @admin_id = (SELECT TOP 1 usuario_id FROM usuarios ORDER BY usuario_id);

IF @supervisor_id IS NULL
    SET @supervisor_id = @admin_id;

IF @asesor_1 IS NULL
    SET @asesor_1 = @admin_id;

IF @asesor_2 IS NULL
    SET @asesor_2 = @asesor_1;


/* =========================================================
   2. AJUSTE DE PLANTILLAS PARA NUEVO FRONTEND ASESOR
   Se agregan categorías operativas:
   evidencia, reclamo, derivacion, cierre, seguimiento
========================================================= */

IF NOT EXISTS (
    SELECT 1 FROM plantillas_respuesta
    WHERE nombre = N'Solicitud profesional de evidencia'
)
BEGIN
    INSERT INTO plantillas_respuesta (
        nombre,
        categoria,
        canal,
        descripcion,
        contenido,
        creado_por_usuario_id,
        activo,
        fecha_creacion
    )
    VALUES
    (
        N'Solicitud profesional de evidencia',
        N'evidencia',
        N'Portal cliente',
        N'Solicita documentos, capturas o información necesaria para continuar la atención.',
        N'Estimado(a) {cliente_nombre}, para continuar con la atención del caso {codigo_caso}, necesitamos que nos remita la evidencia relacionada al servicio {servicio_afectado}. Esta información nos permitirá validar correctamente el caso y continuar dentro del plazo SLA informado: {sla}. Quedamos atentos a su respuesta. Atentamente, {asesor_nombre}.',
        @asesor_1,
        1,
        SYSDATETIME()
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM plantillas_respuesta
    WHERE nombre = N'Respuesta inicial de reclamo'
)
BEGIN
    INSERT INTO plantillas_respuesta (
        nombre,
        categoria,
        canal,
        descripcion,
        contenido,
        creado_por_usuario_id,
        activo,
        fecha_creacion
    )
    VALUES
    (
        N'Respuesta inicial de reclamo',
        N'reclamo',
        N'Portal cliente',
        N'Respuesta inicial para confirmar recepción y revisión del reclamo.',
        N'Estimado(a) {cliente_nombre}, hemos recibido su reclamo asociado al caso {codigo_caso}. Nuestro equipo revisará la información registrada sobre el servicio {servicio_afectado}, considerando el estado actual {estado_caso} y la prioridad {prioridad}. Le informaremos los avances por este canal. Atentamente, {asesor_nombre}.',
        @asesor_1,
        1,
        SYSDATETIME()
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM plantillas_respuesta
    WHERE nombre = N'Derivación a área especializada'
)
BEGIN
    INSERT INTO plantillas_respuesta (
        nombre,
        categoria,
        canal,
        descripcion,
        contenido,
        creado_por_usuario_id,
        activo,
        fecha_creacion
    )
    VALUES
    (
        N'Derivación a área especializada',
        N'derivacion',
        N'Interno',
        N'Mensaje para registrar derivación interna de un caso.',
        N'Se deriva el caso {codigo_caso}, asociado al cliente {cliente_nombre}, para revisión especializada del servicio {servicio_afectado}. Estado actual: {estado_caso}. Prioridad: {prioridad}. Se solicita validar el sustento y responder dentro del plazo operativo correspondiente.',
        @asesor_1,
        1,
        SYSDATETIME()
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM plantillas_respuesta
    WHERE nombre = N'Cierre formal de caso'
)
BEGIN
    INSERT INTO plantillas_respuesta (
        nombre,
        categoria,
        canal,
        descripcion,
        contenido,
        creado_por_usuario_id,
        activo,
        fecha_creacion
    )
    VALUES
    (
        N'Cierre formal de caso',
        N'cierre',
        N'Portal cliente',
        N'Plantilla para comunicar cierre de caso con respuesta final.',
        N'Estimado(a) {cliente_nombre}, le informamos que el caso {codigo_caso} ha sido atendido. Luego de la revisión del servicio {servicio_afectado}, se registró la respuesta final correspondiente. Si presenta una nueva observación, puede registrar un nuevo caso desde la plataforma. Atentamente, {asesor_nombre}.',
        @asesor_2,
        1,
        SYSDATETIME()
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM plantillas_respuesta
    WHERE nombre = N'Seguimiento preventivo SLA'
)
BEGIN
    INSERT INTO plantillas_respuesta (
        nombre,
        categoria,
        canal,
        descripcion,
        contenido,
        creado_por_usuario_id,
        activo,
        fecha_creacion
    )
    VALUES
    (
        N'Seguimiento preventivo SLA',
        N'seguimiento',
        N'Portal cliente',
        N'Plantilla para seguimiento preventivo antes de vencimiento SLA.',
        N'Estimado(a) {cliente_nombre}, estamos realizando seguimiento preventivo al caso {codigo_caso}. Actualmente se encuentra en estado {estado_caso} y mantiene el siguiente control SLA: {sla}. Le informaremos cualquier actualización por este canal. Atentamente, {asesor_nombre}.',
        @asesor_2,
        1,
        SYSDATETIME()
    );
END;


/* =========================================================
   3. COMUNICACIONES DE CASO
   Se genera trazabilidad real a partir de casos existentes.
========================================================= */

INSERT INTO comunicaciones_caso (
    caso_id,
    usuario_id,
    plantilla_id,
    tipo,
    canal,
    asunto,
    mensaje,
    destinatario,
    estado,
    fecha_envio
)
SELECT TOP 30
    c.caso_id,
    COALESCE(c.responsable_actual_usuario_id, @asesor_1),
    (
        SELECT TOP 1 plantilla_id
        FROM plantillas_respuesta
        WHERE activo = 1
        ORDER BY plantilla_id
    ),
    N'CASO',
    N'Portal cliente',
    CONCAT(N'Comunicación del caso ', c.codigo_caso),
    CONCAT(N'Se registra comunicación operativa para el caso ', c.codigo_caso, N'. Estado actual: ', ec.nombre, N'.'),
    COALESCE(cli.correo, N'cliente@correo.com'),
    N'ENVIADO',
    DATEADD(HOUR, 1, c.fecha_registro)
FROM casos c
INNER JOIN estados_caso ec ON ec.estado_caso_id = c.estado_caso_id
INNER JOIN clientes cli ON cli.cliente_id = c.cliente_id
WHERE NOT EXISTS (
    SELECT 1
    FROM comunicaciones_caso cc
    WHERE cc.caso_id = c.caso_id
)
ORDER BY c.caso_id;


/* =========================================================
   4. SOLICITUDES DE INFORMACIÓN
   Para casos pendientes por cliente.
========================================================= */

INSERT INTO solicitudes_informacion (
    caso_id,
    solicitada_por_usuario_id,
    canal,
    asunto,
    mensaje,
    plazo,
    fecha_limite,
    estado,
    fecha_solicitud
)
SELECT
    c.caso_id,
    COALESCE(c.responsable_actual_usuario_id, @asesor_1),
    N'Portal cliente',
    N'Solicitud de información adicional',
    CONCAT(N'Para continuar con la atención del caso ', c.codigo_caso, N', necesitamos información o evidencia complementaria.'),
    N'48 horas',
    DATEADD(HOUR, 48, SYSDATETIME()),
    N'Pendiente',
    DATEADD(HOUR, 4, c.fecha_registro)
FROM casos c
INNER JOIN estados_caso ec ON ec.estado_caso_id = c.estado_caso_id
WHERE ec.nombre IN (N'Pendiente por cliente', N'Pendiente cliente')
  AND NOT EXISTS (
      SELECT 1
      FROM solicitudes_informacion si
      WHERE si.caso_id = c.caso_id
  );


/* =========================================================
   5. DERIVACIONES DE CASO
   Para casos derivados o escalados.
========================================================= */

INSERT INTO derivaciones_caso (
    caso_id,
    derivado_por_usuario_id,
    area_destino_id,
    area_destino,
    prioridad,
    motivo,
    estado,
    respuesta_area,
    fecha_respuesta,
    fecha_derivacion
)
SELECT
    c.caso_id,
    COALESCE(c.responsable_actual_usuario_id, @asesor_1),
    CASE
        WHEN cat.nombre = N'Facturación' THEN @area_facturacion
        WHEN cat.nombre LIKE N'%Internet%' THEN @area_soporte
        ELSE @area_backoffice
    END,
    CASE
        WHEN cat.nombre = N'Facturación' THEN N'Facturación'
        WHEN cat.nombre LIKE N'%Internet%' THEN N'Soporte Técnico'
        ELSE N'Backoffice'
    END,
    pr.nombre,
    CONCAT(N'Derivación generada por categoría ', cat.nombre, N' y prioridad ', pr.nombre, N'.'),
    N'Pendiente',
    NULL,
    NULL,
    DATEADD(HOUR, 5, c.fecha_registro)
FROM casos c
INNER JOIN estados_caso ec ON ec.estado_caso_id = c.estado_caso_id
INNER JOIN categorias cat ON cat.categoria_id = c.categoria_id
INNER JOIN prioridades pr ON pr.prioridad_id = c.prioridad_id
WHERE ec.nombre IN (N'Derivado', N'Escalado')
  AND NOT EXISTS (
      SELECT 1
      FROM derivaciones_caso dc
      WHERE dc.caso_id = c.caso_id
  );


/* =========================================================
   6. SEGUIMIENTOS SLA
   Se agregan registros para casos con riesgo o vencidos.
========================================================= */

INSERT INTO seguimientos_sla (
    caso_id,
    usuario_id,
    tipo,
    canal,
    mensaje,
    plazo,
    es_visible_cliente,
    fecha_registro
)
SELECT TOP 40
    c.caso_id,
    COALESCE(c.responsable_actual_usuario_id, @asesor_1),
    CASE
        WHEN c.fecha_limite_resolucion < SYSDATETIME() THEN N'Vencido'
        WHEN c.fecha_limite_resolucion <= DATEADD(HOUR, 8, SYSDATETIME()) THEN N'Riesgo'
        ELSE N'Preventivo'
    END,
    N'SISTEMA',
    CONCAT(N'Seguimiento SLA del caso ', c.codigo_caso, N'. Fecha límite: ', CONVERT(NVARCHAR(30), c.fecha_limite_resolucion, 120), N'.'),
    CASE
        WHEN c.fecha_limite_resolucion < SYSDATETIME() THEN N'Inmediato'
        WHEN c.fecha_limite_resolucion <= DATEADD(HOUR, 8, SYSDATETIME()) THEN N'Menos de 8 horas'
        ELSE N'Controlado'
    END,
    0,
    DATEADD(MINUTE, 30, COALESCE(c.fecha_actualizacion, c.fecha_registro))
FROM casos c
WHERE c.fecha_cierre IS NULL
  AND c.fecha_limite_resolucion <= DATEADD(HOUR, 24, SYSDATETIME())
  AND NOT EXISTS (
      SELECT 1
      FROM seguimientos_sla ss
      WHERE ss.caso_id = c.caso_id
  )
ORDER BY c.fecha_limite_resolucion ASC;


/* =========================================================
   7. CONSTANCIAS DE CASO
   Para casos cerrados.
========================================================= */

INSERT INTO constancias_caso (
    caso_id,
    generado_por_usuario_id,
    codigo_constancia,
    formato,
    archivo_nombre,
    archivo_ruta,
    mime_type,
    tamano_bytes,
    fecha_generacion
)
SELECT
    c.caso_id,
    COALESCE(c.responsable_actual_usuario_id, @asesor_1),
    CONCAT(N'CONST-', c.codigo_caso),
    N'PDF',
    CONCAT(N'constancia-', c.codigo_caso, N'.pdf'),
    CONCAT(N'/exports/constancias/constancia-', c.codigo_caso, N'.pdf'),
    N'application/pdf',
    185000,
    COALESCE(c.fecha_cierre, SYSDATETIME())
FROM casos c
WHERE c.fecha_cierre IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM constancias_caso cc
      WHERE cc.caso_id = c.caso_id
  );


/* =========================================================
   8. EXPORTACIONES DE REPORTES
   Para reportes existentes.
========================================================= */

INSERT INTO exportaciones_reporte (
    reporte_id,
    generado_por_usuario_id,
    modulo,
    nombre,
    formato,
    estado,
    archivo_nombre,
    archivo_ruta,
    mime_type,
    tamano_bytes,
    fecha_generacion,
    fecha_expiracion
)
SELECT
    r.reporte_id,
    COALESCE(r.generado_por_usuario_id, @admin_id),
    CASE
        WHEN r.tipo LIKE N'%SLA%' THEN N'supervisor'
        WHEN r.tipo LIKE N'%Rendimiento%' THEN N'asesor'
        ELSE N'admin'
    END,
    r.nombre,
    r.formato,
    N'GENERADO',
    CONCAT(REPLACE(LOWER(r.nombre), N' ', N'_'), N'.',
        CASE
            WHEN LOWER(r.formato) = N'pdf' THEN N'pdf'
            WHEN LOWER(r.formato) = N'excel' THEN N'xls'
            WHEN LOWER(r.formato) = N'csv' THEN N'csv'
            WHEN LOWER(r.formato) = N'word' THEN N'doc'
            ELSE N'pdf'
        END
    ),
    CONCAT(N'/exports/reportes/', REPLACE(LOWER(r.nombre), N' ', N'_')),
    CASE
        WHEN LOWER(r.formato) = N'pdf' THEN N'application/pdf'
        WHEN LOWER(r.formato) = N'excel' THEN N'application/vnd.ms-excel'
        WHEN LOWER(r.formato) = N'csv' THEN N'text/csv'
        WHEN LOWER(r.formato) = N'word' THEN N'application/msword'
        ELSE N'application/octet-stream'
    END,
    220000,
    r.fecha_generacion,
    DATEADD(DAY, 30, r.fecha_generacion)
FROM reportes r
WHERE NOT EXISTS (
    SELECT 1
    FROM exportaciones_reporte er
    WHERE er.reporte_id = r.reporte_id
);


/* =========================================================
   9. DASHBOARDS COMPARTIBLES
========================================================= */

IF NOT EXISTS (
    SELECT 1
    FROM dashboard_compartidos
    WHERE nombre = N'Dashboard supervisor SLA'
)
BEGIN
    INSERT INTO dashboard_compartidos (
        nombre,
        descripcion,
        modulo,
        token,
        url_publica,
        filtros_json,
        creado_por_usuario_id,
        activo,
        fecha_creacion,
        fecha_expiracion
    )
    VALUES
    (
        N'Dashboard supervisor SLA',
        N'Vista compartible de control SLA y carga operativa.',
        N'supervisor',
        CONVERT(NVARCHAR(100), NEWID()),
        N'/shared/dashboard/supervisor-sla',
        N'{"periodo":"semana","alcance":"sla","prioridad":"todas"}',
        @supervisor_id,
        1,
        SYSDATETIME(),
        DATEADD(DAY, 30, SYSDATETIME())
    );
END;

IF NOT EXISTS (
    SELECT 1
    FROM dashboard_compartidos
    WHERE nombre = N'Dashboard asesor rendimiento'
)
BEGIN
    INSERT INTO dashboard_compartidos (
        nombre,
        descripcion,
        modulo,
        token,
        url_publica,
        filtros_json,
        creado_por_usuario_id,
        activo,
        fecha_creacion,
        fecha_expiracion
    )
    VALUES
    (
        N'Dashboard asesor rendimiento',
        N'Vista compartible de productividad, SLA y casos atendidos.',
        N'asesor',
        CONVERT(NVARCHAR(100), NEWID()),
        N'/shared/dashboard/asesor-rendimiento',
        N'{"periodo":"semana","indicadores":["casos","sla","cierres"]}',
        @asesor_1,
        1,
        SYSDATETIME(),
        DATEADD(DAY, 15, SYSDATETIME())
    );
END;


/* =========================================================
   10. AUDITORÍA OPERATIVA
========================================================= */

INSERT INTO auditoria_operativa (
    usuario_id,
    modulo,
    entidad,
    entidad_id,
    accion,
    detalle,
    ip_origen,
    user_agent,
    fecha_evento
)
SELECT TOP 40
    COALESCE(hc.usuario_id, c.responsable_actual_usuario_id, @admin_id),
    N'casos',
    N'caso',
    c.caso_id,
    hc.accion,
    hc.observacion,
    N'127.0.0.1',
    N'Sistema académico',
    hc.fecha_evento
FROM historial_caso hc
INNER JOIN casos c ON c.caso_id = hc.caso_id
WHERE NOT EXISTS (
    SELECT 1
    FROM auditoria_operativa ao
    WHERE ao.entidad = N'caso'
      AND ao.entidad_id = c.caso_id
      AND ao.accion = hc.accion
      AND ao.fecha_evento = hc.fecha_evento
)
ORDER BY hc.fecha_evento DESC;


/* =========================================================
   11. CATÁLOGOS UI
   Ayudan a frontend/backend con filtros y dropdowns.
========================================================= */

IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'formato_exportacion')
BEGIN
    INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
    VALUES
    (N'formato_exportacion', N'pdf', N'PDF', N'Documento PDF profesional.', 1, 1),
    (N'formato_exportacion', N'word', N'Word', N'Documento editable Word.', 2, 1),
    (N'formato_exportacion', N'excel', N'Excel', N'Archivo Excel para análisis.', 3, 1),
    (N'formato_exportacion', N'csv', N'CSV', N'Archivo plano separado por comas.', 4, 1),
    (N'formato_exportacion', N'imagen', N'Imagen', N'Imagen SVG para reporte visual.', 5, 1),
    (N'formato_exportacion', N'dashboard', N'Dashboard compartible', N'Enlace temporal para compartir dashboard.', 6, 1);
END;

IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'visibilidad')
BEGIN
    INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
    VALUES
    (N'visibilidad', N'visible_cliente', N'Visible para cliente', N'El evento será visible para el cliente.', 1, 1),
    (N'visibilidad', N'interno', N'Interno', N'Solo visible para personal interno.', 2, 1);
END;

IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'plazo_respuesta')
BEGIN
    INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
    VALUES
    (N'plazo_respuesta', N'24h', N'24 horas', N'Plazo de respuesta de 24 horas.', 1, 1),
    (N'plazo_respuesta', N'48h', N'48 horas', N'Plazo de respuesta de 48 horas.', 2, 1),
    (N'plazo_respuesta', N'72h', N'72 horas', N'Plazo de respuesta de 72 horas.', 3, 1),
    (N'plazo_respuesta', N'5d', N'5 días hábiles', N'Plazo de respuesta de 5 días hábiles.', 4, 1);
END;

IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'categoria_plantilla')
BEGIN
    INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
    VALUES
    (N'categoria_plantilla', N'evidencia', N'Evidencia', N'Plantillas para solicitud de evidencias.', 1, 1),
    (N'categoria_plantilla', N'reclamo', N'Reclamo', N'Plantillas para respuesta de reclamos.', 2, 1),
    (N'categoria_plantilla', N'derivacion', N'Derivación', N'Plantillas para derivaciones internas.', 3, 1),
    (N'categoria_plantilla', N'cierre', N'Cierre', N'Plantillas para cierre de casos.', 4, 1),
    (N'categoria_plantilla', N'seguimiento', N'Seguimiento', N'Plantillas para seguimiento preventivo.', 5, 1);
END;


/* =========================================================
   12. NOTIFICACIONES SLA PARA ASESOR
========================================================= */

INSERT INTO notificaciones (
    caso_id,
    usuario_id,
    tipo,
    canal_envio,
    titulo,
    mensaje,
    leida,
    estado_envio,
    fecha_generacion
)
SELECT TOP 20
    c.caso_id,
    COALESCE(c.responsable_actual_usuario_id, @asesor_1),
    N'SLA',
    N'SISTEMA',
    N'Alerta masiva SLA',
    CONCAT(N'El caso ', c.codigo_caso, N' requiere seguimiento SLA. Fecha límite: ', CONVERT(NVARCHAR(30), c.fecha_limite_resolucion, 120), N'.'),
    0,
    N'ENVIADO',
    SYSDATETIME()
FROM casos c
WHERE c.fecha_cierre IS NULL
  AND c.fecha_limite_resolucion <= DATEADD(HOUR, 24, SYSDATETIME())
  AND NOT EXISTS (
      SELECT 1
      FROM notificaciones n
      WHERE n.caso_id = c.caso_id
        AND n.usuario_id = COALESCE(c.responsable_actual_usuario_id, @asesor_1)
        AND n.tipo = N'SLA'
  )
ORDER BY c.fecha_limite_resolucion ASC;


/* =========================================================
   13. REPORTES ADICIONALES CON TODOS LOS FORMATOS
========================================================= */

IF NOT EXISTS (
    SELECT 1 FROM reportes
    WHERE nombre = N'Exportación bandeja asesor PDF'
)
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
    (N'Exportación bandeja asesor PDF', N'Bandeja asesor', N'Semana actual', N'Asesor', N'PDF', N'Reporte PDF de bandeja de casos.', @asesor_1, N'Generado', SYSDATETIME()),
    (N'Exportación bandeja asesor Word', N'Bandeja asesor', N'Semana actual', N'Asesor', N'Word', N'Reporte Word editable de bandeja de casos.', @asesor_1, N'Generado', SYSDATETIME()),
    (N'Exportación bandeja asesor Excel', N'Bandeja asesor', N'Semana actual', N'Asesor', N'Excel', N'Reporte Excel de bandeja de casos.', @asesor_1, N'Generado', SYSDATETIME()),
    (N'Exportación bandeja asesor CSV', N'Bandeja asesor', N'Semana actual', N'Asesor', N'CSV', N'Reporte CSV de bandeja de casos.', @asesor_1, N'Generado', SYSDATETIME()),
    (N'Exportación bandeja asesor Imagen', N'Bandeja asesor', N'Semana actual', N'Asesor', N'Imagen', N'Reporte visual SVG de bandeja de casos.', @asesor_1, N'Generado', SYSDATETIME()),
    (N'Dashboard compartible asesor', N'Dashboard compartible', N'Semana actual', N'Asesor', N'Dashboard', N'Enlace compartible temporal para indicadores del asesor.', @asesor_1, N'Generado', SYSDATETIME());
END;

/* =========================================================
   14. ÚLTIMA CORRECCIÓN: AGREGAR FECHA DE EXPIRACIÓN EN EXPORTACIONES
========================================================= */


USE ClaroAtencion360;
GO

/* Si quedó una transacción abierta por el error anterior, la cerramos */
IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRANSACTION;
END;
GO

/* Agregar columna faltante en exportaciones_reporte */
IF COL_LENGTH('dbo.exportaciones_reporte', 'fecha_expiracion') IS NULL
BEGIN
    ALTER TABLE dbo.exportaciones_reporte
    ADD fecha_expiracion DATETIME2 NULL;
END;
GO

SELECT 'Columna fecha_expiracion corregida correctamente' AS resultado;
GO
/* =========================================================
   14. VALIDACIÓN FINAL COMPLEMENTARIA
========================================================= */

COMMIT TRANSACTION;
GO

SELECT 'Población complementaria corregida ejecutada correctamente' AS resultado;

SELECT COUNT(*) AS total_comunicaciones_caso FROM comunicaciones_caso;
SELECT COUNT(*) AS total_solicitudes_informacion FROM solicitudes_informacion;
SELECT COUNT(*) AS total_derivaciones_caso FROM derivaciones_caso;
SELECT COUNT(*) AS total_seguimientos_sla FROM seguimientos_sla;
SELECT COUNT(*) AS total_constancias_caso FROM constancias_caso;
SELECT COUNT(*) AS total_exportaciones_reporte FROM exportaciones_reporte;
SELECT COUNT(*) AS total_dashboard_compartidos FROM dashboard_compartidos;
SELECT COUNT(*) AS total_auditoria_operativa FROM auditoria_operativa;
SELECT COUNT(*) AS total_catalogos_ui FROM catalogos_ui;
GO

