"""
config.py — Configuración global del backend ClaroAtencion360.
Todas las variables se leen del archivo .env (copiar .env.example → .env).
"""

from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # Base de datos
    DB_SERVER: str = "localhost"
    DB_PORT: int = 1433
    DB_NAME: str = "ClaroAtencion360"
    DB_USER: str = "sa"
    DB_PASSWORD: str = "123456789"
    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"

    # JWT
    SECRET_KEY: str = "123456789"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Archivos
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 10

    # CORS — se parsea como lista separada por comas
    CORS_ORIGINS: str = "http://localhost:5500,http://127.0.0.1:5500,http://localhost:3000"

# Email (opcional)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    EMAIL_FROM: str = "noreply@claroatencion360.com.pe"
    
    def get_cors_origins(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Asegurar carpeta de uploads
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
