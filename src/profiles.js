// Several people on one phone: each profile has its own receipts, reports and settings,
// stored under its own key. An optional 4–6 digit PIN keeps others out of a profile.
// (The PIN is a privacy lock for a shared phone, not encryption of the data.)
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Drive from './drive';

const PROFILES_KEY = 'scantrack:profiles';
const LEGACY_DATA_KEY = 'scantrack:v1'; // data saved before profiles existed belongs to the first profile
export const AVATAR_COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EC4899', '#8B5CF6', '#EF4444', '#14B8A6', '#64748B'];

const newId = () => 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// Salted string hash for the PIN (not stored in plain text).
export function hashPin(pin, salt) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  const str = `${salt}:${pin}:scantrack`;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 + c, 2246822519) >>> 0;
  }
  return h1.toString(16) + h2.toString(16);
}

export const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || '?';

const Ctx = createContext(null);

export function ProfilesProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    (async () => {
      let list = [];
      let active = null;
      try {
        const raw = await AsyncStorage.getItem(PROFILES_KEY);
        if (raw) {
          const s = JSON.parse(raw);
          list = s.profiles || [];
          active = s.activeId || null;
        }
        if (!list.length) {
          // First run after this update: turn the existing data into the first profile.
          let name = 'Me';
          try {
            const legacy = JSON.parse((await AsyncStorage.getItem(LEGACY_DATA_KEY)) || 'null');
            if (legacy?.settings?.name) name = legacy.settings.name;
          } catch {}
          list = [{ id: 'p_first', name, color: AVATAR_COLORS[0], dataKey: LEGACY_DATA_KEY, first: true, createdAt: Date.now() }];
          active = 'p_first';
        }
      } catch {
        list = [{ id: 'p_first', name: 'Me', color: AVATAR_COLORS[0], dataKey: LEGACY_DATA_KEY, first: true, createdAt: Date.now() }];
        active = 'p_first';
      }
      setProfiles(list);
      setActiveId(active);
      // Go straight in when there is one user with no PIN; otherwise ask who is using the app.
      const me = list.find((p) => p.id === active);
      setUnlocked(list.length === 1 && me && !me.pinHash);
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(PROFILES_KEY, JSON.stringify({ profiles, activeId })).catch(() => {});
  }, [ready, profiles, activeId]);

  const enter = useCallback((id) => {
    setActiveId(id);
    setUnlocked(true);
  }, []);

  // Back to "Who's using ScanTrack?". The Google account belongs to the user, so sign it out too.
  const switchUser = useCallback(async () => {
    setUnlocked(false);
    await Drive.signOut();
  }, []);

  const addProfile = useCallback(
    ({ name, pin }) => {
      const clean = String(name || '').replace(/\s+/g, ' ').trim();
      if (!clean) throw new Error('Type a name.');
      if (clean.length > 24) throw new Error('Keep the name to 24 characters or fewer.');
      if (profiles.some((p) => p.name.toLowerCase() === clean.toLowerCase())) throw new Error(`"${clean}" already exists.`);
      const id = newId();
      const made = {
        id,
        name: clean,
        color: AVATAR_COLORS[profiles.length % AVATAR_COLORS.length],
        dataKey: `scantrack:v1:${id}`,
        pinHash: pin ? hashPin(pin, id) : null,
        createdAt: Date.now(),
      };
      setProfiles((list) => [...list, made]);
      return made;
    },
    [profiles]
  );

  const updateProfile = useCallback((id, patch) => setProfiles((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p))), []);

  const setPin = useCallback((id, pin) => updateProfile(id, { pinHash: pin ? hashPin(pin, id) : null }), [updateProfile]);

  const checkPin = useCallback((profile, pin) => !profile.pinHash || profile.pinHash === hashPin(pin, profile.id), []);

  // Delete a user, their saved data and their receipt photos on this phone.
  const deleteProfile = useCallback(
    async (id) => {
      const p = profiles.find((x) => x.id === id);
      if (!p) return;
      try {
        const data = JSON.parse((await AsyncStorage.getItem(p.dataKey)) || 'null');
        for (const r of data?.receipts || []) {
          if (r.imageUri && FileSystem.documentDirectory && r.imageUri.startsWith(FileSystem.documentDirectory)) {
            await FileSystem.deleteAsync(r.imageUri, { idempotent: true }).catch(() => {});
          }
        }
      } catch {}
      await AsyncStorage.removeItem(p.dataKey).catch(() => {});
      setProfiles((list) => list.filter((x) => x.id !== id));
      if (activeId === id) {
        setUnlocked(false);
        await Drive.signOut();
      }
    },
    [profiles, activeId]
  );

  const active = profiles.find((p) => p.id === activeId) || null;
  const value = { ready, profiles, active, unlocked, enter, switchUser, addProfile, updateProfile, setPin, checkPin, deleteProfile };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useProfiles = () => useContext(Ctx);
