import React from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius } from './theme';
import { categoryMeta } from './categories';
import { money, prettyDate, RANGE_PRESETS } from './utils';

export function Header({ title, subtitle, onBack, right }) {
  return (
    <View style={s.header}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        {onBack && (
          <Pressable onPress={onBack} hitSlop={12} style={{ marginRight: 10 }}>
            <Text style={{ color: colors.text, fontSize: 26 }}>‹</Text>
          </Pressable>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.h1} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={s.sub}>{subtitle}</Text>}
        </View>
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style, onPress }) {
  const Comp = onPress ? Pressable : View;
  return <Comp onPress={onPress} style={({ pressed } = {}) => [s.card, pressed && { opacity: 0.8 }, style]}>{children}</Comp>;
}

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style, small }) {
  const v = {
    primary: { bg: colors.accent, fg: colors.accentText },
    secondary: { bg: colors.surface2, fg: colors.text },
    danger: { bg: 'transparent', fg: colors.danger, border: colors.danger },
    ghost: { bg: 'transparent', fg: colors.accentInk },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.btn,
        small && { paddingVertical: 8, paddingHorizontal: 12 },
        { backgroundColor: v.bg, borderColor: v.border || 'transparent', opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[s.btnText, small && { fontSize: 13 }, { color: v.fg }]}>{icon ? `${icon}  ` : ''}{title}</Text>
      )}
    </Pressable>
  );
}

export function Chip({ label, active, onPress, color }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, active && { backgroundColor: color || colors.accent, borderColor: color || colors.accent }]}>
      <Text style={[s.chipText, active && { color: colors.accentText }]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {children}
    </ScrollView>
  );
}

export function Field({ label, style, ...props }) {
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      {!!label && <Text style={s.label}>{label}</Text>}
      <TextInput placeholderTextColor={colors.faint} style={s.input} {...props} />
    </View>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 8 }}>
      <Text style={s.section}>{children}</Text>
      {right}
    </View>
  );
}

export function ReceiptRow({ r, onPress, selected, onLongPress }) {
  const c = categoryMeta(r.category);
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={({ pressed }) => [s.row, selected && { borderColor: colors.accent }, pressed && { opacity: 0.85 }]}>
      {r.imageUri ? (
        <Image source={{ uri: r.imageUri }} style={s.thumb} />
      ) : (
        <View style={[s.thumb, { backgroundColor: c.color + '33', alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontSize: 20 }}>{c.icon}</Text>
        </View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.rowTitle} numberOfLines={1}>{r.merchant}</Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {prettyDate(r.date)} · {r.category}
          {(r.tags || []).length ? ` · #${r.tags.join(' #')}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={s.rowAmt}>{money(r.total, r.currency)}</Text>
        {r.status === 'needs_review' && <Text style={s.badge}>Review</Text>}
        {selected && <Text style={{ color: colors.accentInk, fontSize: 12 }}>✓ selected</Text>}
      </View>
    </Pressable>
  );
}

export function Empty({ icon = '🧾', title, text, action }) {
  return (
    <View style={{ alignItems: 'center', padding: 32 }}>
      <Text style={{ fontSize: 40 }}>{icon}</Text>
      <Text style={[s.h2, { marginTop: 8 }]}>{title}</Text>
      {!!text && <Text style={[s.sub, { textAlign: 'center', marginTop: 4 }]}>{text}</Text>}
      {action && <View style={{ marginTop: 16 }}>{action}</View>}
    </View>
  );
}

export function RangePicker({ value, onChange }) {
  return (
    <ChipRow>
      {RANGE_PRESETS.map((p) => (
        <Chip key={p.key} label={p.label} active={value === p.key} onPress={() => onChange(p.key)} />
      ))}
    </ChipRow>
  );
}

export function Stat({ label, value, tone }) {
  return (
    <View style={[s.card, { flex: 1, padding: 12 }]}>
      <Text style={s.sub}>{label}</Text>
      <Text style={[s.h2, { fontSize: 16, marginTop: 4, color: tone || colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  h1: { color: colors.text, fontSize: 26, fontWeight: '800' },
  h2: { color: colors.text, fontSize: 18, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 13 },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  section: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, borderWidth: 1, borderColor: colors.border },
  btn: { borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnText: { fontSize: 15, fontWeight: '700' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: colors.surface2, color: colors.text, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  thumb: { width: 44, height: 44, borderRadius: 10 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowAmt: { color: colors.text, fontSize: 15, fontWeight: '700' },
  badge: { color: colors.warning, fontSize: 11, fontWeight: '700', marginTop: 2 },
});
