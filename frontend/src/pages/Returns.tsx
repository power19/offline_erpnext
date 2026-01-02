import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, RotateCcw, Check, X, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../services/database';
import { api } from '../services/api';
import { syncService } from '../services/sync';
import { formatCurrency, formatDate } from '../utils/format';
import { POSInvoice, ReturnableItem, Payment } from '../types';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function ReturnsPage() {
  const isOnline = useOnlineStatus();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<POSInvoice | null>(null);
  const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Search invoices locally first, then online if available
  const localInvoices = useLiveQuery(
    async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      return db.invoices
        .filter((inv) =>
          !inv.is_return &&
          (inv.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            inv.offline_id.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        .limit(20)
        .toArray();
    },
    [searchQuery],
    []
  );

  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) return;

    if (isOnline) {
      setLoading(true);
      try {
        const results = await api.searchInvoices(searchQuery);
        // Combine with local results, removing duplicates
        const allResults = [...(localInvoices || [])];
        for (const inv of results) {
          if (!allResults.find((i) => i.name === inv.name)) {
            allResults.push(inv);
          }
        }
        return allResults;
      } catch (error) {
        console.error('Online search failed:', error);
      } finally {
        setLoading(false);
      }
    }

    return localInvoices;
  };

  const handleSelectInvoice = async (invoice: POSInvoice) => {
    setSelectedInvoice(invoice);
    setLoading(true);

    try {
      if (isOnline && invoice.name) {
        // Get returnable items from server
        const data = await api.getReturnableItems(invoice.name);
        setReturnableItems(data.items);
      } else {
        // Calculate locally for offline invoices
        setReturnableItems(
          invoice.items.map((item) => ({
            item_code: item.item_code,
            item_name: item.item_name,
            original_qty: item.qty,
            returned_qty: 0,
            returnable_qty: item.qty,
            rate: item.rate
          }))
        );
      }

      // Initialize return quantities to 0
      const quantities: Record<string, number> = {};
      invoice.items.forEach((item) => {
        quantities[item.item_code] = 0;
      });
      setReturnQuantities(quantities);
    } catch (error) {
      toast.error('Failed to load invoice details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuantityChange = (itemCode: string, qty: number) => {
    const item = returnableItems.find((i) => i.item_code === itemCode);
    if (item) {
      const validQty = Math.max(0, Math.min(qty, item.returnable_qty));
      setReturnQuantities((prev) => ({ ...prev, [itemCode]: validQty }));
    }
  };

  const getReturnTotal = () => {
    return returnableItems.reduce((sum, item) => {
      const qty = returnQuantities[item.item_code] || 0;
      return sum + qty * item.rate;
    }, 0);
  };

  const handleProcessReturn = async () => {
    if (!selectedInvoice) return;

    const itemsToReturn = returnableItems
      .filter((item) => (returnQuantities[item.item_code] || 0) > 0)
      .map((item) => ({
        item_code: item.item_code,
        item_name: item.item_name,
        qty: returnQuantities[item.item_code],
        rate: item.rate
      }));

    if (itemsToReturn.length === 0) {
      toast.error('Please select items to return');
      return;
    }

    setLoading(true);

    try {
      const returnTotal = getReturnTotal();
      const payment: Payment = {
        mode_of_payment: 'Cash', // Default to cash refund
        amount: -returnTotal
      };

      // Create return invoice
      await syncService.createInvoice({
        offline_id: '',
        customer: selectedInvoice.customer,
        customer_name: selectedInvoice.customer_name,
        items: itemsToReturn.map((item) => ({
          item_code: item.item_code,
          item_name: item.item_name || '',
          qty: -item.qty, // Negative for returns
          rate: item.rate,
          amount: -(item.qty * item.rate),
          discount_percentage: 0,
          discount_amount: 0,
          uom: 'Nos'
        })),
        payments: [payment],
        discount_amount: 0,
        additional_discount_percentage: 0,
        net_total: -returnTotal,
        grand_total: -returnTotal,
        paid_amount: -returnTotal,
        outstanding_amount: 0,
        posting_date: new Date().toISOString().split('T')[0],
        status: 'Return',
        is_return: true,
        return_against: selectedInvoice.name || selectedInvoice.offline_id
      });

      toast.success('Return processed successfully!');
      setSelectedInvoice(null);
      setReturnableItems([]);
      setReturnQuantities({});
      setShowConfirm(false);
    } catch (error) {
      toast.error('Failed to process return');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col p-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-2">Process Return</h1>
        <p className="text-gray-500">Search for an invoice to process a return</p>
      </div>

      {!selectedInvoice ? (
        <>
          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by invoice number or customer name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>

          {/* Results */}
          <div className="flex-1 overflow-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : localInvoices && localInvoices.length > 0 ? (
              <div className="space-y-2">
                {localInvoices.map((invoice) => (
                  <button
                    key={invoice.offline_id}
                    onClick={() => handleSelectInvoice(invoice)}
                    className="w-full card p-4 text-left hover:shadow-md transition-shadow flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">
                        {invoice.name || invoice.offline_id}
                        {!invoice.synced && (
                          <span className="ml-2 badge badge-warning">Pending sync</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {invoice.customer_name} • {formatDate(invoice.posting_date)}
                      </div>
                      <div className="text-primary-600 font-bold mt-1">
                        {formatCurrency(invoice.grand_total)}
                      </div>
                    </div>
                    <ChevronRight className="text-gray-400" />
                  </button>
                ))}
              </div>
            ) : searchQuery.length >= 2 ? (
              <div className="text-center text-gray-500 py-8">
                No invoices found
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                Enter at least 2 characters to search
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Selected invoice header */}
          <div className="card p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-lg">
                  {selectedInvoice.name || selectedInvoice.offline_id}
                </div>
                <div className="text-gray-500">
                  {selectedInvoice.customer_name} • {formatDate(selectedInvoice.posting_date)}
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedInvoice(null);
                  setReturnableItems([]);
                }}
                className="btn btn-secondary"
              >
                <X size={18} className="mr-1" />
                Cancel
              </button>
            </div>
          </div>

          {/* Returnable items */}
          <div className="flex-1 overflow-auto">
            <div className="space-y-3">
              {returnableItems.map((item) => (
                <div key={item.item_code} className="card p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="font-medium">{item.item_name || item.item_code}</div>
                      <div className="text-sm text-gray-500">
                        Original: {item.original_qty} • Returnable: {item.returnable_qty}
                      </div>
                      <div className="text-primary-600">{formatCurrency(item.rate)} each</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="text-sm text-gray-600">Return Qty:</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleQuantityChange(
                            item.item_code,
                            (returnQuantities[item.item_code] || 0) - 1
                          )
                        }
                        className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg font-bold"
                        disabled={!returnQuantities[item.item_code]}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={returnQuantities[item.item_code] || 0}
                        onChange={(e) =>
                          handleQuantityChange(item.item_code, parseInt(e.target.value) || 0)
                        }
                        className="w-20 text-center input"
                        min="0"
                        max={item.returnable_qty}
                      />
                      <button
                        onClick={() =>
                          handleQuantityChange(
                            item.item_code,
                            (returnQuantities[item.item_code] || 0) + 1
                          )
                        }
                        className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-lg font-bold"
                        disabled={returnQuantities[item.item_code] >= item.returnable_qty}
                      >
                        +
                      </button>
                    </div>

                    {/* Quick select all */}
                    <button
                      onClick={() => handleQuantityChange(item.item_code, item.returnable_qty)}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      Return all
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Return summary */}
          <div className="card mt-4 p-4">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-bold">Refund Amount</span>
              <span className="text-2xl font-bold text-green-600">
                {formatCurrency(getReturnTotal())}
              </span>
            </div>

            <button
              onClick={() => setShowConfirm(true)}
              disabled={getReturnTotal() === 0 || loading}
              className="btn btn-primary w-full btn-lg"
            >
              <RotateCcw size={20} className="mr-2" />
              Process Return
            </button>
          </div>
        </>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold mb-4">Confirm Return</h3>
            <p className="text-gray-600 mb-4">
              Process return of {formatCurrency(getReturnTotal())} for{' '}
              {Object.values(returnQuantities).reduce((a, b) => a + b, 0)} item(s)?
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleProcessReturn}
                disabled={loading}
                className="btn btn-success flex-1"
              >
                <Check size={18} className="mr-1" />
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
