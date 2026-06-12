"""
main.py — Aplicación FastAPI de ClaroAtencion360.

Iniciar en desarrollo:
    uvicorn main:app --reload --port 8000

En producción:
    uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse

from config import settings
from database import check_connection
from routers import auth, clientes, casos, asesor, supervisor, admin, publico


# ── Crear aplicación ─────────────────────────────────────────────────────────

app = FastAPI(
    title="ClaroAtencion360 API",
    description="Backend para la plataforma de gestión de reclamos e incidencias de ClaroPeru.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)


# ── CORS ─────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup ──────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    print("=" * 60)
    print(" ClaroAtencion360 API — Iniciando...")
    print("=" * 60)
    db_ok = check_connection()
    if db_ok:
        print(" ✅ Base de datos: Conectada")
    else:
        print(" ❌ Base de datos: Sin conexión")
        print("    Verifica la configuración en .env")
    print(f" 📋 Documentación: http://localhost:8000/api/docs")
    print(f" 🌐 CORS origins: {settings.get_cors_origins()}")
    print("=" * 60)


# ── Routers ──────────────────────────────────────────────────────────────────

app.include_router(auth.router,       prefix="/api/auth",       tags=["Auth"])
app.include_router(clientes.router,   prefix="/api/clientes",   tags=["Clientes"])
app.include_router(casos.router,      prefix="/api/casos",      tags=["Casos"])
app.include_router(asesor.router,     prefix="/api/asesor",     tags=["Asesor"])
app.include_router(supervisor.router, prefix="/api/supervisor", tags=["Supervisor"])
app.include_router(admin.router,      prefix="/api/admin",      tags=["Admin"])
app.include_router(publico.router,    prefix="/api/publico",    tags=["Público"])


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["Sistema"])
def health():
    return {
        "status": "ok",
        "service": "ClaroAtencion360 API",
        "version": "1.0.0",
        "db_connected": check_connection(),
    }


# ── Servir frontend estático (opcional) ──────────────────────────────────────
# Si el frontend está en la carpeta hermana '../frontend'

frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.isdir(frontend_path):
    # Montar como último recurso para no interferir con /api/
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="static")
    print(f" 🗂️  Frontend servido desde: {frontend_path}")


# ── Handler de errores globales ───────────────────────────────────────────────

@app.exception_handler(404)
async def not_found_handler(request, exc):
    # Si es una ruta /api, retornar JSON
    if str(request.url.path).startswith("/api"):
        return JSONResponse(status_code=404, content={"detail": "Endpoint no encontrado."})
    # Para rutas de frontend, dejar que StaticFiles lo maneje
    return JSONResponse(status_code=404, content={"detail": "No encontrado."})
