// Platform bridge. On a phone everything uses native APIs; in the web build
// (run as a claude.ai artifact) AI goes through the viewer's Claude account
// (`sample` capability), files are offered with the `downloads` capability,
// and confirmations use an in-app dialog because browser dialogs are blocked.
import { Alert, Platform } from 'react-native';

export const isWeb = Platform.OS === 'web';

const caps = {};
export function capability(name) {
  if (!isWeb) return Promise.resolve(null);
  if (!caps[name]) {
    const c = typeof window !== 'undefined' ? window.claude : null;
    caps[name] = c?.use ? c.use(name).catch(() => null) : Promise.resolve(null);
  }
  return caps[name];
}

// ---------- dialogs ----------
let dialogListener = null;
export function setDialogListener(fn) {
  dialogListener = fn;
}

export function showAlert(title, message, buttons) {
  if (!isWeb) return Alert.alert(title, message, buttons);
  const list = buttons && buttons.length ? buttons : [{ text: 'OK' }];
  if (dialogListener) dialogListener({ title, message, buttons: list });
}

// ---------- base64 helpers ----------
export function dataUrlParts(uri) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(uri || '');
  if (!m) return null;
  return { mime: m[1] || 'application/octet-stream', base64: m[2] ? m[3] : btoa(decodeURIComponent(m[3])) };
}

export function base64ToBlob(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

// ---------- web download ----------
export async function webSave(filename, data) {
  const downloads = await capability('downloads');
  if (!downloads) throw new Error('Downloads are not available in this view.');
  try {
    await downloads.save({ filename, data });
  } catch (e) {
    if (e?.code === 'declined') return;
    throw new Error(e?.message || 'The file could not be saved.');
  }
}
