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
import { L, catLabel } from '../i18n';

export default function ReportDetailScreen({ nav, params }) {
  const bottomInset = useSafeAreaInsets().bottom; // clear Android's navigation bar
  const { reports, receipts, settings, updateReport, deleteReport } = useStore();
  const rep = reports.find((r) => r.id === params.id);
  const [withImages, setWithImages] = useState(true);
  const [busy, setBusy] = useState(null);

  if (!rep) {
    return (
      <View style={{ flex: 1 }}>
        <Header title={L('Report', '报告')} onBack={nav.back} />
        <Text style={[s.sub, { padding: 16 }]}>{L('This report was deleted.', '此报告已被删除。')}</Text>
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
      showAlert(L('Export failed', '导出失败'), e.message);
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
        right={<Text style={{ color: colors.danger, fontWeight: '700' }} onPress={() => showAlert(L('Delete report', '删除报告'), L('Receipts stay in your archive.', '收据仍会保留在你的档案中。'), [{ text: L('Cancel', '取消') }, { text: L('Delete', '删除'), style: 'destructive', onPress: () => { deleteReport(rep.id); nav.back(); } }])}>{L('Delete', '删除')}</Text>}
      />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 + bottomInset }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stat label={L('Total', '总额')} value={money(sum(list), cur)} />
          <Stat label={L('Tax', '税款')} value={money(sum(list, 'tax'), cur)} />
          <Stat label={L('Receipts', '收据')} value={String(list.length)} />
        </View>
        {!!rep.purpose && <Text style={[s.sub, { marginTop: 10 }]}>{L('Purpose', '用途')}: {rep.purpose}</Text>}

        <Card style={{ marginTop: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={s.body}>{L('Attach receipt images to PDF', '在 PDF 中附上收据图片')}</Text>
            <Switch value={withImages} onValueChange={setWithImages} trackColor={{ true: colors.accent }} />
          </View>
          <Button title={L('Generate PDF report', '生成 PDF 报告')} icon="file-text" loading={busy === 'pdf'} onPress={() => run('pdf')} />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Button small title="Excel" variant="secondary" style={{ flex: 1 }} loading={busy === 'xlsx'} onPress={() => run('xlsx')} />
            <Button small title="CSV" variant="secondary" style={{ flex: 1 }} loading={busy === 'csv'} onPress={() => run('csv')} />
            <Button small title="ZIP" variant="secondary" style={{ flex: 1 }} loading={busy === 'zip'} onPress={() => run('zip')} />
          </View>
          <Button
            title={rep.status === 'submitted' ? L('✓ Submitted — mark as draft', '✓ 已提交 — 改为草稿') : L('Mark as submitted', '标记为已提交')}
            variant="ghost"
            small
            style={{ marginTop: 8 }}
            onPress={() => updateReport(rep.id, { status: rep.status === 'submitted' ? 'draft' : 'submitted', submittedAt: Date.now() })}
          />
        </Card>

        <SectionTitle>{L('By category', '按类别')}</SectionTitle>
        {byCategory(list).map((c) => (
          <View key={c.category} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name={categoryMeta(c.category).icon} size={18} color={categoryMeta(c.category).color} /><Text style={s.body}>{catLabel(c.category)}</Text></View>
            <Text style={[s.body, { fontWeight: '700' }]}>{money(c.total, cur)}</Text>
          </View>
        ))}

        <SectionTitle>{L('Receipts', '收据')}</SectionTitle>
        {list.map((r) => <ReceiptRow key={r.id} r={r} onPress={() => nav.push('receipt', { id: r.id, ids: list.map((x) => x.id) })} />)}
      </ScrollView>
    </View>
  );
}
