// Organize receipts: search, filter, tag and bulk-export from one tidy archive.
import { showAlert } from '../platform';
import { Icon } from '../icons';
import CompanySwitcher from '../CompanySwitcher';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { Button, Chip, ChipRow, Empty, Header, ReceiptRow, s } from '../components';
import { colors } from '../theme';
import { CATEGORIES } from '../categories';
import { allTags, filterReceipts, money, sum } from '../utils';

const byName = (a, b) => (a.merchant || '').localeCompare(b.merchant || '', undefined, { sensitivity: 'base' }) || (a.date < b.date ? 1 : -1);
const SORTS = [
  { key: 'az', label: 'Shop name A–Z', short: 'A–Z', fn: byName },
  { key: 'za', label: 'Shop name Z–A', short: 'Z–A', fn: (a, b) => byName(b, a) },
  { key: 'newest', label: 'Newest first', short: 'Newest', fn: (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)) },
  { key: 'oldest', label: 'Oldest first', short: 'Oldest', fn: (a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : (a.createdAt || 0) - (b.createdAt || 0)) },
  { key: 'amount', label: 'Highest amount', short: 'Amount', fn: (a, b) => (Number(b.total) || 0) - (Number(a.total) || 0) },
];

export default function ReceiptsScreen({ nav }) {
  const { receipts, updateMany, deleteReceipt, settings, setSettings } = useStore();
  const sortBy = SORTS.find((x) => x.key === settings.receiptSort) || SORTS[0];
  const [sortOpen, setSortOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [tag, setTag] = useState(null);
  const [onlyReview, setOnlyReview] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState(null); // 'tag' | 'category'
  const [tagInput, setTagInput] = useState('');

  const tags = useMemo(() => allTags(receipts), [receipts]);
  const list = useMemo(
    () => [...filterReceipts(receipts, { query, category, tag, status: onlyReview ? 'needs_review' : null })].sort(sortBy.fn),
    [receipts, query, category, tag, onlyReview, sortBy]
  );
  const selecting = selected.length > 0;
  const toggle = (id) => setSelected((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));

  const applyTag = () => {
    const t = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (t) updateMany(selected, (r) => ({ tags: [...new Set([...(r.tags || []), t])] }));
    setTagInput('');
    setModal(null);
    setSelected([]);
  };

  const bulkDelete = () =>
    showAlert('Delete receipts', `Delete ${selected.length} receipt(s)? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { selected.forEach(deleteReceipt); setSelected([]); } },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <Header
        title="Receipts"
        subtitle={`${list.length} shown · ${money(sum(list), settings.currency)}`}
        right={selecting ? <Text style={{ color: colors.accentInk, fontWeight: '700' }} onPress={() => setSelected([])}>Cancel</Text> : <Text style={{ color: colors.accentInk, fontWeight: '700' }} onPress={() => setSelected(list.map((r) => r.id))}>Select</Text>}
      />
      <View style={{ paddingHorizontal: 16 }}>
        <CompanySwitcher onManage={() => nav.push('settings')} style={{ marginBottom: 10 }} />
        <View style={{ justifyContent: 'center' }}>
          <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search merchant, item, tag, amount…"
          placeholderTextColor={colors.faint}
          style={[s.input, { paddingLeft: 42 }]}
        />
          <View pointerEvents="none" style={{ position: 'absolute', left: 14 }}><Icon name="search" size={18} color={colors.faint} /></View>
        </View>
        {/* category drop-down (All / Needs review / each category) and sort */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        {(() => {
          const m = CATEGORIES.find((c) => c.key === category);
          return (
            <Pressable
              onPress={() => setCatOpen(true)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: category || onlyReview ? colors.accent : colors.border, paddingVertical: 12, paddingHorizontal: 14, flex: 1, opacity: pressed ? 0.7 : 1 })}
            >
              <Icon name={m ? m.icon : onlyReview ? 'alert' : 'shapes'} size={18} color={m ? m.color : onlyReview ? colors.warning : colors.accentInk} />
              <Text style={[s.sub, { fontSize: 13 }]}>Category</Text>
              <Text style={[s.body, { flex: 1, fontWeight: '700' }]} numberOfLines={1}>{m ? m.key : onlyReview ? 'Needs review' : 'All'}</Text>
              <Icon name="chevron-down" size={18} color={colors.muted} />
            </Pressable>
          );
        })()}
          <Pressable
            onPress={() => setSortOpen(true)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={[s.body, { fontWeight: '700' }]}>{sortBy.short}</Text>
            <Icon name="chevron-down" size={16} color={colors.muted} />
          </Pressable>
        </View>
        <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }} onPress={() => setSortOpen(false)}>
            <Pressable style={{ backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 8 }} onPress={() => {}}>
              <Text style={[s.h2, { paddingHorizontal: 16, paddingVertical: 10 }]}>Sort receipts</Text>
              {SORTS.map((o) => (
                <Pressable
                  key={o.key}
                  onPress={() => { setSettings({ receiptSort: o.key }); setSortOpen(false); }}
                  style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, backgroundColor: sortBy.key === o.key ? colors.surface2 : pressed ? colors.bg : 'transparent' })}
                >
                  <Text style={[s.body, { flex: 1, fontWeight: sortBy.key === o.key ? '700' : '400' }]}>{o.label}</Text>
                  {sortBy.key === o.key && <Icon name="check" size={18} color={colors.accentInk} />}
                </Pressable>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
        <Modal visible={catOpen} transparent animationType="fade" onRequestClose={() => setCatOpen(false)}>
          <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }} onPress={() => setCatOpen(false)}>
            <Pressable style={{ backgroundColor: colors.surface, borderRadius: 18, paddingVertical: 8, maxHeight: '80%' }} onPress={() => {}}>
              <Text style={[s.h2, { paddingHorizontal: 16, paddingVertical: 10 }]}>Show receipts</Text>
              <ScrollView>
                {[
                  { key: 'all', label: 'All', icon: 'shapes', color: colors.accentInk, on: !category && !onlyReview, count: receipts.length, pick: () => { setCategory(null); setOnlyReview(false); } },
                  { key: 'review', label: 'Needs review', icon: 'alert', color: colors.warning, on: onlyReview, count: receipts.filter((r) => r.status === 'needs_review').length, pick: () => { setCategory(null); setOnlyReview(true); } },
                  ...[...CATEGORIES].sort((a, b) => (a.key === 'Others') - (b.key === 'Others') || a.key.localeCompare(b.key)).map((c) => ({ key: c.key, label: c.key, icon: c.icon, color: c.color, on: category === c.key, count: receipts.filter((r) => r.category === c.key).length, pick: () => { setCategory(c.key); setOnlyReview(false); } })),
                ].map((o) => (
                  <Pressable
                    key={o.key}
                    onPress={() => { o.pick(); setCatOpen(false); }}
                    style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: o.on ? colors.surface2 : pressed ? colors.bg : 'transparent' })}
                  >
                    <Icon name={o.icon} size={20} color={o.color} />
                    <Text style={[s.body, { flex: 1, fontWeight: o.on ? '700' : '400' }]}>{o.label}</Text>
                    <Text style={s.sub}>{o.count}</Text>
                    {o.on ? <Icon name="check" size={18} color={colors.accentInk} /> : <View style={{ width: 18 }} />}
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
        {tags.length > 0 && (
          <ChipRow>
            {tags.map((t) => <Chip key={t} label={`#${t}`} active={tag === t} onPress={() => setTag(tag === t ? null : t)} color={colors.info} />)}
          </ChipRow>
        )}
      </View>

      <FlatList
        data={list}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, paddingBottom: selecting ? 120 : 24 }}
        ListEmptyComponent={<Empty title="No receipts found" text="Try a different search or filter." />}
        renderItem={({ item }) => (
          <ReceiptRow
            r={item}
            selected={selected.includes(item.id)}
            onPress={() => (selecting ? toggle(item.id) : nav.push('receipt', { id: item.id }))}
            onLongPress={() => toggle(item.id)}
          />
        )}
      />

      {selecting && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, padding: 12 }}>
          <Text style={[s.sub, { marginBottom: 8 }]}>{selected.length} selected · {money(sum(receipts.filter((r) => selected.includes(r.id))), settings.currency)}</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small title="Tag" icon="#" variant="secondary" style={{ flex: 1 }} onPress={() => setModal('tag')} />
            <Button small title="Category" variant="secondary" style={{ flex: 1 }} onPress={() => setModal('category')} />
            <Button small title="Export" variant="secondary" style={{ flex: 1 }} onPress={() => { const ids = selected; setSelected([]); nav.push('export', { ids }); }} />
            <Button small title="Delete" variant="danger" style={{ flex: 1 }} onPress={bulkDelete} />
          </View>
        </View>
      )}

      <Modal visible={!!modal} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0009' }} onPress={() => setModal(null)} />
        <View style={{ backgroundColor: colors.surface, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
          {modal === 'tag' && (
            <>
              <Text style={[s.h2, { marginBottom: 12 }]}>Add tag to {selected.length} receipt(s)</Text>
              <TextInput autoFocus value={tagInput} onChangeText={setTagInput} placeholder="e.g. client-abc, penang-trip" placeholderTextColor={colors.faint} style={s.input} onSubmitEditing={applyTag} autoCapitalize="none" />
              {tags.length > 0 && <ChipRow>{tags.map((t) => <Chip key={t} label={`#${t}`} onPress={() => setTagInput(t)} />)}</ChipRow>}
              <Button title="Apply tag" onPress={applyTag} style={{ marginTop: 12 }} />
            </>
          )}
          {modal === 'category' && (
            <>
              <Text style={[s.h2, { marginBottom: 12 }]}>Set category</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CATEGORIES.map((c) => (
                  <Chip key={c.key} icon={c.icon} iconColor={c.color} label={c.key} onPress={() => { updateMany(selected, () => ({ category: c.key })); setModal(null); setSelected([]); }} />
                ))}
              </View>
            </>
          )}
          <View style={{ height: 24 }} />
        </View>
      </Modal>
    </View>
  );
}
