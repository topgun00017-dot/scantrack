// Calendar: month view with a dot on busy days; tap a day to see and add its tasks.
import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, shadow } from '../theme';
import { sortTasks, useStore } from '../store';
import { useActions } from '../actions';
import { AddPill, MonthCalendar, TaskRow, TopBar, toast } from '../ui';
import { DAYS_SHORT, MONTHS, fromKey, nextOccurrence, todayKey, toKey } from '../dates';

export default function CalendarScreen({ nav }) {
  const insets = useSafeAreaInsets();
  const { lists, tasks, settings, toggleTask } = useStore();
  const { openTask, quickAdd } = useActions();
  const [sel, setSel] = useState(todayKey());
  const [month, setMonth] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() });

  // Which days have tasks; repeating tasks are shown on their future dates too.
  const { marks, byDay } = useMemo(() => {
    const end = toKey(new Date(month.y, month.m + 2, 0));
    const byDay = {};
    const put = (k, t, repeatOnly) => ((byDay[k] = byDay[k] || []).push(repeatOnly ? { ...t, _ghost: true } : t));
    for (const t of tasks) {
      if (!t.date) continue;
      put(t.date, t);
      if (!t.done && t.repeat && t.repeat !== 'none') {
        let k = nextOccurrence(t.date, t.repeat);
        for (let i = 0; k && k <= end && i < 400; i++) {
          put(k, t, true);
          k = nextOccurrence(k, t.repeat);
        }
      }
    }
    const marks = {};
    Object.keys(byDay).forEach((k) => (marks[k] = byDay[k].some((x) => !x.done)));
    return { marks, byDay };
  }, [tasks, month]);

  const day = (byDay[sel] || []).sort(sortTasks);
  const d = fromKey(sel);
  const label = sel === todayKey() ? 'Today' : `${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;

  return (
    <View style={{ flex: 1 }}>
      <TopBar onBack={nav.back} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={[{ backgroundColor: colors.surface, borderRadius: 24, marginHorizontal: 16, marginTop: 6, padding: 14 }, shadow]}>
          <MonthCalendar month={month} setMonth={setMonth} selected={sel} onSelect={setSel} marks={marks} weekStart={settings.weekStart} />
        </View>
        <Text style={{ fontSize: 13, color: colors.sub, paddingHorizontal: 20, marginTop: 20, marginBottom: 4 }}>
          {label} · {day.filter((x) => !x.done).length} task{day.filter((x) => !x.done).length === 1 ? '' : 's'}
        </Text>
        {day.map((x, i) => (
          <TaskRow
            key={x.id + (x._ghost ? sel : '') + i}
            task={x._ghost ? { ...x, date: sel } : x}
            list={lists.find((l) => l.id === x.listId)}
            showDate={false}
            onPress={() => openTask(x)}
            onToggle={() => (x._ghost ? toast('You can tick this off on its day') : toggleTask(x.id))}
          />
        ))}
        {!day.length && <Text style={{ color: colors.faint, paddingHorizontal: 20, marginTop: 8 }}>Nothing planned for this day.</Text>}
      </ScrollView>
      <AddPill bottom={insets.bottom + 20} onPress={() => quickAdd({ date: sel })} />
    </View>
  );
}
