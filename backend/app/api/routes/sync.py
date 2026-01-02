from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
import logging

from app.core.erpnext_client import ERPNextClient, get_erpnext_client
from app.schemas.sync import (
    SyncRequest, SyncResponse, SyncResultItem, SyncStatus,
    PullRequest, PullResponse, SyncAction
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/push", response_model=SyncResponse)
async def push_offline_data(
    request: SyncRequest,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Push offline data to ERPNext.
    Handles creation of invoices, returns, and stock entries made offline.
    """
    results = []
    synced_count = 0
    failed_count = 0

    for item in request.items:
        try:
            result = None

            if item.doctype == "POS Invoice":
                if item.action == SyncAction.CREATE:
                    if item.data.get("is_return"):
                        # Create return
                        result = client.create_pos_return(
                            original_invoice=item.data.get("return_against"),
                            items=item.data.get("items", []),
                            payments=item.data.get("payments", [])
                        )
                    else:
                        # Create regular invoice
                        result = client.create_pos_invoice(
                            customer=item.data.get("customer"),
                            items=item.data.get("items", []),
                            payments=item.data.get("payments", []),
                            discount_amount=item.data.get("discount_amount", 0),
                            additional_discount_percentage=item.data.get("additional_discount_percentage", 0)
                        )

            elif item.doctype == "Stock Entry":
                if item.action == SyncAction.CREATE:
                    result = client.create_stock_entry(
                        stock_entry_type=item.data.get("stock_entry_type"),
                        items=item.data.get("items", []),
                        from_warehouse=item.data.get("from_warehouse"),
                        to_warehouse=item.data.get("to_warehouse"),
                        remarks=item.data.get("remarks")
                    )

            elif item.doctype == "Customer":
                if item.action == SyncAction.CREATE:
                    result = client.create_customer(
                        customer_name=item.data.get("customer_name"),
                        mobile_no=item.data.get("mobile_no"),
                        email=item.data.get("email_id")
                    )

            if result:
                erpnext_name = result.get("data", {}).get("name")
                results.append(SyncResultItem(
                    offline_id=item.offline_id,
                    status=SyncStatus.COMPLETED,
                    erpnext_name=erpnext_name
                ))
                synced_count += 1
            else:
                results.append(SyncResultItem(
                    offline_id=item.offline_id,
                    status=SyncStatus.FAILED,
                    error="Unknown doctype or action"
                ))
                failed_count += 1

        except Exception as e:
            logger.error(f"Error syncing item {item.offline_id}: {e}")
            results.append(SyncResultItem(
                offline_id=item.offline_id,
                status=SyncStatus.FAILED,
                error=str(e)
            ))
            failed_count += 1

    return SyncResponse(
        success=failed_count == 0,
        synced_count=synced_count,
        failed_count=failed_count,
        results=results,
        server_time=datetime.utcnow()
    )


@router.post("/pull", response_model=PullResponse)
async def pull_data(
    request: PullRequest,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Pull latest data from ERPNext for offline storage.
    Includes items, customers, warehouses, and settings.
    """
    try:
        response = PullResponse(
            last_modified=datetime.utcnow(),
            has_more=False
        )

        # Fetch items
        if "Item" in request.doctypes:
            items = client.get_items(limit=request.limit)
            response.items = items

        # Fetch customers
        if "Customer" in request.doctypes:
            customers = client.get_customers(limit=request.limit)
            response.customers = customers

        # Fetch warehouses
        if "Warehouse" in request.doctypes:
            warehouses = client.get_warehouses()
            response.warehouses = warehouses

        # Fetch POS profiles
        if "POS Profile" in request.doctypes:
            pos_profiles = client.get_pos_profiles()
            response.pos_profiles = pos_profiles

        # Fetch payment methods
        if "Mode of Payment" in request.doctypes:
            payment_methods = client.get_payment_methods()
            response.payment_methods = payment_methods

        return response

    except Exception as e:
        logger.error(f"Error pulling data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_sync_status(
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Check connection status and get server time.
    Useful for determining if online/offline.
    """
    try:
        # Try a simple API call to check connection
        client.get_list("Company", limit_page_length=1)

        return {
            "online": True,
            "server_time": datetime.utcnow().isoformat(),
            "erpnext_url": client.base_url
        }
    except Exception as e:
        return {
            "online": False,
            "error": str(e),
            "server_time": datetime.utcnow().isoformat()
        }


@router.get("/changes")
async def get_changes_since(
    since: datetime,
    doctypes: Optional[str] = "Item,Customer",
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """
    Get documents modified since a given datetime.
    Used for incremental sync.
    """
    try:
        doctype_list = [d.strip() for d in doctypes.split(",")]
        changes = {}

        since_str = since.strftime("%Y-%m-%d %H:%M:%S")

        for doctype in doctype_list:
            try:
                modified = client.get_modified_docs(doctype, since_str)
                changes[doctype] = modified
            except Exception as e:
                logger.warning(f"Could not fetch changes for {doctype}: {e}")
                changes[doctype] = []

        return {
            "since": since.isoformat(),
            "changes": changes,
            "server_time": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching changes: {e}")
        raise HTTPException(status_code=500, detail=str(e))
