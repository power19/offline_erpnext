import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { db } from './services/database';
import Layout from './components/Layout';
import POSPage from './pages/POS';
import ReturnsPage from './pages/Returns';
import InventoryPage from './pages/Inventory';
import InvoicesPage from './pages/Invoices';
import SettingsPage from './pages/Settings';
import SetupPage from './pages/Setup';

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

function App() {
  const [isSetupComplete, setIsSetupComplete] = useState<boolean | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkSetup = async () => {
      const setupComplete = await db.getSetting('setup_complete');
      const isComplete = setupComplete === 'true';
      setIsSetupComplete(isComplete);

      // Restore backend config if setup is complete
      if (isComplete) {
        await restoreBackendConfig();
      }
    };
    checkSetup();
  }, []);

  // Re-check setup on route change (but don't restore config again)
  useEffect(() => {
    const checkSetup = async () => {
      const setupComplete = await db.getSetting('setup_complete');
      setIsSetupComplete(setupComplete === 'true');
    };
    checkSetup();
  }, [location.pathname]);

  // Show loading while checking setup status
  if (isSetupComplete === null) {
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

      {/* Protected routes - require setup */}
      <Route
        path="/"
        element={
          isSetupComplete ? <Layout /> : <Navigate to="/setup" replace />
        }
      >
        <Route index element={<Navigate to="/pos" replace />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="returns" element={<ReturnsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
