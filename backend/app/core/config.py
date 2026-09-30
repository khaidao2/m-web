from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # App
    app_name: str = "PG-NEXUS API"
    app_version: str = "1.0.0"
    debug: bool = False
    environment: str = "production"

    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/pgnexus"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Keycloak / OIDC
    keycloak_url: str = "http://localhost:8180"
    keycloak_realm: str = "pgnexus"
    keycloak_client_id: str = "pgnexus-backend"
    keycloak_client_secret: str = ""
    oidc_jwks_url: str = ""

    # AI APIs
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    elevenlabs_api_key: str = ""

    # CORS
    cors_origins: list[str] = ["http://localhost:3000", "https://pgnexus.local"]

    # Security
    secret_key: str = "change-me-in-production-use-strong-random-key"
    algorithm: str = "RS256"

    class Config:
        env_file = ".env"
        case_sensitive = False

    def model_post_init(self, __context):
        if not self.oidc_jwks_url:
            self.oidc_jwks_url = (
                f"{self.keycloak_url}/realms/{self.keycloak_realm}/protocol/openid-connect/certs"
            )


@lru_cache()
def get_settings() -> Settings:
    return Settings()
