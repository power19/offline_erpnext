// Currency formatting
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency
  }).format(amount);
}

// Number formatting
export function formatNumber(
  value: number,
  decimals: number = 2,
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

// Date formatting
export function formatDate(
  date: Date | string,
  format: 'short' | 'long' | 'full' = 'short',
  locale: string = 'en-US'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions = {
    short: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' },
    full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
  }[format];

  return new Intl.DateTimeFormat(locale, options).format(d);
}

// Time formatting
export function formatTime(
  date: Date | string,
  locale: string = 'en-US'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(d);
}

// DateTime formatting
export function formatDateTime(
  date: Date | string,
  locale: string = 'en-US'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${formatDate(d, 'short', locale)} ${formatTime(d, locale)}`;
}

// Relative time formatting
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

// Quantity formatting
export function formatQty(qty: number, uom: string = 'Nos'): string {
  if (Number.isInteger(qty)) {
    return `${qty} ${uom}`;
  }
  return `${qty.toFixed(2)} ${uom}`;
}

// Percentage formatting
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Truncate text
export function truncate(text: string, maxLength: number = 30): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Generate invoice display name
export function formatInvoiceName(name: string, isReturn: boolean = false): string {
  if (isReturn) {
    return `${name} (Return)`;
  }
  return name;
}
