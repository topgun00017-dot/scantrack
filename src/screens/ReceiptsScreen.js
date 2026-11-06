// Organize receipts: search, filter, tag and bulk-export from one tidy archive.
import { showAlert } from '../platform';
import React, { useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { Button, Chip, ChipRow, Empty, Header, ReceiptRow, s } from '../components';
import { colors } from '../theme';
import { CATEGORIES } from '../categories';
import { allTags, filterReceipts, money, sum } from '../utils';

export default function ReceiptsScreen({ nav }) {
  const { receipts, updateMany, deleteReceipt, settings } = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(null);
  const [tag, setTag] = useState(null);
  const [onlyReview, setOnlyReview] = useState(false);
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState(null); // 'tag' | 'category'
  const [tagInput, setTagInput] = useState('');

  const tags = useMemo(() => allTags(receipts), [receipts]);
  const list = useMemo(
    () => filterReceipts(receipts, { query, category, tag, status: onlyReview ? 'needs_review' : null }),
    [receipts, query, category, tag, onlyReview]
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
        right={selecting ? <Text style={{ color: colors.accent, fontWeight: '700' }} onPress={() => setSelected([])}>Cancel</Text> : <Text style={{ color: colors.accent, fontWeight: '700' }} onPress={() => setSelected(list.map((r) => r.id))}>Select</Text>}
      />
      <View style={{ paddingHorizontal: 16 }}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="🔍  Search merchant, item, tag, amount…"
          placeholderTextColor={colors.faint}
          style={s.input}
        />
        <ChipRow>
          <Chip label="Needs review" active={onlyReview} onPress={() => setOnlyReview(!onlyReview)} color={colors.warning} />
          {CATEGORIES.map((c) => (
            <Chip key={c.key} label={`${c.icon} ${c.key}`} active={category === c.key} onPress={() => setCategory(category === c.key ? null : c.key)} />
          ))}
        </ChipRow>
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
                  <Chip key={c.key} label={`${c.icon} ${c.key}`} onPress={() => { updateMany(selected, () => ({ category: c.key })); setModal(null); setSelected([]); }} />
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
