// Quick add bar: type a title and press Enter, or tap a coloured button to add more details.
import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './icons';
import { colors, shadow } from './theme';
import { useStore } from './store';
import { toast, useKeyboardHeight } from './ui';

const BUTTONS = [
  { key: 'date', icon: 'calendar', color: '#4F7BE8' },
  { key: 'time', icon: 'bell', color: '#F08A24' },
  { key: 'repeat', icon: 'repeat', color: '#45B3C2' },
  { key: 'note', icon: 'file-text', color: '#D46BA6' },
];

export default function QuickAdd({ visible, defaults, onClose, onDetails }) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const { addTask } = useStore();
  const [title, setTitle] = useState('');
  const input = useRef(null);

  useEffect(() => {
    if (visible) setTitle('');
  }, [visible]);

  const add = () => {
    const t = title.trim();
    if (!t) return onClose();
    addTask({ ...defaults, title: t });
    setTitle('');
    toast('Task added');
    input.current?.focus(); // stay open to add the next one
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }} onPress={onClose} />
      <View style={[{ position: 'absolute', left: 12, right: 12, bottom: (kb || insets.bottom) + 12, backgroundColor: colors.surface, borderRadius: 22, padding: 12 }, shadow, { shadowOpacity: 0.15, elevation: 8 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.6, borderColor: colors.faint, marginLeft: 6 }} />
          <TextInput
            ref={input}
            value={title}
            onChangeText={setTitle}
            placeholder="New task"
            placeholderTextColor={colors.faint}
            autoFocus
            returnKeyType="done"
            submitBehavior="submit"
            blurOnSubmit={false}
            onSubmitEditing={add}
            style={{ flex: 1, fontSize: 16, color: colors.text, paddingVertical: 8 }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
          {BUTTONS.map((b) => (
            <Pressable key={b.key} onPress={() => onDetails({ ...defaults, title: title.trim() }, b.key)} style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, backgroundColor: b.color, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Icon name={b.icon} size={19} color="#fff" />
            </Pressable>
          ))}
          <View style={{ flex: 1 }} />
          <Pressable onPress={add} disabled={!title.trim()} style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, backgroundColor: title.trim() ? colors.accent : '#E3E3E8', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <Icon name="check" size={22} color="#fff" strokeWidth={2.6} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
