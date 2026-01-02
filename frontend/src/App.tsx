import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import POSPage from './pages/POS';
import ReturnsPage from './pages/Returns';
import InventoryPage from './pages/Inventory';
import InvoicesPage from './pages/Invoices';
import SettingsPage from './pages/Settings';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/pos" replace />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="returns" element={<ReturnsPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
