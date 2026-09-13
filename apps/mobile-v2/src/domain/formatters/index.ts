/**
 * GreatSales Formatting Utilities (Indian Market B2B CRM conventions).
 */

export function formatCurrencyINR(value: number): string {
  if (!isFinite(value)) return '₹0';
  return '₹' + Math.round(value).toLocaleString('en-IN');
}

/**
 * Compact Lakh/Crore scale for KPI heroes and summary cards.
 * Example:
 *   12,50,000 -> "₹12.5L"
 *   2,45,00,000 -> "₹2.45Cr"
 *   4,500 -> "₹4.5K"
 */
export function formatLakhs(value: number): string {
  if (!isFinite(value)) return '₹0';
  const v = Math.round(value);
  if (Math.abs(v) >= 1_00_00_000) return '₹' + (v / 1_00_00_000).toFixed(2) + 'Cr';
  if (Math.abs(v) >= 1_00_000) return '₹' + (v / 1_00_000).toFixed(2) + 'L';
  if (Math.abs(v) >= 1_000) return '₹' + (v / 1_000).toFixed(1) + 'K';
  return '₹' + v.toLocaleString('en-IN');
}

export function formatNumber(value: number): string {
  if (!isFinite(value)) return '0';
  return value.toLocaleString('en-IN');
}

export function formatPercentage(value: number | null | undefined, digits = 0): string {
  if (value == null || !isFinite(value)) return '—';
  return value.toFixed(digits) + '%';
}

export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

export function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return formatShortDate(iso);
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const clean = phone.replace(/[^\d+]/g, '');
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return clean;
}

export function formatInitials(name: string): string {
  if (!name || !name.trim()) return 'GS';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function formatA11yCurrency(value: number): string {
  if (!isFinite(value)) return 'Zero rupees';
  return `${Math.round(value)} rupees`;
}
