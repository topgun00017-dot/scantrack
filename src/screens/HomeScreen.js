// Home: a grid of tiles — Today, Flagged, Inbox, then every list — plus "New list".
import React from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../icons';
import { colors, shadow } from '../theme';
import { useStore } from '../store';
import { useActions } from '../actions';
import { AddPill, RoundButton } from '../ui';
import { todayKey } from '../dates';

function Tile({ icon, color, title, count, onPress, onLongPress, dashed, width, alert }) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        { width, height: width * 0.86, borderRadius: 22, padding: 16, justifyContent: 'space-between', backgroundColor: dashed ? 'transparent' : colors.surface, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        dashed ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D1D1D6' } : shadow,
      ]}
    >
      <Icon name={icon} size={22} color={color} />
      <View>
        <Text style={{ fontSize: 15, fontWeight: '600', color: dashed ? colors.sub : colors.text }} numberOfLines={2}>{title}</Text>
        {count != null && (
          <Text style={{ fontSize: 12, color: alert ? colors.overdue : colors.sub, marginTop: 3 }}>
            {count} task{count === 1 ? '' : 's'}
            {alert ? ` · ${alert} overdue` : ''}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function HomeScreen({ nav }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { lists, tasks } = useStore();
  const { quickAdd, editList } = useActions();
  const tileW = (Math.min(width, 520) - 20 * 2 - 14) / 2;
  const t = todayKey();
  const open = tasks.filter((x) => !x.done);
  const todayCount = open.filter((x) => x.date && x.date <= t).length;
  const overdue = open.filter((x) => x.date && x.date < t).length;
  const flagged = open.filter((x) => x.flag).length;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 20, paddingTop: 8 }}>
        <RoundButton icon="search" onPress={() => nav.push('search')} />
        <RoundButton icon="calendar" onPress={() => nav.push('calendar')} />
        <RoundButton icon="settings" onPress={() => nav.push('settings')} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 110 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignSelf: 'center', width: tileW * 2 + 14 }}>
          <Tile width={tileW} icon="bookmark" color={colors.text} title="Today" count={todayCount} alert={overdue} onPress={() => nav.push('list', { kind: 'today' })} />
          <Tile width={tileW} icon="flag" color={colors.danger} title="Flagged" count={flagged} onPress={() => nav.push('list', { kind: 'flagged' })} />
          {lists.map((l) => (
            <Tile
              key={l.id}
              width={tileW}
              icon={l.icon}
              color={l.color}
              title={l.name}
              count={open.filter((x) => x.listId === l.id).length}
              onPress={() => nav.push('list', { kind: 'list', id: l.id })}
              onLongPress={() => editList(l)}
            />
          ))}
          <Tile width={tileW} icon="plus" color={colors.sub} title="New list" dashed onPress={() => editList(null)} />
        </View>
        <Text style={{ textAlign: 'center', color: colors.faint, fontSize: 12, marginTop: 18 }}>Press and hold a list to rename, recolour or delete it</Text>
      </ScrollView>
      <AddPill bottom={insets.bottom + 20} onPress={() => quickAdd({})} />
    </View>
  );
}
