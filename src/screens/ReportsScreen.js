// Create expense reports: pick a period and receipts, generate a professional report in one tap.
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { Button, Card, Chip, ChipRow, Empty, Field, Header, RangePicker, ReceiptRow, SectionTitle, s } from '../components';
import { colors } from '../theme';
import { CATEGORIES } from '../categories';
import { allTags, filterReceipts, money, prettyDate, RANGE_PRESETS, rangeFor, sum } from '../utils';

export default function ReportsScreen({ nav, params }) {
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
    const label = RANGE_PRESETS.find((p) => p.key === preset)?.label;
    const rep = addReport({
      name: name.trim() || `Expenses · ${label}${tag ? ` · #${tag}` : ''}`,
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
        <Header title="New expense report" onBack={() => (params?.create ? nav.back() : setCreating(false))} />
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Field label="Report name" value={name} onChangeText={setName} placeholder="e.g. Penang client trip, Nov 2026" />
          <Field label="Business purpose (optional)" value={purpose} onChangeText={setPurpose} placeholder="Client visit, conference…" />
          <SectionTitle>Period</SectionTitle>
          <RangePicker value={preset} onChange={(p) => { setPreset(p); setExcluded([]); }} />
          <SectionTitle>Filter</SectionTitle>
          <ChipRow>
            {CATEGORIES.map((c) => <Chip key={c.key} label={`${c.icon} ${c.key}`} active={category === c.key} onPress={() => setCategory(category === c.key ? null : c.key)} />)}
          </ChipRow>
          {tags.length > 0 && <ChipRow>{tags.map((t) => <Chip key={t} label={`#${t}`} active={tag === t} color={colors.info} onPress={() => setTag(tag === t ? null : t)} />)}</ChipRow>}
          <SectionTitle right={<Text style={s.sub}>tap to include / exclude</Text>}>Receipts ({chosen.length}/{candidates.length})</SectionTitle>
          {candidates.length === 0 && <Text style={s.sub}>No receipts in this period.</Text>}
          {candidates.map((r) => (
            <View key={r.id} style={{ opacity: excluded.includes(r.id) ? 0.4 : 1 }}>
              <ReceiptRow r={r} selected={!excluded.includes(r.id)} onPress={() => setExcluded((x) => (x.includes(r.id) ? x.filter((y) => y !== r.id) : [...x, r.id]))} />
            </View>
          ))}
        </ScrollView>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border }}>
          <Button title={`Generate report · ${money(sum(chosen), settings.currency)}`} disabled={!chosen.length} onPress={create} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Header title="Expense reports" onBack={nav.back} right={<Button small title="New" icon="+" onPress={() => setCreating(true)} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {reports.length === 0 && <Empty icon="📄" title="No reports yet" text="Bundle receipts into a professional PDF report for reimbursement or your records." action={<Button title="Create report" onPress={() => setCreating(true)} />} />}
        {reports.map((rep) => {
          const list = receipts.filter((r) => rep.receiptIds.includes(r.id));
          return (
            <Card key={rep.id} onPress={() => nav.push('report', { id: rep.id })}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={[s.h2, { flex: 1 }]} numberOfLines={1}>{rep.name}</Text>
                <Text style={{ color: rep.status === 'submitted' ? colors.success : colors.warning, fontWeight: '700', fontSize: 12 }}>{rep.status === 'submitted' ? 'SUBMITTED' : 'DRAFT'}</Text>
              </View>
              <Text style={[s.sub, { marginTop: 4 }]}>{prettyDate(rep.from)} – {prettyDate(rep.to)} · {list.length} receipts</Text>
              <Text style={[s.body, { fontWeight: '800', marginTop: 8 }]}>{money(sum(list), settings.currency)}</Text>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}
