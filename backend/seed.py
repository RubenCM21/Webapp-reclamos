"""
seed.py — Poblar la base de datos con datos iniciales.

Ejecutar UNA SOLA VEZ después de crear las tablas:
    cd backend
    python seed.py

Incluye:
 - Roles
 - Áreas
 - Permisos básicos
 - Catálogos (tipos caso, categorías, prioridades, estados, canales, servicios)
 - Reglas SLA
 - Usuarios demo (1 por cada rol)
"""

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, engine, Base
from auth import hash_password
import models

db = SessionLocal()

# Crear todas las tablas (si no existen)
# NOTA: La BD ya fue creada con el script SQL. Esto es por si usas SQLAlchemy para crear.
# Base.metadata.create_all(bind=engine)


def seed():
    print("Iniciando seed de datos...")

    # ── ROLES ──────────────────────────────────────────────────────────────
    roles_data = [
        ("cliente-persona",  "Acceso para clientes individuales"),
        ("cliente-empresa",  "Acceso para representantes de empresas"),
        ("asesor",           "Asesor de atención al cliente"),
        ("supervisor",       "Supervisor de operaciones"),
        ("administrador",    "Administrador del sistema"),
    ]

    roles = {}
    for nombre, desc in roles_data:
        r = db.query(models.Rol).filter(models.Rol.nombre == nombre).first()
        if not r:
            r = models.Rol(nombre=nombre, descripcion=desc)
            db.add(r)
            db.flush()
            print(f"  ✅ Rol: {nombre}")
        roles[nombre] = r

    db.commit()

    # ── ÁREAS ──────────────────────────────────────────────────────────────
    areas_data = [
        ("Mesa de entrada",     "Recepción y clasificación inicial"),
        ("Atención comercial",  "Reclamos y facturación"),
        ("Soporte técnico",     "Incidencias técnicas"),
        ("Backoffice",          "Validaciones y escalamientos"),
        ("Supervisión",         "Monitoreo y control"),
        ("Administración",      "Gestión del sistema"),
    ]

    areas = {}
    for nombre, desc in areas_data:
        a = db.query(models.Area).filter(models.Area.nombre == nombre).first()
        if not a:
            a = models.Area(nombre=nombre, descripcion=desc)
            db.add(a)
            db.flush()
            print(f"  ✅ Área: {nombre}")
        areas[nombre] = a

    db.commit()

    # ── CANALES DE INGRESO ─────────────────────────────────────────────────
    canales_data = [
        "Portal cliente", "Call center", "App", "Correo",
        "Chat web", "WhatsApp", "Portal empresa",
    ]

    for nombre in canales_data:
        if not db.query(models.CanalIngreso).filter(models.CanalIngreso.nombre == nombre).first():
            db.add(models.CanalIngreso(nombre=nombre))
            print(f"  ✅ Canal: {nombre}")

    db.commit()

    # ── TIPOS DE CASO ──────────────────────────────────────────────────────
    tipos_data = [
        ("Reclamo",    "Reclamo formal del cliente"),
        ("Incidencia", "Falla o interrupción técnica"),
        ("Solicitud",  "Pedido de información o servicio"),
        ("Consulta",   "Pregunta o consulta general"),
    ]

    tipos = {}
    for nombre, desc in tipos_data:
        t = db.query(models.TipoCaso).filter(models.TipoCaso.nombre == nombre).first()
        if not t:
            t = models.TipoCaso(nombre=nombre, descripcion=desc)
            db.add(t)
            db.flush()
            print(f"  ✅ Tipo caso: {nombre}")
        tipos[nombre] = t

    db.commit()

    # ── CATEGORÍAS ─────────────────────────────────────────────────────────
    categorias_data = {
        "Reclamo": [
            "Cobro no reconocido", "Facturación incorrecta",
            "Cargo duplicado", "Plan contratado vs cobrado", "Descuento no aplicado",
        ],
        "Incidencia": [
            "Sin servicio", "Señal débil", "Velocidad reducida",
            "Intermitencia", "Equipo defectuoso", "Corte masivo",
        ],
        "Solicitud": [
            "Cambio de plan", "Portabilidad", "Cancelación",
            "Factura electrónica", "Información de contrato",
        ],
        "Consulta": [
            "Información de productos", "Cobertura",
            "Horarios de atención", "Puntos de pago",
        ],
    }

    for tipo_nombre, cats in categorias_data.items():
        tipo = tipos.get(tipo_nombre)
        if not tipo:
            continue
        for cat_nombre in cats:
            if not db.query(models.Categoria).filter(
                models.Categoria.tipo_caso_id == tipo.tipo_caso_id,
                models.Categoria.nombre == cat_nombre,
            ).first():
                db.add(models.Categoria(tipo_caso_id=tipo.tipo_caso_id, nombre=cat_nombre))

    db.commit()
    print("  ✅ Categorías creadas")

    # ── PRIORIDADES ────────────────────────────────────────────────────────
    prioridades_data = [
        ("Baja",    1, "Impacto mínimo",        72),
        ("Media",   2, "Impacto moderado",      24),
        ("Alta",    3, "Impacto significativo",  8),
        ("Crítica", 4, "Impacto total",          4),
    ]

    prioridades = {}
    for nombre, nivel, desc, horas in prioridades_data:
        p = db.query(models.Prioridad).filter(models.Prioridad.nombre == nombre).first()
        if not p:
            p = models.Prioridad(
                nombre=nombre, nivel=nivel, descripcion=desc,
                tiempo_objetivo_horas=horas
            )
            db.add(p)
            db.flush()
            print(f"  ✅ Prioridad: {nombre}")
        prioridades[nombre] = p

    db.commit()

    # ── ESTADOS DEL CASO ───────────────────────────────────────────────────
    estados_data = [
        ("Registrado",          False, True,  1),
        ("En atención",         False, True,  2),
        ("En revisión técnica", False, True,  3),
        ("Pendiente por cliente", False, True, 4),
        ("Derivado",            False, True,  5),
        ("Listo para cierre",   False, True,  6),
        ("Resuelto",            True,  True,  7),
        ("Cerrado",             True,  True,  8),
        ("Rechazado",           True,  False, 9),
    ]

    for nombre, es_final, visible, orden in estados_data:
        if not db.query(models.EstadoCaso).filter(models.EstadoCaso.nombre == nombre).first():
            db.add(models.EstadoCaso(
                nombre=nombre, es_final=es_final,
                visible_cliente=visible, orden=orden
            ))
            print(f"  ✅ Estado: {nombre}")

    db.commit()

    # ── SERVICIOS ──────────────────────────────────────────────────────────
    servicios_data = [
        ("Línea móvil",     "Servicio de telefonía móvil"),
        ("Internet hogar",  "Servicio de internet residencial"),
        ("Claro TV+",       "Servicio de televisión por cable"),
        ("Red móvil",       "Red de datos móviles"),
        ("Servicio empresa","Conectividad corporativa"),
        ("Cloud empresarial","Servicios cloud para empresas"),
        ("Correo empresarial","Correo corporativo"),
    ]

    for nombre, desc in servicios_data:
        if not db.query(models.Servicio).filter(models.Servicio.nombre == nombre).first():
            db.add(models.Servicio(nombre=nombre, descripcion=desc))
            print(f"  ✅ Servicio: {nombre}")

    db.commit()

    # ── SLA ────────────────────────────────────────────────────────────────
    sla_data = [
        ("SLA Reclamo Crítico",   "Reclamo",    "Crítica", 2,  4),
        ("SLA Reclamo Alta",      "Reclamo",    "Alta",    4,  8),
        ("SLA Reclamo Media",     "Reclamo",    "Media",   8, 24),
        ("SLA Reclamo Baja",      "Reclamo",    "Baja",   24, 72),
        ("SLA Incidencia Crítica","Incidencia", "Crítica", 1,  4),
        ("SLA Incidencia Alta",   "Incidencia", "Alta",    2,  8),
        ("SLA Incidencia Media",  "Incidencia", "Media",   4, 24),
        ("SLA Incidencia Baja",   "Incidencia", "Baja",   12, 72),
    ]

    tipos_cache = {t.nombre: t for t in db.query(models.TipoCaso).all()}
    prios_cache = {p.nombre: p for p in db.query(models.Prioridad).all()}

    for nombre, tipo_n, prio_n, h_resp, h_res in sla_data:
        if not db.query(models.Sla).filter(models.Sla.nombre == nombre).first():
            t = tipos_cache.get(tipo_n)
            p = prios_cache.get(prio_n)
            if t and p:
                db.add(models.Sla(
                    nombre=nombre,
                    tipo_caso_id=t.tipo_caso_id,
                    prioridad_id=p.prioridad_id,
                    tiempo_primera_respuesta_horas=h_resp,
                    tiempo_resolucion_horas=h_res,
                ))
                print(f"  ✅ SLA: {nombre}")

    db.commit()

    # ── PERMISOS ───────────────────────────────────────────────────────────
    permisos_data = [
        ("ver_dashboard",     "Ver panel principal",          "Dashboard"),
        ("registrar_caso",    "Crear reclamos e incidencias", "Casos"),
        ("ver_mis_casos",     "Ver casos propios",            "Casos"),
        ("ver_todos_casos",   "Ver todos los casos",          "Casos"),
        ("atender_caso",      "Actualizar y atender casos",   "Casos"),
        ("asignar_caso",      "Asignar y derivar casos",      "Asignaciones"),
        ("cerrar_caso",       "Cerrar casos",                 "Casos"),
        ("ver_reportes",      "Ver reportes",                 "Reportes"),
        ("generar_reporte",   "Generar reportes",             "Reportes"),
        ("gestionar_usuarios","Gestionar usuarios",           "Admin"),
        ("gestionar_roles",   "Gestionar roles y permisos",   "Admin"),
        ("gestionar_catalogos","Gestionar catálogos",         "Admin"),
        ("gestionar_sla",     "Gestionar reglas SLA",         "Admin"),
        ("ver_auditoria",     "Ver auditoría del sistema",    "Admin"),
        ("configuracion",     "Configuración del sistema",    "Admin"),
    ]

    for nombre, desc, modulo in permisos_data:
        if not db.query(models.Permiso).filter(models.Permiso.nombre == nombre).first():
            db.add(models.Permiso(nombre=nombre, descripcion=desc, modulo=modulo))

    db.commit()
    print("  ✅ Permisos creados")

    # ── USUARIOS DEMO ──────────────────────────────────────────────────────
    pwd = hash_password("1234")

    users_demo = [
        {
            "username": "admin",
            "correo": "admin@demo.com",
            "rol": "administrador",
            "area": "Administración",
            "nombres": "Administrador", "apellidos": "Demo",
            "doc": "99999991", "cargo": "Administrador del sistema",
        },
        {
            "username": "supervisor",
            "correo": "supervisor@demo.com",
            "rol": "supervisor",
            "area": "Supervisión",
            "nombres": "Supervisor", "apellidos": "Demo",
            "doc": "99999992", "cargo": "Supervisor de atención",
        },
        {
            "username": "asesor",
            "correo": "asesor@demo.com",
            "rol": "asesor",
            "area": "Atención comercial",
            "nombres": "Asesor", "apellidos": "Demo",
            "doc": "99999993", "cargo": "Asesor de atención",
        },
        {
            "username": "asesor2",
            "correo": "asesor.tecnico@demo.com",
            "rol": "asesor",
            "area": "Soporte técnico",
            "nombres": "Asesor", "apellidos": "Técnico",
            "doc": "99999994", "cargo": "Asesor técnico",
        },
    ]

    for ud in users_demo:
        if not db.query(models.Usuario).filter(models.Usuario.username == ud["username"]).first():
            rol = db.query(models.Rol).filter(models.Rol.nombre == ud["rol"]).first()
            area = db.query(models.Area).filter(models.Area.nombre == ud["area"]).first()
            if not rol:
                print(f"  ⚠️  Rol '{ud['rol']}' no encontrado para usuario {ud['username']}")
                continue

            u = models.Usuario(
                rol_id=rol.rol_id,
                area_id=area.area_id if area else None,
                username=ud["username"],
                correo=ud["correo"],
                password_hash=pwd,
                estado="ACTIVO",
            )
            db.add(u)
            db.flush()

            p = models.Personal(
                usuario_id=u.usuario_id,
                area_id=area.area_id if area else None,
                nombres=ud["nombres"],
                apellidos=ud["apellidos"],
                documento_tipo="DNI",
                documento_numero=ud["doc"],
                cargo=ud["cargo"],
            )
            db.add(p)
            db.flush()
            print(f"  ✅ Usuario demo: {ud['username']} / 1234")

    db.commit()

    # ── CLIENTE DEMO ───────────────────────────────────────────────────────
    rol_cliente = db.query(models.Rol).filter(models.Rol.nombre == "cliente-persona").first()
    if rol_cliente and not db.query(models.Usuario).filter(models.Usuario.username == "cliente.persona").first():
        u_c = models.Usuario(
            rol_id=rol_cliente.rol_id,
            username="cliente.persona",
            correo="cliente.persona@demo.com",
            password_hash=pwd,
            estado="ACTIVO",
        )
        db.add(u_c)
        db.flush()

        c = models.Cliente(
            usuario_id=u_c.usuario_id,
            tipo_cliente="PERSONA",
            nombres="Cliente",
            apellidos="Persona Demo",
            documento_tipo="DNI",
            documento_numero="12345678",
            correo="cliente.persona@demo.com",
            telefono="+51 999 999 999",
            direccion="Lima, Perú",
        )
        db.add(c)
        db.flush()

        # Agregar servicios contratados al cliente demo
        servicios = db.query(models.Servicio).filter(
            models.Servicio.nombre.in_(["Línea móvil", "Internet hogar", "Claro TV+"])
        ).all()

        for i, s in enumerate(servicios):
            db.add(models.ServicioContratado(
                cliente_id=c.cliente_id,
                servicio_id=s.servicio_id,
                codigo_contrato=f"SRV-DEMO-{i+1:03d}",
                plan_nombre="Plan Demo",
                estado="ACTIVO",
            ))

        db.commit()
        print("  ✅ Cliente demo: cliente.persona@demo.com / 1234")

    # Cliente empresa
    rol_empresa = db.query(models.Rol).filter(models.Rol.nombre == "cliente-empresa").first()
    if rol_empresa and not db.query(models.Usuario).filter(models.Usuario.username == "cliente.empresa").first():
        u_e = models.Usuario(
            rol_id=rol_empresa.rol_id,
            username="cliente.empresa",
            correo="cliente.empresa@demo.com",
            password_hash=pwd,
            estado="ACTIVO",
        )
        db.add(u_e)
        db.flush()

        ce = models.Cliente(
            usuario_id=u_e.usuario_id,
            tipo_cliente="EMPRESA",
            razon_social="Empresa Demo S.A.C.",
            documento_tipo="RUC",
            documento_numero="20123456789",
            correo="cliente.empresa@demo.com",
            telefono="+51 01 4000000",
            direccion="Av. Principal 123, Lima",
        )
        db.add(ce)
        db.flush()

        serv_emp = db.query(models.Servicio).filter(models.Servicio.nombre == "Servicio empresa").first()
        if serv_emp:
            db.add(models.ServicioContratado(
                cliente_id=ce.cliente_id,
                servicio_id=serv_emp.servicio_id,
                codigo_contrato="SRV-EMP-001",
                plan_nombre="Conectividad Pyme",
                estado="ACTIVO",
            ))

        db.commit()
        print("  ✅ Cliente empresa demo: cliente.empresa@demo.com / 1234")

    print("\n" + "="*50)
    print(" ✅ SEED COMPLETADO exitosamente.")
    print("="*50)
    print("\n Credenciales demo (password: 1234 para todos):")
    print("  📌 admin@demo.com            → Panel Admin")
    print("  📌 supervisor@demo.com       → Panel Supervisor")
    print("  📌 asesor@demo.com           → Panel Asesor")
    print("  📌 cliente.persona@demo.com  → Portal Cliente Persona")
    print("  📌 cliente.empresa@demo.com  → Portal Cliente Empresa")
    print()


if __name__ == "__main__":
    try:
        seed()
    except Exception as e:
        print(f"\n❌ Error durante el seed: {e}")
        db.rollback()
        raise
    finally:
        db.close()
