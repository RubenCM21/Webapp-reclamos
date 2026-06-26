from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Claro Atención 360"
    APP_ENV: str = "development"
    API_PREFIX: str = "/api"

    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"
    DB_SERVER: str = "localhost"
    DB_DATABASE: str = "ClaroAtencion360"
    DB_TRUSTED_CONNECTION: str = "yes"
    DB_USERNAME: str = "sa"
    DB_PASSWORD: str = "123456789"

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    VERIFICATION_CODE_EXPIRE_MINUTES: int = 10
    PASSWORD_RESET_CODE_EXPIRE_MINUTES: int = 10
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 15

    FRONTEND_URL: str = "http://127.0.0.1:5500"

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_NAME: str = "Claro Atención 360"
    SMTP_FROM_EMAIL: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()