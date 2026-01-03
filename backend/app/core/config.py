from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # App Configuration
    debug: bool = True
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Default POS Settings
    default_warehouse: str = "Stores - Company"
    default_company: str = "Your Company Name"
    default_currency: str = "USD"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


class RuntimeConfig:
    """Runtime configuration that can be updated via API."""

    def __init__(self):
        self.erpnext_url: str = ""
        self.erpnext_api_key: str = ""
        self.erpnext_api_secret: str = ""

    @property
    def is_configured(self) -> bool:
        return bool(self.erpnext_url)


settings = Settings()
runtime_config = RuntimeConfig()
