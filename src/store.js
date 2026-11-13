// All app data lives here and is saved on the phone (AsyncStorage).
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, nextOccurrence, todayKey } from './dates';
import { syncReminders } from './notify';

const KEY = 'tidy:v1';
export const INBOX = 'inbox';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function starter() {
  const t = todayKey();
  const lists = [
    { id: INBOX, name: 'Inbox', icon: 'inbox', color: '#7A7A80', system: true },
    { id: 'work', name: 'Work & Learn', icon: 'briefcase', color: '#4F7BE8' },
    { id: 'well', name: 'Wellness', icon: 'sun', color: '#3BA776' },
    { id: 'daily', name: 'Daily things', icon: 'coffee', color: '#8BB33B' },
    { id: 'groc', name: 'Groceries', icon: 'shopping-cart', color: '#E08A2C' },
  ];
  const mk = (title, listId, date, extra = {}) => ({ id: uid(), title, listId, date, time: null, repeat: 'none', flag: false, link: '', note: '', done: false, createdAt: Date.now(), ...extra });
  const tasks = [
    mk('Buy fresh coffee beans', 'daily', addDays(t, -1)),
    mk('Update slides for Monday meeting', 'work', t, { time: '15:00' }),
    mk('Cook a healthy dinner', 'well', t),
    mk('Read a few chapters', 'daily', t, { repeat: 'daily', link: 'https://example.com/reading-list', note: 'Chapter 4 and 5' }),
    mk('Plan the weekend trip', 'daily', addDays(t, 2)),
    mk('Morning walk', 'well', t, { done: true, doneAt: Date.now() }),
    mk('Milk', 'groc', null),
    mk('Eggs', 'groc', null),
    mk('Bananas', 'groc', null),
    mk('Call the plumber', INBOX, null, { flag: true }),
  ];
  return { lists, tasks, settings: { weekStart: 1, showCompleted: true } };
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [data, setData] = useState(null);
  const syncTimer = useRef(null);

  useEffect(() => {
    (async () => {
      let saved = null;
      try {
        saved = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null');
      } catch {}
      setData(saved?.lists ? saved : starter());
    })();
  }, []);

  useEffect(() => {
    if (!data) return;
    AsyncStorage.setItem(KEY, JSON.stringify(data)).catch(() => {});
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => syncReminders(data.tasks, data.lists), 800);
  }, [data]);

  const api = useMemo(() => {
    const up = (fn) => setData((d) => ({ ...d, ...fn(d) }));
    return {
      addTask: (task) => {
        const t = { id: uid(), title: '', listId: INBOX, date: null, time: null, repeat: 'none', flag: false, link: '', note: '', done: false, createdAt: Date.now(), ...task };
        up((d) => ({ tasks: [...d.tasks, t] }));
        return t;
      },
      updateTask: (id, patch) => up((d) => ({ tasks: d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTask: (id) => up((d) => ({ tasks: d.tasks.filter((t) => t.id !== id) })),
      // Ticking a repeating task keeps a done copy and moves the task on to its next date.
      toggleTask: (id) =>
        up((d) => {
          const t = d.tasks.find((x) => x.id === id);
          if (!t) return {};
          if (!t.done && t.repeat && t.repeat !== 'none' && t.date) {
            const doneCopy = { ...t, id: uid(), done: true, doneAt: Date.now(), repeat: 'none', time: null };
            return { tasks: [...d.tasks.map((x) => (x.id === id ? { ...x, date: nextOccurrence(x.date, x.repeat) } : x)), doneCopy] };
          }
          return { tasks: d.tasks.map((x) => (x.id === id ? { ...x, done: !x.done, doneAt: x.done ? null : Date.now() } : x)) };
        }),
      moveTasks: (ids, date) => up((d) => ({ tasks: d.tasks.map((t) => (ids.includes(t.id) ? { ...t, date } : t)) })),
      clearCompleted: (listFilter) => up((d) => ({ tasks: d.tasks.filter((t) => !(t.done && listFilter(t))) })),
      addList: (list) => {
        const l = { id: uid(), ...list };
        up((d) => ({ lists: [...d.lists, l] }));
        return l;
      },
      updateList: (id, patch) => up((d) => ({ lists: d.lists.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
      // Deleting a list keeps its tasks by moving them to Inbox.
      deleteList: (id) => up((d) => ({ lists: d.lists.filter((l) => l.id !== id), tasks: d.tasks.map((t) => (t.listId === id ? { ...t, listId: INBOX } : t)) })),
      moveList: (id, dir) =>
        up((d) => {
          const arr = [...d.lists];
          const i = arr.findIndex((l) => l.id === id);
          const j = i + dir;
          if (i < 0 || j < 1 || j >= arr.length) return {}; // Inbox stays first
          [arr[i], arr[j]] = [arr[j], arr[i]];
          return { lists: arr };
        }),
      setSettings: (patch) => up((d) => ({ settings: { ...d.settings, ...patch } })),
      resetAll: () => setData({ lists: [starter().lists[0]], tasks: [], settings: { weekStart: 1, showCompleted: true } }),
    };
  }, []);

  if (!data) return null;
  return <Ctx.Provider value={{ ...data, ...api }}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

// Sort: undone first, then by date/time (no date last), then created.
export function sortTasks(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  const ad = a.date || '9999', bd = b.date || '9999';
  if (ad !== bd) return ad < bd ? -1 : 1;
  const at = a.time || '99', bt = b.time || '99';
  if (at !== bt) return at < bt ? -1 : 1;
  return a.createdAt - b.createdAt;
}
