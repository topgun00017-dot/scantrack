// "ABC Sdn Bhd ▾" — shows the company you're working in; tap to switch or add a company.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useCompanies } from './companies';
import { Button, s } from './components';
import { Icon } from './icons';
import { colors, radius } from './theme';
import { showToast } from './Toast';

export function CompanyDot({ color, size = 10 }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export default function CompanySwitcher({ label, style, onManage }) {
  const { companies, active, switchCompany, addCompany } = useCompanies();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  if (!active) return null;

  const pickCompany = (c) => {
    setOpen(false);
    if (c.id !== active.id) {
      switchCompany(c.id);
      showToast({ title: `Switched to ${c.name}`, text: 'New receipts are saved to this company.' });
    }
  };

  const add = () => {
    try {
      const c = addCompany(name);
      setAdding(false);
      setName('');
      pickCompany(c);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <Pressable
        onPress={() => {
          setAdding(false);
          setError('');
          setOpen(true);
        }}
        style={({ pressed }) => [
          { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 12, maxWidth: '100%', opacity: pressed ? 0.7 : 1 },
          style,
        ]}
      >
        <CompanyDot color={active.color} />
        {label ? <Text style={s.sub}>{label}</Text> : null}
        <Text style={{ color: colors.text, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>{active.name}</Text>
        <Icon name="chevron-down" size={16} color={colors.muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }} onPress={() => setOpen(false)}>
            <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingVertical: 8, maxHeight: '80%' }} onPress={() => {}}>
              <Text style={[s.h2, { paddingHorizontal: 16, paddingVertical: 10 }]}>Company</Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                {companies.map((c) => {
                  const on = c.id === active.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => pickCompany(c)}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 16, backgroundColor: on ? colors.surface2 : pressed ? colors.bg : 'transparent' })}
                    >
                      <CompanyDot color={c.color} size={12} />
                      <Text style={[s.body, { flex: 1, fontWeight: on ? '700' : '400' }]} numberOfLines={1}>{c.name}</Text>
                      {on && <Icon name="check" size={18} color={colors.accentInk} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderColor: colors.border, marginTop: 4 }}>
                {adding ? (
                  <>
                    <TextInput
                      value={name}
                      onChangeText={(v) => {
                        setName(v);
                        setError('');
                      }}
                      placeholder="Company name, e.g. ABC Sdn Bhd"
                      placeholderTextColor={colors.faint}
                      maxLength={40}
                      autoFocus
                      onSubmitEditing={add}
                      style={s.input}
                    />
                    {!!error && <Text style={{ color: colors.danger, marginTop: 6 }}>{error}</Text>}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <Button small title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setAdding(false)} />
                      <Button small title="Add company" icon="plus" style={{ flex: 2 }} disabled={!name.trim()} onPress={add} />
                    </View>
                  </>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Button small title="Add company" icon="plus" variant="secondary" style={{ flex: 1 }} onPress={() => setAdding(true)} />
                    {onManage && (
                      <Button
                        small
                        title="Manage"
                        icon="settings"
                        variant="secondary"
                        style={{ flex: 1 }}
                        onPress={() => {
                          setOpen(false);
                          onManage();
                        }}
                      />
                    )}
                  </View>
                )}
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
