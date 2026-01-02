from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class ItemBase(BaseModel):
    item_code: str
    item_name: str
    item_group: Optional[str] = None
    stock_uom: str = "Nos"
    description: Optional[str] = None
    image: Optional[str] = None


class ItemCreate(ItemBase):
    standard_rate: float = 0


class Item(ItemBase):
    name: str
    standard_rate: float = 0
    has_variants: int = 0
    variant_of: Optional[str] = None
    current_stock: Optional[float] = None

    class Config:
        from_attributes = True


class ItemPrice(BaseModel):
    item_code: str
    price_list: str
    price_list_rate: float
    currency: str = "USD"


class ItemWithPrice(Item):
    price: Optional[float] = None
    available_qty: Optional[float] = None


class ItemResponse(BaseModel):
    items: List[Item]
    total: int = 0
