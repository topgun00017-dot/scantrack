// In-app replacement for Alert.alert on web.
import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { setDialogListener } from './platform';
import { colors, radius } from './theme';

export default function DialogHost() {
  const [d, setD] = useState(null);
  useEffect(() => {
    setDialogListener(setD);
    return () => setDialogListener(null);
  }, []);
  if (!d) return null;
  const close = (b) => {
    setD(null);
    b?.onPress?.();
  };
  return (
    <Modal transparent visible animationType="fade" onRequestClose={() => close(d.buttons.find((b) => b.style === 'cancel'))}>
      <View style={{ flex: 1, backgroundColor: '#000a', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '800' }}>{d.title}</Text>
          {!!d.message && <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, lineHeight: 20 }}>{d.message}</Text>}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            {d.buttons.map((b, i) => (
              <Pressable
                key={i}
                onPress={() => close(b)}
                style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: b.style === 'destructive' ? colors.danger : b.style === 'cancel' ? colors.surface2 : colors.accent }}
              >
                <Text style={{ color: b.style === 'cancel' ? colors.text : b.style === 'destructive' ? '#fff' : colors.accentText, fontWeight: '700' }}>{b.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}
