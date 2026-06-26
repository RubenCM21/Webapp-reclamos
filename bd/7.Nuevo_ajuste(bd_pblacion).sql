/* =========================================================
   CLARO ATENCIÓN 360
   AJUSTES INCREMENTALES - MÓDULO CLIENTE
   Ejecutar sobre la BD existente: ClaroAtencion360

   IMPORTANTE:
   - No borra datos.
   - Agrega columnas/tablas faltantes para que Cliente conecte bien.
   - Alinea reclamos, incidencias, perfil, notificaciones y servicios.
========================================================= */

USE ClaroAtencion360;
GO

/* =========================================================
   1. CLIENTES / PERFIL
========================================================= */

IF COL_LENGTH('dbo.clientes', 'segmento_cliente') IS NULL
BEGIN
    ALTER TABLE dbo.clientes ADD segmento_cliente NVARCHAR(50) NULL;
END
GO

IF COL_LENGTH('dbo.clientes', 'canal_preferido') IS NULL
BEGIN
    ALTER TABLE dbo.clientes ADD canal_preferido NVARCHAR(50) NULL;
END
GO

UPDATE dbo.clientes
SET segmento_cliente = CASE WHEN tipo_cliente = 'PERSONA' THEN 'Residencial' ELSE 'Empresa' END
WHERE segmento_cliente IS NULL;
GO

UPDATE dbo.clientes
SET canal_preferido = 'Correo'
WHERE canal_preferido IS NULL;
GO

/* =========================================================
   2. CASOS: CAMPOS FALTANTES PARA RECLAMOS / INCIDENCIAS
========================================================= */

IF COL_LENGTH('dbo.casos', 'fecha_hecho') IS NULL
    ALTER TABLE dbo.casos ADD fecha_hecho DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.casos', 'monto_reclamado') IS NULL
    ALTER TABLE dbo.casos ADD monto_reclamado DECIMAL(12,2) NULL;
GO

IF COL_LENGTH('dbo.casos', 'canal_contacto_preferido') IS NULL
    ALTER TABLE dbo.casos ADD canal_contacto_preferido NVARCHAR(80) NULL;
GO

IF COL_LENGTH('dbo.casos', 'pretension_cliente') IS NULL
    ALTER TABLE dbo.casos ADD pretension_cliente NVARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.casos', 'impacto_cliente') IS NULL
    ALTER TABLE dbo.casos ADD impacto_cliente NVARCHAR(120) NULL;
GO

IF COL_LENGTH('dbo.casos', 'urgencia_cliente') IS NULL
    ALTER TABLE dbo.casos ADD urgencia_cliente NVARCHAR(80) NULL;
GO

IF COL_LENGTH('dbo.casos', 'ubicacion_referencial') IS NULL
    ALTER TABLE dbo.casos ADD ubicacion_referencial NVARCHAR(250) NULL;
GO

IF COL_LENGTH('dbo.casos', 'diagnostico_preliminar') IS NULL
    ALTER TABLE dbo.casos ADD diagnostico_preliminar NVARCHAR(500) NULL;
GO

IF COL_LENGTH('dbo.casos', 'motivo_id') IS NULL
    ALTER TABLE dbo.casos ADD motivo_id INT NULL;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_casos_motivo'
)
BEGIN
    ALTER TABLE dbo.casos
    ADD CONSTRAINT FK_casos_motivo
        FOREIGN KEY (motivo_id) REFERENCES dbo.motivos_catalogo(motivo_id);
END
GO

/* =========================================================
   3. NOTIFICACIONES: OCULTAR SIN BORRAR
========================================================= */

IF COL_LENGTH('dbo.notificaciones', 'oculta_cliente') IS NULL
BEGIN
    ALTER TABLE dbo.notificaciones
    ADD oculta_cliente BIT NOT NULL
        CONSTRAINT DF_notificaciones_oculta_cliente DEFAULT 0;
END
GO

IF COL_LENGTH('dbo.notificaciones', 'fecha_oculta_cliente') IS NULL
    ALTER TABLE dbo.notificaciones ADD fecha_oculta_cliente DATETIME2 NULL;
GO

IF COL_LENGTH('dbo.notificaciones', 'url_accion') IS NULL
    ALTER TABLE dbo.notificaciones ADD url_accion NVARCHAR(300) NULL;
GO

IF COL_LENGTH('dbo.notificaciones', 'prioridad') IS NULL
BEGIN
    ALTER TABLE dbo.notificaciones
    ADD prioridad NVARCHAR(50) NOT NULL
        CONSTRAINT DF_notificaciones_prioridad_cliente DEFAULT 'Media';
END
GO

UPDATE n
SET url_accion = CONCAT('detalle-caso.html?codigo=', c.codigo_caso)
FROM dbo.notificaciones n
INNER JOIN dbo.casos c ON c.caso_id = n.caso_id
WHERE n.url_accion IS NULL;
GO

UPDATE dbo.notificaciones
SET prioridad = 'Media'
WHERE prioridad IS NULL;
GO

/* =========================================================
   4. SÍNTOMAS PARA INCIDENCIAS
========================================================= */

IF OBJECT_ID('dbo.sintomas_incidencia', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.sintomas_incidencia (
        sintoma_id INT IDENTITY(1,1) PRIMARY KEY,
        nombre NVARCHAR(120) NOT NULL,
        descripcion NVARCHAR(250) NULL,
        tipo_servicio NVARCHAR(80) NULL,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM dbo.sintomas_incidencia
    WHERE nombre = 'Sin servicio'
)
BEGIN
    INSERT INTO dbo.sintomas_incidencia
        (nombre, descripcion, tipo_servicio)
    VALUES
        ('Sin servicio', 'El servicio no funciona o se encuentra totalmente interrumpido.', 'General'),
        ('Servicio intermitente', 'El servicio se corta de forma frecuente.', 'General'),
        ('Lentitud del servicio', 'La velocidad o respuesta del servicio es menor a lo esperado.', 'Internet'),
        ('Problemas de señal', 'Falla de señal móvil, TV o cobertura.', 'Móvil/TV'),
        ('Error de acceso', 'No se puede ingresar a una aplicación, portal, correo o servicio digital.', 'Digital'),
        ('Equipo no responde', 'Router, decodificador, módem u otro equipo presenta falla.', 'Equipos'),
        ('Afectación empresarial', 'La falla afecta operación de una empresa o sede.', 'Empresas');
END
GO

/* =========================================================
   5. BORRADORES DE CASO
========================================================= */

IF OBJECT_ID('dbo.borradores_caso', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.borradores_caso (
        borrador_id INT IDENTITY(1,1) PRIMARY KEY,
        cliente_id INT NOT NULL,
        tipo_caso NVARCHAR(80) NOT NULL,
        payload_json NVARCHAR(MAX) NOT NULL,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        fecha_actualizacion DATETIME2 NULL,
        CONSTRAINT FK_borradores_caso_cliente
            FOREIGN KEY (cliente_id) REFERENCES dbo.clientes(cliente_id)
    );
END
GO

/* =========================================================
   6. PREFERENCIAS DE NOTIFICACIÓN
========================================================= */

IF OBJECT_ID('dbo.preferencias_notificacion_cliente', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.preferencias_notificacion_cliente (
        preferencia_id INT IDENTITY(1,1) PRIMARY KEY,
        cliente_id INT NOT NULL,
        canal NVARCHAR(50) NOT NULL,
        activo BIT NOT NULL DEFAULT 1,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        fecha_actualizacion DATETIME2 NULL,
        CONSTRAINT FK_preferencias_cliente
            FOREIGN KEY (cliente_id) REFERENCES dbo.clientes(cliente_id),
        CONSTRAINT UQ_preferencias_cliente_canal
            UNIQUE (cliente_id, canal)
    );
END
GO

INSERT INTO dbo.preferencias_notificacion_cliente
    (cliente_id, canal, activo)
SELECT
    c.cliente_id,
    v.canal,
    v.activo
FROM dbo.clientes c
CROSS APPLY (
    VALUES
        ('Correo', 1),
        ('SMS', 0),
        ('WhatsApp', 1),
        ('Llamada', 0)
) v(canal, activo)
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.preferencias_notificacion_cliente p
    WHERE p.cliente_id = c.cliente_id
      AND p.canal = v.canal
);
GO

/* =========================================================
   7. ACCESOS DE USUARIO
========================================================= */

IF OBJECT_ID('dbo.accesos_usuario', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.accesos_usuario (
        acceso_id INT IDENTITY(1,1) PRIMARY KEY,
        usuario_id INT NOT NULL,
        canal NVARCHAR(80) NOT NULL,
        dispositivo NVARCHAR(120) NULL,
        navegador NVARCHAR(120) NULL,
        ip_origen NVARCHAR(80) NULL,
        ubicacion_aproximada NVARCHAR(120) NULL,
        resultado NVARCHAR(50) NOT NULL DEFAULT 'EXITOSO',
        fecha_acceso DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_accesos_usuario
            FOREIGN KEY (usuario_id) REFERENCES dbo.usuarios(usuario_id)
    );
END
GO

INSERT INTO dbo.accesos_usuario
    (usuario_id, canal, dispositivo, navegador, ip_origen, ubicacion_aproximada, resultado, fecha_acceso)
SELECT
    u.usuario_id,
    'Web',
    'Navegador',
    'Portal Cliente',
    '127.0.0.1',
    'Lima, Perú',
    'EXITOSO',
    ISNULL(u.ultimo_acceso, SYSDATETIME())
FROM dbo.usuarios u
INNER JOIN dbo.clientes c ON c.usuario_id = u.usuario_id
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.accesos_usuario a
    WHERE a.usuario_id = u.usuario_id
);
GO

/* =========================================================
   8. ENLACES COMPARTIDOS DE CASO
========================================================= */

IF OBJECT_ID('dbo.enlaces_compartidos_caso', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.enlaces_compartidos_caso (
        enlace_id INT IDENTITY(1,1) PRIMARY KEY,
        caso_id INT NOT NULL,
        token NVARCHAR(120) NOT NULL UNIQUE,
        creado_por_usuario_id INT NOT NULL,
        fecha_creacion DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        fecha_expiracion DATETIME2 NOT NULL,
        activo BIT NOT NULL DEFAULT 1,
        CONSTRAINT FK_enlaces_compartidos_caso
            FOREIGN KEY (caso_id) REFERENCES dbo.casos(caso_id),
        CONSTRAINT FK_enlaces_compartidos_usuario
            FOREIGN KEY (creado_por_usuario_id) REFERENCES dbo.usuarios(usuario_id)
    );
END
GO

/* =========================================================
   9. CATÁLOGOS UI PARA DESPLEGABLES DEL CLIENTE
========================================================= */

IF OBJECT_ID('dbo.catalogos_ui', 'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM dbo.catalogos_ui
        WHERE grupo = 'canal_contacto_cliente'
          AND codigo = 'Correo'
    )
    BEGIN
        INSERT INTO dbo.catalogos_ui
            (grupo, codigo, etiqueta, descripcion, orden, activo)
        VALUES
            ('canal_contacto_cliente', 'Correo', 'Correo electrónico', 'Recibir comunicaciones por correo.', 1, 1),
            ('canal_contacto_cliente', 'SMS', 'SMS', 'Recibir alertas cortas por mensaje de texto.', 2, 1),
            ('canal_contacto_cliente', 'WhatsApp', 'WhatsApp', 'Recibir alertas por WhatsApp.', 3, 1),
            ('canal_contacto_cliente', 'Llamada', 'Llamada telefónica', 'Permitir llamada cuando se requiera validación.', 4, 1);
    END

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.catalogos_ui
        WHERE grupo = 'impacto_incidencia'
          AND codigo = 'Individual'
    )
    BEGIN
        INSERT INTO dbo.catalogos_ui
            (grupo, codigo, etiqueta, descripcion, orden, activo)
        VALUES
            ('impacto_incidencia', 'Individual', 'Afecta solo a un usuario', 'Impacto individual.', 1, 1),
            ('impacto_incidencia', 'Hogar', 'Afecta a todo el hogar', 'Impacto residencial.', 2, 1),
            ('impacto_incidencia', 'Empresa', 'Afecta operación de empresa', 'Impacto empresarial.', 3, 1),
            ('impacto_incidencia', 'Masivo', 'Posible afectación masiva', 'Impacto sobre varios usuarios o zona.', 4, 1);
    END

    IF NOT EXISTS (
        SELECT 1
        FROM dbo.catalogos_ui
        WHERE grupo = 'urgencia_incidencia'
          AND codigo = 'Baja'
    )
    BEGIN
        INSERT INTO dbo.catalogos_ui
            (grupo, codigo, etiqueta, descripcion, orden, activo)
        VALUES
            ('urgencia_incidencia', 'Baja', 'Baja', 'Puede esperar atención regular.', 1, 1),
            ('urgencia_incidencia', 'Media', 'Media', 'Requiere atención dentro del flujo normal.', 2, 1),
            ('urgencia_incidencia', 'Alta', 'Alta', 'Afectación importante del servicio.', 3, 1),
            ('urgencia_incidencia', 'Crítica', 'Crítica', 'Afectación severa o total.', 4, 1);
    END
END
GO

/* =========================================================
   10. MAPEO DE MOTIVOS A CATEGORÍAS
========================================================= */

UPDATE m
SET categoria_id = c.categoria_id
FROM dbo.motivos_catalogo m
INNER JOIN dbo.categorias c ON c.nombre = 'Facturación'
WHERE m.categoria_id IS NULL
  AND (
        m.nombre LIKE '%Cobro%'
        OR m.nombre LIKE '%facturación%'
        OR m.nombre LIKE '%recibo%'
        OR m.nombre LIKE '%monto%'
  );
GO

UPDATE m
SET categoria_id = c.categoria_id
FROM dbo.motivos_catalogo m
CROSS APPLY (
    SELECT TOP 1 categoria_id
    FROM dbo.categorias
    WHERE nombre IN ('Internet hogar', 'Móvil', 'Claro TV')
    ORDER BY
        CASE
            WHEN nombre = 'Internet hogar' THEN 1
            WHEN nombre = 'Móvil' THEN 2
            ELSE 3
        END
) c
WHERE m.categoria_id IS NULL
  AND (
        m.nombre LIKE '%servicio%'
        OR m.nombre LIKE '%intermitente%'
        OR m.nombre LIKE '%señal%'
        OR m.nombre LIKE '%acceso%'
  );
GO

UPDATE m
SET categoria_id = c.categoria_id
FROM dbo.motivos_catalogo m
CROSS APPLY (
    SELECT TOP 1 categoria_id
    FROM dbo.categorias
    WHERE nombre = 'Atención al cliente'
    ORDER BY categoria_id
) c
WHERE m.categoria_id IS NULL;
GO

/* =========================================================
   11. ÍNDICES RECOMENDADOS
========================================================= */

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_casos_cliente_fecha_cliente_mod'
      AND object_id = OBJECT_ID('dbo.casos')
)
BEGIN
    CREATE INDEX IX_casos_cliente_fecha_cliente_mod
    ON dbo.casos(cliente_id, fecha_registro DESC);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_casos_cliente_codigo_cliente_mod'
      AND object_id = OBJECT_ID('dbo.casos')
)
BEGIN
    CREATE INDEX IX_casos_cliente_codigo_cliente_mod
    ON dbo.casos(cliente_id, codigo_caso);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_servicios_contratados_cliente_estado_mod'
      AND object_id = OBJECT_ID('dbo.servicios_contratados')
)
BEGIN
    CREATE INDEX IX_servicios_contratados_cliente_estado_mod
    ON dbo.servicios_contratados(cliente_id, estado);
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_notificaciones_cliente_usuario_fecha_mod'
      AND object_id = OBJECT_ID('dbo.notificaciones')
)
BEGIN
    CREATE INDEX IX_notificaciones_cliente_usuario_fecha_mod
    ON dbo.notificaciones(usuario_id, leida, fecha_generacion DESC);
END
GO

/* =========================================================
   12. VALIDACIÓN FINAL
========================================================= */

SELECT
    'AJUSTES MÓDULO CLIENTE APLICADOS CORRECTAMENTE' AS resultado,
    DB_NAME() AS base_datos,
    (SELECT COUNT(*) FROM dbo.clientes) AS clientes,
    (SELECT COUNT(*) FROM dbo.servicios_contratados) AS servicios_contratados,
    (SELECT COUNT(*) FROM dbo.casos) AS casos,
    (SELECT COUNT(*) FROM dbo.sintomas_incidencia) AS sintomas_incidencia,
    SYSDATETIME() AS fecha_validacion;
GO