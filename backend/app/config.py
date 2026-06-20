from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://mobidf:mobidf_secret@localhost:5432/mobidf"
    database_url_sync: str = "postgresql://mobidf:mobidf_secret@localhost:5432/mobidf"

    # App
    secret_key: str = "change_me"
    cors_origins: list[str] = ["http://localhost:3000"]
    debug: bool = False

    # GTFS
    gtfs_df_url: str = "https://www.dados.df.gov.br/dataset/gtfs-df/resource/gtfs-df.zip"
    gtfs_rt_url: str = ""

    # IBGE
    ibge_api_url: str = "https://servicodados.ibge.gov.br/api/v3"

    # Google Maps
    google_maps_api_key: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
