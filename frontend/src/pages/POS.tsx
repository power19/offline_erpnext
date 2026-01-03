import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Plus, Minus, Trash2, User, Percent, DollarSign, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { db } from '../services/database';
import { syncService } from '../services/sync';
import { useCartStore } from '../store';
import { formatCurrency, formatQty } from '../utils/format';
import { Item, Customer, Discount, CartItem } from '../types';

export default function POSPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const {
    items: cartItems,
    customer,
    payments,
    discount,
    addItem,
    updateItemQty,
    removeItem,
    clearCart,
    setCustomer,
    setDiscount,
    addPayment,
    clearPayments,
    setItemDiscount,
    getSubtotal,
    getCartDiscount,
    getTotal,
    getTotalPaid,
    getBalance,
    warehouse
  } = useCartStore();

  // Search items from IndexedDB
  const searchResults = useLiveQuery(
    async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      return db.searchItems(searchQuery);
    },
    [searchQuery],
    []
  );

  // Search customers from IndexedDB
  const customerResults = useLiveQuery(
    async () => {
      if (!customerSearch || customerSearch.length < 2) return [];
      return db.searchCustomers(customerSearch);
    },
    [customerSearch],
    []
  );

  // Get all items for display
  const allItems = useLiveQuery(() => db.items.limit(50).toArray(), [], []);

  // Helper to get item price with fallback
  const getItemPrice = (item: Item): number => {
    return item.price_list_rate ?? item.standard_rate ?? 0;
  };

  const handleAddToCart = (item: Item) => {
    const price = getItemPrice(item);
    const cartItem: CartItem = {
      item_code: item.item_code,
      item_name: item.item_name,
      qty: 1,
      rate: price,
      amount: price,
      discount_percentage: 0,
      discount_amount: 0,
      uom: item.stock_uom,
      warehouse: warehouse?.name,
      image: item.image
    };
    addItem(cartItem);
    setSearchQuery('');
    toast.success(`Added ${item.item_name}`);
  };

  const handleCheckout = async () => {
    if (!customer) {
      toast.error('Please select a customer');
      setShowCustomerModal(true);
      return;
    }

    if (cartItems.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const balance = getBalance();
    if (balance > 0.01) {
      toast.error('Payment incomplete');
      setShowPaymentModal(true);
      return;
    }

    try {
      const invoice = await syncService.createInvoice({
        offline_id: '',
        customer: customer.name,
        customer_name: customer.customer_name,
        items: cartItems,
        payments: payments,
        discount_amount: discount?.type === 'amount' ? discount.value : 0,
        additional_discount_percentage: discount?.type === 'percentage' ? discount.value : 0,
        net_total: getSubtotal() - getCartDiscount(),
        grand_total: getTotal(),
        paid_amount: getTotalPaid(),
        outstanding_amount: 0,
        warehouse: warehouse?.name,
        posting_date: new Date().toISOString().split('T')[0],
        status: 'Paid',
        is_return: false
      });

      toast.success('Invoice created successfully!');
      clearCart();
      clearPayments();
    } catch (error) {
      toast.error('Failed to create invoice');
      console.error(error);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4 p-4">
      {/* Left side - Products */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search items by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
          />

          {/* Search results dropdown */}
          {searchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border max-h-64 overflow-auto">
              {searchResults.map((item) => (
                <button
                  key={item.item_code}
                  onClick={() => handleAddToCart(item)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex justify-between items-center border-b last:border-b-0"
                >
                  <div>
                    <div className="font-medium">{item.item_name}</div>
                    <div className="text-sm text-gray-500">{item.item_code}</div>
                  </div>
                  <div className="text-primary-600 font-medium">
                    {formatCurrency(getItemPrice(item))}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Items grid */}
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {allItems?.map((item) => (
              <button
                key={item.item_code}
                onClick={() => handleAddToCart(item)}
                className="card p-3 text-left hover:shadow-md transition-shadow"
              >
                <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={item.item_name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="text-gray-400" size={32} />
                  )}
                </div>
                <div className="font-medium text-sm truncate">{item.item_name}</div>
                <div className="text-primary-600 font-bold">
                  {formatCurrency(getItemPrice(item))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Cart */}
      <div className="w-full lg:w-96 flex flex-col card">
        {/* Customer */}
        <button
          onClick={() => setShowCustomerModal(true)}
          className="p-4 border-b flex items-center gap-3 hover:bg-gray-50"
        >
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="text-primary-600" size={20} />
          </div>
          <div className="flex-1 text-left">
            {customer ? (
              <>
                <div className="font-medium">{customer.customer_name}</div>
                <div className="text-sm text-gray-500">{customer.mobile_no || 'No phone'}</div>
              </>
            ) : (
              <div className="text-gray-500">Select Customer</div>
            )}
          </div>
        </button>

        {/* Cart items */}
        <div className="flex-1 overflow-auto p-4">
          {cartItems.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              Cart is empty
            </div>
          ) : (
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div key={item.item_code} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.item_name}</div>
                      <div className="text-xs text-gray-500">{formatCurrency(item.rate)} each</div>
                    </div>
                    <button
                      onClick={() => removeItem(item.item_code)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateItemQty(item.item_code, item.qty - 1)}
                        className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-12 text-center font-medium">{item.qty}</span>
                      <button
                        onClick={() => updateItemQty(item.item_code, item.qty + 1)}
                        className="w-8 h-8 bg-white border rounded-lg flex items-center justify-center"
                      >
                        <Plus size={16} />
                      </button>
                    </div>

                    <div className="text-right">
                      {(item.discount_percentage > 0 || item.discount_amount > 0) && (
                        <div className="text-xs text-green-600">
                          -{item.discount_percentage > 0 ? `${item.discount_percentage}%` : formatCurrency(item.discount_amount)}
                        </div>
                      )}
                      <div className="font-bold">{formatCurrency(item.amount)}</div>
                    </div>
                  </div>

                  {/* Item discount button */}
                  <button
                    onClick={() => {
                      setSelectedItem({ item_code: item.item_code, item_name: item.item_name } as Item);
                      setShowDiscountModal(true);
                    }}
                    className="mt-2 text-xs text-primary-600 hover:underline"
                  >
                    Add discount
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="border-t p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span>{formatCurrency(getSubtotal())}</span>
          </div>

          {getCartDiscount() > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>Discount</span>
              <span>-{formatCurrency(getCartDiscount())}</span>
            </div>
          )}

          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatCurrency(getTotal())}</span>
          </div>

          {payments.length > 0 && (
            <>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Paid</span>
                <span>{formatCurrency(getTotalPaid())}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span>Balance</span>
                <span className={getBalance() > 0 ? 'text-red-600' : 'text-green-600'}>
                  {formatCurrency(Math.abs(getBalance()))}
                  {getBalance() < 0 && ' (Change)'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t space-y-2">
          <div className="flex gap-2">
            <button
              onClick={() => setShowDiscountModal(true)}
              className="btn btn-secondary flex-1"
            >
              <Percent size={18} className="mr-1" />
              Discount
            </button>
            <button
              onClick={() => setShowPaymentModal(true)}
              className="btn btn-secondary flex-1"
            >
              <DollarSign size={18} className="mr-1" />
              Payment
            </button>
          </div>
          <button
            onClick={handleCheckout}
            disabled={cartItems.length === 0}
            className="btn btn-primary w-full btn-lg"
          >
            Complete Sale
          </button>
        </div>
      </div>

      {/* Customer Modal */}
      {showCustomerModal && (
        <Modal title="Select Customer" onClose={() => setShowCustomerModal(false)}>
          <div className="p-4">
            <input
              type="text"
              placeholder="Search by name or phone..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="input mb-4"
              autoFocus
            />

            <div className="max-h-64 overflow-auto space-y-2">
              {customerResults?.map((c) => (
                <button
                  key={c.name}
                  onClick={() => {
                    setCustomer(c);
                    setShowCustomerModal(false);
                    setCustomerSearch('');
                  }}
                  className="w-full p-3 text-left bg-gray-50 rounded-lg hover:bg-gray-100"
                >
                  <div className="font-medium">{c.customer_name}</div>
                  <div className="text-sm text-gray-500">{c.mobile_no || 'No phone'}</div>
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          total={getTotal()}
          paid={getTotalPaid()}
          onAddPayment={addPayment}
          onClose={() => setShowPaymentModal(false)}
        />
      )}

      {/* Discount Modal */}
      {showDiscountModal && (
        <DiscountModal
          itemCode={selectedItem?.item_code}
          onApply={(discount) => {
            if (selectedItem) {
              setItemDiscount(selectedItem.item_code, discount);
            } else {
              setDiscount(discount);
            }
            setShowDiscountModal(false);
            setSelectedItem(null);
          }}
          onClose={() => {
            setShowDiscountModal(false);
            setSelectedItem(null);
          }}
        />
      )}
    </div>
  );
}

// Package icon for items without images
function Package(props: { className?: string; size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={props.size || 24}
      height={props.size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
    >
      <path d="m7.5 4.27 9 5.15" />
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

// Modal component
function Modal({
  title,
  children,
  onClose
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

// Payment Modal
function PaymentModal({
  total,
  paid,
  onAddPayment,
  onClose
}: {
  total: number;
  paid: number;
  onAddPayment: (payment: { mode_of_payment: string; amount: number }) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(Math.max(0, total - paid)));
  const [mode, setMode] = useState('Cash');

  const paymentModes = useLiveQuery(() => db.paymentMethods.toArray(), [], []);

  const handleSubmit = () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0) {
      onAddPayment({ mode_of_payment: mode, amount: numAmount });
      onClose();
    }
  };

  return (
    <Modal title="Add Payment" onClose={onClose}>
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Payment Method</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="input"
          >
            {paymentModes && paymentModes.length > 0 ? (
              paymentModes.map((pm, idx) => (
                <option key={pm.id ?? `${pm.name}-${idx}`} value={pm.name}>
                  {pm.name}
                </option>
              ))
            ) : (
              <>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </>
            )}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input text-lg font-bold"
            step="0.01"
            min="0"
          />
        </div>

        <div className="flex gap-2">
          {[10, 20, 50, 100].map((val) => (
            <button
              key={val}
              onClick={() => setAmount(String(val))}
              className="btn btn-secondary flex-1"
            >
              ${val}
            </button>
          ))}
        </div>

        <button onClick={handleSubmit} className="btn btn-primary w-full">
          Add Payment
        </button>
      </div>
    </Modal>
  );
}

// Discount Modal
function DiscountModal({
  itemCode,
  onApply,
  onClose
}: {
  itemCode?: string;
  onApply: (discount: Discount) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<'percentage' | 'amount'>('percentage');
  const [value, setValue] = useState('');

  const handleApply = () => {
    const numValue = parseFloat(value);
    if (numValue > 0) {
      onApply({ type, value: numValue });
    }
  };

  return (
    <Modal title={itemCode ? 'Item Discount' : 'Cart Discount'} onClose={onClose}>
      <div className="p-4 space-y-4">
        <div className="flex gap-2">
          <button
            onClick={() => setType('percentage')}
            className={`btn flex-1 ${type === 'percentage' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Percent size={18} className="mr-1" />
            Percentage
          </button>
          <button
            onClick={() => setType('amount')}
            className={`btn flex-1 ${type === 'amount' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <DollarSign size={18} className="mr-1" />
            Amount
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            {type === 'percentage' ? 'Discount %' : 'Discount Amount'}
          </label>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="input text-lg font-bold"
            placeholder={type === 'percentage' ? '10' : '5.00'}
            step={type === 'percentage' ? '1' : '0.01'}
            min="0"
            max={type === 'percentage' ? '100' : undefined}
          />
        </div>

        {type === 'percentage' && (
          <div className="flex gap-2">
            {[5, 10, 15, 20].map((val) => (
              <button
                key={val}
                onClick={() => setValue(String(val))}
                className="btn btn-secondary flex-1"
              >
                {val}%
              </button>
            ))}
          </div>
        )}

        <button onClick={handleApply} className="btn btn-primary w-full">
          Apply Discount
        </button>
      </div>
    </Modal>
  );
}
