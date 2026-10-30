// Display helpers shared across pages (Indian locale)

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// "11:37 am"
export function formatTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '—';
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

// "today", "yesterday", "5 days ago"
export function timeAgo(value) {
  if (!value) return '—';
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export const daysSince = (value) => (value ? Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000) : 0);

// "2026-10-14T00:00:00.000000Z" → "2026-10-14" for <input type="date">
export function toDateInput(value) {
  return value ? String(value).slice(0, 10) : '';
}

// Today as YYYY-MM-DD in local time
export const today = () => new Date().toLocaleDateString('en-CA');
