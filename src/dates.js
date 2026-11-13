// Dates are stored as local 'YYYY-MM-DD' strings and times as 'HH:MM'.
export const pad = (n) => String(n).padStart(2, '0');
export const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayKey = () => toKey(new Date());
export const addDays = (k, n) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
};
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));
export const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// "today", "tomorrow", "yesterday", "Mon 16 Nov", or "16 Nov 2027" for another year.
export function friendlyDate(k) {
  if (!k) return '';
  const t = todayKey();
  if (k === t) return 'today';
  if (k === addDays(t, 1)) return 'tomorrow';
  if (k === addDays(t, -1)) return 'yesterday';
  const d = fromKey(k);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return sameYear ? `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}` : `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function friendlyTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'pm' : 'am';
  return `${((h + 11) % 12) + 1}:${pad(m)} ${ap}`;
}

export const REPEATS = [
  { key: 'none', label: 'Does not repeat' },
  { key: 'daily', label: 'Every day' },
  { key: 'weekdays', label: 'Every weekday (Mon–Fri)' },
  { key: 'weekly', label: 'Every week' },
  { key: 'monthly', label: 'Every month' },
  { key: 'yearly', label: 'Every year' },
];
export const repeatLabel = (r) => (REPEATS.find((x) => x.key === r) || REPEATS[0]).label;

// The next date a repeating task falls on after `k`.
export function nextOccurrence(k, repeat) {
  const d = fromKey(k);
  if (repeat === 'daily') d.setDate(d.getDate() + 1);
  else if (repeat === 'weekdays') {
    do d.setDate(d.getDate() + 1);
    while (d.getDay() === 0 || d.getDay() === 6);
  } else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
  else if (repeat === 'monthly') {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  } else if (repeat === 'yearly') d.setFullYear(d.getFullYear() + 1);
  else return null;
  return toKey(d);
}

// Weeks of a month for a calendar grid; each cell is a date key or null.
export function monthGrid(year, month, weekStart = 1) {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() - weekStart + 7) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const cells = Array(lead).fill(null);
  for (let i = 1; i <= days; i++) cells.push(toKey(new Date(year, month, i)));
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
