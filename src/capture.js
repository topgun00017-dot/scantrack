// Turning a photo into a receipt draft: save the image, read it with AI, open the review form.
// Shared by the camera (any screen) and gallery upload.
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from './store';
import { extractReceipt } from './ai';
import { dataUrlParts, showAlert } from './platform';
import { findDuplicate, today } from './utils';

export const emptyDraft = (extra = {}) => ({ date: today(), total: 0, tax: 0, lineItems: [], category: 'Others', ...extra });

let cameraListener = null;
// Open the full-screen receipt camera from anywhere (the orange button in the tab bar).
export function openCamera() {
  cameraListener?.();
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
    const imageUri = await persistImage(asset.uri);
    const parts = dataUrlParts(asset.uri);
    if (parts && !asset.base64) asset = { ...asset, base64: parts.base64, mimeType: parts.mime };
    if (!aiReady || !asset.base64) return emptyDraft({ imageUri, merchant: '', status: 'needs_review' });
    const data = await extractReceipt(settings, asset.base64, asset.mimeType || 'image/jpeg');
    return { imageUri, ...data };
  };

  // One photo → review form.
  const processPhoto = async (asset) => {
    setBusy({ uri: asset.uri, label: aiReady ? 'Reading your receipt…' : 'Saving photo…' });
    try {
      const draft = await toDraft(asset);
      nav.push('receipt', { draft });
    } catch (e) {
      showAlert('Could not read receipt', `${e.message}\n\nYou can enter the details yourself.`);
      nav.push('receipt', { draft: emptyDraft({ imageUri: await persistImage(asset.uri), status: 'needs_review', lowConfidence: ['merchant', 'date', 'total'] }) });
    } finally {
      setBusy(null);
    }
  };

  // Gallery: one photo → review form; several → saved straight into the list.
  const fromGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true, allowsMultipleSelection: true, selectionLimit: 10 });
    if (res.canceled) return;
    if (res.assets.length === 1) return processPhoto(res.assets[0]);
    let ok = 0;
    let review = 0;
    let dups = 0;
    const known = [...receipts];
    for (let i = 0; i < res.assets.length; i++) {
      const asset = res.assets[i];
      setBusy({ uri: asset.uri, label: `Processing ${i + 1} of ${res.assets.length}…` });
      try {
        const d = await toDraft(asset);
        const rec = { ...d, merchant: d.merchant || 'Unknown merchant' };
        delete rec.lowConfidence;
        if (findDuplicate(known, rec)) dups++;
        known.push(addReceipt(rec));
        d.status === 'needs_review' ? review++ : ok++;
      } catch {
        review++;
        addReceipt({ imageUri: await persistImage(asset.uri), merchant: 'Unreadable receipt', date: today(), total: 0, tax: 0, category: 'Others', status: 'needs_review' });
      }
    }
    setBusy(null);
    showAlert(
      'Batch done',
      `${ok} processed${review ? `, ${review} need review` : ''}.` + (dups ? `\n\n${dups} look like receipts you already have. Check them under More → Prepare for accounting.` : ''),
      [{ text: 'View receipts', onPress: () => nav.tab('receipts') }]
    );
  };

  const manual = () => nav.push('receipt', { draft: emptyDraft() });

  return { busy, processPhoto, fromGallery, manual, aiReady };
}
