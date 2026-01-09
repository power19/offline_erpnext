import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { db } from './services/database';
import { useAuthStore } from './store/auth';
import Layout from './components/Layout';
import POSPage from './pages/POS';
import ReturnsPage from './pages/Returns';
import InventoryPage from './pages/Inventory';
import InvoicesPage from './pages/Invoices';
import SettingsPage from './pages/Settings';
import SetupPage from './pages/Setup';
import LoginPage from './pages/Login';

// Restore backend config from IndexedDB
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

function App() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const location = useLocation();
  const { isAuthenticated, isLoading, restoreSession } = useAuthStore();

  useEffect(() => {
    const initialize = async () => {
      // Check setup status
      const setupComplete = await db.getSetting('setup_complete');
      const isComplete = setupComplete === 'true';
      setIsSetupComplete(isComplete);

      // Restore backend config if setup is complete
      if (isComplete) {
        await restoreBackendConfig();
        // Restore user session
        await restoreSession();
      } else {
        // Setup not complete, but we still need to clear loading state
        useAuthStore.getState().setIsLoading(false);
      }
    };
    initialize();
  }, [restoreSession]);

  // Re-check setup on route change (but don't restore config again)
  useEffect(() => {
    const checkSetup = async () => {
      const setupComplete = await db.getSetting('setup_complete');
      setIsSetupComplete(setupComplete === 'true');
    };
    checkSetup();
  }, [location.pathname]);

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
      {/* Setup page - always accessible */}
      <Route path="/setup" element={<SetupPage />} />

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
        <Route path="returns" element={<ReturnsPage />} />
        <Route path="inventory" element={<AdminRoute><InventoryPage /></AdminRoute>} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
