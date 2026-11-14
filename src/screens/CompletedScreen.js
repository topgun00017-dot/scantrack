// Completed folder: every finished task, newest first, grouped by the day it was done.
// Completed tasks are only ever removed from here, with the "Clear all" button.
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../icons';
import { colors, shadow } from '../theme';
import { useStore } from '../store';
import { useActions } from '../actions';
import { TaskRow, TopBar, showDialog, toast } from '../ui';
import { friendlyDate, toKey } from '../dates';

export default function CompletedScreen({ nav }) {
  const insets = useSafeAreaInsets();
  const { lists, tasks, toggleTask, clearCompleted } = useStore();
  const { openTask } = useActions();
  const done = tasks.filter((x) => x.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));

  // Group by the day each task was ticked off.
  const groups = [];
  for (const x of done) {
    const day = x.doneAt ? toKey(new Date(x.doneAt)) : '';
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(x);
    else groups.push({ day, items: [x] });
  }
  const label = (day) => (!day ? 'Earlier' : friendlyDate(day).replace(/^./, (c) => c.toUpperCase()));

  const restore = (x) => {
    toggleTask(x.id);
    toast('Moved back to your tasks', { label: 'Undo', onPress: () => toggleTask(x.id) });
  };
  const clearAll = () =>
    showDialog('Clear all completed tasks?', `${done.length} completed task${done.length === 1 ? '' : 's'} will be deleted. This cannot be undone.`, [
      { text: 'Cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: () => {
          clearCompleted(() => true);
          toast('Completed tasks cleared');
        },
      },
    ]);

  return (
    <View style={{ flex: 1 }}>
      <TopBar onBack={nav.back} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 110 }}>
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="folder-check" size={24} color={colors.accentDark} />
            <Text style={{ fontSize: 26, fontWeight: '600', color: colors.text }}>Completed</Text>
          </View>
          <Text style={{ fontSize: 13, color: colors.sub, marginTop: 4 }}>
            {done.length} completed task{done.length === 1 ? '' : 's'}{done.length ? ' · tap a circle to bring one back' : ''}
          </Text>
        </View>

        {groups.map((g) => (
          <View key={g.day || 'earlier'} style={{ marginTop: 18 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: colors.sub, paddingHorizontal: 20, marginBottom: 2 }}>{label(g.day)}</Text>
            {g.items.map((x) => (
              <TaskRow key={x.id} task={x} list={lists.find((l) => l.id === x.listId)} showDate={false} onPress={() => openTask(x)} onToggle={() => restore(x)} />
            ))}
          </View>
        ))}

        {!done.length && (
          <View style={{ alignItems: 'center', marginTop: 90, paddingHorizontal: 40 }}>
            <Icon name="folder-check" size={42} color={colors.faint} />
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text, marginTop: 12 }}>No completed tasks</Text>
            <Text style={{ fontSize: 14, color: colors.sub, textAlign: 'center', marginTop: 4 }}>Tasks you tick off are kept here until you clear them.</Text>
          </View>
        )}
      </ScrollView>

      {!!done.length && (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 20, alignItems: 'center' }}>
          <Pressable onPress={clearAll} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20, opacity: pressed ? 0.7 : 1 }, shadow, { shadowOpacity: 0.12, elevation: 5 }]}>
            <Icon name="trash" size={18} color={colors.danger} />
            <Text style={{ fontWeight: '700', color: colors.danger }}>Clear all completed</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
