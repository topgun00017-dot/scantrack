// "New category" sheet: name, icon and colour for a category the user adds themselves.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useStore } from './store';
import { Button, s } from './components';
import { Icon } from './icons';
import { colors, radius } from './theme';
import { CUSTOM_COLORS, CUSTOM_ICONS } from './categories';

export default function CategoryEditor({ visible, onClose, onCreated }) {
  const { addCategory } = useStore();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(CUSTOM_ICONS[0]);
  const [color, setColor] = useState(CUSTOM_COLORS[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setName('');
      setIcon(CUSTOM_ICONS[0]);
      setColor(CUSTOM_COLORS[0]);
      setError('');
    }
  }, [visible]);

  const save = () => {
    try {
      const key = addCategory({ name, icon, color });
      onCreated?.(key);
      onClose();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 }} onPress={onClose}>
          <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16 }} onPress={() => {}}>
            <Text style={s.h2}>New category</Text>

            {/* preview */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, marginBottom: 12 }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: color + '26', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={icon} size={22} color={color} />
              </View>
              <TextInput
                value={name}
                onChangeText={(v) => {
                  setName(v);
                  setError('');
                }}
                placeholder="Category name, e.g. Medical"
                placeholderTextColor={colors.faint}
                maxLength={30}
                autoFocus
                style={[s.input, { flex: 1 }]}
                onSubmitEditing={save}
              />
            </View>
            {!!error && <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text>}

            <Text style={s.label}>Icon</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {CUSTOM_ICONS.map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setIcon(n)}
                  style={{ width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: icon === n ? color : 'transparent', backgroundColor: colors.surface2 }}
                >
                  <Icon name={n} size={20} color={icon === n ? color : colors.muted} />
                </Pressable>
              ))}
            </View>

            <Text style={s.label}>Colour</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
              {CUSTOM_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: color === c ? colors.text : 'transparent' }}
                >
                  {color === c && <Icon name="check" size={16} color="#fff" />}
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
              <Button small title="Add category" icon="plus" style={{ flex: 2 }} disabled={!name.trim()} onPress={save} />
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
