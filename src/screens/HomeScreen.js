// Track expenses: spending auto-categorised, monthly trend, tax-time readiness.
import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { Button, Card, Chip, ChipRow, Header, ReceiptRow, SectionTitle, Stat, s } from '../components';
import { colors, radius } from '../theme';
import { categoryMeta } from '../categories';
import { byCategory, byMonth, filterReceipts, findIssues, money, sum, toISO } from '../utils';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Period = one month of a year, or the whole year.
function periodRange({ mode, year, month }) {
  if (mode === 'year') return { from: `${year}-01-01`, to: `${year}-12-31` };
  return { from: toISO(new Date(year, month, 1)), to: toISO(new Date(year, month + 1, 0)) };
}

export default function HomeScreen({ nav }) {
  const { receipts, settings } = useStore();
  const now = new Date();
  const [period, setPeriod] = useState({ mode: 'month', year: now.getFullYear(), month: now.getMonth() });
  const [picker, setPicker] = useState(false);
  const [pickerYear, setPickerYear] = useState(period.year);
  const periodLabel = period.mode === 'year' ? `${period.year}` : `${MONTHS_LONG[period.month]} ${period.year}`;
  const cur = settings.currency;

  const { list, cats, months, issues } = useMemo(() => {
    const r = periodRange(period);
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
        <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
          <Chip
            label={`📅  ${MONTHS[period.month]} ${period.year}  ▾`}
            active={period.mode === 'month'}
            onPress={() => {
              setPickerYear(period.year);
              setPicker(true);
            }}
          />
          <Chip label="This year" active={period.mode === 'year'} onPress={() => setPeriod((p) => ({ ...p, mode: 'year', year: now.getFullYear() }))} />
        </View>

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
                    backgroundColor: i === months.length - 1 ? colors.accent : colors.bar,
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

        <SectionTitle right={<Text style={{ color: colors.accentInk, fontWeight: '700' }} onPress={() => nav.tab('receipts')}>See all</Text>}>Recent</SectionTitle>
        {list.slice(0, 5).map((r) => <ReceiptRow key={r.id} r={r} onPress={() => nav.push('receipt', { id: r.id })} />)}
        {list.length === 0 && <Button title="Scan your first receipt" icon="📷" onPress={() => nav.tab('scan')} />}
      </View>

      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }} onPress={() => setPicker(false)}>
          <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16 }} onPress={() => {}}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: colors.accentInk, fontSize: 26, paddingHorizontal: 12 }} onPress={() => setPickerYear((y) => y - 1)}>‹</Text>
              <Text style={s.h2}>{pickerYear}</Text>
              <Text style={{ color: colors.accentInk, fontSize: 26, paddingHorizontal: 12 }} onPress={() => setPickerYear((y) => y + 1)}>›</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MONTHS.map((m, i) => {
                const active = period.mode === 'month' && period.year === pickerYear && period.month === i;
                const isNow = pickerYear === now.getFullYear() && i === now.getMonth();
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      setPeriod({ mode: 'month', year: pickerYear, month: i });
                      setPicker(false);
                    }}
                    style={{
                      width: '31%',
                      paddingVertical: 12,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      backgroundColor: active ? colors.accent : colors.surface2,
                      borderWidth: 1,
                      borderColor: isNow && !active ? colors.accent : 'transparent',
                    }}
                  >
                    <Text style={{ color: active ? colors.accentText : colors.text, fontWeight: '700' }}>{m}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
