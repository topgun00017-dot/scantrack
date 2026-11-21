// Assistant: ask in plain language to find, tag, categorise and reconcile receipts.
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../useKeyboard';
import React, { useRef, useState, useEffect } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useStore } from '../store';
import { agentTurn } from '../ai';
import { Chip, ChipRow, Header, s } from '../components';
import { colors, radius } from '../theme';
import { CATEGORY_KEYS } from '../categories';
import { byCategory, filterReceipts, findIssues, ISSUE_LABELS, money, rangeFor, sum } from '../utils';
import { L, catLabel } from '../i18n';

const SUGGESTIONS = () => [
  L('How much did I spend this month?', '这个月我花了多少钱？'),
  L('Find all Grab receipts', '查找所有 Grab 收据'),
  L('Tag the Penang hotel and flight as penang-trip', '把槟城的酒店和机票标记为 penang-trip'),
  L('Reconcile: any duplicates or problems?', '核对：有没有重复或问题？'),
  L('Move Mr DIY receipts to Office Supplies', '把 Mr DIY 的收据移到一般开支'),
];

const brief = (r) => ({ id: r.id, merchant: r.merchant, date: r.date, total: r.total, tax: r.tax, category: r.category, tags: r.tags, status: r.status });

export default function AgentScreen({ nav }) {
  const bottomInset = useSafeAreaInsets().bottom; // keep the message box above Android's navigation bar
  const keyboard = useKeyboardHeight(); // Android: lift content above the on-screen keyboard
  const { receipts, settings, updateMany, aiReady } = useStore();
  const [chat, setChat] = useState([
    { role: 'assistant', text: L("Hi! I can find receipts, tag and categorise them, total up spending and check your archive for duplicates or gaps. What do you need?", '你好！我可以帮你查找收据、添加标签和分类、统计开支，并检查档案中有没有重复或缺漏。需要什么帮助？') },
  ]);
  const [apiHistory, setApiHistory] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef(null);
  useEffect(() => {
    if (keyboard) setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [keyboard]);
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
      const bits = [a.category && `→ ${catLabel(a.category)}`, a.add_tags && `+#${a.add_tags.join(' #')}`, a.remove_tags && `−#${a.remove_tags.join(' #')}`, a.mark_reviewed && L('reviewed', '已审核')].filter(Boolean).join(L(', ', '，'));
      return { data: { updated: ids.length }, action: L(`Updated ${ids.length} receipt(s): ${bits}`, `已更新 ${ids.length} 张收据：${bits}`) };
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

  // Offline fallback when no API key is set: handles a few common requests (English or Chinese).
  const localAgent = (q) => {
    const t = q.toLowerCase();
    const period = /last month|上个月|上月/.test(t) ? 'last_month' : /this year|year|今年|年/.test(t) ? 'this_year' : /quarter|季度/.test(t) ? 'this_quarter' : /month|月/.test(t) ? 'this_month' : 'all';
    const periodName = { last_month: L('last month', '上个月'), this_year: L('this year', '今年'), this_quarter: L('this quarter', '本季度'), this_month: L('this month', '本月'), all: L('all', '全部时间') }[period];
    const r = rangeFor(period);
    if (/duplicate|reconcile|problem|issue|missing|重复|核对|问题|缺/.test(t)) {
      const all = findIssues(receipts);
      const issues = all.filter((i) => i.type !== 'no_image');
      const noImg = all.length - issues.length;
      const tail = noImg ? L(`\n\n${noImg} receipt(s) have no photo attached.`, `\n\n有 ${noImg} 张收据没有附照片。`) : '';
      if (!issues.length) return L(`All clear — no duplicates or gaps found.${tail}`, `一切正常，没有发现重复或缺漏。${tail}`);
      return L(`Found ${issues.length} item(s) to fix:\n`, `发现 ${issues.length} 个需要处理的项目：\n`) + issues.slice(0, 12).map((i) => `• ${ISSUE_LABELS[i.type]}: ${i.receipt.merchant}, ${i.receipt.date}, ${money(i.receipt.total, i.receipt.currency)}`).join('\n') + tail;
    }
    if (/spend|spent|total|how much|花|开支|总|多少/.test(t)) {
      const list = filterReceipts(receipts, r);
      const cats = byCategory(list).slice(0, 5).map((c) => `• ${catLabel(c.category)}: ${money(c.total, settings.currency)}`).join('\n');
      return L(`You spent ${money(sum(list), settings.currency)} across ${list.length} receipts (${periodName}).\n${cats}`, `${periodName}你在 ${list.length} 张收据上共花了 ${money(sum(list), settings.currency)}。\n${cats}`);
    }
    const m = t.match(/(?:find|show|search)\s+(?:all\s+)?(.+?)(?:\s+receipts?)?$/) || t.match(/(?:查找|搜索|显示|找)\s*(?:所有|全部)?\s*(.+?)\s*(?:的)?\s*(?:收据)?$/);
    if (m) {
      const list = filterReceipts(receipts, { query: m[1] });
      if (!list.length) return L(`No receipts match "${m[1]}".`, `没有与“${m[1]}”匹配的收据。`);
      return L(`${list.length} receipt(s), ${money(sum(list), settings.currency)}:\n`, `${list.length} 张收据，共 ${money(sum(list), settings.currency)}：\n`) + list.slice(0, 10).map((x) => `• ${x.date} ${x.merchant} ${money(x.total, x.currency)}`).join('\n');
    }
    return L(
      'Offline mode understands: "how much did I spend this month", "find <merchant>", and "reconcile". Add a Claude or ChatGPT API key in Settings for full tagging and categorising.',
      '离线模式可以理解：“这个月我花了多少钱”、“查找 <商家>”和“核对”。在设置中添加 Claude 或 ChatGPT API 密钥，即可使用完整的标记和分类功能。'
    );
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
        setApiHistory([...history, { role: 'assistant', content: res.text || L('Done.', '完成。') }].slice(-12));
        setChat((c) => [...c, ...res.actions.map((a) => ({ role: 'action', text: a })), { role: 'assistant', text: res.text || L('Done.', '完成。') }]);
      }
    } catch (e) {
      setChat((c) => [...c, { role: 'assistant', text: L(`Sorry, something went wrong: ${e.message}`, `抱歉，出错了：${e.message}`) }]);
      setApiHistory([]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, paddingBottom: Platform.OS === 'android' ? keyboard : 0 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Header title={L('Assistant', 'AI 助手')} onBack={nav.back} subtitle={aiReady ? L('Find · tag · categorise · reconcile', '查找 · 标记 · 分类 · 核对') : L('Offline mode — add API key for full power', '离线模式 — 添加 API 密钥以使用全部功能')} />
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
        ListFooterComponent={busy ? <Text style={[s.sub, { marginLeft: 4 }]}>{L('Thinking…', '思考中…')}</Text> : null}
      />
      {chat.length <= 2 && (
        <View style={{ paddingHorizontal: 16 }}>
          <ChipRow>{SUGGESTIONS().map((q) => <Chip key={q} label={q} onPress={() => send(q)} />)}</ChipRow>
        </View>
      )}
      <View style={{ flexDirection: 'row', padding: 12, paddingBottom: 12 + (keyboard ? 0 : bottomInset), gap: 8, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.bg }}>
        <TextInput value={input} onChangeText={setInput} onSubmitEditing={() => send()} placeholder={L('Ask about your receipts…', '问问关于收据的问题…')} placeholderTextColor={colors.faint} style={[s.input, { flex: 1 }]} returnKeyType="send" />
        <Pressable onPress={() => send()} disabled={busy} style={{ backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 16, justifyContent: 'center', opacity: busy ? 0.5 : 1 }}>
          <Text style={{ color: colors.accentText, fontWeight: '800', fontSize: 16 }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
