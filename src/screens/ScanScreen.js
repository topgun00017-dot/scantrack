// Scan receipts: snap a photo (or pick several) and let AI capture every line, tax and total.
import { showAlert, isWeb, dataUrlParts } from '../platform';
import { Icon } from '../icons';
import CompanySwitcher from '../CompanySwitcher';
import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useStore } from '../store';
import { extractReceipt } from '../ai';
import { Button, Card, Header, s } from '../components';
import { colors } from '../theme';
import { findDuplicate, today } from '../utils';

export default function ScanScreen({ nav, params }) {
  const { settings, persistImage, addReceipt, aiReady, receipts } = useStore();
  const [busy, setBusy] = useState(null); // { uri, label }
  const hasAI = aiReady;

  const process = async (picked) => {
    let asset = picked;
    const imageUri = await persistImage(asset.uri);
    const parts = dataUrlParts(asset.uri);
    if (parts && !asset.base64) asset = { ...asset, base64: parts.base64, mimeType: parts.mime };
    if (!hasAI || !asset.base64) {
      return { imageUri, merchant: '', date: today(), total: 0, tax: 0, subtotal: 0, category: 'Others', lineItems: [], status: 'needs_review' };
    }
    const data = await extractReceipt(settings, asset.base64, asset.mimeType || 'image/jpeg');
    return { imageUri, ...data };
  };

  const fromCamera = async () => {
    const perm = isWeb ? { granted: true } : await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return showAlert('Camera access needed', 'Allow camera access in Settings to scan receipts.');
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    if (res.canceled) return;
    const asset = res.assets[0];
    setBusy({ uri: asset.uri, label: hasAI ? 'Reading your receipt…' : 'Saving photo…' });
    try {
      const draft = await process(asset);
      nav.push('receipt', { draft });
    } catch (e) {
      showAlert('Could not read receipt', `${e.message}\n\nYou can enter the details manually.`);
      nav.push('receipt', { draft: { imageUri: await persistImage(asset.uri), date: today(), total: 0, tax: 0, lineItems: [], category: 'Others', status: 'needs_review' } });
    } finally {
      setBusy(null);
    }
  };

  // Tapping the camera button in the tab bar while already on Scan takes a photo straight away.
  useEffect(() => {
    if (params?.snap) fromCamera();
  }, [params?.at]);

  const fromLibrary = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true, allowsMultipleSelection: true, selectionLimit: 10 });
    if (res.canceled) return;
    if (res.assets.length === 1) {
      const asset = res.assets[0];
      setBusy({ uri: asset.uri, label: hasAI ? 'Reading your receipt…' : 'Saving photo…' });
      try {
        nav.push('receipt', { draft: await process(asset) });
      } catch (e) {
        showAlert('Could not read receipt', e.message);
      } finally {
        setBusy(null);
      }
      return;
    }
    // Batch: process each and save straight into the archive.
    let ok = 0;
    let dups = 0;
    const known = [...receipts];
    let review = 0;
    for (let i = 0; i < res.assets.length; i++) {
      const asset = res.assets[i];
      setBusy({ uri: asset.uri, label: `Processing ${i + 1} of ${res.assets.length}…` });
      try {
        const d = await process(asset);
        const rec = { ...d, merchant: d.merchant || 'Unknown merchant' };
        if (findDuplicate(known, rec)) dups++;
        known.push(addReceipt(rec));
        d.status === 'needs_review' ? review++ : ok++;
      } catch (e) {
        review++;
        addReceipt({ imageUri: await persistImage(asset.uri), merchant: 'Unreadable receipt', date: today(), total: 0, tax: 0, category: 'Others', status: 'needs_review' });
      }
    }
    setBusy(null);
    showAlert(
      'Batch done',
      `${ok} processed${review ? `, ${review} need review` : ''}.` +
        (dups ? `\n\n${dups} look like receipts you already have. Check them under More → Prepare for accounting.` : ''),
      [{ text: 'View receipts', onPress: () => nav.tab('receipts') }]
    );
  };

  if (busy) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Image source={{ uri: busy.uri }} style={{ width: 220, height: 300, borderRadius: 16, opacity: 0.85 }} />
        <Text style={[s.h2, { marginTop: 20 }]}>{busy.label}</Text>
        <Text style={[s.sub, { marginTop: 6 }]}>{hasAI ? 'Capturing merchant, date, line items, tax and total' : 'Add the details on the next screen'}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <Header title="Scan" />
      <View style={{ paddingHorizontal: 16 }}>
        <CompanySwitcher label="Save to" onManage={() => nav.push('settings')} style={{ marginBottom: 12 }} />
        <Card style={{ alignItems: 'center', paddingVertical: 36 }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.accent + '33', alignItems: 'center', justifyContent: 'center' }}><Icon name="scan" size={44} color={colors.accentInk} /></View>
          <Text style={[s.h2, { marginTop: 12 }]}>Capture a receipt</Text>
          <Text style={[s.sub, { textAlign: 'center', marginTop: 6, marginBottom: 20 }]}>
            Lay it flat, fill the frame, good light. Every line, tax and total gets captured.
          </Text>
          <Button title="Snap Picture" icon="camera" onPress={fromCamera} style={{ alignSelf: 'stretch' }} />
          <Button title="Upload from gallery (up to 10)" icon="images" variant="secondary" onPress={fromLibrary} style={{ alignSelf: 'stretch', marginTop: 10 }} />
          <Button title="Enter manually" variant="ghost" onPress={() => nav.push('receipt', { draft: { date: today(), total: 0, tax: 0, lineItems: [], category: 'Others' } })} style={{ marginTop: 6 }} />
        </Card>

        {!hasAI && (
          <Card style={{ marginTop: 12, borderColor: colors.warning }} onPress={() => nav.push('settings')}>
            <Text style={[s.body, { fontWeight: '700' }]}>AI reading is off</Text>
            <Text style={[s.sub, { marginTop: 4 }]}>Add a Claude or ChatGPT (OpenAI) API key in Settings to auto-read receipts. Until then, photos are saved and you type the details. Tap to open Settings.</Text>
          </Card>
        )}
      </View>
    </ScrollView>
  );
}
