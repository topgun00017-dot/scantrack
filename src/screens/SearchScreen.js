// Search every task by title, note or link.
import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { Icon } from '../icons';
import { colors, shadow } from '../theme';
import { sortTasks, useStore } from '../store';
import { useActions } from '../actions';
import { RoundButton, TaskRow } from '../ui';

export default function SearchScreen({ nav }) {
  const { lists, tasks, toggleTask } = useStore();
  const { openTask } = useActions();
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const hits = s ? tasks.filter((t) => `${t.title} ${t.note} ${t.link}`.toLowerCase().includes(s)).sort(sortTasks) : [];

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 6 }}>
        <RoundButton icon="chevron-left" onPress={nav.back} />
        <View style={[{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 14, height: 42 }, shadow]}>
          <Icon name="search" size={18} color={colors.faint} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search tasks" placeholderTextColor={colors.faint} autoFocus style={{ flex: 1, fontSize: 15, color: colors.text }} />
        </View>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 12 }}>
        {hits.map((x) => (
          <TaskRow key={x.id} task={x} list={lists.find((l) => l.id === x.listId)} onPress={() => openTask(x)} onToggle={() => toggleTask(x.id)} />
        ))}
        {!!s && !hits.length && <Text style={{ color: colors.faint, textAlign: 'center', marginTop: 40 }}>No tasks match “{q.trim()}”.</Text>}
      </ScrollView>
    </View>
  );
}
