// App-wide state: receipts, expense reports and settings, persisted with AsyncStorage.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { uid, toISO } from './utils';
import { CATEGORY_KEYS, OTHERS, autoCategorize, migrateCategory, setCustomCategories } from './categories';
import { webSample, hasKey } from './ai';
import { isWeb } from './platform';
import * as Drive from './drive';
import { APP_KEYS, omit, pick, useCompanies } from './companies';


const DEFAULT_SETTINGS = {
  name: '',
  company: '',
  currency: 'MYR',
  accountantName: '',
  accountantEmail: '',
  provider: 'claude', // 'claude' | 'openai'
  apiKey: '',
  driveEnabled: false, // auto-save receipts to Google Drive
  driveEmail: '',
  customCategories: [], // [{ key, icon, color }] added by the user
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

// One company's data. dataKey: where it is saved. withSamples: load the sample receipts on a fresh
// start (first company only). companyName: pre-fills the company name on a new company's reports.
// `settings` seen by screens = this company's details + the app-wide settings shared by all companies.
export function StoreProvider({ children, dataKey = 'scantrack:v1', withSamples = true, companyName = '', folderName = null }) {
  const [ready, setReady] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [reports, setReports] = useState([]);
  const [companySettings, setCompanySettings] = useState(() => omit(DEFAULT_SETTINGS, APP_KEYS));
  const { appSettings, setAppSettings } = useCompanies();
  const settings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...companySettings, company: companySettings.company || folderName || '', ...pick(appSettings, APP_KEYS) }),
    [companySettings, appSettings, folderName]
  );
  // Accepts a patch or (current settings) => new settings, and saves each key where it belongs.
  const setSettings = useCallback(
    (patchOrFn) => {
      const cur = latestSettings.current;
      const next = typeof patchOrFn === 'function' ? patchOrFn(cur) : { ...cur, ...patchOrFn };
      const app = pick(next, APP_KEYS);
      const comp = omit(next, APP_KEYS);
      latestSettings.current = { ...cur, ...next };
      setAppSettings((a) => ({ ...a, ...app }));
      setCompanySettings((c) => ({ ...c, ...comp }));
    },
    [setAppSettings]
  );
  const latestSettings = useRef(settings);
  latestSettings.current = settings;
  const [webAI, setWebAI] = useState(false);
  const [driveTrash, setDriveTrash] = useState([]); // Drive file ids of deleted receipts, to move to the Drive bin
  const [driveStatus, setDriveStatus] = useState({ syncing: false, lastSync: null, error: null });
  const loaded = useRef(false);

  useEffect(() => {
    webSample().then((fn) => setWebAI(!!fn));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(dataKey);
        if (raw) {
          const s = JSON.parse(raw);
          // Register the user's own categories first so their receipts aren't moved to Others.
          setCustomCategories(s.settings?.customCategories || []);
          setReceipts((s.receipts || []).map((r) => ({ ...r, category: migrateCategory(r) })));
          setReports(s.reports || []);
          setDriveTrash(s.driveTrash || []);
          setCompanySettings({ ...omit(DEFAULT_SETTINGS, APP_KEYS), ...omit(s.settings, APP_KEYS) });
        } else {
          if (withSamples) setReceipts(demoReceipts());
          if (companyName) setCompanySettings((st) => ({ ...st, company: companyName }));
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
    AsyncStorage.setItem(dataKey, JSON.stringify({ receipts, reports, settings: companySettings, driveTrash })).catch(() => {});
  }, [receipts, reports, companySettings, driveTrash]);

  // ---------- Google Drive auto-save ----------
  // Every add/edit sets driveDirty and bumps _rev; the sync uploads dirty receipts and clears the
  // flag only if the receipt wasn't edited again while uploading.
  const latest = useRef({});
  latest.current = { receipts, settings, driveTrash };
  const syncing = useRef(false);
  const forceSheet = useRef(false);

  const runSync = useCallback(async () => {
    const { receipts: list, settings: st, driveTrash: trash } = latest.current;
    if (!st.driveEnabled || !Drive.driveAvailable() || syncing.current) return;
    const dirty = list.filter((r) => !r.demo && r.driveDirty);
    if (!dirty.length && !trash.length && !forceSheet.current) return;
    syncing.current = true;
    forceSheet.current = false;
    setDriveStatus((d) => ({ ...d, syncing: true, error: null }));
    let ok = false;
    try {
      for (const r of dirty) {
        const fields = await Drive.syncReceipt(r);
        setReceipts((cur) => cur.map((x) => (x.id !== r.id ? x : { ...x, ...fields, driveDirty: x._rev === r._rev ? false : x.driveDirty })));
      }
      for (const id of trash) {
        await Drive.trashFile(id);
        setDriveTrash((t) => t.filter((x) => x !== id));
      }
      await Drive.updateSheet(latest.current.receipts.filter((r) => !r.demo));
      setDriveStatus({ syncing: false, lastSync: Date.now(), error: null });
      ok = true;
    } catch (e) {
      setDriveStatus((d) => ({ ...d, syncing: false, error: e.message || 'Google Drive sync failed.' }));
    } finally {
      syncing.current = false;
    }
    // Pick up anything saved while this sync was running.
    if (ok && latest.current.receipts.some((r) => !r.demo && r.driveDirty)) setTimeout(() => runSync(), 1500);
  }, []);

  useEffect(() => {
    if (!ready || !settings.driveEnabled) return;
    const t = setTimeout(() => runSync(), 2500);
    return () => clearTimeout(t);
  }, [ready, receipts, driveTrash, settings.driveEnabled, runSync]);

  const connectDrive = useCallback(async () => {
    const who = await Drive.signIn();
    if (!who) return null;
    // Back up receipts saved before Drive was connected.
    setReceipts((list) => list.map((r) => (r.demo || r.driveFileId ? r : { ...r, driveDirty: true, _rev: (r._rev || 0) + 1 })));
    forceSheet.current = true;
    setSettings((s) => ({ ...s, driveEnabled: true, driveEmail: who.email }));
    return who;
  }, []);

  const disconnectDrive = useCallback(async () => {
    await Drive.signOut();
    setSettings((s) => ({ ...s, driveEnabled: false, driveEmail: '' }));
    setDriveStatus({ syncing: false, lastSync: null, error: null });
  }, []);

  const syncNow = useCallback(() => {
    forceSheet.current = true;
    return runSync();
  }, [runSync]);

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
          driveDirty: true,
          _rev: 1,
        };
        setReceipts((list) => [rec, ...list]);
        return rec;
      },
      updateReceipt: (id, patch) =>
        setReceipts((list) =>
          list.map((r) => (r.id === id ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch), driveDirty: true, _rev: (r._rev || 0) + 1 } : r))
        ),
      updateMany: (ids, patchFn) =>
        setReceipts((list) => list.map((r) => (ids.includes(r.id) ? { ...r, ...patchFn(r), driveDirty: true, _rev: (r._rev || 0) + 1 } : r))),
      deleteReceipt: (id) => {
        const r = latest.current.receipts.find((x) => x.id === id);
        if (r?.driveFileId) setDriveTrash((t) => (t.includes(r.driveFileId) ? t : [...t, r.driveFileId]));
        if (r?.imageUri?.startsWith(FileSystem.documentDirectory || '__none__')) {
          FileSystem.deleteAsync(r.imageUri, { idempotent: true }).catch(() => {});
        }
        setReceipts((list) => list.filter((x) => x.id !== id));
        setReports((rs) => rs.map((rep) => ({ ...rep, receiptIds: rep.receiptIds.filter((x) => x !== id) })));
      },
      clearDemo: () => setReceipts((list) => list.filter((r) => !r.demo)),
      // Take a receipt out of this company without deleting its photo or Drive copy (it moved to another company).
      detachReceipt: (id) => {
        setReceipts((list) => list.filter((x) => x.id !== id));
        setReports((rs) => rs.map((rep) => ({ ...rep, receiptIds: rep.receiptIds.filter((x) => x !== id) })));
      },
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

  setCustomCategories(settings.customCategories || []);
  Drive.setExpectedAccount(settings.driveEnabled ? settings.driveEmail : null);
  Drive.setCompany(folderName);

  // Add a category of the user's own. Returns its name, or throws if the name is empty or taken.
  const addCategory = useCallback(({ name, icon, color }) => {
    const key = String(name || '').replace(/\s+/g, ' ').trim();
    if (!key) throw new Error('Type a name for the category.');
    if (key.length > 30) throw new Error('Keep the name to 30 characters or fewer.');
    if (CATEGORY_KEYS.some((k) => k.toLowerCase() === key.toLowerCase())) throw new Error(`"${key}" already exists.`);
    const next = [...(latest.current.settings.customCategories || []), { key, icon, color }];
    setCustomCategories(next);
    setSettings((st) => ({ ...st, customCategories: next }));
    return key;
  }, []);

  // Remove one of the user's categories; its receipts move to Others.
  const deleteCategory = useCallback((key) => {
    const next = (latest.current.settings.customCategories || []).filter((c) => c.key !== key);
    setCustomCategories(next);
    setSettings((st) => ({ ...st, customCategories: next }));
    setReceipts((list) => list.map((r) => (r.category === key ? { ...r, category: OTHERS, driveDirty: true, _rev: (r._rev || 0) + 1 } : r)));
  }, []);

  const aiReady = webAI || hasKey(settings);
  const driveWaiting = settings.driveEnabled ? receipts.filter((r) => !r.demo && r.driveDirty).length : 0;
  const drive = { available: Drive.driveAvailable(), status: driveStatus, waiting: driveWaiting, connect: connectDrive, disconnect: disconnectDrive, syncNow };
  const value = { ready, receipts, reports, settings, aiReady, webAI, drive, addCategory, deleteCategory, ...api };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
