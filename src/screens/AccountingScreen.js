// Prepare for accounting: tidy the records, then hand a clean package to your accountant.
import { showAlert } from '../platform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../icons';
import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { buildAccountantPackage, deliver } from '../exporters';
import { Button, Card, Header, SectionTitle, Stat, s } from '../components';
import { DateBox } from './ExportScreen';
import { colors } from '../theme';
import { filterReceipts, findIssues, ISSUE_LABELS, money, prettyDate, sum, toISO } from '../utils';

export default function AccountingScreen({ nav }) {
  // Keep the fixed bottom button clear of Android's navigation bar.
  const bottomInset = useSafeAreaInsets().bottom;
  const { receipts, settings, deleteReceipt, updateReceipt } = useStore();
  // Date range picked with From / To (starts on 1 Jan this year → today).
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(toISO(new Date()));
  const [busy, setBusy] = useState(false);
  const range = from <= to ? { from, to } : { from: to, to: from };
  const list = useMemo(() => filterReceipts(receipts, range), [receipts, range.from, range.to]);
  const issues = useMemo(() => findIssues(list), [list]);
  const blocking = issues.filter((i) => i.type !== 'no_image');
  const ready = list.length ? Math.round(((list.length - new Set(blocking.map((i) => i.id)).size) / list.length) * 100) : 100;

  const checklist = [
    { ok: list.length > 0, text: `${list.length} receipts captured in period` },
    { ok: !issues.some((i) => i.type === 'uncategorized'), text: 'Every receipt has a category' },
    { ok: !issues.some((i) => i.type === 'needs_review'), text: 'All AI-read receipts reviewed' },
    { ok: !issues.some((i) => i.type === 'duplicate'), text: 'No duplicate receipts' },
    { ok: !issues.some((i) => i.type === 'no_total'), text: 'Every receipt has a total' },
    { ok: !issues.some((i) => i.type === 'no_image'), text: 'Original image attached to each receipt', soft: true },
    { ok: !!settings.accountantEmail || !!settings.accountantName, text: "Account's email added", soft: true },
  ];

  const handOff = async () => {
    setBusy(true);
    try {
      const out = await buildAccountantPackage(list, settings, { ...range, label: `${prettyDate(range.from)} – ${prettyDate(range.to)}` });
      await deliver(out, settings.accountantEmail ? `Send to ${settings.accountantEmail}` : 'Send to your accountant');
    } catch (e) {
      showAlert('Could not build package', e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmHandOff = () => {
    if (!blocking.length) return handOff();
    showAlert('Some items are still open', `${blocking.length} issue(s) will be listed in the package for your accountant. Send anyway?`, [
      { text: 'Fix first', style: 'cancel' },
      { text: 'Send anyway', onPress: handOff },
    ]);
  };

  const quickFix = (i) => {
    if (i.type === 'duplicate') {
      return showAlert('Possible duplicate', `${i.receipt.merchant}, ${prettyDate(i.receipt.date)}, ${money(i.receipt.total, i.receipt.currency)} looks like another receipt you saved.\n\nIs this a different purchase?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Not a duplicate', onPress: () => updateReceipt(i.id, { confirmedUnique: true }) },
        { text: 'Delete this copy', style: 'destructive', onPress: () => deleteReceipt(i.id) },
      ]);
    }
    nav.push('receipt', { id: i.id });
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Prepare for accounting" onBack={nav.back} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 + bottomInset }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <DateBox label="From" value={from} onChange={setFrom} />
          <DateBox label="To" value={to} onChange={setTo} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Stat label="Readiness" value={`${ready}%`} tone={ready === 100 ? colors.success : colors.warning} />
          <Stat label="Total" value={money(sum(list), settings.currency)} />
          <Stat label="Tax" value={money(sum(list, 'tax'), settings.currency)} />
        </View>

        <SectionTitle>Checklist</SectionTitle>
        <Card>
          {checklist.map((c) => (
            <View key={c.text} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <View style={{ width: 28 }}><Icon name={c.ok ? 'circle-check' : c.soft ? 'circle' : 'circle-alert'} size={18} color={c.ok ? colors.success : c.soft ? colors.faint : colors.warning} /></View>
              <Text style={[s.body, { flex: 1, color: c.ok ? colors.text : colors.muted }]}>{c.text}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle right={!!issues.length && <Text style={s.sub}>tap to fix</Text>}>Open items ({issues.length})</SectionTitle>
        {issues.length === 0 && <Text style={s.sub}>Nothing to fix. Your records are clean.</Text>}
        {issues.map((i, idx) => (
          <Card key={i.type + i.id + idx} onPress={() => quickFix(i)} style={{ marginBottom: 8, padding: 12, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: i.type === 'no_image' ? colors.muted : colors.warning, fontWeight: '700', fontSize: 12 }}>{ISSUE_LABELS[i.type].toUpperCase()}</Text>
              <Text style={[s.body, { marginTop: 2 }]}>{i.receipt.merchant}</Text>
              <Text style={s.sub}>{prettyDate(i.receipt.date)} · {money(i.receipt.total, i.receipt.currency)}</Text>
            </View>
            <Text style={{ color: colors.faint, fontSize: 22 }}>›</Text>
          </Card>
        ))}

        <SectionTitle>Account's email</SectionTitle>
        <Card onPress={() => nav.push('settings')}>
          <Text style={s.body}>{settings.accountantName || 'Add your accountant'}</Text>
          <Text style={s.sub}>{settings.accountantEmail || 'Name and email are printed on the package · tap to edit'}</Text>
        </Card>
        <Text style={[s.sub, { marginTop: 12 }]}>The package is one ZIP: summary PDF, CSV, Excel workbook, all receipt photos and a list of any open items.</Text>
      </ScrollView>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 16 + bottomInset, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border }}>
        <Button title="Send To Accounts" icon="package-open" loading={busy} disabled={!list.length} onPress={confirmHandOff} />
      </View>
    </View>
  );
}
