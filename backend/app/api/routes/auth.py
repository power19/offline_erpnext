from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import requests
import logging

from app.core.config import runtime_config
from app.core.erpnext_client import ERPNextClient, get_erpnext_client

router = APIRouter()
logger = logging.getLogger(__name__)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserInfo(BaseModel):
    username: str
    full_name: str
    email: Optional[str] = None
    role: str  # "Admin" or "Staff"
    pos_profiles: List[Dict[str, Any]] = []
    allowed_warehouses: List[str] = []


class LoginResponse(BaseModel):
    success: bool
    user: Optional[UserInfo] = None
    message: Optional[str] = None


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Authenticate user against ERPNext and return their allowed POS profiles.
    """
    if not runtime_config.erpnext_url:
        raise HTTPException(status_code=400, detail="ERPNext not configured")

    try:
        # Authenticate with ERPNext
        session = requests.Session()
        login_response = session.post(
            f"{runtime_config.erpnext_url}/api/method/login",
            data={
                "usr": request.username,
                "pwd": request.password
            }
        )

        if login_response.status_code != 200:
            return LoginResponse(
                success=False,
                message="Invalid username or password"
            )

        login_data = login_response.json()
        if login_data.get("message") == "Logged In":
            # Get user details
            user_response = session.get(
                f"{runtime_config.erpnext_url}/api/method/frappe.auth.get_logged_user"
            )
            logged_user = user_response.json().get("message", request.username)

            # Get user's full details using admin API
            client = ERPNextClient(
                runtime_config.erpnext_url,
                runtime_config.erpnext_api_key,
                runtime_config.erpnext_api_secret
            )

            # Get user document
            try:
                user_doc = client.get_doc("User", logged_user)
                full_name = user_doc.get("full_name", logged_user)
                email = user_doc.get("email", "")
            except:
                full_name = logged_user
                email = ""

            # Check if user has System Manager role (Admin)
            is_admin = False
            try:
                user_roles = client.get_list(
                    "Has Role",
                    fields=["role"],
                    filters={"parent": logged_user, "parenttype": "User"}
                )
                role_names = [r.get("role") for r in user_roles]
                is_admin = "System Manager" in role_names or "Administrator" in role_names
            except Exception as e:
                logger.warning(f"Could not fetch user roles: {e}")

            # Get POS Profiles assigned to this user
            pos_profiles = []
            allowed_warehouses = []
            try:
                # Get POS Profiles where this user is listed
                all_profiles = client.get_list(
                    "POS Profile",
                    fields=["name", "warehouse", "company", "disabled"],
                    filters={"disabled": 0}
                )

                for profile in all_profiles:
                    # Check if user is assigned to this profile
                    profile_users = client.get_list(
                        "POS Profile User",
                        fields=["user", "default"],
                        filters={"parent": profile["name"], "parenttype": "POS Profile"}
                    )

                    user_in_profile = any(
                        pu.get("user") == logged_user for pu in profile_users
                    )

                    # Admin sees all profiles, staff only sees assigned ones
                    if is_admin or user_in_profile:
                        pos_profiles.append({
                            "name": profile["name"],
                            "warehouse": profile.get("warehouse"),
                            "company": profile.get("company"),
                            "is_default": any(
                                pu.get("user") == logged_user and pu.get("default")
                                for pu in profile_users
                            )
                        })
                        if profile.get("warehouse"):
                            allowed_warehouses.append(profile["warehouse"])

            except Exception as e:
                logger.warning(f"Could not fetch POS profiles: {e}")
                # If we can't fetch profiles, admin gets access, staff gets none
                if is_admin:
                    try:
                        all_profiles = client.get_list(
                            "POS Profile",
                            fields=["name", "warehouse", "company"],
                            filters={"disabled": 0}
                        )
                        pos_profiles = all_profiles
                        allowed_warehouses = [p.get("warehouse") for p in all_profiles if p.get("warehouse")]
                    except:
                        pass

            # Remove duplicates from warehouses
            allowed_warehouses = list(set(allowed_warehouses))

            return LoginResponse(
                success=True,
                user=UserInfo(
                    username=logged_user,
                    full_name=full_name,
                    email=email,
                    role="Admin" if is_admin else "Staff",
                    pos_profiles=pos_profiles,
                    allowed_warehouses=allowed_warehouses
                )
            )
        else:
            return LoginResponse(
                success=False,
                message="Invalid username or password"
            )

    except requests.exceptions.RequestException as e:
        logger.error(f"Login request failed: {e}")
        return LoginResponse(
            success=False,
            message="Could not connect to ERPNext server"
        )
    except Exception as e:
        logger.error(f"Login error: {e}")
        return LoginResponse(
            success=False,
            message=str(e)
        )


@router.get("/me")
async def get_current_user():
    """
    Get current user info from session.
    Note: This is a placeholder - actual session management should be implemented.
    """
    return {"message": "Use local storage for session management"}


@router.post("/logout")
async def logout():
    """
    Logout - client should clear local session.
    """
    return {"success": True, "message": "Logged out"}
