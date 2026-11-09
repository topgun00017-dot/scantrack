// App-wide state: receipts, expense reports and settings, persisted with AsyncStorage.
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { uid, toISO } from './utils';
import { autoCategorize, migrateCategory } from './categories';
import { webSample, hasKey } from './ai';
import { isWeb } from './platform';

const KEY = 'scantrack:v1';

const DEFAULT_SETTINGS = {
  name: '',
  company: '',
  currency: 'MYR',
  accountantName: '',
  accountantEmail: '',
  provider: 'claude', // 'claude' | 'openai'
  apiKey: '',
  openaiKey: '',
  openaiModel: 'gpt-5.4-mini',
  model: 'claude-sonnet-5-5',
};

function demoReceipts() {
  const d = (daysAgo) => {
    const x = new Date();
    x.setDate(x.getDate() - daysAgo);
    return toISO(x);
  };
  const mk = (merchant, daysAgo, total, tax, extra = {}) => ({
    id: uid(),
    merchant,
    date: d(daysAgo),
    total,
    tax,
    subtotal: +(total - tax).toFixed(2),
    currency: 'MYR',
    category: extra.category || autoCategorize(merchant),
    tags: extra.tags || [],
    paymentMethod: extra.paymentMethod || 'Card',
    notes: extra.notes || '',
    lineItems: extra.lineItems || [{ description: 'Purchase', qty: 1, amount: +(total - tax).toFixed(2) }],
    imageUri: null,
    status: extra.status || 'processed',
    demo: true,
    createdAt: Date.now() - daysAgo * 86400000,
  });
  return [
    mk('Starbucks Pavilion KL', 1, 32.4, 1.83, { tags: ['client'], lineItems: [{ description: 'Caffe Latte (G)', qty: 2, amount: 30.57 }] }),
    mk('Petronas Klang', 3, 120, 0, { paymentMethod: 'Debit card' }),
    mk('Grab', 4, 18.5, 0, { tags: ['client'] }),
    mk('Popular Bookstore', 6, 56.9, 3.22, { lineItems: [{ description: 'A4 paper 500s', qty: 2, amount: 31.8 }, { description: 'Pens', qty: 1, amount: 21.88 }] }),
    mk('Adobe Systems', 9, 105.0, 5.94, { tags: ['subscription'] }),
    mk('Unifi', 12, 139.0, 7.87, { tags: ['monthly'] }),
    mk('AirAsia', 20, 389.0, 0, { tags: ['penang-trip'] }),
    mk('Hotel Jen Penang', 19, 452.0, 25.58, { tags: ['penang-trip'] }),
    mk('Kedai Runcit Ah Seng', 22, 47.2, 0, { category: 'Others', status: 'needs_review' }),
    mk('Starbucks Pavilion KL', 1, 32.4, 1.83, { tags: ['client'] }), // intentional duplicate
    mk('Meta Ads', 35, 300.0, 0),
    mk('Mr DIY', 40, 23.6, 1.34),
    mk('AEON Bukit Tinggi', 45, 210.35, 0),
  ];
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [reports, setReports] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [webAI, setWebAI] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    webSample().then((fn) => setWebAI(!!fn));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) {
          const s = JSON.parse(raw);
          setReceipts((s.receipts || []).map((r) => ({ ...r, category: migrateCategory(r) })));
          setReports(s.reports || []);
          setSettings({ ...DEFAULT_SETTINGS, ...(s.settings || {}) });
        } else {
          setReceipts(demoReceipts());
        }
      } catch (e) {
        console.warn('load failed', e);
      }
      loaded.current = true;
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(KEY, JSON.stringify({ receipts, reports, settings })).catch(() => {});
  }, [receipts, reports, settings]);

  const api = useMemo(() => {
    // Copy a picked/captured image into permanent app storage.
    const persistImage = async (uri) => {
      if (!uri) return null;
      if (isWeb) return uri; // web build keeps the image as a data URL
      try {
        const dir = FileSystem.documentDirectory + 'receipts/';
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
        const ext = (uri.split('.').pop() || 'jpg').split('?')[0].slice(0, 4);
        const dest = `${dir}${uid()}.${ext}`;
        await FileSystem.copyAsync({ from: uri, to: dest });
        return dest;
      } catch (e) {
        return uri;
      }
    };

    return {
      persistImage,
      addReceipt: (r) => {
        const rec = {
          id: uid(),
          createdAt: Date.now(),
          tags: [],
          lineItems: [],
          currency: settings.currency,
          status: 'processed',
          ...r,
        };
        setReceipts((list) => [rec, ...list]);
        return rec;
      },
      updateReceipt: (id, patch) =>
        setReceipts((list) => list.map((r) => (r.id === id ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r))),
      updateMany: (ids, patchFn) => setReceipts((list) => list.map((r) => (ids.includes(r.id) ? { ...r, ...patchFn(r) } : r))),
      deleteReceipt: (id) => {
        setReceipts((list) => {
          const r = list.find((x) => x.id === id);
          if (r?.imageUri?.startsWith(FileSystem.documentDirectory || '__none__')) {
            FileSystem.deleteAsync(r.imageUri, { idempotent: true }).catch(() => {});
          }
          return list.filter((x) => x.id !== id);
        });
        setReports((rs) => rs.map((rep) => ({ ...rep, receiptIds: rep.receiptIds.filter((x) => x !== id) })));
      },
      clearDemo: () => setReceipts((list) => list.filter((r) => !r.demo)),
      addReport: (rep) => {
        const r = { id: uid(), createdAt: Date.now(), status: 'draft', ...rep };
        setReports((list) => [r, ...list]);
        return r;
      },
      updateReport: (id, patch) => setReports((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r))),
      deleteReport: (id) => setReports((list) => list.filter((r) => r.id !== id)),
      setSettings: (patch) => setSettings((s) => ({ ...s, ...patch })),
    };
  }, [settings.currency]);

  const aiReady = webAI || hasKey(settings);
  const value = { ready, receipts, reports, settings, aiReady, webAI, ...api };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
