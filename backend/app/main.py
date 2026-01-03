"""
Offline POS System Backend
FastAPI application for ERPNext integration
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import requests

from app.core.config import settings, runtime_config
from app.api.routes import api_router

# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="Offline POS API",
    description="API for Offline POS System with ERPNext integration",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for setup
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")


class ConfigRequest(BaseModel):
    url: str
    api_key: str = ""
    api_secret: str = ""


@app.get("/")
async def root():
    """Root endpoint - health check."""
    return {
        "status": "ok",
        "app": "Offline POS System",
        "version": "1.0.0"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.post("/api/test-connection")
async def test_connection(config: ConfigRequest):
    """Test connection to ERPNext."""
    try:
        url = config.url.rstrip("/")
        headers = {}

        if config.api_key and config.api_secret:
            headers["Authorization"] = f"token {config.api_key}:{config.api_secret}"

        # Try to fetch the API info
        response = requests.get(
            f"{url}/api/method/frappe.auth.get_logged_user",
            headers=headers,
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            return {
                "success": True,
                "user": data.get("message", "Connected"),
                "url": url
            }
        elif response.status_code == 401:
            return {
                "success": False,
                "error": "Invalid API credentials"
            }
        elif response.status_code == 403:
            return {
                "success": False,
                "error": "Access forbidden - check API permissions"
            }
        else:
            return {
                "success": False,
                "error": f"Server returned status {response.status_code}"
            }
    except requests.exceptions.ConnectionError:
        return {
            "success": False,
            "error": "Could not connect to server - check the URL"
        }
    except requests.exceptions.Timeout:
        return {
            "success": False,
            "error": "Connection timed out"
        }
    except Exception as e:
        logger.error(f"Connection test failed: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@app.post("/api/config")
async def update_config(config: ConfigRequest):
    """Update ERPNext configuration at runtime."""
    try:
        # Update runtime config
        runtime_config.erpnext_url = config.url.rstrip("/")
        runtime_config.erpnext_api_key = config.api_key
        runtime_config.erpnext_api_secret = config.api_secret

        logger.info(f"Configuration updated - ERPNext URL: {runtime_config.erpnext_url}")

        return {
            "success": True,
            "message": "Configuration updated successfully"
        }
    except Exception as e:
        logger.error(f"Failed to update config: {e}")
        return {
            "success": False,
            "error": str(e)
        }


@app.get("/api/config/status")
async def get_config_status():
    """Check if ERPNext is configured."""
    return {
        "configured": bool(runtime_config.erpnext_url),
        "url": runtime_config.erpnext_url or None
    }


@app.on_event("startup")
async def startup_event():
    """Startup event handler."""
    logger.info("Starting Offline POS Backend...")
    logger.info(f"Debug mode: {settings.debug}")
    if runtime_config.erpnext_url:
        logger.info(f"ERPNext URL: {runtime_config.erpnext_url}")
    else:
        logger.info("ERPNext not configured - waiting for setup")


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event handler."""
    logger.info("Shutting down Offline POS Backend...")
