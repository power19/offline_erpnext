# API Routes
from fastapi import APIRouter
from app.api.routes import items, invoices, inventory, sync, customers, auth, pos_session

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(items.router, prefix="/items", tags=["Items"])
api_router.include_router(invoices.router, prefix="/invoices", tags=["POS Invoices"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
api_router.include_router(sync.router, prefix="/sync", tags=["Sync"])
api_router.include_router(customers.router, prefix="/customers", tags=["Customers"])
api_router.include_router(pos_session.router, prefix="/pos-session", tags=["POS Session"])
