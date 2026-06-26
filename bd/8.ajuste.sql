USE ClaroAtencion360;
GO

/* =========================================================
   AJUSTE COMPATIBLE PARA DETALLE DE CASO - CLIENTE
   Corrige error: Invalid column name 'titulo'
========================================================= */

IF OBJECT_ID('dbo.solicitudes_informacion', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.solicitudes_informacion (
        solicitud_id INT IDENTITY(1,1) PRIMARY KEY,
        caso_id INT NOT NULL,
        usuario_id INT NULL,
        titulo NVARCHAR(200) NOT NULL DEFAULT 'Solicitud de información adicional',
        mensaje NVARCHAR(MAX) NULL,
        estado NVARCHAR(50) NOT NULL DEFAULT 'Pendiente',
        fecha_solicitud DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        fecha_respuesta DATETIME2 NULL,
        respuesta_cliente NVARCHAR(MAX) NULL,
        activo BIT NOT NULL DEFAULT 1
    );
END;
GO

IF COL_LENGTH('dbo.solicitudes_informacion', 'titulo') IS NULL
BEGIN
    ALTER TABLE dbo.solicitudes_informacion
    ADD titulo NVARCHAR(200) NULL;
END;
GO

IF COL_LENGTH('dbo.solicitudes_informacion', 'mensaje') IS NULL
BEGIN
    ALTER TABLE dbo.solicitudes_informacion
    ADD mensaje NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('dbo.solicitudes_informacion', 'estado') IS NULL
BEGIN
    ALTER TABLE dbo.solicitudes_informacion
    ADD estado NVARCHAR(50) NULL;
END;
GO

IF COL_LENGTH('dbo.solicitudes_informacion', 'fecha_solicitud') IS NULL
BEGIN
    ALTER TABLE dbo.solicitudes_informacion
    ADD fecha_solicitud DATETIME2 NULL;
END;
GO

IF COL_LENGTH('dbo.solicitudes_informacion', 'fecha_respuesta') IS NULL
BEGIN
    ALTER TABLE dbo.solicitudes_informacion
    ADD fecha_respuesta DATETIME2 NULL;
END;
GO

IF COL_LENGTH('dbo.solicitudes_informacion', 'respuesta_cliente') IS NULL
BEGIN
    ALTER TABLE dbo.solicitudes_informacion
    ADD respuesta_cliente NVARCHAR(MAX) NULL;
END;
GO

UPDATE dbo.solicitudes_informacion
SET titulo = ISNULL(titulo, 'Solicitud de información adicional')
WHERE titulo IS NULL;
GO

UPDATE dbo.solicitudes_informacion
SET mensaje = ISNULL(mensaje, 'El asesor requiere información adicional para continuar con la atención del caso.')
WHERE mensaje IS NULL;
GO

UPDATE dbo.solicitudes_informacion
SET estado = ISNULL(estado, 'Pendiente')
WHERE estado IS NULL;
GO

UPDATE dbo.solicitudes_informacion
SET fecha_solicitud = ISNULL(fecha_solicitud, SYSDATETIME())
WHERE fecha_solicitud IS NULL;
GO

