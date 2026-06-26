USE ClaroAtencion360;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

BEGIN TRANSACTION;

/* =========================================================
   1. HASH BASE (Claro123*)
========================================================= */
DECLARE @PasswordHash NVARCHAR(300);
SET @PasswordHash = CONCAT('sha256$', LOWER(CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', CONVERT(VARCHAR(100), 'Claro123*')), 2)));

/* =========================================================
   2. ROLES
========================================================= */
IF NOT EXISTS (SELECT 1 FROM roles WHERE codigo = 'CLIENTE_PERSONA')
BEGIN
    INSERT INTO roles (codigo, nombre, nombre_visual, frontend_role, descripcion, dashboard_url)
    VALUES
    ('CLIENTE_PERSONA', 'CLIENTE_PERSONA', 'Cliente Persona', 'cliente-persona', 'Cliente natural que registra reclamos, incidencias y consultas.', 'cliente/dashboard.html'),
    ('CLIENTE_EMPRESA', 'CLIENTE_EMPRESA', 'Cliente Empresa', 'cliente-empresa', 'Cliente corporativo con servicios empresariales.', 'cliente/dashboard.html'),
    ('ASESOR', 'ASESOR', 'Asesor', 'asesor', 'Usuario operativo que atiende casos asignados.', 'asesor/dashboard.html'),
    ('SUPERVISOR', 'SUPERVISOR', 'Supervisor', 'supervisor', 'Usuario encargado de supervisar casos, SLA y asesores.', 'supervisor/dashboard.html'),
    ('ADMINISTRADOR', 'ADMINISTRADOR', 'Administrador', 'admin', 'Usuario encargado de administrar la plataforma.', 'admin/dashboard.html');
END

/* =========================================================
   3. ÁREAS
========================================================= */
IF NOT EXISTS (SELECT 1 FROM areas WHERE nombre = 'Atención al Cliente')
BEGIN
    INSERT INTO areas (nombre, descripcion)
    VALUES
    ('Atención al Cliente', 'Gestión de reclamos, solicitudes y orientación general.'),
    ('Soporte Técnico', 'Atención de incidencias técnicas de internet, móvil, TV y app.'),
    ('Facturación', 'Revisión de recibos, cargos, pagos y ajustes.'),
    ('Backoffice', 'Validaciones internas y coordinación con áreas de soporte.'),
    ('Supervisión', 'Control operativo, asignación, SLA y monitoreo.'),
    ('Administración', 'Gestión de usuarios, catálogos, permisos y configuración.'),
    ('Empresas y Cloud', 'Soporte especializado para clientes empresa y servicios cloud.'),
    ('Redes y Conectividad', 'Gestión de fallas masivas, red móvil, fibra y conectividad.');
END

/* =========================================================
   4. PERMISOS
========================================================= */
IF NOT EXISTS (SELECT 1 FROM permisos WHERE modulo = 'Cliente' AND nombre = 'Registrar reclamo')
BEGIN
    INSERT INTO permisos (modulo, nombre, descripcion, es_sensible)
    VALUES
    ('Cliente', 'Registrar reclamo', 'Permite registrar reclamos.', 0),
    ('Cliente', 'Registrar incidencia', 'Permite registrar incidencias técnicas.', 0),
    ('Cliente', 'Consultar casos propios', 'Permite consultar casos asociados al cliente.', 0),
    ('Cliente', 'Adjuntar evidencias', 'Permite adjuntar evidencias al caso.', 0),
    ('Asesor', 'Ver bandeja de casos', 'Permite visualizar casos asignados.', 0),
    ('Asesor', 'Actualizar atención', 'Permite registrar avances y respuestas.', 0),
    ('Asesor', 'Cerrar caso', 'Permite cerrar casos resueltos.', 1),
    ('Asesor', 'Usar plantillas', 'Permite responder usando plantillas.', 0),
    ('Supervisor', 'Ver dashboard supervisor', 'Permite monitorear operación y SLA.', 0),
    ('Supervisor', 'Asignar casos', 'Permite asignar casos a asesores.', 1),
    ('Supervisor', 'Reasignar casos', 'Permite reasignar carga operativa.', 1),
    ('Supervisor', 'Escalar casos', 'Permite escalar casos críticos.', 1),
    ('Supervisor', 'Ver rendimiento', 'Permite ver indicadores de asesores.', 0),
    ('Administración', 'Gestionar usuarios', 'Permite crear, editar y bloquear usuarios.', 1),
    ('Administración', 'Gestionar roles y permisos', 'Permite modificar roles y matriz de permisos.', 1),
    ('Administración', 'Gestionar catálogos', 'Permite administrar catálogos operativos.', 1),
    ('Administración', 'Gestionar reglas SLA', 'Permite configurar reglas y tiempos SLA.', 1),
    ('Administración', 'Ver auditoría', 'Permite revisar trazabilidad administrativa.', 1),
    ('Administración', 'Gestionar integraciones', 'Permite administrar integraciones del sistema.', 1),
    ('Administración', 'Gestionar respaldo', 'Permite ejecutar y validar respaldos.', 1),
    ('Administración', 'Configurar sistema', 'Permite modificar parámetros globales.', 1);
END

/* =========================================================
   5. ROLES_PERMISOS
========================================================= */
IF NOT EXISTS (SELECT 1 FROM roles_permisos)
BEGIN
    INSERT INTO roles_permisos (rol_id, permiso_id)
    SELECT r.rol_id, p.permiso_id
    FROM roles r
    CROSS JOIN permisos p
    WHERE
        r.codigo = 'ADMINISTRADOR'
        OR (r.codigo IN ('CLIENTE_PERSONA', 'CLIENTE_EMPRESA') AND p.modulo = 'Cliente')
        OR (r.codigo = 'ASESOR' AND p.modulo IN ('Cliente', 'Asesor'))
        OR (r.codigo = 'SUPERVISOR' AND p.modulo IN ('Asesor', 'Supervisor'));
END

/* =========================================================
   6. USUARIOS INTERNOS
========================================================= */
IF NOT EXISTS (SELECT 1 FROM usuarios WHERE username = 'admin.sistema')
BEGIN
    INSERT INTO usuarios (rol_id, area_id, username, correo, password_hash, estado, tipo_acceso)
    VALUES
    ((SELECT rol_id FROM roles WHERE codigo='ADMINISTRADOR'), (SELECT area_id FROM areas WHERE nombre='Administración'), 'admin.sistema', 'admin.sistema@claro.com.pe', @PasswordHash, 'ACTIVO', 'Acceso administrativo'),
    ((SELECT rol_id FROM roles WHERE codigo='SUPERVISOR'), (SELECT area_id FROM areas WHERE nombre='Supervisión'), 'carolina.vargas', 'carolina.vargas@claro.com.pe', @PasswordHash, 'ACTIVO', 'Acceso supervisor'),
    ((SELECT rol_id FROM roles WHERE codigo='SUPERVISOR'), (SELECT area_id FROM areas WHERE nombre='Supervisión'), 'miguel.torres', 'miguel.torres@claro.com.pe', @PasswordHash, 'ACTIVO', 'Acceso supervisor'),
    ((SELECT rol_id FROM roles WHERE codigo='ASESOR'), (SELECT area_id FROM areas WHERE nombre='Atención al Cliente'), 'luis.ramirez', 'luis.ramirez@claro.com.pe', @PasswordHash, 'ACTIVO', 'Acceso operativo'),
    ((SELECT rol_id FROM roles WHERE codigo='ASESOR'), (SELECT area_id FROM areas WHERE nombre='Facturación'), 'valeria.mendoza', 'valeria.mendoza@claro.com.pe', @PasswordHash, 'ACTIVO', 'Acceso operativo'),
    ((SELECT rol_id FROM roles WHERE codigo='ASESOR'), (SELECT area_id FROM areas WHERE nombre='Soporte Técnico'), 'jose.quispe', 'jose.quispe@claro.com.pe', @PasswordHash, 'ACTIVO', 'Acceso operativo'),
    ((SELECT rol_id FROM roles WHERE codigo='ASESOR'), (SELECT area_id FROM areas WHERE nombre='Backoffice'), 'mariana.paredes', 'mariana.paredes@claro.com.pe', @PasswordHash, 'ACTIVO', 'Acceso operativo'),
    ((SELECT rol_id FROM roles WHERE codigo='ASESOR'), (SELECT area_id FROM areas WHERE nombre='Empresas y Cloud'), 'diego.castillo', 'diego.castillo@claro.com.pe', @PasswordHash, 'ACTIVO', 'Acceso operativo'),
    ((SELECT rol_id FROM roles WHERE codigo='ASESOR'), (SELECT area_id FROM areas WHERE nombre='Redes y Conectividad'), 'paola.navarro', 'paola.navarro@claro.com.pe', @PasswordHash, 'ACTIVO', 'Acceso operativo');
END

IF NOT EXISTS (SELECT 1 FROM personal WHERE documento_numero = '70000001')
BEGIN
    INSERT INTO personal (usuario_id, area_id, nombres, apellidos, documento_tipo, documento_numero, telefono, cargo)
    VALUES
    ((SELECT usuario_id FROM usuarios WHERE username='admin.sistema'), (SELECT area_id FROM areas WHERE nombre='Administración'), 'Administrador', 'Sistema', 'DNI', '70000001', '999000001', 'Administrador del Sistema'),
    ((SELECT usuario_id FROM usuarios WHERE username='carolina.vargas'), (SELECT area_id FROM areas WHERE nombre='Supervisión'), 'Carolina', 'Vargas Salazar', 'DNI', '70000002', '999000002', 'Supervisora de Atención'),
    ((SELECT usuario_id FROM usuarios WHERE username='miguel.torres'), (SELECT area_id FROM areas WHERE nombre='Supervisión'), 'Miguel', 'Torres Campos', 'DNI', '70000003', '999000003', 'Supervisor de Operaciones'),
    ((SELECT usuario_id FROM usuarios WHERE username='luis.ramirez'), (SELECT area_id FROM areas WHERE nombre='Atención al Cliente'), 'Luis', 'Ramírez Peña', 'DNI', '70000004', '999000004', 'Asesor de Atención'),
    ((SELECT usuario_id FROM usuarios WHERE username='valeria.mendoza'), (SELECT area_id FROM areas WHERE nombre='Facturación'), 'Valeria', 'Mendoza Ruiz', 'DNI', '70000005', '999000005', 'Asesora de Facturación'),
    ((SELECT usuario_id FROM usuarios WHERE username='jose.quispe'), (SELECT area_id FROM areas WHERE nombre='Soporte Técnico'), 'José', 'Quispe Huamán', 'DNI', '70000006', '999000006', 'Asesor Técnico'),
    ((SELECT usuario_id FROM usuarios WHERE username='mariana.paredes'), (SELECT area_id FROM areas WHERE nombre='Backoffice'), 'Mariana', 'Paredes León', 'DNI', '70000007', '999000007', 'Asesora Backoffice'),
    ((SELECT usuario_id FROM usuarios WHERE username='diego.castillo'), (SELECT area_id FROM areas WHERE nombre='Empresas y Cloud'), 'Diego', 'Castillo Ríos', 'DNI', '70000008', '999000008', 'Asesor Empresas'),
    ((SELECT usuario_id FROM usuarios WHERE username='paola.navarro'), (SELECT area_id FROM areas WHERE nombre='Redes y Conectividad'), 'Paola', 'Navarro Flores', 'DNI', '70000009', '999000009', 'Asesora de Redes');
END

/* =========================================================
   7. USUARIOS CLIENTE PERSONA
========================================================= */
IF NOT EXISTS (SELECT 1 FROM usuarios WHERE username = 'ana.lopez')
BEGIN
    INSERT INTO usuarios (rol_id, username, correo, password_hash, estado, tipo_acceso)
    VALUES
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_PERSONA'), 'ana.lopez', 'ana.lopez@gmail.com', @PasswordHash, 'ACTIVO', 'Acceso cliente persona'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_PERSONA'), 'carlos.mejia', 'carlos.mejia@gmail.com', @PasswordHash, 'ACTIVO', 'Acceso cliente persona'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_PERSONA'), 'rosa.cardenas', 'rosa.cardenas@gmail.com', @PasswordHash, 'ACTIVO', 'Acceso cliente persona'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_PERSONA'), 'miguel.flores', 'miguel.flores@gmail.com', @PasswordHash, 'ACTIVO', 'Acceso cliente persona'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_PERSONA'), 'lucia.rojas', 'lucia.rojas@gmail.com', @PasswordHash, 'ACTIVO', 'Acceso cliente persona'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_PERSONA'), 'jorge.herrera', 'jorge.herrera@gmail.com', @PasswordHash, 'ACTIVO', 'Acceso cliente persona'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_PERSONA'), 'camila.soto', 'camila.soto@gmail.com', @PasswordHash, 'ACTIVO', 'Acceso cliente persona'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_PERSONA'), 'fernando.arias', 'fernando.arias@gmail.com', @PasswordHash, 'ACTIVO', 'Acceso cliente persona'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_PERSONA'), 'daniela.vega', 'daniela.vega@gmail.com', @PasswordHash, 'ACTIVO', 'Acceso cliente persona'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_PERSONA'), 'alonso.rivera', 'alonso.rivera@gmail.com', @PasswordHash, 'ACTIVO', 'Acceso cliente persona'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_PERSONA'), 'natalia.chavez', 'natalia.chavez@gmail.com', @PasswordHash, 'ACTIVO', 'Acceso cliente persona'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_PERSONA'), 'sebastian.morales', 'sebastian.morales@gmail.com', @PasswordHash, 'ACTIVO', 'Acceso cliente persona');
END

IF NOT EXISTS (SELECT 1 FROM clientes WHERE documento_numero = '76543210')
BEGIN
    INSERT INTO clientes (usuario_id, tipo_cliente, nombres, apellidos, documento_tipo, documento_numero, correo, telefono, direccion)
    VALUES
    ((SELECT usuario_id FROM usuarios WHERE username='ana.lopez'), 'PERSONA', 'Ana', 'López Torres', 'DNI', '76543210', 'ana.lopez@gmail.com', '987111111', 'Av. Arequipa 123, Miraflores'),
    ((SELECT usuario_id FROM usuarios WHERE username='carlos.mejia'), 'PERSONA', 'Carlos', 'Mejía Salas', 'DNI', '76543211', 'carlos.mejia@gmail.com', '987111112', 'Av. La Marina 560, San Miguel'),
    ((SELECT usuario_id FROM usuarios WHERE username='rosa.cardenas'), 'PERSONA', 'Rosa', 'Cárdenas Vega', 'DNI', '76543212', 'rosa.cardenas@gmail.com', '987111113', 'Jr. Los Pinos 450, Surco'),
    ((SELECT usuario_id FROM usuarios WHERE username='miguel.flores'), 'PERSONA', 'Miguel', 'Flores Ramos', 'DNI', '76543213', 'miguel.flores@gmail.com', '987111114', 'Av. Universitaria 302, Los Olivos'),
    ((SELECT usuario_id FROM usuarios WHERE username='lucia.rojas'), 'PERSONA', 'Lucía', 'Rojas Díaz', 'DNI', '76543214', 'lucia.rojas@gmail.com', '987111115', 'Av. Brasil 822, Pueblo Libre'),
    ((SELECT usuario_id FROM usuarios WHERE username='jorge.herrera'), 'PERSONA', 'Jorge', 'Herrera Ponce', 'DNI', '76543215', 'jorge.herrera@gmail.com', '987111116', 'Av. Javier Prado 1002, San Borja'),
    ((SELECT usuario_id FROM usuarios WHERE username='camila.soto'), 'PERSONA', 'Camila', 'Soto Núñez', 'DNI', '76543216', 'camila.soto@gmail.com', '987111117', 'Calle Los Fresnos 220, La Molina'),
    ((SELECT usuario_id FROM usuarios WHERE username='fernando.arias'), 'PERSONA', 'Fernando', 'Arias Valdez', 'DNI', '76543217', 'fernando.arias@gmail.com', '987111118', 'Av. Colonial 312, Bellavista'),
    ((SELECT usuario_id FROM usuarios WHERE username='daniela.vega'), 'PERSONA', 'Daniela', 'Vega Morales', 'DNI', '76543218', 'daniela.vega@gmail.com', '987111119', 'Av. Canadá 670, La Victoria'),
    ((SELECT usuario_id FROM usuarios WHERE username='alonso.rivera'), 'PERSONA', 'Alonso', 'Rivera Cáceres', 'DNI', '76543219', 'alonso.rivera@gmail.com', '987111120', 'Av. Próceres 190, San Juan de Lurigancho'),
    ((SELECT usuario_id FROM usuarios WHERE username='natalia.chavez'), 'PERSONA', 'Natalia', 'Chávez Medina', 'DNI', '76543220', 'natalia.chavez@gmail.com', '987111121', 'Av. Aviación 2110, San Borja'),
    ((SELECT usuario_id FROM usuarios WHERE username='sebastian.morales'), 'PERSONA', 'Sebastián', 'Morales Vera', 'DNI', '76543221', 'sebastian.morales@gmail.com', '987111122', 'Av. Guardia Civil 900, Chorrillos');
END

/* =========================================================
   8. USUARIOS CLIENTE EMPRESA
========================================================= */
IF NOT EXISTS (SELECT 1 FROM usuarios WHERE username = 'contacto.acme')
BEGIN
    INSERT INTO usuarios (rol_id, username, correo, password_hash, estado, tipo_acceso)
    VALUES
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_EMPRESA'), 'contacto.acme', 'contacto@acmeperu.com', @PasswordHash, 'ACTIVO', 'Acceso cliente empresa'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_EMPRESA'), 'soporte.andean', 'soporte@andeanfoods.com', @PasswordHash, 'ACTIVO', 'Acceso cliente empresa'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_EMPRESA'), 'ti.globaltech', 'ti@globaltech.pe', @PasswordHash, 'ACTIVO', 'Acceso cliente empresa'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_EMPRESA'), 'admin.novasalud', 'admin@novasalud.pe', @PasswordHash, 'ACTIVO', 'Acceso cliente empresa'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_EMPRESA'), 'operaciones.logiperu', 'operaciones@logiperu.com', @PasswordHash, 'ACTIVO', 'Acceso cliente empresa'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_EMPRESA'), 'sistemas.educorp', 'sistemas@educorp.pe', @PasswordHash, 'ACTIVO', 'Acceso cliente empresa'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_EMPRESA'), 'mesa.hotelesandinos', 'mesa@hotelesandinos.pe', @PasswordHash, 'ACTIVO', 'Acceso cliente empresa'),
    ((SELECT rol_id FROM roles WHERE codigo='CLIENTE_EMPRESA'), 'cloud.mercadoperu', 'cloud@mercadoperu.pe', @PasswordHash, 'ACTIVO', 'Acceso cliente empresa');
END

IF NOT EXISTS (SELECT 1 FROM clientes WHERE documento_numero = '20123456789')
BEGIN
    INSERT INTO clientes (usuario_id, tipo_cliente, razon_social, documento_tipo, documento_numero, correo, telefono, direccion)
    VALUES
    ((SELECT usuario_id FROM usuarios WHERE username='contacto.acme'), 'EMPRESA', 'ACME Perú S.A.C.', 'RUC', '20123456789', 'contacto@acmeperu.com', '016001001', 'Av. República de Panamá 3410, San Isidro'),
    ((SELECT usuario_id FROM usuarios WHERE username='soporte.andean'), 'EMPRESA', 'Andean Foods S.A.', 'RUC', '20123456780', 'soporte@andeanfoods.com', '016001002', 'Av. Argentina 2200, Callao'),
    ((SELECT usuario_id FROM usuarios WHERE username='ti.globaltech'), 'EMPRESA', 'GlobalTech Solutions Perú S.R.L.', 'RUC', '20555111222', 'ti@globaltech.pe', '016001003', 'Av. Canaval y Moreyra 480, San Isidro'),
    ((SELECT usuario_id FROM usuarios WHERE username='admin.novasalud'), 'EMPRESA', 'NovaSalud Clínicas S.A.C.', 'RUC', '20666111333', 'admin@novasalud.pe', '016001004', 'Av. Javier Prado Este 2400, San Borja'),
    ((SELECT usuario_id FROM usuarios WHERE username='operaciones.logiperu'), 'EMPRESA', 'LogiPerú Operadores S.A.C.', 'RUC', '20777111444', 'operaciones@logiperu.com', '016001005', 'Av. Industrial 1600, Ate'),
    ((SELECT usuario_id FROM usuarios WHERE username='sistemas.educorp'), 'EMPRESA', 'EduCorp Perú S.A.C.', 'RUC', '20888111555', 'sistemas@educorp.pe', '016001006', 'Av. La Encalada 540, Surco'),
    ((SELECT usuario_id FROM usuarios WHERE username='mesa.hotelesandinos'), 'EMPRESA', 'Hoteles Andinos S.A.', 'RUC', '20999111666', 'mesa@hotelesandinos.pe', '016001007', 'Av. Larco 812, Miraflores'),
    ((SELECT usuario_id FROM usuarios WHERE username='cloud.mercadoperu'), 'EMPRESA', 'Mercado Perú Digital S.A.C.', 'RUC', '20444111777', 'cloud@mercadoperu.pe', '016001008', 'Av. Primavera 120, Surco');
END

/* =========================================================
   9. CATÁLOGOS OPERATIVOS
========================================================= */
IF NOT EXISTS (SELECT 1 FROM tipos_caso WHERE nombre = 'Reclamo')
BEGIN
    INSERT INTO tipos_caso (nombre, descripcion)
    VALUES
    ('Reclamo', 'Disconformidad por facturación, cobro, atención o servicio.'),
    ('Incidencia', 'Falla técnica, interrupción, lentitud o error de servicio.'),
    ('Solicitud', 'Requerimiento de información, cambio, soporte o gestión administrativa.');
END

IF NOT EXISTS (SELECT 1 FROM categorias WHERE nombre = 'Facturación')
BEGIN
    INSERT INTO categorias (nombre, descripcion)
    VALUES
    ('Facturación', 'Recibos, cobros, cargos no reconocidos y pagos.'),
    ('Internet hogar', 'Fallas, lentitud, cobertura y router.'),
    ('Móvil', 'Línea móvil, datos, señal, llamadas y SMS.'),
    ('Claro TV', 'Señal, decodificador, canales y paquetes.'),
    ('App Mi Claro', 'Acceso, pagos, recibos y gestiones digitales.'),
    ('Atención al cliente', 'Trato, tiempos de atención y calidad de servicio.'),
    ('Fibra empresarial', 'Conectividad dedicada y enlaces corporativos.'),
    ('Cloud empresarial', 'Infraestructura cloud, almacenamiento y backup.'),
    ('Correo empresas', 'Correo corporativo, colaboración y acceso.'),
    ('Ciberseguridad', 'Servicios de seguridad, monitoreo y protección.');
END

IF NOT EXISTS (SELECT 1 FROM prioridades WHERE nombre = 'Baja')
BEGIN
    INSERT INTO prioridades (nombre, descripcion, horas_sla)
    VALUES
    ('Baja', 'Caso no urgente.', 72),
    ('Media', 'Caso estándar.', 48),
    ('Alta', 'Caso con afectación importante.', 24),
    ('Crítica', 'Caso con impacto severo o servicio detenido.', 8);
END

IF NOT EXISTS (SELECT 1 FROM estados_caso WHERE nombre = 'Registrado')
BEGIN
    INSERT INTO estados_caso (nombre, descripcion, orden, es_final)
    VALUES
    ('Registrado', 'Caso ingresado por el cliente.', 1, 0),
    ('Clasificado', 'Caso clasificado por tipo, categoría y prioridad.', 2, 0),
    ('En atención', 'Caso asignado a un asesor.', 3, 0),
    ('Pendiente por cliente', 'Se requiere información adicional del cliente.', 4, 0),
    ('Derivado', 'Caso enviado a un área especializada.', 5, 0),
    ('Escalado', 'Caso elevado por criticidad o SLA.', 6, 0),
    ('Resuelto', 'Caso con solución registrada.', 7, 0),
    ('Cerrado', 'Caso finalizado.', 8, 1);
END

IF NOT EXISTS (SELECT 1 FROM canales_ingreso WHERE nombre = 'Portal web')
BEGIN
    INSERT INTO canales_ingreso (nombre, descripcion)
    VALUES
    ('Portal web', 'Ingreso desde plataforma web.'),
    ('App Mi Claro', 'Ingreso desde aplicación móvil.'),
    ('Call center', 'Ingreso mediante atención telefónica.'),
    ('WhatsApp', 'Ingreso mediante canal WhatsApp.'),
    ('Correo', 'Ingreso mediante correo electrónico.'),
    ('Mesa empresarial', 'Ingreso desde canal corporativo.');
END

IF NOT EXISTS (SELECT 1 FROM motivos_catalogo WHERE nombre = 'Cobro no reconocido')
BEGIN
    INSERT INTO motivos_catalogo (nombre, descripcion)
    VALUES
    ('Cobro no reconocido', 'Cliente reporta cargo que no identifica.'),
    ('Servicio intermitente', 'Cliente reporta cortes o lentitud.'),
    ('Sin servicio', 'Cliente reporta servicio completamente detenido.'),
    ('Error de acceso', 'Cliente no puede acceder a plataforma o correo.'),
    ('Solicitud de ajuste', 'Cliente solicita revisión o regularización.');
END

/* =========================================================
   10. SERVICIOS
========================================================= */
IF NOT EXISTS (SELECT 1 FROM servicios WHERE nombre = 'Internet Hogar Fibra 300 Mbps')
BEGIN
    INSERT INTO servicios (nombre, tipo_servicio, segmento, descripcion)
    VALUES
    ('Internet Hogar Fibra 300 Mbps', 'internet', 'PERSONAS', 'Servicio de internet fijo residencial.'),
    ('Internet Hogar Fibra 600 Mbps', 'internet', 'PERSONAS', 'Servicio de internet fijo residencial de alta velocidad.'),
    ('Plan Móvil Max 95.90', 'movil', 'PERSONAS', 'Plan móvil con datos, llamadas y beneficios.'),
    ('Plan Móvil Ilimitado 129.90', 'movil', 'PERSONAS', 'Plan móvil ilimitado.'),
    ('Claro TV+', 'tv', 'PERSONAS', 'Servicio de televisión y contenido digital.'),
    ('App Mi Claro', 'app', 'AMBOS', 'Gestiones digitales, pagos y recibos.'),
    ('Fibra Óptica Empresarial 1Gbps', 'fibra', 'EMPRESAS', 'Enlace de fibra empresarial.'),
    ('Internet Dedicado Empresarial', 'fibra', 'EMPRESAS', 'Conectividad dedicada con SLA empresarial.'),
    ('Cloud Empresarial', 'cloud', 'EMPRESAS', 'Infraestructura y almacenamiento cloud.'),
    ('Correo Corporativo Claro Empresas', 'correo', 'EMPRESAS', 'Correo y colaboración empresarial.'),
    ('Backup y Seguridad Empresas', 'seguridad', 'EMPRESAS', 'Solución de respaldo y seguridad administrada.');
END

/* =========================================================
   11. SERVICIOS CONTRATADOS (solo si no existen)
========================================================= */
IF NOT EXISTS (SELECT 1 FROM servicios_contratados WHERE codigo_contrato = 'CTR-PER-0001')
BEGIN
    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Internet Hogar Fibra 300 Mbps'), 'CTR-PER-0001', 'Internet Hogar 300 Mbps', direccion, 'Miraflores', '2024-01-15', 109.90
    FROM clientes WHERE documento_numero='76543210';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Plan Móvil Max 95.90'), 'CTR-PER-0002', 'Plan Móvil Max 95.90', direccion, 'San Miguel', '2024-02-10', 95.90
    FROM clientes WHERE documento_numero='76543211';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Claro TV+'), 'CTR-PER-0003', 'Claro TV+ Familiar', direccion, 'Surco', '2024-03-18', 89.90
    FROM clientes WHERE documento_numero='76543212';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Internet Hogar Fibra 600 Mbps'), 'CTR-PER-0004', 'Internet Hogar 600 Mbps', direccion, 'Los Olivos', '2024-04-01', 139.90
    FROM clientes WHERE documento_numero='76543213';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Plan Móvil Ilimitado 129.90'), 'CTR-PER-0005', 'Plan Móvil Ilimitado', direccion, 'Pueblo Libre', '2024-05-12', 129.90
    FROM clientes WHERE documento_numero='76543214';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Internet Hogar Fibra 300 Mbps'), 'CTR-PER-0006', 'Internet Hogar 300 Mbps', direccion, 'San Borja', '2024-06-20', 109.90
    FROM clientes WHERE documento_numero='76543215';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Plan Móvil Max 95.90'), 'CTR-PER-0007', 'Plan Móvil Max 95.90', direccion, 'La Molina', '2024-07-05', 95.90
    FROM clientes WHERE documento_numero='76543216';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Claro TV+'), 'CTR-PER-0008', 'Claro TV+ Familiar', direccion, 'Bellavista', '2024-08-09', 89.90
    FROM clientes WHERE documento_numero='76543217';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='App Mi Claro'), 'CTR-PER-0009', 'Gestión Digital Mi Claro', direccion, 'La Victoria', '2024-09-11', 0.00
    FROM clientes WHERE documento_numero='76543218';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Internet Hogar Fibra 600 Mbps'), 'CTR-PER-0010', 'Internet Hogar 600 Mbps', direccion, 'San Juan de Lurigancho', '2024-10-01', 139.90
    FROM clientes WHERE documento_numero='76543219';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Plan Móvil Ilimitado 129.90'), 'CTR-PER-0011', 'Plan Móvil Ilimitado', direccion, 'San Borja', '2024-11-14', 129.90
    FROM clientes WHERE documento_numero='76543220';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Internet Hogar Fibra 300 Mbps'), 'CTR-PER-0012', 'Internet Hogar 300 Mbps', direccion, 'Chorrillos', '2024-12-02', 109.90
    FROM clientes WHERE documento_numero='76543221';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Fibra Óptica Empresarial 1Gbps'), 'CTR-EMP-0001', 'Fibra Empresarial 1Gbps', direccion, 'San Isidro', '2023-01-12', 1200.00
    FROM clientes WHERE documento_numero='20123456789';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Internet Dedicado Empresarial'), 'CTR-EMP-0002', 'Internet Dedicado 500 Mbps', direccion, 'Callao', '2023-02-22', 1850.00
    FROM clientes WHERE documento_numero='20123456780';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Cloud Empresarial'), 'CTR-EMP-0003', 'Cloud Empresarial Pro', direccion, 'San Isidro', '2023-03-10', 2500.00
    FROM clientes WHERE documento_numero='20555111222';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Correo Corporativo Claro Empresas'), 'CTR-EMP-0004', 'Correo Corporativo 300 cuentas', direccion, 'San Borja', '2023-04-17', 890.00
    FROM clientes WHERE documento_numero='20666111333';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Backup y Seguridad Empresas'), 'CTR-EMP-0005', 'Backup y Seguridad Administrada', direccion, 'Ate', '2023-05-29', 1600.00
    FROM clientes WHERE documento_numero='20777111444';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Cloud Empresarial'), 'CTR-EMP-0006', 'Cloud Educativo Pro', direccion, 'Surco', '2023-06-19', 2100.00
    FROM clientes WHERE documento_numero='20888111555';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Fibra Óptica Empresarial 1Gbps'), 'CTR-EMP-0007', 'Fibra Hoteles 1Gbps', direccion, 'Miraflores', '2023-07-07', 1450.00
    FROM clientes WHERE documento_numero='20999111666';

    INSERT INTO servicios_contratados (cliente_id, servicio_id, codigo_contrato, plan_nombre, direccion_instalacion, distrito, fecha_inicio, monto_mensual)
    SELECT cliente_id, (SELECT servicio_id FROM servicios WHERE nombre='Correo Corporativo Claro Empresas'), 'CTR-EMP-0008', 'Correo Corporativo 500 cuentas', direccion, 'Surco', '2023-08-18', 1200.00
    FROM clientes WHERE documento_numero='20444111777';
END

/* =========================================================
   12. GENERACIÓN DE 72 CASOS (solo si no existen)
========================================================= */
IF NOT EXISTS (SELECT 1 FROM casos WHERE codigo_caso = 'CAS-2026-000001')
BEGIN
    DECLARE @i INT = 1;
    DECLARE @totalContratos INT;
    DECLARE @cliente_id INT;
    DECLARE @servicio_contratado_id INT;
    DECLARE @tipoCliente NVARCHAR(20);
    DECLARE @tipo_caso_id INT;
    DECLARE @categoria_id INT;
    DECLARE @prioridad_id INT;
    DECLARE @estado_caso_id INT;
    DECLARE @canal_ingreso_id INT;
    DECLARE @asesor_usuario_id INT;
    DECLARE @supervisor_usuario_id INT;
    DECLARE @codigo NVARCHAR(40);
    DECLARE @titulo NVARCHAR(180);
    DECLARE @descripcion NVARCHAR(MAX);
    DECLARE @fecha_registro DATETIME2;
    DECLARE @fecha_limite DATETIME2;
    DECLARE @fecha_cierre DATETIME2;
    DECLARE @horas_sla INT;
    DECLARE @estado_nombre NVARCHAR(80);
    DECLARE @prioridad_nombre NVARCHAR(50);
    DECLARE @categoria_nombre NVARCHAR(100);
    DECLARE @caso_id INT;

    DECLARE @Contratos TABLE (rn INT IDENTITY(1,1), servicio_contratado_id INT, cliente_id INT, tipo_cliente NVARCHAR(20));
    INSERT INTO @Contratos (servicio_contratado_id, cliente_id, tipo_cliente)
    SELECT sc.servicio_contratado_id, sc.cliente_id, c.tipo_cliente
    FROM servicios_contratados sc
    INNER JOIN clientes c ON c.cliente_id = sc.cliente_id
    ORDER BY sc.servicio_contratado_id;
    SELECT @totalContratos = COUNT(*) FROM @Contratos;

    DECLARE @Asesores TABLE (rn INT IDENTITY(1,1), usuario_id INT);
    INSERT INTO @Asesores (usuario_id)
    SELECT u.usuario_id
    FROM usuarios u
    INNER JOIN roles r ON r.rol_id = u.rol_id
    WHERE r.codigo = 'ASESOR'
    ORDER BY u.usuario_id;

    SELECT @supervisor_usuario_id = usuario_id
    FROM usuarios
    WHERE username = 'carolina.vargas';

    WHILE @i <= 72
    BEGIN
        SELECT @servicio_contratado_id = servicio_contratado_id, @cliente_id = cliente_id, @tipoCliente = tipo_cliente
        FROM @Contratos WHERE rn = ((@i - 1) % @totalContratos) + 1;

        SET @codigo = CONCAT('CAS-2026-', RIGHT(CONCAT('000000', @i), 6));

        IF @i % 4 = 0
            SELECT @tipo_caso_id = tipo_caso_id FROM tipos_caso WHERE nombre = 'Solicitud';
        ELSE IF @i % 2 = 0
            SELECT @tipo_caso_id = tipo_caso_id FROM tipos_caso WHERE nombre = 'Incidencia';
        ELSE
            SELECT @tipo_caso_id = tipo_caso_id FROM tipos_caso WHERE nombre = 'Reclamo';

        IF @tipoCliente = 'EMPRESA'
            SET @categoria_nombre = CASE @i % 5 WHEN 0 THEN 'Fibra empresarial' WHEN 1 THEN 'Cloud empresarial' WHEN 2 THEN 'Correo empresas' WHEN 3 THEN 'Ciberseguridad' ELSE 'Facturación' END;
        ELSE
            SET @categoria_nombre = CASE @i % 6 WHEN 0 THEN 'Facturación' WHEN 1 THEN 'Internet hogar' WHEN 2 THEN 'Móvil' WHEN 3 THEN 'Claro TV' WHEN 4 THEN 'App Mi Claro' ELSE 'Atención al cliente' END;

        SELECT @categoria_id = categoria_id FROM categorias WHERE nombre = @categoria_nombre;

        SET @prioridad_nombre = CASE WHEN @i % 15 = 0 THEN 'Crítica' WHEN @i % 5 = 0 THEN 'Alta' WHEN @i % 3 = 0 THEN 'Media' ELSE 'Baja' END;
        SELECT @prioridad_id = prioridad_id, @horas_sla = horas_sla FROM prioridades WHERE nombre = @prioridad_nombre;

        SET @estado_nombre = CASE
            WHEN @i % 12 = 0 THEN 'Cerrado'
            WHEN @i % 11 = 0 THEN 'Resuelto'
            WHEN @i % 10 = 0 THEN 'Escalado'
            WHEN @i % 9 = 0 THEN 'Derivado'
            WHEN @i % 8 = 0 THEN 'Pendiente por cliente'
            WHEN @i % 7 = 0 THEN 'Registrado'
            WHEN @i % 6 = 0 THEN 'Clasificado'
            ELSE 'En atención'
        END;
        SELECT @estado_caso_id = estado_caso_id FROM estados_caso WHERE nombre = @estado_nombre;

        SELECT @canal_ingreso_id = canal_ingreso_id FROM canales_ingreso
        WHERE nombre = CASE @i % 6 WHEN 0 THEN 'Portal web' WHEN 1 THEN 'App Mi Claro' WHEN 2 THEN 'Call center' WHEN 3 THEN 'WhatsApp' WHEN 4 THEN 'Correo' ELSE 'Mesa empresarial' END;

        IF @estado_nombre = 'Registrado'
            SET @asesor_usuario_id = NULL;
        ELSE
            SELECT @asesor_usuario_id = usuario_id FROM @Asesores WHERE rn = ((@i - 1) % 6) + 1;

        SET @fecha_registro = DATEADD(HOUR, -(@i * 6), SYSDATETIME());
        SET @fecha_limite = DATEADD(HOUR, @horas_sla, @fecha_registro);
        IF @estado_nombre IN ('Cerrado', 'Resuelto') SET @fecha_cierre = DATEADD(HOUR, @horas_sla - 2, @fecha_registro); ELSE SET @fecha_cierre = NULL;

        SET @titulo = CASE @categoria_nombre
            WHEN 'Facturación' THEN 'Revisión de cobro observado en recibo'
            WHEN 'Internet hogar' THEN 'Intermitencia en servicio de internet hogar'
            WHEN 'Móvil' THEN 'Problema con datos móviles o señal'
            WHEN 'Claro TV' THEN 'Problema de señal en Claro TV'
            WHEN 'App Mi Claro' THEN 'Error de acceso o gestión en App Mi Claro'
            WHEN 'Atención al cliente' THEN 'Disconformidad con atención recibida'
            WHEN 'Fibra empresarial' THEN 'Intermitencia en enlace empresarial'
            WHEN 'Cloud empresarial' THEN 'Problema en servicio cloud empresarial'
            WHEN 'Correo empresas' THEN 'Error de acceso a correo corporativo'
            WHEN 'Ciberseguridad' THEN 'Alerta o validación de servicio de seguridad'
            ELSE 'Caso registrado por cliente'
        END;

        SET @descripcion = CONCAT('Caso generado para seguimiento realista. Categoría: ', @categoria_nombre, '. Prioridad: ', @prioridad_nombre, '. Estado actual: ', @estado_nombre, '. El cliente solicita revisión y seguimiento del servicio asociado.');

        INSERT INTO casos (
            codigo_caso, cliente_id, servicio_contratado_id, tipo_caso_id, categoria_id,
            prioridad_id, estado_caso_id, canal_ingreso_id, titulo, descripcion,
            responsable_actual_usuario_id, pendiente_cliente, solucion_final,
            fecha_registro, fecha_limite_resolucion, fecha_actualizacion, fecha_cierre,
            calificacion_cliente, comentario_calificacion
        )
        VALUES (
            @codigo, @cliente_id, @servicio_contratado_id, @tipo_caso_id, @categoria_id,
            @prioridad_id, @estado_caso_id, @canal_ingreso_id, @titulo, @descripcion,
            @asesor_usuario_id,
            CASE WHEN @estado_nombre = 'Pendiente por cliente' THEN 1 ELSE 0 END,
            CASE WHEN @estado_nombre IN ('Cerrado', 'Resuelto') THEN 'Se brindó atención al caso y se registró solución final conforme al procedimiento.' ELSE NULL END,
            @fecha_registro, @fecha_limite, DATEADD(HOUR, 2, @fecha_registro), @fecha_cierre,
            CASE WHEN @estado_nombre = 'Cerrado' THEN 4 ELSE NULL END,
            CASE WHEN @estado_nombre = 'Cerrado' THEN 'Atención conforme.' ELSE NULL END
        );

        SET @caso_id = SCOPE_IDENTITY();

        IF @asesor_usuario_id IS NOT NULL
        BEGIN
            INSERT INTO asignaciones_caso (caso_id, asesor_usuario_id, supervisor_usuario_id, motivo, activo, fecha_asignacion)
            VALUES (@caso_id, @asesor_usuario_id, @supervisor_usuario_id, 'Asignación inicial según categoría y carga operativa.', 1, DATEADD(HOUR, 1, @fecha_registro));
        END

        INSERT INTO historial_caso (caso_id, usuario_id, accion, observacion, es_visible_cliente, fecha_evento)
        VALUES
        (@caso_id, NULL, 'Caso registrado', 'El caso fue registrado correctamente en la plataforma.', 1, @fecha_registro);

        IF @estado_nombre NOT IN ('Registrado')
        BEGIN
            INSERT INTO historial_caso (caso_id, usuario_id, accion, observacion, es_visible_cliente, fecha_evento)
            VALUES
            (@caso_id, @supervisor_usuario_id, 'Caso clasificado', CONCAT('El caso fue clasificado como ', @categoria_nombre, ' con prioridad ', @prioridad_nombre, '.'), 1, DATEADD(HOUR, 1, @fecha_registro));
        END

        IF @asesor_usuario_id IS NOT NULL
        BEGIN
            INSERT INTO historial_caso (caso_id, usuario_id, accion, observacion, es_visible_cliente, fecha_evento)
            VALUES
            (@caso_id, @asesor_usuario_id, 'Caso asignado', 'El caso fue asignado a un asesor responsable para su atención.', 1, DATEADD(HOUR, 2, @fecha_registro));
        END

        IF @estado_nombre = 'Pendiente por cliente'
        BEGIN
            INSERT INTO historial_caso (caso_id, usuario_id, accion, observacion, es_visible_cliente, fecha_evento)
            VALUES
            (@caso_id, @asesor_usuario_id, 'Solicitud de información', 'Se requiere información adicional del cliente para continuar la atención.', 1, DATEADD(HOUR, 4, @fecha_registro));
        END

        IF @estado_nombre = 'Derivado'
        BEGIN
            INSERT INTO historial_caso (caso_id, usuario_id, accion, observacion, es_visible_cliente, fecha_evento)
            VALUES
            (@caso_id, @asesor_usuario_id, 'Caso derivado', 'El caso fue derivado a un área especializada para validación interna.', 1, DATEADD(HOUR, 5, @fecha_registro));
        END

        IF @estado_nombre = 'Escalado'
        BEGIN
            INSERT INTO historial_caso (caso_id, usuario_id, accion, observacion, es_visible_cliente, fecha_evento)
            VALUES
            (@caso_id, @supervisor_usuario_id, 'Caso escalado', 'El caso fue escalado por prioridad o riesgo de SLA.', 1, DATEADD(HOUR, 5, @fecha_registro));
        END

        IF @estado_nombre IN ('Resuelto', 'Cerrado')
        BEGIN
            INSERT INTO historial_caso (caso_id, usuario_id, accion, observacion, es_visible_cliente, fecha_evento)
            VALUES
            (@caso_id, @asesor_usuario_id, 'Solución registrada', 'Se registró solución del caso y respuesta final al cliente.', 1, DATEADD(HOUR, @horas_sla - 3, @fecha_registro));
        END

        IF @estado_nombre = 'Cerrado'
        BEGIN
            INSERT INTO historial_caso (caso_id, usuario_id, accion, observacion, es_visible_cliente, fecha_evento)
            VALUES
            (@caso_id, @asesor_usuario_id, 'Caso cerrado', 'El caso fue cerrado correctamente.', 1, @fecha_cierre);
        END

        IF @i % 4 = 0
        BEGIN
            INSERT INTO evidencias (caso_id, usuario_id, nombre_archivo, ruta_archivo, tipo_archivo, tipo_mime, tamano_bytes, descripcion, es_visible_cliente, fecha_subida)
            VALUES (@caso_id, NULL, CONCAT('evidencia_', @codigo, '.png'), CONCAT('/uploads/evidencias/', @codigo, '.png'), 'Imagen', 'image/png', 420000 + (@i * 1000), 'Evidencia adjuntada por el cliente.', 1, DATEADD(MINUTE, 20, @fecha_registro));
        END

        IF @asesor_usuario_id IS NOT NULL
        BEGIN
            INSERT INTO notificaciones (caso_id, usuario_id, tipo, canal_envio, titulo, mensaje, leida, fecha_generacion, estado_envio)
            VALUES (@caso_id, @asesor_usuario_id, 'ASIGNACION', 'SISTEMA', 'Nuevo caso asignado', CONCAT('Se te asignó el caso ', @codigo, '.'), CASE WHEN @i % 3 = 0 THEN 1 ELSE 0 END, DATEADD(HOUR, 2, @fecha_registro), 'ENVIADO');
        END

        INSERT INTO notificaciones (caso_id, usuario_id, tipo, canal_envio, titulo, mensaje, leida, fecha_generacion, estado_envio)
        SELECT @caso_id, c.usuario_id, 'SEGUIMIENTO', 'SISTEMA', 'Actualización de caso', CONCAT('Tu caso ', @codigo, ' se encuentra en estado ', @estado_nombre, '.'), CASE WHEN @i % 2 = 0 THEN 1 ELSE 0 END, DATEADD(HOUR, 3, @fecha_registro), 'ENVIADO'
        FROM clientes c WHERE c.cliente_id = @cliente_id;

        SET @i += 1;
    END
END

/* =========================================================
   13. PLANTILLAS DE RESPUESTA (si no existen)
========================================================= */
IF NOT EXISTS (SELECT 1 FROM plantillas_respuesta WHERE nombre = 'Respuesta inicial reclamo facturación')
BEGIN
    INSERT INTO plantillas_respuesta (nombre, categoria, canal, descripcion, contenido, creado_por_usuario_id)
    VALUES
    ('Respuesta inicial reclamo facturación', 'Facturación', 'Portal web', 'Plantilla para iniciar revisión de cobro.', 'Estimado cliente, hemos recibido su reclamo de facturación. Revisaremos el detalle del cargo observado y le informaremos el avance por este canal.', (SELECT usuario_id FROM usuarios WHERE username='valeria.mendoza')),
    ('Solicitud de evidencia técnica', 'Soporte Técnico', 'Portal web', 'Plantilla para solicitar evidencia de falla.', 'Estimado cliente, para continuar con la atención necesitamos que adjunte una captura del error, hora aproximada del evento y detalle del servicio afectado.', (SELECT usuario_id FROM usuarios WHERE username='jose.quispe')),
    ('Respuesta incidencia internet hogar', 'Internet hogar', 'Portal web', 'Plantilla para incidencias de internet.', 'Estimado cliente, estamos revisando su incidencia de internet. Verificaremos estado del servicio, cobertura y posibles eventos registrados en su zona.', (SELECT usuario_id FROM usuarios WHERE username='jose.quispe')),
    ('Cierre de caso resuelto', 'Cierre', 'Portal web', 'Plantilla de cierre.', 'Estimado cliente, se registró la solución de su caso. Si el inconveniente persiste, puede responder este mensaje o registrar una nueva incidencia.', (SELECT usuario_id FROM usuarios WHERE username='luis.ramirez')),
    ('Soporte empresa cloud', 'Cloud empresarial', 'Correo', 'Plantilla para atención cloud empresarial.', 'Estimado cliente, hemos recibido su ticket empresarial. Validaremos el servicio cloud afectado, usuarios impactados y evidencia técnica adjunta.', (SELECT usuario_id FROM usuarios WHERE username='diego.castillo'));
END

/* =========================================================
   14. SUPERVISIÓN, REPORTES Y CONFIGURACIÓN
========================================================= */
IF NOT EXISTS (SELECT 1 FROM rutas_supervision WHERE nombre = 'Incidencia técnica crítica')
BEGIN
    INSERT INTO rutas_supervision (nombre, condicion, area_destino, sla_interno, escalamiento, estado, creado_por_usuario_id)
    VALUES
    ('Incidencia técnica crítica', 'Prioridad crítica o servicio detenido', 'Soporte Técnico', '4 horas', 'Supervisor de operaciones', 'Activo', (SELECT usuario_id FROM usuarios WHERE username='carolina.vargas')),
    ('Reclamo de facturación alta', 'Cobro no reconocido con prioridad alta', 'Facturación', '24 horas', 'Backoffice', 'Activo', (SELECT usuario_id FROM usuarios WHERE username='carolina.vargas')),
    ('Ticket empresarial cloud', 'Cliente empresa con servicio cloud afectado', 'Empresas y Cloud', '8 horas', 'Mesa empresarial', 'Activo', (SELECT usuario_id FROM usuarios WHERE username='carolina.vargas')),
    ('Riesgo de SLA', 'Caso con menos de 8 horas para vencimiento', 'Supervisión', '2 horas', 'Jefatura de atención', 'Activo', (SELECT usuario_id FROM usuarios WHERE username='carolina.vargas'));
END

IF NOT EXISTS (SELECT 1 FROM reportes WHERE nombre = 'Resumen ejecutivo semanal')
BEGIN
    INSERT INTO reportes (nombre, tipo, periodo, alcance, formato, comentario, generado_por_usuario_id, estado)
    VALUES
    ('Resumen ejecutivo semanal', 'Resumen ejecutivo', 'Semana actual', 'Sistema completo', 'PDF', 'Reporte semanal de operación, casos y SLA.', (SELECT usuario_id FROM usuarios WHERE username='admin.sistema'), 'Generado'),
    ('Reporte SLA mensual', 'Cumplimiento SLA', 'Mes actual', 'Casos activos y cerrados', 'Excel', 'Reporte de cumplimiento SLA por prioridad.', (SELECT usuario_id FROM usuarios WHERE username='carolina.vargas'), 'Generado'),
    ('Reporte de carga de asesores', 'Rendimiento', 'Semana actual', 'Asesores', 'PDF', 'Carga operativa y casos asignados.', (SELECT usuario_id FROM usuarios WHERE username='miguel.torres'), 'Generado');
END

IF NOT EXISTS (SELECT 1 FROM configuraciones_sistema WHERE clave = 'admin.platformName')
BEGIN
    INSERT INTO configuraciones_sistema (clave, valor, descripcion)
    VALUES
    ('admin.platformName', 'Claro Atención 360', 'Nombre de la plataforma.'),
    ('admin.platformEnvironment', 'Producción académica', 'Ambiente actual de la plataforma.'),
    ('admin.platformOwner', 'Administración del sistema', 'Responsable de plataforma.'),
    ('admin.platformSupportEmail', 'soporte@claro360.com', 'Correo de soporte.'),
    ('admin.sessionTimeout', '30 minutos', 'Tiempo de expiración de sesión.'),
    ('admin.failedAttempts', '5', 'Intentos fallidos antes de bloqueo.'),
    ('admin.mfaPolicy', 'Deshabilitada', 'Política MFA.'),
    ('admin.passwordPolicy', 'Fuerte', 'Política de contraseñas.'),
    ('admin.notifySlaRisk', 'true', 'Alertar riesgo SLA.'),
    ('admin.notifyUserBlocked', 'true', 'Alertar usuario bloqueado.'),
    ('admin.notifyIntegrationError', 'true', 'Alertar error de integración.'),
    ('admin.notifyBackupFailure', 'true', 'Alertar fallo de respaldo.'),
    ('admin.maintenanceMode', 'Desactivado', 'Modo mantenimiento.'),
    ('admin.maintenanceWindow', 'Sin ventana', 'Ventana de mantenimiento.'),
    ('admin.maintenanceMessage', '', 'Mensaje de mantenimiento.'),
    ('supervisor.asignacion.menor_carga', 'Activo', 'Asignación por menor carga.'),
    ('supervisor.sla.umbral_alto', 'Menos de 8 horas', 'Umbral de alerta SLA.'),
    ('supervisor.prioridad.critica', 'Impacto alto + SLA menor a 4h', 'Regla sugerida para prioridad crítica.'),
    ('supervisor.escalamiento.vencimiento', 'Caso vencido', 'Escalamiento por vencimiento.'),
    ('supervisor.capacidad.maxima', '18 casos', 'Capacidad máxima sugerida por asesor.');
END

/* =========================================================
   15. ADMIN: INTEGRACIONES, AUDITORÍA, ALERTAS Y RESPALDO
========================================================= */
IF NOT EXISTS (SELECT 1 FROM integraciones_sistema WHERE nombre = 'Correo transaccional')
BEGIN
    INSERT INTO integraciones_sistema (nombre, tipo, estado, criticidad, endpoint, descripcion, responsable, ultima_sincronizacion, creado_por_usuario_id)
    VALUES
    ('Correo transaccional', 'Correo', 'Activa', 'Alta', 'smtp.claro360.local', 'Servicio para envío de notificaciones.', 'Administración', SYSDATETIME(), (SELECT usuario_id FROM usuarios WHERE username='admin.sistema')),
    ('Autenticación de usuarios', 'Seguridad', 'Activa', 'Alta', 'auth.claro360.local', 'Validación de sesiones y accesos.', 'Administración', SYSDATETIME(), (SELECT usuario_id FROM usuarios WHERE username='admin.sistema')),
    ('API de facturación', 'API', 'Con alerta', 'Alta', 'billing.claro360.local', 'Consulta de recibos y cargos.', 'Backoffice', DATEADD(HOUR, -3, SYSDATETIME()), (SELECT usuario_id FROM usuarios WHERE username='admin.sistema')),
    ('API de servicios técnicos', 'API', 'Activa', 'Media', 'technical.claro360.local', 'Consulta de eventos técnicos.', 'Soporte Técnico', DATEADD(MINUTE, -40, SYSDATETIME()), (SELECT usuario_id FROM usuarios WHERE username='admin.sistema')),
    ('Webhooks de notificación', 'Webhook', 'Activa', 'Media', 'webhooks.claro360.local', 'Eventos de seguimiento y alertas.', 'Administración', DATEADD(MINUTE, -15, SYSDATETIME()), (SELECT usuario_id FROM usuarios WHERE username='admin.sistema'));
END

IF NOT EXISTS (SELECT 1 FROM eventos_integracion WHERE titulo = 'Sincronización registrada')
BEGIN
    INSERT INTO eventos_integracion (integracion_id, titulo, descripcion, estado, fecha_evento)
    SELECT integracion_id, 'Sincronización registrada', CONCAT('Sincronización de ', nombre, ' registrada correctamente.'), 'Exitoso', ultima_sincronizacion
    FROM integraciones_sistema;
END

IF NOT EXISTS (SELECT 1 FROM alertas_sistema WHERE titulo = 'API de facturación con alerta')
BEGIN
    INSERT INTO alertas_sistema (modulo, titulo, mensaje, severidad, estado, href)
    VALUES
    ('Integraciones', 'API de facturación con alerta', 'La integración de facturación registra demora en la última sincronización.', 'Alta', 'Pendiente', 'integraciones.html'),
    ('Respaldo', 'Validación de respaldo pendiente', 'Existe un respaldo completado pendiente de validación.', 'Media', 'Pendiente', 'respaldo.html'),
    ('Usuarios', 'Revisión de accesos recomendada', 'Se recomienda revisar usuarios inactivos y permisos sensibles.', 'Media', 'Pendiente', 'usuarios.html');
END

IF NOT EXISTS (SELECT 1 FROM auditoria_admin WHERE accion = 'Carga inicial de usuarios')
BEGIN
    INSERT INTO auditoria_admin (modulo, tipo, accion, usuario_id, usuario_nombre, valor_anterior, valor_nuevo, resultado, critico, detalle)
    VALUES
    ('Usuarios', 'usuarios', 'Carga inicial de usuarios', (SELECT usuario_id FROM usuarios WHERE username='admin.sistema'), 'Administrador Sistema', '-', 'Usuarios semilla registrados', 'Exitoso', 1, 'Se cargaron usuarios iniciales del sistema.'),
    ('Catálogos', 'catalogos', 'Carga inicial de catálogos', (SELECT usuario_id FROM usuarios WHERE username='admin.sistema'), 'Administrador Sistema', '-', 'Catálogos operativos registrados', 'Exitoso', 0, 'Se cargaron catálogos de casos, estados, prioridades y canales.'),
    ('SLA', 'sla', 'Carga inicial de reglas SLA', (SELECT usuario_id FROM usuarios WHERE username='admin.sistema'), 'Administrador Sistema', '-', 'Reglas SLA iniciales', 'Exitoso', 1, 'Se registraron reglas SLA iniciales.'),
    ('Integraciones', 'integraciones', 'Carga inicial de integraciones', (SELECT usuario_id FROM usuarios WHERE username='admin.sistema'), 'Administrador Sistema', '-', 'Integraciones registradas', 'Exitoso', 1, 'Se registraron integraciones base del sistema.');
END

IF NOT EXISTS (SELECT 1 FROM respaldos_sistema WHERE tipo = 'Incremental' AND fecha_ejecucion >= DATEADD(DAY, -2, SYSDATETIME()))
BEGIN
    INSERT INTO respaldos_sistema (fecha_ejecucion, tipo, estado, tamano, ubicacion, validacion, responsable)
    VALUES
    (DATEADD(DAY, -1, SYSDATETIME()), 'Incremental', 'Completado', '3.2 GB', 'Repositorio local seguro', 'Verificado', 'Sistema'),
    (DATEADD(DAY, -2, SYSDATETIME()), 'Completo', 'Completado', '18.7 GB', 'Repositorio local seguro', 'Pendiente', 'Sistema'),
    (DATEADD(DAY, -3, SYSDATETIME()), 'Incremental', 'Completado', '3.0 GB', 'Repositorio local seguro', 'Verificado', 'Sistema');
END

IF NOT EXISTS (SELECT 1 FROM pruebas_restauracion WHERE titulo = 'Prueba de restauración mensual')
BEGIN
    INSERT INTO pruebas_restauracion (titulo, descripcion, estado, fecha_programada, creado_por_usuario_id)
    VALUES
    ('Prueba de restauración mensual', 'Validación de restauración en ambiente controlado.', 'Programado', DATEADD(DAY, 5, SYSDATETIME()), (SELECT usuario_id FROM usuarios WHERE username='admin.sistema'));
END

/* =========================================================
   16. REGLAS SLA ADMIN
========================================================= */
IF NOT EXISTS (SELECT 1 FROM reglas_sla_admin WHERE nombre = 'Reclamo baja prioridad')
BEGIN
    INSERT INTO reglas_sla_admin (nombre, tipo_caso, prioridad, canal, tiempo_sla, alerta, area, estado, descripcion, creado_por_usuario_id)
    VALUES
    ('Reclamo baja prioridad', 'Reclamo', 'Baja', 'Todos', '72 horas', '24 horas antes', 'Atención al Cliente', 'Activo', 'Regla general para reclamos de baja prioridad.', (SELECT usuario_id FROM usuarios WHERE username='admin.sistema')),
    ('Reclamo facturación alta', 'Reclamo', 'Alta', 'Portal web', '24 horas', '6 horas antes', 'Facturación', 'Activo', 'Regla para reclamos de facturación con prioridad alta.', (SELECT usuario_id FROM usuarios WHERE username='admin.sistema')),
    ('Incidencia técnica media', 'Incidencia', 'Media', 'Todos', '48 horas', '12 horas antes', 'Soporte Técnico', 'Activo', 'Regla para incidencias técnicas estándar.', (SELECT usuario_id FROM usuarios WHERE username='admin.sistema')),
    ('Incidencia crítica', 'Incidencia', 'Crítica', 'Todos', '8 horas', '2 horas antes', 'Soporte Técnico', 'Activo', 'Regla para fallas críticas.', (SELECT usuario_id FROM usuarios WHERE username='admin.sistema')),
    ('Ticket empresa cloud', 'Incidencia', 'Alta', 'Mesa empresarial', '12 horas', '3 horas antes', 'Empresas y Cloud', 'Activo', 'Regla para servicios empresariales cloud.', (SELECT usuario_id FROM usuarios WHERE username='admin.sistema'));
END

/* =========================================================
   17. PÁGINAS PÚBLICAS: INDEX, ESTADO SERVICIOS, AYUDA
========================================================= */
IF NOT EXISTS (SELECT 1 FROM public_quick_actions WHERE titulo = 'Registrar reclamo')
BEGIN
    INSERT INTO public_quick_actions (segmento, icono, titulo, descripcion, href, orden)
    VALUES
    ('personas', '📝', 'Registrar reclamo', 'Presenta un reclamo por cobro, atención, servicio o facturación.', 'login.html?role=cliente-persona&next=cliente/registrar-reclamo.html', 1),
    ('personas', '⚠️', 'Reportar incidencia', 'Informa fallas técnicas, lentitud o interrupciones.', 'login.html?role=cliente-persona&next=cliente/registrar-incidencia.html', 2),
    ('personas', '🔎', 'Consultar caso', 'Revisa el estado de un reclamo o incidencia.', 'consulta-rapida.html', 3),
    ('personas', '📶', 'Estado de servicios', 'Consulta disponibilidad, eventos e incidencias activas.', 'estado-servicios.html', 4),
    ('personas', '📘', 'Centro de ayuda', 'Encuentra guías y preguntas frecuentes.', 'centro-ayuda.html', 5),
    ('empresas', '🏢', 'Reportar ticket', 'Registra una incidencia empresarial con prioridad y SLA.', 'login.html?role=cliente-empresa&next=cliente/registrar-incidencia.html', 1),
    ('empresas', '☁️', 'Soporte cloud', 'Ayuda para servicios cloud, correo, colaboración y backup.', 'centro-ayuda.html', 2),
    ('empresas', '📡', 'Estado de servicios', 'Consulta conectividad, cloud y servicios empresariales.', 'estado-servicios.html', 3),
    ('empresas', '🔎', 'Consultar ticket', 'Revisa el avance de una incidencia empresarial.', 'consulta-rapida.html', 4),
    ('empresas', '📘', 'Mesa de ayuda', 'Encuentra artículos empresariales y soporte guiado.', 'centro-ayuda.html', 5);
END

IF NOT EXISTS (SELECT 1 FROM public_solutions WHERE titulo = 'Internet hogar')
BEGIN
    INSERT INTO public_solutions (segmento, etiqueta, titulo, descripcion, imagen_url, href, orden)
    VALUES
    ('personas', 'Hogar', 'Internet hogar', 'Consulta soporte, incidencias y disponibilidad.', 'https://images.unsplash.com/photo-1581090464777-f3220bbe1b8b?auto=format&fit=crop&w=900&q=80', 'estado-servicios.html', 1),
    ('personas', 'Móvil', 'Servicios móviles', 'Gestiona líneas, reclamos, cobertura y atención.', 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80', 'estado-servicios.html', 2),
    ('personas', 'Atención', 'Seguimiento 360', 'Visualiza el avance de tus casos registrados.', 'https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=900&q=80', 'consulta-rapida.html', 3),
    ('personas', 'Ayuda', 'Soporte guiado', 'Preguntas frecuentes y artículos de ayuda.', 'https://images.unsplash.com/photo-1553484771-371a605b060b?auto=format&fit=crop&w=900&q=80', 'centro-ayuda.html', 4),
    ('empresas', 'Conectividad', 'Fibra óptica empresarial', 'Atención para servicios empresariales críticos.', 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=80', 'estado-servicios.html', 1),
    ('empresas', 'Cloud', 'Cloud empresarial', 'Soporte para infraestructura, colaboración y productividad.', 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=900&q=80', 'centro-ayuda.html', 2),
    ('empresas', 'Seguridad', 'Ciberseguridad', 'Soporte, monitoreo y continuidad del negocio.', 'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=900&q=80', 'centro-ayuda.html', 3),
    ('empresas', 'Soporte', 'Atención empresarial 360', 'Tickets, SLA, seguimiento y reportes.', 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=900&q=80', 'consulta-rapida.html', 4);
END

IF NOT EXISTS (SELECT 1 FROM public_service_status WHERE nombre = 'Red móvil')
BEGIN
    INSERT INTO public_service_status (segmento, tipo_servicio, icono, nombre, descripcion, estado, salud, zona, zona_grupo, orden)
    VALUES
    ('personas', 'movil', '📱', 'Red móvil', 'Llamadas, datos móviles, SMS y cobertura nacional.', 'Operativo', 97, 'Nacional', 'todos', 1),
    ('personas', 'internet', '🏠', 'Internet hogar', 'Fibra óptica, internet fijo y servicios residenciales.', 'Operativo', 95, 'Lima Metropolitana', 'lima', 2),
    ('personas', 'tv', '📺', 'Claro TV+', 'Señal TV, decodificadores y paquetes premium.', 'Operativo', 96, 'Nacional', 'todos', 3),
    ('personas', 'app', '📲', 'App Mi Claro', 'Consultas, pagos, recibos y gestiones digitales.', 'Operativo', 99, 'Digital', 'todos', 4),
    ('empresas', 'fibra', '📡', 'Fibra empresarial', 'Conectividad dedicada y enlaces corporativos.', 'Operativo', 96, 'Nacional', 'todos', 1),
    ('empresas', 'cloud', '☁️', 'Cloud empresarial', 'Infraestructura, almacenamiento y servicios cloud.', 'Operativo', 98, 'Digital', 'todos', 2),
    ('empresas', 'correo', '📧', 'Correo empresas', 'Correo corporativo, colaboración y productividad.', 'Operativo', 96, 'Digital', 'todos', 3),
    ('empresas', 'seguridad', '🛡️', 'Seguridad empresas', 'Backup, monitoreo, protección y continuidad.', 'Operativo', 97, 'Digital', 'todos', 4);
END

IF NOT EXISTS (SELECT 1 FROM public_service_events WHERE codigo_evento = 'EVT-2026-001')
BEGIN
    INSERT INTO public_service_events (codigo_evento, segmento, servicio, zona, tipo, estado, descripcion, fecha_inicio, fecha_estimada, activo)
    VALUES
    ('EVT-2026-001', 'personas', 'Internet hogar', 'Lima Centro', 'incidencia', 'En atención', 'Intermitencia registrada en una zona específica de Lima Centro.', DATEADD(HOUR, -2, SYSDATETIME()), DATEADD(HOUR, 4, SYSDATETIME()), 1),
    ('EVT-2026-002', 'personas', 'Claro TV+', 'Provincias', 'mantenimiento', 'Programado', 'Mantenimiento programado de plataforma TV.', DATEADD(HOUR, 3, SYSDATETIME()), DATEADD(HOUR, 7, SYSDATETIME()), 1),
    ('EVT-2026-003', 'empresas', 'Correo empresas', 'Lima Este', 'incidencia', 'En atención', 'Intermitencia registrada en acceso a correo corporativo.', DATEADD(HOUR, -1, SYSDATETIME()), DATEADD(HOUR, 3, SYSDATETIME()), 1),
    ('EVT-2026-004', 'empresas', 'Cloud empresarial', 'Digital', 'mantenimiento', 'Programado', 'Mantenimiento preventivo de plataforma cloud.', DATEADD(HOUR, 5, SYSDATETIME()), DATEADD(HOUR, 8, SYSDATETIME()), 1);
END

IF NOT EXISTS (SELECT 1 FROM public_service_zones WHERE nombre = 'Lima Norte')
BEGIN
    INSERT INTO public_service_zones (segmento, nombre, estado, posicion_top, posicion_left)
    VALUES
    ('personas', 'Lima Norte', 'Operativo', 18, 18),
    ('personas', 'Lima Centro', 'En atención', 38, 48),
    ('personas', 'Lima Sur', 'Operativo', 64, 32),
    ('personas', 'Lima Este', 'Operativo', 48, 72),
    ('personas', 'Provincias', 'Programado', 75, 70),
    ('empresas', 'Lima Norte', 'Operativo', 18, 18),
    ('empresas', 'Lima Centro', 'Operativo', 38, 48),
    ('empresas', 'Lima Este', 'En atención', 48, 72),
    ('empresas', 'Digital', 'Operativo', 66, 55);
END

/* =========================================================
   18. CENTRO DE AYUDA
========================================================= */
IF NOT EXISTS (SELECT 1 FROM public_help_categories WHERE titulo = 'Móvil' AND segmento = 'personas')
BEGIN
    INSERT INTO public_help_categories (segmento, icono, titulo, descripcion, etiqueta, orden)
    VALUES
    ('personas', '📱', 'Móvil', 'Líneas, señal, datos, roaming y beneficios.', 'Personas', 1),
    ('personas', '🏠', 'Internet hogar', 'Velocidad, cortes, router, cobertura y soporte.', 'Hogar', 2),
    ('personas', '📺', 'Claro TV+', 'Canales, paquetes, decodificador y señal.', 'TV', 3),
    ('personas', '💳', 'Facturación', 'Recibos, pagos, cobros, cargos y reclamos.', 'Pagos', 4),
    ('empresas', '☁️', 'Cloud', 'Infraestructura, almacenamiento, correo y colaboración.', 'Empresa', 1),
    ('empresas', '📡', 'Conectividad', 'Fibra óptica, telefonía fija y red empresarial.', 'Red', 2),
    ('empresas', '🛡️', 'Ciberseguridad', 'Servicios de seguridad, respaldo y continuidad.', 'Seguridad', 3),
    ('empresas', '🎧', 'Mesa de ayuda', 'Tickets, escalamiento, SLA y soporte especializado.', 'Soporte', 4);
END

IF NOT EXISTS (SELECT 1 FROM public_help_articles WHERE titulo = 'Qué hacer si tu internet está lento')
BEGIN
    DECLARE @catInternet INT = (SELECT TOP 1 categoria_ayuda_id FROM public_help_categories WHERE segmento='personas' AND titulo='Internet hogar');
    DECLARE @catFacturacion INT = (SELECT TOP 1 categoria_ayuda_id FROM public_help_categories WHERE segmento='personas' AND titulo='Facturación');
    DECLARE @catMovil INT = (SELECT TOP 1 categoria_ayuda_id FROM public_help_categories WHERE segmento='personas' AND titulo='Móvil');
    DECLARE @catCloud INT = (SELECT TOP 1 categoria_ayuda_id FROM public_help_categories WHERE segmento='empresas' AND titulo='Cloud');
    DECLARE @catMesa INT = (SELECT TOP 1 categoria_ayuda_id FROM public_help_categories WHERE segmento='empresas' AND titulo='Mesa de ayuda');

    INSERT INTO public_help_articles (segmento, categoria_ayuda_id, icono, etiqueta, titulo, descripcion, orden)
    VALUES
    ('personas', @catInternet, '📶', 'Internet', 'Qué hacer si tu internet está lento', 'Revisa pasos básicos antes de reportar una incidencia.', 1),
    ('personas', @catFacturacion, '💳', 'Facturación', 'Cómo revisar un cobro no reconocido', 'Identifica el cargo, revisa tu recibo y registra un reclamo si corresponde.', 2),
    ('personas', @catInternet, '🎫', 'Seguimiento', 'Cómo consultar el estado de un caso', 'Usa el código CAS para revisar el avance público del caso.', 3),
    ('personas', @catMovil, '📱', 'Móvil', 'Qué hacer si no tienes datos móviles', 'Revisa configuración, cobertura y estado del servicio.', 4),
    ('empresas', @catCloud, '📧', 'Correo', 'Qué hacer si el correo empresa no funciona', 'Pasos para validar acceso, credenciales y servicio.', 1),
    ('empresas', @catCloud, '☁️', 'Cloud', 'Cómo reportar una incidencia cloud', 'Registra un ticket con datos técnicos y evidencias.', 2),
    ('empresas', @catMesa, '🎫', 'SLA', 'Cómo revisar un ticket empresarial', 'Consulta el avance del ticket y sus eventos principales.', 3);
END

IF NOT EXISTS (SELECT 1 FROM public_help_article_steps)
BEGIN
    INSERT INTO public_help_article_steps (articulo_id, paso, orden)
    SELECT articulo_id, 'Verifica si otros dispositivos presentan el mismo problema.', 1
    FROM public_help_articles WHERE titulo='Qué hacer si tu internet está lento';

    INSERT INTO public_help_article_steps (articulo_id, paso, orden)
    SELECT articulo_id, 'Reinicia el router y espera dos minutos.', 2
    FROM public_help_articles WHERE titulo='Qué hacer si tu internet está lento';

    INSERT INTO public_help_article_steps (articulo_id, paso, orden)
    SELECT articulo_id, 'Realiza una prueba de velocidad.', 3
    FROM public_help_articles WHERE titulo='Qué hacer si tu internet está lento';

    INSERT INTO public_help_article_steps (articulo_id, paso, orden)
    SELECT articulo_id, 'Si continúa el problema, registra una incidencia.', 4
    FROM public_help_articles WHERE titulo='Qué hacer si tu internet está lento';

    INSERT INTO public_help_article_steps (articulo_id, paso, orden)
    SELECT articulo_id, 'Identifica el cargo observado en tu recibo.', 1
    FROM public_help_articles WHERE titulo='Cómo revisar un cobro no reconocido';

    INSERT INTO public_help_article_steps (articulo_id, paso, orden)
    SELECT articulo_id, 'Adjunta recibo, captura o comprobante.', 2
    FROM public_help_articles WHERE titulo='Cómo revisar un cobro no reconocido';

    INSERT INTO public_help_article_steps (articulo_id, paso, orden)
    SELECT articulo_id, 'Registra el reclamo desde el portal.', 3
    FROM public_help_articles WHERE titulo='Cómo revisar un cobro no reconocido';

    INSERT INTO public_help_article_steps (articulo_id, paso, orden)
    SELECT articulo_id, 'Ingresa a Consulta rápida.', 1
    FROM public_help_articles WHERE titulo='Cómo consultar el estado de un caso';

    INSERT INTO public_help_article_steps (articulo_id, paso, orden)
    SELECT articulo_id, 'Coloca el código de caso.', 2
    FROM public_help_articles WHERE titulo='Cómo consultar el estado de un caso';

    INSERT INTO public_help_article_steps (articulo_id, paso, orden)
    SELECT articulo_id, 'Revisa estado, historial y SLA público.', 3
    FROM public_help_articles WHERE titulo='Cómo consultar el estado de un caso';

    INSERT INTO public_help_article_steps (articulo_id, paso, orden)
    SELECT articulo_id, 'Verifica si el problema afecta a uno o varios usuarios.', 1
    FROM public_help_articles WHERE titulo='Qué hacer si el correo empresa no funciona';

    INSERT INTO public_help_article_steps (articulo_id, paso, orden)
    SELECT articulo_id, 'Valida credenciales y conexión.', 2
    FROM public_help_articles WHERE titulo='Qué hacer si el correo empresa no funciona';

    INSERT INTO public_help_article_steps (articulo_id, paso, orden)
    SELECT articulo_id, 'Registra un ticket empresarial si continúa.', 3
    FROM public_help_articles WHERE titulo='Qué hacer si el correo empresa no funciona';
END

IF NOT EXISTS (SELECT 1 FROM public_help_faq WHERE pregunta = '¿Cómo registro un reclamo?')
BEGIN
    INSERT INTO public_help_faq (segmento, categoria, pregunta, respuesta, orden)
    VALUES
    ('personas', 'reclamos', '¿Cómo registro un reclamo?', 'Debes iniciar sesión, seleccionar el servicio afectado, indicar categoría, describir el problema y adjuntar evidencia si corresponde.', 1),
    ('personas', 'incidencias', '¿Cuál es la diferencia entre reclamo e incidencia?', 'Un reclamo expresa disconformidad por cobro, atención o servicio. Una incidencia reporta una falla técnica o evento que afecta el funcionamiento.', 2),
    ('personas', 'reclamos', '¿Qué significa Pendiente por cliente?', 'Significa que el asesor necesita información adicional para continuar la atención. Debes responder desde el portal o adjuntar la evidencia requerida.', 3),
    ('personas', 'facturacion', '¿Puedo reclamar un cobro no reconocido?', 'Sí. Debes adjuntar recibo, captura o detalle del cargo observado para que el asesor pueda revisar el caso.', 4),
    ('personas', 'incidencias', '¿Qué evidencia debo adjuntar?', 'Puedes adjuntar capturas, fotos del router, pruebas de velocidad, recibos o documentos relacionados.', 5),
    ('empresas', 'empresas', '¿Cómo registro un ticket empresarial?', 'Debes iniciar sesión como cliente empresa, seleccionar el servicio afectado, describir impacto, indicar prioridad y adjuntar evidencia técnica.', 1),
    ('empresas', 'empresas', '¿Los tickets empresariales tienen SLA?', 'Sí. El plazo depende de prioridad, categoría, servicio afectado y reglas configuradas para la atención empresarial.', 2),
    ('empresas', 'incidencias', '¿Qué evidencia debo adjuntar?', 'Capturas del error, usuarios impactados, hora del evento, servicio afectado y detalle técnico disponible.', 3);
END

/* =========================================================
   19. POBLACIÓN COMPLEMENTARIA (comunicaciones, derivaciones, etc.)
========================================================= */

-- Variables para complementos
DECLARE @admin_id INT = (SELECT TOP 1 usuario_id FROM usuarios WHERE username = 'admin.sistema');
DECLARE @supervisor_id INT = (SELECT TOP 1 usuario_id FROM usuarios WHERE username IN ('carolina.vargas', 'miguel.torres') ORDER BY usuario_id);
DECLARE @asesor_1 INT = (SELECT TOP 1 usuario_id FROM usuarios WHERE username IN ('valeria.mendoza', 'jose.quispe', 'luis.ramirez', 'diego.castillo') ORDER BY usuario_id);
DECLARE @asesor_2 INT = (SELECT TOP 1 usuario_id FROM usuarios WHERE username IN ('jose.quispe', 'luis.ramirez', 'diego.castillo') ORDER BY usuario_id);
DECLARE @area_soporte INT = (SELECT TOP 1 area_id FROM areas WHERE nombre IN ('Soporte Técnico', 'Soporte Tecnico'));
DECLARE @area_facturacion INT = (SELECT TOP 1 area_id FROM areas WHERE nombre = 'Facturación');
DECLARE @area_backoffice INT = (SELECT TOP 1 area_id FROM areas WHERE nombre IN ('Backoffice', 'Back Office'));
DECLARE @area_supervision INT = (SELECT TOP 1 area_id FROM areas WHERE nombre = 'Supervisión');

IF @admin_id IS NULL SET @admin_id = (SELECT TOP 1 usuario_id FROM usuarios ORDER BY usuario_id);
IF @supervisor_id IS NULL SET @supervisor_id = @admin_id;
IF @asesor_1 IS NULL SET @asesor_1 = @admin_id;
IF @asesor_2 IS NULL SET @asesor_2 = @asesor_1;

-- 19.1 PLANTILLAS ADICIONALES
IF NOT EXISTS (SELECT 1 FROM plantillas_respuesta WHERE nombre = N'Solicitud profesional de evidencia')
BEGIN
    INSERT INTO plantillas_respuesta (nombre, categoria, canal, descripcion, contenido, creado_por_usuario_id, activo, fecha_creacion)
    VALUES
    (N'Solicitud profesional de evidencia', N'evidencia', N'Portal cliente', N'Solicita documentos, capturas o información necesaria para continuar la atención.', N'Estimado(a) {cliente_nombre}, para continuar con la atención del caso {codigo_caso}, necesitamos que nos remita la evidencia relacionada al servicio {servicio_afectado}. Esta información nos permitirá validar correctamente el caso y continuar dentro del plazo SLA informado: {sla}. Quedamos atentos a su respuesta. Atentamente, {asesor_nombre}.', @asesor_1, 1, SYSDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM plantillas_respuesta WHERE nombre = N'Respuesta inicial de reclamo')
BEGIN
    INSERT INTO plantillas_respuesta (nombre, categoria, canal, descripcion, contenido, creado_por_usuario_id, activo, fecha_creacion)
    VALUES
    (N'Respuesta inicial de reclamo', N'reclamo', N'Portal cliente', N'Respuesta inicial para confirmar recepción y revisión del reclamo.', N'Estimado(a) {cliente_nombre}, hemos recibido su reclamo asociado al caso {codigo_caso}. Nuestro equipo revisará la información registrada sobre el servicio {servicio_afectado}, considerando el estado actual {estado_caso} y la prioridad {prioridad}. Le informaremos los avances por este canal. Atentamente, {asesor_nombre}.', @asesor_1, 1, SYSDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM plantillas_respuesta WHERE nombre = N'Derivación a área especializada')
BEGIN
    INSERT INTO plantillas_respuesta (nombre, categoria, canal, descripcion, contenido, creado_por_usuario_id, activo, fecha_creacion)
    VALUES
    (N'Derivación a área especializada', N'derivacion', N'Interno', N'Mensaje para registrar derivación interna de un caso.', N'Se deriva el caso {codigo_caso}, asociado al cliente {cliente_nombre}, para revisión especializada del servicio {servicio_afectado}. Estado actual: {estado_caso}. Prioridad: {prioridad}. Se solicita validar el sustento y responder dentro del plazo operativo correspondiente.', @asesor_1, 1, SYSDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM plantillas_respuesta WHERE nombre = N'Cierre formal de caso')
BEGIN
    INSERT INTO plantillas_respuesta (nombre, categoria, canal, descripcion, contenido, creado_por_usuario_id, activo, fecha_creacion)
    VALUES
    (N'Cierre formal de caso', N'cierre', N'Portal cliente', N'Plantilla para comunicar cierre de caso con respuesta final.', N'Estimado(a) {cliente_nombre}, le informamos que el caso {codigo_caso} ha sido atendido. Luego de la revisión del servicio {servicio_afectado}, se registró la respuesta final correspondiente. Si presenta una nueva observación, puede registrar un nuevo caso desde la plataforma. Atentamente, {asesor_nombre}.', @asesor_2, 1, SYSDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM plantillas_respuesta WHERE nombre = N'Seguimiento preventivo SLA')
BEGIN
    INSERT INTO plantillas_respuesta (nombre, categoria, canal, descripcion, contenido, creado_por_usuario_id, activo, fecha_creacion)
    VALUES
    (N'Seguimiento preventivo SLA', N'seguimiento', N'Portal cliente', N'Plantilla para seguimiento preventivo antes de vencimiento SLA.', N'Estimado(a) {cliente_nombre}, estamos realizando seguimiento preventivo al caso {codigo_caso}. Actualmente se encuentra en estado {estado_caso} y mantiene el siguiente control SLA: {sla}. Le informaremos cualquier actualización por este canal. Atentamente, {asesor_nombre}.', @asesor_2, 1, SYSDATETIME());
END

-- 19.2 COMUNICACIONES DE CASO
IF NOT EXISTS (SELECT 1 FROM comunicaciones_caso)
BEGIN
    INSERT INTO comunicaciones_caso (caso_id, usuario_id, plantilla_id, tipo, canal, asunto, mensaje, destinatario, estado, fecha_envio)
    SELECT TOP 30
        c.caso_id,
        COALESCE(c.responsable_actual_usuario_id, @asesor_1),
        (SELECT TOP 1 plantilla_id FROM plantillas_respuesta WHERE activo = 1 ORDER BY plantilla_id),
        N'CASO', N'Portal cliente', CONCAT(N'Comunicación del caso ', c.codigo_caso),
        CONCAT(N'Se registra comunicación operativa para el caso ', c.codigo_caso, N'. Estado actual: ', ec.nombre, N'.'),
        COALESCE(cli.correo, N'cliente@correo.com'), N'ENVIADO', DATEADD(HOUR, 1, c.fecha_registro)
    FROM casos c
    INNER JOIN estados_caso ec ON ec.estado_caso_id = c.estado_caso_id
    INNER JOIN clientes cli ON cli.cliente_id = c.cliente_id
    WHERE NOT EXISTS (SELECT 1 FROM comunicaciones_caso cc WHERE cc.caso_id = c.caso_id)
    ORDER BY c.caso_id;
END

-- 19.3 SOLICITUDES DE INFORMACIÓN
IF NOT EXISTS (SELECT 1 FROM solicitudes_informacion)
BEGIN
    INSERT INTO solicitudes_informacion (caso_id, solicitada_por_usuario_id, canal, asunto, mensaje, plazo, fecha_limite, estado, fecha_solicitud)
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
      AND NOT EXISTS (SELECT 1 FROM solicitudes_informacion si WHERE si.caso_id = c.caso_id);
END

-- 19.4 DERIVACIONES DE CASO
IF NOT EXISTS (SELECT 1 FROM derivaciones_caso)
BEGIN
    INSERT INTO derivaciones_caso (caso_id, derivado_por_usuario_id, area_destino_id, area_destino, prioridad, motivo, estado, respuesta_area, fecha_respuesta, fecha_derivacion)
    SELECT
        c.caso_id,
        COALESCE(c.responsable_actual_usuario_id, @asesor_1),
        CASE WHEN cat.nombre = N'Facturación' THEN @area_facturacion WHEN cat.nombre LIKE N'%Internet%' THEN @area_soporte ELSE @area_backoffice END,
        CASE WHEN cat.nombre = N'Facturación' THEN N'Facturación' WHEN cat.nombre LIKE N'%Internet%' THEN N'Soporte Técnico' ELSE N'Backoffice' END,
        pr.nombre,
        CONCAT(N'Derivación generada por categoría ', cat.nombre, N' y prioridad ', pr.nombre, N'.'),
        N'Pendiente', NULL, NULL, DATEADD(HOUR, 5, c.fecha_registro)
    FROM casos c
    INNER JOIN estados_caso ec ON ec.estado_caso_id = c.estado_caso_id
    INNER JOIN categorias cat ON cat.categoria_id = c.categoria_id
    INNER JOIN prioridades pr ON pr.prioridad_id = c.prioridad_id
    WHERE ec.nombre IN (N'Derivado', N'Escalado')
      AND NOT EXISTS (SELECT 1 FROM derivaciones_caso dc WHERE dc.caso_id = c.caso_id);
END

-- 19.5 SEGUIMIENTOS SLA
IF NOT EXISTS (SELECT 1 FROM seguimientos_sla)
BEGIN
    INSERT INTO seguimientos_sla (caso_id, usuario_id, tipo, canal, mensaje, plazo, es_visible_cliente, fecha_registro)
    SELECT TOP 40
        c.caso_id,
        COALESCE(c.responsable_actual_usuario_id, @asesor_1),
        CASE WHEN c.fecha_limite_resolucion < SYSDATETIME() THEN N'Vencido' WHEN c.fecha_limite_resolucion <= DATEADD(HOUR, 8, SYSDATETIME()) THEN N'Riesgo' ELSE N'Preventivo' END,
        N'SISTEMA',
        CONCAT(N'Seguimiento SLA del caso ', c.codigo_caso, N'. Fecha límite: ', CONVERT(NVARCHAR(30), c.fecha_limite_resolucion, 120), N'.'),
        CASE WHEN c.fecha_limite_resolucion < SYSDATETIME() THEN N'Inmediato' WHEN c.fecha_limite_resolucion <= DATEADD(HOUR, 8, SYSDATETIME()) THEN N'Menos de 8 horas' ELSE N'Controlado' END,
        0,
        DATEADD(MINUTE, 30, COALESCE(c.fecha_actualizacion, c.fecha_registro))
    FROM casos c
    WHERE c.fecha_cierre IS NULL AND c.fecha_limite_resolucion <= DATEADD(HOUR, 24, SYSDATETIME())
      AND NOT EXISTS (SELECT 1 FROM seguimientos_sla ss WHERE ss.caso_id = c.caso_id)
    ORDER BY c.fecha_limite_resolucion ASC;
END

-- 19.6 CONSTANCIAS DE CASO
IF NOT EXISTS (SELECT 1 FROM constancias_caso)
BEGIN
    INSERT INTO constancias_caso (caso_id, generado_por_usuario_id, codigo_constancia, formato, archivo_nombre, archivo_ruta, mime_type, tamano_bytes, fecha_generacion)
    SELECT
        c.caso_id,
        COALESCE(c.responsable_actual_usuario_id, @asesor_1),
        CONCAT(N'CONST-', c.codigo_caso),
        N'PDF',
        CONCAT(N'constancia-', c.codigo_caso, N'.pdf'),
        CONCAT(N'/exports/constancias/constancia-', c.codigo_caso, N'.pdf'),
        N'application/pdf', 185000, COALESCE(c.fecha_cierre, SYSDATETIME())
    FROM casos c
    WHERE c.fecha_cierre IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM constancias_caso cc WHERE cc.caso_id = c.caso_id);
END

-- 19.7 EXPORTACIONES DE REPORTES
IF NOT EXISTS (SELECT 1 FROM exportaciones_reporte)
BEGIN
    INSERT INTO exportaciones_reporte (reporte_id, generado_por_usuario_id, modulo, nombre, formato, estado, archivo_nombre, archivo_ruta, mime_type, tamano_bytes, fecha_generacion, fecha_expiracion)
    SELECT
        r.reporte_id,
        COALESCE(r.generado_por_usuario_id, @admin_id),
        CASE WHEN r.tipo LIKE N'%SLA%' THEN N'supervisor' WHEN r.tipo LIKE N'%Rendimiento%' THEN N'asesor' ELSE N'admin' END,
        r.nombre, r.formato, N'GENERADO',
        CONCAT(REPLACE(LOWER(r.nombre), N' ', N'_'), N'.', CASE WHEN LOWER(r.formato) = N'pdf' THEN N'pdf' WHEN LOWER(r.formato) = N'excel' THEN N'xls' WHEN LOWER(r.formato) = N'csv' THEN N'csv' WHEN LOWER(r.formato) = N'word' THEN N'doc' ELSE N'pdf' END),
        CONCAT(N'/exports/reportes/', REPLACE(LOWER(r.nombre), N' ', N'_')),
        CASE WHEN LOWER(r.formato) = N'pdf' THEN N'application/pdf' WHEN LOWER(r.formato) = N'excel' THEN N'application/vnd.ms-excel' WHEN LOWER(r.formato) = N'csv' THEN N'text/csv' WHEN LOWER(r.formato) = N'word' THEN N'application/msword' ELSE N'application/octet-stream' END,
        220000, r.fecha_generacion, DATEADD(DAY, 30, r.fecha_generacion)
    FROM reportes r
    WHERE NOT EXISTS (SELECT 1 FROM exportaciones_reporte er WHERE er.reporte_id = r.reporte_id);
END

-- 19.8 DASHBOARDS COMPARTIDOS
IF NOT EXISTS (SELECT 1 FROM dashboard_compartidos WHERE nombre = N'Dashboard supervisor SLA')
BEGIN
    INSERT INTO dashboard_compartidos (nombre, descripcion, modulo, token, url_publica, filtros_json, creado_por_usuario_id, activo, fecha_creacion, fecha_expiracion)
    VALUES
    (N'Dashboard supervisor SLA', N'Vista compartible de control SLA y carga operativa.', N'supervisor', CONVERT(NVARCHAR(100), NEWID()), N'/shared/dashboard/supervisor-sla', N'{"periodo":"semana","alcance":"sla","prioridad":"todas"}', @supervisor_id, 1, SYSDATETIME(), DATEADD(DAY, 30, SYSDATETIME()));
END

IF NOT EXISTS (SELECT 1 FROM dashboard_compartidos WHERE nombre = N'Dashboard asesor rendimiento')
BEGIN
    INSERT INTO dashboard_compartidos (nombre, descripcion, modulo, token, url_publica, filtros_json, creado_por_usuario_id, activo, fecha_creacion, fecha_expiracion)
    VALUES
    (N'Dashboard asesor rendimiento', N'Vista compartible de productividad, SLA y casos atendidos.', N'asesor', CONVERT(NVARCHAR(100), NEWID()), N'/shared/dashboard/asesor-rendimiento', N'{"periodo":"semana","indicadores":["casos","sla","cierres"]}', @asesor_1, 1, SYSDATETIME(), DATEADD(DAY, 15, SYSDATETIME()));
END

-- 19.9 AUDITORÍA OPERATIVA
IF NOT EXISTS (SELECT 1 FROM auditoria_operativa)
BEGIN
    INSERT INTO auditoria_operativa (usuario_id, modulo, entidad, entidad_id, accion, detalle, ip_origen, user_agent, fecha_evento)
    SELECT TOP 40
        COALESCE(hc.usuario_id, c.responsable_actual_usuario_id, @admin_id),
        N'casos', N'caso', c.caso_id, hc.accion, hc.observacion, N'127.0.0.1', N'Sistema académico', hc.fecha_evento
    FROM historial_caso hc
    INNER JOIN casos c ON c.caso_id = hc.caso_id
    WHERE NOT EXISTS (SELECT 1 FROM auditoria_operativa ao WHERE ao.entidad = N'caso' AND ao.entidad_id = c.caso_id AND ao.accion = hc.accion AND ao.fecha_evento = hc.fecha_evento)
    ORDER BY hc.fecha_evento DESC;
END

-- 19.10 CATÁLOGOS UI
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
END

IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'visibilidad')
BEGIN
    INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
    VALUES
    (N'visibilidad', N'visible_cliente', N'Visible para cliente', N'El evento será visible para el cliente.', 1, 1),
    (N'visibilidad', N'interno', N'Interno', N'Solo visible para personal interno.', 2, 1);
END

IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'plazo_respuesta')
BEGIN
    INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
    VALUES
    (N'plazo_respuesta', N'24h', N'24 horas', N'Plazo de respuesta de 24 horas.', 1, 1),
    (N'plazo_respuesta', N'48h', N'48 horas', N'Plazo de respuesta de 48 horas.', 2, 1),
    (N'plazo_respuesta', N'72h', N'72 horas', N'Plazo de respuesta de 72 horas.', 3, 1),
    (N'plazo_respuesta', N'5d', N'5 días hábiles', N'Plazo de respuesta de 5 días hábiles.', 4, 1);
END

IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'categoria_plantilla')
BEGIN
    INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
    VALUES
    (N'categoria_plantilla', N'evidencia', N'Evidencia', N'Plantillas para solicitud de evidencias.', 1, 1),
    (N'categoria_plantilla', N'reclamo', N'Reclamo', N'Plantillas para respuesta de reclamos.', 2, 1),
    (N'categoria_plantilla', N'derivacion', N'Derivación', N'Plantillas para derivaciones internas.', 3, 1),
    (N'categoria_plantilla', N'cierre', N'Cierre', N'Plantillas para cierre de casos.', 4, 1),
    (N'categoria_plantilla', N'seguimiento', N'Seguimiento', N'Plantillas para seguimiento preventivo.', 5, 1);
END

-- 19.11 NOTIFICACIONES SLA PARA ASESOR
IF NOT EXISTS (SELECT 1 FROM notificaciones WHERE tipo = N'SLA' AND usuario_id IN (SELECT usuario_id FROM @Asesores))
BEGIN
    INSERT INTO notificaciones (caso_id, usuario_id, tipo, canal_envio, titulo, mensaje, leida, estado_envio, fecha_generacion)
    SELECT TOP 20
        c.caso_id, COALESCE(c.responsable_actual_usuario_id, @asesor_1), N'SLA', N'SISTEMA',
        N'Alerta masiva SLA',
        CONCAT(N'El caso ', c.codigo_caso, N' requiere seguimiento SLA. Fecha límite: ', CONVERT(NVARCHAR(30), c.fecha_limite_resolucion, 120), N'.'),
        0, N'ENVIADO', SYSDATETIME()
    FROM casos c
    WHERE c.fecha_cierre IS NULL AND c.fecha_limite_resolucion <= DATEADD(HOUR, 24, SYSDATETIME())
      AND NOT EXISTS (SELECT 1 FROM notificaciones n WHERE n.caso_id = c.caso_id AND n.usuario_id = COALESCE(c.responsable_actual_usuario_id, @asesor_1) AND n.tipo = N'SLA')
    ORDER BY c.fecha_limite_resolucion ASC;
END

-- 19.12 REPORTES ADICIONALES CON TODOS LOS FORMATOS
IF NOT EXISTS (SELECT 1 FROM reportes WHERE nombre = N'Exportación bandeja asesor PDF')
BEGIN
    INSERT INTO reportes (nombre, tipo, periodo, alcance, formato, comentario, generado_por_usuario_id, estado, fecha_generacion)
    VALUES
    (N'Exportación bandeja asesor PDF', N'Bandeja asesor', N'Semana actual', N'Asesor', N'PDF', N'Reporte PDF de bandeja de casos.', @asesor_1, N'Generado', SYSDATETIME()),
    (N'Exportación bandeja asesor Word', N'Bandeja asesor', N'Semana actual', N'Asesor', N'Word', N'Reporte Word editable de bandeja de casos.', @asesor_1, N'Generado', SYSDATETIME()),
    (N'Exportación bandeja asesor Excel', N'Bandeja asesor', N'Semana actual', N'Asesor', N'Excel', N'Reporte Excel de bandeja de casos.', @asesor_1, N'Generado', SYSDATETIME()),
    (N'Exportación bandeja asesor CSV', N'Bandeja asesor', N'Semana actual', N'Asesor', N'CSV', N'Reporte CSV de bandeja de casos.', @asesor_1, N'Generado', SYSDATETIME()),
    (N'Exportación bandeja asesor Imagen', N'Bandeja asesor', N'Semana actual', N'Asesor', N'Imagen', N'Reporte visual SVG de bandeja de casos.', @asesor_1, N'Generado', SYSDATETIME()),
    (N'Dashboard compartible asesor', N'Dashboard compartible', N'Semana actual', N'Asesor', N'Dashboard', N'Enlace compartible temporal para indicadores del asesor.', @asesor_1, N'Generado', SYSDATETIME());
END

/* =========================================================
   20. POBLACIÓN ADMIN COMPLEMENTARIA (catálogos UI faltantes, normalización, etc.)
========================================================= */

-- 20.1 CATÁLOGOS UI FALTANTES (formatos_exportacion, ambientes, criticidades, frecuencias, metodos_autenticacion, tipos_acceso_usuario)
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
END

IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'ambientes' AND codigo = N'PROD')
BEGIN
    INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
    VALUES
    (N'ambientes', N'PROD', N'Producción', N'Ambiente productivo.', 1, 1),
    (N'ambientes', N'PRE', N'Preproducción', N'Ambiente previo a producción.', 2, 1),
    (N'ambientes', N'QA', N'QA', N'Ambiente de pruebas.', 3, 1),
    (N'ambientes', N'DEV', N'Desarrollo', N'Ambiente de desarrollo.', 4, 1);
END

IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'criticidades' AND codigo = N'CRITICA')
BEGIN
    INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
    VALUES
    (N'criticidades', N'CRITICA', N'Crítica', N'Impacto crítico en operación.', 1, 1),
    (N'criticidades', N'ALTA', N'Alta', N'Impacto alto.', 2, 1),
    (N'criticidades', N'MEDIA', N'Media', N'Impacto medio.', 3, 1),
    (N'criticidades', N'BAJA', N'Baja', N'Impacto bajo.', 4, 1);
END

IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'frecuencias' AND codigo = N'DIARIO')
BEGIN
    INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
    VALUES
    (N'frecuencias', N'DIARIO', N'Diario', N'Ejecución diaria.', 1, 1),
    (N'frecuencias', N'SEMANAL', N'Semanal', N'Ejecución semanal.', 2, 1),
    (N'frecuencias', N'MENSUAL', N'Mensual', N'Ejecución mensual.', 3, 1),
    (N'frecuencias', N'BAJO_DEMANDA', N'Bajo demanda', N'Ejecución manual.', 4, 1);
END

IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'metodos_autenticacion' AND codigo = N'API_KEY')
BEGIN
    INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
    VALUES
    (N'metodos_autenticacion', N'API_KEY', N'API Key', N'Autenticación por llave API.', 1, 1),
    (N'metodos_autenticacion', N'BEARER', N'Bearer Token', N'Autenticación por token.', 2, 1),
    (N'metodos_autenticacion', N'OAUTH2', N'OAuth 2.0', N'Autenticación OAuth 2.0.', 3, 1),
    (N'metodos_autenticacion', N'BASIC', N'Basic Auth', N'Usuario y contraseña.', 4, 1),
    (N'metodos_autenticacion', N'CERT', N'Certificado', N'Autenticación por certificado.', 5, 1);
END

IF NOT EXISTS (SELECT 1 FROM catalogos_ui WHERE grupo = N'tipos_acceso_usuario' AND codigo = N'ADMIN')
BEGIN
    INSERT INTO catalogos_ui (grupo, codigo, etiqueta, descripcion, orden, activo)
    VALUES
    (N'tipos_acceso_usuario', N'ESTANDAR', N'Acceso estándar', N'Acceso base del sistema.', 1, 1),
    (N'tipos_acceso_usuario', N'OPERATIVO', N'Acceso operativo', N'Acceso para asesores.', 2, 1),
    (N'tipos_acceso_usuario', N'SUPERVISOR', N'Acceso supervisor', N'Acceso de supervisión.', 3, 1),
    (N'tipos_acceso_usuario', N'ADMIN', N'Acceso administrativo', N'Acceso crítico de administración.', 4, 1);
END

-- 20.2 NORMALIZAR ENDPOINTS DE INTEGRACIONES
UPDATE integraciones_sistema
SET endpoint = N'https://smtp.claro360.local/api/status'
WHERE nombre = N'Correo transaccional' AND endpoint NOT LIKE N'http%';

UPDATE integraciones_sistema
SET endpoint = N'https://auth.claro360.local/api/health'
WHERE nombre = N'Autenticación de usuarios' AND endpoint NOT LIKE N'http%';

UPDATE integraciones_sistema
SET endpoint = N'https://billing.claro360.local/api/status'
WHERE nombre = N'API de facturación' AND endpoint NOT LIKE N'http%';

UPDATE integraciones_sistema
SET endpoint = N'https://technical.claro360.local/api/status'
WHERE nombre = N'API de servicios técnicos' AND endpoint NOT LIKE N'http%';

UPDATE integraciones_sistema
SET endpoint = N'https://webhooks.claro360.local/api/events'
WHERE nombre = N'Webhooks de notificación' AND endpoint NOT LIKE N'http%';

-- 20.3 COMPLETAR CAMPOS NUEVOS DE INTEGRACIONES
IF COL_LENGTH('dbo.integraciones_sistema', 'ambiente') IS NOT NULL
    UPDATE integraciones_sistema SET ambiente = ISNULL(ambiente, N'Producción') WHERE ambiente IS NULL;

IF COL_LENGTH('dbo.integraciones_sistema', 'metodo_autenticacion') IS NOT NULL
    UPDATE integraciones_sistema SET metodo_autenticacion = ISNULL(metodo_autenticacion, N'API Key') WHERE metodo_autenticacion IS NULL;

IF COL_LENGTH('dbo.integraciones_sistema', 'timeout_segundos') IS NOT NULL
    UPDATE integraciones_sistema SET timeout_segundos = ISNULL(timeout_segundos, 30) WHERE timeout_segundos IS NULL;

IF COL_LENGTH('dbo.integraciones_sistema', 'politica_reintentos') IS NOT NULL
    UPDATE integraciones_sistema SET politica_reintentos = ISNULL(politica_reintentos, N'3 reintentos') WHERE politica_reintentos IS NULL;

IF COL_LENGTH('dbo.integraciones_sistema', 'metodo_http') IS NOT NULL
    UPDATE integraciones_sistema SET metodo_http = ISNULL(metodo_http, N'GET') WHERE metodo_http IS NULL;

IF COL_LENGTH('dbo.integraciones_sistema', 'codigo_http') IS NOT NULL
    UPDATE integraciones_sistema SET codigo_http = CASE WHEN estado = N'Con alerta' THEN 202 WHEN estado = N'Error' THEN 500 ELSE 200 END WHERE codigo_http IS NULL;

IF COL_LENGTH('dbo.integraciones_sistema', 'latencia_ms') IS NOT NULL
    UPDATE integraciones_sistema SET latencia_ms = CASE WHEN estado = N'Con alerta' THEN 780 WHEN estado = N'Error' THEN 1200 ELSE 180 END WHERE latencia_ms IS NULL;

IF COL_LENGTH('dbo.integraciones_sistema', 'ultima_prueba') IS NOT NULL
    UPDATE integraciones_sistema SET ultima_prueba = ISNULL(ultima_prueba, DATEADD(MINUTE, -30, SYSDATETIME())) WHERE ultima_prueba IS NULL;

IF COL_LENGTH('dbo.integraciones_sistema', 'resultado_ultima_prueba') IS NOT NULL
    UPDATE integraciones_sistema SET resultado_ultima_prueba = CASE WHEN estado = N'Con alerta' THEN N'Con alerta' WHEN estado = N'Error' THEN N'Fallido' ELSE N'Exitoso' END WHERE resultado_ultima_prueba IS NULL;

IF COL_LENGTH('dbo.integraciones_sistema', 'credencial_alias') IS NOT NULL
    UPDATE integraciones_sistema SET credencial_alias = ISNULL(credencial_alias, N'Credencial protegida') WHERE credencial_alias IS NULL;

-- 20.4 NUEVAS INTEGRACIONES ADMIN REALISTAS
IF NOT EXISTS (SELECT 1 FROM integraciones_sistema WHERE nombre = N'Pasarela SMS')
BEGIN
    INSERT INTO integraciones_sistema (nombre, tipo, estado, criticidad, endpoint, descripcion, responsable, ultima_sincronizacion, creado_por_usuario_id, fecha_creacion, fecha_actualizacion)
    VALUES
    (N'Pasarela SMS', N'SMS', N'Activa', N'Media', N'https://sms.claro360.local/api/status', N'Envío de mensajes SMS para alertas de caso y verificación.', N'Administración', DATEADD(MINUTE, -18, SYSDATETIME()), @admin_id, SYSDATETIME(), SYSDATETIME());
END

IF NOT EXISTS (SELECT 1 FROM integraciones_sistema WHERE nombre = N'Motor de SLA')
BEGIN
    INSERT INTO integraciones_sistema (nombre, tipo, estado, criticidad, endpoint, descripcion, responsable, ultima_sincronizacion, creado_por_usuario_id, fecha_creacion, fecha_actualizacion)
    VALUES
    (N'Motor de SLA', N'Servicio interno', N'Activa', N'Alta', N'https://sla.claro360.local/api/health', N'Servicio interno para cálculo de vencimientos, alertas y escalamiento SLA.', N'Supervisión', DATEADD(MINUTE, -8, SYSDATETIME()), @admin_id, SYSDATETIME(), SYSDATETIME());
END

-- 20.5 EVENTOS DE INTEGRACIÓN MÁS COMPLETOS
INSERT INTO eventos_integracion (integracion_id, titulo, descripcion, estado, fecha_evento)
SELECT i.integracion_id, N'Prueba automática registrada', CONCAT(N'Prueba de salud ejecutada para ', i.nombre, N'. Estado actual: ', i.estado, N'.'), CASE WHEN i.estado = N'Activa' THEN N'Exitoso' WHEN i.estado = N'Con alerta' THEN N'Con alerta' ELSE N'Fallido' END, DATEADD(MINUTE, -10, SYSDATETIME())
FROM integraciones_sistema i
WHERE NOT EXISTS (SELECT 1 FROM eventos_integracion e WHERE e.integracion_id = i.integracion_id AND e.titulo = N'Prueba automática registrada');

-- 20.6 COMPLETAR CAMPOS NUEVOS DE REGLAS SLA
IF COL_LENGTH('dbo.reglas_sla_admin', 'categoria') IS NOT NULL
    UPDATE reglas_sla_admin SET categoria = CASE WHEN tipo_caso LIKE N'%Incidencia%' THEN N'Técnico' WHEN tipo_caso LIKE N'%Reclamo%' THEN N'Reclamo' ELSE N'General' END WHERE categoria IS NULL;

IF COL_LENGTH('dbo.reglas_sla_admin', 'tiempo_sla_minutos') IS NOT NULL
    UPDATE reglas_sla_admin SET tiempo_sla_minutos = CASE WHEN tiempo_sla LIKE N'%72%' THEN 4320 WHEN tiempo_sla LIKE N'%48%' THEN 2880 WHEN tiempo_sla LIKE N'%24%' THEN 1440 WHEN tiempo_sla LIKE N'%12%' THEN 720 WHEN tiempo_sla LIKE N'%8%' THEN 480 ELSE 1440 END WHERE tiempo_sla_minutos IS NULL;

IF COL_LENGTH('dbo.reglas_sla_admin', 'alerta_minutos') IS NOT NULL
    UPDATE reglas_sla_admin SET alerta_minutos = CASE WHEN alerta LIKE N'%24%' THEN 1440 WHEN alerta LIKE N'%12%' THEN 720 WHEN alerta LIKE N'%6%' THEN 360 WHEN alerta LIKE N'%3%' THEN 180 WHEN alerta LIKE N'%2%' THEN 120 ELSE 60 END WHERE alerta_minutos IS NULL;

IF COL_LENGTH('dbo.reglas_sla_admin', 'vigencia_inicio') IS NOT NULL
    UPDATE reglas_sla_admin SET vigencia_inicio = CAST(SYSDATETIME() AS DATE) WHERE vigencia_inicio IS NULL;

IF COL_LENGTH('dbo.reglas_sla_admin', 'vigencia_fin') IS NOT NULL
    UPDATE reglas_sla_admin SET vigencia_fin = DATEADD(YEAR, 1, CAST(SYSDATETIME() AS DATE)) WHERE vigencia_fin IS NULL;

IF COL_LENGTH('dbo.reglas_sla_admin', 'area_escalamiento') IS NOT NULL
    UPDATE reglas_sla_admin SET area_escalamiento = CASE WHEN prioridad IN (N'Crítica', N'Alta') THEN N'Supervisión' ELSE area END WHERE area_escalamiento IS NULL;

IF COL_LENGTH('dbo.reglas_sla_admin', 'nivel_escalamiento') IS NOT NULL
    UPDATE reglas_sla_admin SET nivel_escalamiento = CASE WHEN prioridad = N'Crítica' THEN N'Jefatura' WHEN prioridad = N'Alta' THEN N'Supervisor' ELSE N'Operativo' END WHERE nivel_escalamiento IS NULL;

IF COL_LENGTH('dbo.reglas_sla_admin', 'validacion_estado') IS NOT NULL
    UPDATE reglas_sla_admin SET validacion_estado = N'Correcta' WHERE validacion_estado IS NULL;

IF COL_LENGTH('dbo.reglas_sla_admin', 'validacion_mensaje') IS NOT NULL
    UPDATE reglas_sla_admin SET validacion_mensaje = N'Regla válida.' WHERE validacion_mensaje IS NULL;

-- 20.7 RESPALDOS: COMPLETAR CAMPOS PROFESIONALES
IF COL_LENGTH('dbo.respaldos_sistema', 'frecuencia') IS NOT NULL
    UPDATE respaldos_sistema SET frecuencia = ISNULL(frecuencia, N'Diario') WHERE frecuencia IS NULL;

IF COL_LENGTH('dbo.respaldos_sistema', 'ventana_ejecucion') IS NOT NULL
    UPDATE respaldos_sistema SET ventana_ejecucion = ISNULL(ventana_ejecucion, N'02:00 - 04:00') WHERE ventana_ejecucion IS NULL;

IF COL_LENGTH('dbo.respaldos_sistema', 'retencion') IS NOT NULL
    UPDATE respaldos_sistema SET retencion = ISNULL(retencion, N'30 días') WHERE retencion IS NULL;

IF COL_LENGTH('dbo.respaldos_sistema', 'destino') IS NOT NULL
    UPDATE respaldos_sistema SET destino = ISNULL(destino, ubicacion) WHERE destino IS NULL;

IF COL_LENGTH('dbo.respaldos_sistema', 'rpo') IS NOT NULL
    UPDATE respaldos_sistema SET rpo = ISNULL(rpo, N'24 horas') WHERE rpo IS NULL;

IF COL_LENGTH('dbo.respaldos_sistema', 'rto') IS NOT NULL
    UPDATE respaldos_sistema SET rto = ISNULL(rto, N'4 horas') WHERE rto IS NULL;

IF COL_LENGTH('dbo.respaldos_sistema', 'hash_integridad') IS NOT NULL
    UPDATE respaldos_sistema SET hash_integridad = ISNULL(hash_integridad, CONVERT(NVARCHAR(100), NEWID())) WHERE hash_integridad IS NULL;

IF COL_LENGTH('dbo.respaldos_sistema', 'duracion_segundos') IS NOT NULL
    UPDATE respaldos_sistema SET duracion_segundos = ISNULL(duracion_segundos, 420) WHERE duracion_segundos IS NULL;

IF COL_LENGTH('dbo.respaldos_sistema', 'log_resumen') IS NOT NULL
    UPDATE respaldos_sistema SET log_resumen = ISNULL(log_resumen, N'Respaldo registrado y disponible para validación.') WHERE log_resumen IS NULL;

IF COL_LENGTH('dbo.respaldos_sistema', 'fecha_validacion') IS NOT NULL
    UPDATE respaldos_sistema SET fecha_validacion = CASE WHEN validacion IN (N'Verificado', N'Validado') THEN DATEADD(HOUR, 1, fecha_ejecucion) ELSE NULL END WHERE fecha_validacion IS NULL;

-- 20.8 REPORTES ADMIN CON FORMATOS COMPLETOS
IF NOT EXISTS (SELECT 1 FROM reportes WHERE nombre = N'Reporte administrador PDF')
BEGIN
    INSERT INTO reportes (nombre, tipo, periodo, alcance, formato, comentario, generado_por_usuario_id, estado, fecha_generacion)
    VALUES
    (N'Reporte administrador PDF', N'Resumen ejecutivo', N'Semana actual', N'Administrador', N'PDF', N'Reporte ejecutivo para administración.', @admin_id, N'Generado', SYSDATETIME()),
    (N'Reporte administrador Word', N'Resumen ejecutivo', N'Semana actual', N'Administrador', N'Word', N'Reporte editable para revisión interna.', @admin_id, N'Generado', SYSDATETIME()),
    (N'Reporte administrador Excel', N'Indicadores', N'Mes actual', N'Administrador', N'Excel', N'Dataset de indicadores administrativos.', @admin_id, N'Generado', SYSDATETIME()),
    (N'Reporte administrador CSV', N'Auditoría', N'Mes actual', N'Administrador', N'CSV', N'Exportación plana de auditoría.', @admin_id, N'Generado', SYSDATETIME()),
    (N'Reporte administrador Imagen', N'Dashboard', N'Día actual', N'Administrador', N'Imagen PNG', N'Captura visual de indicadores.', @admin_id, N'Generado', SYSDATETIME()),
    (N'Dashboard compartible administrador', N'Dashboard compartible', N'Semana actual', N'Administrador', N'Dashboard compartible', N'Enlace temporal para dashboard administrativo.', @admin_id, N'Generado', SYSDATETIME());
END

-- 20.9 AUDITORÍA ADMIN COMPLEMENTARIA
IF NOT EXISTS (SELECT 1 FROM auditoria_admin WHERE accion = N'Carga complementaria administrador')
BEGIN
    INSERT INTO auditoria_admin (modulo, tipo, accion, usuario_id, usuario_nombre, valor_anterior, valor_nuevo, resultado, critico, detalle, fecha_evento)
    VALUES
    (N'Administrador', N'poblacion', N'Carga complementaria administrador', @admin_id, N'Administrador Sistema', N'-', N'Datos complementarios Admin cargados', N'Exitoso', 1, N'Se agregaron catálogos UI, integraciones, SLA, reportes, respaldo y auditoría para el módulo administrador.', SYSDATETIME());
END

-- 20.10 ALERTAS ADMIN REALISTAS
IF NOT EXISTS (SELECT 1 FROM alertas_sistema WHERE titulo = N'Revisión de permisos administrativos')
BEGIN
    INSERT INTO alertas_sistema (modulo, titulo, mensaje, severidad, estado, href, fecha_creacion)
    VALUES
    (N'Roles', N'Revisión de permisos administrativos', N'Validar que solo perfiles autorizados tengan permisos sensibles de administración.', N'Alta', N'Pendiente', N'roles-permisos.html', SYSDATETIME()),
    (N'SLA', N'Validación de reglas SLA', N'Revisar reglas críticas y escalamiento asociado.', N'Media', N'Pendiente', N'reglas-sla.html', SYSDATETIME()),
    (N'Configuración', N'Revisión de configuración de seguridad', N'Validar expiración de sesión, MFA, intentos fallidos y mantenimiento.', N'Alta', N'Pendiente', N'configuracion-sistema.html', SYSDATETIME());
END

/* =========================================================
   21. AJUSTES MÓDULO CLIENTE (segmento, canales, preferencias)
========================================================= */
-- CLIENTES: segmento_cliente y canal_preferido
IF COL_LENGTH('dbo.clientes', 'segmento_cliente') IS NOT NULL
    UPDATE dbo.clientes SET segmento_cliente = CASE WHEN tipo_cliente = 'PERSONA' THEN 'Residencial' ELSE 'Empresa' END WHERE segmento_cliente IS NULL;

IF COL_LENGTH('dbo.clientes', 'canal_preferido') IS NOT NULL
    UPDATE dbo.clientes SET canal_preferido = 'Correo' WHERE canal_preferido IS NULL;

-- SINTOMAS INCIDENCIA
IF NOT EXISTS (SELECT 1 FROM sintomas_incidencia WHERE nombre = 'Sin servicio')
BEGIN
    INSERT INTO sintomas_incidencia (nombre, descripcion, tipo_servicio)
    VALUES
    ('Sin servicio', 'El servicio no funciona o se encuentra totalmente interrumpido.', 'General'),
    ('Servicio intermitente', 'El servicio se corta de forma frecuente.', 'General'),
    ('Lentitud del servicio', 'La velocidad o respuesta del servicio es menor a lo esperado.', 'Internet'),
    ('Problemas de señal', 'Falla de señal móvil, TV o cobertura.', 'Móvil/TV'),
    ('Error de acceso', 'No se puede ingresar a una aplicación, portal, correo o servicio digital.', 'Digital'),
    ('Equipo no responde', 'Router, decodificador, módem u otro equipo presenta falla.', 'Equipos'),
    ('Afectación empresarial', 'La falla afecta operación de una empresa o sede.', 'Empresas');
END

-- PREFERENCIAS NOTIFICACIÓN CLIENTE
IF NOT EXISTS (SELECT 1 FROM preferencias_notificacion_cliente)
BEGIN
    INSERT INTO preferencias_notificacion_cliente (cliente_id, canal, activo)
    SELECT c.cliente_id, v.canal, v.activo
    FROM clientes c
    CROSS APPLY (VALUES ('Correo', 1), ('SMS', 0), ('WhatsApp', 1), ('Llamada', 0)) v(canal, activo)
    WHERE NOT EXISTS (SELECT 1 FROM preferencias_notificacion_cliente p WHERE p.cliente_id = c.cliente_id AND p.canal = v.canal);
END

-- ACCESOS USUARIO
IF NOT EXISTS (SELECT 1 FROM accesos_usuario)
BEGIN
    INSERT INTO accesos_usuario (usuario_id, canal, dispositivo, navegador, ip_origen, ubicacion_aproximada, resultado, fecha_acceso)
    SELECT u.usuario_id,