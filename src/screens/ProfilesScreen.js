// "Who's using ScanTrack?" — pick your profile (enter PIN if it has one) or add a new user.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfiles, initials } from '../profiles';
import { Button, s } from '../components';
import { Icon } from '../icons';
import { colors, radius } from '../theme';

export function Avatar({ profile, size = 56 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: profile.color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.38 }}>{initials(profile.name)}</Text>
    </View>
  );
}

// 4–6 digit PIN pad. mode 'enter' checks a PIN; mode 'set' asks twice and returns the new PIN.
export function PinPad({ title, subtitle, mode = 'enter', onDone, onCancel, check }) {
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState(null);
  const [error, setError] = useState('');

  const submit = (value) => {
    if (mode === 'enter') {
      if (check(value)) onDone(value);
      else {
        setError('Wrong PIN. Try again.');
        setPin('');
      }
      return;
    }
    if (value.length < 4) return setError('Use 4 to 6 digits.');
    if (first === null) {
      setFirst(value);
      setPin('');
      setError('');
    } else if (first === value) onDone(value);
    else {
      setFirst(null);
      setPin('');
      setError("PINs didn't match. Start again.");
    }
  };

  const press = (k) => {
    setError('');
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (k === 'ok') return submit(pin);
    const next = (pin + k).slice(0, 6);
    setPin(next);
    if (mode === 'enter' && next.length >= 4 && check(next)) onDone(next); // unlock as soon as it's right
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={s.h2}>{mode === 'set' ? (first === null ? title : 'Enter the PIN again') : title}</Text>
      {!!subtitle && <Text style={[s.sub, { marginTop: 4, textAlign: 'center' }]}>{subtitle}</Text>}
      <View style={{ flexDirection: 'row', gap: 12, marginVertical: 18 }}>
        {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
          <View key={i} style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i < pin.length ? colors.accentInk : colors.surface2, borderWidth: 1, borderColor: colors.border }} />
        ))}
      </View>
      <Text style={{ color: colors.danger, minHeight: 20, marginBottom: 4 }}>{error}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 252, gap: 12, justifyContent: 'center' }}>
        {keys.map((k) => (
          <Pressable
            key={k}
            onPress={() => press(k)}
            style={({ pressed }) => ({ width: 72, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: k === 'ok' ? colors.accent : pressed ? colors.border : colors.surface2 })}
          >
            {k === 'del' ? <Icon name="chevron-left" size={22} color={colors.text} /> : k === 'ok' ? <Icon name="check" size={22} color={colors.accentText} /> : <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{k}</Text>}
          </Pressable>
        ))}
      </View>
      {onCancel && <Button title="Cancel" variant="ghost" small onPress={onCancel} style={{ marginTop: 10 }} />}
    </View>
  );
}

function Sheet({ visible, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 }} onPress={onClose}>
          <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20 }} onPress={() => {}}>
            {children}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ProfilesScreen() {
  const insets = useSafeAreaInsets();
  const { profiles, enter, checkPin, addProfile } = useProfiles();
  const [pinFor, setPinFor] = useState(null); // profile asking for its PIN
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [usePin, setUsePin] = useState(false);
  const [askNewPin, setAskNewPin] = useState(false);
  const [error, setError] = useState('');

  const open = (p) => (p.pinHash ? setPinFor(p) : enter(p.id));

  const create = (pin) => {
    try {
      const p = addProfile({ name, pin });
      setAdding(false);
      setAskNewPin(false);
      enter(p.id);
    } catch (e) {
      setAskNewPin(false);
      setError(e.message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 + insets.bottom }}>
        <View style={{ alignItems: 'center', marginTop: 24, marginBottom: 28 }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="receipt" size={34} color={colors.accentText} />
          </View>
          <Text style={[s.h1, { marginTop: 14 }]}>Who's using ScanTrack?</Text>
          <Text style={[s.sub, { marginTop: 4 }]}>Each person sees only their own receipts.</Text>
        </View>

        <View style={{ gap: 10 }}>
          {profiles.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => open(p)}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14, opacity: pressed ? 0.8 : 1 })}
            >
              <Avatar profile={p} size={48} />
              <Text style={[s.h2, { flex: 1 }]} numberOfLines={1}>{p.name}</Text>
              {p.pinHash ? <Text style={s.sub}>PIN</Text> : null}
              <Icon name="chevron-right" size={20} color={colors.faint} />
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              setName('');
              setUsePin(false);
              setError('');
              setAdding(true);
            }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.faint, padding: 14, opacity: pressed ? 0.7 : 1 })}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={24} color={colors.accentInk} />
            </View>
            <Text style={[s.h2, { color: colors.accentInk }]}>Add user</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* PIN to open a profile */}
      <Sheet visible={!!pinFor} onClose={() => setPinFor(null)}>
        {pinFor && (
          <PinPad
            title={`Hi ${pinFor.name}`}
            subtitle="Enter your PIN"
            check={(pin) => checkPin(pinFor, pin)}
            onDone={() => {
              const id = pinFor.id;
              setPinFor(null);
              enter(id);
            }}
            onCancel={() => setPinFor(null)}
          />
        )}
      </Sheet>

      {/* add a user */}
      <Sheet visible={adding} onClose={() => setAdding(false)}>
        {askNewPin ? (
          <PinPad title="Choose a PIN" subtitle="4 to 6 digits, then tap ✓" mode="set" onDone={create} onCancel={() => setAskNewPin(false)} />
        ) : (
          <>
            <Text style={s.h2}>Add user</Text>
            <TextInput
              value={name}
              onChangeText={(v) => {
                setName(v);
                setError('');
              }}
              placeholder="Name, e.g. Ali"
              placeholderTextColor={colors.faint}
              maxLength={24}
              autoFocus
              style={[s.input, { marginTop: 14 }]}
            />
            {!!error && <Text style={{ color: colors.danger, marginTop: 6 }}>{error}</Text>}
            <Pressable onPress={() => setUsePin((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
              <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: usePin ? colors.accent : colors.faint, backgroundColor: usePin ? colors.accent : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                {usePin && <Icon name="check" size={14} color={colors.accentText} strokeWidth={3} />}
              </View>
              <Text style={s.body}>Protect with a PIN</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
              <Button small title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setAdding(false)} />
              <Button
                small
                title={usePin ? 'Next: set PIN' : 'Add & open'}
                style={{ flex: 2 }}
                disabled={!name.trim()}
                onPress={() => {
                  if (profiles.some((p) => p.name.toLowerCase() === name.trim().toLowerCase())) return setError(`"${name.trim()}" already exists.`);
                  usePin ? setAskNewPin(true) : create(null);
                }}
              />
            </View>
          </>
        )}
      </Sheet>
    </View>
  );
}
