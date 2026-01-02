from fastapi import APIRouter, HTTPException, Query, Depends
from typing import List, Optional
from pydantic import BaseModel
import logging

from app.core.erpnext_client import ERPNextClient, get_erpnext_client

router = APIRouter()
logger = logging.getLogger(__name__)


class Customer(BaseModel):
    name: str
    customer_name: str
    customer_group: Optional[str] = None
    territory: Optional[str] = None
    mobile_no: Optional[str] = None
    email_id: Optional[str] = None


class CustomerCreate(BaseModel):
    customer_name: str
    mobile_no: Optional[str] = None
    email_id: Optional[str] = None
    customer_group: Optional[str] = None


@router.get("", response_model=List[Customer])
async def get_customers(
    search: Optional[str] = Query(None, description="Search by name or mobile"),
    limit: int = Query(50, le=200),
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Get list of customers."""
    try:
        customers = client.get_customers(search=search, limit=limit)
        return [Customer(**c) for c in customers]
    except Exception as e:
        logger.error(f"Error fetching customers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search")
async def search_customers(
    q: str = Query(..., min_length=1),
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Search customers by name, mobile, or email.
    Returns matching customers quickly for autocomplete.
    """
    try:
        # Search by name
        by_name = client.get_list(
            "Customer",
            fields=["name", "customer_name", "mobile_no", "email_id"],
            filters={"customer_name": ["like", f"%{q}%"], "disabled": 0},
            limit_page_length=10
        )

        # Search by mobile
        by_mobile = client.get_list(
            "Customer",
            fields=["name", "customer_name", "mobile_no", "email_id"],
            filters={"mobile_no": ["like", f"%{q}%"], "disabled": 0},
            limit_page_length=10
        )

        # Combine and deduplicate
        seen = set()
        results = []
        for c in by_name + by_mobile:
            if c["name"] not in seen:
                seen.add(c["name"])
                results.append(c)

        return results[:15]
    except Exception as e:
        logger.error(f"Error searching customers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{customer_id}", response_model=Customer)
async def get_customer(
    customer_id: str,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Get single customer details."""
    try:
        result = client.get_doc("Customer", customer_id)
        customer_data = result.get("data", {})

        if not customer_data:
            raise HTTPException(status_code=404, detail="Customer not found")

        return Customer(**customer_data)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching customer {customer_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("", response_model=dict)
async def create_customer(
    customer: CustomerCreate,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Create a new customer."""
    try:
        result = client.create_customer(
            customer_name=customer.customer_name,
            mobile_no=customer.mobile_no,
            email=customer.email_id
        )

        return {
            "success": True,
            "name": result.get("data", {}).get("name"),
            "message": "Customer created successfully"
        }
    except Exception as e:
        logger.error(f"Error creating customer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{customer_id}/invoices")
async def get_customer_invoices(
    customer_id: str,
    limit: int = Query(20, le=100),
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Get recent invoices for a customer."""
    try:
        invoices = client.get_list(
            "POS Invoice",
            fields=[
                "name", "posting_date", "grand_total",
                "paid_amount", "status", "docstatus"
            ],
            filters={"customer": customer_id, "docstatus": ["!=", 2]},
            limit_page_length=limit,
            order_by="posting_date desc"
        )
        return invoices
    except Exception as e:
        logger.error(f"Error fetching customer invoices: {e}")
        raise HTTPException(status_code=500, detail=str(e))
