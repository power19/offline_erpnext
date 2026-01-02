from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class SyncStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CONFLICT = "conflict"


class SyncAction(str, Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class SyncItem(BaseModel):
    """A single item to sync."""
    offline_id: str
    doctype: str
    action: SyncAction
    data: Dict[str, Any]
    created_at: datetime
    retry_count: int = 0


class SyncRequest(BaseModel):
    """Request to sync offline data to ERPNext."""
    items: List[SyncItem]
    last_sync: Optional[datetime] = None
    device_id: Optional[str] = None


class SyncResultItem(BaseModel):
    """Result of syncing a single item."""
    offline_id: str
    status: SyncStatus
    erpnext_name: Optional[str] = None  # The name/ID in ERPNext after creation
    error: Optional[str] = None


class SyncResponse(BaseModel):
    """Response from sync operation."""
    success: bool
    synced_count: int
    failed_count: int
    results: List[SyncResultItem]
    server_time: datetime


class PullRequest(BaseModel):
    """Request to pull data from ERPNext."""
    doctypes: List[str] = ["Item", "Customer", "Warehouse"]
    last_sync: Optional[datetime] = None
    limit: int = 100


class PullResponse(BaseModel):
    """Response with data pulled from ERPNext."""
    items: List[Dict[str, Any]] = []
    customers: List[Dict[str, Any]] = []
    warehouses: List[Dict[str, Any]] = []
    pos_profiles: List[Dict[str, Any]] = []
    payment_methods: List[Dict[str, Any]] = []
    last_modified: datetime
    has_more: bool = False


class ConflictResolution(str, Enum):
    USE_LOCAL = "use_local"
    USE_SERVER = "use_server"
    MERGE = "merge"


class SyncConflict(BaseModel):
    """Represents a sync conflict."""
    offline_id: str
    doctype: str
    local_data: Dict[str, Any]
    server_data: Dict[str, Any]
    conflict_fields: List[str]


class ResolveConflictRequest(BaseModel):
    """Request to resolve a sync conflict."""
    offline_id: str
    resolution: ConflictResolution
    merged_data: Optional[Dict[str, Any]] = None  # Required if resolution is MERGE
