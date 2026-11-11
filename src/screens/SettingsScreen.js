import { showAlert } from '../platform';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardHeight } from '../useKeyboard';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useStore } from '../store';
import CategoryEditor from '../CategoryEditor';
import { useCompanies } from '../companies';
import { CompanyDot } from '../CompanySwitcher';
import { Icon } from '../icons';
import { testAI, cleanKey } from '../ai';
import { Button, Chip, Field, Header, SectionTitle, s } from '../components';
import { colors } from '../theme';

const CURRENCIES = ['MYR', 'SGD', 'USD', 'EUR', 'GBP'];

export default function SettingsScreen({ nav }) {
  const bottomInset = useSafeAreaInsets().bottom; // clear Android's navigation bar
  const keyboard = useKeyboardHeight(); // Android: lift content above the on-screen keyboard
  const { settings, setSettings, receipts, clearDemo, webAI, drive, deleteCategory } = useStore();
  const [catEditor, setCatEditor] = useState(false);
  const { companies, active, addCompany, renameCompany, deleteCompany } = useCompanies();
  const [nameBox, setNameBox] = useState(null); // { id?, value } for adding or renaming a company
  const [nameError, setNameError] = useState('');
  const saveCompanyName = () => {
    try {
      if (nameBox.id) {
        const n = renameCompany(nameBox.id, nameBox.value);
        if (nameBox.id === active?.id && (!f.company || f.company === active.name)) set('company')(n);
      } else addCompany(nameBox.value);
      setNameBox(null);
    } catch (e) {
      setNameError(e.message);
    }
  };
  const [connecting, setConnecting] = useState(false);
  // Drive sign-in is saved straight away by the store, so the form must not overwrite it.
  const saveForm = () => {
    const { driveEnabled, driveEmail, customCategories, ...rest } = f; // these are saved directly by the store
    setSettings(rest);
  };
  const connect = async () => {
    setConnecting(true);
    try {
      const who = await drive.connect();
      if (who) showAlert('Google Drive connected', `Receipts will be saved to ${who.email}'s Google Drive, in the "ScanTrack Receipts" folder.`);
    } catch (e) {
      showAlert('Could not connect Google Drive', e.message);
    } finally {
      setConnecting(false);
    }
  };
  const driveLine = drive.status.syncing
    ? 'Saving to Google Drive…'
    : drive.status.error
    ? `Not saved: ${drive.status.error}`
    : drive.waiting
    ? `${drive.waiting} receipt(s) waiting to upload`
    : drive.status.lastSync
    ? `All receipts saved · last sync ${new Date(drive.status.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
    : 'Receipts are saved automatically after each change';
  const [f, setF] = useState(settings);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const demoCount = receipts.filter((r) => r.demo).length;
  const [testing, setTesting] = useState(false);
  const openai = f.provider === 'openai';

  const test = async () => {
    setTesting(true);
    try {
      await testAI(f);
      saveForm();
      showAlert('Connected', `${openai ? 'ChatGPT (OpenAI)' : 'Claude'} is working. Your settings are saved.`);
    } catch (e) {
      showAlert('Connection failed', e.message === 'NO_KEY' ? 'Paste an API key first.' : e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title="Settings" onBack={nav.back} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 + bottomInset + keyboard }} keyboardShouldPersistTaps="handled">
        <SectionTitle>Companies</SectionTitle>
        {companies.map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            <CompanyDot color={c.color} size={12} />
            <Text style={[s.body, { flex: 1, fontWeight: c.id === active?.id ? '700' : '400' }]} numberOfLines={1}>
              {c.name}
              {c.id === active?.id ? <Text style={s.sub}>  · current</Text> : null}
            </Text>
            <Pressable hitSlop={8} onPress={() => { setNameError(''); setNameBox({ id: c.id, value: c.name }); }} style={{ paddingHorizontal: 6 }}>
              <Text style={{ color: colors.accentInk, fontWeight: '700' }}>Rename</Text>
            </Pressable>
            {companies.length > 1 && (
              <Pressable
                hitSlop={8}
                onPress={() =>
                  showAlert(`Delete ${c.name}?`, `This permanently removes ${c.name}'s receipts and reports from this phone. Copies already in Google Drive are kept.`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteCompany(c.id).catch((e) => showAlert('Could not delete', e.message)) },
                  ])
                }
              >
                <Icon name="trash" size={20} color={colors.danger} />
              </Pressable>
            )}
          </View>
        ))}
        <Button small title="Add company" icon="plus" variant="secondary" style={{ marginTop: 8 }} onPress={() => { setNameError(''); setNameBox({ value: '' }); }} />
        <Modal visible={!!nameBox} transparent animationType="fade" onRequestClose={() => setNameBox(null)}>
          <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 }} onPress={() => setNameBox(null)}>
            <Pressable style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 20 }} onPress={() => {}}>
              <Text style={s.h2}>{nameBox?.id ? 'Rename company' : 'Add company'}</Text>
              <TextInput
                value={nameBox?.value || ''}
                onChangeText={(v) => { setNameBox((b) => ({ ...b, value: v })); setNameError(''); }}
                placeholder="Company name, e.g. ABC Sdn Bhd"
                placeholderTextColor={colors.faint}
                maxLength={40}
                autoFocus
                onSubmitEditing={saveCompanyName}
                style={[s.input, { marginTop: 12 }]}
              />
              {!!nameError && <Text style={{ color: colors.danger, marginTop: 6 }}>{nameError}</Text>}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Button small title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setNameBox(null)} />
                <Button small title={nameBox?.id ? 'Save' : 'Add company'} style={{ flex: 2 }} disabled={!(nameBox?.value || '').trim()} onPress={saveCompanyName} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <SectionTitle>You</SectionTitle>
        <Field label="Your name" value={f.name} onChangeText={set('name')} placeholder="Shown on reports" />

        <SectionTitle>{`This company · ${active?.name || ''}`}</SectionTitle>
        <Field label="Company name on reports & PDFs" value={f.company} onChangeText={set('company')} placeholder={active?.name || 'Optional'} />
        <Text style={s.label}>Default currency</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {CURRENCIES.map((c) => <Chip key={c} label={c} active={f.currency === c} onPress={() => set('currency')(c)} />)}
        </View>

        {!webAI && (
          <>
            <SectionTitle>Google Drive backup</SectionTitle>
            {!drive.available ? (
              <Text style={s.sub}>Available in the installed app (not in Expo Go).</Text>
            ) : settings.driveEnabled ? (
              <>
                <Text style={s.body}>Signed in as {settings.driveEmail}</Text>
                <Text style={[s.sub, { marginTop: 4, color: drive.status.error ? colors.danger : colors.muted }]}>{driveLine}</Text>
                <Text style={[s.sub, { marginTop: 4 }]}>Photos go to My Drive › ScanTrack Receipts › year › month, with a "ScanTrack receipts list" sheet of all receipts.</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  {drive.status.error ? (
                    <Button small title="Sign in again" variant="secondary" style={{ flex: 1 }} loading={connecting} onPress={connect} />
                  ) : (
                    <Button small title="Sync now" variant="secondary" style={{ flex: 1 }} loading={drive.status.syncing} onPress={drive.syncNow} />
                  )}
                  <Button small title="Sign out" variant="danger" style={{ flex: 1 }} onPress={() => showAlert('Stop saving to Google Drive?', 'Files already in your Drive are kept.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: drive.disconnect }])} />
                </View>
              </>
            ) : (
              <>
                <Text style={[s.sub, { marginBottom: 8 }]}>Sign in with Google to save every receipt photo to your Google Drive automatically.</Text>
                <Button title="Sign in with Google" variant="secondary" loading={connecting} onPress={connect} />
                <Text style={[s.sub, { marginTop: 8, fontSize: 11 }]} selectable>
                  Google Cloud setup: Android OAuth client · package com.scantrack.app · SHA-1 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
                </Text>
              </>
            )}
          </>
        )}

        <SectionTitle>My categories</SectionTitle>
        {(settings.customCategories || []).length === 0 && (
          <Text style={[s.sub, { marginBottom: 8 }]}>Add your own categories here or from a receipt's category list. They work everywhere: filters, exports, reports and AI scanning.</Text>
        )}
        {(settings.customCategories || []).map((c) => {
          const used = receipts.filter((r) => r.category === c.key).length;
          return (
            <View key={c.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
              <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: c.color + '26', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={c.icon} size={18} color={c.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.body}>{c.key}</Text>
                <Text style={s.sub}>{used} receipt{used === 1 ? '' : 's'}</Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() =>
                  showAlert(`Delete "${c.key}"?`, used ? `Its ${used} receipt${used === 1 ? '' : 's'} will move to Others.` : 'No receipts use it.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteCategory(c.key) },
                  ])
                }
              >
                <Icon name="trash" size={20} color={colors.danger} />
              </Pressable>
            </View>
          );
        })}
        <Button small title="Add category" icon="plus" variant="secondary" style={{ marginTop: 8 }} onPress={() => setCatEditor(true)} />
        <CategoryEditor visible={catEditor} onClose={() => setCatEditor(false)} />

        <SectionTitle>{`Accountant for ${active?.name || 'this company'}`}</SectionTitle>
        <Field label="Accountant name" value={f.accountantName} onChangeText={set('accountantName')} />
        <Field label="Accountant email" value={f.accountantEmail} onChangeText={set('accountantEmail')} keyboardType="email-address" autoCapitalize="none" />

        {webAI ? (
          <>
            <SectionTitle>AI (receipt reading & assistant)</SectionTitle>
            <Text style={[s.sub, { marginBottom: 8 }]}>On this page, receipt reading and the assistant use your own Claude account. You'll be asked to allow it the first time.</Text>
          </>
        ) : (
          <>
            <SectionTitle>AI (receipt reading & assistant)</SectionTitle>
            <Text style={s.label}>Provider</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <Chip label="Claude" active={!openai} onPress={() => set('provider')('claude')} />
              <Chip label="ChatGPT (OpenAI)" active={openai} onPress={() => set('provider')('openai')} />
            </View>
            {openai ? (
              <>
                <Field label="OpenAI API key" value={f.openaiKey} onChangeText={(v) => set('openaiKey')(cleanKey(v))} placeholder="sk-…" autoCapitalize="none" autoCorrect={false} secureTextEntry />
                <Field label="Model" value={f.openaiModel} onChangeText={(v) => set('openaiModel')(v.trim())} autoCapitalize="none" autoCorrect={false} />
                <Text style={[s.sub, { marginBottom: 8 }]}>Get a key at platform.openai.com → API keys. API usage is billed separately from a ChatGPT Plus subscription.</Text>
              </>
            ) : (
              <>
                <Field label="Claude API key" value={f.apiKey} onChangeText={(v) => set('apiKey')(cleanKey(v))} placeholder="sk-ant-…" autoCapitalize="none" autoCorrect={false} secureTextEntry />
                <Field label="Model" value={f.model} onChangeText={set('model')} autoCapitalize="none" autoCorrect={false} />
                <Text style={[s.sub, { marginBottom: 8 }]}>Get a key at console.anthropic.com → API keys. API usage is billed separately from a Claude subscription.</Text>
              </>
            )}
            <Button title="Test connection" variant="secondary" loading={testing} onPress={test} style={{ marginBottom: 8 }} />
            <Text style={[s.sub, { marginBottom: 8 }]}>
          The key is stored only on this phone and is meant for testing. Before publishing the app, move AI calls to your own server so the key isn't shipped in the app.
            </Text>

          </>
        )}

        <Button title="Save settings" onPress={() => { saveForm(); nav.back(); }} style={{ marginTop: 12 }} />

        {demoCount > 0 && (
          <>
            <SectionTitle>Sample data</SectionTitle>
            <Button
              title={`Remove ${demoCount} sample receipts`}
              variant="danger"
              onPress={() => showAlert('Remove sample data', 'Your own receipts are kept.', [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: clearDemo }])}
            />
          </>
        )}
        <Text style={[s.sub, { textAlign: 'center', marginTop: 24, color: colors.faint }]}>ScanTrack · v1.0</Text>
      </ScrollView>
    </View>
  );
}
