from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
import logging

from app.core.erpnext_client import ERPNextClient, get_erpnext_client
from app.schemas.inventory import (
    StockBalance, StockBalanceByWarehouse, Warehouse,
    StockEntry, StockEntryCreate, StockTransfer, StockReceipt,
    StockEntryType
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/warehouses", response_model=List[Warehouse])
async def get_warehouses(
    company: Optional[str] = Query(None),
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Get list of warehouses."""
    try:
        warehouses = client.get_warehouses(company=company)
        return [Warehouse(**w) for w in warehouses]
    except Exception as e:
        logger.error(f"Error fetching warehouses: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stock", response_model=List[StockBalance])
async def get_stock_balance(
    item_code: Optional[str] = Query(None),
    warehouse: Optional[str] = Query(None),
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Get stock balance for items.
    Can filter by item_code and/or warehouse.
    """
    try:
        stock = client.get_stock_balance(item_code=item_code, warehouse=warehouse)

        result = []
        for s in stock:
            balance = StockBalance(
                item_code=s.get("item_code"),
                warehouse=s.get("warehouse"),
                actual_qty=s.get("actual_qty", 0),
                reserved_qty=s.get("reserved_qty", 0),
                projected_qty=s.get("projected_qty", 0)
            )
            balance.available_qty = balance.calculate_available()
            result.append(balance)

        return result
    except Exception as e:
        logger.error(f"Error fetching stock balance: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stock/{item_code}", response_model=StockBalanceByWarehouse)
async def get_item_stock_all_warehouses(
    item_code: str,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Get stock for an item across all warehouses."""
    try:
        # Get item name
        item = client.get_doc("Item", item_code)
        item_name = item.get("data", {}).get("item_name")

        # Get stock across all warehouses
        stock = client.get_stock_balance(item_code=item_code)

        warehouses = []
        total_qty = 0

        for s in stock:
            balance = StockBalance(
                item_code=s.get("item_code"),
                item_name=item_name,
                warehouse=s.get("warehouse"),
                actual_qty=s.get("actual_qty", 0),
                reserved_qty=s.get("reserved_qty", 0),
                projected_qty=s.get("projected_qty", 0)
            )
            balance.available_qty = balance.calculate_available()
            total_qty += balance.actual_qty
            warehouses.append(balance)

        return StockBalanceByWarehouse(
            item_code=item_code,
            item_name=item_name,
            warehouses=warehouses,
            total_qty=total_qty
        )
    except Exception as e:
        logger.error(f"Error fetching stock for {item_code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/stock/check")
async def check_stock_multiple(
    item_codes: List[str],
    warehouse: Optional[str] = Query(None),
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Check stock for multiple items at once.
    Useful for validating cart before checkout.
    """
    try:
        results = {}
        for item_code in item_codes:
            stock = client.get_stock_balance(item_code=item_code, warehouse=warehouse)
            if stock:
                s = stock[0]
                results[item_code] = {
                    "available_qty": s.get("actual_qty", 0) - s.get("reserved_qty", 0),
                    "actual_qty": s.get("actual_qty", 0),
                    "warehouse": s.get("warehouse")
                }
            else:
                results[item_code] = {
                    "available_qty": 0,
                    "actual_qty": 0,
                    "warehouse": warehouse
                }

        return results
    except Exception as e:
        logger.error(f"Error checking stock: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transfer", response_model=dict)
async def transfer_stock(
    transfer: StockTransfer,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Transfer stock from one warehouse to another.
    Creates a Material Transfer stock entry.
    """
    try:
        if transfer.from_warehouse == transfer.to_warehouse:
            raise HTTPException(
                status_code=400,
                detail="Source and target warehouse cannot be the same"
            )

        items = [{
            "item_code": transfer.item_code,
            "qty": transfer.qty,
            "s_warehouse": transfer.from_warehouse,
            "t_warehouse": transfer.to_warehouse
        }]

        result = client.create_stock_entry(
            stock_entry_type="Material Transfer",
            items=items,
            from_warehouse=transfer.from_warehouse,
            to_warehouse=transfer.to_warehouse,
            remarks=transfer.remarks or f"Transfer via Offline POS"
        )

        return {
            "success": True,
            "name": result.get("data", {}).get("name"),
            "offline_id": transfer.offline_id,
            "message": f"Transferred {transfer.qty} units from {transfer.from_warehouse} to {transfer.to_warehouse}"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error transferring stock: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/receive", response_model=dict)
async def receive_stock(
    receipt: StockReceipt,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Add stock to inventory.
    Creates a Material Receipt stock entry.
    """
    try:
        items = [{
            "item_code": receipt.item_code,
            "qty": receipt.qty,
            "t_warehouse": receipt.warehouse,
            "basic_rate": receipt.rate
        }]

        result = client.create_stock_entry(
            stock_entry_type="Material Receipt",
            items=items,
            to_warehouse=receipt.warehouse,
            remarks=receipt.remarks or f"Stock receipt via Offline POS"
        )

        return {
            "success": True,
            "name": result.get("data", {}).get("name"),
            "offline_id": receipt.offline_id,
            "message": f"Added {receipt.qty} units to {receipt.warehouse}"
        }
    except Exception as e:
        logger.error(f"Error receiving stock: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/entry", response_model=dict)
async def create_stock_entry(
    entry: StockEntryCreate,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Create a generic stock entry.
    Supports Material Receipt, Material Issue, and Material Transfer.
    """
    try:
        items = []
        for item in entry.items:
            item_data = {
                "item_code": item.item_code,
                "qty": item.qty,
                "uom": item.uom
            }
            if item.s_warehouse:
                item_data["s_warehouse"] = item.s_warehouse
            if item.t_warehouse:
                item_data["t_warehouse"] = item.t_warehouse
            if item.basic_rate:
                item_data["basic_rate"] = item.basic_rate
            items.append(item_data)

        result = client.create_stock_entry(
            stock_entry_type=entry.stock_entry_type.value,
            items=items,
            from_warehouse=entry.from_warehouse,
            to_warehouse=entry.to_warehouse,
            remarks=entry.remarks
        )

        return {
            "success": True,
            "name": result.get("data", {}).get("name"),
            "offline_id": entry.offline_id,
            "message": f"Stock entry created successfully"
        }
    except Exception as e:
        logger.error(f"Error creating stock entry: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/low-stock")
async def get_low_stock_items(
    warehouse: Optional[str] = Query(None),
    threshold: float = Query(10, description="Minimum stock threshold"),
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Get items with stock below threshold."""
    try:
        # Get all stock balances
        stock = client.get_stock_balance(warehouse=warehouse)

        low_stock = [
            {
                "item_code": s.get("item_code"),
                "warehouse": s.get("warehouse"),
                "actual_qty": s.get("actual_qty", 0),
                "available_qty": s.get("actual_qty", 0) - s.get("reserved_qty", 0)
            }
            for s in stock
            if s.get("actual_qty", 0) < threshold
        ]

        return sorted(low_stock, key=lambda x: x["actual_qty"])
    except Exception as e:
        logger.error(f"Error fetching low stock items: {e}")
        raise HTTPException(status_code=500, detail=str(e))
