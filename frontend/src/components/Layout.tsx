import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  RotateCcw,
  Package,
  FileText,
  Settings,
  Wifi,
  WifiOff,
  RefreshCw,
  User,
  LogOut,
  ChevronDown,
  Shield
} from 'lucide-react';
import { useSync } from '../hooks/useSync';
import { useAuthStore } from '../store/auth';
import { formatRelativeTime } from '../utils/format';
import toast from 'react-hot-toast';

export default function Layout() {
  const navigate = useNavigate();
  const { isOnline, isSyncing, pendingSyncCount, lastSyncTime, sync } = useSync();
  const { user, logout, isAdmin } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const navItems = [
    { to: '/pos', icon: ShoppingCart, label: 'POS' },
    { to: '/returns', icon: RotateCcw, label: 'Returns' },
    { to: '/inventory', icon: Package, label: 'Inventory' },
    { to: '/invoices', icon: FileText, label: 'Invoices' },
    { to: '/settings', icon: Settings, label: 'Settings' }
  ];

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

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

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100"
              >
                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                  {isAdmin() ? (
                    <Shield size={16} className="text-primary-600" />
                  ) : (
                    <User size={16} className="text-primary-600" />
                  )}
                </div>
                <span className="hidden md:inline text-sm font-medium">
                  {user?.full_name || user?.username}
                </span>
                <ChevronDown size={16} className="text-gray-400" />
              </button>

              {showUserMenu && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border z-20">
                    <div className="p-3 border-b">
                      <div className="font-medium">{user?.full_name}</div>
                      <div className="text-sm text-gray-500">{user?.email || user?.username}</div>
                      <div className="mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          isAdmin() ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {user?.role}
                        </span>
                      </div>
                    </div>
                    <div className="p-2">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <LogOut size={18} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                </>
              )}
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
