from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from datetime import date
import logging

from app.core.erpnext_client import ERPNextClient, get_erpnext_client
from app.schemas.invoices import (
    POSInvoice, POSInvoiceCreate, POSInvoiceListItem,
    POSReturn, POSReturnCreate, InvoiceSearchParams
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("", response_model=List[POSInvoiceListItem])
async def get_invoices(
    customer: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    limit: int = Query(50, le=200),
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Get list of POS invoices."""
    try:
        invoices = client.get_pos_invoices(
            customer=customer,
            from_date=from_date.isoformat() if from_date else None,
            to_date=to_date.isoformat() if to_date else None,
            limit=limit
        )
        return invoices
    except Exception as e:
        logger.error(f"Error fetching invoices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_invoices(
    q: str = Query(..., min_length=1, description="Search query"),
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Search invoices by invoice number or customer name.
    Useful for returns - find the original invoice quickly.
    """
    try:
        # Search by invoice name
        invoices_by_name = client.get_list(
            "POS Invoice",
            fields=[
                "name", "customer", "customer_name", "posting_date",
                "grand_total", "paid_amount", "status", "docstatus", "is_return"
            ],
            filters={
                "name": ["like", f"%{q}%"],
                "docstatus": 1,  # Only submitted
                "is_return": 0  # Not returns
            },
            limit_page_length=20
        )

        # Search by customer name
        invoices_by_customer = client.get_list(
            "POS Invoice",
            fields=[
                "name", "customer", "customer_name", "posting_date",
                "grand_total", "paid_amount", "status", "docstatus", "is_return"
            ],
            filters={
                "customer_name": ["like", f"%{q}%"],
                "docstatus": 1,
                "is_return": 0
            },
            limit_page_length=20
        )

        # Combine and deduplicate
        seen = set()
        results = []
        for inv in invoices_by_name + invoices_by_customer:
            if inv["name"] not in seen:
                seen.add(inv["name"])
                results.append(inv)

        return results[:20]
    except Exception as e:
        logger.error(f"Error searching invoices: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{invoice_name}", response_model=POSInvoice)
async def get_invoice(
    invoice_name: str,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Get single invoice with full details."""
    try:
        result = client.get_doc("POS Invoice", invoice_name)
        invoice_data = result.get("data", {})

        if not invoice_data:
            raise HTTPException(status_code=404, detail="Invoice not found")

        return POSInvoice(**invoice_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching invoice {invoice_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=dict)
async def create_invoice(
    invoice: POSInvoiceCreate,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Create a new POS Invoice.
    Supports both online creation and syncing offline invoices.
    """
    try:
        # Prepare items
        items = []
        for item in invoice.items:
            item_data = {
                "item_code": item.item_code,
                "qty": item.qty,
                "rate": item.rate,
                "uom": item.uom
            }
            if item.discount_percentage > 0:
                item_data["discount_percentage"] = item.discount_percentage
            if item.discount_amount > 0:
                item_data["discount_amount"] = item.discount_amount
            if item.warehouse:
                item_data["warehouse"] = item.warehouse
            items.append(item_data)

        # Prepare payments
        payments = [
            {"mode_of_payment": p.mode_of_payment, "amount": p.amount}
            for p in invoice.payments
        ]

        result = client.create_pos_invoice(
            customer=invoice.customer,
            items=items,
            payments=payments,
            discount_amount=invoice.discount_amount,
            additional_discount_percentage=invoice.additional_discount_percentage,
            pos_profile=invoice.pos_profile
        )

        return {
            "success": True,
            "name": result.get("data", {}).get("name"),
            "offline_id": invoice.offline_id,
            "message": "Invoice created successfully"
        }
    except Exception as e:
        logger.error(f"Error creating invoice: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/return", response_model=dict)
async def create_return(
    return_data: POSReturnCreate,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Create a return against an existing POS Invoice.
    This creates a new POS Invoice with is_return=1.
    """
    try:
        # Validate original invoice exists
        original = client.get_doc("POS Invoice", return_data.original_invoice)
        original_data = original.get("data", {})

        if not original_data:
            raise HTTPException(status_code=404, detail="Original invoice not found")

        if original_data.get("docstatus") != 1:
            raise HTTPException(
                status_code=400,
                detail="Can only return against submitted invoices"
            )

        # Prepare return items (quantities should be negative)
        items = []
        for item in return_data.items:
            items.append({
                "item_code": item.item_code,
                "qty": -abs(item.qty),  # Ensure negative
                "rate": item.rate
            })

        # Prepare payments (amounts should be negative for refund)
        payments = [
            {"mode_of_payment": p.mode_of_payment, "amount": -abs(p.amount)}
            for p in return_data.payments
        ]

        result = client.create_pos_return(
            original_invoice=return_data.original_invoice,
            items=items,
            payments=payments
        )

        return {
            "success": True,
            "name": result.get("data", {}).get("name"),
            "offline_id": return_data.offline_id,
            "return_against": return_data.original_invoice,
            "message": "Return created successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating return: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{invoice_name}/returns")
async def get_invoice_returns(
    invoice_name: str,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Get all returns made against an invoice."""
    try:
        returns = client.get_list(
            "POS Invoice",
            fields=[
                "name", "posting_date", "grand_total",
                "status", "docstatus"
            ],
            filters={
                "return_against": invoice_name,
                "is_return": 1
            },
            limit_page_length=50
        )
        return returns
    except Exception as e:
        logger.error(f"Error fetching returns for {invoice_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{invoice_name}/returnable-items")
async def get_returnable_items(
    invoice_name: str,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Get items that can still be returned from an invoice.
    Calculates remaining quantity after existing returns.
    """
    try:
        # Get original invoice
        original = client.get_doc("POS Invoice", invoice_name)
        original_data = original.get("data", {})

        if not original_data:
            raise HTTPException(status_code=404, detail="Invoice not found")

        original_items = {
            item["item_code"]: {
                "item_code": item["item_code"],
                "item_name": item.get("item_name"),
                "original_qty": item["qty"],
                "rate": item["rate"],
                "returned_qty": 0,
                "returnable_qty": item["qty"]
            }
            for item in original_data.get("items", [])
        }

        # Get existing returns
        returns = client.get_list(
            "POS Invoice",
            filters={
                "return_against": invoice_name,
                "is_return": 1,
                "docstatus": 1
            },
            limit_page_length=50
        )

        # Sum up returned quantities
        for ret in returns:
            ret_doc = client.get_doc("POS Invoice", ret["name"])
            for item in ret_doc.get("data", {}).get("items", []):
                if item["item_code"] in original_items:
                    # Return qty is negative, so we subtract (add absolute value)
                    original_items[item["item_code"]]["returned_qty"] += abs(item["qty"])
                    original_items[item["item_code"]]["returnable_qty"] -= abs(item["qty"])

        # Filter to only items with remaining returnable quantity
        returnable = [
            item for item in original_items.values()
            if item["returnable_qty"] > 0
        ]

        return {
            "invoice": invoice_name,
            "customer": original_data.get("customer"),
            "customer_name": original_data.get("customer_name"),
            "posting_date": original_data.get("posting_date"),
            "items": returnable
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting returnable items: {e}")
        raise HTTPException(status_code=500, detail=str(e))
