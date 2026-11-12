// Track expenses: spending auto-categorised, monthly trend, tax-time readiness.
import { Icon } from '../icons';
import CompanySwitcher from '../CompanySwitcher';
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { Button, Card, Chip, ChipRow, Header, ReceiptRow, SectionTitle, Stat, s } from '../components';
import { colors } from '../theme';
import { PeriodPicker, currentPeriod, inPeriod, periodLabel as labelFor, periodRange } from '../period';
import { categoryMeta } from '../categories';
import { byCategory, byMonth, filterReceipts, findIssues, money, sum } from '../utils';

export default function HomeScreen({ nav }) {
  const { receipts, settings } = useStore();
  const [period, setPeriod] = useState(currentPeriod);
  const periodLabel = labelFor(period);
  const cur = settings.currency;

  const { list, cats, months, issues } = useMemo(() => {
    const r = periodRange(period);
    const list = filterReceipts(receipts, r).filter((x) => inPeriod(period, x.date));
    return { list, cats: byCategory(list), months: byMonth(receipts, 12), issues: findIssues(receipts).filter((i) => i.type !== 'no_image') };
  }, [receipts, period]);

  const total = sum(list);
  const maxMonth = Math.max(1, ...months.map((m) => m.total));

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      <Header title={settings.name ? `Hi, ${settings.name.split(' ')[0]}` : 'Expenses'} subtitle="Track spending, stay tax-ready" />
      <View style={{ paddingHorizontal: 16 }}>
        <CompanySwitcher onManage={() => nav.push('settings')} style={{ marginBottom: 8 }} />
        <PeriodPicker period={period} onChange={setPeriod} />

        <Card style={{ marginTop: 12 }}>
          <Text style={s.sub}>Total spent · {periodLabel}</Text>
          <Text style={{ color: colors.text, fontSize: 34, fontWeight: '800', marginTop: 2 }}>{money(total, cur)}</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Stat label="Tax paid" value={money(sum(list, 'tax'), cur)} />
            <Stat label="Receipts" value={String(list.length)} />
          </View>
        </Card>

        {issues.length > 0 && (
          <Card style={{ marginTop: 12, borderColor: colors.warning }} onPress={() => nav.push('accounting')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="alert" size={18} color={colors.warning} /><Text style={[s.body, { fontWeight: '700' }]}>{issues.length} item{issues.length > 1 ? 's' : ''} to tidy before tax time</Text></View>
            <Text style={[s.sub, { marginTop: 4 }]}>Duplicates, uncategorised or unreviewed receipts. Tap to fix.</Text>
          </Card>
        )}

        <SectionTitle>Last 12 months</SectionTitle>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 4 }}>
            {months.map((m, i) => (
              <View key={m.key} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  style={{
                    width: '78%',
                    height: Math.max(4, (m.total / maxMonth) * 96),
                    backgroundColor: i === months.length - 1 ? colors.accent : colors.bar,
                    borderRadius: 6,
                  }}
                />
                <Text style={[s.sub, { fontSize: 10, marginTop: 6 }]}>{m.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        <SectionTitle right={<Text style={{ color: colors.accentInk, fontWeight: '700' }} onPress={() => nav.tab('receipts')}>See all</Text>}>Recent</SectionTitle>
        {list.slice(0, 5).map((r) => <ReceiptRow key={r.id} r={r} onPress={() => nav.push('receipt', { id: r.id })} />)}
        {list.length === 0 && <Button title="Scan your first receipt" icon="camera" onPress={() => nav.tab('scan')} />}
      </View>

    </ScrollView>
  );
}
