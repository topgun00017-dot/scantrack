import { CATEGORY_KEYS } from './categories';

// Shared helpers: ids, dates, money, filtering, summaries and data-quality checks.

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISO(new Date());

export function money(amount, currency = 'MYR') {
  const n = Number(amount) || 0;
  const sym = { MYR: 'RM', USD: '$', SGD: 'S$', EUR: '€', GBP: '£' }[currency] || `${currency} `;
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function prettyDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

// Date range presets used across Reports / Export / Accounting.
export function rangeFor(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'this_month': return { from: toISO(new Date(y, m, 1)), to: toISO(new Date(y, m + 1, 0)) };
    case 'last_month': return { from: toISO(new Date(y, m - 1, 1)), to: toISO(new Date(y, m, 0)) };
    case 'this_quarter': {
      const q = Math.floor(m / 3) * 3;
      return { from: toISO(new Date(y, q, 1)), to: toISO(new Date(y, q + 3, 0)) };
    }
    case 'this_year': return { from: `${y}-01-01`, to: `${y}-12-31` };
    case 'last_year': return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default: return { from: '0000-01-01', to: '9999-12-31' };
  }
}

export const RANGE_PRESETS = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_quarter', label: 'This quarter' },
  { key: 'this_year', label: 'This year' },
  { key: 'last_year', label: 'Last year' },
  { key: 'all', label: 'All time' },
];

export const inRange = (r, from, to) => (!from || r.date >= from) && (!to || r.date <= to);

export function filterReceipts(receipts, f = {}) {
  const q = (f.query || '').trim().toLowerCase();
  return receipts
    .filter((r) => inRange(r, f.from, f.to))
    .filter((r) => !f.category || r.category === f.category)
    .filter((r) => !f.tag || (r.tags || []).includes(f.tag))
    .filter((r) => f.min == null || r.total >= f.min)
    .filter((r) => f.max == null || r.total <= f.max)
    .filter((r) => !f.status || r.status === f.status)
    .filter((r) => {
      if (!q) return true;
      const hay = [r.merchant, r.category, r.notes, r.paymentMethod, ...(r.tags || []), ...(r.lineItems || []).map((i) => i.description)]
        .join(' ')
        .toLowerCase();
      return hay.includes(q) || String(r.total).includes(q);
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
}

export function sum(list, key = 'total') {
  return list.reduce((s, r) => s + (Number(r[key]) || 0), 0);
}

export function byCategory(list) {
  const map = {};
  list.forEach((r) => {
    map[r.category] = map[r.category] || { category: r.category, total: 0, tax: 0, count: 0 };
    map[r.category].total += Number(r.total) || 0;
    map[r.category].tax += Number(r.tax) || 0;
    map[r.category].count += 1;
  });
  return Object.values(map).sort((a, b) => b.total - a.total);
}

export function byMonth(list, months = 6) {
  const now = new Date();
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const label = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    out.push({ key, label, total: sum(list.filter((r) => (r.date || '').startsWith(key))) });
  }
  return out;
}

export function allTags(receipts) {
  const s = new Set();
  receipts.forEach((r) => (r.tags || []).forEach((t) => s.add(t)));
  return [...s].sort();
}

// Data-quality checks used by Prepare-for-accounting and the assistant's "reconcile".
export function findIssues(receipts) {
  const issues = [];
  const seen = {};
  receipts.forEach((r) => {
    if (r.status === 'needs_review') issues.push({ type: 'needs_review', id: r.id, label: 'Needs review', receipt: r });
    // "Others" is a valid choice; only a missing or unknown category is flagged.
    if (!CATEGORY_KEYS.includes(r.category)) issues.push({ type: 'uncategorized', id: r.id, label: 'Uncategorised', receipt: r });
    if (!r.total || r.total <= 0) issues.push({ type: 'no_total', id: r.id, label: 'Missing total', receipt: r });
    if (!r.imageUri) issues.push({ type: 'no_image', id: r.id, label: 'No receipt image', receipt: r });
    const key = `${(r.merchant || '').toLowerCase().trim()}|${r.date}|${Number(r.total).toFixed(2)}`;
    if (seen[key] && !r.confirmedUnique) issues.push({ type: 'duplicate', id: r.id, otherId: seen[key], label: 'Possible duplicate', receipt: r });
    else seen[key] = r.id;
  });
  // Most important first; missing images are a soft warning so they go last.
  const order = ['duplicate', 'needs_review', 'no_total', 'uncategorized', 'no_image'];
  return issues.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
}

export const ISSUE_LABELS = {
  needs_review: 'Needs review',
  uncategorized: 'Uncategorised',
  no_total: 'Missing total',
  no_image: 'No receipt image',
  duplicate: 'Possible duplicate',
};
