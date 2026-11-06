// Assistant: ask in plain language to find, tag, categorise and reconcile receipts.
import React, { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { agentTurn } from '../ai';
import { Chip, ChipRow, Header, s } from '../components';
import { colors, radius } from '../theme';
import { CATEGORY_KEYS } from '../categories';
import { byCategory, filterReceipts, findIssues, ISSUE_LABELS, money, rangeFor, sum } from '../utils';

const SUGGESTIONS = [
  'How much did I spend this month?',
  'Find all Grab receipts',
  'Tag the Penang hotel and flight as penang-trip',
  'Reconcile: any duplicates or problems?',
  'Move Mr DIY receipts to Office Supplies',
];

const brief = (r) => ({ id: r.id, merchant: r.merchant, date: r.date, total: r.total, tax: r.tax, category: r.category, tags: r.tags, status: r.status });

export default function AgentScreen({ nav }) {
  const { receipts, settings, updateMany, aiReady } = useStore();
  const [chat, setChat] = useState([
    { role: 'assistant', text: "Hi! I can find receipts, tag and categorise them, total up spending and check your archive for duplicates or gaps. What do you need?" },
  ]);
  const [apiHistory, setApiHistory] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  const work = useRef(receipts);

  // Tools run against a working copy so several calls in one turn see each other's changes.
  const runTool = (name, a) => {
    const list = work.current;
    if (name === 'search_receipts') {
      const found = filterReceipts(list, a);
      return { data: { count: found.length, total: +sum(found).toFixed(2), receipts: found.slice(0, 40).map(brief) } };
    }
    if (name === 'update_receipts') {
      const ids = (a.ids || []).filter((id) => list.some((r) => r.id === id));
      const patch = (r) => {
        const p = {};
        if (a.category && CATEGORY_KEYS.includes(a.category)) p.category = a.category;
        let tags = r.tags || [];
        if (a.add_tags) tags = [...new Set([...tags, ...a.add_tags.map((t) => t.toLowerCase().replace(/^#/, ''))])];
        if (a.remove_tags) tags = tags.filter((t) => !a.remove_tags.includes(t));
        p.tags = tags;
        if (a.mark_reviewed) p.status = 'processed';
        return p;
      };
      work.current = list.map((r) => (ids.includes(r.id) ? { ...r, ...patch(r) } : r));
      updateMany(ids, patch);
      const bits = [a.category && `→ ${a.category}`, a.add_tags && `+#${a.add_tags.join(' #')}`, a.remove_tags && `−#${a.remove_tags.join(' #')}`, a.mark_reviewed && 'reviewed'].filter(Boolean).join(', ');
      return { data: { updated: ids.length }, action: `Updated ${ids.length} receipt(s): ${bits}` };
    }
    if (name === 'spending_summary') {
      const found = filterReceipts(list, a);
      return { data: { total: +sum(found).toFixed(2), tax: +sum(found, 'tax').toFixed(2), count: found.length, by_category: byCategory(found).map((c) => ({ ...c, total: +c.total.toFixed(2) })) } };
    }
    if (name === 'reconcile') {
      const issues = findIssues(filterReceipts(list, a));
      return { data: { issue_count: issues.length, issues: issues.slice(0, 40).map((i) => ({ type: i.type, receipt: brief(i.receipt), duplicate_of: i.otherId })) } };
    }
    throw new Error('Unknown tool');
  };

  // Offline fallback when no API key is set: handles a few common requests.
  const localAgent = (q) => {
    const t = q.toLowerCase();
    const period = /last month/.test(t) ? 'last_month' : /this year|year/.test(t) ? 'this_year' : /quarter/.test(t) ? 'this_quarter' : /month/.test(t) ? 'this_month' : 'all';
    const r = rangeFor(period);
    if (/duplicate|reconcile|problem|issue|missing/.test(t)) {
      const all = findIssues(receipts);
      const issues = all.filter((i) => i.type !== 'no_image');
      const noImg = all.length - issues.length;
      const tail = noImg ? `\n\n${noImg} receipt(s) have no photo attached.` : '';
      if (!issues.length) return `All clear — no duplicates or gaps found.${tail}`;
      return `Found ${issues.length} item(s) to fix:\n` + issues.slice(0, 12).map((i) => `• ${ISSUE_LABELS[i.type]}: ${i.receipt.merchant}, ${i.receipt.date}, ${money(i.receipt.total, i.receipt.currency)}`).join('\n') + tail;
    }
    if (/spend|spent|total|how much/.test(t)) {
      const list = filterReceipts(receipts, r);
      const cats = byCategory(list).slice(0, 5).map((c) => `• ${c.category}: ${money(c.total, settings.currency)}`).join('\n');
      return `You spent ${money(sum(list), settings.currency)} across ${list.length} receipts (${period.replace('_', ' ')}).\n${cats}`;
    }
    const m = t.match(/(?:find|show|search)\s+(?:all\s+)?(.+?)(?:\s+receipts?)?$/);
    if (m) {
      const list = filterReceipts(receipts, { query: m[1] });
      if (!list.length) return `No receipts match "${m[1]}".`;
      return `${list.length} receipt(s), ${money(sum(list), settings.currency)}:\n` + list.slice(0, 10).map((x) => `• ${x.date} ${x.merchant} ${money(x.total, x.currency)}`).join('\n');
    }
    return 'Offline mode understands: "how much did I spend this month", "find <merchant>", and "reconcile". Add a Claude or ChatGPT API key in Settings for full tagging and categorising.';
  };

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setInput('');
    setChat((c) => [...c, { role: 'user', text: q }]);
    setBusy(true);
    work.current = receipts;
    try {
      if (!aiReady) {
        setChat((c) => [...c, { role: 'assistant', text: localAgent(q) }]);
      } else {
        const history = [...apiHistory, { role: 'user', content: q }];
        const res = await agentTurn(settings, history, runTool);
        // Keep only plain-text turns as memory so trimming never splits a tool call from its result.
        setApiHistory([...history, { role: 'assistant', content: res.text || 'Done.' }].slice(-12));
        setChat((c) => [...c, ...res.actions.map((a) => ({ role: 'action', text: a })), { role: 'assistant', text: res.text || 'Done.' }]);
      }
    } catch (e) {
      setChat((c) => [...c, { role: 'assistant', text: `Sorry, something went wrong: ${e.message}` }]);
      setApiHistory([]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Header title="Assistant" subtitle={aiReady ? 'Find · tag · categorise · reconcile' : 'Offline mode — add API key for full power'} />
      <FlatList
        ref={listRef}
        data={chat}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          if (item.role === 'action') {
            return <Text style={{ color: colors.success, fontSize: 12, marginBottom: 8, marginLeft: 4 }}>✓ {item.text}</Text>;
          }
          const mine = item.role === 'user';
          return (
            <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '85%', backgroundColor: mine ? colors.accent : colors.surface, borderRadius: radius.lg, padding: 12, marginBottom: 8, borderWidth: mine ? 0 : 1, borderColor: colors.border }}>
              <Text style={{ color: mine ? colors.accentText : colors.text, fontSize: 15, lineHeight: 21 }}>{item.text}</Text>
            </View>
          );
        }}
        ListFooterComponent={busy ? <Text style={[s.sub, { marginLeft: 4 }]}>Thinking…</Text> : null}
      />
      {chat.length <= 2 && (
        <View style={{ paddingHorizontal: 16 }}>
          <ChipRow>{SUGGESTIONS.map((q) => <Chip key={q} label={q} onPress={() => send(q)} />)}</ChipRow>
        </View>
      )}
      <View style={{ flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.bg }}>
        <TextInput value={input} onChangeText={setInput} onSubmitEditing={() => send()} placeholder="Ask about your receipts…" placeholderTextColor={colors.faint} style={[s.input, { flex: 1 }]} returnKeyType="send" />
        <Pressable onPress={() => send()} disabled={busy} style={{ backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 16, justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
          <Text style={{ color: colors.accentText, fontWeight: '800', fontSize: 16 }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
