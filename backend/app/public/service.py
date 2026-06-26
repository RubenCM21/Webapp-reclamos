from datetime import datetime

from fastapi import HTTPException

from app.database import fetch_one, fetch_all


# =========================================================
# HELPERS
# =========================================================

def clean(value):
    return str(value or "").strip()


def lower(value):
    return clean(value).lower()


def safe_fetch_one(query, params=()):
    try:
        return fetch_one(query, params)
    except Exception:
        return None


def safe_fetch_all(query, params=()):
    try:
        return fetch_all(query, params)
    except Exception:
        return []


def normalize_segment(segment: str):
    value = lower(segment)
    return "empresas" if value == "empresas" else "personas"


def icon_for_status(status: str):
    value = lower(status)

    if "operativo" in value or "normal" in value or "resuelto" in value:
        return "ok"

    if "intermitencia" in value or "alerta" in value or "degradado" in value:
        return "warning"

    if "incidencia" in value or "caído" in value or "caido" in value or "error" in value:
        return "danger"

    if "mantenimiento" in value or "programado" in value:
        return "maintenance"

    return "info"


def public_status_type(status: str):
    return icon_for_status(status)


def format_datetime(value):
    if not value:
        return "-"

    if isinstance(value, datetime):
        return value.strftime("%d/%m/%Y %H:%M")

    return str(value)


def remaining_sla(deadline):
    if not deadline:
        return {
            "text": "Sin plazo registrado",
            "hours": 999,
            "risk": 20,
            "risk_text": "No existe plazo SLA registrado para este caso."
        }

    diff = deadline - datetime.now()
    hours = int(diff.total_seconds() // 3600)

    if hours < 0:
        return {
            "text": "SLA vencido",
            "hours": hours,
            "risk": 100,
            "risk_text": "El caso superó el plazo estimado de atención."
        }

    if hours <= 4:
        return {
            "text": f"{hours}h restantes",
            "hours": hours,
            "risk": 85,
            "risk_text": "Riesgo alto. El caso está próximo a vencer."
        }

    if hours <= 12:
        return {
            "text": f"{hours}h restantes",
            "hours": hours,
            "risk": 60,
            "risk_text": "Riesgo medio. El caso aún se encuentra dentro del plazo."
        }

    return {
        "text": f"{hours}h restantes",
        "hours": hours,
        "risk": 30,
        "risk_text": "Riesgo bajo. El caso se encuentra dentro del plazo estimado."
    }


def tracker_for_status(status: str):
    value = lower(status)

    base = ["Registrado"]

    if any(word in value for word in ["clasificado", "atención", "atencion", "pendiente", "derivado", "escalado", "resuelto", "cerrado"]):
        base.append("Clasificado")

    if any(word in value for word in ["atención", "atencion", "pendiente", "derivado", "escalado", "resuelto", "cerrado"]):
        base.append("En atención")

    if any(word in value for word in ["resuelto", "cerrado"]):
        base.append("Resuelto")

    if "cerrado" in value:
        base.append("Cerrado")

    return base


def get_case_public_row(codigo_caso: str):
    return fetch_one(
        """
        SELECT TOP 1
            c.caso_id,
            c.codigo_caso,
            c.titulo,
            c.descripcion,
            c.fecha_registro,
            c.fecha_actualizacion,
            c.fecha_limite_resolucion,
            c.fecha_cierre,
            c.responsable_actual_usuario_id,
            tc.nombre AS tipo_caso,
            cat.nombre AS categoria,
            pr.nombre AS prioridad,
            ec.nombre AS estado,
            s.nombre AS servicio,
            a.nombre AS area_responsable,
            u.username AS responsable_username
        FROM casos c
        INNER JOIN tipos_caso tc ON tc.tipo_caso_id = c.tipo_caso_id
        INNER JOIN categorias cat ON cat.categoria_id = c.categoria_id
        INNER JOIN prioridades pr ON pr.prioridad_id = c.prioridad_id
        INNER JOIN estados_caso ec ON ec.estado_caso_id = c.estado_caso_id
        LEFT JOIN servicios_contratados sc ON sc.servicio_contratado_id = c.servicio_contratado_id
        LEFT JOIN servicios s ON s.servicio_id = sc.servicio_id
        LEFT JOIN usuarios u ON u.usuario_id = c.responsable_actual_usuario_id
        LEFT JOIN personal p ON p.usuario_id = u.usuario_id
        LEFT JOIN areas a ON a.area_id = p.area_id
        WHERE c.codigo_caso = ?
        """,
        (clean(codigo_caso),)
    )


# =========================================================
# HOME
# =========================================================

def public_home_copy(segment: str):
    if segment == "empresas":
        return {
            "hero": {
                "eyebrow": "Empresas | Atención inteligente",
                "title": "Gestiona incidencias empresariales con trazabilidad y SLA",
                "description": "Consulta tickets, registra incidencias, revisa servicios empresariales y recibe orientación con información registrada en la plataforma.",
                "primaryText": "Registrar incidencia",
                "primaryHref": "login.html?role=cliente-empresa&next=cliente/registrar-incidencia.html",
                "panelTitle": "Centro empresarial inteligente",
                "statusText": "Mesa empresarial disponible"
            },
            "navCloudLabel": "Cloud",
            "quickTitle": "¿Qué quiere hacer tu empresa?",
            "quickSubtitle": "Accesos para soporte, servicios digitales y seguimiento de tickets.",
            "solutionsEyebrow": "Soluciones para empresas",
            "solutionsTitle": "Herramientas digitales para tu negocio",
            "solutionsSubtitle": "Conectividad, cloud, seguridad, soporte y atención especializada."
        }

    return {
        "hero": {
            "eyebrow": "Personas | Atención inteligente",
            "title": "Gestiona tus reclamos e incidencias en tiempo real",
            "description": "Registra, consulta y haz seguimiento de tus casos desde una plataforma conectada al sistema de atención.",
            "primaryText": "Registrar reclamo",
            "primaryHref": "login.html?role=cliente-persona&next=cliente/registrar-reclamo.html",
            "panelTitle": "Centro de atención rápida",
            "statusText": "Atención disponible"
        },
        "navCloudLabel": "Tienda",
        "quickTitle": "¿Qué necesitas hacer hoy?",
        "quickSubtitle": "Accesos rápidos para gestionar tus servicios, reclamos e incidencias.",
        "solutionsEyebrow": "Soluciones para personas",
        "solutionsTitle": "Tenemos lo que estás buscando",
        "solutionsSubtitle": "Explora servicios, gestiones digitales y herramientas para resolver tus necesidades."
    }


def public_home_service(segment: str):
    segment = normalize_segment(segment)
    copy = public_home_copy(segment)

    quick_actions = safe_fetch_all(
        """
        SELECT
            accion_id,
            segmento,
            icono,
            titulo,
            descripcion,
            href,
            orden
        FROM public_quick_actions
        WHERE segmento = ?
          AND activo = 1
        ORDER BY orden, accion_id
        """,
        (segment,)
    )

    solutions = safe_fetch_all(
        """
        SELECT
            solucion_id,
            segmento,
            etiqueta,
            titulo,
            descripcion,
            imagen_url,
            href,
            orden
        FROM public_solutions
        WHERE segmento = ?
          AND activo = 1
        ORDER BY orden, solucion_id
        """,
        (segment,)
    )

    total_cases = safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos
        """
    ) or {"total": 0}

    closed_cases = safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos
        WHERE fecha_cierre IS NOT NULL
        """
    ) or {"total": 0}

    sla_ok = safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos
        WHERE fecha_cierre IS NULL
          AND (
                fecha_limite_resolucion IS NULL
                OR fecha_limite_resolucion >= SYSDATETIME()
              )
        """
    ) or {"total": 0}

    open_cases = safe_fetch_one(
        """
        SELECT COUNT(*) AS total
        FROM casos
        WHERE fecha_cierre IS NULL
        """
    ) or {"total": 0}

    total = int(total_cases["total"] or 0)
    open_total = int(open_cases["total"] or 0)
    sla_total = int(sla_ok["total"] or 0)

    sla_percent = 100 if open_total == 0 else int((sla_total / open_total) * 100)

    metrics = [
        {
            "label": "Casos gestionados",
            "value": total,
            "suffix": "",
            "description": "Histórico registrado"
        },
        {
            "label": "Cumplimiento SLA",
            "value": sla_percent,
            "suffix": "%",
            "description": "Casos activos dentro de plazo"
        },
        {
            "label": "Casos cerrados",
            "value": int(closed_cases["total"] or 0),
            "suffix": "",
            "description": "Atenciones finalizadas"
        },
        {
            "label": "Casos activos",
            "value": open_total,
            "suffix": "",
            "description": "Seguimientos en curso"
        }
    ]

    return {
        "ok": True,
        "segment": segment,
        **copy,
        "quickActions": [
            {
                "icon": row["icono"],
                "title": row["titulo"],
                "description": row["descripcion"],
                "href": row["href"]
            }
            for row in quick_actions
        ],
        "solutions": [
            {
                "tag": row["etiqueta"],
                "title": row["titulo"],
                "description": row["descripcion"],
                "image": row["imagen_url"],
                "href": row["href"]
            }
            for row in solutions
        ],
        "metrics": metrics
    }


# =========================================================
# CONSULTA RÁPIDA
# =========================================================

def public_lookup_case_service(codigo_caso: str):
    codigo = clean(codigo_caso).upper()

    if not codigo:
        raise HTTPException(status_code=400, detail="Ingresa el código de caso.")

    case = get_case_public_row(codigo)

    if not case:
        raise HTTPException(status_code=404, detail="No se encontró un caso con el código ingresado.")

    sla = remaining_sla(case.get("fecha_limite_resolucion"))

    timeline_rows = safe_fetch_all(
        """
        SELECT TOP 10
            accion,
            observacion,
            fecha_evento
        FROM historial_caso
        WHERE caso_id = ?
          AND es_visible_cliente = 1
        ORDER BY fecha_evento ASC
        """,
        (case["caso_id"],)
    )

    if not timeline_rows:
        timeline_rows = [
            {
                "accion": "Caso registrado",
                "observacion": "El caso fue registrado en el sistema.",
                "fecha_evento": case.get("fecha_registro")
            }
        ]

    evidence_rows = safe_fetch_all(
        """
        SELECT TOP 10
            nombre_archivo,
            tipo_archivo,
            fecha_subida
        FROM evidencias
        WHERE caso_id = ?
        ORDER BY fecha_subida DESC
        """,
        (case["caso_id"],)
    )

    status = case.get("estado") or "Registrado"

    return {
        "ok": True,
        "case": {
            "id": case["caso_id"],
            "code": case["codigo_caso"],
            "title": f"Caso {case['codigo_caso']}",
            "description": case.get("titulo") or case.get("descripcion") or "Caso registrado en el sistema.",
            "type": case.get("tipo_caso") or "Caso",
            "category": case.get("categoria") or "-",
            "service": case.get("servicio") or "Servicio asociado",
            "priority": case.get("prioridad") or "Media",
            "status": status,
            "statusType": public_status_type(status),
            "lastUpdate": format_datetime(case.get("fecha_actualizacion") or case.get("fecha_registro")),
            "responsible": case.get("area_responsable") or case.get("responsable_username") or "Área de atención",
            "sla": sla["text"],
            "risk": sla["risk"],
            "riskText": sla["risk_text"],
            "recommendation": public_case_recommendation(status, sla["hours"]),
            "tracker": tracker_for_status(status),
            "timeline": [
                {
                    "icon": "🕘",
                    "title": row["accion"],
                    "description": row["observacion"] or "Evento registrado.",
                    "date": format_datetime(row["fecha_evento"])
                }
                for row in timeline_rows
            ],
            "evidences": [
                {
                    "icon": "📎",
                    "name": row.get("nombre_archivo") or "Evidencia registrada",
                    "detail": f"{row.get('tipo_archivo') or 'Archivo'} · {format_datetime(row.get('fecha_subida'))}"
                }
                for row in evidence_rows
            ]
        }
    }


def public_case_recommendation(status: str, hours: int):
    value = lower(status)

    if "pendiente" in value:
        return "El caso requiere información adicional. Ingresa al portal para responder la solicitud o adjuntar evidencia."

    if hours < 0:
        return "El caso superó el plazo estimado. Ingresa al portal para revisar el detalle o solicitar seguimiento."

    if hours <= 4:
        return "El caso está próximo a vencer. Revisa el historial y mantente atento a nuevas solicitudes."

    if "cerrado" in value or "resuelto" in value:
        return "El caso cuenta con atención final registrada. Ingresa al portal para revisar el detalle completo."

    return "El caso se encuentra en atención. Mantén disponible cualquier evidencia adicional solicitada."


# =========================================================
# ESTADO DE SERVICIOS
# =========================================================

def public_service_status_service(segment: str, district: str, service_type: str):
    segment = normalize_segment(segment)

    params = [segment]
    filters = ["segmento = ?", "activo = 1"]

    if clean(district) and lower(district) not in ["todos", "todas"]:
        filters.append("(LOWER(zona) = ? OR LOWER(zona_grupo) = ?)")
        params.extend([lower(district), lower(district)])

    if clean(service_type) and lower(service_type) not in ["todos", "todas"]:
        filters.append("LOWER(tipo_servicio) = ?")
        params.append(lower(service_type))

    where = " AND ".join(filters)

    services = safe_fetch_all(
        f"""
        SELECT
            servicio_estado_id,
            segmento,
            tipo_servicio,
            icono,
            nombre,
            descripcion,
            estado,
            salud,
            zona,
            zona_grupo,
            fecha_actualizacion
        FROM public_service_status
        WHERE {where}
        ORDER BY orden, servicio_estado_id
        """,
        tuple(params)
    )

    events = safe_fetch_all(
        """
        SELECT
            evento_id,
            codigo_evento,
            segmento,
            servicio,
            zona,
            tipo,
            estado,
            descripcion,
            fecha_inicio,
            fecha_estimada,
            activo
        FROM public_service_events
        WHERE segmento = ?
          AND activo = 1
        ORDER BY fecha_inicio DESC
        """,
        (segment,)
    )

    zones = safe_fetch_all(
        """
        SELECT
            zona_id,
            segmento,
            nombre,
            estado,
            posicion_top,
            posicion_left
        FROM public_service_zones
        WHERE segmento = ?
          AND activo = 1
        ORDER BY zona_id
        """,
        (segment,)
    )

    operational = len([item for item in services if icon_for_status(item["estado"]) == "ok"])
    warnings = len([item for item in services if icon_for_status(item["estado"]) == "warning"])
    maintenance = len([item for item in services if icon_for_status(item["estado"]) == "maintenance"])
    incidents = len([item for item in events if lower(item["tipo"]) == "incidencia"])

    availability = 0

    if services:
        availability = int(sum([int(item.get("salud") or 0) for item in services]) / len(services))

    general_status = "Operativo"

    if incidents > 0:
        general_status = "Con incidencias"

    if warnings > 0 and incidents == 0:
        general_status = "Con alertas"

    return {
        "ok": True,
        "segment": segment,
        "title": "Estado de servicios para Empresas" if segment == "empresas" else "Estado de servicios para Personas",
        "subtitle": "Información registrada de disponibilidad, intermitencias, mantenimientos e incidencias.",
        "availability": availability,
        "generalStatus": general_status,
        "kpis": {
            "operational": operational,
            "warnings": warnings,
            "maintenance": maintenance,
            "incidents": incidents
        },
        "services": [
            {
                "id": row["servicio_estado_id"],
                "icon": row["icono"],
                "name": row["nombre"],
                "description": row["descripcion"],
                "status": row["estado"],
                "type": icon_for_status(row["estado"]),
                "health": int(row["salud"] or 0),
                "area": row["zona"],
                "serviceType": row["tipo_servicio"],
                "updatedAt": format_datetime(row["fecha_actualizacion"])
            }
            for row in services
        ],
        "alerts": [
            {
                "title": row["servicio"],
                "status": row["estado"],
                "type": icon_for_status(row["estado"]),
                "text": row["descripcion"],
                "zone": row["zona"]
            }
            for row in events
            if lower(row["estado"]) not in ["resuelto", "operativo"]
        ],
        "incidents": [
            {
                "code": row["codigo_evento"],
                "segment": row["segmento"],
                "service": row["servicio"],
                "zone": row["zona"],
                "type": lower(row["tipo"]),
                "status": row["estado"],
                "statusType": icon_for_status(row["estado"]),
                "start": format_datetime(row["fecha_inicio"]),
                "eta": format_datetime(row["fecha_estimada"]),
                "description": row["descripcion"]
            }
            for row in events
        ],
        "zones": [
            {
                "name": row["nombre"],
                "status": row["estado"],
                "type": icon_for_status(row["estado"]),
                "top": int(row["posicion_top"] or 20),
                "left": int(row["posicion_left"] or 20)
            }
            for row in zones
        ]
    }


def public_service_diagnostic_service(payload: dict):
    service = lower(payload.get("service"))
    symptom = lower(payload.get("symptom"))

    if not service or not symptom:
        raise HTTPException(status_code=400, detail="Selecciona servicio y síntoma.")

    active_event = safe_fetch_one(
        """
        SELECT TOP 1
            codigo_evento,
            servicio,
            zona,
            estado,
            descripcion
        FROM public_service_events
        WHERE activo = 1
          AND LOWER(servicio) LIKE ?
          AND LOWER(estado) NOT IN ('resuelto', 'operativo')
        ORDER BY fecha_inicio DESC
        """,
        (f"%{service}%",)
    )

    if active_event:
        return {
            "ok": True,
            "title": "Evento activo identificado",
            "recommendation": f"Existe un evento activo asociado a {active_event['servicio']}: {active_event['descripcion']}. Si tu caso es individual o persiste luego del evento, registra una incidencia.",
            "action": "Revisar evento activo",
            "route": "estado-servicios.html"
        }

    if symptom in ["sin-servicio", "intermitente", "error-acceso"]:
        return {
            "ok": True,
            "title": "Registrar incidencia",
            "recommendation": "No se encontró un evento activo equivalente. Registra una incidencia con servicio afectado, zona, hora aproximada y evidencia.",
            "action": "Registrar incidencia",
            "route": "login.html?role=cliente-persona&next=cliente/registrar-incidencia.html"
        }

    if symptom == "lento":
        return {
            "ok": True,
            "title": "Revisión recomendada",
            "recommendation": "Revisa conexión, equipo y cobertura. Si la lentitud persiste, registra una incidencia técnica.",
            "action": "Ir al centro de ayuda",
            "route": "centro-ayuda.html"
        }

    return {
        "ok": True,
        "title": "Centro de ayuda",
        "recommendation": "Revisa guías de ayuda o registra una incidencia si el problema continúa.",
        "action": "Centro de ayuda",
        "route": "centro-ayuda.html"
    }


# =========================================================
# CENTRO DE AYUDA
# =========================================================

def public_help_center_service(segment: str, q: str, category: str):
    segment = normalize_segment(segment)
    query = lower(q)
    category_filter = lower(category)

    quick_actions = safe_fetch_all(
        """
        SELECT
            accion_id,
            segmento,
            icono,
            titulo,
            descripcion,
            href,
            orden
        FROM public_quick_actions
        WHERE segmento = ?
          AND activo = 1
        ORDER BY orden, accion_id
        """,
        (segment,)
    )

    categories = safe_fetch_all(
        """
        SELECT
            categoria_ayuda_id,
            segmento,
            icono,
            titulo,
            descripcion,
            etiqueta,
            activo
        FROM public_help_categories
        WHERE segmento = ?
          AND activo = 1
        ORDER BY orden, categoria_ayuda_id
        """,
        (segment,)
    )

    article_params = [segment]
    article_filters = ["a.segmento = ?", "a.activo = 1"]

    if query:
        article_filters.append("(LOWER(a.titulo) LIKE ? OR LOWER(a.descripcion) LIKE ? OR LOWER(c.titulo) LIKE ?)")
        article_params.extend([f"%{query}%", f"%{query}%", f"%{query}%"])

    if category_filter and category_filter not in ["todos", "todas"]:
        article_filters.append("LOWER(c.titulo) LIKE ?")
        article_params.append(f"%{category_filter}%")

    article_where = " AND ".join(article_filters)

    articles = safe_fetch_all(
        f"""
        SELECT
            a.articulo_id,
            a.segmento,
            a.icono,
            a.etiqueta,
            a.titulo,
            a.descripcion,
            c.titulo AS categoria
        FROM public_help_articles a
        LEFT JOIN public_help_categories c ON c.categoria_ayuda_id = a.categoria_ayuda_id
        WHERE {article_where}
        ORDER BY a.orden, a.articulo_id
        """,
        tuple(article_params)
    )

    article_items = []

    for article in articles:
        steps = safe_fetch_all(
            """
            SELECT paso
            FROM public_help_article_steps
            WHERE articulo_id = ?
            ORDER BY orden, paso_id
            """,
            (article["articulo_id"],)
        )

        article_items.append({
            "id": article["articulo_id"],
            "icon": article["icono"],
            "tag": article["etiqueta"],
            "title": article["titulo"],
            "text": article["descripcion"],
            "category": article.get("categoria") or "General",
            "steps": [step["paso"] for step in steps]
        })

    faq_params = [segment]
    faq_filters = ["segmento = ?", "activo = 1"]

    if query:
        faq_filters.append("(LOWER(pregunta) LIKE ? OR LOWER(respuesta) LIKE ?)")
        faq_params.extend([f"%{query}%", f"%{query}%"])

    if category_filter and category_filter not in ["todos", "todas"]:
        faq_filters.append("LOWER(categoria) = ?")
        faq_params.append(category_filter)

    faq_where = " AND ".join(faq_filters)

    faqs = safe_fetch_all(
        f"""
        SELECT
            faq_id,
            categoria,
            pregunta,
            respuesta
        FROM public_help_faq
        WHERE {faq_where}
        ORDER BY orden, faq_id
        """,
        tuple(faq_params)
    )

    return {
        "ok": True,
        "segment": segment,
        "quickTitle": "¿Qué quiere hacer tu empresa?" if segment == "empresas" else "¿Qué necesitas hacer?",
        "quickSubtitle": "Accesos rápidos registrados para soporte empresarial." if segment == "empresas" else "Accesos rápidos registrados para clientes personas.",
        "categoriesTitle": "Temas frecuentes para Empresas" if segment == "empresas" else "Temas frecuentes para Personas",
        "articlesTitle": "Guías empresariales recomendadas" if segment == "empresas" else "Guías útiles para resolver tus consultas",
        "quickActions": [
            {
                "icon": row["icono"],
                "title": row["titulo"],
                "text": row["descripcion"],
                "href": row["href"]
            }
            for row in quick_actions
        ],
        "categories": [
            {
                "id": row["categoria_ayuda_id"],
                "icon": row["icono"],
                "title": row["titulo"],
                "text": row["descripcion"],
                "tag": row["etiqueta"],
                "count": len([article for article in article_items if article["category"] == row["titulo"]])
            }
            for row in categories
        ],
        "articles": article_items,
        "faqs": [
            {
                "id": row["faq_id"],
                "category": row["categoria"],
                "question": row["pregunta"],
                "answer": row["respuesta"]
            }
            for row in faqs
        ]
    }


def public_help_diagnostic_service(payload: dict):
    service = lower(payload.get("service"))
    problem = lower(payload.get("problem"))
    urgency = lower(payload.get("urgency"))

    if not service or not problem or not urgency:
        raise HTTPException(status_code=400, detail="Completa servicio, problema y urgencia.")

    if any(word in problem for word in ["cobro", "factura", "recibo", "cargo", "pago"]):
        return {
            "ok": True,
            "action": "Registrar reclamo",
            "priority": "Alta" if urgency in ["alta", "critica"] else "Media",
            "evidence": "Recibo, cargo observado, comprobante o captura del detalle.",
            "route": "login.html?role=cliente-persona&next=cliente/registrar-reclamo.html",
            "message": "Por la descripción, corresponde registrar un reclamo."
        }

    if any(word in problem for word in ["lento", "falla", "no funciona", "sin servicio", "intermitente", "error", "caído", "caido"]):
        return {
            "ok": True,
            "action": "Registrar incidencia",
            "priority": "Crítica" if urgency == "critica" else ("Alta" if urgency == "alta" else "Media"),
            "evidence": "Captura del problema, zona afectada, hora del evento y pruebas disponibles.",
            "route": "login.html?role=cliente-persona&next=cliente/registrar-incidencia.html",
            "message": "Por la descripción, corresponde registrar una incidencia técnica."
        }

    return {
        "ok": True,
        "action": "Consultar centro de ayuda",
        "priority": urgency.title(),
        "evidence": "Descripción del problema y evidencia disponible.",
        "route": "centro-ayuda.html",
        "message": "Primero revisa artículos relacionados. Si el problema continúa, registra un caso."
    }


# =========================================================
# SEARCH / ASISTENTE
# =========================================================

def public_search_service(q: str):
    query = lower(q)

    if not query:
        return {
            "ok": True,
            "items": []
        }

    items = []

    case_rows = safe_fetch_all(
        """
        SELECT TOP 5
            codigo_caso,
            titulo
        FROM casos
        WHERE LOWER(codigo_caso) LIKE ?
           OR LOWER(titulo) LIKE ?
        ORDER BY fecha_registro DESC
        """,
        (f"%{query}%", f"%{query}%")
    )

    for row in case_rows:
        items.append({
            "icon": "🎫",
            "title": row["codigo_caso"],
            "description": row.get("titulo") or "Caso registrado",
            "href": f"consulta-rapida.html?case={row['codigo_caso']}"
        })

    article_rows = safe_fetch_all(
        """
        SELECT TOP 5
            titulo,
            descripcion
        FROM public_help_articles
        WHERE activo = 1
          AND (
                LOWER(titulo) LIKE ?
                OR LOWER(descripcion) LIKE ?
              )
        ORDER BY orden, articulo_id
        """,
        (f"%{query}%", f"%{query}%")
    )

    for row in article_rows:
        items.append({
            "icon": "📘",
            "title": row["titulo"],
            "description": row["descripcion"],
            "href": "centro-ayuda.html"
        })

    static_items = [
        {
            "icon": "📝",
            "title": "Registrar reclamo",
            "description": "Formulario para registrar reclamos.",
            "href": "login.html?role=cliente-persona&next=cliente/registrar-reclamo.html",
            "keywords": "reclamo facturacion cobro atencion"
        },
        {
            "icon": "⚠️",
            "title": "Registrar incidencia",
            "description": "Formulario para reportar fallas técnicas.",
            "href": "login.html?role=cliente-persona&next=cliente/registrar-incidencia.html",
            "keywords": "incidencia falla internet lento sin servicio"
        },
        {
            "icon": "📡",
            "title": "Estado de servicios",
            "description": "Consulta disponibilidad y eventos activos.",
            "href": "estado-servicios.html",
            "keywords": "estado servicios red cobertura"
        }
    ]

    for item in static_items:
        text = f"{item['title']} {item['description']} {item['keywords']}".lower()
        if query in text:
            items.append(item)

    return {
        "ok": True,
        "items": items
    }


def public_assistant_service(payload: dict):
    prompt = lower(payload.get("prompt"))
    page = lower(payload.get("page"))
    case_context = payload.get("case") or {}

    if not prompt:
        raise HTTPException(status_code=400, detail="Ingresa una consulta.")

    if case_context:
        status = case_context.get("status") or case_context.get("estado") or "Sin estado"
        code = case_context.get("code") or case_context.get("codigo_caso") or "el caso"

        if "estado" in prompt:
            return {
                "ok": True,
                "answer": f"El caso {code} se encuentra en estado {status}. Revisa el historial para conocer la última acción registrada."
            }

        if "resum" in prompt:
            return {
                "ok": True,
                "answer": f"Resumen: {code} corresponde a {case_context.get('type', 'un caso')} sobre {case_context.get('service', 'servicio asociado')}, con prioridad {case_context.get('priority', 'registrada')} y estado actual {status}."
            }

        if "hacer" in prompt or "siguiente" in prompt:
            return {
                "ok": True,
                "answer": public_case_recommendation(status, 10)
            }

    if "reclamo" in prompt and "incidencia" in prompt:
        answer = "Un reclamo se usa para disconformidad por cobro, atención o servicio. Una incidencia se usa para fallas técnicas, lentitud, interrupciones o errores de acceso."

    elif "reclamo" in prompt:
        answer = "Para registrar un reclamo debes iniciar sesión, seleccionar el servicio, describir la disconformidad y adjuntar evidencia si corresponde."

    elif "incidencia" in prompt or "lento" in prompt or "falla" in prompt or "internet" in prompt:
        answer = "Para una falla técnica, revisa primero el estado de servicios. Si no hay evento activo o el problema continúa, registra una incidencia con evidencia."

    elif "caso" in prompt or "ticket" in prompt or "estado" in prompt:
        answer = "Puedes consultar un caso ingresando solo el código en Consulta rápida. Se mostrará información pública del seguimiento sin exponer datos sensibles."

    elif "pendiente por cliente" in prompt:
        answer = "Pendiente por cliente significa que se requiere información adicional. Debes ingresar al portal para responder o adjuntar evidencia."

    elif "servicio" in prompt or "operativo" in prompt or "intermitencia" in prompt:
        answer = "El estado de servicios se basa en eventos registrados. Operativo indica que no existe evento masivo activo; intermitencia o incidencia indican afectación reportada."

    elif "empresa" in prompt or "cloud" in prompt or "correo" in prompt:
        answer = "Para soporte empresarial, registra una incidencia indicando servicio afectado, usuarios impactados, hora aproximada y evidencia técnica."

    elif "ayuda" in prompt or "evidencia" in prompt:
        answer = "Como evidencia puedes adjuntar capturas, recibos, fotos del equipo, mensajes de error, pruebas de velocidad o documentos relacionados."

    else:
        answer = "Puedo ayudarte a consultar casos, diferenciar reclamo e incidencia, revisar estado de servicios o encontrar artículos del centro de ayuda."

    return {
        "ok": True,
        "answer": answer
    }