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
import { L } from '../i18n';

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
    { ok: list.length > 0, text: L(`${list.length} receipts captured in period`, `此期间已记录 ${list.length} 张收据`) },
    { ok: !issues.some((i) => i.type === 'uncategorized'), text: L('Every receipt has a category', '每张收据都有类别') },
    { ok: !issues.some((i) => i.type === 'needs_review'), text: L('All AI-read receipts reviewed', 'AI 读取的收据已全部审核') },
    { ok: !issues.some((i) => i.type === 'duplicate'), text: L('No duplicate receipts', '没有重复收据') },
    { ok: !issues.some((i) => i.type === 'no_total'), text: L('Every receipt has a total', '每张收据都有总额') },
    { ok: !issues.some((i) => i.type === 'no_image'), text: L('Original image attached to each receipt', '每张收据都附有原始图片'), soft: true },
    { ok: !!settings.accountantEmail, text: L("Account's email added", '已添加会计师邮箱'), soft: true },
  ];

  const handOff = async () => {
    setBusy(true);
    try {
      const out = await buildAccountantPackage(list, settings, { ...range, label: `${prettyDate(range.from)} – ${prettyDate(range.to)}` });
      await deliver(out, settings.accountantEmail ? L(`Send to ${settings.accountantEmail}`, `发送给 ${settings.accountantEmail}`) : L('Send to your accountant', '发送给你的会计师'));
    } catch (e) {
      showAlert(L('Could not build package', '无法生成资料包'), e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmHandOff = () => {
    if (!blocking.length) return handOff();
    showAlert(L('Some items are still open', '还有未处理的项目'), L(`${blocking.length} issue(s) will be listed in the package for your accountant. Send anyway?`, `资料包中会为会计师列出 ${blocking.length} 个问题。仍要发送吗？`), [
      { text: L('Fix first', '先处理'), style: 'cancel' },
      { text: L('Send anyway', '仍然发送'), onPress: handOff },
    ]);
  };

  const quickFix = (i) => {
    if (i.type === 'duplicate') {
      return showAlert(L('Possible duplicate', '可能重复'), L(`${i.receipt.merchant}, ${prettyDate(i.receipt.date)}, ${money(i.receipt.total, i.receipt.currency)} looks like another receipt you saved.\n\nIs this a different purchase?`, `${i.receipt.merchant}，${prettyDate(i.receipt.date)}，${money(i.receipt.total, i.receipt.currency)} 看起来与你保存的另一张收据相同。\n\n这是另一笔消费吗？`), [
        { text: L('Cancel', '取消'), style: 'cancel' },
        { text: L('Not a duplicate', '不是重复'), onPress: () => updateReceipt(i.id, { confirmedUnique: true }) },
        { text: L('Delete this copy', '删除这份'), style: 'destructive', onPress: () => deleteReceipt(i.id) },
      ]);
    }
    nav.push('receipt', { id: i.id });
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title={L('Prepare for accounting', '准备会计资料')} onBack={nav.back} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 + bottomInset }}>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <DateBox label={L('From', '从')} value={from} onChange={setFrom} />
          <DateBox label={L('To', '至')} value={to} onChange={setTo} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Stat label={L('Readiness', '就绪度')} value={`${ready}%`} tone={ready === 100 ? colors.success : colors.warning} />
          <Stat label={L('Total', '总额')} value={money(sum(list), settings.currency)} />
          <Stat label={L('Tax', '税款')} value={money(sum(list, 'tax'), settings.currency)} />
        </View>

        <SectionTitle>{L('Checklist', '检查清单')}</SectionTitle>
        <Card>
          {checklist.map((c) => (
            <View key={c.text} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <View style={{ width: 28 }}><Icon name={c.ok ? 'circle-check' : c.soft ? 'circle' : 'circle-alert'} size={18} color={c.ok ? colors.success : c.soft ? colors.faint : colors.warning} /></View>
              <Text style={[s.body, { flex: 1, color: c.ok ? colors.text : colors.muted }]}>{c.text}</Text>
            </View>
          ))}
        </Card>

        <SectionTitle right={!!issues.length && <Text style={s.sub}>{L('tap to fix', '点击处理')}</Text>}>{L('Open items', '待处理项目')} ({issues.length})</SectionTitle>
        {issues.length === 0 && <Text style={s.sub}>{L('Nothing to fix. Your records are clean.', '没有需要处理的项目，记录很完整。')}</Text>}
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

        <SectionTitle>{L("Account's email", '会计师邮箱')}</SectionTitle>
        <Card onPress={() => nav.push('settings')}>
          <Text style={s.body}>{settings.accountantEmail || L("Add the account's email", '添加会计师邮箱')}</Text>
          <Text style={s.sub}>{settings.accountantEmail ? L('Printed on the package · tap to change', '会印在资料包上 · 点击修改') : L('Tap to add it in Settings', '点击到设置中添加')}</Text>
        </Card>
        <Text style={[s.sub, { marginTop: 12 }]}>{L('The package is one ZIP: summary PDF, CSV, Excel workbook, all receipt photos and a list of any open items.', '资料包是一个 ZIP 文件：包含汇总 PDF、CSV、Excel 工作簿、所有收据照片，以及待处理项目清单。')}</Text>
      </ScrollView>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 16 + bottomInset, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border }}>
        <Button title={L('Send To Accounts', '发送给会计')} icon="package-open" loading={busy} disabled={!list.length} onPress={confirmHandOff} />
      </View>
    </View>
  );
}
