// Turning a photo into a receipt draft: save the image, read it with AI, open the review form.
// Shared by the camera (any screen) and gallery upload.
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useStore } from './store';
import { extractReceipt } from './ai';
import { dataUrlParts, showAlert } from './platform';
import { findDuplicate, today } from './utils';

export const emptyDraft = (extra = {}) => ({ date: today(), total: 0, tax: 0, lineItems: [], category: 'Others', ...extra });

let cameraListener = null;
// The orange camera button: on Android, Google's document scanner finds the receipt's edges and
// keeps only the receipt (straightened, background removed). Elsewhere, or if that scanner isn't
// available, the app's own camera opens.
export function openCamera() {
  cameraListener?.('scan');
}
// Hold the orange button: the app's own camera (guide frame, Upload, Manual, company).
export function openClassicCamera() {
  cameraListener?.('classic');
}
// "Add receipts" panel: pick photos from the gallery, or files (photos, HEIC, PDF) from anywhere.
export function openGallery() {
  cameraListener?.('gallery');
}
export function openFiles() {
  cameraListener?.('files');
}
export const isPdf = (uri) => /\.pdf$/i.test(uri || '');
const MAX_PDF_MB = 10;

// Any photo (JPG, PNG, HEIC…) → JPEG at most 1600 px wide, with base64 for the AI.
async function shrinkPhoto(uri) {
  const first = await ImageManipulator.manipulate(uri).renderAsync();
  const ctx = first.width > 1600 ? ImageManipulator.manipulate(uri).resize({ width: 1600 }) : ImageManipulator.manipulate(uri);
  const img = await ctx.renderAsync();
  const saved = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return { uri: saved.uri, base64: saved.base64, mimeType: 'image/jpeg' };
}

export function setCameraListener(fn) {
  cameraListener = fn;
}

export function useCapture(nav) {
  const { settings, persistImage, addReceipt, aiReady, receipts } = useStore();
  const [busy, setBusy] = useState(null); // { uri, label }

  // asset: { uri, base64?, mimeType? } → draft receipt fields
  const toDraft = async (picked) => {
    let asset = picked;
    const imageUri = await persistImage(asset.uri, asset.mimeType === 'application/pdf' ? 'pdf' : undefined);
    const parts = dataUrlParts(asset.uri);
    if (parts && !asset.base64) asset = { ...asset, base64: parts.base64, mimeType: parts.mime };
    if (!aiReady || !asset.base64) return emptyDraft({ imageUri, merchant: '', status: 'needs_review' });
    const data = await extractReceipt(settings, asset.base64, asset.mimeType || 'image/jpeg');
    return { imageUri, ...data };
  };

  // One photo → review form.
  const processPhoto = async (asset) => {
    setBusy({ uri: asset.mimeType === 'application/pdf' ? null : asset.uri, label: aiReady ? 'Reading your receipt…' : 'Saving…' });
    try {
      const draft = await toDraft(asset);
      nav.push('receipt', { draft });
    } catch (e) {
      showAlert('Could not read receipt', `${e.message}\n\nYou can enter the details yourself.`);
      nav.push('receipt', { draft: emptyDraft({ imageUri: await persistImage(asset.uri, asset.mimeType === 'application/pdf' ? 'pdf' : undefined), status: 'needs_review', lowConfidence: ['merchant', 'date', 'total'] }) });
    } finally {
      setBusy(null);
    }
  };

  // One item → review form; several → saved straight into the list.
  const processMany = async (assets) => {
    if (!assets.length) return;
    if (assets.length === 1) return processPhoto(assets[0]);
    let ok = 0;
    let review = 0;
    let dups = 0;
    const known = [...receipts];
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      setBusy({ uri: asset.mimeType === 'application/pdf' ? null : asset.uri, label: `Processing ${i + 1} of ${assets.length}…` });
      try {
        const d = await toDraft(asset);
        const rec = { ...d, merchant: d.merchant || 'Unknown merchant' };
        delete rec.lowConfidence;
        if (findDuplicate(known, rec)) dups++;
        known.push(addReceipt(rec));
        d.status === 'needs_review' ? review++ : ok++;
      } catch {
        review++;
        addReceipt({ imageUri: await persistImage(asset.uri, asset.mimeType === 'application/pdf' ? 'pdf' : undefined), merchant: 'Unreadable receipt', date: today(), total: 0, tax: 0, category: 'Others', status: 'needs_review' });
      }
    }
    setBusy(null);
    showAlert(
      'Batch done',
      `${ok} processed${review ? `, ${review} need review` : ''}.` + (dups ? `\n\n${dups} look like receipts you already have. Check them under More → Prepare for accounting.` : ''),
      [{ text: 'View receipts', onPress: () => nav.tab('receipts') }]
    );
  };

  // Gallery photos (up to 10).
  const fromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true, allowsMultipleSelection: true, selectionLimit: 10 });
    if (res.canceled) return;
    return processMany(res.assets);
  };

  // Files from anywhere on the phone (Downloads, Drive, WhatsApp…): photos incl. HEIC, and PDFs.
  const fromFiles = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf'], multiple: true, copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    const picked = res.assets.slice(0, 10);
    const assets = [];
    const skipped = [];
    for (const f of picked) {
      const pdf = f.mimeType === 'application/pdf' || isPdf(f.name) || isPdf(f.uri);
      try {
        if (pdf) {
          if (f.size && f.size > MAX_PDF_MB * 1024 * 1024) {
            skipped.push(`${f.name} (over ${MAX_PDF_MB} MB)`);
            continue;
          }
          const base64 = await FileSystem.readAsStringAsync(f.uri, { encoding: 'base64' });
          assets.push({ uri: f.uri, base64, mimeType: 'application/pdf' });
        } else {
          assets.push(await shrinkPhoto(f.uri));
        }
      } catch {
        skipped.push(f.name || 'a file');
      }
    }
    if (res.assets.length > 10) skipped.push(`${res.assets.length - 10} more (max 10 at a time)`);
    if (skipped.length) showAlert('Some files were skipped', skipped.join('\n'));
    return processMany(assets);
  };

  const manual = () => nav.push('receipt', { draft: emptyDraft() });

  return { busy, processPhoto, fromGallery, fromFiles, manual, aiReady };
}
