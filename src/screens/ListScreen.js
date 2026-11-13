// One list (or Today / Flagged): Overdue, Today, Upcoming, No date and Completed sections.
import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../icons';
import { colors } from '../theme';
import { INBOX, sortTasks, useStore } from '../store';
import { useActions } from '../actions';
import { AddPill, RoundButton, Sheet, TaskRow, TopBar, showDialog, toast } from '../ui';
import { todayKey } from '../dates';

function Section({ title, color = colors.text, right, children, count }) {
  if (!count) return null;
  return (
    <View style={{ marginTop: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 2 }}>
        <Text style={{ fontSize: 14, fontWeight: '600', color }}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}

const Link = ({ label, onPress }) => (
  <Pressable onPress={onPress} hitSlop={8}>
    <Text style={{ fontSize: 13, color: colors.text }}>{label}</Text>
  </Pressable>
);

export default function ListScreen({ nav, params }) {
  const insets = useSafeAreaInsets();
  const { lists, tasks, settings, setSettings, toggleTask, moveTasks, clearCompleted } = useStore();
  const { openTask, quickAdd, editList } = useActions();
  const [hideOverdue, setHideOverdue] = useState(false);
  const [menu, setMenu] = useState(false);
  const t = todayKey();

  const list = params.kind === 'list' ? lists.find((l) => l.id === params.id) : null;
  if (params.kind === 'list' && !list) {
    return (
      <View style={{ flex: 1 }}>
        <TopBar onBack={nav.back} />
        <Text style={{ padding: 20, color: colors.sub }}>This list was deleted.</Text>
      </View>
    );
  }
  const head =
    params.kind === 'today'
      ? { title: 'Today', icon: 'bookmark', color: colors.text }
      : params.kind === 'flagged'
      ? { title: 'Flagged', icon: 'flag', color: colors.danger }
      : { title: list.name, icon: list.icon, color: list.color };

  const doneToday = (x) => !!x.doneAt && new Date(x.doneAt).toDateString() === new Date().toDateString();
  const inView = (x) => (params.kind === 'today' ? (x.done ? doneToday(x) : !!x.date && x.date <= t) : params.kind === 'flagged' ? x.flag : x.listId === list.id);
  const mine = tasks.filter(inView).sort(sortTasks);
  const open = mine.filter((x) => !x.done);
  const done = mine.filter((x) => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const overdue = open.filter((x) => x.date && x.date < t);
  const today = open.filter((x) => x.date === t);
  const upcoming = open.filter((x) => x.date && x.date > t);
  const noDate = open.filter((x) => !x.date);
  const showList = params.kind !== 'list';
  const listOf = (x) => lists.find((l) => l.id === x.listId);

  const tick = (x) => {
    toggleTask(x.id);
    if (x.done) return;
    if (x.repeat && x.repeat !== 'none' && x.date) toast('Done · next one is on its new date');
    else toast('Completed', { label: 'Undo', onPress: () => toggleTask(x.id) });
  };
  const row = (x, extra = {}) => <TaskRow key={x.id} task={x} list={listOf(x)} showList={showList} onPress={() => openTask(x)} onToggle={() => tick(x)} {...extra} />;
  const defaults = params.kind === 'today' ? { date: t } : params.kind === 'flagged' ? { flag: true } : { listId: list.id };

  return (
    <View style={{ flex: 1 }}>
      <TopBar onBack={nav.back} right={<RoundButton icon="ellipsis-vertical" onPress={() => setMenu(true)} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name={head.icon} size={24} color={head.color} />
            <Text style={{ fontSize: 26, fontWeight: '600', color: colors.text, flexShrink: 1 }}>{head.title}</Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.sub, marginTop: 4 }}>
            {open.length} task{open.length === 1 ? '' : 's'}
          </Text>
        </View>

        <Section
          title="Overdue"
          color={colors.overdue}
          count={overdue.length}
          right={
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <Link label={hideOverdue ? `Show (${overdue.length})` : 'Hide'} onPress={() => setHideOverdue((h) => !h)} />
              <Text style={{ color: colors.faint }}>•</Text>
              <Link
                label="Reschedule"
                onPress={() =>
                  showDialog('Move overdue tasks?', `Move ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''} to today.`, [
                    { text: 'Cancel' },
                    { text: 'Move to today', style: 'primary', onPress: () => (moveTasks(overdue.map((x) => x.id), t), toast('Moved to today')) },
                  ])
                }
              />
            </View>
          }
        >
          {!hideOverdue && overdue.map((x) => row(x, { overdue: true }))}
        </Section>

        <Section title="Today" count={today.length}>{today.map((x) => row(x, { showDate: false }))}</Section>
        <Section title="Upcoming" count={upcoming.length}>{upcoming.map((x) => row(x))}</Section>
        <Section title={params.kind === 'list' && list.id !== INBOX && !today.length && !upcoming.length && !overdue.length ? 'Tasks' : 'No date'} count={noDate.length}>{noDate.map((x) => row(x))}</Section>
        {settings.showCompleted && (
          <Section title="Completed" color={colors.sub} count={done.length} right={<Link label="Clear" onPress={() => clearCompleted(inView)} />}>
            {done.slice(0, 50).map((x) => row(x))}
          </Section>
        )}

        {!open.length && (
          <View style={{ alignItems: 'center', marginTop: 70, paddingHorizontal: 40 }}>
            <Icon name="calendar-check" size={40} color={colors.faint} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 12 }}>All clear</Text>
            <Text style={{ fontSize: 14, color: colors.sub, textAlign: 'center', marginTop: 4 }}>Nothing to do here. Tap “Add new task” to plan something.</Text>
          </View>
        )}
      </ScrollView>
      <AddPill bottom={insets.bottom + 20} onPress={() => quickAdd(defaults)} />

      <Sheet visible={menu} onClose={() => setMenu(false)} title={head.title}>
        {list && (
          <MenuItem icon="pencil" label={list.system ? 'Change icon and colour' : 'Edit list'} onPress={() => (setMenu(false), editList(list, nav.back))} />
        )}
        <MenuItem icon={settings.showCompleted ? 'eye-off' : 'eye'} label={settings.showCompleted ? 'Hide completed tasks' : 'Show completed tasks'} onPress={() => (setSettings({ showCompleted: !settings.showCompleted }), setMenu(false))} />
        {!!overdue.length && <MenuItem icon="calendar-clock" label="Move overdue to today" onPress={() => (moveTasks(overdue.map((x) => x.id), t), setMenu(false), toast('Moved to today'))} />}
        {!!done.length && <MenuItem icon="trash" label={`Clear ${done.length} completed`} color={colors.danger} onPress={() => (clearCompleted(inView), setMenu(false))} />}
        <View style={{ height: 10 }} />
      </Sheet>
    </View>
  );
}

function MenuItem({ icon, label, onPress, color = colors.text }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}>
      <Icon name={icon} size={20} color={color} />
      <Text style={{ fontSize: 15, color }}>{label}</Text>
    </Pressable>
  );
}
