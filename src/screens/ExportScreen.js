// Export receipts: pick a category and date range, a format (PDF, Excel, CSV, ZIP) and,
// for PDF, a layout (Summary, Detailed, Statement).
import { showAlert } from '../platform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../icons';
import React, { useMemo, useState } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useStore } from '../store';
import { buildWorkbookBase64, exportReceipts, deliver } from '../exporters';
import * as Drive from '../drive';
import { Button, Card, Chip, Header, s } from '../components';
import { colors, radius } from '../theme';
import { CATEGORIES } from '../categories';
import { filterReceipts, money, prettyDate, rangeFor, sum, toISO } from '../utils';
import { L, catLabel } from '../i18n';

// Text is built while rendering so it follows the app language.
const PRESETS = () => [
  { key: 'today', label: L('Today', '今天') },
  { key: 'last_7', label: L('Last 7 Days', '最近 7 天') },
  { key: 'last_30', label: L('Last 30 Days', '最近 30 天') },
  { key: 'this_month', label: L('This Month', '本月') },
  { key: 'last_month', label: L('Last Month', '上个月') },
  { key: 'this_year', label: L('This Year', '今年') },
  { key: 'all', label: L('All Time', '全部时间') },
  { key: 'custom', label: L('Custom', '自定义') },
];

const FORMATS = [
  { key: 'pdf', icon: 'file-text', label: 'PDF' },
  { key: 'xlsx', icon: 'file-spreadsheet', label: 'Excel' },
  { key: 'csv', icon: 'sheet', label: 'CSV' },
  { key: 'zip', icon: 'file-archive', label: 'ZIP' },
  { key: 'gsheet', icon: 'sheet', label: 'Sheets' }, // product names, not translated
];

const LAYOUTS = () => [
  { key: 'summary', label: L('Summary', '汇总'), text: L('Overview with totals', '含总额的概览') },
  { key: 'detailed', label: L('Detailed', '详细'), text: L('With line items & photos', '含明细项目和照片') },
  { key: 'statement', label: L('Statement', '明细表'), text: L('Bank style, running total', '银行对账单样式，含累计') },
];

const FORMAT_NOTE = () => ({
  xlsx: L('Workbook with receipts, a category summary and line items.', '包含收据、类别汇总和明细项目的工作簿。'),
  csv: L('One row per receipt. Opens in any spreadsheet or accounting software.', '每张收据一行。可用任何电子表格或会计软件打开。'),
  zip: L('CSV + Excel + every original receipt photo in one file.', 'CSV + Excel + 所有原始收据照片，打包成一个文件。'),
  gsheet: L(
    'Saves a copy as a Google Sheet in your Google Drive (ScanTrack Receipts › this company), ready to share online. The Receipt photo column shows each whole receipt, and Image link opens it.',
    '在你的 Google 云端硬盘（ScanTrack Receipts › 此公司）中另存为 Google 表格，方便在线分享。“收据照片”一栏会显示每张完整的收据。'
  ),
});

const isoToDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// A tappable date box. Android opens the system calendar; elsewhere (web preview) it's a text field.
export function DateBox({ label, value, onChange }) {
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
      <Text style={s.sub}>{label} ({L('YYYY-MM-DD', '年-月-日')})</Text>
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
        ? L(`${list.length} selected receipts`, `已选 ${list.length} 张收据`)
        : `${prettyDate(range.from)} – ${prettyDate(range.to)} · ${category ? catLabel(category) : L('All categories', '所有类别')} · ${L(`${list.length} receipts`, `${list.length} 张收据`)}`;
      if (format === 'gsheet') {
        if (!settings.driveEnabled) {
          showAlert(L('Sign in to Google Drive first', '请先登录 Google 云端硬盘'), L('Go to Settings › Google Drive backup and sign in, then try again.', '请到 设置 › Google 云端硬盘备份 登录后再试。'));
          return;
        }
        const url = await Drive.saveAsGoogleSheet(`ScanTrack ${base.replace(/^receipts_?/, '').replace(/_/g, ' ') || 'receipts'}`.trim(), buildWorkbookBase64(list, true), list.length);
        showAlert(L('Saved to Google Sheets', '已保存到 Google 表格'), L('A copy is in your Google Drive under ScanTrack Receipts. Open it and tap Share to give your users access.', '副本已保存在 Google 云端硬盘的 ScanTrack Receipts 文件夹中。打开后点击“共享”即可让其他人访问。'), [
          { text: L('Share link', '分享链接'), onPress: () => Share.share({ message: url }) },
          { text: L('Open', '打开'), onPress: () => Linking.openURL(url) },
        ]);
        return;
      }
      const out = await exportReceipts(format, list, settings, base, { layout, subtitle });
      await deliver(out, L('Export receipts', '导出收据'));
    } catch (e) {
      showAlert(L('Export failed', '导出失败'), e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title={L('Export receipts', '导出收据')} onBack={nav.back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 + bottomInset }}>
        {preselected ? (
          <Card>
            <Text style={s.body}>{L(`Exporting ${preselected.length} selected receipt(s)`, `正在导出已选的 ${preselected.length} 张收据`)}</Text>
          </Card>
        ) : (
          <>
            {/* Category drop-down */}
            <Label>{L('Category', '类别')}</Label>
            <Pressable
              onPress={() => setCatOpen(true)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, paddingHorizontal: 14, opacity: pressed ? 0.7 : 1 })}
            >
              <Icon name={catMeta ? catMeta.icon : 'shapes'} size={20} color={catMeta ? catMeta.color : colors.accentInk} />
              <Text style={[s.body, { flex: 1, fontWeight: '700' }]} numberOfLines={1}>{catMeta ? catLabel(catMeta.key) : L('All categories', '所有类别')}</Text>
              <Icon name="chevron-down" size={20} color={colors.muted} />
            </Pressable>

            <Label>{L('Date range', '日期范围')}</Label>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <DateBox label={L('From', '从')} value={range.from} onChange={setDate('from')} />
              <DateBox label={L('To', '至')} value={range.to} onChange={setDate('to')} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {PRESETS().map((p) => (
                <Chip key={p.key} label={p.label} active={preset === p.key} onPress={() => choosePreset(p.key)} />
              ))}
            </View>
          </>
        )}

        <Label>{L('Format', '格式')}</Label>
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
            <Label>{L('PDF layout', 'PDF 版式')}</Label>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {LAYOUTS().map((l) => {
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
          <Text style={[s.sub, { marginTop: 10 }]}>{FORMAT_NOTE()[format]}</Text>
        )}
      </ScrollView>

      <Modal visible={catOpen} transparent animationType="fade" onRequestClose={() => setCatOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }} onPress={() => setCatOpen(false)}>
          <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 8, maxHeight: '80%' }} onPress={() => {}}>
            <Text style={[s.h2, { paddingHorizontal: 16, paddingVertical: 10 }]}>{L('Choose category', '选择类别')}</Text>
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
                    <Text style={[s.body, { flex: 1, fontWeight: on ? '700' : '400' }]}>{m ? catLabel(m.key) : L('All categories', '所有类别')}</Text>
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
          {L(`${list.length} receipt${list.length === 1 ? '' : 's'}`, `${list.length} 张收据`)} · {money(sum(list), settings.currency)}
        </Text>
        <Button title={format === 'gsheet' ? L('Save to Google Sheets', '保存到 Google 表格') : L('Export', '导出')} icon={format === 'gsheet' ? 'sheet' : 'download'} loading={busy} disabled={!list.length} onPress={go} />
      </View>
    </View>
  );
}
