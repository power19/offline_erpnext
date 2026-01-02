from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from enum import Enum


class DiscountType(str, Enum):
    PERCENTAGE = "percentage"
    AMOUNT = "amount"


class POSInvoiceItem(BaseModel):
    item_code: str
    item_name: Optional[str] = None
    qty: float = 1
    rate: float
    amount: Optional[float] = None
    discount_percentage: float = 0
    discount_amount: float = 0
    uom: str = "Nos"
    warehouse: Optional[str] = None

    def calculate_amount(self) -> float:
        base_amount = self.qty * self.rate
        if self.discount_percentage > 0:
            return base_amount * (1 - self.discount_percentage / 100)
        elif self.discount_amount > 0:
            return base_amount - self.discount_amount
        return base_amount


class POSPayment(BaseModel):
    mode_of_payment: str
    amount: float
    account: Optional[str] = None


class POSInvoiceBase(BaseModel):
    customer: str
    customer_name: Optional[str] = None
    items: List[POSInvoiceItem]
    payments: List[POSPayment]
    discount_amount: float = 0
    additional_discount_percentage: float = 0
    pos_profile: Optional[str] = None
    warehouse: Optional[str] = None
    remarks: Optional[str] = None


class POSInvoiceCreate(POSInvoiceBase):
    # Offline-specific fields
    offline_id: Optional[str] = None  # Local ID for syncing
    created_offline: bool = False


class POSInvoice(POSInvoiceBase):
    name: str
    posting_date: date
    posting_time: Optional[str] = None
    grand_total: float
    net_total: float
    paid_amount: float
    outstanding_amount: float = 0
    status: str
    docstatus: int = 0
    is_return: int = 0
    return_against: Optional[str] = None

    class Config:
        from_attributes = True


class POSInvoiceListItem(BaseModel):
    name: str
    customer: str
    customer_name: Optional[str] = None
    posting_date: date
    grand_total: float
    paid_amount: float
    status: str
    docstatus: int


class POSReturnItem(BaseModel):
    item_code: str
    item_name: Optional[str] = None
    qty: float  # Should be negative for returns
    rate: float
    original_qty: Optional[float] = None  # Original qty from invoice


class POSReturnCreate(BaseModel):
    original_invoice: str
    items: List[POSReturnItem]
    payments: List[POSPayment]
    reason: Optional[str] = None
    # Offline-specific
    offline_id: Optional[str] = None
    created_offline: bool = False


class POSReturn(BaseModel):
    name: str
    return_against: str
    customer: str
    customer_name: Optional[str] = None
    posting_date: date
    grand_total: float  # Will be negative
    items: List[POSReturnItem]
    status: str

    class Config:
        from_attributes = True


class InvoiceSearchParams(BaseModel):
    search: Optional[str] = None  # Search by invoice name or customer
    customer: Optional[str] = None
    from_date: Optional[date] = None
    to_date: Optional[date] = None
    include_returns: bool = False
    limit: int = 50
