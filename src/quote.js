// Quote of the day: fetched from the web (ZenQuotes "today" endpoint) once per day and kept
// until midnight. If the phone is offline, a quote from the list below is used instead.
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { todayKey } from './dates';

const KEY = 'tidy:quote';
const SOURCE = 'https://zenquotes.io/api/today';

const FALLBACK = [
  ['The secret of getting ahead is getting started.', 'Mark Twain'],
  ['Well begun is half done.', 'Aristotle'],
  ['It always seems impossible until it is done.', 'Nelson Mandela'],
  ['Small deeds done are better than great deeds planned.', 'Peter Marshall'],
  ['Action is the foundational key to all success.', 'Pablo Picasso'],
  ['You don’t have to see the whole staircase, just take the first step.', 'Martin Luther King Jr.'],
  ['Quality is not an act, it is a habit.', 'Aristotle'],
  ['Do what you can, with what you have, where you are.', 'Theodore Roosevelt'],
  ['The best way out is always through.', 'Robert Frost'],
  ['Little by little, one travels far.', 'J. R. R. Tolkien'],
  ['Simplicity is the ultimate sophistication.', 'Leonardo da Vinci'],
  ['Done is better than perfect.', 'Sheryl Sandberg'],
  ['Focus on being productive instead of busy.', 'Tim Ferriss'],
  ['Energy and persistence conquer all things.', 'Benjamin Franklin'],
  ['What we fear doing most is usually what we most need to do.', 'Tim Ferriss'],
  ['A journey of a thousand miles begins with a single step.', 'Lao Tzu'],
  ['Start where you are. Use what you have. Do what you can.', 'Arthur Ashe'],
  ['Discipline is choosing between what you want now and what you want most.', 'Abraham Lincoln (attributed)'],
  ['The future depends on what you do today.', 'Mahatma Gandhi'],
  ['Make each day your masterpiece.', 'John Wooden'],
  ['Either you run the day or the day runs you.', 'Jim Rohn'],
  ['Great things are done by a series of small things brought together.', 'Vincent van Gogh'],
  ['You miss 100% of the shots you don’t take.', 'Wayne Gretzky'],
  ['Believe you can and you’re halfway there.', 'Theodore Roosevelt'],
  ['Keep your face always toward the sunshine.', 'Walt Whitman'],
  ['Nothing will work unless you do.', 'Maya Angelou'],
  ['Act as if what you do makes a difference. It does.', 'William James'],
  ['The way to get started is to quit talking and begin doing.', 'Walt Disney'],
  ['Don’t watch the clock; do what it does. Keep going.', 'Sam Levenson'],
  ['One day or day one. You decide.', 'Unknown'],
  ['Slow progress is still progress.', 'Unknown'],
];

function fallbackFor(day) {
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [text, author] = FALLBACK[h % FALLBACK.length];
  return { day, text, author, web: false };
}

async function fetchToday(day) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(SOURCE, { signal: ctrl.signal });
    const json = await res.json();
    const q = Array.isArray(json) ? json[0] : null;
    if (!q?.q || /too many requests/i.test(q.q)) throw new Error('no quote');
    return { day, text: q.q.trim(), author: (q.a || 'Unknown').trim(), web: true };
  } finally {
    clearTimeout(timer);
  }
}

// Returns today's quote and swaps to a new one at midnight (also when the app is reopened).
export function useDailyQuote() {
  const [quote, setQuote] = useState(() => fallbackFor(todayKey()));

  useEffect(() => {
    let alive = true;
    let midnight;
    const load = async () => {
      const day = todayKey();
      let saved = null;
      try {
        saved = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null');
      } catch {}
      if (saved?.day === day && saved.web) {
        if (alive) setQuote(saved);
      } else {
        if (alive) setQuote(saved?.day === day ? saved : fallbackFor(day));
        try {
          const q = await fetchToday(day);
          if (alive) setQuote(q);
          await AsyncStorage.setItem(KEY, JSON.stringify(q));
        } catch {
          // offline or the site is busy: keep the built-in quote, try again next time the app opens
          if (!saved || saved.day !== day) AsyncStorage.setItem(KEY, JSON.stringify(fallbackFor(day))).catch(() => {});
        }
      }
      // schedule the next refresh for 12:00 am
      clearTimeout(midnight);
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      midnight = setTimeout(load, next - now);
    };
    load();
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    return () => {
      alive = false;
      clearTimeout(midnight);
      sub.remove();
    };
  }, []);

  return quote;
}
