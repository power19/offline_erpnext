from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class StockEntryType(str, Enum):
    MATERIAL_RECEIPT = "Material Receipt"
    MATERIAL_ISSUE = "Material Issue"
    MATERIAL_TRANSFER = "Material Transfer"


class Warehouse(BaseModel):
    name: str
    warehouse_name: str
    warehouse_type: Optional[str] = None
    company: Optional[str] = None

    class Config:
        from_attributes = True


class StockBalance(BaseModel):
    item_code: str
    item_name: Optional[str] = None
    warehouse: str
    actual_qty: float = 0
    reserved_qty: float = 0
    projected_qty: float = 0
    available_qty: Optional[float] = None  # actual_qty - reserved_qty

    def calculate_available(self) -> float:
        return self.actual_qty - self.reserved_qty

    class Config:
        from_attributes = True


class StockBalanceByWarehouse(BaseModel):
    item_code: str
    item_name: Optional[str] = None
    warehouses: List[StockBalance]
    total_qty: float = 0


class StockEntryItem(BaseModel):
    item_code: str
    item_name: Optional[str] = None
    qty: float
    uom: str = "Nos"
    s_warehouse: Optional[str] = None  # Source warehouse
    t_warehouse: Optional[str] = None  # Target warehouse
    basic_rate: Optional[float] = None
    valuation_rate: Optional[float] = None


class StockEntryCreate(BaseModel):
    stock_entry_type: StockEntryType
    items: List[StockEntryItem]
    from_warehouse: Optional[str] = None
    to_warehouse: Optional[str] = None
    remarks: Optional[str] = None
    # Offline-specific
    offline_id: Optional[str] = None
    created_offline: bool = False


class StockEntry(BaseModel):
    name: str
    stock_entry_type: str
    posting_date: str
    posting_time: Optional[str] = None
    from_warehouse: Optional[str] = None
    to_warehouse: Optional[str] = None
    items: List[StockEntryItem]
    docstatus: int = 0
    remarks: Optional[str] = None

    class Config:
        from_attributes = True


class StockTransfer(BaseModel):
    """Simplified stock transfer between warehouses."""
    item_code: str
    qty: float
    from_warehouse: str
    to_warehouse: str
    remarks: Optional[str] = None
    # Offline-specific
    offline_id: Optional[str] = None
    created_offline: bool = False


class StockReceipt(BaseModel):
    """Simplified stock receipt (add to inventory)."""
    item_code: str
    qty: float
    warehouse: str
    rate: Optional[float] = None  # Valuation rate
    remarks: Optional[str] = None
    # Offline-specific
    offline_id: Optional[str] = None
    created_offline: bool = False


class InventoryCheckRequest(BaseModel):
    item_codes: Optional[List[str]] = None
    warehouse: Optional[str] = None
    include_zero_stock: bool = False
