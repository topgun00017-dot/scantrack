// Drag-to-reorder list: hold the ≡ handle and slide a task up or down; let go to drop it.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Text, View } from 'react-native';
import { Icon } from './icons';
import { colors } from './theme';

export const ROW = 58;

function Handle({ onStart, onMove, onEnd }) {
  const cbs = useRef({});
  cbs.current = { onStart, onMove, onEnd };
  const pr = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => cbs.current.onStart(),
      onPanResponderMove: (_, g) => cbs.current.onMove(g.dy),
      onPanResponderRelease: () => cbs.current.onEnd(),
      onPanResponderTerminate: () => cbs.current.onEnd(),
    })
  ).current;
  return (
    <View {...pr.panHandlers} hitSlop={8} style={{ width: 48, height: ROW, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="grip-vertical" size={20} color={colors.sub} />
    </View>
  );
}

// items: tasks in their current order. onDrop(ids) gets the new order. onDragging(bool) lets the
// parent stop scrolling while a task is held.
export default function DragList({ items, lists, onDrop, onDragging }) {
  const key = items.map((x) => x.id).join(',');
  const [ids, setIds] = useState(items.map((x) => x.id));
  const [drag, setDrag] = useState(null); // { id, from, dy }
  const dragRef = useRef(null);
  dragRef.current = drag;
  useEffect(() => {
    if (!dragRef.current) setIds(items.map((x) => x.id));
  }, [key]);

  const byId = Object.fromEntries(items.map((x) => [x.id, x]));
  const target = drag ? Math.max(0, Math.min(ids.length - 1, Math.round((drag.from * ROW + drag.dy) / ROW))) : -1;

  const slotOf = (i) => {
    if (!drag) return i;
    const { from } = drag;
    if (from < target && i > from && i <= target) return i - 1;
    if (from > target && i >= target && i < from) return i + 1;
    return i;
  };

  const start = (id) => {
    setDrag({ id, from: ids.indexOf(id), dy: 0 });
    onDragging && onDragging(true);
  };
  const move = (dy) => setDrag((d) => (d ? { ...d, dy } : d));
  const end = () => {
    const d = dragRef.current;
    if (!d) return;
    const to = Math.max(0, Math.min(ids.length - 1, Math.round((d.from * ROW + d.dy) / ROW)));
    const next = [...ids];
    const [moved] = next.splice(d.from, 1);
    next.splice(to, 0, moved);
    setIds(next);
    setDrag(null);
    onDragging && onDragging(false);
    if (to !== d.from) onDrop(next);
  };

  return (
    <View style={{ height: ids.length * ROW }}>
      {ids.map((id, i) => {
        const t = byId[id];
        if (!t) return null;
        const active = drag?.id === id;
        const top = active ? drag.from * ROW + drag.dy : slotOf(i) * ROW;
        const list = lists.find((l) => l.id === t.listId);
        return (
          <Animated.View
            key={id}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top,
              height: ROW,
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: active ? colors.surface : 'transparent',
              zIndex: active ? 10 : 1,
              elevation: active ? 6 : 0,
              shadowColor: '#000',
              shadowOpacity: active ? 0.15 : 0,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 3 },
              borderRadius: active ? 12 : 0,
              marginHorizontal: active ? 6 : 0,
            }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.6, borderColor: colors.faint, marginLeft: 20, marginRight: 14 }} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 15, color: colors.text }}>{t.title}</Text>
              {list && <Text numberOfLines={1} style={{ fontSize: 12, color: list.color, fontWeight: '600', marginTop: 2 }}>{list.name}</Text>}
            </View>
            <Handle onStart={() => start(id)} onMove={move} onEnd={end} />
          </Animated.View>
        );
      })}
    </View>
  );
}
