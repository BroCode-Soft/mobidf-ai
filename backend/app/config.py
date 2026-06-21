from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore"
    )

    # Database
    database_url: str = "postgresql+asyncpg://mobidf:mobidf_secret@localhost:5432/mobidf"
    database_url_sync: str = "postgresql://mobidf:mobidf_secret@localhost:5432/mobidf"

    # App
    secret_key: str = "change_me"
    cors_origins: str = "http://localhost:3000,https://mobidf.brocode.net.br"
    debug: bool = False

    # GTFS
    gtfs_df_url: str = "https://www.dados.df.gov.br/dataset/gtfs-df/resource/gtfs-df.zip"
    gtfs_rt_url: str = ""

    # IBGE
    ibge_api_url: str = "https://servicodados.ibge.gov.br/api/v3"

    # Google Maps
    google_maps_api_key: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a list"""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
