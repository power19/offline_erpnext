import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, Loader, AlertCircle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../services/database';
import { useAuthStore } from '../store/auth';
import { useCartStore } from '../store';
import { api } from '../services/api';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser, setIsAuthenticated } = useAuthStore();
  const { setWarehouse, setPosProfile, setCustomer } = useCartStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password) {
      setError('Please enter username and password');
      return;
    }

    setLoading(true);
    setLoadingMessage('Signing in...');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success && data.user) {
        // Save user session to IndexedDB
        await db.setSetting('user', JSON.stringify(data.user));
        await db.setSetting('isAuthenticated', 'true');

        // Update auth store
        setUser(data.user);
        setIsAuthenticated(true);

        toast.success(`Welcome, ${data.user.full_name}!`);

        // Navigate based on role
        if (data.user.pos_profiles.length === 0 && data.user.role !== 'Admin') {
          setError('No POS Profile assigned to your account. Contact administrator.');
          setLoading(false);
          return;
        }

        // Check if initial data has been loaded (for pre-configured systems)
        const dataInitialized = await db.getSetting('data_initialized');
        if (dataInitialized !== 'true') {
          setLoadingMessage('Downloading data for first time use...');
          try {
            // Pull initial data from ERPNext
            const pullResult = await api.pullData(
              ['Item', 'Customer', 'Warehouse', 'POS Profile', 'Mode of Payment'],
              undefined
            );

            // Store pulled data in IndexedDB
            if (pullResult.items) {
              await db.items.clear();
              await db.items.bulkAdd(pullResult.items);
            }
            if (pullResult.customers) {
              await db.customers.clear();
              await db.customers.bulkAdd(pullResult.customers);
            }
            if (pullResult.warehouses) {
              await db.warehouses.clear();
              await db.warehouses.bulkAdd(pullResult.warehouses);
            }
            if (pullResult.stock_balance) {
              await db.stockBalance.clear();
              await db.stockBalance.bulkAdd(pullResult.stock_balance);
            }
            if (pullResult.pos_profiles) {
              await db.posProfiles.clear();
              await db.posProfiles.bulkAdd(pullResult.pos_profiles);
            }
            if (pullResult.payment_methods) {
              await db.paymentMethods.clear();
              await db.paymentMethods.bulkAdd(pullResult.payment_methods);
            }

            // Mark data as initialized
            await db.setSetting('data_initialized', 'true');
            await db.setSetting('setup_complete', 'true');
            await db.setSetting('last_sync', new Date().toISOString());

            toast.success('Initial data loaded successfully!');
          } catch (pullError) {
            console.error('Failed to pull initial data:', pullError);
            toast.error('Could not load initial data. Will retry on next sync.');
          }
        }

        // Auto-set warehouse, POS profile and default customer from user's default profile
        const profiles = data.user.pos_profiles;
        console.log('[Login] POS Profiles from auth:', profiles);
        if (profiles && profiles.length > 0) {
          // Find default profile or use first one
          const defaultProfile = profiles.find((p: any) => p.is_default) || profiles[0];
          console.log('[Login] Default profile:', defaultProfile);
          console.log('[Login] print_format from auth:', defaultProfile.print_format);

          // Set POS Profile - merge IndexedDB data with auth response (auth has latest print_format)
          const storedProfile = await db.posProfiles.where('name').equals(defaultProfile.name).first();
          const posProfileData = {
            ...storedProfile,
            name: defaultProfile.name,
            warehouse: defaultProfile.warehouse,
            company: defaultProfile.company,
            customer: defaultProfile.customer,
            print_format: defaultProfile.print_format  // Use print_format from auth response
          };
          console.log('[Login] Setting posProfile with print_format:', posProfileData.print_format);
          setPosProfile(posProfileData);

          // Set warehouse from the profile
          if (defaultProfile.warehouse) {
            const warehouse = await db.warehouses.where('name').equals(defaultProfile.warehouse).first();
            if (warehouse) {
              setWarehouse(warehouse);
              console.log('[Login] Set warehouse:', warehouse.name);
            } else {
              console.log('[Login] Warehouse not found in IndexedDB:', defaultProfile.warehouse);
            }
          }

          // Set default customer (Walk-in Customer) from the profile
          if (defaultProfile.customer) {
            console.log('[Login] Looking for default customer:', defaultProfile.customer);
            // Try to find by name first
            let customer = await db.customers.where('name').equals(defaultProfile.customer).first();

            // If not found, try by customer_name
            if (!customer) {
              customer = await db.customers.where('customer_name').equals(defaultProfile.customer).first();
            }

            if (customer) {
              setCustomer(customer);
              console.log('[Login] Set default customer:', customer.name, customer.customer_name);
            } else {
              // Create a minimal customer object as fallback
              console.log('[Login] Customer not found in IndexedDB, creating fallback:', defaultProfile.customer);
              const fallbackCustomer = {
                name: defaultProfile.customer,
                customer_name: defaultProfile.customer
              };
              setCustomer(fallbackCustomer);
            }
          } else {
            console.log('[Login] No default customer set in POS Profile');
          }
        }

        navigate('/pos');
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Could not connect to server');
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="text-primary-600" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-500 mt-2">Sign in to access POS</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input pl-10"
                placeholder="Enter your username"
                autoComplete="username"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-10 pr-10"
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full py-3 text-lg"
          >
            {loading ? (
              <>
                {loadingMessage.includes('Downloading') ? (
                  <Download className="animate-bounce mr-2" size={20} />
                ) : (
                  <Loader className="animate-spin mr-2" size={20} />
                )}
                {loadingMessage || 'Signing in...'}
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-8">
          Use your ERPNext credentials to login
        </p>
      </div>
    </div>
  );
}
