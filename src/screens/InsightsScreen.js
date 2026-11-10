// Spending breakdown: donut chart of spending by category for a month or the year.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { Card, Header, SectionTitle, Stat, s } from '../components';
import { colors } from '../theme';
import { categoryMeta } from '../categories';
import { PeriodPicker, currentPeriod, periodLabel, periodRange } from '../period';
import { byCategory, filterReceipts, money, sum } from '../utils';

// One ring segment per category, sized by its share of total spending.
function Donut({ data, total, selected, size = 210, stroke = 26 }) {
  const r = (size - stroke - 8) / 2;
  const c = 2 * Math.PI * r;
  const gap = data.length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface2} strokeWidth={stroke} fill="none" />
        {total > 0 &&
          data.map((d) => {
            const len = (d.total / total) * c;
            const seg = (
              <Circle
                key={d.category}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={categoryMeta(d.category).color}
                strokeWidth={selected === d.category ? stroke + 8 : stroke}
                strokeOpacity={selected && selected !== d.category ? 0.3 : 1}
                strokeDasharray={`${Math.max(len - gap, 0.5)} ${c}`}
                strokeDashoffset={-offset}
                fill="none"
              />
            );
            offset += len;
            return seg;
          })}
      </G>
    </Svg>
  );
}

export default function InsightsScreen({ nav, params }) {
  const { receipts, settings } = useStore();
  const bottomInset = useSafeAreaInsets().bottom;
  const [period, setPeriod] = useState(params?.period || currentPeriod());
  const [slice, setSlice] = useState(null);
  const cur = settings.currency;

  const { list, cats } = useMemo(() => {
    const list = filterReceipts(receipts, periodRange(period));
    return { list, cats: byCategory(list) };
  }, [receipts, period]);
  const total = sum(list);
  const sel = cats.find((c) => c.category === slice);

  return (
    <View style={{ flex: 1 }}>
      <Header title="Spending breakdown" subtitle="All categories" onBack={nav.back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 + bottomInset }}>
        <PeriodPicker period={period} onChange={(p) => { setPeriod(p); setSlice(null); }} />

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Stat label="Tax paid" value={money(sum(list, 'tax'), cur)} />
          <Stat label="Receipts" value={String(list.length)} />
        </View>

        <SectionTitle>{periodLabel(period)}</SectionTitle>
        <Card>
          {cats.length === 0 ? (
            <Text style={[s.sub, { textAlign: 'center', paddingVertical: 24 }]}>No spending in {periodLabel(period)}.</Text>
          ) : (
            <>
              <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Donut data={cats} total={total} selected={sel?.category} />
                <View style={{ position: 'absolute', alignItems: 'center', width: 128 }}>
                  <Text style={[s.section, { fontSize: 10, textAlign: 'center' }]} numberOfLines={2}>
                    {sel ? sel.category : 'Total spent'}
                  </Text>
                  <Text style={{ color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
                    {money(sel ? sel.total : total, cur)}
                  </Text>
                  {sel && <Text style={s.sub}>{((sel.total / total) * 100).toFixed(1)}% · {sel.count} receipt{sel.count > 1 ? 's' : ''}</Text>}
                </View>
              </View>

              {cats.map((c) => {
                const meta = categoryMeta(c.category);
                const pct = total ? (c.total / total) * 100 : 0;
                const on = slice === c.category;
                return (
                  <Pressable
                    key={c.category}
                    onPress={() => setSlice(on ? null : c.category)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, backgroundColor: on ? colors.surface2 : 'transparent' }}
                  >
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: meta.color, marginRight: 10 }} />
                    <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>
                      {c.category} <Text style={s.sub}>· {c.count}</Text>
                    </Text>
                    <Text style={[s.body, { fontWeight: '700', fontVariant: ['tabular-nums'] }]}>{money(c.total, cur)}</Text>
                    <Text style={[s.sub, { width: 46, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>{pct.toFixed(0)}%</Text>
                  </Pressable>
                );
              })}
              <Text style={[s.sub, { fontSize: 11, textAlign: 'center', marginTop: 6 }]}>Tap a category to highlight it on the chart</Text>
            </>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}
