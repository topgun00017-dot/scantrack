// Expense categories + rule-based auto-categorisation (used when AI is off,
// and as a safety net when AI returns an unknown category).
export const CATEGORIES = [
  { key: 'Meals', icon: '🍽️', color: '#FF8A5B', words: ['restaurant', 'cafe', 'coffee', 'starbucks', 'mcdonald', 'kfc', 'food', 'bistro', 'mamak', 'nasi', 'pizza', 'burger', 'grabfood', 'foodpanda', 'bakery', 'tealive', 'zus'] },
  { key: 'Travel', icon: '✈️', color: '#5AA9FF', words: ['airasia', 'airline', 'hotel', 'agoda', 'booking.com', 'airbnb', 'flight', 'mas ', 'malaysia airlines', 'ktm', 'ets', 'bus'] },
  { key: 'Transport', icon: '🚗', color: '#4FD1C5', words: ['grab', 'petronas', 'shell', 'petron', 'caltex', 'bhp', 'fuel', 'parking', 'toll', 'touch n go', 'tng', 'taxi', 'uber'] },
  { key: 'Office Supplies', icon: '📎', color: '#B794F4', words: ['popular', 'stationery', 'office', 'paper', 'printer', 'ink', 'mr diy', 'ikea'] },
  { key: 'Software', icon: '💻', color: '#63B3ED', words: ['google', 'microsoft', 'adobe', 'aws', 'apple.com', 'software', 'subscription', 'saas', 'canva', 'notion', 'zoom', 'anthropic', 'openai'] },
  { key: 'Utilities', icon: '💡', color: '#F6E05E', words: ['tnb', 'tenaga', 'syabas', 'air selangor', 'unifi', 'maxis', 'celcom', 'digi', 'u mobile', 'internet', 'electric', 'water'] },
  { key: 'Groceries', icon: '🛒', color: '#68D391', words: ['tesco', 'lotus', 'aeon', 'giant', 'mydin', 'jaya grocer', 'village grocer', '99 speedmart', 'supermarket', 'grocer', 'econsave'] },
  { key: 'Equipment', icon: '🛠️', color: '#F687B3', words: ['harvey norman', 'senheng', 'courts', 'laptop', 'monitor', 'hardware', 'electronics'] },
  { key: 'Marketing', icon: '📣', color: '#FC8181', words: ['facebook', 'meta', 'ads', 'advert', 'print shop', 'banner', 'flyer'] },
  { key: 'Professional Fees', icon: '📑', color: '#A0AEC0', words: ['legal', 'lawyer', 'accounting', 'consult', 'audit', 'ssm', 'lhdn'] },
  { key: 'Other', icon: '🧾', color: '#718096', words: [] },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export function categoryMeta(key) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
}

export function autoCategorize(merchant = '', items = []) {
  const hay = `${merchant} ${items.map((i) => i.description || '').join(' ')}`.toLowerCase();
  for (const c of CATEGORIES) {
    if (c.words.some((w) => hay.includes(w))) return c.key;
  }
  return 'Other';
}

export function normalizeCategory(cat, merchant, items) {
  if (cat) {
    const hit = CATEGORY_KEYS.find((k) => k.toLowerCase() === String(cat).toLowerCase());
    if (hit) return hit;
  }
  return autoCategorize(merchant, items);
}
