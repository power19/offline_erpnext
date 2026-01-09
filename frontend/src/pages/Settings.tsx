import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Settings as SettingsIcon,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  Wifi,
  WifiOff,
  Database,
  Server,
  CheckCircle,
  ExternalLink,
  Shield,
  Users,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../services/database';
import { useSync } from '../hooks/useSync';
import { useCartStore } from '../store';
import { useAuthStore } from '../store/auth';
import { formatRelativeTime } from '../utils/format';

// Default permissions for Staff role
export interface StaffPermissions {
  pos: boolean;      // Always true
  returns: boolean;
  invoices: boolean;
}

export const DEFAULT_STAFF_PERMISSIONS: StaffPermissions = {
  pos: true,
  returns: true,
  invoices: true
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isOnline, isSyncing, pendingSyncCount, lastSyncTime, sync, pullData, retryFailed } =
    useSync();
  const { warehouse, posProfile, setWarehouse, setPosProfile } = useCartStore();
  const { user, isAdmin } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [erpnextUrl, setErpnextUrl] = useState<string | null>(null);
  const [staffPermissions, setStaffPermissions] = useState<StaffPermissions>(DEFAULT_STAFF_PERMISSIONS);

  // Load ERPNext URL and permissions from settings
  useEffect(() => {
    const loadSettings = async () => {
      const url = await db.getSetting('erpnext_url');
      setErpnextUrl(url || null);

      // Load staff permissions
      const savedPermissions = await db.getSetting('staff_permissions');
      if (savedPermissions) {
        try {
          setStaffPermissions(JSON.parse(savedPermissions));
        } catch (e) {
          console.error('Failed to parse permissions:', e);
        }
      }
    };
    loadSettings();
  }, []);

  // Save permissions when changed
  const handlePermissionChange = async (key: keyof StaffPermissions, value: boolean) => {
    // POS is always enabled
    if (key === 'pos') return;

    const newPermissions = { ...staffPermissions, [key]: value };
    setStaffPermissions(newPermissions);
    await db.setSetting('staff_permissions', JSON.stringify(newPermissions));
    toast.success('Permissions updated');
  };

  // Get data counts
  const counts = useLiveQuery(async () => {
    const [items, customers, warehouses, invoices, pending] = await Promise.all([
      db.items.count(),
      db.customers.count(),
      db.warehouses.count(),
      db.invoices.count(),
      db.syncQueue.where('status').equals('pending').count()
    ]);
    return { items, customers, warehouses, invoices, pending };
  }, []);

  const allWarehouses = useLiveQuery(() => db.warehouses.toArray(), [], []);
  const allPosProfiles = useLiveQuery(() => db.posProfiles.toArray(), [], []);

  // Filter warehouses and profiles based on user permissions
  const warehouses = useMemo(() => {
    if (!allWarehouses) return [];
    if (isAdmin()) return allWarehouses;

    // Staff only sees allowed warehouses
    const allowedWarehouses = user?.allowed_warehouses || [];
    return allWarehouses.filter(w => allowedWarehouses.includes(w.name));
  }, [allWarehouses, user, isAdmin]);

  const posProfiles = useMemo(() => {
    if (!allPosProfiles) return [];
    console.log('[Settings] All POS Profiles from IndexedDB:', allPosProfiles);
    console.log('[Settings] print_format values:', allPosProfiles.map(p => ({ name: p.name, print_format: p.print_format })));
    if (isAdmin()) return allPosProfiles;

    // Staff only sees allowed profiles
    const allowedProfiles = user?.pos_profiles.map(p => p.name) || [];
    return allPosProfiles.filter(p => allowedProfiles.includes(p.name));
  }, [allPosProfiles, user, isAdmin]);

  const handleRefreshData = async () => {
    if (!isOnline) {
      toast.error('Cannot refresh while offline');
      return;
    }

    setRefreshing(true);
    try {
      await pullData();
      toast.success('Data refreshed from ERPNext');
    } catch (error) {
      toast.error('Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  };

  const handleClearLocalData = async () => {
    if (!window.confirm('This will clear all cached data. Continue?')) {
      return;
    }

    setClearing(true);
    try {
      await db.clearAllData();
      toast.success('Local cache cleared');
    } catch (error) {
      toast.error('Failed to clear cache');
    } finally {
      setClearing(false);
    }
  };

  const handleSyncNow = async () => {
    try {
      const result = await sync();
      if (!result) {
        toast.error('Sync unavailable');
        return;
      }
      if (result.synced > 0) {
        toast.success(`Synced ${result.synced} item(s)`);
      } else if (result.failed > 0) {
        toast.error(`${result.failed} item(s) failed to sync`);
      } else {
        toast.success('Everything is up to date');
      }
    } catch (error) {
      toast.error('Sync failed');
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* User Info */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isAdmin() ? 'bg-purple-100' : 'bg-primary-100'
          }`}>
            <Shield className={isAdmin() ? 'text-purple-600' : 'text-primary-600'} size={20} />
          </div>
          <div className="flex-1">
            <div className="font-medium">{user?.full_name}</div>
            <div className="text-sm text-gray-500">{user?.email || user?.username}</div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${
            isAdmin() ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {user?.role}
          </span>
        </div>
        {!isAdmin() && user?.pos_profiles && user.pos_profiles.length > 0 && (
          <div className="mt-3 pt-3 border-t text-sm text-gray-500">
            Assigned profiles: {user.pos_profiles.map(p => p.name).join(', ')}
          </div>
        )}
      </div>

      {/* ERPNext Connection - Admin only */}
      {isAdmin() && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <Server className="text-primary-600" size={20} />
              </div>
              <div>
                <div className="font-medium">ERPNext Connection</div>
                <div className="text-sm text-gray-500 truncate max-w-[200px]">
                  {erpnextUrl || 'Not configured'}
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/setup')}
              className="btn btn-secondary btn-sm"
            >
              <ExternalLink size={16} className="mr-1" />
              Configure
            </button>
          </div>
        </div>
      )}

      {/* Staff Permissions - Admin only */}
      {isAdmin() && (
        <div className="card p-4 space-y-4">
          <h2 className="font-bold flex items-center gap-2">
            <Users size={20} />
            Staff Permissions
          </h2>
          <p className="text-sm text-gray-500">
            Control which features Staff users can access
          </p>

          <div className="space-y-3">
            {/* POS - Always enabled */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Eye size={18} className="text-green-600" />
                <div>
                  <div className="font-medium">POS</div>
                  <div className="text-xs text-gray-500">Create sales invoices</div>
                </div>
              </div>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                Always On
              </span>
            </div>

            {/* Returns */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {staffPermissions.returns ? (
                  <Eye size={18} className="text-green-600" />
                ) : (
                  <EyeOff size={18} className="text-gray-400" />
                )}
                <div>
                  <div className="font-medium">Returns</div>
                  <div className="text-xs text-gray-500">Process customer returns</div>
                </div>
              </div>
              <button
                onClick={() => handlePermissionChange('returns', !staffPermissions.returns)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  staffPermissions.returns ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    staffPermissions.returns ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Invoices */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                {staffPermissions.invoices ? (
                  <Eye size={18} className="text-green-600" />
                ) : (
                  <EyeOff size={18} className="text-gray-400" />
                )}
                <div>
                  <div className="font-medium">Invoices</div>
                  <div className="text-xs text-gray-500">View invoice history</div>
                </div>
              </div>
              <button
                onClick={() => handlePermissionChange('invoices', !staffPermissions.invoices)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  staffPermissions.invoices ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    staffPermissions.invoices ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <p className="text-xs text-gray-400 text-center">
            Inventory and Settings are always Admin-only
          </p>
        </div>
      )}

      {/* Connection status */}
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isOnline ? (
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <Wifi className="text-green-600" size={20} />
              </div>
            ) : (
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <WifiOff className="text-red-600" size={20} />
              </div>
            )}
            <div>
              <div className="font-medium">{isOnline ? 'Online' : 'Offline'}</div>
              <div className="text-sm text-gray-500">
                {lastSyncTime
                  ? `Last sync: ${formatRelativeTime(lastSyncTime)}`
                  : 'Never synced'}
              </div>
            </div>
          </div>

          {pendingSyncCount > 0 && (
            <span className="badge badge-warning">{pendingSyncCount} pending</span>
          )}
        </div>
      </div>

      {/* POS Settings */}
      <div className="card p-4 space-y-4">
        <h2 className="font-bold flex items-center gap-2">
          <SettingsIcon size={20} />
          POS Settings
        </h2>

        <div>
          <label className="block text-sm font-medium mb-1">Default Warehouse</label>
          <select
            value={warehouse?.name || ''}
            onChange={(e) => {
              const w = warehouses?.find((w) => w.name === e.target.value);
              setWarehouse(w || null);
            }}
            className="input"
          >
            <option value="">Select warehouse</option>
            {warehouses?.map((w, idx) => (
              <option key={w.id ?? `${w.name}-${idx}`} value={w.name}>
                {w.warehouse_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">POS Profile</label>
          <select
            value={posProfile?.name || ''}
            onChange={(e) => {
              const p = posProfiles?.find((p) => p.name === e.target.value);
              console.log('[Settings] Selected POS Profile:', p);
              console.log('[Settings] print_format in profile:', p?.print_format);
              setPosProfile(p || null);
            }}
            className="input"
          >
            <option value="">Select profile</option>
            {posProfiles?.map((p, idx) => (
              <option key={p.id ?? `${p.name}-${idx}`} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sync Actions */}
      <div className="card p-4 space-y-4">
        <h2 className="font-bold flex items-center gap-2">
          <RefreshCw size={20} />
          Sync
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleSyncNow}
            disabled={!isOnline || isSyncing || pendingSyncCount === 0}
            className="btn btn-primary"
          >
            <Upload size={18} className="mr-2" />
            Push Changes
            {pendingSyncCount > 0 && ` (${pendingSyncCount})`}
          </button>

          <button
            onClick={handleRefreshData}
            disabled={!isOnline || refreshing}
            className="btn btn-secondary"
          >
            <Download size={18} className="mr-2" />
            {refreshing ? 'Refreshing...' : 'Pull Data'}
          </button>
        </div>

        {pendingSyncCount > 0 && (
          <button onClick={retryFailed} className="btn btn-secondary w-full">
            Retry Failed Syncs
          </button>
        )}
      </div>

      {/* Local Data */}
      <div className="card p-4 space-y-4">
        <h2 className="font-bold flex items-center gap-2">
          <Database size={20} />
          Local Data
        </h2>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-gray-500">Items</div>
            <div className="text-2xl font-bold">{counts?.items || 0}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-gray-500">Customers</div>
            <div className="text-2xl font-bold">{counts?.customers || 0}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-gray-500">Warehouses</div>
            <div className="text-2xl font-bold">{counts?.warehouses || 0}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-gray-500">Invoices</div>
            <div className="text-2xl font-bold">{counts?.invoices || 0}</div>
          </div>
        </div>

        <button
          onClick={handleClearLocalData}
          disabled={clearing}
          className="btn btn-danger w-full"
        >
          <Trash2 size={18} className="mr-2" />
          {clearing ? 'Clearing...' : 'Clear Local Cache'}
        </button>
        <p className="text-xs text-gray-500 text-center">
          This will not delete unsynced invoices
        </p>
      </div>

      {/* App Info */}
      <div className="card p-4">
        <h2 className="font-bold flex items-center gap-2 mb-4">
          <Server size={20} />
          App Info
        </h2>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Version</span>
            <span>1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">PWA Status</span>
            <span className="flex items-center gap-1">
              <CheckCircle size={14} className="text-green-600" />
              Installed
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
