import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Search,
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  Filter,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { db } from '../services/database';
import { formatCurrency, formatDate, formatDateTime } from '../utils/format';
import { POSInvoice } from '../types';

type FilterStatus = 'all' | 'synced' | 'pending' | 'returns';

export default function InvoicesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<POSInvoice | null>(null);

  // Get all invoices from IndexedDB
  const invoices = useLiveQuery(
    async () => {
      let query = db.invoices.orderBy('created_at').reverse();

      const all = await query.toArray();

      // Apply filters
      let filtered = all;

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter(
          (inv) =>
            inv.name?.toLowerCase().includes(q) ||
            inv.offline_id.toLowerCase().includes(q) ||
            inv.customer_name?.toLowerCase().includes(q) ||
            inv.customer.toLowerCase().includes(q)
        );
      }

      if (filterStatus === 'synced') {
        filtered = filtered.filter((inv) => inv.synced && !inv.is_return);
      } else if (filterStatus === 'pending') {
        filtered = filtered.filter((inv) => !inv.synced);
      } else if (filterStatus === 'returns') {
        filtered = filtered.filter((inv) => inv.is_return);
      }

      return filtered;
    },
    [searchQuery, filterStatus],
    []
  );

  const getStatusBadge = (invoice: POSInvoice) => {
    if (invoice.is_return) {
      return <span className="badge bg-purple-100 text-purple-800">Return</span>;
    }
    if (!invoice.synced) {
      return <span className="badge badge-warning">Pending Sync</span>;
    }
    return <span className="badge badge-success">Synced</span>;
  };

  const getStatusIcon = (invoice: POSInvoice) => {
    if (invoice.is_return) {
      return <RotateCcw className="text-purple-600" size={20} />;
    }
    if (!invoice.synced) {
      return <Clock className="text-yellow-600" size={20} />;
    }
    return <CheckCircle className="text-green-600" size={20} />;
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col p-4">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-2">Invoices</h1>

        {/* Search and filters */}
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>

          <div className="flex gap-2">
            {(['all', 'synced', 'pending', 'returns'] as FilterStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`btn btn-sm ${
                  filterStatus === status ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Invoice list */}
      <div className="flex-1 overflow-auto">
        {invoices && invoices.length > 0 ? (
          <div className="space-y-2">
            {invoices.map((invoice) => (
              <button
                key={invoice.offline_id}
                onClick={() => setSelectedInvoice(invoice)}
                className="w-full card p-4 text-left hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(invoice)}
                    <div>
                      <div className="font-medium">
                        {invoice.name || invoice.offline_id.slice(0, 8)}
                      </div>
                      <div className="text-sm text-gray-500">{invoice.customer_name}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`font-bold text-lg ${
                        invoice.is_return ? 'text-red-600' : 'text-primary-600'
                      }`}
                    >
                      {invoice.is_return ? '-' : ''}
                      {formatCurrency(Math.abs(invoice.grand_total))}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(invoice.posting_date)}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <div className="flex gap-2">
                    {getStatusBadge(invoice)}
                    <span className="text-xs text-gray-500">
                      {invoice.items.length} item(s)
                    </span>
                  </div>
                  <ChevronDown size={16} className="text-gray-400" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <FileText className="mx-auto mb-2 text-gray-300" size={48} />
            <p>No invoices found</p>
          </div>
        )}
      </div>

      {/* Invoice detail modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  );
}

function InvoiceDetailModal({
  invoice,
  onClose
}: {
  invoice: POSInvoice;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">
              {invoice.is_return ? 'Return Invoice' : 'Invoice Details'}
            </h2>
            <div className="text-sm text-gray-500">
              {invoice.name || invoice.offline_id}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XCircle size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Status</span>
            {invoice.synced ? (
              <span className="badge badge-success">Synced to ERPNext</span>
            ) : (
              <span className="badge badge-warning">Pending Sync</span>
            )}
          </div>

          {/* Return reference */}
          {invoice.is_return && invoice.return_against && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Return Against</span>
              <span className="font-medium">{invoice.return_against}</span>
            </div>
          )}

          {/* Customer */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Customer</span>
            <span className="font-medium">{invoice.customer_name || invoice.customer}</span>
          </div>

          {/* Date */}
          <div className="flex items-center justify-between">
            <span className="text-gray-500">Date</span>
            <span>{formatDateTime(invoice.created_at)}</span>
          </div>

          {/* Items */}
          <div>
            <h3 className="font-medium mb-2">Items</h3>
            <div className="bg-gray-50 rounded-lg divide-y">
              {invoice.items.map((item, idx) => (
                <div key={idx} className="p-3 flex justify-between">
                  <div>
                    <div className="font-medium">{item.item_name || item.item_code}</div>
                    <div className="text-sm text-gray-500">
                      {item.qty} × {formatCurrency(item.rate)}
                      {item.discount_percentage > 0 && (
                        <span className="text-green-600 ml-2">
                          -{item.discount_percentage}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="font-medium">{formatCurrency(item.amount)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="border-t pt-4 space-y-2">
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-{formatCurrency(invoice.discount_amount)}</span>
              </div>
            )}
            {invoice.additional_discount_percentage > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount ({invoice.additional_discount_percentage}%)</span>
                <span>
                  -{formatCurrency(invoice.net_total * invoice.additional_discount_percentage / 100)}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className={invoice.is_return ? 'text-red-600' : ''}>
                {invoice.is_return ? '-' : ''}
                {formatCurrency(Math.abs(invoice.grand_total))}
              </span>
            </div>
          </div>

          {/* Payments */}
          <div>
            <h3 className="font-medium mb-2">Payments</h3>
            <div className="bg-gray-50 rounded-lg divide-y">
              {invoice.payments.map((payment, idx) => (
                <div key={idx} className="p-3 flex justify-between">
                  <span>{payment.mode_of_payment}</span>
                  <span className="font-medium">
                    {formatCurrency(Math.abs(payment.amount))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sync info */}
          {invoice.synced && invoice.synced_at && (
            <div className="text-sm text-gray-500 text-center">
              Synced on {formatDateTime(invoice.synced_at)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
