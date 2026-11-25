// "Add receipts" panel: scan with the camera, pick photos, or pick files (photos, HEIC or PDF)
// from anywhere on the phone. Shown in a pop-up from Receipts' "+ Add" and inline when a list is empty.
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { Icon } from './icons';
import { colors, radius } from './theme';
import { s } from './components';
import { openCamera, openFiles, openGallery } from './capture';

function Choice({ icon, label, hint, onPress, primary }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 6,
        borderRadius: radius.md,
        borderWidth: 1,
        backgroundColor: primary ? colors.accent : colors.surface,
        borderColor: primary ? colors.accent : colors.border,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Icon name={icon} size={24} color={primary ? colors.accentText : colors.accentInk} />
      <Text style={{ marginTop: 6, fontWeight: '800', color: primary ? colors.accentText : colors.text }}>{label}</Text>
      <Text style={{ marginTop: 2, fontSize: 11, color: primary ? colors.accentText : colors.muted, textAlign: 'center' }}>{hint}</Text>
    </Pressable>
  );
}

export function AddReceiptsPanel({ onPicked, style }) {
  const go = (fn) => () => {
    onPicked && onPicked();
    // let a surrounding pop-up close before the camera / picker opens
    setTimeout(fn, 150);
  };
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 18, alignItems: 'center' }, style]}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent + '26', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="upload" size={28} color={colors.accentInk} />
      </View>
      <Text style={[s.h2, { marginTop: 12 }]}>Add receipts</Text>
      <Text style={[s.sub, { textAlign: 'center', marginTop: 4 }]}>JPG, PNG, HEIC or PDF · pick up to 10 at once · photos are shrunk automatically</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, alignSelf: 'stretch' }}>
        <Choice primary icon="camera" label="Scan" hint="Camera" onPress={go(openCamera)} />
        <Choice icon="images" label="Photos" hint="Gallery" onPress={go(openGallery)} />
        <Choice icon="folder-open" label="Files" hint="PDF & images" onPress={go(openFiles)} />
      </View>
    </View>
  );
}

export function AddReceiptsSheet({ visible, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 }} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <AddReceiptsPanel onPicked={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// "+ Add" button for the Receipts header: a blinking arrow nudges towards it and the button gently
// pulses so it's easy to find.
export function AddButton({ onPress, hint }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!hint) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 550, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [hint]);
  const arrowX = t.interpolate({ inputRange: [0, 1], outputRange: [-8, 2] });
  const arrowOpacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.15, 1] });
  const pulse = t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {hint && (
        <Animated.View style={{ opacity: arrowOpacity, transform: [{ translateX: arrowX }] }}>
          <Icon name="arrow-right" size={28} color={colors.danger} strokeWidth={3} />
        </Animated.View>
      )}
      <Animated.View style={{ transform: [{ scale: hint ? pulse : 1 }] }}>
        <Pressable
          onPress={onPress}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, borderWidth: hint ? 2 : 0, borderColor: colors.accentInk }}
        >
          <Icon name="plus" size={16} color={colors.accentText} />
          <Text style={{ color: colors.accentText, fontWeight: '800' }}>Add</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
