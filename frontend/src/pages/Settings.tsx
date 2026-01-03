import { useState, useEffect } from 'react';
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
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../services/database';
import { syncService } from '../services/sync';
import { useSync } from '../hooks/useSync';
import { useCartStore } from '../store';
import { formatRelativeTime, formatDateTime } from '../utils/format';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isOnline, isSyncing, pendingSyncCount, lastSyncTime, sync, pullData, retryFailed } =
    useSync();
  const { warehouse, posProfile, setWarehouse, setPosProfile } = useCartStore();
  const [refreshing, setRefreshing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [erpnextUrl, setErpnextUrl] = useState<string | null>(null);

  // Load ERPNext URL from settings
  useEffect(() => {
    const loadUrl = async () => {
      const url = await db.getSetting('erpnext_url');
      setErpnextUrl(url || null);
    };
    loadUrl();
  }, []);

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

  const warehouses = useLiveQuery(() => db.warehouses.toArray(), [], []);
  const posProfiles = useLiveQuery(() => db.posProfiles.toArray(), [], []);

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

      {/* ERPNext Connection */}
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
