from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    secret_key: str = "dev-secret-key-change-in-production-32ch"
    anthropic_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///./mediassist.db"
    chroma_persist_directory: str = "./chroma_db"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7
    otel_enabled: bool = False
    otel_endpoint: str = ""
    debug: bool = True
    cors_origins: str = "http://localhost:3000"
    service_name: str = "mediassist-api"


settings = Settings()
