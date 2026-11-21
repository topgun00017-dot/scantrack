// Create expense reports: pick a period and receipts, generate a professional report in one tap.
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { Button, Card, Chip, ChipRow, Empty, Field, Header, RangePicker, ReceiptRow, SectionTitle, s } from '../components';
import { colors } from '../theme';
import { CATEGORIES } from '../categories';
import { allTags, filterReceipts, money, prettyDate, RANGE_PRESETS, rangeFor, sum } from '../utils';
import { L, catLabel } from '../i18n';

export default function ReportsScreen({ nav, params }) {
  // Keep the fixed bottom button clear of Android's navigation bar.
  const bottomInset = useSafeAreaInsets().bottom;
  const { reports, receipts, addReport, settings } = useStore();
  const [creating, setCreating] = useState(!!params?.create);
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [preset, setPreset] = useState('this_month');
  const [category, setCategory] = useState(null);
  const [tag, setTag] = useState(null);
  const [excluded, setExcluded] = useState([]);
  const tags = useMemo(() => allTags(receipts), [receipts]);

  const range = rangeFor(preset);
  const candidates = useMemo(() => filterReceipts(receipts, { ...range, category, tag }), [receipts, preset, category, tag]);
  const chosen = candidates.filter((r) => !excluded.includes(r.id));

  const create = () => {
    const label = RANGE_PRESETS.find((p) => p.key === preset)?.label();
    const rep = addReport({
      name: name.trim() || `${L('Expenses', '开支')} · ${label}${tag ? ` · #${tag}` : ''}`,
      purpose: purpose.trim(),
      from: chosen.length ? chosen[chosen.length - 1].date : range.from,
      to: chosen.length ? chosen[0].date : range.to,
      receiptIds: chosen.map((r) => r.id),
    });
    if (params?.create) nav.replace('report', { id: rep.id });
    else {
      setCreating(false);
      nav.push('report', { id: rep.id });
    }
  };

  if (creating) {
    return (
      <View style={{ flex: 1 }}>
        <Header title={L('New expense report', '新建报销报告')} onBack={() => (params?.create ? nav.back() : setCreating(false))} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 + bottomInset }} keyboardShouldPersistTaps="handled">
          <Field label={L('Report name', '报告名称')} value={name} onChangeText={setName} placeholder={L('e.g. Penang client trip, Nov 2026', '例如：2026年11月槟城客户出差')} />
          <Field label={L('Business purpose (optional)', '业务用途（可选）')} value={purpose} onChangeText={setPurpose} placeholder={L('Client visit, conference…', '拜访客户、会议…')} />
          <SectionTitle>{L('Period', '期间')}</SectionTitle>
          <RangePicker value={preset} onChange={(p) => { setPreset(p); setExcluded([]); }} />
          <SectionTitle>{L('Filter', '筛选')}</SectionTitle>
          <ChipRow>
            {CATEGORIES.map((c) => <Chip key={c.key} icon={c.icon} iconColor={c.color} label={catLabel(c.key)} active={category === c.key} onPress={() => setCategory(category === c.key ? null : c.key)} />)}
          </ChipRow>
          {tags.length > 0 && <ChipRow>{tags.map((t) => <Chip key={t} label={`#${t}`} active={tag === t} color={colors.info} onPress={() => setTag(tag === t ? null : t)} />)}</ChipRow>}
          <SectionTitle right={<Text style={s.sub}>{L('tap to include / exclude', '点击以包含 / 排除')}</Text>}>{L('Receipts', '收据')} ({chosen.length}/{candidates.length})</SectionTitle>
          {candidates.length === 0 && <Text style={s.sub}>{L('No receipts in this period.', '此期间没有收据。')}</Text>}
          {candidates.map((r) => (
            <View key={r.id} style={{ opacity: excluded.includes(r.id) ? 0.4 : 1 }}>
              <ReceiptRow r={r} selected={!excluded.includes(r.id)} onPress={() => setExcluded((x) => (x.includes(r.id) ? x.filter((y) => y !== r.id) : [...x, r.id]))} />
            </View>
          ))}
        </ScrollView>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 16 + bottomInset, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border }}>
          <Button title={`${L('Generate report', '生成报告')} · ${money(sum(chosen), settings.currency)}`} disabled={!chosen.length} onPress={create} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title={L('Expense reports', '报销报告')} onBack={nav.back} right={<Button small title={L('New', '新建')} icon="plus" onPress={() => setCreating(true)} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {reports.length === 0 && <Empty icon="file-text" title={L('No reports yet', '还没有报告')} text={L('Bundle receipts into a professional PDF report for reimbursement or your records.', '把收据整理成专业的 PDF 报告，用于报销或存档。')} action={<Button title={L('Create report', '创建报告')} onPress={() => setCreating(true)} />} />}
        {reports.map((rep) => {
          const list = receipts.filter((r) => rep.receiptIds.includes(r.id));
          return (
            <Card key={rep.id} onPress={() => nav.push('report', { id: rep.id })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[s.h2, { flex: 1 }]} numberOfLines={1}>{rep.name}</Text>
                <Text style={{ color: rep.status === 'submitted' ? colors.success : colors.warning, fontWeight: '700', fontSize: 12 }}>{rep.status === 'submitted' ? L('SUBMITTED', '已提交') : L('DRAFT', '草稿')}</Text>
              </View>
              <Text style={[s.sub, { marginTop: 4 }]}>{prettyDate(rep.from)} – {prettyDate(rep.to)} · {L(`${list.length} receipts`, `${list.length} 张收据`)}</Text>
              <Text style={[s.body, { fontWeight: '800', marginTop: 8 }]}>{money(sum(list), settings.currency)}</Text>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
