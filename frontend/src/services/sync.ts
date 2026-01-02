import { db } from './database';
import { api } from './api';
import { v4 as uuidv4 } from 'uuid';
import { POSInvoice, StockEntry, SyncQueueItem } from '../types';

class SyncService {
  private syncInProgress = false;
  private onlineStatus = navigator.onLine;

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.onlineStatus = true;
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.onlineStatus = false;
    });
  }

  isOnline(): boolean {
    return this.onlineStatus;
  }

  async checkConnection(): Promise<boolean> {
    try {
      const status = await api.getSyncStatus();
      this.onlineStatus = status.online;
      return status.online;
    } catch {
      this.onlineStatus = false;
      return false;
    }
  }

  // Add item to sync queue
  async queueForSync(
    doctype: string,
    action: 'create' | 'update' | 'delete',
    data: Record<string, unknown>,
    offlineId?: string
  ): Promise<string> {
    const id = offlineId || uuidv4();

    const queueItem: Omit<SyncQueueItem, 'id'> = {
      offline_id: id,
      doctype,
      action,
      data,
      status: 'pending',
      retry_count: 0,
      created_at: new Date()
    };

    await db.syncQueue.add(queueItem);

    // Try immediate sync if online
    if (this.onlineStatus) {
      this.triggerSync();
    }

    return id;
  }

  // Main sync function
  async triggerSync(): Promise<{ success: boolean; synced: number; failed: number }> {
    if (this.syncInProgress || !this.onlineStatus) {
      return { success: false, synced: 0, failed: 0 };
    }

    this.syncInProgress = true;
    let synced = 0;
    let failed = 0;

    try {
      // Get pending items
      const pendingItems = await db.getPendingSyncItems();

      if (pendingItems.length === 0) {
        return { success: true, synced: 0, failed: 0 };
      }

      // Prepare items for sync
      const syncItems = pendingItems.map(item => ({
        offline_id: item.offline_id,
        doctype: item.doctype,
        action: item.action,
        data: item.data,
        created_at: item.created_at.toISOString()
      }));

      // Push to server
      const result = await api.pushData(syncItems);

      // Process results
      for (const resultItem of result.results) {
        const queueItem = pendingItems.find(p => p.offline_id === resultItem.offline_id);

        if (queueItem) {
          if (resultItem.status === 'completed') {
            // Update queue item
            await db.syncQueue.update(queueItem.id!, {
              status: 'completed',
              processed_at: new Date()
            });

            // Update the actual document with ERPNext name
            if (resultItem.erpnext_name) {
              await this.updateDocumentWithErpName(
                queueItem.doctype,
                queueItem.offline_id,
                resultItem.erpnext_name
              );
            }

            synced++;
          } else {
            await db.syncQueue.update(queueItem.id!, {
              status: 'failed',
              error: resultItem.error,
              retry_count: queueItem.retry_count + 1
            });
            failed++;
          }
        }
      }

      // Update last sync time
      await db.setSetting('lastSync', new Date().toISOString());

      return { success: failed === 0, synced, failed };
    } catch (error) {
      console.error('Sync error:', error);
      return { success: false, synced, failed: failed + 1 };
    } finally {
      this.syncInProgress = false;
    }
  }

  private async updateDocumentWithErpName(
    doctype: string,
    offlineId: string,
    erpName: string
  ): Promise<void> {
    switch (doctype) {
      case 'POS Invoice':
        const invoice = await db.invoices
          .where('offline_id')
          .equals(offlineId)
          .first();
        if (invoice) {
          await db.invoices.update(invoice.id!, {
            name: erpName,
            synced: true,
            synced_at: new Date()
          });
        }
        break;

      case 'Stock Entry':
        const stockEntry = await db.stockEntries
          .where('offline_id')
          .equals(offlineId)
          .first();
        if (stockEntry) {
          await db.stockEntries.update(stockEntry.id!, {
            name: erpName,
            synced: true
          });
        }
        break;
    }
  }

  // Pull latest data from ERPNext
  async pullLatestData(): Promise<void> {
    if (!this.onlineStatus) {
      throw new Error('Cannot pull data while offline');
    }

    const lastSync = await db.getSetting('lastSync');

    const data = await api.pullData(
      ['Item', 'Customer', 'Warehouse', 'POS Profile', 'Mode of Payment'],
      lastSync
    );

    // Update local database
    if (data.items?.length > 0) {
      await db.items.bulkPut(
        data.items.map((item: Record<string, unknown>) => ({ ...item, synced: true }))
      );
    }

    if (data.customers?.length > 0) {
      await db.customers.bulkPut(
        data.customers.map((c: Record<string, unknown>) => ({ ...c, synced: true }))
      );
    }

    if (data.warehouses?.length > 0) {
      await db.warehouses.bulkPut(data.warehouses);
    }

    if (data.pos_profiles?.length > 0) {
      await db.posProfiles.bulkPut(data.pos_profiles);
    }

    if (data.payment_methods?.length > 0) {
      await db.paymentMethods.bulkPut(data.payment_methods);
    }

    await db.setSetting('lastSync', new Date().toISOString());
  }

  // Get sync status
  async getSyncStatus(): Promise<{
    pendingCount: number;
    failedCount: number;
    lastSync: string | null;
    isOnline: boolean;
  }> {
    const pending = await db.syncQueue.where('status').equals('pending').count();
    const failed = await db.syncQueue.where('status').equals('failed').count();
    const lastSync = await db.getSetting('lastSync');

    return {
      pendingCount: pending,
      failedCount: failed,
      lastSync: lastSync || null,
      isOnline: this.onlineStatus
    };
  }

  // Retry failed syncs
  async retryFailed(): Promise<void> {
    const failedItems = await db.syncQueue
      .where('status')
      .equals('failed')
      .toArray();

    // Reset failed items to pending
    for (const item of failedItems) {
      if (item.retry_count < 3) {
        await db.syncQueue.update(item.id!, { status: 'pending' });
      }
    }

    // Trigger sync
    await this.triggerSync();
  }

  // Create invoice (with offline support)
  async createInvoice(invoice: Omit<POSInvoice, 'id' | 'synced' | 'created_at'>): Promise<POSInvoice> {
    const offlineId = uuidv4();
    const now = new Date();

    const newInvoice: Omit<POSInvoice, 'id'> = {
      ...invoice,
      offline_id: offlineId,
      synced: false,
      created_at: now
    };

    const id = await db.invoices.add(newInvoice);

    // Update local stock
    for (const item of invoice.items) {
      if (invoice.warehouse) {
        await db.updateStockBalance(
          item.item_code,
          invoice.warehouse,
          -item.qty // Reduce stock
        );
      }
    }

    // Queue for sync
    await this.queueForSync('POS Invoice', 'create', {
      customer: invoice.customer,
      items: invoice.items,
      payments: invoice.payments,
      discount_amount: invoice.discount_amount,
      additional_discount_percentage: invoice.additional_discount_percentage,
      is_return: invoice.is_return,
      return_against: invoice.return_against
    }, offlineId);

    return { ...newInvoice, id };
  }

  // Create stock entry (with offline support)
  async createStockEntry(entry: Omit<StockEntry, 'id' | 'synced' | 'created_at'>): Promise<StockEntry> {
    const offlineId = uuidv4();
    const now = new Date();

    const newEntry: Omit<StockEntry, 'id'> = {
      ...entry,
      offline_id: offlineId,
      synced: false,
      created_at: now
    };

    const id = await db.stockEntries.add(newEntry);

    // Update local stock based on entry type
    for (const item of entry.items) {
      if (entry.stock_entry_type === 'Material Receipt' && entry.to_warehouse) {
        await db.updateStockBalance(item.item_code, entry.to_warehouse, item.qty);
      } else if (entry.stock_entry_type === 'Material Issue' && entry.from_warehouse) {
        await db.updateStockBalance(item.item_code, entry.from_warehouse, -item.qty);
      } else if (entry.stock_entry_type === 'Material Transfer') {
        if (item.s_warehouse) {
          await db.updateStockBalance(item.item_code, item.s_warehouse, -item.qty);
        }
        if (item.t_warehouse) {
          await db.updateStockBalance(item.item_code, item.t_warehouse, item.qty);
        }
      }
    }

    // Queue for sync
    await this.queueForSync('Stock Entry', 'create', {
      stock_entry_type: entry.stock_entry_type,
      items: entry.items,
      from_warehouse: entry.from_warehouse,
      to_warehouse: entry.to_warehouse,
      remarks: entry.remarks
    }, offlineId);

    return { ...newEntry, id };
  }
}

export const syncService = new SyncService();
