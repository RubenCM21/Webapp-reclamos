"""
database.py — Conexión SQLAlchemy a SQL Server mediante pyodbc.

Requisito previo (servidor donde corre Python):
  Linux:   sudo ACCEPT_EULA=Y apt-get install -y msodbcsql17 unixodbc-dev
  Windows: instalar "ODBC Driver 17 for SQL Server" desde Microsoft

Si prefieres sin ODBC: reemplaza DATABASE_URL por pymssql:
  mssql+pymssql://{user}:{pwd}@{server}/{db}
  pip install pymssql
"""

import urllib.parse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from config import settings


# ── URL de conexión ──────────────────────────────────────────────────────────
def _build_connection_string() -> str:
    return (
        f"DRIVER={{{settings.DB_DRIVER}}};"
        f"SERVER={settings.DB_SERVER},{settings.DB_PORT};"
        f"DATABASE={settings.DB_NAME};"
        f"UID={settings.DB_USER};"
        f"PWD={settings.DB_PASSWORD};"
        "TrustServerCertificate=yes;"
        "Encrypt=yes;"
    )


DATABASE_URL = (
    "mssql+pyodbc:///?odbc_connect="
    + urllib.parse.quote_plus(_build_connection_string())
)

engine = create_engine(
    DATABASE_URL,
    echo=False,           # True para ver SQL en consola durante debug
    pool_pre_ping=True,   # Re-verifica conexiones caídas
    pool_size=10,
    max_overflow=20,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# ── Base declarativa ─────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Dependency FastAPI ────────────────────────────────────────────────────────
def get_db():
    """Inyectar en routers como: db: Session = Depends(get_db)"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_connection() -> bool:
    """Verifica si la BD está accesible (usado en startup)."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"[DB] Error de conexión: {e}")
        return False
