"""
ERPNext API Client for interacting with ERPNext backend.
"""
import requests
import json
from typing import Any, Dict, List, Optional
import logging

from app.core.config import settings, runtime_config

logger = logging.getLogger(__name__)


class ERPNextClient:
    """Client for ERPNext REST API interactions."""

    def __init__(self):
        self.session = requests.Session()

    def _get_base_url(self) -> str:
        """Get base URL from runtime config."""
        return runtime_config.erpnext_url.rstrip("/") if runtime_config.erpnext_url else ""

    def _get_headers(self) -> Dict[str, str]:
        """Get auth headers from runtime config."""
        headers = {}
        if runtime_config.erpnext_api_key and runtime_config.erpnext_api_secret:
            headers["Authorization"] = f"token {runtime_config.erpnext_api_key}:{runtime_config.erpnext_api_secret}"
        return headers

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Make HTTP request to ERPNext API."""
        base_url = self._get_base_url()
        if not base_url:
            raise Exception("ERPNext not configured. Please complete setup.")

        url = f"{base_url}{endpoint}"

        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data,
                params=params,
                headers=self._get_headers(),
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"ERPNext API error: {e}")
            raise

    # ========== Document Operations ==========

    def get_doc(self, doctype: str, name: str) -> Dict[str, Any]:
        """Get a single document by name."""
        return self._make_request("GET", f"/api/resource/{doctype}/{name}")

    def get_list(
        self,
        doctype: str,
        fields: Optional[List[str]] = None,
        filters: Optional[Dict] = None,
        limit_start: int = 0,
        limit_page_length: int = 20,
        order_by: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get list of documents."""
        params = {
            "limit_start": limit_start,
            "limit_page_length": limit_page_length
        }

        if fields:
            params["fields"] = json.dumps(fields)
        if filters:
            params["filters"] = json.dumps(filters)
        if order_by:
            params["order_by"] = order_by

        result = self._make_request("GET", f"/api/resource/{doctype}", params=params)
        return result.get("data", [])

    def create_doc(self, doctype: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new document."""
        return self._make_request("POST", f"/api/resource/{doctype}", data=data)

    def update_doc(self, doctype: str, name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Update an existing document."""
        return self._make_request("PUT", f"/api/resource/{doctype}/{name}", data=data)

    def delete_doc(self, doctype: str, name: str) -> Dict[str, Any]:
        """Delete a document."""
        return self._make_request("DELETE", f"/api/resource/{doctype}/{name}")

    # ========== Item Operations ==========

    def get_items(
        self,
        search: Optional[str] = None,
        item_group: Optional[str] = None,
        limit: int = 5000,
        price_list: str = "Standard Selling"
    ) -> List[Dict[str, Any]]:
        """Get items for POS with prices from Item Price doctype."""
        filters = {"disabled": 0, "is_sales_item": 1}

        if item_group:
            filters["item_group"] = item_group

        fields = [
            "name", "item_code", "item_name", "item_group",
            "stock_uom", "image", "description", "standard_rate",
            "has_variants", "variant_of"
        ]

        if search:
            # Search by item_code or item_name
            filters["item_name"] = ["like", f"%{search}%"]

        items = self.get_list("Item", fields=fields, filters=filters, limit_page_length=limit)

        # Fetch all item prices in bulk
        try:
            item_prices = self.get_list(
                "Item Price",
                fields=["item_code", "price_list_rate"],
                filters={"price_list": price_list, "selling": 1},
                limit_page_length=10000
            )
            # Create a lookup dict for prices
            price_map = {p["item_code"]: p["price_list_rate"] for p in item_prices}

            # Merge prices into items
            for item in items:
                item["price_list_rate"] = price_map.get(item["item_code"], item.get("standard_rate", 0))
        except Exception as e:
            logger.warning(f"Could not fetch item prices: {e}")
            # Fallback to standard_rate
            for item in items:
                item["price_list_rate"] = item.get("standard_rate", 0)

        return items

    def get_item_price(self, item_code: str, price_list: str = "Standard Selling") -> Optional[float]:
        """Get item price from price list."""
        try:
            prices = self.get_list(
                "Item Price",
                fields=["price_list_rate"],
                filters={"item_code": item_code, "price_list": price_list, "selling": 1},
                limit_page_length=1
            )
            if prices:
                return prices[0].get("price_list_rate")
        except Exception as e:
            logger.error(f"Error getting item price: {e}")
        return None

    # ========== Inventory Operations ==========

    def get_stock_balance(
        self,
        item_code: Optional[str] = None,
        warehouse: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get stock balance for items."""
        filters = {}
        if item_code:
            filters["item_code"] = item_code
        if warehouse:
            filters["warehouse"] = warehouse

        return self.get_list(
            "Bin",
            fields=["item_code", "warehouse", "actual_qty", "reserved_qty", "projected_qty"],
            filters=filters,
            limit_page_length=1000
        )

    def get_warehouses(self, company: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get list of warehouses."""
        filters = {"disabled": 0, "is_group": 0}
        if company:
            filters["company"] = company

        return self.get_list(
            "Warehouse",
            fields=["name", "warehouse_name", "warehouse_type", "company"],
            filters=filters,
            limit_page_length=100
        )

    def create_stock_entry(
        self,
        stock_entry_type: str,
        items: List[Dict[str, Any]],
        from_warehouse: Optional[str] = None,
        to_warehouse: Optional[str] = None,
        remarks: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a stock entry for material transfer or receipt."""
        data = {
            "doctype": "Stock Entry",
            "stock_entry_type": stock_entry_type,
            "company": settings.default_company,
            "items": items
        }

        if from_warehouse:
            data["from_warehouse"] = from_warehouse
        if to_warehouse:
            data["to_warehouse"] = to_warehouse
        if remarks:
            data["remarks"] = remarks

        return self.create_doc("Stock Entry", data)

    # ========== POS Invoice Operations ==========

    def create_pos_invoice(
        self,
        customer: str,
        items: List[Dict[str, Any]],
        payments: List[Dict[str, Any]],
        discount_amount: float = 0,
        additional_discount_percentage: float = 0,
        taxes: Optional[List[Dict]] = None,
        pos_profile: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a POS Invoice."""
        data = {
            "doctype": "POS Invoice",
            "customer": customer,
            "company": settings.default_company,
            "currency": settings.default_currency,
            "selling_price_list": "Standard Selling",
            "items": items,
            "payments": payments,
            "is_pos": 1,
            "update_stock": 1
        }

        if discount_amount > 0:
            data["discount_amount"] = discount_amount
        if additional_discount_percentage > 0:
            data["additional_discount_percentage"] = additional_discount_percentage
        if taxes:
            data["taxes"] = taxes
        if pos_profile:
            data["pos_profile"] = pos_profile

        return self.create_doc("POS Invoice", data)

    def get_pos_invoices(
        self,
        customer: Optional[str] = None,
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get list of POS invoices."""
        filters = {"docstatus": ["!=", 2]}  # Not cancelled

        if customer:
            filters["customer"] = customer
        if from_date:
            filters["posting_date"] = [">=", from_date]
        if to_date:
            if "posting_date" in filters:
                filters["posting_date"] = ["between", [from_date, to_date]]
            else:
                filters["posting_date"] = ["<=", to_date]

        return self.get_list(
            "POS Invoice",
            fields=[
                "name", "customer", "customer_name", "posting_date",
                "grand_total", "paid_amount", "status", "docstatus"
            ],
            filters=filters,
            limit_page_length=limit,
            order_by="posting_date desc"
        )

    # ========== Return Operations ==========

    def create_pos_return(
        self,
        original_invoice: str,
        items: List[Dict[str, Any]],
        payments: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Create a return POS Invoice."""
        # Get original invoice
        original = self.get_doc("POS Invoice", original_invoice)
        original_data = original.get("data", {})

        data = {
            "doctype": "POS Invoice",
            "customer": original_data.get("customer"),
            "company": original_data.get("company"),
            "currency": original_data.get("currency"),
            "is_pos": 1,
            "is_return": 1,
            "return_against": original_invoice,
            "update_stock": 1,
            "items": items,
            "payments": payments
        }

        return self.create_doc("POS Invoice", data)

    # ========== Customer Operations ==========

    def get_customers(self, search: Optional[str] = None, limit: int = 5000) -> List[Dict[str, Any]]:
        """Get list of customers."""
        filters = {"disabled": 0}

        if search:
            filters["customer_name"] = ["like", f"%{search}%"]

        return self.get_list(
            "Customer",
            fields=["name", "customer_name", "customer_group", "territory", "mobile_no", "email_id"],
            filters=filters,
            limit_page_length=limit
        )

    def create_customer(self, customer_name: str, mobile_no: Optional[str] = None, email: Optional[str] = None) -> Dict[str, Any]:
        """Create a new customer."""
        data = {
            "doctype": "Customer",
            "customer_name": customer_name,
            "customer_type": "Individual"
        }

        if mobile_no:
            data["mobile_no"] = mobile_no
        if email:
            data["email_id"] = email

        return self.create_doc("Customer", data)

    # ========== POS Profile & Settings ==========

    def get_pos_profiles(self) -> List[Dict[str, Any]]:
        """Get available POS profiles."""
        return self.get_list(
            "POS Profile",
            fields=["name", "warehouse", "company", "currency", "selling_price_list"],
            filters={"disabled": 0},
            limit_page_length=20
        )

    def get_payment_methods(self, pos_profile: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get available payment methods."""
        if pos_profile:
            profile = self.get_doc("POS Profile", pos_profile)
            return profile.get("data", {}).get("payments", [])

        return self.get_list(
            "Mode of Payment",
            fields=["name", "type", "enabled"],
            filters={"enabled": 1},
            limit_page_length=20
        )

    # ========== Sync Operations ==========

    def get_modified_docs(
        self,
        doctype: str,
        modified_after: str,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get documents modified after a certain datetime for sync."""
        return self.get_list(
            doctype,
            filters={"modified": [">=", modified_after]},
            limit_page_length=limit,
            order_by="modified asc"
        )


def get_erpnext_client() -> ERPNextClient:
    """Get ERPNext client instance."""
    return ERPNextClient()
