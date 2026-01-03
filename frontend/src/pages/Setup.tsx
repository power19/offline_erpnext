import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Server, Key, Link, Eye, EyeOff, CheckCircle, AlertCircle, Loader, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../services/database';
import { api } from '../services/api';

export default function SetupPage() {
  const navigate = useNavigate();
  const [erpnextUrl, setErpnextUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      const url = await db.getSetting('erpnext_url');
      const key = await db.getSetting('erpnext_api_key');
      const secret = await db.getSetting('erpnext_api_secret');

      if (url) setErpnextUrl(url);
      if (key) setApiKey(key);
      if (secret) setApiSecret(secret);
    };
    loadSettings();
  }, []);

  const testConnection = async () => {
    if (!erpnextUrl) {
      toast.error('Please enter ERPNext URL');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Test the connection via our backend
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: erpnextUrl,
          api_key: apiKey,
          api_secret: apiSecret
        })
      });

      const data = await response.json();

      if (data.success) {
        setTestResult('success');
        toast.success(`Connected as ${data.user || 'user'}!`);
      } else {
        setTestResult('error');
        toast.error(data.error || 'Connection failed');
      }
    } catch (error) {
      setTestResult('error');
      toast.error('Could not reach the server. Make sure backend is running.');
    } finally {
      setTesting(false);
    }
  };

  const saveSettings = async () => {
    if (!erpnextUrl) {
      toast.error('ERPNext URL is required');
      return;
    }

    setSaving(true);
    setSyncStatus('Saving settings...');

    try {
      // Save to IndexedDB
      await db.setSetting('erpnext_url', erpnextUrl.replace(/\/$/, '')); // Remove trailing slash
      await db.setSetting('erpnext_api_key', apiKey);
      await db.setSetting('erpnext_api_secret', apiSecret);

      // Update the backend config
      setSyncStatus('Configuring backend...');
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: erpnextUrl,
          api_key: apiKey,
          api_secret: apiSecret
        })
      });

      // Pull initial data from ERPNext
      setSyncStatus('Pulling items from ERPNext...');
      try {
        const data = await api.pullData(
          ['Item', 'Customer', 'Warehouse', 'POS Profile', 'Mode of Payment']
        );

        // Save to IndexedDB
        if (data.items?.length > 0) {
          setSyncStatus(`Saving ${data.items.length} items...`);
          await db.items.bulkPut(
            data.items.map((item: Record<string, unknown>) => ({ ...item, synced: true }))
          );
        }

        if (data.customers?.length > 0) {
          setSyncStatus(`Saving ${data.customers.length} customers...`);
          await db.customers.bulkPut(
            data.customers.map((c: Record<string, unknown>) => ({ ...c, synced: true }))
          );
        }

        if (data.warehouses?.length > 0) {
          setSyncStatus(`Saving ${data.warehouses.length} warehouses...`);
          await db.warehouses.bulkPut(data.warehouses);
        }

        if (data.pos_profiles?.length > 0) {
          await db.posProfiles.bulkPut(data.pos_profiles);
        }

        if (data.payment_methods?.length > 0) {
          await db.paymentMethods.bulkPut(data.payment_methods);
        }

        await db.setSetting('lastSync', new Date().toISOString());

        const itemCount = data.items?.length || 0;
        const customerCount = data.customers?.length || 0;
        toast.success(`Synced ${itemCount} items, ${customerCount} customers!`);
      } catch (syncError) {
        console.error('Sync error:', syncError);
        toast.error('Could not pull data. You can sync later from Settings.');
      }

      await db.setSetting('setup_complete', 'true');
      setSyncStatus('');
      navigate('/pos');
    } catch (error) {
      toast.error('Failed to save settings');
      setSyncStatus('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Server className="text-primary-600" size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Setup ERPNext Connection</h1>
          <p className="text-gray-500 mt-2">Connect your POS to ERPNext</p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* ERPNext URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Link size={16} className="inline mr-1" />
              ERPNext URL
            </label>
            <input
              type="url"
              value={erpnextUrl}
              onChange={(e) => setErpnextUrl(e.target.value)}
              placeholder="https://your-site.erpnext.com"
              className="input"
            />
            <p className="text-xs text-gray-500 mt-1">
              Your ERPNext instance URL (e.g., https://mycompany.erpnext.com)
            </p>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Key size={16} className="inline mr-1" />
              API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API Key"
              className="input font-mono text-sm"
            />
          </div>

          {/* API Secret */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Key size={16} className="inline mr-1" />
              API Secret
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={(e) => setApiSecret(e.target.value)}
                placeholder="Enter your API Secret"
                className="input font-mono text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecret ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Generate API keys in ERPNext: Settings → My Settings → API Access
            </p>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                testResult === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}
            >
              {testResult === 'success' ? (
                <>
                  <CheckCircle size={18} />
                  <span>Connection successful!</span>
                </>
              ) : (
                <>
                  <AlertCircle size={18} />
                  <span>Connection failed. Check your credentials.</span>
                </>
              )}
            </div>
          )}

          {/* Sync Status */}
          {syncStatus && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 text-blue-700">
              <Loader size={18} className="animate-spin" />
              <span>{syncStatus}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={testConnection}
              disabled={testing || saving || !erpnextUrl}
              className="btn btn-secondary flex-1"
            >
              {testing ? (
                <>
                  <Loader size={18} className="animate-spin mr-2" />
                  Testing...
                </>
              ) : (
                'Test Connection'
              )}
            </button>
            <button
              onClick={saveSettings}
              disabled={saving || !erpnextUrl}
              className="btn btn-primary flex-1"
            >
              {saving ? (
                <>
                  <Loader size={18} className="animate-spin mr-2" />
                  Syncing...
                </>
              ) : (
                <>
                  <Download size={18} className="mr-1" />
                  Save & Sync
                </>
              )}
            </button>
          </div>
        </div>

        {/* Help text */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-medium text-sm text-gray-700 mb-2">How to get API credentials:</h3>
          <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
            <li>Log into your ERPNext account</li>
            <li>Go to Settings → My Settings</li>
            <li>Scroll to "API Access" section</li>
            <li>Click "Generate Keys"</li>
            <li>Copy the API Key and Secret</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
