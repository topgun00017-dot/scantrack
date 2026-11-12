// Insights: spending by category for one or more months or the year, shown as a doughnut,
// pie or bar graph. Tap a category (in the list or on the chart) to highlight it.
import CompanySwitcher from '../CompanySwitcher';
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import { useStore } from '../store';
import { Card, Header, SectionTitle, Stat, s } from '../components';
import { Icon } from '../icons';
import { colors, radius } from '../theme';
import { categoryMeta } from '../categories';
import { MONTHS, PeriodPicker, currentPeriod, inPeriod, periodLabel, periodRange } from '../period';
import { byCategory, filterReceipts, money, sum } from '../utils';

const CHARTS = [
  { key: 'doughnut', label: 'Donut chart', icon: 'circle' },
  { key: 'bar', label: 'Bar graph', icon: 'chart-column' },
  { key: 'line', label: 'Line chart', icon: 'chart-line' },
];

// ---------- doughnut ----------
function Doughnut({ data, total, selected, onSelect, size = 220, stroke = 28 }) {
  const r = (size - stroke - 8) / 2;
  const c = 2 * Math.PI * r;
  const gap = data.length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface2} strokeWidth={stroke} fill="none" />
        {data.map((d) => {
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
              onPress={() => onSelect(d.category)}
            />
          );
          offset += len;
          return seg;
        })}
      </G>
    </Svg>
  );
}

// ---------- pie ----------
const polar = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

function Pie({ data, total, selected, onSelect, size = 220 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 12;
  let start = -Math.PI / 2;
  return (
    <Svg width={size} height={size}>
      {data.length === 1 ? (
        <Circle cx={cx} cy={cy} r={r} fill={categoryMeta(data[0].category).color} onPress={() => onSelect(data[0].category)} />
      ) : (
        data.map((d) => {
          const sweep = (d.total / total) * Math.PI * 2;
          const end = start + sweep;
          const mid = start + sweep / 2;
          const pop = selected === d.category ? 9 : 0; // pull the chosen slice out a little
          const ox = Math.cos(mid) * pop;
          const oy = Math.sin(mid) * pop;
          const [x1, y1] = polar(cx + ox, cy + oy, r, start);
          const [x2, y2] = polar(cx + ox, cy + oy, r, end);
          const path = `M ${cx + ox} ${cy + oy} L ${x1} ${y1} A ${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2} ${y2} Z`;
          start = end;
          return (
            <Path
              key={d.category}
              d={path}
              fill={categoryMeta(d.category).color}
              fillOpacity={selected && selected !== d.category ? 0.3 : 1}
              stroke={colors.surface}
              strokeWidth={2}
              onPress={() => onSelect(d.category)}
            />
          );
        })
      )}
    </Svg>
  );
}

// ---------- line chart ----------
// Spending over time: by day for a single month, by month for several months or the year.
const compact = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${Math.round(n)}`);
const niceMax = (v) => {
  if (v <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
};

function buckets(period, list) {
  const months = period.mode === 'year' ? [...Array(12).keys()] : [...(period.months || [period.month])].sort((a, b) => a - b);
  if (period.mode !== 'year' && months.length === 1) {
    const m = months[0];
    const days = new Date(period.year, m + 1, 0).getDate();
    const out = Array.from({ length: days }, (_, i) => ({ label: String(i + 1), long: `${i + 1} ${MONTHS[m]}`, total: 0 }));
    list.forEach((r) => {
      const d = Number((r.date || '').slice(8, 10));
      if (d >= 1 && d <= days) out[d - 1].total += Number(r.total) || 0;
    });
    return { unit: 'day', points: out };
  }
  const out = months.map((m) => ({ label: MONTHS[m], long: `${MONTHS[m]} ${period.year}`, m, total: 0 }));
  list.forEach((r) => {
    const m = Number((r.date || '').slice(5, 7)) - 1;
    const b = out.find((x) => x.m === m);
    if (b) b.total += Number(r.total) || 0;
  });
  return { unit: 'month', points: out };
}

function LineChart({ period, list, selected, cur }) {
  const [w, setW] = useState(0);
  const all = useMemo(() => buckets(period, list), [period, list]);
  const one = useMemo(() => (selected ? buckets(period, list.filter((r) => r.category === selected)) : null), [period, list, selected]);
  const main = one || all;
  const color = selected ? categoryMeta(selected).color : colors.accent;
  const H = 190;
  const pad = { l: 40, r: 10, t: 12, b: 24 };
  const max = niceMax(Math.max(...all.points.map((p) => p.total)));
  const n = main.points.length;
  const x = (i) => pad.l + (n === 1 ? (w - pad.l - pad.r) / 2 : (i * (w - pad.l - pad.r)) / (n - 1));
  const y = (v) => pad.t + (1 - v / max) * (H - pad.t - pad.b);
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(p.total).toFixed(1)}`).join(' ');
  const area = (pts) => `${path(pts)} L ${x(pts.length - 1).toFixed(1)} ${y(0)} L ${x(0).toFixed(1)} ${y(0)} Z`;
  const every = all.unit === 'day' ? 5 : 1;
  const top = main.points.reduce((a, b) => (b.total > a.total ? b : a), main.points[0]);

  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginBottom: 8 }}>
      {w > 0 && (
        <Svg width={w} height={H}>
          {[0, 0.5, 1].map((f) => (
            <G key={f}>
              <Line x1={pad.l} x2={w - pad.r} y1={y(max * f)} y2={y(max * f)} stroke={colors.border} strokeWidth={1} strokeDasharray={f ? '4 4' : undefined} />
              <SvgText x={pad.l - 6} y={y(max * f) + 4} fontSize={10} fill={colors.muted} textAnchor="end">{compact(max * f)}</SvgText>
            </G>
          ))}
          {selected && <Path d={path(all.points)} stroke={colors.faint} strokeWidth={1.5} fill="none" strokeDasharray="3 4" />}
          <Path d={area(main.points)} fill={color} fillOpacity={0.14} />
          <Path d={path(main.points)} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
          {main.points.map((p, i) =>
            n <= 12 || p.total > 0 ? <Circle key={i} cx={x(i)} cy={y(p.total)} r={n <= 12 ? 3.5 : 2.5} fill={colors.surface} stroke={color} strokeWidth={2} /> : null
          )}
          {main.points.map((p, i) =>
            i % every === 0 || i === n - 1 ? (
              <SvgText key={'l' + i} x={x(i)} y={H - 6} fontSize={10} fill={colors.muted} textAnchor="middle">{p.label}</SvgText>
            ) : null
          )}
        </Svg>
      )}
      <Text style={[s.sub, { textAlign: 'center', marginTop: 4 }]}>
        {selected ? `${selected} · ` : ''}
        {all.unit === 'day' ? 'Spending per day' : 'Spending per month'}
        {top && top.total > 0 ? ` · highest ${top.long}: ${money(top.total, cur)}` : ''}
      </Text>
      {selected && <Text style={[s.sub, { textAlign: 'center', fontSize: 11 }]}>Dotted line: all categories</Text>}
    </View>
  );
}

// ---------- bar graph ----------
function Bars({ data, total, selected, onSelect, cur }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <View style={{ gap: 14 }}>
      {data.map((d) => {
        const m = categoryMeta(d.category);
        const dim = selected && selected !== d.category;
        return (
          <Pressable key={d.category} onPress={() => onSelect(d.category)} style={{ opacity: dim ? 0.35 : 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Icon name={m.icon} size={16} color={m.color} />
              <Text style={[s.body, { flex: 1, fontWeight: selected === d.category ? '800' : '600' }]} numberOfLines={1}>{d.category}</Text>
              <Text style={[s.body, { fontWeight: '700', fontVariant: ['tabular-nums'] }]}>{money(d.total, cur)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, height: 14, backgroundColor: colors.surface2, borderRadius: 7, overflow: 'hidden' }}>
                <View style={{ width: `${(d.total / max) * 100}%`, height: 14, backgroundColor: m.color, borderRadius: 7 }} />
              </View>
              <Text style={[s.sub, { width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] }]}>{((d.total / total) * 100).toFixed(0)}%</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function InsightsScreen({ nav, params }) {
  const { receipts, settings, setSettings } = useStore();
  const [period, setPeriod] = useState(params?.period || currentPeriod());
  const [slice, setSlice] = useState(null);
  const chart = ['bar', 'line'].includes(settings.insightsChart) ? settings.insightsChart : 'doughnut'; // Pie was removed
  const cur = settings.currency;

  // Opened from Expenses' "Breakdown ›": show the months picked there.
  useEffect(() => {
    if (params?.period) {
      setPeriod(params.period);
      setSlice(null);
    }
  }, [params?.at]);

  const { list, cats } = useMemo(() => {
    const list = filterReceipts(receipts, periodRange(period)).filter((r) => inPeriod(period, r.date));
    return { list, cats: byCategory(list) };
  }, [receipts, period]);
  const total = sum(list);
  const sel = cats.find((c) => c.category === slice);
  const toggle = (k) => setSlice((cur) => (cur === k ? null : k));

  return (
    <View style={{ flex: 1 }}>
      <Header title="Insights" subtitle="Where your money goes" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <CompanySwitcher onManage={() => nav.push('settings')} style={{ marginBottom: 8 }} />
        <PeriodPicker period={period} onChange={(p) => { setPeriod(p); setSlice(null); }} />

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <Stat label="Total spent" value={money(total, cur)} />
          <Stat label="Receipts" value={String(list.length)} />
        </View>

        {/* chart type */}
        <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.md, padding: 4, marginTop: 16 }}>
          {CHARTS.map((c) => {
            const on = chart === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => setSettings({ insightsChart: c.key })}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: radius.sm, backgroundColor: on ? colors.surface : 'transparent' }}
              >
                <Icon name={c.icon} size={16} color={on ? colors.accentInk : colors.muted} />
                <Text style={{ fontWeight: '700', fontSize: 13, color: on ? colors.text : colors.muted }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle>{periodLabel(period)}</SectionTitle>
        <Card>
          {cats.length === 0 ? (
            <Text style={[s.sub, { textAlign: 'center', paddingVertical: 24 }]}>No spending in {periodLabel(period)}.</Text>
          ) : chart === 'bar' ? (
            <Bars data={cats} total={total} selected={slice} onSelect={toggle} cur={cur} />
          ) : (
            <>
              {chart === 'line' ? (
                <LineChart period={period} list={list} selected={slice} cur={cur} />
              ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                {chart === 'pie' ? (
                  <Pie data={cats} total={total} selected={slice} onSelect={toggle} />
                ) : (
                  <Doughnut data={cats} total={total} selected={slice} onSelect={toggle} />
                )}
                {chart === 'doughnut' && (
                  <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center', width: 128 }}>
                    <Text style={[s.section, { fontSize: 10, textAlign: 'center' }]} numberOfLines={2}>{sel ? sel.category : 'Total spent'}</Text>
                    <Text style={{ color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
                      {money(sel ? sel.total : total, cur)}
                    </Text>
                    {sel && <Text style={s.sub}>{((sel.total / total) * 100).toFixed(1)}%</Text>}
                  </View>
                )}
              </View>
              )}
              {chart === 'pie' && (
                <Text style={[s.body, { textAlign: 'center', fontWeight: '700', marginBottom: 8 }]}>
                  {sel ? `${sel.category} · ${money(sel.total, cur)} · ${((sel.total / total) * 100).toFixed(1)}%` : `Total ${money(total, cur)}`}
                </Text>
              )}

              {cats.map((c) => {
                const meta = categoryMeta(c.category);
                const pct = (c.total / total) * 100;
                const on = slice === c.category;
                return (
                  <Pressable
                    key={c.category}
                    onPress={() => toggle(c.category)}
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
            </>
          )}
          {cats.length > 0 && <Text style={[s.sub, { fontSize: 11, textAlign: 'center', marginTop: 8 }]}>Tap a category to highlight it</Text>}
        </Card>
      </ScrollView>
    </View>
  );
}
