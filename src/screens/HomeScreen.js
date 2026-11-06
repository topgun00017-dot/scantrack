// Track expenses: spending auto-categorised, monthly trend, tax-time readiness.
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { Button, Card, Chip, ChipRow, Header, ReceiptRow, SectionTitle, Stat, s } from '../components';
import { colors } from '../theme';
import { categoryMeta } from '../categories';
import { byCategory, byMonth, filterReceipts, findIssues, money, rangeFor, sum } from '../utils';

const PERIODS = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'this_quarter', label: 'Quarter' },
  { key: 'this_year', label: 'Year' },
];

export default function HomeScreen({ nav }) {
  const { receipts, settings } = useStore();
  const [period, setPeriod] = useState('this_month');
  const cur = settings.currency;

  const { list, cats, months, issues } = useMemo(() => {
    const r = rangeFor(period);
    const list = filterReceipts(receipts, r);
    return { list, cats: byCategory(list), months: byMonth(receipts, 6), issues: findIssues(receipts).filter((i) => i.type !== 'no_image') };
  }, [receipts, period]);

  const total = sum(list);
  const maxMonth = Math.max(1, ...months.map((m) => m.total));
  const maxCat = Math.max(1, ...cats.map((c) => c.total));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <Header title={settings.name ? `Hi, ${settings.name.split(' ')[0]}` : 'Expenses'} subtitle="Track spending, stay tax-ready" />
      <View style={{ paddingHorizontal: 16 }}>
        <ChipRow>
          {PERIODS.map((p) => <Chip key={p.key} label={p.label} active={period === p.key} onPress={() => setPeriod(p.key)} />)}
        </ChipRow>

        <Card style={{ marginTop: 12 }}>
          <Text style={s.sub}>Total spent</Text>
          <Text style={{ color: colors.text, fontSize: 34, fontWeight: '800', marginTop: 2 }}>{money(total, cur)}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Stat label="Tax paid" value={money(sum(list, 'tax'), cur)} />
            <Stat label="Receipts" value={String(list.length)} />
          </View>
        </Card>

        {issues.length > 0 && (
          <Card style={{ marginTop: 12, borderColor: colors.warning }} onPress={() => nav.push('accounting')}>
            <Text style={[s.body, { fontWeight: '700' }]}>⚠️  {issues.length} item{issues.length > 1 ? 's' : ''} to tidy before tax time</Text>
            <Text style={[s.sub, { marginTop: 4 }]}>Duplicates, uncategorised or unreviewed receipts. Tap to fix.</Text>
          </Card>
        )}

        <SectionTitle>Last 6 months</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 10 }}>
            {months.map((m, i) => (
              <View key={m.key} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: '70%',
                    height: Math.max(4, (m.total / maxMonth) * 96),
                    backgroundColor: i === months.length - 1 ? colors.accent : colors.surface2,
                    borderRadius: 6,
                  }}
                />
                <Text style={[s.sub, { fontSize: 11, marginTop: 6 }]}>{m.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        <SectionTitle>By category</SectionTitle>
        <Card>
          {cats.length === 0 && <Text style={s.sub}>No spending in this period yet.</Text>}
          {cats.map((c) => {
            const meta = categoryMeta(c.category);
            return (
              <View key={c.category} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={s.body}>{meta.icon}  {c.category} <Text style={s.sub}>· {c.count}</Text></Text>
                  <Text style={[s.body, { fontWeight: '700' }]}>{money(c.total, cur)}</Text>
                </View>
                <View style={{ height: 6, backgroundColor: colors.surface2, borderRadius: 3, marginTop: 6 }}>
                  <View style={{ height: 6, width: `${(c.total / maxCat) * 100}%`, backgroundColor: meta.color, borderRadius: 3 }} />
                </View>
              </View>
            );
          })}
        </Card>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          <Button title="New report" icon="📄" variant="secondary" style={{ flex: 1 }} onPress={() => nav.push('reports', { create: true })} />
          <Button title="Export" icon="⬇️" variant="secondary" style={{ flex: 1 }} onPress={() => nav.push('export')} />
        </View>

        <SectionTitle right={<Text style={{ color: colors.accent }} onPress={() => nav.tab('receipts')}>See all</Text>}>Recent</SectionTitle>
        {list.slice(0, 5).map((r) => <ReceiptRow key={r.id} r={r} onPress={() => nav.push('receipt', { id: r.id })} />)}
        {list.length === 0 && <Button title="Scan your first receipt" icon="📷" onPress={() => nav.tab('scan')} />}
      </View>
    </ScrollView>
  );
}
