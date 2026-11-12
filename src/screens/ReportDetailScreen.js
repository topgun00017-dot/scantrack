import { showAlert } from '../platform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../icons';
import React, { useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { useStore } from '../store';
import { exportReportPDF, exportReceipts, deliver } from '../exporters';
import { Button, Card, Header, ReceiptRow, SectionTitle, Stat, s } from '../components';
import { colors } from '../theme';
import { categoryMeta } from '../categories';
import { byCategory, money, prettyDate, sum } from '../utils';

export default function ReportDetailScreen({ nav, params }) {
  const bottomInset = useSafeAreaInsets().bottom; // clear Android's navigation bar
  const { reports, receipts, settings, updateReport, deleteReport } = useStore();
  const rep = reports.find((r) => r.id === params.id);
  const [withImages, setWithImages] = useState(true);
  const [busy, setBusy] = useState(null);

  if (!rep) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Report" onBack={nav.back} />
        <Text style={[s.sub, { padding: 16 }]}>This report was deleted.</Text>
      </View>
    );
  }
  const list = receipts.filter((r) => rep.receiptIds.includes(r.id)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const cur = settings.currency;

  const run = async (kind) => {
    setBusy(kind);
    try {
      const out = kind === 'pdf' ? await exportReportPDF(rep, list, settings, withImages) : await exportReceipts(kind, list, settings, rep.name);
      await deliver(out, rep.name);
    } catch (e) {
      showAlert('Export failed', e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header
        title={rep.name}
        subtitle={`${prettyDate(rep.from)} – ${prettyDate(rep.to)}`}
        onBack={nav.back}
        right={<Text style={{ color: colors.danger, fontWeight: '700' }} onPress={() => showAlert('Delete report', 'Receipts stay in your archive.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => { deleteReport(rep.id); nav.back(); } }])}>Delete</Text>}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 + bottomInset }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stat label="Total" value={money(sum(list), cur)} />
          <Stat label="Tax" value={money(sum(list, 'tax'), cur)} />
          <Stat label="Receipts" value={String(list.length)} />
        </View>
        {!!rep.purpose && <Text style={[s.sub, { marginTop: 10 }]}>Purpose: {rep.purpose}</Text>}

        <Card style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={s.body}>Attach receipt images to PDF</Text>
            <Switch value={withImages} onValueChange={setWithImages} trackColor={{ true: colors.accent }} />
          </View>
          <Button title="Generate PDF report" icon="file-text" loading={busy === 'pdf'} onPress={() => run('pdf')} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Button small title="Excel" variant="secondary" style={{ flex: 1 }} loading={busy === 'xlsx'} onPress={() => run('xlsx')} />
            <Button small title="CSV" variant="secondary" style={{ flex: 1 }} loading={busy === 'csv'} onPress={() => run('csv')} />
            <Button small title="ZIP" variant="secondary" style={{ flex: 1 }} loading={busy === 'zip'} onPress={() => run('zip')} />
          </View>
          <Button
            title={rep.status === 'submitted' ? '✓ Submitted — mark as draft' : 'Mark as submitted'}
            variant="ghost"
            small
            style={{ marginTop: 8 }}
            onPress={() => updateReport(rep.id, { status: rep.status === 'submitted' ? 'draft' : 'submitted', submittedAt: Date.now() })}
          />
        </Card>

        <SectionTitle>By category</SectionTitle>
        {byCategory(list).map((c) => (
          <View key={c.category} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name={categoryMeta(c.category).icon} size={18} color={categoryMeta(c.category).color} /><Text style={s.body}>{c.category}</Text></View>
            <Text style={[s.body, { fontWeight: '700' }]}>{money(c.total, cur)}</Text>
          </View>
        ))}

        <SectionTitle>Receipts</SectionTitle>
        {list.map((r) => <ReceiptRow key={r.id} r={r} onPress={() => nav.push('receipt', { id: r.id, ids: list.map((x) => x.id) })} />)}
      </ScrollView>
    </View>
  );
}
