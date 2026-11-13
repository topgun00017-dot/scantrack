// Shared building blocks: header, checkbox, task row, bottom sheet, month calendar, dialogs.
import React, { useEffect, useState } from 'react';
import { Animated, BackHandler, Dimensions, Keyboard, Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './icons';
import { colors, shadow } from './theme';
import { DAYS_SHORT, MONTHS, friendlyDate, friendlyTime, fromKey, monthGrid, todayKey } from './dates';

// ---------- keyboard height (Android draws edge to edge, so the keyboard covers the screen)
export function useKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    const show = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    // Measure from the keyboard's top edge to the bottom of the screen: on Android (edge to edge)
    // the reported height leaves out the navigation bar under the keyboard.
    const a = Keyboard.addListener(show, (e) => {
      const c = e?.endCoordinates || {};
      const fromTop = c.screenY ? Dimensions.get('screen').height - c.screenY : 0;
      setH(Math.max(c.height || 0, fromTop));
    });
    const b = Keyboard.addListener(hide, () => setH(0));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return h;
}

// ---------- round icon button (top bars)
export function RoundButton({ icon, onPress, size = 40, color = colors.text, bg = colors.surface, style }) {
  return (
    <Pressable onPress={onPress} hitSlop={6} style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 }, bg !== 'transparent' && shadow, style]}>
      <Icon name={icon} size={Math.round(size * 0.48)} color={color} />
    </Pressable>
  );
}

// ---------- screen top bar: back on the left, actions on the right
export function TopBar({ onBack, right }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4, minHeight: 52 }}>
      {onBack ? <RoundButton icon="chevron-left" onPress={onBack} /> : <View />}
      <View style={{ flexDirection: 'row', gap: 10 }}>{right}</View>
    </View>
  );
}

// ---------- checkbox circle
export function Check({ done, color = colors.faint, onPress }) {
  return (
    <Pressable onPress={onPress} hitSlop={12} style={{ width: 22, height: 22, borderRadius: 11, borderWidth: done ? 0 : 1.6, borderColor: color, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
      {done && <Icon name="check" size={18} color={colors.faint} strokeWidth={2.2} />}
    </Pressable>
  );
}

// ---------- one task in a list
export function TaskRow({ task, list, showList = true, showDate = true, overdue, onPress, onToggle }) {
  const meta = [];
  const linkHost = task.link ? task.link.replace(/^https?:\/\//, '').split('/')[0] : '';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', gap: 14, paddingVertical: 11, paddingHorizontal: 20, backgroundColor: pressed ? '#EDEDF0' : 'transparent' })}>
      <Check done={task.done} onPress={onToggle} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: task.done ? colors.faint : colors.text, textDecorationLine: task.done ? 'line-through' : 'none' }}>{task.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
          {showList && list && <Text style={{ fontSize: 12, color: task.done ? colors.faint : list.color, fontWeight: '600' }}>{list.name}</Text>}
          {showDate && task.date && (
            <Text style={{ fontSize: 12, color: overdue && !task.done ? colors.overdue : colors.sub }}>
              {showList && list ? '· ' : ''}
              {friendlyDate(task.date)}
            </Text>
          )}
          {task.time && !task.done && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Icon name="bell" size={12} color="#E08A2C" />
              <Text style={{ fontSize: 12, color: colors.sub }}>{friendlyTime(task.time)}</Text>
            </View>
          )}
          {task.repeat && task.repeat !== 'none' && <Icon name="repeat" size={12} color="#2BA3B5" />}
          {!!task.note && <Icon name="file-text" size={12} color="#D9468F" />}
          {task.flag && !task.done && <Icon name="flag" size={12} color={colors.danger} />}
        </View>
        {!!linkHost && !task.done && (
          <View style={{ alignSelf: 'flex-start', backgroundColor: '#EDEDF0', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 }}>
            <Text style={{ fontSize: 12, color: colors.sub }}>{linkHost}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

// ---------- floating "Add new task" pill
export function AddPill({ onPress, bottom }) {
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom, alignItems: 'center' }}>
      <Pressable onPress={onPress} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20, opacity: pressed ? 0.7 : 1 }, shadow, { shadowOpacity: 0.12, elevation: 5 }]}>
        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={14} color="#fff" strokeWidth={2.6} />
        </View>
        <Text style={{ fontWeight: '600', color: colors.text }}>Add new task</Text>
      </Pressable>
    </View>
  );
}

// ---------- overlay drawn inside the app window (not a Modal): Android only reports the
// keyboard for the main window, so panels with text boxes must live there to dodge it.
export function Overlay({ visible, onClose, slide, children }) {
  const anim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible]);
  if (!visible) return null;
  return (
    <View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 100, elevation: 100 }}>
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.25)', opacity: anim }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', opacity: slide ? 1 : anim, transform: slide ? [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] : [] }}>
        {children}
      </Animated.View>
    </View>
  );
}

// ---------- bottom sheet
export function Sheet({ visible, onClose, title, children, footer, tall }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  return (
    <Overlay visible={visible} onClose={onClose} slide>
        <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '94%', marginTop: insets.top + 8, minHeight: tall ? '75%' : undefined, paddingBottom: (kb || insets.bottom) + 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: 18, paddingBottom: 8, paddingHorizontal: 56 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }} numberOfLines={1}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12} style={{ position: 'absolute', right: 18, top: 16 }}>
              <Icon name="x" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}>
            {children}
          </ScrollView>
          {footer}
        </View>
    </Overlay>
  );
}

// ---------- green pill button
export function PillButton({ title, onPress, color = colors.accent, disabled, style }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [{ alignSelf: 'center', backgroundColor: color, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 34, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 }, style]}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

// ---------- month calendar
export function MonthCalendar({ month, setMonth, selected, onSelect, marks = {}, weekStart = 1 }) {
  const { y, m } = month;
  const weeks = monthGrid(y, m, weekStart);
  const today = todayKey();
  const heads = [...Array(7)].map((_, i) => DAYS_SHORT[(i + weekStart) % 7].slice(0, 1));
  const shift = (n) => {
    const d = new Date(y, m + n, 1);
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Pressable onPress={() => shift(-1)} hitSlop={12} style={{ padding: 6 }}>
          <Icon name="chevron-left" size={20} color={colors.sub} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>
          {MONTHS[m]} {y !== new Date().getFullYear() ? y : ''}
        </Text>
        <Pressable onPress={() => shift(1)} hitSlop={12} style={{ padding: 6 }}>
          <Icon name="chevron-right" size={20} color={colors.sub} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row' }}>
        {heads.map((h, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 12, color: colors.faint, marginBottom: 6 }}>{h}</Text>
        ))}
      </View>
      {weeks.map((w, i) => (
        <View key={i} style={{ flexDirection: 'row' }}>
          {w.map((k, j) => {
            if (!k) return <View key={j} style={{ flex: 1, height: 44 }} />;
            const sel = k === selected;
            const isToday = k === today;
            const past = k < today;
            const dow = fromKey(k).getDay();
            return (
              <Pressable key={j} onPress={() => onSelect(k)} style={{ flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: sel ? colors.text : 'transparent' }}>
                  <Text style={{ fontSize: 14, fontWeight: isToday || sel ? '700' : '400', color: sel ? '#fff' : isToday ? colors.danger : past || dow === 0 || dow === 6 ? colors.faint : colors.text }}>{fromKey(k).getDate()}</Text>
                </View>
                {marks[k] && <View style={{ position: 'absolute', bottom: 2, width: 4, height: 4, borderRadius: 2, backgroundColor: sel ? colors.text : colors.sub }} />}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ---------- in-app dialogs (same look on the phone and the web preview)
let dialogFn = null;
export function showDialog(title, message, buttons = [{ text: 'OK' }]) {
  if (dialogFn) dialogFn({ title, message, buttons });
}

export function DialogHost() {
  const [d, setD] = useState(null);
  useEffect(() => {
    dialogFn = setD;
    return () => (dialogFn = null);
  }, []);
  if (!d) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setD(null)} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 22, width: '100%', maxWidth: 360 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{d.title}</Text>
          {!!d.message && <Text style={{ fontSize: 14, color: colors.sub, marginTop: 8, lineHeight: 20 }}>{d.message}</Text>}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            {d.buttons.map((b, i) => (
              <Pressable
                key={i}
                onPress={() => {
                  setD(null);
                  b.onPress && b.onPress();
                }}
                style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, backgroundColor: b.style === 'destructive' ? colors.danger : b.style === 'primary' ? colors.accent : '#EDEDF0', opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ fontWeight: '700', color: b.style === 'destructive' || b.style === 'primary' ? '#fff' : colors.text }}>{b.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------- small toast at the bottom ("Task added", "Undo")
let toastFn = null;
export function toast(text, action) {
  if (toastFn) toastFn({ text, action, at: Date.now() });
}
export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [t, setT] = useState(null);
  useEffect(() => {
    toastFn = setT;
    return () => (toastFn = null);
  }, []);
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(() => setT(null), 3200);
    return () => clearTimeout(h);
  }, [t]);
  if (!t) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 84, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#2C2C2E', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 }}>
        <Text style={{ color: '#fff', fontSize: 14 }}>{t.text}</Text>
        {t.action && (
          <Pressable
            onPress={() => {
              setT(null);
              t.action.onPress();
            }}
            hitSlop={10}
          >
            <Text style={{ color: '#A5D66B', fontWeight: '700' }}>{t.action.label}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
