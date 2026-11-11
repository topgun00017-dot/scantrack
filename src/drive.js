// Google Drive backup: sign in with Google, then each saved receipt photo is uploaded to
//   My Drive / ScanTrack Receipts / <year> / <MM - Month> / <date> <merchant> <amount>.jpg
// and a "ScanTrack receipts list" Google Sheet with every receipt is kept up to date.
// Uses the drive.file scope, so the app can only see the files it created itself.
import * as FileSystem from 'expo-file-system/legacy';
import { isWeb } from './platform';
import { buildCSV } from './exporters';
import { money } from './utils';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER = 'application/vnd.google-apps.folder';
const ROOT_NAME = 'ScanTrack Receipts';
const SHEET_NAME = 'ScanTrack receipts list';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// The native Google sign-in module exists only in the installed app (not Expo Go or web).
let GS = null;
let configured = false;
function lib() {
  if (isWeb) return null;
  if (!GS) {
    try {
      GS = require('@react-native-google-signin/google-signin');
    } catch {
      GS = false;
    }
  }
  if (GS && !configured) {
    GS.GoogleSignin.configure({ scopes: SCOPES });
    configured = true;
  }
  return GS || null;
}

export const driveAvailable = () => !!lib();

function friendly(e) {
  const g = lib();
  const code = e?.code;
  if (g && code === g.statusCodes?.SIGN_IN_CANCELLED) return null;
  if (g && code === g.statusCodes?.PLAY_SERVICES_NOT_AVAILABLE) return 'Google Play services is not available or needs an update on this phone.';
  if (String(code) === '10' || /DEVELOPER_ERROR/i.test(e?.message || '')) {
    return 'Google sign-in is not set up for this app yet. In Google Cloud Console, add an Android OAuth client for package com.scantrack.app with the SHA-1 shown in Settings, and enable the Google Drive API.';
  }
  return e?.message || 'Google sign-in failed.';
}

export async function signIn() {
  const g = lib();
  if (!g) throw new Error('Google Drive backup works in the installed app only.');
  try {
    await g.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const res = await g.GoogleSignin.signIn();
    if (res?.type !== 'success') return null;
    // Older sign-ins may lack the Drive scope; ask for it explicitly.
    if (!(res.data.scopes || []).includes(SCOPES[0])) await g.GoogleSignin.addScopes({ scopes: SCOPES });
    return { email: res.data.user.email, name: res.data.user.name };
  } catch (e) {
    const msg = friendly(e);
    if (msg === null) return null;
    throw new Error(msg);
  }
}

export async function signOut() {
  const g = lib();
  if (g) await g.GoogleSignin.signOut().catch(() => {});
  cache.clear();
  for (const k of Object.keys(sheetIds)) delete sheetIds[k];
}

// The Google account this user connected. On a shared phone another user's account may still be
// signed in, so uploads stop rather than going to the wrong Drive.
let expectedEmail = null;
export function setExpectedAccount(email) {
  if (email !== expectedEmail) {
    expectedEmail = email || null;
    cache.clear();
    for (const k of Object.keys(sheetIds)) delete sheetIds[k];
  }
}

async function token() {
  const g = lib();
  if (!g) throw new Error('Google Drive is not available here.');
  if (!g.GoogleSignin.getCurrentUser()) {
    const r = await g.GoogleSignin.signInSilently();
    if (r?.type !== 'success') throw new Error('Signed out of Google. Tap Sign in with Google to reconnect.');
  }
  const current = g.GoogleSignin.getCurrentUser()?.user?.email;
  if (expectedEmail && current && current.toLowerCase() !== expectedEmail.toLowerCase()) {
    await g.GoogleSignin.signOut().catch(() => {});
    throw new Error(`Google is signed in as a different account. Sign in again as ${expectedEmail}.`);
  }
  const { accessToken } = await g.GoogleSignin.getTokens();
  return accessToken;
}

async function api(tok, url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { authorization: `Bearer ${tok}`, ...(opts.headers || {}) } });
  if (res.status === 204) return null;
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(json?.error?.message || `Google Drive error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

// ---------- folders (cached for the session) ----------
const cache = new Map();
const q = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

async function folder(tok, name, parent) {
  const key = `${parent || 'root'}/${name}`;
  if (cache.has(key)) return cache.get(key);
  const query = `mimeType='${FOLDER}' and name='${q(name)}' and trashed=false and '${parent || 'root'}' in parents`;
  const found = await api(tok, `${API}?q=${encodeURIComponent(query)}&fields=files(id)&spaces=drive`);
  let id = found?.files?.[0]?.id;
  if (!id) {
    const made = await api(tok, `${API}?fields=id`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER, parents: [parent || 'root'] }),
    });
    id = made.id;
  }
  cache.set(key, id);
  return id;
}

// Each company gets its own folder: ScanTrack Receipts / <company> / <year> / <month>.
let companyName = null;
export function setCompany(name) {
  companyName = name ? safe(name).slice(0, 80) : null;
}

async function companyFolder(tok) {
  const root = await folder(tok, ROOT_NAME);
  return companyName ? folder(tok, companyName, root) : root;
}

async function monthFolder(tok, date) {
  const [y, m] = (date || '').split('-');
  const base = await companyFolder(tok);
  const year = await folder(tok, y || 'Undated', base);
  const mi = Number(m) - 1;
  return folder(tok, mi >= 0 && mi < 12 ? `${m} - ${MONTHS[mi]}` : 'Undated', year);
}

// ---------- receipts ----------
const safe = (s) => String(s || '').replace(/[\\/:*?"<>|\n\r]+/g, ' ').replace(/\s+/g, ' ').trim();

function fileName(r) {
  const ext = (r.imageUri || '').match(/\.(png|jpe?g|webp|heic)$/i)?.[1]?.toLowerCase() || 'jpg';
  return `${r.date} ${safe(r.merchant).slice(0, 60)} ${money(r.total, r.currency)}.${ext}`;
}

function description(r) {
  return [
    `Merchant: ${r.merchant}`,
    `Date: ${r.date}`,
    `Total: ${money(r.total, r.currency)}   Tax: ${money(r.tax, r.currency)}`,
    `Category: ${r.category}`,
    r.paymentMethod && `Payment: ${r.paymentMethod}`,
    (r.tags || []).length && `Tags: ${r.tags.map((t) => '#' + t).join(' ')}`,
    r.notes && `Notes: ${r.notes}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function multipart(meta, mime, base64) {
  const b = 'scantrack' + Date.now().toString(36);
  const body =
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${b}\r\nContent-Type: ${mime}\r\nContent-Transfer-Encoding: base64\r\n\r\n${base64}\r\n--${b}--`;
  return { body, type: `multipart/related; boundary=${b}` };
}

// Upload a new receipt photo, or update name/description/folder of one already uploaded.
// Returns the fields to store on the receipt.
export async function syncReceipt(r) {
  const tok = await token();
  const parent = await monthFolder(tok, r.date);
  const meta = { name: fileName(r), description: description(r) };

  if (r.driveFileId) {
    try {
      const move = r.driveFolderId && r.driveFolderId !== parent ? `&addParents=${parent}&removeParents=${r.driveFolderId}` : '';
      await api(tok, `${API}/${r.driveFileId}?fields=id${move}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(meta),
      });
      return { driveFileId: r.driveFileId, driveFolderId: parent };
    } catch (e) {
      if (e.status !== 404) throw e; // deleted in Drive: upload it again below
    }
  }

  if (!r.imageUri) return { driveFileId: null, driveFolderId: null }; // typed-in receipt: listed in the sheet only
  const base64 = await FileSystem.readAsStringAsync(r.imageUri, { encoding: FileSystem.EncodingType?.Base64 || 'base64' });
  const mime = /\.png$/i.test(r.imageUri) ? 'image/png' : 'image/jpeg';
  const mp = multipart({ ...meta, parents: [parent] }, mime, base64);
  const made = await api(tok, `${UPLOAD}?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'content-type': mp.type }, body: mp.body });
  return { driveFileId: made.id, driveFolderId: parent };
}

// Move a deleted receipt's photo to the Drive bin (recoverable for 30 days).
export async function trashFile(fileId) {
  const tok = await token();
  try {
    await api(tok, `${API}/${fileId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  } catch (e) {
    if (e.status !== 404) throw e;
  }
}

// Keep a Google Sheet listing every receipt in the ScanTrack Receipts folder.
const sheetIds = {}; // per company
// Links for the "Receipt saved" panel.
export const fileUrl = (fileId) => (fileId ? `https://drive.google.com/file/d/${fileId}/view` : null);
export function sheetUrl() {
  const id = sheetIds[companyName || '_'];
  return id ? `https://docs.google.com/spreadsheets/d/${id}/edit` : null;
}

export async function updateSheet(receipts) {
  const tok = await token();
  const root = await companyFolder(tok);
  const csv = buildCSV(receipts);
  const ck = companyName || '_';
  let sheetId = sheetIds[ck] || null;
  if (!sheetId) {
    const query = `name='${q(SHEET_NAME)}' and trashed=false and '${root}' in parents`;
    const found = await api(tok, `${API}?q=${encodeURIComponent(query)}&fields=files(id)&spaces=drive`);
    sheetId = found?.files?.[0]?.id || null;
  }
  if (sheetId) {
    try {
      await api(tok, `${UPLOAD}/${sheetId}?uploadType=media&fields=id`, { method: 'PATCH', headers: { 'content-type': 'text/csv' }, body: csv });
      sheetIds[ck] = sheetId;
      return;
    } catch (e) {
      if (e.status !== 404) throw e;
      sheetId = null;
    }
  }
  const b = 'scantrack' + Date.now().toString(36);
  const body =
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: SHEET_NAME, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [root] }) +
    `\r\n--${b}\r\nContent-Type: text/csv; charset=UTF-8\r\n\r\n${csv}\r\n--${b}--`;
  const made = await api(tok, `${UPLOAD}?uploadType=multipart&fields=id`, { method: 'POST', headers: { 'content-type': `multipart/related; boundary=${b}` }, body });
  sheetIds[ck] = made.id;
}
