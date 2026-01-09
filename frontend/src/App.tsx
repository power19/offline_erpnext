import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { db } from './services/database';
import { useAuthStore } from './store/auth';
import Layout from './components/Layout';
import POSPage from './pages/POS';
import ReturnsPage from './pages/Returns';
import InventoryPage from './pages/Inventory';
import InvoicesPage from './pages/Invoices';
import SettingsPage, { StaffPermissions, DEFAULT_STAFF_PERMISSIONS } from './pages/Settings';
import SetupPage from './pages/Setup';
import LoginPage from './pages/Login';

// Check if backend is pre-configured via environment variables
async function checkBackendConfig(): Promise<{ configured: boolean; preconfigured: boolean }> {
  try {
    const response = await fetch('/api/config/status');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.error('Failed to check backend config:', error);
  }
  return { configured: false, preconfigured: false };
}

// Restore backend config from IndexedDB (only if not pre-configured)
async function restoreBackendConfig() {
  try {
    const url = await db.getSetting('erpnext_url');
    const apiKey = await db.getSetting('erpnext_api_key');
    const apiSecret = await db.getSetting('erpnext_api_secret');

    if (url) {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          api_key: apiKey || '',
          api_secret: apiSecret || ''
        })
      });
      console.log('Backend config restored from IndexedDB');
    }
  } catch (error) {
    console.error('Failed to restore backend config:', error);
  }
}

// Component to protect admin-only routes
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin } = useAuthStore();
  if (!isAdmin()) {
    return <Navigate to="/pos" replace />;
  }
  return <>{children}</>;
}

// Component to protect routes based on staff permissions
function PermissionRoute({
  children,
  permissionKey,
  permissions
}: {
  children: React.ReactNode;
  permissionKey: keyof StaffPermissions;
  permissions: StaffPermissions;
}) {
  const { isAdmin } = useAuthStore();

  // Admin always has access
  if (isAdmin()) {
    return <>{children}</>;
  }

  // Check staff permission
  if (!permissions[permissionKey]) {
    return <Navigate to="/pos" replace />;
  }

  return <>{children}</>;
}

function App() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const [isPreconfigured, setIsPreconfigured] = useState(false);
  const [staffPermissions, setStaffPermissions] = useState<StaffPermissions>(DEFAULT_STAFF_PERMISSIONS);
  const location = useLocation();
  const { isAuthenticated, isLoading, restoreSession } = useAuthStore();

  useEffect(() => {
    const initialize = async () => {
      // Load staff permissions
      const savedPermissions = await db.getSetting('staff_permissions');
      if (savedPermissions) {
        try {
          setStaffPermissions(JSON.parse(savedPermissions));
        } catch (e) {
          console.error('Failed to parse permissions:', e);
        }
      }

      // First check if backend is pre-configured via environment variables
      const backendStatus = await checkBackendConfig();

      if (backendStatus.preconfigured) {
        // Backend is pre-configured - skip setup, go straight to login
        console.log('Backend pre-configured via environment');
        setIsPreconfigured(true);
        setIsSetupComplete(true);

        // Still need to sync initial data if not done before
        const dataInitialized = await db.getSetting('data_initialized');
        if (dataInitialized !== 'true') {
          // Will be handled by login/first sync
        }

        // Restore user session
        await restoreSession();
      } else {
        // Check local setup status
        const setupComplete = await db.getSetting('setup_complete');
        const isComplete = setupComplete === 'true';
        setIsSetupComplete(isComplete);

        if (isComplete) {
          // Restore backend config from IndexedDB
          await restoreBackendConfig();
          // Restore user session
          await restoreSession();
        } else {
          // Setup not complete, clear loading state
          useAuthStore.getState().setIsLoading(false);
        }
      }
    };
    initialize();
  }, [restoreSession]);

  // Re-check setup and permissions on route change
  useEffect(() => {
    const checkSetup = async () => {
      // Reload permissions (in case admin changed them)
      const savedPermissions = await db.getSetting('staff_permissions');
      if (savedPermissions) {
        try {
          setStaffPermissions(JSON.parse(savedPermissions));
        } catch (e) {
          console.error('Failed to parse permissions:', e);
        }
      }

      if (isPreconfigured) {
        setIsSetupComplete(true);
        return;
      }
      const setupComplete = await db.getSetting('setup_complete');
      setIsSetupComplete(setupComplete === 'true');
    };
    checkSetup();
  }, [location.pathname, isPreconfigured]);

  // Show loading while checking setup status and auth
  if (isSetupComplete === null || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Setup page - only accessible if not pre-configured */}
      <Route
        path="/setup"
        element={
          isPreconfigured ? (
            <Navigate to="/login" replace />
          ) : (
            <SetupPage />
          )
        }
      />

      {/* Login page - accessible after setup but before auth */}
      <Route
        path="/login"
        element={
          !isSetupComplete ? (
            <Navigate to="/setup" replace />
          ) : isAuthenticated ? (
            <Navigate to="/pos" replace />
          ) : (
            <LoginPage />
          )
        }
      />

      {/* Protected routes - require setup AND authentication */}
      <Route
        path="/"
        element={
          !isSetupComplete ? (
            <Navigate to="/setup" replace />
          ) : !isAuthenticated ? (
            <Navigate to="/login" replace />
          ) : (
            <Layout />
          )
        }
      >
        <Route index element={<Navigate to="/pos" replace />} />
        <Route path="pos" element={<POSPage />} />
        <Route
          path="returns"
          element={
            <PermissionRoute permissionKey="returns" permissions={staffPermissions}>
              <ReturnsPage />
            </PermissionRoute>
          }
        />
        <Route path="inventory" element={<AdminRoute><InventoryPage /></AdminRoute>} />
        <Route
          path="invoices"
          element={
            <PermissionRoute permissionKey="invoices" permissions={staffPermissions}>
              <InvoicesPage />
            </PermissionRoute>
          }
        />
        <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
