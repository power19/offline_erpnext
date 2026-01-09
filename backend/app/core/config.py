from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    # App Configuration
    debug: bool = True
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Default POS Settings
    default_warehouse: str = "Stores - Company"
    default_company: str = "Your Company Name"
    default_currency: str = "USD"

    # ERPNext Connection (can be pre-configured via environment)
    erpnext_url: Optional[str] = None
    erpnext_api_key: Optional[str] = None
    erpnext_api_secret: Optional[str] = None

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def has_erpnext_config(self) -> bool:
        """Check if ERPNext is pre-configured via environment variables."""
        return bool(self.erpnext_url and self.erpnext_api_key and self.erpnext_api_secret)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"  # Ignore extra fields from .env file


class RuntimeConfig:
    """Runtime configuration that can be updated via API."""

    def __init__(self):
        self._erpnext_url: str = ""
        self._erpnext_api_key: str = ""
        self._erpnext_api_secret: str = ""

    @property
    def erpnext_url(self) -> str:
        # Environment variable takes precedence
        if settings.erpnext_url:
            return settings.erpnext_url
        return self._erpnext_url

    @erpnext_url.setter
    def erpnext_url(self, value: str):
        self._erpnext_url = value

    @property
    def erpnext_api_key(self) -> str:
        if settings.erpnext_api_key:
            return settings.erpnext_api_key
        return self._erpnext_api_key

    @erpnext_api_key.setter
    def erpnext_api_key(self, value: str):
        self._erpnext_api_key = value

    @property
    def erpnext_api_secret(self) -> str:
        if settings.erpnext_api_secret:
            return settings.erpnext_api_secret
        return self._erpnext_api_secret

    @erpnext_api_secret.setter
    def erpnext_api_secret(self, value: str):
        self._erpnext_api_secret = value

    @property
    def is_configured(self) -> bool:
        return bool(self.erpnext_url)

    @property
    def is_preconfigured(self) -> bool:
        """Check if config came from environment variables."""
        return settings.has_erpnext_config


settings = Settings()
runtime_config = RuntimeConfig()
