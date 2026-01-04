import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Search,
  Package,
  ArrowRightLeft,
  Plus,
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../services/database';
import { api } from '../services/api';
import { syncService } from '../services/sync';
import { formatNumber, formatQty } from '../utils/format';
import { StockBalance, Warehouse, Item } from '../types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

type TabType = 'check' | 'add' | 'transfer';

export default function InventoryPage() {
  const isOnline = useOnlineStatus();
  const [activeTab, setActiveTab] = useState<TabType>('check');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const warehouses = useLiveQuery(() => db.warehouses.toArray(), [], []);

  const tabs = [
    { id: 'check', label: 'Check Stock', icon: Search },
    { id: 'add', label: 'Add Stock', icon: Plus },
    { id: 'transfer', label: 'Transfer', icon: ArrowRightLeft }
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col p-4">
      {/* Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`btn flex-shrink-0 ${
              activeTab === tab.id ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            <tab.icon size={18} className="mr-1" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'check' && (
          <StockCheckTab
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedWarehouse={selectedWarehouse}
            setSelectedWarehouse={setSelectedWarehouse}
            warehouses={warehouses || []}
            expandedItem={expandedItem}
            setExpandedItem={setExpandedItem}
            isOnline={isOnline}
          />
        )}

        {activeTab === 'add' && (
          <AddStockTab warehouses={warehouses || []} isOnline={isOnline} />
        )}

        {activeTab === 'transfer' && (
          <TransferStockTab warehouses={warehouses || []} isOnline={isOnline} />
        )}
      </div>
    </div>
  );
}

// Stock Check Tab
function StockCheckTab({
  searchQuery,
  setSearchQuery,
  selectedWarehouse,
  setSelectedWarehouse,
  warehouses,
  expandedItem,
  setExpandedItem,
  isOnline
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedWarehouse: string;
  setSelectedWarehouse: (w: string) => void;
  warehouses: Warehouse[];
  expandedItem: string | null;
  setExpandedItem: (id: string | null) => void;
  isOnline: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [stockData, setStockData] = useState<StockBalance[]>([]);

  // Get local stock data
  const localStock = useLiveQuery(
    async () => {
      if (selectedWarehouse) {
        return db.stockBalance.where('warehouse').equals(selectedWarehouse).toArray();
      }
      return db.stockBalance.toArray();
    },
    [selectedWarehouse],
    []
  );

  // Search suggestions for items
  const itemSuggestions = useLiveQuery(
    async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      return db.searchItems(searchQuery);
    },
    [searchQuery],
    []
  );

  const handleSearch = async () => {
    if (!searchQuery && !selectedWarehouse) {
      setStockData(localStock || []);
      return;
    }

    setLoading(true);
    try {
      if (isOnline) {
        const data = await api.getStockBalance({
          item_code: searchQuery || undefined,
          warehouse: selectedWarehouse || undefined
        });
        setStockData(data);
      } else {
        // Filter local data
        let filtered = localStock || [];
        if (searchQuery) {
          filtered = filtered.filter(
            (s) =>
              s.item_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
              s.item_name?.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        setStockData(filtered);
      }
    } catch (error) {
      toast.error('Failed to fetch stock data');
      setStockData(localStock || []);
    } finally {
      setLoading(false);
    }
  };

  const displayData = stockData.length > 0 ? stockData : localStock || [];

  // Group by item
  const groupedStock: Record<string, StockBalance[]> = {};
  displayData.forEach((stock) => {
    if (!groupedStock[stock.item_code]) {
      groupedStock[stock.item_code] = [];
    }
    groupedStock[stock.item_code].push(stock);
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={20} />
          <input
            type="text"
            placeholder="Search item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="input pl-10"
          />
          {/* Autocomplete suggestions */}
          {itemSuggestions && itemSuggestions.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white rounded-lg shadow-lg border max-h-48 overflow-auto">
              {itemSuggestions.map((item, idx) => (
                <button
                  key={`${item.item_code}-${idx}`}
                  onClick={() => {
                    setSearchQuery(item.item_code);
                    handleSearch();
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                >
                  <div className="font-medium">{item.item_name}</div>
                  <div className="text-sm text-gray-500">{item.item_code}</div>
                </button>
              ))}
            </div>
          )}
        </div>
        <select
          value={selectedWarehouse}
          onChange={(e) => setSelectedWarehouse(e.target.value)}
          className="input w-48"
        >
          <option value="">All Warehouses</option>
          {warehouses.map((w, idx) => (
            <option key={w.id ?? `${w.name}-${idx}`} value={w.name}>
              {w.warehouse_name}
            </option>
          ))}
        </select>
        <button onClick={handleSearch} className="btn btn-primary">
          Search
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(groupedStock).map(([itemCode, stocks], idx) => {
            const totalQty = stocks.reduce((sum, s) => sum + s.actual_qty, 0);
            const isExpanded = expandedItem === itemCode;
            const isLowStock = totalQty < 10;

            return (
              <div key={`${itemCode}-${idx}`} className="card">
                <button
                  onClick={() => setExpandedItem(isExpanded ? null : itemCode)}
                  className="w-full p-4 text-left flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        isLowStock ? 'bg-red-100' : 'bg-primary-100'
                      }`}
                    >
                      {isLowStock ? (
                        <AlertTriangle className="text-red-600" size={20} />
                      ) : (
                        <Package className="text-primary-600" size={20} />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{itemCode}</div>
                      <div className="text-sm text-gray-500">
                        {stocks[0].item_name || 'Unknown item'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-bold text-lg">{formatNumber(totalQty, 0)}</div>
                      <div className="text-xs text-gray-500">Total Qty</div>
                    </div>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t px-4 pb-4 pt-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500">
                          <th className="text-left py-2">Warehouse</th>
                          <th className="text-right py-2">Actual</th>
                          <th className="text-right py-2">Reserved</th>
                          <th className="text-right py-2">Available</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stocks.map((stock, stockIdx) => (
                          <tr key={`${stock.warehouse}-${stockIdx}`} className="border-t">
                            <td className="py-2">{stock.warehouse}</td>
                            <td className="text-right">{formatNumber(stock.actual_qty, 0)}</td>
                            <td className="text-right">{formatNumber(stock.reserved_qty, 0)}</td>
                            <td className="text-right font-medium">
                              {formatNumber(stock.available_qty, 0)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {Object.keys(groupedStock).length === 0 && (
            <div className="text-center text-gray-500 py-8">No stock data found</div>
          )}
        </div>
      )}
    </div>
  );
}

// Add Stock Tab
function AddStockTab({
  warehouses,
  isOnline
}: {
  warehouses: Warehouse[];
  isOnline: boolean;
}) {
  const [itemCode, setItemCode] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [qty, setQty] = useState('');
  const [rate, setRate] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  const items = useLiveQuery(
    async () => {
      if (!itemSearch || itemSearch.length < 2) return [];
      return db.searchItems(itemSearch);
    },
    [itemSearch],
    []
  );

  const handleSubmit = async () => {
    if (!itemCode || !qty || !warehouse) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await syncService.createStockEntry({
        offline_id: '',
        stock_entry_type: 'Material Receipt',
        items: [
          {
            item_code: itemCode,
            qty: parseFloat(qty),
            uom: 'Nos',
            t_warehouse: warehouse,
            basic_rate: rate ? parseFloat(rate) : undefined
          }
        ],
        to_warehouse: warehouse,
        remarks: remarks || 'Stock added via Offline POS',
        posting_date: new Date().toISOString().split('T')[0]
      });

      toast.success('Stock added successfully!');
      setItemCode('');
      setItemSearch('');
      setQty('');
      setRate('');
      setRemarks('');
    } catch (error) {
      toast.error('Failed to add stock');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4 max-w-lg mx-auto">
      <h2 className="text-lg font-bold mb-4">Add Stock to Inventory</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Item *</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search item..."
              value={itemSearch}
              onChange={(e) => {
                setItemSearch(e.target.value);
                setItemCode('');
              }}
              className="input"
            />
            {items && items.length > 0 && !itemCode && (
              <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border max-h-48 overflow-auto">
                {items.map((item, idx) => (
                  <button
                    key={`${item.item_code}-${idx}`}
                    onClick={() => {
                      setItemCode(item.item_code);
                      setItemSearch(item.item_name);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                  >
                    <div className="font-medium">{item.item_name}</div>
                    <div className="text-sm text-gray-500">{item.item_code}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {itemCode && (
            <div className="mt-1 text-sm text-green-600">Selected: {itemCode}</div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Warehouse *</label>
          <select
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
            className="input"
          >
            <option value="">Select warehouse</option>
            {warehouses.map((w, idx) => (
              <option key={w.id ?? `${w.name}-${idx}`} value={w.name}>
                {w.warehouse_name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Quantity *</label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="input"
              min="1"
              step="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Rate (optional)</label>
            <input
              type="number"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="input"
              min="0"
              step="0.01"
              placeholder="Valuation rate"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="input"
            rows={2}
            placeholder="Optional notes..."
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !itemCode || !qty || !warehouse}
          className="btn btn-primary w-full"
        >
          {loading ? 'Adding...' : 'Add Stock'}
        </button>
      </div>
    </div>
  );
}

// Transfer Stock Tab
function TransferStockTab({
  warehouses,
  isOnline
}: {
  warehouses: Warehouse[];
  isOnline: boolean;
}) {
  const [itemCode, setItemCode] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [qty, setQty] = useState('');
  const [fromWarehouse, setFromWarehouse] = useState('');
  const [toWarehouse, setToWarehouse] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [availableQty, setAvailableQty] = useState<number | null>(null);

  const items = useLiveQuery(
    async () => {
      if (!itemSearch || itemSearch.length < 2) return [];
      return db.searchItems(itemSearch);
    },
    [itemSearch],
    []
  );

  // Check available quantity when item and source warehouse change
  const checkAvailability = async () => {
    if (itemCode && fromWarehouse) {
      const stock = await db.getItemStock(itemCode, fromWarehouse);
      if (stock.length > 0) {
        setAvailableQty(stock[0].available_qty);
      } else {
        setAvailableQty(0);
      }
    }
  };

  const handleSubmit = async () => {
    if (!itemCode || !qty || !fromWarehouse || !toWarehouse) {
      toast.error('Please fill all required fields');
      return;
    }

    if (fromWarehouse === toWarehouse) {
      toast.error('Source and destination must be different');
      return;
    }

    const qtyNum = parseFloat(qty);
    if (availableQty !== null && qtyNum > availableQty) {
      toast.error(`Only ${availableQty} available in source warehouse`);
      return;
    }

    setLoading(true);
    try {
      await syncService.createStockEntry({
        offline_id: '',
        stock_entry_type: 'Material Transfer',
        items: [
          {
            item_code: itemCode,
            qty: qtyNum,
            uom: 'Nos',
            s_warehouse: fromWarehouse,
            t_warehouse: toWarehouse
          }
        ],
        from_warehouse: fromWarehouse,
        to_warehouse: toWarehouse,
        remarks: remarks || 'Transfer via Offline POS',
        posting_date: new Date().toISOString().split('T')[0]
      });

      toast.success('Stock transferred successfully!');
      setItemCode('');
      setItemSearch('');
      setQty('');
      setFromWarehouse('');
      setToWarehouse('');
      setRemarks('');
      setAvailableQty(null);
    } catch (error) {
      toast.error('Failed to transfer stock');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4 max-w-lg mx-auto">
      <h2 className="text-lg font-bold mb-4">Transfer Stock Between Warehouses</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Item *</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Search item..."
              value={itemSearch}
              onChange={(e) => {
                setItemSearch(e.target.value);
                setItemCode('');
                setAvailableQty(null);
              }}
              className="input"
            />
            {items && items.length > 0 && !itemCode && (
              <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border max-h-48 overflow-auto">
                {items.map((item, idx) => (
                  <button
                    key={`${item.item_code}-${idx}`}
                    onClick={() => {
                      setItemCode(item.item_code);
                      setItemSearch(item.item_name);
                      setTimeout(checkAvailability, 0);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b last:border-b-0"
                  >
                    <div className="font-medium">{item.item_name}</div>
                    <div className="text-sm text-gray-500">{item.item_code}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">From Warehouse *</label>
            <select
              value={fromWarehouse}
              onChange={(e) => {
                setFromWarehouse(e.target.value);
                setTimeout(checkAvailability, 0);
              }}
              className="input"
            >
              <option value="">Select source</option>
              {warehouses.map((w, idx) => (
                <option key={w.id ?? `from-${w.name}-${idx}`} value={w.name}>
                  {w.warehouse_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">To Warehouse *</label>
            <select
              value={toWarehouse}
              onChange={(e) => setToWarehouse(e.target.value)}
              className="input"
            >
              <option value="">Select destination</option>
              {warehouses
                .filter((w) => w.name !== fromWarehouse)
                .map((w, idx) => (
                  <option key={w.id ?? `${w.name}-${idx}`} value={w.name}>
                    {w.warehouse_name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Quantity *
            {availableQty !== null && (
              <span className="text-gray-500 font-normal ml-2">
                (Available: {formatNumber(availableQty, 0)})
              </span>
            )}
          </label>
          <input
            type="number"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            className="input"
            min="1"
            max={availableQty ?? undefined}
            step="1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Remarks</label>
          <textarea
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="input"
            rows={2}
            placeholder="Optional notes..."
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !itemCode || !qty || !fromWarehouse || !toWarehouse}
          className="btn btn-primary w-full"
        >
          <ArrowRightLeft size={18} className="mr-2" />
          {loading ? 'Transferring...' : 'Transfer Stock'}
        </button>
      </div>
    </div>
  );
}
