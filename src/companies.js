// One person, several companies. Each company keeps its own receipts, reports and company
// details under its own storage key; app-wide settings (Google account, AI keys, categories)
// are shared by all companies.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const COMPANIES_KEY = 'scantrack:companies';
const APP_KEY = 'scantrack:app';
const LEGACY_DATA_KEY = 'scantrack:v1'; // data from before companies existed → first company
const OLD_PROFILES_KEY = 'scantrack:profiles'; // short-lived multi-user build

// Settings shared by every company. Everything else in `settings` is per company.
export const APP_KEYS = ['name', 'provider', 'apiKey', 'model', 'openaiKey', 'openaiModel', 'driveEnabled', 'driveEmail', 'customCategories', 'insightsChart'];
export const COMPANY_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EC4899', '#8B5CF6', '#EF4444', '#14B8A6', '#64748B'];

const newId = () => 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const pick = (obj, keys) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => keys.includes(k)));
export const omit = (obj, keys) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !keys.includes(k)));

const readJSON = async (key) => {
  try {
    return JSON.parse((await AsyncStorage.getItem(key)) || 'null');
  } catch {
    return null;
  }
};

const Ctx = createContext(null);

export function CompaniesProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [appSettings, setAppSettingsState] = useState({});
  const latest = useRef({});
  latest.current = { companies, activeId, appSettings };

  useEffect(() => {
    (async () => {
      let list = [];
      let active = null;
      const saved = await readJSON(COMPANIES_KEY);
      if (saved?.companies?.length) {
        list = saved.companies;
        active = saved.activeId;
      } else {
        const oldProfiles = await readJSON(OLD_PROFILES_KEY);
        if (oldProfiles?.profiles?.length) {
          list = oldProfiles.profiles.map((p, i) => ({ id: p.id, name: p.name, color: p.color || COMPANY_COLORS[i % 8], dataKey: p.dataKey, first: !!p.first }));
          active = oldProfiles.activeId;
        } else {
          const legacy = await readJSON(LEGACY_DATA_KEY);
          const name = legacy?.settings?.company || 'My Company';
          list = [{ id: 'c_first', name, color: COMPANY_COLORS[0], dataKey: LEGACY_DATA_KEY, first: true }];
          active = 'c_first';
        }
      }
      if (!list.some((c) => c.id === active)) active = list[0].id;

      let app = await readJSON(APP_KEY);
      if (!app) {
        // Shared settings used to live inside the first company's data.
        const firstData = await readJSON(list[0].dataKey);
        app = pick(firstData?.settings, APP_KEYS);
      }
      setCompanies(list);
      setActiveId(active);
      setAppSettingsState(app || {});
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(COMPANIES_KEY, JSON.stringify({ companies, activeId })).catch(() => {});
  }, [ready, companies, activeId]);

  useEffect(() => {
    if (!ready) return;
    AsyncStorage.setItem(APP_KEY, JSON.stringify(appSettings)).catch(() => {});
  }, [ready, appSettings]);

  const setAppSettings = useCallback((patch) => setAppSettingsState((a) => ({ ...a, ...(typeof patch === 'function' ? patch(a) : patch) })), []);

  const switchCompany = useCallback((id) => setActiveId(id), []);

  const checkName = (name, exceptId) => {
    const clean = String(name || '').replace(/\s+/g, ' ').trim();
    if (!clean) throw new Error('Type a company name.');
    if (clean.length > 40) throw new Error('Keep the name to 40 characters or fewer.');
    if (latest.current.companies.some((c) => c.id !== exceptId && c.name.toLowerCase() === clean.toLowerCase())) throw new Error(`"${clean}" already exists.`);
    return clean;
  };

  const addCompany = useCallback((name) => {
    const clean = checkName(name);
    const id = newId();
    const list = latest.current.companies;
    const made = { id, name: clean, color: COMPANY_COLORS[list.length % COMPANY_COLORS.length], dataKey: `scantrack:v1:${id}` };
    setCompanies((l) => [...l, made]);
    return made;
  }, []);

  const renameCompany = useCallback((id, name) => {
    const clean = checkName(name, id);
    setCompanies((l) => l.map((c) => (c.id === id ? { ...c, name: clean } : c)));
    return clean;
  }, []);

  // Remove a company with its receipts, reports and photos on this phone (Drive copies are kept).
  const deleteCompany = useCallback(async (id) => {
    const { companies: list, activeId: act } = latest.current;
    if (list.length <= 1) throw new Error('You need at least one company.');
    const c = list.find((x) => x.id === id);
    if (!c) return;
    const data = await readJSON(c.dataKey);
    for (const r of data?.receipts || []) {
      if (r.imageUri && FileSystem.documentDirectory && r.imageUri.startsWith(FileSystem.documentDirectory)) {
        await FileSystem.deleteAsync(r.imageUri, { idempotent: true }).catch(() => {});
      }
    }
    await AsyncStorage.removeItem(c.dataKey).catch(() => {});
    const rest = list.filter((x) => x.id !== id);
    setCompanies(rest);
    if (act === id) setActiveId(rest[0].id);
  }, []);

  // Put a receipt into another company's saved data (used by "Move to company").
  const sendReceiptTo = useCallback(async (companyId, receipt) => {
    const c = latest.current.companies.find((x) => x.id === companyId);
    if (!c) throw new Error('Company not found.');
    const data = (await readJSON(c.dataKey)) || { receipts: [], reports: [], settings: { company: c.name } };
    data.receipts = [{ ...receipt, driveDirty: true, _rev: (receipt._rev || 0) + 1 }, ...(data.receipts || []).filter((r) => r.id !== receipt.id)];
    await AsyncStorage.setItem(c.dataKey, JSON.stringify(data));
  }, []);

  const active = companies.find((c) => c.id === activeId) || null;
  const value = { ready, companies, active, appSettings, setAppSettings, switchCompany, addCompany, renameCompany, deleteCompany, sendReceiptTo };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCompanies = () => useContext(Ctx);
