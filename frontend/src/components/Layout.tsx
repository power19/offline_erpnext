import { Outlet, NavLink } from 'react-router-dom';
import {
  ShoppingCart,
  RotateCcw,
  Package,
  FileText,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw
} from 'lucide-react';
import { useSync } from '../hooks/useSync';
import { formatRelativeTime } from '../utils/format';

export default function Layout() {
  const { isOnline, isSyncing, pendingSyncCount, lastSyncTime, sync } = useSync();

  const navItems = [
    { to: '/pos', icon: ShoppingCart, label: 'POS' },
    { to: '/returns', icon: RotateCcw, label: 'Returns' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/invoices', icon: FileText, label: 'Invoices' },
    { to: '/settings', icon: Settings, label: 'Settings' }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-200 safe-top">
        <div className="px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary-600">Offline POS</h1>

          <div className="flex items-center gap-3">
            {/* Sync status */}
            {pendingSyncCount > 0 && (
              <span className="badge badge-warning">
                {pendingSyncCount} pending
              </span>
            )}

            {/* Sync button */}
            <button
              onClick={() => sync()}
              disabled={!isOnline || isSyncing}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              title={lastSyncTime ? `Last sync: ${formatRelativeTime(lastSyncTime)}` : 'Sync now'}
            >
              <RefreshCw
                size={20}
                className={`text-gray-600 ${isSyncing ? 'animate-spin' : ''}`}
              />
            </button>

            {/* Online status */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-sm ${
                isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
              <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="bg-white border-t border-gray-200 safe-bottom">
        <div className="flex justify-around">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center py-2 px-3 min-w-[64px] ${
                  isActive
                    ? 'text-primary-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`
              }
            >
              <Icon size={24} />
              <span className="text-xs mt-1">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
