import Dexie, { Table } from 'dexie';
import {
  Item,
  Customer,
  Warehouse,
  POSInvoice,
  StockBalance,
  StockEntry,
  SyncQueueItem,
  POSProfile,
  PaymentMethod,
  AppSettings
} from '../types';

export class OfflinePOSDatabase extends Dexie {
  items!: Table<Item>;
  customers!: Table<Customer>;
  warehouses!: Table<Warehouse>;
  invoices!: Table<POSInvoice>;
  stockBalance!: Table<StockBalance>;
  stockEntries!: Table<StockEntry>;
  syncQueue!: Table<SyncQueueItem>;
  posProfiles!: Table<POSProfile>;
  paymentMethods!: Table<PaymentMethod>;
  settings!: Table<AppSettings>;

  constructor() {
    super('OfflinePOSDB');

    this.version(1).stores({
      items: '++id, name, item_code, item_name, item_group, synced',
      customers: '++id, name, customer_name, mobile_no, synced',
      warehouses: '++id, name, warehouse_name',
      invoices: '++id, offline_id, name, customer, posting_date, status, synced, is_return, return_against',
      stockBalance: '++id, [item_code+warehouse], item_code, warehouse',
      stockEntries: '++id, offline_id, name, stock_entry_type, synced',
      syncQueue: '++id, offline_id, doctype, status, created_at',
      posProfiles: '++id, name',
      paymentMethods: '++id, name',
      settings: '++id, &key'
    });
  }

  // Helper methods for common operations

  async getSetting(key: string): Promise<string | undefined> {
    const setting = await this.settings.where('key').equals(key).first();
    return setting?.value;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const existing = await this.settings.where('key').equals(key).first();
    if (existing) {
      await this.settings.update(existing.id!, { value });
    } else {
      await this.settings.add({ key, value });
    }
  }

  async getUnsyncedInvoices(): Promise<POSInvoice[]> {
    return this.invoices.where('synced').equals(0).toArray();
  }

  async getUnsyncedStockEntries(): Promise<StockEntry[]> {
    return this.stockEntries.where('synced').equals(0).toArray();
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    return this.syncQueue.where('status').equals('pending').toArray();
  }

  async updateStockBalance(
    itemCode: string,
    warehouse: string,
    qtyChange: number
  ): Promise<void> {
    const existing = await this.stockBalance
      .where('[item_code+warehouse]')
      .equals([itemCode, warehouse])
      .first();

    if (existing) {
      await this.stockBalance.update(existing.id!, {
        actual_qty: existing.actual_qty + qtyChange,
        available_qty: existing.available_qty + qtyChange,
        last_updated: new Date()
      });
    }
  }

  async searchItems(query: string): Promise<Item[]> {
    const lowerQuery = query.toLowerCase();
    return this.items
      .filter(item =>
        item.item_code.toLowerCase().includes(lowerQuery) ||
        item.item_name.toLowerCase().includes(lowerQuery)
      )
      .limit(20)
      .toArray();
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    const lowerQuery = query.toLowerCase();
    return this.customers
      .filter(customer =>
        customer.customer_name.toLowerCase().includes(lowerQuery) ||
        (customer.mobile_no?.includes(query) ?? false)
      )
      .limit(15)
      .toArray();
  }

  async getItemStock(itemCode: string, warehouse?: string): Promise<StockBalance[]> {
    if (warehouse) {
      const stock = await this.stockBalance
        .where('[item_code+warehouse]')
        .equals([itemCode, warehouse])
        .first();
      return stock ? [stock] : [];
    }
    return this.stockBalance.where('item_code').equals(itemCode).toArray();
  }

  async clearAllData(): Promise<void> {
    await Promise.all([
      this.items.clear(),
      this.customers.clear(),
      this.warehouses.clear(),
      this.stockBalance.clear(),
      this.posProfiles.clear(),
      this.paymentMethods.clear()
    ]);
  }
}

export const db = new OfflinePOSDatabase();
