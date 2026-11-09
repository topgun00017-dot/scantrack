// Export data: receipts and expenses as CSV, PDF, Excel or ZIP.
import { showAlert } from '../platform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { exportReceipts, deliver } from '../exporters';
import { Button, Card, Chip, ChipRow, Header, RangePicker, SectionTitle, s } from '../components';
import { colors, radius } from '../theme';
import { CATEGORIES } from '../categories';
import { filterReceipts, money, rangeFor, sum } from '../utils';

const FORMATS = [
  { key: 'csv', icon: '📑', title: 'CSV', text: 'Opens in any spreadsheet or accounting tool' },
  { key: 'xlsx', icon: '📗', title: 'Excel', text: 'Receipts, category summary and line items sheets' },
  { key: 'pdf', icon: '📄', title: 'PDF', text: 'Printable summary with receipt images' },
  { key: 'zip', icon: '🗜️', title: 'ZIP', text: 'CSV + Excel + every original receipt photo' },
];

export default function ExportScreen({ nav, params }) {
  // Keep the fixed bottom button clear of Android's navigation bar.
  const bottomInset = useSafeAreaInsets().bottom;
  const { receipts, settings } = useStore();
  const preselected = params?.ids;
  const [preset, setPreset] = useState('this_month');
  const [category, setCategory] = useState(null);
  const [format, setFormat] = useState('xlsx');
  const [busy, setBusy] = useState(false);

  const list = useMemo(
    () => (preselected ? receipts.filter((r) => preselected.includes(r.id)) : filterReceipts(receipts, { ...rangeFor(preset), category })),
    [receipts, preset, category, preselected]
  );

  const go = async () => {
    setBusy(true);
    try {
      const out = await exportReceipts(format, list, settings);
      await deliver(out, 'Export receipts');
    } catch (e) {
      showAlert('Export failed', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Export data" onBack={nav.back} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 + bottomInset }}>
        {preselected ? (
          <Card><Text style={s.body}>Exporting {preselected.length} selected receipt(s)</Text></Card>
        ) : (
          <>
            <SectionTitle>Period</SectionTitle>
            <RangePicker value={preset} onChange={setPreset} />
            <SectionTitle>Category</SectionTitle>
            <ChipRow>
              <Chip label="All" active={!category} onPress={() => setCategory(null)} />
              {CATEGORIES.map((c) => <Chip key={c.key} label={`${c.icon} ${c.key}`} active={category === c.key} onPress={() => setCategory(c.key)} />)}
            </ChipRow>
          </>
        )}

        <SectionTitle>Format</SectionTitle>
        {FORMATS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setFormat(f.key)}
            style={{ flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: radius.md, borderWidth: 2, borderColor: format === f.key ? colors.accent : colors.border, backgroundColor: colors.surface, marginBottom: 8 }}
          >
            <Text style={{ fontSize: 26, marginRight: 12 }}>{f.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[s.body, { fontWeight: '700' }]}>{f.title}</Text>
              <Text style={s.sub}>{f.text}</Text>
            </View>
            <Text style={{ color: format === f.key ? colors.accentInk : colors.faint, fontSize: 20 }}>{format === f.key ? '●' : '○'}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16, paddingBottom: 16 + bottomInset, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border }}>
        <Text style={[s.sub, { marginBottom: 8, textAlign: 'center' }]}>{list.length} receipts · {money(sum(list), settings.currency)}</Text>
        <Button title={`Export ${format.toUpperCase()} & share`} loading={busy} disabled={!list.length} onPress={go} />
      </View>
    </View>
  );
}
