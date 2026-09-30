from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "PG-NEXUS API"
    app_version: str = "2.0.0"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://pgnexus:pgnexus@localhost:5432/pgnexus"

    # Keycloak: tokens are issued for the public URL, keys are fetched over the cluster network.
    keycloak_issuer: str = "http://localhost:8180/auth/realms/pgnexus"
    keycloak_jwks_url: str = "http://localhost:8180/auth/realms/pgnexus/protocol/openid-connect/certs"

    max_audio_bytes: int = 3 * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
