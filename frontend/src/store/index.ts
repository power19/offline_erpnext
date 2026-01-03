import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, Customer, Payment, Discount, Warehouse, POSProfile } from '../types';

interface CartState {
  items: CartItem[];
  customer: Customer | null;
  payments: Payment[];
  discount: Discount | null;
  warehouse: Warehouse | null;
  posProfile: POSProfile | null;

  // Cart actions
  addItem: (item: CartItem) => void;
  updateItemQty: (itemCode: string, qty: number) => void;
  removeItem: (itemCode: string) => void;
  clearCart: () => void;

  // Item discount
  setItemDiscount: (itemCode: string, discount: Discount) => void;

  // Customer
  setCustomer: (customer: Customer | null) => void;

  // Payments
  addPayment: (payment: Payment) => void;
  removePayment: (index: number) => void;
  clearPayments: () => void;

  // Cart-level discount
  setDiscount: (discount: Discount | null) => void;

  // Settings
  setWarehouse: (warehouse: Warehouse | null) => void;
  setPosProfile: (profile: POSProfile | null) => void;

  // Calculated values
  getSubtotal: () => number;
  getItemDiscountTotal: () => number;
  getCartDiscount: () => number;
  getTotal: () => number;
  getTotalPaid: () => number;
  getBalance: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      customer: null,
      payments: [],
      discount: null,
      warehouse: null,
      posProfile: null,

      addItem: (item) => {
        const { items } = get();
        const existingIndex = items.findIndex(i => i.item_code === item.item_code);

        if (existingIndex >= 0) {
          // Update quantity if item exists
          const updatedItems = [...items];
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            qty: updatedItems[existingIndex].qty + item.qty,
            amount: (updatedItems[existingIndex].qty + item.qty) * item.rate
          };
          set({ items: updatedItems });
        } else {
          // Add new item
          set({ items: [...items, { ...item, amount: item.qty * item.rate }] });
        }
      },

      updateItemQty: (itemCode, qty) => {
        if (qty <= 0) {
          get().removeItem(itemCode);
          return;
        }

        const { items } = get();
        const updatedItems = items.map(item => {
          if (item.item_code === itemCode) {
            const baseAmount = qty * item.rate;
            let finalAmount = baseAmount;

            if (item.discount_percentage > 0) {
              finalAmount = baseAmount * (1 - item.discount_percentage / 100);
            } else if (item.discount_amount > 0) {
              // discount_amount is a flat discount for the entire line
              finalAmount = baseAmount - item.discount_amount;
            }

            return { ...item, qty, amount: finalAmount };
          }
          return item;
        });
        set({ items: updatedItems });
      },

      removeItem: (itemCode) => {
        set({ items: get().items.filter(i => i.item_code !== itemCode) });
      },

      clearCart: () => {
        set({
          items: [],
          customer: null,
          payments: [],
          discount: null
        });
      },

      setItemDiscount: (itemCode, discount) => {
        const { items } = get();
        const updatedItems = items.map(item => {
          if (item.item_code === itemCode) {
            const baseAmount = item.qty * item.rate;
            let finalAmount = baseAmount;

            if (discount.type === 'percentage') {
              finalAmount = baseAmount * (1 - discount.value / 100);
              return {
                ...item,
                discount_percentage: discount.value,
                discount_amount: 0,
                amount: finalAmount
              };
            } else {
              // discount_amount is a flat discount for the entire line
              finalAmount = baseAmount - discount.value;
              return {
                ...item,
                discount_percentage: 0,
                discount_amount: discount.value,
                amount: Math.max(0, finalAmount)
              };
            }
          }
          return item;
        });
        set({ items: updatedItems });
      },

      setCustomer: (customer) => set({ customer }),

      addPayment: (payment) => {
        set({ payments: [...get().payments, payment] });
      },

      removePayment: (index) => {
        const payments = [...get().payments];
        payments.splice(index, 1);
        set({ payments });
      },

      clearPayments: () => set({ payments: [] }),

      setDiscount: (discount) => set({ discount }),

      setWarehouse: (warehouse) => set({ warehouse }),

      setPosProfile: (posProfile) => set({ posProfile }),

      getSubtotal: () => {
        return get().items.reduce((sum, item) => sum + (item.qty * item.rate), 0);
      },

      getItemDiscountTotal: () => {
        const { items } = get();
        return items.reduce((sum, item) => {
          const baseAmount = item.qty * item.rate;
          return sum + (baseAmount - item.amount);
        }, 0);
      },

      getCartDiscount: () => {
        const { discount, items } = get();
        if (!discount) return 0;

        const subtotal = items.reduce((sum, item) => sum + item.amount, 0);

        if (discount.type === 'percentage') {
          return subtotal * (discount.value / 100);
        }
        return discount.value;
      },

      getTotal: () => {
        const { items, discount } = get();
        let total = items.reduce((sum, item) => sum + item.amount, 0);

        if (discount) {
          if (discount.type === 'percentage') {
            total = total * (1 - discount.value / 100);
          } else {
            total = total - discount.value;
          }
        }

        return Math.max(0, total);
      },

      getTotalPaid: () => {
        return get().payments.reduce((sum, p) => sum + p.amount, 0);
      },

      getBalance: () => {
        return get().getTotal() - get().getTotalPaid();
      }
    }),
    {
      name: 'pos-cart-storage',
      partialize: (state) => ({
        items: state.items,
        customer: state.customer,
        warehouse: state.warehouse,
        posProfile: state.posProfile
      })
    }
  )
);

// App-wide state
interface AppState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingSyncCount: number;
  lastSyncTime: string | null;
  darkMode: boolean;

  setOnlineStatus: (status: boolean) => void;
  setSyncing: (status: boolean) => void;
  setPendingSyncCount: (count: number) => void;
  setLastSyncTime: (time: string | null) => void;
  toggleDarkMode: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      isOnline: navigator.onLine,
      isSyncing: false,
      pendingSyncCount: 0,
      lastSyncTime: null,
      darkMode: false,

      setOnlineStatus: (status) => set({ isOnline: status }),
      setSyncing: (status) => set({ isSyncing: status }),
      setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
      setLastSyncTime: (time) => set({ lastSyncTime: time }),
      toggleDarkMode: () => set({ darkMode: !get().darkMode })
    }),
    {
      name: 'pos-app-settings'
    }
  )
);
