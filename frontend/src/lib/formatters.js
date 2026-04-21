export const currency = (n) =>
  n == null ? '—' : new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR', maximumFractionDigits: 0 }).format(n);

export const date = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const compact = (specs = {}) => {
  const parts = [specs.processor, specs.ram, specs.storage].filter(Boolean);
  return parts.join(' / ') || '—';
};

export const statusColor = {
  in_stock: 'bg-emerald-100 text-emerald-700',
  sold: 'bg-slate-100 text-slate-600',
  reserved: 'bg-blue-100 text-blue-700',
  damaged: 'bg-red-100 text-red-700',
  archived: 'bg-slate-100 text-slate-400',
};

export const conditionColor = {
  New: 'bg-indigo-100 text-indigo-700',
  Used: 'bg-amber-100 text-amber-700',
  Refurbished: 'bg-purple-100 text-purple-700',
  'Open-box': 'bg-teal-100 text-teal-700',
};
