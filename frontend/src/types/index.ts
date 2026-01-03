// Item types
export interface Item {
  id?: number;
  name: string;
  item_code: string;
  item_name: string;
  item_group?: string;
  stock_uom: string;
  description?: string;
  image?: string;
  standard_rate?: number;
  price_list_rate: number;
  has_variants?: number;
  variant_of?: string;
  synced?: boolean;
}

// Customer types
export interface Customer {
  id?: number;
  name: string;
  customer_name: string;
  customer_group?: string;
  territory?: string;
  mobile_no?: string;
  email_id?: string;
  synced?: boolean;
}

// Warehouse types
export interface Warehouse {
  id?: number;
  name: string;
  warehouse_name: string;
  warehouse_type?: string;
  company?: string;
}

// Cart item for POS
export interface CartItem {
  item_code: string;
  item_name: string;
  qty: number;
  rate: number;
  amount: number;
  discount_percentage: number;
  discount_amount: number;
  uom: string;
  warehouse?: string;
  image?: string;
}

// Payment
export interface Payment {
  mode_of_payment: string;
  amount: number;
  account?: string;
}

// POS Invoice
export interface POSInvoice {
  id?: number;
  offline_id: string;
  name?: string; // ERPNext name after sync
  customer: string;
  customer_name?: string;
  items: CartItem[];
  payments: Payment[];
  discount_amount: number;
  additional_discount_percentage: number;
  net_total: number;
  grand_total: number;
  paid_amount: number;
  outstanding_amount: number;
  pos_profile?: string;
  warehouse?: string;
  remarks?: string;
  posting_date: string;
  posting_time?: string;
  status: 'Draft' | 'Paid' | 'Consolidated' | 'Return';
  is_return: boolean;
  return_against?: string;
  synced: boolean;
  created_at: Date;
  synced_at?: Date;
}

// Stock Balance
export interface StockBalance {
  id?: number;
  item_code: string;
  item_name?: string;
  warehouse: string;
  actual_qty: number;
  reserved_qty: number;
  projected_qty: number;
  available_qty: number;
  last_updated: Date;
}

// Stock Entry for transfers and receipts
export interface StockEntry {
  id?: number;
  offline_id: string;
  name?: string;
  stock_entry_type: 'Material Receipt' | 'Material Issue' | 'Material Transfer';
  items: StockEntryItem[];
  from_warehouse?: string;
  to_warehouse?: string;
  remarks?: string;
  posting_date: string;
  synced: boolean;
  created_at: Date;
}

export interface StockEntryItem {
  item_code: string;
  item_name?: string;
  qty: number;
  uom: string;
  s_warehouse?: string;
  t_warehouse?: string;
  basic_rate?: number;
}

// Sync queue item
export interface SyncQueueItem {
  id?: number;
  offline_id: string;
  doctype: string;
  action: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
  retry_count: number;
  created_at: Date;
  processed_at?: Date;
}

// POS Profile
export interface POSProfile {
  id?: number;
  name: string;
  warehouse?: string;
  company?: string;
  currency?: string;
  selling_price_list?: string;
  // Print settings
  print_format?: string;
  letter_head?: string;
  tc_name?: string;  // Terms and Conditions
  customer?: string;  // Default customer (Walk-in)
}

// Payment Method
export interface PaymentMethod {
  id?: number;
  name: string;
  type?: string;
  enabled?: boolean;
}

// App settings
export interface AppSettings {
  id?: number;
  key: string;
  value: string;
}

// Return item with calculations
export interface ReturnableItem {
  item_code: string;
  item_name?: string;
  original_qty: number;
  returned_qty: number;
  returnable_qty: number;
  rate: number;
}

// Discount types
export type DiscountType = 'percentage' | 'amount';

export interface Discount {
  type: DiscountType;
  value: number;
}
