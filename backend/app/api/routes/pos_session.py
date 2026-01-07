"""
POS Session Management Routes - Open and Close POS
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import logging

from app.core.erpnext_client import ERPNextClient, get_erpnext_client

router = APIRouter()
logger = logging.getLogger(__name__)


class OpeningBalance(BaseModel):
    mode_of_payment: str
    opening_amount: float = 0


class OpenPOSRequest(BaseModel):
    pos_profile: str
    user: str
    company: str
    balance_details: List[OpeningBalance] = []


class ClosingBalance(BaseModel):
    mode_of_payment: str
    expected_amount: float
    closing_amount: float


class ClosePOSRequest(BaseModel):
    pos_opening_entry: str
    closing_amounts: List[ClosingBalance] = []


@router.get("/status")
async def get_session_status(
    pos_profile: str,
    user: Optional[str] = None,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Check if there's an open POS session for this profile."""
    try:
        session = client.get_open_pos_session(pos_profile, user)
        if session:
            return {
                "is_open": True,
                "session": session
            }
        return {
            "is_open": False,
            "session": None
        }
    except Exception as e:
        logger.error(f"Error checking POS session status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/open")
async def open_pos_session(
    request: OpenPOSRequest,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Open a new POS session (create POS Opening Entry)."""
    try:
        # Check if there's already an open session
        existing = client.get_open_pos_session(request.pos_profile, request.user)
        if existing:
            return {
                "success": True,
                "message": "POS session already open",
                "session": existing,
                "already_open": True
            }

        # Prepare balance details
        balance_details = []
        for balance in request.balance_details:
            balance_details.append({
                "mode_of_payment": balance.mode_of_payment,
                "opening_amount": balance.opening_amount
            })

        # If no balance details provided, add Cash with 0
        if not balance_details:
            balance_details.append({
                "mode_of_payment": "Cash",
                "opening_amount": 0
            })

        result = client.create_pos_opening_entry(
            pos_profile=request.pos_profile,
            user=request.user,
            company=request.company,
            balance_details=balance_details
        )

        session_name = result.get("data", {}).get("name")

        return {
            "success": True,
            "message": "POS session opened successfully",
            "session": {
                "name": session_name,
                "pos_profile": request.pos_profile,
                "user": request.user,
                "status": "Open"
            },
            "already_open": False
        }
    except Exception as e:
        logger.error(f"Error opening POS session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/close")
async def close_pos_session(
    request: ClosePOSRequest,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Close a POS session (create POS Closing Entry)."""
    try:
        # Get opening entry details
        opening = client.get_doc("POS Opening Entry", request.pos_opening_entry)
        opening_data = opening.get("data", {})

        if not opening_data:
            raise HTTPException(status_code=404, detail="POS Opening Entry not found")

        if opening_data.get("status") != "Open":
            raise HTTPException(status_code=400, detail="POS session is not open")

        pos_profile = opening_data.get("pos_profile")
        user = opening_data.get("user")
        company = opening_data.get("company")

        # Get invoices and payment totals for this session
        invoices = client.get_pos_session_invoices(request.pos_opening_entry)
        payment_summary = client.get_pos_session_payments(request.pos_opening_entry)

        # Prepare payment reconciliation
        payment_reconciliation = []
        if request.closing_amounts:
            # Use provided closing amounts
            for closing in request.closing_amounts:
                payment_reconciliation.append({
                    "mode_of_payment": closing.mode_of_payment,
                    "expected_amount": closing.expected_amount,
                    "closing_amount": closing.closing_amount,
                    "difference": closing.closing_amount - closing.expected_amount
                })
        else:
            # Use calculated amounts
            for payment in payment_summary:
                payment_reconciliation.append({
                    "mode_of_payment": payment["mode_of_payment"],
                    "expected_amount": payment["expected_amount"],
                    "closing_amount": payment["closing_amount"],
                    "difference": 0
                })

        # If no payments, add Cash with 0
        if not payment_reconciliation:
            payment_reconciliation.append({
                "mode_of_payment": "Cash",
                "expected_amount": 0,
                "closing_amount": 0,
                "difference": 0
            })

        # Prepare invoice list for POS transactions
        pos_transactions = [
            {"pos_invoice": inv["name"], "grand_total": inv["grand_total"]}
            for inv in invoices
        ]

        now = datetime.now()
        result = client.create_pos_closing_entry(
            pos_opening_entry=request.pos_opening_entry,
            pos_profile=pos_profile,
            user=user,
            company=company,
            posting_date=now.strftime("%Y-%m-%d"),
            period_end_date=now.strftime("%Y-%m-%d %H:%M:%S"),
            payment_reconciliation=payment_reconciliation,
            invoices=pos_transactions
        )

        closing_name = result.get("data", {}).get("name")

        return {
            "success": True,
            "message": "POS session closed successfully",
            "closing_entry": closing_name,
            "summary": {
                "total_invoices": len(invoices),
                "payments": payment_reconciliation
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error closing POS session: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary/{pos_opening_entry}")
async def get_session_summary(
    pos_opening_entry: str,
    client: ERPNextClient = Depends(get_erpnext_client)
):
    """Get summary of a POS session (invoices and payments)."""
    try:
        invoices = client.get_pos_session_invoices(pos_opening_entry)
        payments = client.get_pos_session_payments(pos_opening_entry)

        total_sales = sum(inv.get("grand_total", 0) for inv in invoices)

        return {
            "pos_opening_entry": pos_opening_entry,
            "total_invoices": len(invoices),
            "total_sales": total_sales,
            "invoices": invoices,
            "payments": payments
        }
    except Exception as e:
        logger.error(f"Error getting session summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))
