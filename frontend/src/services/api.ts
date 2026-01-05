import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class ApiService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => {
        console.error('API Error:', error);
        throw error;
      }
    );
  }

  // Items
  async getItems(params?: { search?: string; item_group?: string; limit?: number }) {
    const response = await this.client.get('/items', { params });
    return response.data;
  }

  async getItem(itemCode: string, warehouse?: string) {
    const response = await this.client.get(`/items/${itemCode}`, {
      params: warehouse ? { warehouse } : undefined
    });
    return response.data;
  }

  async getItemByBarcode(barcode: string) {
    const response = await this.client.get(`/items/barcode/${barcode}`);
    return response.data;
  }

  async getItemGroups() {
    const response = await this.client.get('/items/groups/list');
    return response.data;
  }

  // Customers
  async getCustomers(params?: { search?: string; limit?: number }) {
    const response = await this.client.get('/customers', { params });
    return response.data;
  }

  async searchCustomers(query: string) {
    const response = await this.client.get('/customers/search', { params: { q: query } });
    return response.data;
  }

  async createCustomer(data: { customer_name: string; mobile_no?: string; email_id?: string }) {
    const response = await this.client.post('/customers', data);
    return response.data;
  }

  // Invoices
  async getInvoices(params?: { customer?: string; from_date?: string; to_date?: string; limit?: number }) {
    const response = await this.client.get('/invoices', { params });
    return response.data;
  }

  async searchInvoices(query: string) {
    const response = await this.client.get('/invoices/search', { params: { q: query } });
    return response.data;
  }

  async getInvoice(invoiceName: string) {
    const response = await this.client.get(`/invoices/${invoiceName}`);
    return response.data;
  }

  async createInvoice(data: {
    customer: string;
    items: Array<{
      item_code: string;
      qty: number;
      rate: number;
      discount_percentage?: number;
      discount_amount?: number;
    }>;
    payments: Array<{ mode_of_payment: string; amount: number }>;
    discount_amount?: number;
    additional_discount_percentage?: number;
    offline_id?: string;
  }) {
    const response = await this.client.post('/invoices', data);
    return response.data;
  }

  async createDraftInvoice(data: {
    customer: string;
    items: Array<{
      item_code: string;
      qty: number;
      rate: number;
      uom?: string;
      warehouse?: string;
      discount_percentage?: number;
      discount_amount?: number;
    }>;
    payments: Array<{ mode_of_payment: string; amount: number }>;
    discount_amount?: number;
    additional_discount_percentage?: number;
    pos_profile?: string;
  }) {
    const response = await this.client.post('/invoices/draft', data);
    return response.data;
  }

  async submitInvoice(invoiceName: string) {
    const response = await this.client.post(`/invoices/${invoiceName}/submit`);
    return response.data;
  }

  async deleteInvoice(invoiceName: string) {
    const response = await this.client.delete(`/invoices/${invoiceName}`);
    return response.data;
  }

  async getInvoicePrintHtml(invoiceName: string, printFormat?: string) {
    const response = await this.client.get(`/invoices/${invoiceName}/print-html`, {
      params: { print_format: printFormat }
    });
    return response.data;
  }

  async getReturnableItems(invoiceName: string) {
    const response = await this.client.get(`/invoices/${invoiceName}/returnable-items`);
    return response.data;
  }

  async createReturn(data: {
    original_invoice: string;
    items: Array<{ item_code: string; qty: number; rate: number }>;
    payments: Array<{ mode_of_payment: string; amount: number }>;
    offline_id?: string;
  }) {
    const response = await this.client.post('/invoices/return', data);
    return response.data;
  }

  // Inventory
  async getWarehouses(company?: string) {
    const response = await this.client.get('/inventory/warehouses', {
      params: company ? { company } : undefined
    });
    return response.data;
  }

  async getStockBalance(params?: { item_code?: string; warehouse?: string }) {
    const response = await this.client.get('/inventory/stock', { params });
    return response.data;
  }

  async getItemStockAllWarehouses(itemCode: string) {
    const response = await this.client.get(`/inventory/stock/${itemCode}`);
    return response.data;
  }

  async checkStockMultiple(itemCodes: string[], warehouse?: string) {
    const response = await this.client.post('/inventory/stock/check', itemCodes, {
      params: warehouse ? { warehouse } : undefined
    });
    return response.data;
  }

  async transferStock(data: {
    item_code: string;
    qty: number;
    from_warehouse: string;
    to_warehouse: string;
    remarks?: string;
    offline_id?: string;
  }) {
    const response = await this.client.post('/inventory/transfer', data);
    return response.data;
  }

  async receiveStock(data: {
    item_code: string;
    qty: number;
    warehouse: string;
    rate?: number;
    remarks?: string;
    offline_id?: string;
  }) {
    const response = await this.client.post('/inventory/receive', data);
    return response.data;
  }

  async getLowStockItems(warehouse?: string, threshold?: number) {
    const response = await this.client.get('/inventory/low-stock', {
      params: { warehouse, threshold }
    });
    return response.data;
  }

  // Sync
  async getSyncStatus() {
    const response = await this.client.get('/sync/status');
    return response.data;
  }

  async pullData(doctypes?: string[], lastSync?: string) {
    const response = await this.client.post('/sync/pull', {
      doctypes: doctypes || ['Item', 'Customer', 'Warehouse', 'POS Profile', 'Mode of Payment'],
      last_sync: lastSync
    });
    return response.data;
  }

  async pushData(items: Array<{
    offline_id: string;
    doctype: string;
    action: 'create' | 'update' | 'delete';
    data: Record<string, unknown>;
    created_at: string;
  }>) {
    const response = await this.client.post('/sync/push', { items });
    return response.data;
  }

  async getChangesSince(since: string, doctypes?: string) {
    const response = await this.client.get('/sync/changes', {
      params: { since, doctypes }
    });
    return response.data;
  }

  // Health check
  async healthCheck() {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export const api = new ApiService();
