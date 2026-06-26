from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.auth.routes import router as auth_router
from app.cliente.routes import router as cliente_router
from app.asesor.routes import router as asesor_router
from app.supervisor.routes import router as supervisor_router
from app.admin.routes import router as admin_router
from app.public.routes import router as public_router


app = FastAPI(
    title="Claro Atención 360 API",
    description="Backend de gestión de reclamos, incidencias y atención 360.",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://127.0.0.1:3000",
        "http://localhost:3000"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["Sistema"])
def health_check():
    return {
        "status": "ok",
        "message": "Backend funcionando correctamente"
    }


app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(cliente_router, prefix=settings.API_PREFIX)
app.include_router(asesor_router, prefix=settings.API_PREFIX)
app.include_router(supervisor_router, prefix=settings.API_PREFIX)
app.include_router(admin_router, prefix=settings.API_PREFIX)
app.include_router(public_router, prefix=settings.API_PREFIX)