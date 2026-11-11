// Small confirmation banner ("Receipt saved") that slides up for a moment, then fades away.
// Call showToast({ title, text }) from anywhere; <ToastHost /> is mounted once in App.js.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from './icons';
import { colors, radius } from './theme';

let listener = null;
export function showToast(t) {
  listener?.(typeof t === 'string' ? { title: t } : t);
}

export default function ToastHost() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef(null);

  useEffect(() => {
    listener = (t) => {
      clearTimeout(timer.current);
      setToast({ ...t, id: Date.now() });
      anim.setValue(0);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
      }, 2600);
    };
    return () => {
      listener = null;
      clearTimeout(timer.current);
    };
  }, [anim]);

  if (!toast) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 84, alignItems: 'center' }}>
      <Animated.View
        style={{
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          maxWidth: 420,
          width: '100%',
          backgroundColor: colors.text,
          borderRadius: radius.lg,
          paddingVertical: 12,
          paddingHorizontal: 14,
          shadowColor: '#000',
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 6,
        }}
      >
        <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="check" size={18} color="#fff" strokeWidth={3} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>{toast.title}</Text>
          {!!toast.text && (
            <Text style={{ color: '#D1D5DB', fontSize: 13, marginTop: 1 }} numberOfLines={2}>
              {toast.text}
            </Text>
          )}
        </View>
      </Animated.View>
    </View>
  );
}
