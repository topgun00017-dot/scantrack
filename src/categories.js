// Expense categories (accounting chart) + rule-based auto-categorisation.
// Keyword rules are checked top to bottom, so more specific categories come first
// (e.g. "grabfood" → Entertainment before "grab" → Travelling Expenses).
// `hint` is given to the AI so it picks the right category from a receipt photo.
export const OTHERS = 'Others';

export const CATEGORIES = [
  { key: 'Purchases', icon: '📦', color: '#68D391', hint: 'goods or stock bought for resale or for the business (supplier, wholesale, hypermarket stock)', words: ['supplier', 'wholesale', 'tesco', 'lotus', 'aeon', 'giant', 'mydin', 'jaya grocer', 'village grocer', '99 speedmart', 'econsave', 'supermarket', 'hypermarket', 'nsk', 'kedai runcit'] },
  { key: 'Petrol', icon: '⛽', color: '#4FD1C5', hint: 'fuel: petrol, diesel, EV charging', words: ['petronas', 'shell', 'petron', 'caltex', 'bhp', 'fuel', 'petrol', 'diesel', 'ron95', 'ron97', 'chargev', 'ev charging'] },
  { key: 'MVRE', icon: '🚗', color: '#5AA9FF', hint: 'motor vehicle running expenses: car service and repair, tyres, battery, car wash, parking, toll, road tax, motor insurance', words: ['workshop', 'service centre', 'tyre', ' tire', 'battery', 'car wash', 'parking', 'toll', 'touch n go', ' tng ', 'smarttag', 'road tax', 'jpj', 'puspakom', 'motor', 'auto parts', 'spare part', 'lube', 'oil change'] },
  { key: 'Fixed Assets', icon: '🖥️', color: '#B794F4', hint: 'long-lasting equipment: computers, phones, furniture, machinery, vehicles', words: ['harvey norman', 'senheng', 'courts', 'laptop', 'computer', 'notebook', 'monitor', 'printer', 'furniture', 'machinery', 'machine', 'iphone', 'samsung', 'apple store', 'ikea'] },
  { key: 'Travelling Expenses', icon: '✈️', color: '#63B3ED', hint: 'business travel: flights, hotels, e-hailing rides, taxi, train, bus', words: ['airasia', 'airline', 'malaysia airlines', 'firefly', 'batik air', 'hotel', 'agoda', 'booking.com', 'airbnb', 'flight', 'ktm', ' ets ', ' mrt', ' lrt', ' bus ', 'grab', 'taxi', 'uber', 'airport'] },
  { key: 'Salaries', icon: '👥', color: '#F6AD55', hint: 'staff salaries, wages, allowances, EPF/KWSP, SOCSO/PERKESO, EIS', words: ['salary', 'salaries', 'wages', 'payroll', 'epf', 'kwsp', 'socso', 'perkeso', ' eis ', 'allowance', 'commission'] },
  { key: 'Drawings', icon: '👛', color: '#FC8181', hint: "owner's personal spending paid with business money", words: ['personal', 'drawings'] },
  { key: 'Entertainment', icon: '🍽️', color: '#FF8A5B', hint: 'meals and drinks, client entertainment, food delivery', words: ['grabfood', 'foodpanda', 'shopeefood', 'restaurant', 'restoran', 'cafe', 'café', 'coffee', 'kopitiam', 'starbucks', 'mcdonald', 'kfc', 'pizza', 'burger', 'bistro', 'mamak', 'nasi', ' mee', 'bakery', 'tealive', 'zus coffee', 'food', 'catering'] },
  { key: 'Rental', icon: '🏢', color: '#A0AEC0', hint: 'rent or lease of premises, office, shop, equipment or vehicle', words: [' rent', 'rental', 'sewa', 'lease', 'tenancy'] },
  { key: 'HP & Unifi', icon: '📱', color: '#F6E05E', hint: 'mobile phone bills, prepaid reloads, internet: Unifi, Maxis, CelcomDigi, U Mobile, Yes, Time', words: ['unifi', 'tm net', 'telekom', 'maxis', 'hotlink', 'celcom', 'digi', 'u mobile', 'umobile', 'yes 4g', 'yoodo', 'tune talk', 'time dotcom', 'time fibre', 'reload', 'postpaid', 'prepaid', 'broadband', 'internet'] },
  { key: 'General Expenses', icon: '🧾', color: '#90CDF4', hint: 'other running costs: stationery, office supplies, printing, utilities (electricity, water), software subscriptions, bank charges, postage, cleaning, advertising', words: ['popular', 'stationery', 'office', 'paper', 'printing', ' ink ', 'mr diy', 'tnb', 'tenaga', 'air selangor', 'syabas', 'indah water', 'adobe', 'google', 'microsoft', 'canva', 'zoom', 'subscription', 'pos malaysia', 'poslaju', 'courier', 'j&t', 'ninja van', 'bank charge', ' meta ', 'facebook', ' ads '] },
  { key: OTHERS, icon: '🗂️', color: '#718096', hint: 'anything that does not fit the categories above', words: [] },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

export function categoryMeta(key) {
  return CATEGORIES.find((c) => c.key === key) || CATEGORIES[CATEGORIES.length - 1];
}

const RULE_ORDER = ['HP & Unifi', 'Petrol', 'MVRE', 'Entertainment', 'Travelling Expenses', 'Rental', 'Salaries', 'Fixed Assets', 'General Expenses', 'Purchases', 'Drawings'];

export function autoCategorize(merchant = '', items = []) {
  const hay = ` ${merchant} ${items.map((i) => i.description || '').join(' ')} `.toLowerCase();
  for (const key of RULE_ORDER) {
    const c = categoryMeta(key);
    if (c.words.some((w) => hay.includes(w))) return key;
  }
  return OTHERS;
}

export function normalizeCategory(cat, merchant, items) {
  if (cat) {
    const hit = CATEGORY_KEYS.find((k) => k.toLowerCase() === String(cat).toLowerCase().trim());
    if (hit) return hit;
  }
  return autoCategorize(merchant, items);
}

// For the AI prompt: "Purchases: goods bought for resale…" one per line.
export const CATEGORY_GUIDE = CATEGORIES.map((c) => `- ${c.key}: ${c.hint}`).join('\n');

// Receipts saved before the category list changed are moved to the new categories.
const LEGACY = {
  Meals: 'Entertainment',
  Travel: 'Travelling Expenses',
  Transport: 'Travelling Expenses',
  'Office Supplies': 'General Expenses',
  Software: 'General Expenses',
  Utilities: 'General Expenses',
  Groceries: 'Purchases',
  Equipment: 'Fixed Assets',
  Marketing: 'General Expenses',
  'Professional Fees': 'General Expenses',
  Other: OTHERS,
};

export function migrateCategory(r) {
  if (CATEGORY_KEYS.includes(r.category)) return r.category;
  const guess = autoCategorize(r.merchant, r.lineItems || []);
  if (guess !== OTHERS) return guess;
  return LEGACY[r.category] || OTHERS;
}
