// Review / edit a receipt: extracted fields, line items, category, tags.
import { showAlert } from '../platform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../useKeyboard';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
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
import { L, catLabel } from '../i18n';

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
  const { height: screenH, width: screenW } = useWindowDimensions();

  // ---------- swipe left / right to the next / previous receipt (order of the list it was opened from)
  const order = params.ids || [];
  const pos = existing ? order.indexOf(existing.id) : -1;
  const prevId = pos > 0 ? order[pos - 1] : null;
  const nextId = pos >= 0 && pos < order.length - 1 ? order[pos + 1] : null;
  const initialForm = useRef(JSON.stringify(f));
  const live = useRef({});
  live.current = { f, prevId, nextId };
  const pan = useRef(new Animated.Value(params.from === 'next' ? screenW : params.from === 'prev' ? -screenW : 0)).current;
  useEffect(() => {
    Animated.spring(pan, { toValue: 0, useNativeDriver: true, friction: 9 }).start();
  }, []);
  // Only the photo slides; the fields stay put and keep the same scroll position.
  const scrollRef = useRef(null);
  const scrollY = useRef(0);
  const restored = useRef(false);
  const goTo = (id, dir) => nav.replace('receipt', { id, ids: order, from: dir, scrollY: scrollY.current });
  const tryGo = (dir) => {
    const id = dir === 'next' ? live.current.nextId : live.current.prevId;
    if (!id) return Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
    const leave = () =>
      Animated.timing(pan, { toValue: dir === 'next' ? -screenW : screenW, duration: 160, useNativeDriver: true }).start(() => goTo(id, dir));
    if (JSON.stringify(live.current.f) !== initialForm.current) {
      Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
      return showAlert(L('Unsaved changes', '有未保存的更改'), L('Move to the other receipt without saving your changes here?', '不保存这里的更改就切换到另一张收据吗？'), [
        { text: L('Stay', '留下'), style: 'cancel' },
        { text: L('Discard changes', '放弃更改'), style: 'destructive', onPress: leave },
      ]);
    }
    leave();
  };
  const tryGoRef = useRef(tryGo);
  tryGoRef.current = tryGo;
  // Track the finger ourselves from where it first touched down: steadier than gestureState on every platform.
  const touch = useRef({ x: 0, y: 0, t: 0, dx: 0 });
  const delta = (e) => {
    const { pageX, pageY } = e.nativeEvent;
    if (pageX == null) return { dx: touch.current.dx, dy: 0 }; // some platforms send no position on lift-off
    return { dx: pageX - touch.current.x, dy: pageY - touch.current.y };
  };
  const isSwipe = (e) => {
    const { dx, dy } = delta(e);
    return order.length > 1 && Math.abs(dx) > 20 && Math.abs(dx) > Math.abs(dy) * 2;
  };
  const swipe = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (e) => {
          touch.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, t: Date.now(), dx: 0 };
          return false; // let taps and scrolling through
        },
        onMoveShouldSetPanResponderCapture: (e) => isSwipe(e),
        onMoveShouldSetPanResponder: (e) => isSwipe(e),
        onPanResponderTerminationRequest: () => false, // keep the swipe once it has started
        onPanResponderMove: (e) => {
          const { dx } = delta(e);
          touch.current.dx = dx;
          const blocked = (dx < 0 && !live.current.nextId) || (dx > 0 && !live.current.prevId);
          pan.setValue(blocked ? dx * 0.2 : dx); // resist at the first / last receipt
        },
        onPanResponderRelease: (e) => {
          const { dx } = delta(e);
          const v = dx / Math.max(1, Date.now() - touch.current.t); // px per ms
          if (dx < -80 || (dx < -30 && v < -0.6)) tryGoRef.current('next');
          else if (dx > 80 || (dx > 30 && v > 0.6)) tryGoRef.current('prev');
          else Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => Animated.spring(pan, { toValue: 0, useNativeDriver: true }).start(),
      }),
    []
  );

  const itemsTotal = f.lineItems.reduce((acc, i) => acc + num(i.amount), 0);
  const dup = useMemo(
    () => findDuplicate(receipts, { merchant: f.merchant, date: f.date, total: num(f.total), confirmedUnique: existing?.confirmedUnique }, existing?.id),
    [receipts, f.merchant, f.date, f.total]
  );

  if (!existing && !params.draft) {
    return (
      <View style={{ flex: 1 }}>
        <Header title={L('Receipt', '收据')} onBack={nav.back} />
        <Text style={[s.sub, { padding: 16 }]}>{L('This receipt was deleted.', '此收据已被删除。')}</Text>
      </View>
    );
  }

  const save = () => {
    if (!f.merchant.trim()) return showAlert(L('Merchant missing', '缺少商家'), L('Add the merchant name.', '请填写商家名称。'));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.date)) return showAlert(L('Check the date', '请检查日期'), L('Use the format YYYY-MM-DD.', '请使用 YYYY-MM-DD 格式（年-月-日）。'));
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
          showToast({ title: isNew ? L(`Saved to ${target.name}`, `已保存到 ${target.name}`) : L(`Moved to ${target.name}`, `已移到 ${target.name}`), text: `${full.merchant} · ${money(full.total, full.currency)} · ${catLabel(full.category)}` });
        })
        .catch((e) => showAlert(L('Could not save', '无法保存'), e.message));
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
      L('Possible duplicate', '可能重复'),
      L(
        `You already have ${twin.merchant} on ${prettyDate(twin.date)} for ${money(twin.total, twin.currency)}.\n\nIs this a different purchase?`,
        `你已经有一张 ${prettyDate(twin.date)} 在 ${twin.merchant} 消费 ${money(twin.total, twin.currency)} 的收据。\n\n这是另一笔消费吗？`
      ),
      [
        isNew
          ? { text: L("Don't save", '不保存'), style: 'destructive', onPress: () => nav.back() }
          : { text: L('Delete this copy', '删除这份'), style: 'destructive', onPress: () => { deleteReceipt(existing.id); nav.back(); } },
        { text: L('Cancel', '取消'), style: 'cancel' },
        { text: L('Not a duplicate', '不是重复'), onPress: () => commit({ ...rec, confirmedUnique: true }) },
      ]
    );
  };

  const remove = () =>
    showAlert(L('Delete receipt', '删除收据'), L('Delete this receipt and its image?', '删除这张收据及其图片？'), [
      { text: L('Cancel', '取消'), style: 'cancel' },
      { text: L('Delete', '删除'), style: 'destructive', onPress: () => { deleteReceipt(existing.id); nav.back(); } },
    ]);

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (t && !f.tags.includes(t)) set('tags')([...f.tags, t]);
    setTagInput('');
  };

  const setItem = (i, k, v) => set('lineItems')(f.lineItems.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));

  return (
    <KeyboardAvoidingView style={{ flex: 1, overflow: 'hidden' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header title={isNew ? L('Review receipt', '审核收据') : L('Receipt', '收据')} onBack={nav.back} right={!isNew && <Text style={{ color: colors.danger, fontWeight: '700' }} onPress={remove}>{L('Delete', '删除')}</Text>} />
      {pos >= 0 && order.length > 1 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: -6, marginBottom: 8 }}>
          <Pressable hitSlop={10} disabled={!prevId} onPress={() => tryGo('prev')} style={{ flexDirection: 'row', alignItems: 'center', opacity: prevId ? 1 : 0.3 }}>
            <Icon name="chevron-left" size={18} color={colors.accentInk} />
            <Text style={{ color: colors.accentInk, fontWeight: '700' }}>{L('Previous', '上一张')}</Text>
          </Pressable>
          <Text style={s.sub}>{L(`${pos + 1} of ${order.length} · swipe to browse`, `第 ${pos + 1} / ${order.length} 张 · 左右滑动浏览`)}</Text>
          <Pressable hitSlop={10} disabled={!nextId} onPress={() => tryGo('next')} style={{ flexDirection: 'row', alignItems: 'center', opacity: nextId ? 1 : 0.3 }}>
            <Text style={{ color: colors.accentInk, fontWeight: '700' }}>{L('Next', '下一张')}</Text>
            <Icon name="chevron-right" size={18} color={colors.accentInk} />
          </Pressable>
        </View>
      )}
      <View style={{ flex: 1 }} {...swipe.panHandlers}>
      {/* split view: the receipt photo stays on top, the fields scroll below it */}
      {src.imageUri && !keyboard ? (
        <Animated.View style={{ transform: [{ translateX: pan }] }}>
        <Pressable onPress={() => setZoom(true)} style={{ height: Math.round(screenH * 0.3), marginHorizontal: 16, borderRadius: 14, overflow: 'hidden', backgroundColor: '#111827' }}>
          <Image source={{ uri: src.imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          <View style={{ position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 }}>
            <Icon name="search" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{L('Tap to zoom', '点击放大')}</Text>
          </View>
        </Pressable>
        </Animated.View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        onScroll={(e) => (scrollY.current = e.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}
        onContentSizeChange={() => {
          if (params.scrollY && !restored.current) {
            restored.current = true;
            scrollRef.current?.scrollTo({ y: params.scrollY, animated: false });
          }
        }}
        contentContainerStyle={{ padding: 16, paddingBottom: 48 + bottomInset + keyboard }}
        keyboardShouldPersistTaps="handled"
      >
        {doubt.size > 0 && (
          <View style={{ flexDirection: 'row', gap: 10, backgroundColor: DOUBT.bg, borderWidth: 1, borderColor: DOUBT.border, borderRadius: 12, padding: 12, marginBottom: 4 }}>
            <Icon name="alert" size={18} color={DOUBT.text} />
            <Text style={{ color: DOUBT.text, flex: 1 }}>
              <Text style={{ fontWeight: '800' }}>{L(`Check ${doubt.size} field${doubt.size > 1 ? 's' : ''} in yellow. `, `请检查 ${doubt.size} 个黄色栏位。`)}</Text>
              {L(`The AI wasn't sure about ${doubt.size > 1 ? 'them' : 'it'}. Compare with the photo above, then save.`, 'AI 对这些内容不太确定。请对照上方照片核对后再保存。')}
            </Text>
          </View>
        )}

        {f.status === 'needs_review' && (
          <Card style={{ marginTop: 12, borderColor: colors.warning }}>
            <Text style={[s.body, { fontWeight: '700' }]}>{L('Please check these details', '请检查这些详情')}</Text>
            <Text style={[s.sub, { marginTop: 4 }]}>{L('Some fields were unclear or missing. Saving marks it reviewed.', '有些栏位不清楚或缺失。保存后会标记为已审核。')}</Text>
          </Card>
        )}
        {dup && (
          <Card style={{ marginTop: 12, borderColor: colors.danger }}>
            <Text style={[s.body, { fontWeight: '700' }]}>{L('Possible duplicate', '可能重复')}</Text>
            <Text style={[s.sub, { marginTop: 4 }]}>{L(`A receipt from ${dup.merchant} on ${prettyDate(dup.date)} for ${money(dup.total, dup.currency)} already exists. You'll be asked to confirm when you save.`, `已经有一张 ${prettyDate(dup.date)} 在 ${dup.merchant} 消费 ${money(dup.total, dup.currency)} 的收据。保存时会请你确认。`)}</Text>
          </Card>
        )}

        {companies.length > 1 && (
          <Pressable
            onPress={() => setCompanyPick(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: target?.id !== company?.id ? colors.accent : colors.border, padding: 12, marginTop: 12 }}
          >
            <CompanyDot color={target?.color} size={12} />
            <View style={{ flex: 1 }}>
              <Text style={s.sub}>{isNew ? L('Save to company', '保存到公司') : target?.id !== company?.id ? L('Will move to company', '将移到公司') : L('Company', '公司')}</Text>
              <Text style={[s.body, { fontWeight: '700' }]} numberOfLines={1}>{target?.name}</Text>
            </View>
            <Text style={{ color: colors.accentInk, fontWeight: '700' }}>{L('Change', '更改')}</Text>
          </Pressable>
        )}
        <Modal visible={companyPick} transparent animationType="fade" onRequestClose={() => setCompanyPick(false)}>
          <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }} onPress={() => setCompanyPick(false)}>
            <Pressable style={{ backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 8 }} onPress={() => {}}>
              <Text style={[s.h2, { paddingHorizontal: 16, paddingVertical: 10 }]}>{isNew ? L('Save to company', '保存到公司') : L('Move to company', '移到公司')}</Text>
              {companies.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => { setTargetId(c.id); setCompanyPick(false); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, backgroundColor: c.id === targetId ? colors.surface2 : 'transparent' }}
                >
                  <CompanyDot color={c.color} size={12} />
                  <Text style={[s.body, { flex: 1 }]} numberOfLines={1}>{c.name}{c.id === company?.id ? L('  (current)', '（当前）') : ''}</Text>
                  {c.id === targetId && <Icon name="check" size={18} color={colors.accentInk} />}
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>

        <SectionTitle>{L('Details', '详情')}</SectionTitle>
        <Field label={L('Merchant', '商家')} highlight={doubt.has('merchant')} value={f.merchant} onChangeText={(v) => { set('merchant')(v); if (isNew && f.category === 'Others') set('category')(autoCategorize(v)); }} placeholder={L('e.g. Petronas Klang', '例如：Petronas Klang')} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field style={{ flex: 1 }} label={L('Date (YYYY-MM-DD)', '日期（年-月-日）')} highlight={doubt.has('date')} value={f.date} onChangeText={set('date')} placeholder="2026-11-05" />
          <Field style={{ width: 90 }} label={L('Currency', '货币')} value={f.currency} onChangeText={(v) => set('currency')(v.toUpperCase())} autoCapitalize="characters" maxLength={3} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field style={{ flex: 1 }} label={L('Total', '总额')} highlight={doubt.has('total')} value={f.total} onChangeText={set('total')} keyboardType="decimal-pad" placeholder="0.00" />
          <Field style={{ flex: 1 }} label={L('Tax (SST)', '税款 (SST)')} highlight={doubt.has('tax')} value={f.tax} onChangeText={set('tax')} keyboardType="decimal-pad" placeholder="0.00" />
        </View>
        <Field label={L('Payment method', '付款方式')} highlight={doubt.has('paymentMethod')} value={f.paymentMethod} onChangeText={set('paymentMethod')} placeholder={L('Card, Cash, TNG eWallet…', '银行卡、现金、TNG 电子钱包…')} />

        <SectionTitle>{doubt.has('category') ? L('Category · please check', '类别 · 请检查') : L('Category', '类别')}</SectionTitle>
        <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, doubt.has('category') && { backgroundColor: DOUBT.bg, borderWidth: 1, borderColor: DOUBT.border, borderRadius: 12, padding: 8 }]}>
          {CATEGORIES.map((c) => <Chip key={c.key} icon={c.icon} iconColor={c.color} label={catLabel(c.key)} active={f.category === c.key} onPress={() => set('category')(c.key)} color={c.color} />)}
          <Chip icon="plus" label={L('New category', '新类别')} onPress={() => setCatEditor(true)} />
        </View>

        <SectionTitle>{L('Tags', '标签')}</SectionTitle>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
          {f.tags.map((t) => <Chip key={t} label={`#${t}  ✕`} active color={colors.info} onPress={() => set('tags')(f.tags.filter((x) => x !== t))} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput value={tagInput} onChangeText={setTagInput} onSubmitEditing={addTag} placeholder={L('Add tag (client, project, trip)', '添加标签（客户、项目、出差）')} placeholderTextColor={colors.faint} style={[s.input, { flex: 1 }]} autoCapitalize="none" />
          <Button title={L('Add', '添加')} small variant="secondary" onPress={addTag} />
        </View>

        <SectionTitle right={<Text style={[s.sub, doubt.has('lineItems') && { color: DOUBT.text, fontWeight: '700' }]}>{L('Items sum', '项目合计')} {money(itemsTotal, f.currency)}</Text>}>
          {doubt.has('lineItems') ? L("Line items · don't add up, please check", '明细项目 · 金额对不上，请检查') : L('Line items', '明细项目')}
        </SectionTitle>
        <View style={doubt.has('lineItems') ? { backgroundColor: DOUBT.bg, borderWidth: 1, borderColor: DOUBT.border, borderRadius: 12, padding: 8, paddingBottom: 0, marginBottom: 8 } : null}>
        {f.lineItems.map((it, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'center' }}>
            <TextInput value={it.description} onChangeText={(v) => setItem(i, 'description', v)} placeholder={L('Item', '项目')} placeholderTextColor={colors.faint} style={[s.input, { flex: 1, paddingVertical: 10 }]} />
            <TextInput value={it.qty} onChangeText={(v) => setItem(i, 'qty', v)} keyboardType="decimal-pad" style={[s.input, { width: 48, paddingVertical: 10, textAlign: 'center' }]} />
            <TextInput value={it.amount} onChangeText={(v) => setItem(i, 'amount', v)} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.faint} style={[s.input, { width: 84, paddingVertical: 10, textAlign: 'right' }]} />
            <Text style={{ color: colors.danger, fontSize: 18, paddingHorizontal: 4 }} onPress={() => set('lineItems')(f.lineItems.filter((_, idx) => idx !== i))}>✕</Text>
          </View>
        ))}
        </View>
        <Button title={L('Add line item', '添加明细项目')} icon="plus" variant="ghost" small onPress={() => set('lineItems')([...f.lineItems, { description: '', qty: '1', amount: '' }])} />

        <SectionTitle>{L('Notes', '备注')}</SectionTitle>
        <TextInput value={f.notes} onChangeText={set('notes')} placeholder={L('Business purpose, attendees…', '业务用途、参与人员…')} placeholderTextColor={colors.faint} style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]} multiline />

        <Button title={isNew ? L('Save receipt', '保存收据') : f.status === 'needs_review' ? L('Save & mark reviewed', '保存并标记为已审核') : L('Save changes', '保存更改')} onPress={save} style={{ marginTop: 20 }} />
      </ScrollView>

      </View>

      <CategoryEditor visible={catEditor} onClose={() => setCatEditor(false)} onCreated={(key) => set('category')(key)} />

      <Modal visible={zoom} transparent onRequestClose={() => setZoom(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }} onPress={() => setZoom(false)}>
          {src.imageUri && <Image source={{ uri: src.imageUri }} style={{ width: '100%', height: '85%' }} resizeMode="contain" />}
          <Text style={{ color: '#fff', textAlign: 'center', marginTop: 12 }}>{L('Tap to close', '点击关闭')}</Text>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}
