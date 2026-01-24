
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Directories
    MODEL_DIR: str = os.environ.get("MODEL_DIR", "./model")
    LOG_DIR: str = os.environ.get("LOG_DIR", "./logs")
    DATA_DIR: str = os.environ.get("DATA_DIR", "./data")
    RUN_DIR: str = os.environ.get("RUN_DIR", "./run")

    # Database
    POSTGRES_USER: str = os.environ.get("POSTGRES_USER", "user")
    POSTGRES_PASSWORD: str = os.environ.get("POSTGRES_PASSWORD", "password")
    POSTGRES_HOST: str = os.environ.get("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: str = os.environ.get("POSTGRES_PORT", "5432")
    POSTGRES_DB: str = os.environ.get("POSTGRES_DB", "stringlights")

    # Redis
    REDIS_HOST: str = os.environ.get("REDIS_HOST", "redis")
    REDIS_PORT: str = os.environ.get("REDIS_PORT", "6379")

    @property
    def SQLALCHEMY_DATABASE_URL(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
