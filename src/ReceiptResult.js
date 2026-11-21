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
import { L, catLabel } from './i18n';

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
    driveStep = <Step state="off" text={L('Google Drive backup is off', 'Google 云端硬盘备份已关闭')} detail={L('Turn it on in More → Settings to keep a copy in your Drive.', '在 更多 → 设置 中开启，即可在云端硬盘保留副本。')} />;
  } else if (!r.driveDirty) {
    driveStep = <Step state="ok" text={r.driveFileId ? L('Photo uploaded to Google Drive', '照片已上传到 Google 云端硬盘') : L('Saved to Google Drive', '已保存到 Google 云端硬盘')} detail={`ScanTrack Receipts › ${company?.name || ''}`} />;
    sheetStep = <Step state="ok" text={L('Added to the receipts spreadsheet', '已添加到收据表格')} />;
  } else if (drive.status.error) {
    driveStep = <Step state="error" text={L('Not uploaded to Google Drive yet', '尚未上传到 Google 云端硬盘')} detail={drive.status.error} />;
  } else {
    driveStep = <Step state="busy" text={drive.status.syncing ? L('Uploading to Google Drive…', '正在上传到 Google 云端硬盘…') : L('Waiting to upload to Google Drive…', '等待上传到 Google 云端硬盘…')} />;
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
              <Text style={[s.h1, { fontSize: 22, flex: 1 }]}>{info.isNew ? L('Receipt Saved!', '收据已保存！') : L('Changes Saved!', '更改已保存！')}</Text>
            </View>

            <View style={{ backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14 }}>
              <Text style={[s.h2, { marginBottom: 6 }]} numberOfLines={2}>{r.merchant}</Text>
              <Row label={L('Amount', '金额')} value={money(r.total, r.currency)} />
              {r.tax ? <Row label={L('Tax (SST)', '税款 (SST)')} value={money(r.tax, r.currency)} /> : null}
              <Row label={L('Date', '日期')} value={prettyDate(r.date)} />
              <View style={{ flexDirection: 'row', paddingVertical: 4, alignItems: 'center' }}>
                <Text style={[s.sub, { width: 92 }]}>{L('Category', '类别')}</Text>
                <Icon name={cat.icon} size={16} color={cat.color} />
                <Text style={[s.body, { flex: 1, fontWeight: '600', marginLeft: 6 }]}>{catLabel(r.category)}</Text>
              </View>
              {company && <Row label={L('Company', '公司')} value={company.name} />}
              {!!r.paymentMethod && <Row label={L('Payment', '付款方式')} value={r.paymentMethod} />}
              {!!r.notes && <Row label={L('Notes', '备注')} value={r.notes} />}
              <Row label={L('Receipt ID', '收据编号')} value={receiptRef(r.id)} />
            </View>

            <View style={{ backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 12 }}>
              <Text style={[s.section, { marginBottom: 4 }]}>{L('Processing results', '处理结果')}</Text>
              <Step state="ok" text={L('Saved on this phone', '已保存在本手机')} />
              {r.status === 'needs_review' ? (
                <Step state="error" text={L('Total is missing', '缺少总额')} detail={L("It's saved but marked Needs review. Add the amount when you can.", '已保存，但标记为需要审核。请尽快补上金额。')} />
              ) : (
                <Step state="ok" text={L('Ready for reports and accounting', '可用于报告和会计')} />
              )}
              {driveStep}
              {sheetStep}
            </View>
          </ScrollView>

          <View style={{ padding: 14, gap: 8, borderTopWidth: 1, borderColor: colors.border }}>
            {drive.status.error && r.driveDirty && settings.driveEnabled ? (
              <Button title={L('Try upload again', '重新上传')} icon="download" variant="secondary" loading={drive.status.syncing} onPress={drive.syncNow} />
            ) : null}
            {(fileLink || sheetLink) && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {fileLink && <Button small title={L('View in Drive', '在云端硬盘查看')} variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(fileLink)} />}
                {sheetLink && <Button small title={L('View in Google Sheet', '在 Google 表格查看')} icon="sheet" variant="secondary" style={{ flex: 1 }} onPress={() => Linking.openURL(sheetLink)} />}
              </View>
            )}
            <Button title={L('Done', '完成')} onPress={close} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
