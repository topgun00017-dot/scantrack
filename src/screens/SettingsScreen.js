import { showAlert } from '../platform';
import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useStore } from '../store';
import { testAI } from '../ai';
import { Button, Chip, Field, Header, SectionTitle, s } from '../components';
import { colors } from '../theme';

const CURRENCIES = ['MYR', 'SGD', 'USD', 'EUR', 'GBP'];

export default function SettingsScreen({ nav }) {
  const { settings, setSettings, receipts, clearDemo, webAI } = useStore();
  const [f, setF] = useState(settings);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const demoCount = receipts.filter((r) => r.demo).length;
  const [testing, setTesting] = useState(false);
  const openai = f.provider === 'openai';

  const test = async () => {
    setTesting(true);
    try {
      await testAI(f);
      setSettings(f);
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <SectionTitle>Profile</SectionTitle>
        <Field label="Your name" value={f.name} onChangeText={set('name')} placeholder="Shown on reports" />
        <Field label="Company" value={f.company} onChangeText={set('company')} placeholder="Optional" />
        <Text style={s.label}>Default currency</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {CURRENCIES.map((c) => <Chip key={c} label={c} active={f.currency === c} onPress={() => set('currency')(c)} />)}
        </View>

        <SectionTitle>Accountant</SectionTitle>
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
                <Field label="OpenAI API key" value={f.openaiKey} onChangeText={set('openaiKey')} placeholder="sk-…" autoCapitalize="none" autoCorrect={false} secureTextEntry />
                <Field label="Model" value={f.openaiModel} onChangeText={set('openaiModel')} autoCapitalize="none" autoCorrect={false} />
                <Text style={[s.sub, { marginBottom: 8 }]}>Get a key at platform.openai.com → API keys. API usage is billed separately from a ChatGPT Plus subscription.</Text>
              </>
            ) : (
              <>
                <Field label="Claude API key" value={f.apiKey} onChangeText={set('apiKey')} placeholder="sk-ant-…" autoCapitalize="none" autoCorrect={false} secureTextEntry />
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

        <Button title="Save settings" onPress={() => { setSettings(f); nav.back(); }} style={{ marginTop: 12 }} />

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
