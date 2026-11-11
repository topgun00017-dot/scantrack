// "Receipt Saved!" panel shown after saving a receipt: the receipt's details plus live results
// (saved on the phone, uploaded to Google Drive, added to the receipts sheet).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useStore } from './store';
import { useCompanies } from './companies';
import * as Drive from './drive';
import { Button, s } from './components';
import { Icon } from './icons';
import { colors, radius } from './theme';
import { categoryMeta } from './categories';
import { money, prettyDate } from './utils';

let listener = null;
// Call after saving: showReceiptResult({ id, isNew }).
export function showReceiptResult(info) {
  listener?.(info);
}

export const receiptRef = (id) => 'RCP-' + String(id || '').slice(-6).toUpperCase();

function Row({ label, value }) {
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 4 }}>
      <Text style={[s.sub, { width: 92 }]}>{label}</Text>
      <Text style={[s.body, { flex: 1, fontWeight: '600' }]}>{value}</Text>
    </View>
  );
}

function Step({ state, text, detail }) {
  const icon =
    state === 'busy' ? (
      <ActivityIndicator size="small" color={colors.accentInk} />
    ) : (
      <Icon
        name={state === 'ok' ? 'circle-check' : state === 'error' ? 'circle-alert' : 'circle'}
        size={20}
        color={state === 'ok' ? colors.success : state === 'error' ? colors.danger : colors.faint}
      />
    );
  return (
    <View style={{ flexDirection: 'row', gap: 10, paddingVertical: 6 }}>
      <View style={{ width: 22, alignItems: 'center', paddingTop: 1 }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={[s.body, { color: state === 'error' ? colors.danger : colors.text }]}>{text}</Text>
        {!!detail && <Text style={[s.sub, { marginTop: 2 }]}>{detail}</Text>}
      </View>
    </View>
  );
}

export default function ReceiptResultHost() {
  const { receipts, settings, drive } = useStore();
  const { active: company } = useCompanies();
  const [info, setInfo] = useState(null);

  useEffect(() => {
    listener = setInfo;
    return () => {
      listener = null;
    };
  }, []);

  const r = info ? receipts.find((x) => x.id === info.id) : null;
  if (!info || !r) return null;
  const cat = categoryMeta(r.category);

  // Google Drive status for this receipt
  let driveStep;
  let sheetStep = null;
  if (!settings.driveEnabled || !drive.available) {
    driveStep = <Step state="off" text="Google Drive backup is off" detail="Turn it on in More → Settings to keep a copy in your Drive." />;
  } else if (!r.driveDirty) {
    driveStep = <Step state="ok" text={r.driveFileId ? 'Photo uploaded to Google Drive' : 'Saved to Google Drive'} detail={`ScanTrack Receipts › ${company?.name || ''}`} />;
    sheetStep = <Step state="ok" text="Added to the receipts spreadsheet" />;
  } else if (drive.status.error) {
    driveStep = <Step state="error" text="Not uploaded to Google Drive yet" detail={drive.status.error} />;
  } else {
    driveStep = <Step state="busy" text={drive.status.syncing ? 'Uploading to Google Drive…' : 'Waiting to upload to Google Drive…'} />;
  }

  const fileLink = Drive.fileUrl(r.driveFileId);
  const sheetLink = !r.driveDirty ? Drive.sheetUrl() : null;
  const close = () => setInfo(null);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: '#0009', justifyContent: 'center', padding: 20 }} onPress={close}>
        <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.lg, maxHeight: '88%', overflow: 'hidden' }} onPress={() => {}}>
          <ScrollView contentContainerStyle={{ padding: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={24} color="#fff" strokeWidth={3} />
              </View>
              <Text style={[s.h1, { fontSize: 22, flex: 1 }]}>{info.isNew ? 'Receipt Saved!' : 'Changes Saved!'}</Text>
            </View>

            <View style={{ backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
              <Text style={[s.h2, { marginBottom: 6 }]} numberOfLines={2}>{r.merchant}</Text>
              <Row label="Amount" value={money(r.total, r.currency)} />
              {r.tax ? <Row label="Tax (SST)" value={money(r.tax, r.currency)} /> : null}
              <Row label="Date" value={prettyDate(r.date)} />
              <View style={{ flexDirection: 'row', paddingVertical: 4, alignItems: 'center' }}>
                <Text style={[s.sub, { width: 92 }]}>Category</Text>
                <Icon name={cat.icon} size={16} color={cat.color} />
                <Text style={[s.body, { flex: 1, fontWeight: '600', marginLeft: 6 }]}>{r.category}</Text>
              </View>
              {company && <Row label="Company" value={company.name} />}
              {!!r.paymentMethod && <Row label="Payment" value={r.paymentMethod} />}
              {!!r.notes && <Row label="Notes" value={r.notes} />}
              <Row label="Receipt ID" value={receiptRef(r.id)} />
            </View>

            <View style={{ backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 12 }}>
              <Text style={[s.section, { marginBottom: 4 }]}>Processing results</Text>
              <Step state="ok" text="Saved on this phone" />
              {r.status === 'needs_review' ? (
                <Step state="error" text="Total is missing" detail="It's saved but marked Needs review. Add the amount when you can." />
              ) : (
                <Step state="ok" text="Ready for reports and accounting" />
              )}
              {driveStep}
              {sheetStep}
            </View>
          </ScrollView>

          <View style={{ padding: 14, gap: 8, borderTopWidth: 1, borderColor: colors.border }}>
            {drive.status.error && r.driveDirty && settings.driveEnabled ? (
              <Button title="Try upload again" icon="download" variant="secondary" loading={drive.status.syncing} onPress={drive.syncNow} />
            ) : null}
            {(fileLink || sheetLink) && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {fileLink && <Button small title="View in Drive" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(fileLink)} />}
                {sheetLink && <Button small title="View spreadsheet" icon="sheet" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(sheetLink)} />}
              </View>
            )}
            <Button title="Done" onPress={close} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
