// Export receipts: pick a category and date range, a format (PDF, Excel, CSV, ZIP) and,
// for PDF, a layout (Summary, Detailed, Statement).
import { showAlert } from '../platform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../icons';
import React, { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useStore } from '../store';
import { exportReceipts, deliver } from '../exporters';
import { Button, Card, Chip, Header, s } from '../components';
import { colors, radius } from '../theme';
import { CATEGORIES } from '../categories';
import { filterReceipts, money, prettyDate, rangeFor, sum, toISO } from '../utils';

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'last_7', label: 'Last 7 Days' },
  { key: 'last_30', label: 'Last 30 Days' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_year', label: 'This Year' },
  { key: 'all', label: 'All Time' },
  { key: 'custom', label: 'Custom' },
];

const FORMATS = [
  { key: 'pdf', icon: 'file-text', label: 'PDF' },
  { key: 'xlsx', icon: 'file-spreadsheet', label: 'Excel' },
  { key: 'csv', icon: 'sheet', label: 'CSV' },
  { key: 'zip', icon: 'file-archive', label: 'ZIP' },
];

const LAYOUTS = [
  { key: 'summary', label: 'Summary', text: 'Overview with totals' },
  { key: 'detailed', label: 'Detailed', text: 'With line items & photos' },
  { key: 'statement', label: 'Statement', text: 'Bank style, running total' },
];

const FORMAT_NOTE = {
  xlsx: 'Workbook with receipts, a category summary and line items.',
  csv: 'One row per receipt. Opens in any spreadsheet or accounting software.',
  zip: 'CSV + Excel + every original receipt photo in one file.',
};

const isoToDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// A tappable date box. Android opens the system calendar; elsewhere (web preview) it's a text field.
function DateBox({ label, value, onChange }) {
  const box = { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 12 };
  if (Platform.OS !== 'android') return <TypedDate label={label} value={value} onChange={onChange} style={box} />;
  return (
    <Pressable
      style={({ pressed }) => [box, pressed && { opacity: 0.7 }]}
      onPress={() =>
        DateTimePickerAndroid.open({
          value: isoToDate(value),
          mode: 'date',
          onValueChange: (_e, d) => d && onChange(toISO(d)),
        })
      }
    >
      <Text style={s.sub}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}><Icon name="calendar" size={16} color={colors.muted} /><Text style={[s.body, { fontWeight: '700' }]}>{prettyDate(value)}</Text></View>
    </Pressable>
  );
}

function TypedDate({ label, value, onChange, style }) {
  const [text, setText] = useState(value);
  React.useEffect(() => setText(value), [value]);
  return (
    <View style={style}>
      <Text style={s.sub}>{label} (YYYY-MM-DD)</Text>
      <TextInput
        value={text}
        onChangeText={(v) => {
          setText(v);
          if (/^\d{4}-\d{2}-\d{2}$/.test(v)) onChange(v);
        }}
        style={[s.body, { fontWeight: '700', marginTop: 4, padding: 0 }]}
      />
    </View>
  );
}

const Label = ({ children }) => <Text style={[s.section, { marginTop: 18, marginBottom: 8 }]}>{children}</Text>;

export default function ExportScreen({ nav, params }) {
  const bottomInset = useSafeAreaInsets().bottom; // keep the Export button clear of Android's navigation bar
  const { receipts, settings } = useStore();
  const preselected = params?.ids;

  const [preset, setPreset] = useState('this_year');
  const [range, setRange] = useState(rangeFor('this_year'));
  const [catIndex, setCatIndex] = useState(0); // 0 = all categories
  const [catOpen, setCatOpen] = useState(false);
  const [format, setFormat] = useState('pdf');
  const [layout, setLayout] = useState('summary');
  const [busy, setBusy] = useState(false);

  const cats = [null, ...CATEGORIES.map((c) => c.key)];
  const category = cats[catIndex];
  const catMeta = CATEGORIES.find((c) => c.key === category);

  const choosePreset = (key) => {
    setPreset(key);
    if (key === 'custom') return;
    if (key === 'all') {
      const dates = receipts.map((r) => r.date).filter(Boolean).sort();
      const today = toISO(new Date());
      setRange({ from: dates[0] || today, to: dates[dates.length - 1] > today ? dates[dates.length - 1] : today });
    } else setRange(rangeFor(key));
  };
  const setDate = (k) => (v) => {
    setPreset('custom');
    setRange((r) => {
      const next = { ...r, [k]: v };
      // keep From on or before To
      if (next.from > next.to) k === 'from' ? (next.to = v) : (next.from = v);
      return next;
    });
  };

  const list = useMemo(
    () => (preselected ? receipts.filter((r) => preselected.includes(r.id)) : filterReceipts(receipts, { ...range, category })),
    [receipts, range, category, preselected]
  );

  const go = async () => {
    setBusy(true);
    try {
      const base = preselected ? 'receipts_selected' : `receipts_${range.from}_${range.to}${category ? '_' + category.replace(/\W+/g, '-') : ''}`;
      const subtitle = preselected
        ? `${list.length} selected receipts`
        : `${prettyDate(range.from)} – ${prettyDate(range.to)} · ${category || 'All categories'} · ${list.length} receipts`;
      const out = await exportReceipts(format, list, settings, base, { layout, subtitle });
      await deliver(out, 'Export receipts');
    } catch (e) {
      showAlert('Export failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Export receipts" onBack={nav.back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 + bottomInset }}>
        {preselected ? (
          <Card>
            <Text style={s.body}>Exporting {preselected.length} selected receipt(s)</Text>
          </Card>
        ) : (
          <>
            {/* Category drop-down */}
            <Label>Category</Label>
            <Pressable
              onPress={() => setCatOpen(true)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, paddingHorizontal: 14, opacity: pressed ? 0.7 : 1 })}
            >
              <Icon name={catMeta ? catMeta.icon : 'shapes'} size={20} color={catMeta ? catMeta.color : colors.accentInk} />
              <Text style={[s.body, { flex: 1, fontWeight: '700' }]} numberOfLines={1}>{catMeta ? catMeta.key : 'All categories'}</Text>
              <Icon name="chevron-down" size={20} color={colors.muted} />
            </Pressable>

            <Label>Date range</Label>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <DateBox label="From" value={range.from} onChange={setDate('from')} />
              <DateBox label="To" value={range.to} onChange={setDate('to')} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {PRESETS.map((p) => (
                <Chip key={p.key} label={p.label} active={preset === p.key} onPress={() => choosePreset(p.key)} />
              ))}
            </View>
          </>
        )}

        <Label>Format</Label>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {FORMATS.map((f) => {
            const on = format === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFormat(f.key)}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, backgroundColor: on ? colors.accent : colors.surface, borderColor: on ? colors.accent : colors.border }}
              >
                <Icon name={f.icon} size={20} color={on ? colors.accentText : colors.muted} />
                <Text style={{ marginTop: 2, fontWeight: '700', color: on ? colors.accentText : colors.text }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {format === 'pdf' ? (
          <>
            <Label>PDF layout</Label>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {LAYOUTS.map((l) => {
                const on = layout === l.key;
                return (
                  <Pressable
                    key={l.key}
                    onPress={() => setLayout(l.key)}
                    style={{ flex: 1, padding: 12, borderRadius: radius.md, borderWidth: 1, backgroundColor: on ? colors.accent : colors.surface, borderColor: on ? colors.accent : colors.border }}
                  >
                    <Text style={{ fontWeight: '800', color: on ? colors.accentText : colors.text }}>{l.label}</Text>
                    <Text style={{ fontSize: 12, marginTop: 4, color: on ? colors.accentText : colors.muted }}>{l.text}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <Text style={[s.sub, { marginTop: 10 }]}>{FORMAT_NOTE[format]}</Text>
        )}
      </ScrollView>

      <Modal visible={catOpen} transparent animationType="fade" onRequestClose={() => setCatOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }} onPress={() => setCatOpen(false)}>
          <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 8, maxHeight: '80%' }} onPress={() => {}}>
            <Text style={[s.h2, { paddingHorizontal: 16, paddingVertical: 10 }]}>Choose category</Text>
            <ScrollView>
              {cats.map((key, i) => {
                const m = CATEGORIES.find((c) => c.key === key);
                const on = i === catIndex;
                return (
                  <Pressable
                    key={key || 'all'}
                    onPress={() => {
                      setCatIndex(i);
                      setCatOpen(false);
                    }}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, backgroundColor: on ? colors.surface2 : pressed ? colors.bg : 'transparent' })}
                  >
                    <Icon name={m ? m.icon : 'shapes'} size={20} color={m ? m.color : colors.accentInk} />
                    <Text style={[s.body, { flex: 1, fontWeight: on ? '700' : '400' }]}>{m ? m.key : 'All categories'}</Text>
                    {on && <Icon name="check" size={18} color={colors.accentInk} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 16 + bottomInset, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border }}>
        <Text style={[s.sub, { marginBottom: 8, textAlign: 'center' }]}>
          {list.length} receipt{list.length === 1 ? '' : 's'} · {money(sum(list), settings.currency)}
        </Text>
        <Button title="Export" icon="download" loading={busy} disabled={!list.length} onPress={go} />
      </View>
    </View>
  );
}
