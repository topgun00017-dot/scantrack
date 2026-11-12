// Review / edit a receipt: extracted fields, line items, category, tags.
import { showAlert } from '../platform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../useKeyboard';
import React, { useMemo, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useStore } from '../store';
import { Button, Card, Chip, DOUBT, Field, Header, SectionTitle, s } from '../components';
import { colors } from '../theme';
import { CATEGORIES, autoCategorize } from '../categories';
import CategoryEditor from '../CategoryEditor';
import { useCompanies } from '../companies';
import { CompanyDot } from '../CompanySwitcher';
import { Icon } from '../icons';
import { showToast } from '../Toast';
import { showReceiptResult } from '../ReceiptResult';
import { findDuplicate, money, prettyDate } from '../utils';

const num = (v) => {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
};

export default function ReceiptEditScreen({ nav, params }) {
  const bottomInset = useSafeAreaInsets().bottom; // clear Android's navigation bar
  const keyboard = useKeyboardHeight(); // Android: lift content above the on-screen keyboard
  const { receipts, addReceipt, updateReceipt, deleteReceipt, detachReceipt, settings } = useStore();
  const existing = params.id ? receipts.find((r) => r.id === params.id) : null;
  const src = existing || params.draft || {};
  const isNew = !existing;

  const [f, setF] = useState({
    merchant: src.merchant || '',
    date: src.date || '',
    total: src.total ? String(src.total) : '',
    tax: src.tax ? String(src.tax) : '',
    paymentMethod: src.paymentMethod || '',
    notes: src.notes || '',
    category: src.category || 'Others',
    tags: src.tags || [],
    currency: src.currency || settings.currency,
    lineItems: (src.lineItems || []).map((i) => ({ ...i, amount: String(i.amount ?? ''), qty: String(i.qty ?? 1) })),
    status: src.status || 'processed',
  });
  const [tagInput, setTagInput] = useState('');
  const [zoom, setZoom] = useState(false);
  const [catEditor, setCatEditor] = useState(false);
  const { companies, active: company, sendReceiptTo } = useCompanies();
  const [targetId, setTargetId] = useState(company?.id); // company this receipt is saved to
  const [companyPick, setCompanyPick] = useState(false);
  const target = companies.find((c) => c.id === targetId) || company;
  // Fields the AI wasn't sure about (new scans only); a field stops being highlighted once edited.
  const [doubt, setDoubt] = useState(() => new Set(isNew ? src.lowConfidence || [] : []));
  const set = (k) => (v) => {
    setF((x) => ({ ...x, [k]: v }));
    if (doubt.has(k)) setDoubt((d) => new Set([...d].filter((x) => x !== k)));
  };
  const { height: screenH } = useWindowDimensions();

  const itemsTotal = f.lineItems.reduce((acc, i) => acc + num(i.amount), 0);
  const dup = useMemo(
    () => findDuplicate(receipts, { merchant: f.merchant, date: f.date, total: num(f.total), confirmedUnique: existing?.confirmedUnique }, existing?.id),
    [receipts, f.merchant, f.date, f.total]
  );

  if (!existing && !params.draft) {
    return (
      <View style={{ flex: 1 }}>
        <Header title="Receipt" onBack={nav.back} />
        <Text style={[s.sub, { padding: 16 }]}>This receipt was deleted.</Text>
      </View>
    );
  }

  const save = () => {
    if (!f.merchant.trim()) return showAlert('Merchant missing', 'Add the merchant name.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return showAlert('Check the date', 'Use the format YYYY-MM-DD.');
    const total = num(f.total);
    const tax = num(f.tax);
    const rec = {
      merchant: f.merchant.trim(),
      date: f.date,
      total,
      tax,
      subtotal: +(total - tax).toFixed(2),
      paymentMethod: f.paymentMethod.trim(),
      notes: f.notes.trim(),
      category: f.category,
      tags: f.tags,
      currency: f.currency,
      lineItems: f.lineItems.filter((i) => i.description || num(i.amount)).map((i) => ({ description: i.description, qty: num(i.qty) || 1, amount: num(i.amount) })),
      // Saving after a human check marks it reviewed; a zero total still needs attention.
      status: total > 0 ? 'processed' : 'needs_review',
      imageUri: src.imageUri || null,
    };
    // Saving into another company: write it to that company and take it out of this one.
    if (target && company && target.id !== company.id) {
      const full = isNew
        ? { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), createdAt: Date.now(), ...rec }
        : { ...existing, ...rec };
      sendReceiptTo(target.id, full)
        .then(() => {
          if (!isNew) detachReceipt(existing.id);
          nav.back();
          showToast({ title: isNew ? `Saved to ${target.name}` : `Moved to ${target.name}`, text: `${full.merchant} · ${money(full.total, full.currency)} · ${full.category}` });
        })
        .catch((e) => showAlert('Could not save', e.message));
      return;
    }
    const commit = (r) => {
      const id = isNew ? addReceipt(r).id : existing.id;
      if (!isNew) updateReceipt(existing.id, r);
      nav.back();
      showReceiptResult({ id, isNew }); // "Receipt Saved!" panel with upload progress
    };
    // Same date and amount at a similar-named shop: ask before saving a second copy.
    const twin = findDuplicate(receipts, { ...rec, confirmedUnique: existing?.confirmedUnique }, existing?.id);
    if (!twin) return commit(rec);
    showAlert(
      'Possible duplicate',
      `You already have ${twin.merchant} on ${prettyDate(twin.date)} for ${money(twin.total, twin.currency)}.\n\nIs this a different purchase?`,
      [
        isNew
          ? { text: "Don't save", style: 'destructive', onPress: () => nav.back() }
          : { text: 'Delete this copy', style: 'destructive', onPress: () => { deleteReceipt(existing.id); nav.back(); } },
        { text: 'Cancel', style: 'cancel' },
        { text: 'Not a duplicate', onPress: () => commit({ ...rec, confirmedUnique: true }) },
      ]
    );
  };

  const remove = () =>
    showAlert('Delete receipt', 'Delete this receipt and its image?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteReceipt(existing.id); nav.back(); } },
    ]);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (t && !f.tags.includes(t)) set('tags')([...f.tags, t]);
    setTagInput('');
  };

  const setItem = (i, k, v) => set('lineItems')(f.lineItems.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={isNew ? 'Review receipt' : 'Receipt'} onBack={nav.back} right={!isNew && <Text style={{ color: colors.danger, fontWeight: '700' }} onPress={remove}>Delete</Text>} />
      {/* split view: the receipt photo stays on top, the fields scroll below it */}
      {src.imageUri && !keyboard ? (
        <Pressable onPress={() => setZoom(true)} style={{ height: Math.round(screenH * 0.3), marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', backgroundColor: '#111827' }}>
          <Image source={{ uri: src.imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 }}>
            <Icon name="search" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>Tap to zoom</Text>
          </View>
        </Pressable>
      ) : null}
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 + bottomInset + keyboard }} keyboardShouldPersistTaps="handled">
        {doubt.size > 0 && (
          <View style={{ flexDirection: 'row', gap: 10, backgroundColor: DOUBT.bg, borderWidth: 1, borderColor: DOUBT.border, borderRadius: 12, padding: 12, marginBottom: 4 }}>
            <Icon name="alert" size={18} color={DOUBT.text} />
            <Text style={{ color: DOUBT.text, flex: 1 }}>
              <Text style={{ fontWeight: '800' }}>Check {doubt.size} field{doubt.size > 1 ? 's' : ''} in yellow. </Text>
              The AI wasn't sure about {doubt.size > 1 ? 'them' : 'it'}. Compare with the photo above, then save.
            </Text>
          </View>
        )}

        {f.status === 'needs_review' && (
          <Card style={{ marginTop: 12, borderColor: colors.warning }}>
            <Text style={[s.body, { fontWeight: '700' }]}>Please check these details</Text>
            <Text style={[s.sub, { marginTop: 4 }]}>Some fields were unclear or missing. Saving marks it reviewed.</Text>
          </Card>
        )}
        {dup && (
          <Card style={{ marginTop: 12, borderColor: colors.danger }}>
            <Text style={[s.body, { fontWeight: '700' }]}>Possible duplicate</Text>
            <Text style={[s.sub, { marginTop: 4 }]}>A receipt from {dup.merchant} on {prettyDate(dup.date)} for {money(dup.total, dup.currency)} already exists. You'll be asked to confirm when you save.</Text>
          </Card>
        )}

        {companies.length > 1 && (
          <Pressable
            onPress={() => setCompanyPick(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: target?.id !== company?.id ? colors.accent : colors.border, padding: 12, marginTop: 12 }}
          >
            <CompanyDot color={target?.color} size={12} />
            <View style={{ flex: 1 }}>
              <Text style={s.sub}>{isNew ? 'Save to company' : target?.id !== company?.id ? 'Will move to company' : 'Company'}</Text>
              <Text style={[s.body, { fontWeight: '700' }]} numberOfLines={1}>{target?.name}</Text>
            </View>
            <Text style={{ color: colors.accentInk, fontWeight: '700' }}>Change</Text>
          </Pressable>
        )}
        <Modal visible={companyPick} transparent animationType="fade" onRequestClose={() => setCompanyPick(false)}>
          <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }} onPress={() => setCompanyPick(false)}>
            <Pressable style={{ backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 8 }} onPress={() => {}}>
              <Text style={[s.h2, { paddingHorizontal: 16, paddingVertical: 10 }]}>{isNew ? 'Save to company' : 'Move to company'}</Text>
              {companies.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => { setTargetId(c.id); setCompanyPick(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, backgroundColor: c.id === targetId ? colors.surface2 : 'transparent' }}
                >
                  <CompanyDot color={c.color} size={12} />
                  <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{c.name}{c.id === company?.id ? '  (current)' : ''}</Text>
                  {c.id === targetId && <Icon name="check" size={18} color={colors.accentInk} />}
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>

        <SectionTitle>Details</SectionTitle>
        <Field label="Merchant" highlight={doubt.has('merchant')} value={f.merchant} onChangeText={(v) => { set('merchant')(v); if (isNew && f.category === 'Others') set('category')(autoCategorize(v)); }} placeholder="e.g. Petronas Klang" />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field style={{ flex: 1 }} label="Date (YYYY-MM-DD)" highlight={doubt.has('date')} value={f.date} onChangeText={set('date')} placeholder="2026-11-05" />
          <Field style={{ width: 90 }} label="Currency" value={f.currency} onChangeText={(v) => set('currency')(v.toUpperCase())} autoCapitalize="characters" maxLength={3} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field style={{ flex: 1 }} label="Total" highlight={doubt.has('total')} value={f.total} onChangeText={set('total')} keyboardType="decimal-pad" placeholder="0.00" />
          <Field style={{ flex: 1 }} label="Tax (SST)" highlight={doubt.has('tax')} value={f.tax} onChangeText={set('tax')} keyboardType="decimal-pad" placeholder="0.00" />
        </View>
        <Field label="Payment method" highlight={doubt.has('paymentMethod')} value={f.paymentMethod} onChangeText={set('paymentMethod')} placeholder="Card, Cash, TNG eWallet…" />

        <SectionTitle>{doubt.has('category') ? 'Category · please check' : 'Category'}</SectionTitle>
        <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, doubt.has('category') && { backgroundColor: DOUBT.bg, borderWidth: 1, borderColor: DOUBT.border, borderRadius: 12, padding: 8 }]}>
          {CATEGORIES.map((c) => <Chip key={c.key} icon={c.icon} iconColor={c.color} label={c.key} active={f.category === c.key} onPress={() => set('category')(c.key)} color={c.color} />)}
          <Chip icon="plus" label="New category" onPress={() => setCatEditor(true)} />
        </View>

        <SectionTitle>Tags</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {f.tags.map((t) => <Chip key={t} label={`#${t}  ✕`} active color={colors.info} onPress={() => set('tags')(f.tags.filter((x) => x !== t))} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput value={tagInput} onChangeText={setTagInput} onSubmitEditing={addTag} placeholder="Add tag (client, project, trip)" placeholderTextColor={colors.faint} style={[s.input, { flex: 1 }]} autoCapitalize="none" />
          <Button title="Add" small variant="secondary" onPress={addTag} />
        </View>

        <SectionTitle right={<Text style={[s.sub, doubt.has('lineItems') && { color: DOUBT.text, fontWeight: '700' }]}>Items sum {money(itemsTotal, f.currency)}</Text>}>
          {doubt.has('lineItems') ? "Line items · don't add up, please check" : 'Line items'}
        </SectionTitle>
        <View style={doubt.has('lineItems') ? { backgroundColor: DOUBT.bg, borderWidth: 1, borderColor: DOUBT.border, borderRadius: 12, padding: 8, paddingBottom: 0, marginBottom: 8 } : null}>
        {f.lineItems.map((it, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
            <TextInput value={it.description} onChangeText={(v) => setItem(i, 'description', v)} placeholder="Item" placeholderTextColor={colors.faint} style={[s.input, { flex: 1, paddingVertical: 10 }]} />
            <TextInput value={it.qty} onChangeText={(v) => setItem(i, 'qty', v)} keyboardType="decimal-pad" style={[s.input, { width: 48, paddingVertical: 10, textAlign: 'center' }]} />
            <TextInput value={it.amount} onChangeText={(v) => setItem(i, 'amount', v)} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.faint} style={[s.input, { width: 84, paddingVertical: 10, textAlign: 'right' }]} />
            <Text style={{ color: colors.danger, fontSize: 18, paddingHorizontal: 4 }} onPress={() => set('lineItems')(f.lineItems.filter((_, idx) => idx !== i))}>✕</Text>
          </View>
        ))}
        </View>
        <Button title="Add line item" icon="plus" variant="ghost" small onPress={() => set('lineItems')([...f.lineItems, { description: '', qty: '1', amount: '' }])} />

        <SectionTitle>Notes</SectionTitle>
        <TextInput value={f.notes} onChangeText={set('notes')} placeholder="Business purpose, attendees…" placeholderTextColor={colors.faint} style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]} multiline />

        <Button title={isNew ? 'Save receipt' : f.status === 'needs_review' ? 'Save & mark reviewed' : 'Save changes'} onPress={save} style={{ marginTop: 20 }} />
      </ScrollView>

      <CategoryEditor visible={catEditor} onClose={() => setCatEditor(false)} onCreated={(key) => set('category')(key)} />

      <Modal visible={zoom} transparent onRequestClose={() => setZoom(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }} onPress={() => setZoom(false)}>
          {src.imageUri && <Image source={{ uri: src.imageUri }} style={{ width: '100%', height: '85%' }} resizeMode="contain" />}
          <Text style={{ color: '#fff', textAlign: 'center', marginTop: 12 }}>Tap to close</Text>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
