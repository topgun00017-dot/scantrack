// Expense categories (accounting chart) + rule-based auto-categorisation.
// Keyword rules are checked top to bottom, so more specific categories come first
// (e.g. "grabfood" → Entertainment before "grab" → Travelling Expenses).
// `hint` is given to the AI so it picks the right category from a receipt photo.
export const OTHERS = 'Others';

export const CATEGORIES = [
  { key: 'Purchases', icon: 'package', color: '#22C55E', hint: 'goods or stock bought for resale or for the business (supplier, wholesale, hypermarket stock)', words: ['supplier', 'wholesale', 'tesco', 'lotus', 'aeon', 'giant', 'mydin', 'jaya grocer', 'village grocer', '99 speedmart', 'econsave', 'supermarket', 'hypermarket', 'nsk', 'kedai runcit'] },
  { key: 'Petrol', icon: 'fuel', color: '#14B8A6', hint: 'fuel: petrol, diesel, EV charging', words: ['petronas', 'shell', 'petron', 'caltex', 'bhp', 'fuel', 'petrol', 'diesel', 'ron95', 'ron97', 'chargev', 'ev charging'] },
  { key: 'MVRE', icon: 'car', color: '#3B82F6', hint: 'motor vehicle running expenses: car service and repair, tyres, battery, car wash, parking, toll, road tax, motor insurance', words: ['workshop', 'service centre', 'tyre', ' tire', 'battery', 'car wash', 'parking', 'toll', 'touch n go', ' tng ', 'smarttag', 'road tax', 'jpj', 'puspakom', 'motor', 'auto parts', 'spare part', 'lube', 'oil change'] },
  { key: 'Fixed Assets', icon: 'monitor', color: '#8B5CF6', hint: 'long-lasting equipment: computers, phones, furniture, machinery, vehicles', words: ['harvey norman', 'senheng', 'courts', 'laptop', 'computer', 'notebook', 'monitor', 'printer', 'furniture', 'machinery', 'machine', 'iphone', 'samsung', 'apple store', 'ikea'] },
  { key: 'Travelling Expenses', icon: 'plane', color: '#38BDF8', hint: 'business travel: flights, hotels, e-hailing rides, taxi, train, bus', words: ['airasia', 'airline', 'malaysia airlines', 'firefly', 'batik air', 'hotel', 'agoda', 'booking.com', 'airbnb', 'flight', 'ktm', ' ets ', ' mrt', ' lrt', ' bus ', 'grab', 'taxi', 'uber', 'airport'] },
  { key: 'Salaries', icon: 'users', color: '#F97316', hint: 'staff salaries, wages, allowances, EPF/KWSP, SOCSO/PERKESO, EIS', words: ['salary', 'salaries', 'wages', 'payroll', 'epf', 'kwsp', 'socso', 'perkeso', ' eis ', 'allowance', 'commission'] },
  { key: 'Drawings', icon: 'hand-coins', color: '#EC4899', hint: "owner's personal spending paid with business money", words: ['personal', 'drawings'] },
  { key: 'Entertainment', icon: 'utensils', color: '#EF4444', hint: 'meals and drinks, client entertainment, food delivery', words: ['grabfood', 'foodpanda', 'shopeefood', 'restaurant', 'restoran', 'cafe', 'café', 'coffee', 'kopitiam', 'starbucks', 'mcdonald', 'kfc', 'pizza', 'burger', 'bistro', 'mamak', 'nasi', ' mee', 'bakery', 'tealive', 'zus coffee', 'food', 'catering'] },
  { key: 'Rental', icon: 'building', color: '#A16207', hint: 'rent or lease of premises, office, shop, equipment or vehicle', words: [' rent', 'rental', 'sewa', 'lease', 'tenancy'] },
  { key: 'HP & Unifi', icon: 'smartphone', color: '#FACC15', hint: 'mobile phone bills, prepaid reloads, internet: Unifi, Maxis, CelcomDigi, U Mobile, Yes, Time', words: ['unifi', 'tm net', 'telekom', 'maxis', 'hotlink', 'celcom', 'digi', 'u mobile', 'umobile', 'yes 4g', 'yoodo', 'tune talk', 'time dotcom', 'time fibre', 'reload', 'postpaid', 'prepaid', 'broadband', 'internet'] },
  { key: 'General Expenses', icon: 'file-text', color: '#64748B', hint: 'other running costs: stationery, office supplies, printing, utilities (electricity, water), software subscriptions, bank charges, postage, cleaning, advertising', words: ['popular', 'stationery', 'office', 'paper', 'printing', ' ink ', 'mr diy', 'tnb', 'tenaga', 'air selangor', 'syabas', 'indah water', 'adobe', 'google', 'microsoft', 'canva', 'zoom', 'subscription', 'pos malaysia', 'poslaju', 'courier', 'j&t', 'ninja van', 'bank charge', ' meta ', 'facebook', ' ads '] },
  { key: OTHERS, icon: 'shapes', color: '#CBD5E1', hint: 'anything that does not fit the categories above', words: [] },
];

export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key);

// ---------- user-added categories ----------
// CATEGORIES and CATEGORY_KEYS are updated in place so every screen that imported them sees
// the user's own categories (inserted before "Others", which always stays last).
const BUILT_IN = CATEGORIES.slice();
export const BUILT_IN_KEYS = BUILT_IN.map((c) => c.key);
export const CUSTOM_ICONS = ['tag', 'briefcase', 'shopping-cart', 'gift', 'wrench', 'house', 'zap', 'coffee', 'heart-pulse', 'graduation-cap', 'truck', 'megaphone', 'baby', 'dog', 'shirt', 'landmark'];
export const CUSTOM_COLORS = ['#0EA5E9', '#10B981', '#F59E0B', '#E11D48', '#7C3AED', '#0891B2', '#65A30D', '#DB2777', '#EA580C', '#475569'];
let lastCustom = '[]';

export function setCustomCategories(list = []) {
  const sig = JSON.stringify(list);
  if (sig === lastCustom) return;
  lastCustom = sig;
  const custom = list.map((c) => ({ key: c.key, icon: c.icon || 'tag', color: c.color || '#475569', hint: `user-defined category "${c.key}"`, words: [], custom: true }));
  const all = [...BUILT_IN.filter((c) => c.key !== OTHERS), ...custom, BUILT_IN.find((c) => c.key === OTHERS)];
  CATEGORIES.splice(0, CATEGORIES.length, ...all);
  CATEGORY_KEYS.splice(0, CATEGORY_KEYS.length, ...all.map((c) => c.key));
}

export const isCustomCategory = (key) => !!CATEGORIES.find((c) => c.key === key && c.custom);

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
export const categoryGuide = () => CATEGORIES.map((c) => `- ${c.key}: ${c.hint}`).join('\n');

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
