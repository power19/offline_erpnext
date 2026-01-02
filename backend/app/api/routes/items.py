from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
import logging

from app.core.erpnext_client import ERPNextClient, get_erpnext_client
from app.schemas.items import Item, ItemWithPrice, ItemResponse

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=List[Item])
async def get_items(
    search: Optional[str] = Query(None, description="Search by item name or code"),
    item_group: Optional[str] = Query(None, description="Filter by item group"),
    limit: int = Query(50, le=200),
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Get list of items for POS.
    Items are filtered to only show enabled sales items.
    """
    try:
        items = client.get_items(search=search, item_group=item_group, limit=limit)
        return [Item(**item) for item in items]
    except Exception as e:
        logger.error(f"Error fetching items: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{item_code}", response_model=ItemWithPrice)
async def get_item(
    item_code: str,
    warehouse: Optional[str] = Query(None, description="Warehouse to check stock"),
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Get single item with price and stock information.
    """
    try:
        # Get item details
        result = client.get_doc("Item", item_code)
        item_data = result.get("data", {})

        if not item_data:
            raise HTTPException(status_code=404, detail="Item not found")

        # Get price
        price = client.get_item_price(item_code)

        # Get stock if warehouse specified
        available_qty = None
        if warehouse:
            stock = client.get_stock_balance(item_code=item_code, warehouse=warehouse)
            if stock:
                available_qty = stock[0].get("actual_qty", 0) - stock[0].get("reserved_qty", 0)

        return ItemWithPrice(
            **item_data,
            price=price or item_data.get("standard_rate", 0),
            available_qty=available_qty
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching item {item_code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/groups/list")
async def get_item_groups(
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Get list of item groups for filtering."""
    try:
        groups = client.get_list(
            "Item Group",
            fields=["name", "parent_item_group", "image"],
            filters={"is_group": 0},
            limit_page_length=100
        )
        return groups
    except Exception as e:
        logger.error(f"Error fetching item groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/barcode/{barcode}")
async def get_item_by_barcode(
    barcode: str,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Get item by barcode scan.
    Searches in Item Barcode child table.
    """
    try:
        # Search for barcode in Item Barcode
        barcodes = client.get_list(
            "Item Barcode",
            fields=["parent", "barcode"],
            filters={"barcode": barcode},
            limit_page_length=1
        )

        if not barcodes:
            raise HTTPException(status_code=404, detail="Item not found for barcode")

        item_code = barcodes[0].get("parent")

        # Get full item details
        result = client.get_doc("Item", item_code)
        item_data = result.get("data", {})

        # Get price
        price = client.get_item_price(item_code)

        return ItemWithPrice(
            **item_data,
            price=price or item_data.get("standard_rate", 0)
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching item by barcode {barcode}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
