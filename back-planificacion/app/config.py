from __future__ import annotations
from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "Planificador Allianz - NTT DATA"
    app_version: str = "1.0.0"
    debug: bool = False
    backend_port: int = 8001
    frontend_port: int = 5174
    app_host: str = "0.0.0.0"
    vite_api_proxy_target: str = ""

    # Azure OpenAI
    azure_openai_endpoint: str
    azure_openai_api_key: str
    azure_openai_deployment: str
    azure_openai_api_version: str
    azure_openai_temperature: float

    # Azure SQL
    db_host: str
    db_port: int
    db_name: str
    db_user: str
    db_password: str
    azure_sql_connection_string: str | None = None

    # Redis
    redis_url: str

    # CORS
    cors_origins: list[str] = Field()

    # Seguridad
    secret_key: str

    # Superusuario
    super_user: str = "admin"
    super_password_hash: str = "$2b$12$RafloR0804BkiERwgOSEm.fNmmktga9Cnwoo9js/3tEjR1EsZAOiK"
    jwt_algorithm: str = "HS256"

    # Usuario normal (solo lectura)
    normal_user: str = "planificador"
    normal_password_hash: str = "$2b$12$qPVGu/9QWI/FFbSgLswM6.aER/WTdPjtOg7FHbFh.4R1J794XJqZ."



@lru_cache
def get_settings() -> Settings:
    return Settings()
