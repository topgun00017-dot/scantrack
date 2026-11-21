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
import { L, LANGUAGES, getLang, setLanguage } from '../i18n';

// AI settings are behind a password. Only a hash is stored on the phone; until it is changed
// the default password is ai2026*. This keeps casual users out of the API key settings.
const DEFAULT_AI_PASSWORD = 'ai2026*';
const hashPass = (p) => {
  let h = 0x811c9dc5;
  for (const ch of `scantrack:${p}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
};

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
    const { driveEnabled, driveEmail, customCategories, aiPassHash, ...rest } = f; // these are saved directly by the store
    setSettings(rest);
  };
  const connect = async () => {
    setConnecting(true);
    try {
      const who = await drive.connect();
      if (who) showAlert(L('Google Drive connected', 'Google 云端硬盘已连接'), L(`Receipts will be saved to ${who.email}'s Google Drive, in the "ScanTrack Receipts" folder.`, `收据将保存到 ${who.email} 的 Google 云端硬盘中的“ScanTrack Receipts”文件夹。`));
    } catch (e) {
      showAlert(L('Could not connect Google Drive', '无法连接 Google 云端硬盘'), e.message);
    } finally {
      setConnecting(false);
    }
  };
  const lastSync = drive.status.lastSync ? new Date(drive.status.lastSync).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
  const driveLine = drive.status.syncing
    ? L('Saving to Google Drive…', '正在保存到 Google 云端硬盘…')
    : drive.status.error
    ? L(`Not saved: ${drive.status.error}`, `未保存：${drive.status.error}`)
    : drive.waiting
    ? L(`${drive.waiting} receipt(s) waiting to upload`, `${drive.waiting} 张收据等待上传`)
    : drive.status.lastSync
    ? L(`All receipts saved · last sync ${lastSync}`, `所有收据已保存 · 上次同步 ${lastSync}`)
    : L('Receipts are saved automatically after each change', '每次更改后都会自动保存收据');
  const [f, setF] = useState(settings);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const demoCount = receipts.filter((r) => r.demo).length;
  const [testing, setTesting] = useState(false);
  const [aiOpen, setAiOpen] = useState(false); // locked again every time Settings opens
  const [pw, setPw] = useState(null); // { mode: 'unlock' | 'change', a, b, error }
  const passOk = (p) => hashPass(p) === (settings.aiPassHash || hashPass(DEFAULT_AI_PASSWORD));
  const submitPw = () => {
    if (pw.mode === 'unlock') {
      if (!passOk(pw.a)) return setPw({ ...pw, a: '', error: L('Wrong password. Try again.', '密码错误，请重试。') });
      setAiOpen(true);
      return setPw(null);
    }
    if (!passOk(pw.cur || '')) return setPw({ ...pw, error: L('Current password is wrong.', '当前密码错误。') });
    if ((pw.a || '').length < 4) return setPw({ ...pw, error: L('Use at least 4 characters.', '至少使用 4 个字符。') });
    if (pw.a !== pw.b) return setPw({ ...pw, error: L("The new passwords don't match.", '两次输入的新密码不一致。') });
    setSettings({ aiPassHash: hashPass(pw.a) });
    setPw(null);
    showAlert(L('Password changed', '密码已更改'), L('Use the new password next time you open the AI settings.', '下次打开 AI 设置时请使用新密码。'));
  };
  const openai = f.provider === 'openai';

  const test = async () => {
    setTesting(true);
    try {
      await testAI(f);
      saveForm();
      showAlert(L('Connected', '已连接'), L(`${openai ? 'ChatGPT (OpenAI)' : 'Claude'} is working. Your settings are saved.`, `${openai ? 'ChatGPT (OpenAI)' : 'Claude'} 运行正常，设置已保存。`));
    } catch (e) {
      showAlert(L('Connection failed', '连接失败'), e.message === 'NO_KEY' ? L('Paste an API key first.', '请先粘贴 API 密钥。') : e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header title={L('Settings', '设置')} onBack={nav.back} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 + bottomInset + keyboard }} keyboardShouldPersistTaps="handled">
        {/* Shown in both languages so it can always be found. Switching reloads the app in the new language. */}
        <SectionTitle>Language · 语言</SectionTitle>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {LANGUAGES.map((l) => (
            <Chip
              key={l.key}
              label={l.label}
              active={getLang() === l.key}
              onPress={() => {
                if (getLang() === l.key) return;
                saveForm();
                setTimeout(() => setLanguage(l.key), 300); // let the settings save before the app reloads
              }}
            />
          ))}
        </View>

        <SectionTitle>{L('Companies', '公司')}</SectionTitle>
        {companies.map((c) => (
          <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
            <CompanyDot color={c.color} size={12} />
            <Text style={[s.body, { flex: 1, fontWeight: c.id === active?.id ? '700' : '400' }]} numberOfLines={1}>
              {c.name}
              {c.id === active?.id ? <Text style={s.sub}>{L('  · current', '  · 当前')}</Text> : null}
            </Text>
            <Pressable hitSlop={8} onPress={() => { setNameError(''); setNameBox({ id: c.id, value: c.name }); }} style={{ paddingHorizontal: 6 }}>
              <Text style={{ color: colors.accentInk, fontWeight: '700' }}>{L('Rename', '重命名')}</Text>
            </Pressable>
            {companies.length > 1 && (
              <Pressable
                hitSlop={8}
                onPress={() =>
                  showAlert(L(`Delete ${c.name}?`, `删除 ${c.name}？`), L(`This permanently removes ${c.name}'s receipts and reports from this phone. Copies already in Google Drive are kept.`, `这会从本手机永久删除 ${c.name} 的收据和报告。已保存在 Google 云端硬盘中的副本会保留。`), [
                    { text: L('Cancel', '取消'), style: 'cancel' },
                    { text: L('Delete', '删除'), style: 'destructive', onPress: () => deleteCompany(c.id).catch((e) => showAlert(L('Could not delete', '无法删除'), e.message)) },
                  ])
                }
              >
                <Icon name="trash" size={20} color={colors.danger} />
              </Pressable>
            )}
          </View>
        ))}
        <Button small title={L('Add company', '添加公司')} icon="plus" variant="secondary" style={{ marginTop: 8 }} onPress={() => { setNameError(''); setNameBox({ value: '' }); }} />
        <Modal visible={!!pw} transparent animationType="fade" onRequestClose={() => setPw(null)}>
          <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-start', paddingTop: 110, paddingHorizontal: 20 }} onPress={() => setPw(null)}>
            <Pressable style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 20 }} onPress={() => {}}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Icon name={pw?.mode === 'change' ? 'lock' : 'lock-open'} size={22} color={colors.accentInk} />
                <Text style={s.h2}>{pw?.mode === 'change' ? L('Change AI password', '更改 AI 密码') : L('Unlock AI settings', '解锁 AI 设置')}</Text>
              </View>
              {pw?.mode === 'change' && (
                <TextInput value={pw.cur} onChangeText={(v) => setPw((p) => ({ ...p, cur: v, error: '' }))} placeholder={L('Current password', '当前密码')} placeholderTextColor={colors.faint} secureTextEntry autoFocus autoCapitalize="none" autoCorrect={false} style={[s.input, { marginTop: 14 }]} />
              )}
              <TextInput
                value={pw?.a || ''}
                onChangeText={(v) => setPw((p) => ({ ...p, a: v, error: '' }))}
                placeholder={pw?.mode === 'change' ? L('New password', '新密码') : L('Password', '密码')}
                placeholderTextColor={colors.faint}
                secureTextEntry
                autoFocus={pw?.mode !== 'change'}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={pw?.mode === 'unlock' ? submitPw : undefined}
                style={[s.input, { marginTop: pw?.mode === 'change' ? 10 : 14 }]}
              />
              {pw?.mode === 'change' && (
                <TextInput value={pw.b} onChangeText={(v) => setPw((p) => ({ ...p, b: v, error: '' }))} placeholder={L('New password again', '再次输入新密码')} placeholderTextColor={colors.faint} secureTextEntry autoCapitalize="none" autoCorrect={false} onSubmitEditing={submitPw} style={[s.input, { marginTop: 10 }]} />
              )}
              {!!pw?.error && <Text style={{ color: colors.danger, marginTop: 8 }}>{pw.error}</Text>}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <Button title={L('Cancel', '取消')} variant="secondary" style={{ flex: 1 }} onPress={() => setPw(null)} />
                <Button title={pw?.mode === 'change' ? L('Save', '保存') : L('Unlock', '解锁')} style={{ flex: 1 }} onPress={submitPw} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
        <Modal visible={!!nameBox} transparent animationType="fade" onRequestClose={() => setNameBox(null)}>
          <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 20 }} onPress={() => setNameBox(null)}>
            <Pressable style={{ backgroundColor: colors.surface, borderRadius: 18, padding: 20 }} onPress={() => {}}>
              <Text style={s.h2}>{nameBox?.id ? L('Rename company', '重命名公司') : L('Add company', '添加公司')}</Text>
              <TextInput
                value={nameBox?.value || ''}
                onChangeText={(v) => { setNameBox((b) => ({ ...b, value: v })); setNameError(''); }}
                placeholder={L('Company name, e.g. ABC Sdn Bhd', '公司名称，例如：ABC Sdn Bhd')}
                placeholderTextColor={colors.faint}
                maxLength={40}
                autoFocus
                onSubmitEditing={saveCompanyName}
                style={[s.input, { marginTop: 12 }]}
              />
              {!!nameError && <Text style={{ color: colors.danger, marginTop: 6 }}>{nameError}</Text>}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
                <Button small title={L('Cancel', '取消')} variant="secondary" style={{ flex: 1 }} onPress={() => setNameBox(null)} />
                <Button small title={nameBox?.id ? L('Save', '保存') : L('Add company', '添加公司')} style={{ flex: 2 }} disabled={!(nameBox?.value || '').trim()} onPress={saveCompanyName} />
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        <SectionTitle>{L('You', '你')}</SectionTitle>
        <Field label={L('Your name', '你的名字')} value={f.name} onChangeText={set('name')} placeholder={L('Shown on reports', '显示在报告上')} />

        <SectionTitle>{`${L('This company', '本公司')} · ${active?.name || ''}`}</SectionTitle>
        <Field label={L('Company name on reports & PDFs', '报告和 PDF 上的公司名称')} value={f.company} onChangeText={set('company')} placeholder={active?.name || L('Optional', '可选')} />
        <Text style={s.label}>{L('Default currency', '默认货币')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {CURRENCIES.map((c) => <Chip key={c} label={c} active={f.currency === c} onPress={() => set('currency')(c)} />)}
        </View>

        {!webAI && (
          <>
            <SectionTitle>{L('Google Drive backup', 'Google 云端硬盘备份')}</SectionTitle>
            {!drive.available ? (
              <Text style={s.sub}>{L('Available in the installed app (not in Expo Go).', '仅在已安装的应用中可用（Expo Go 中不可用）。')}</Text>
            ) : settings.driveEnabled ? (
              <>
                <Text style={s.body}>{L('Signed in as', '已登录')} {settings.driveEmail}</Text>
                <Text style={[s.sub, { marginTop: 4, color: drive.status.error ? colors.danger : colors.muted }]}>{driveLine}</Text>
                <Text style={[s.sub, { marginTop: 4 }]}>{L('Photos go to My Drive › ScanTrack Receipts › year › month, with a "ScanTrack receipts list" sheet of all receipts.', '照片保存到 我的云端硬盘 › ScanTrack Receipts › 年 › 月，并附有包含所有收据的“ScanTrack receipts list”表格。')}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  {drive.status.error ? (
                    <Button small title={L('Sign in again', '重新登录')} variant="secondary" style={{ flex: 1 }} loading={connecting} onPress={connect} />
                  ) : (
                    <Button small title={L('Sync now', '立即同步')} variant="secondary" style={{ flex: 1 }} loading={drive.status.syncing} onPress={drive.syncNow} />
                  )}
                  <Button small title={L('Sign out', '退出登录')} variant="danger" style={{ flex: 1 }} onPress={() => showAlert(L('Stop saving to Google Drive?', '停止保存到 Google 云端硬盘？'), L('Files already in your Drive are kept.', '已在云端硬盘中的文件会保留。'), [{ text: L('Cancel', '取消'), style: 'cancel' }, { text: L('Sign out', '退出登录'), style: 'destructive', onPress: drive.disconnect }])} />
                </View>
              </>
            ) : (
              <>
                <Text style={[s.sub, { marginBottom: 8 }]}>{L('Sign in with Google to save every receipt photo to your Google Drive automatically.', '使用 Google 登录后，每张收据照片都会自动保存到你的 Google 云端硬盘。')}</Text>
                <Button title={L('Sign in with Google', '使用 Google 登录')} variant="secondary" loading={connecting} onPress={connect} />
                <Text style={[s.sub, { marginTop: 8, fontSize: 11 }]} selectable>
                  {L('Google Cloud setup', 'Google Cloud 设置')}: Android OAuth client · package com.scantrack.app · SHA-1 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
                </Text>
              </>
            )}
          </>
        )}

        <SectionTitle>{L('My categories', '我的类别')}</SectionTitle>
        {(settings.customCategories || []).length === 0 && (
          <Text style={[s.sub, { marginBottom: 8 }]}>{L("Add your own categories here or from a receipt's category list. They work everywhere: filters, exports, reports and AI scanning.", '在这里或在收据的类别列表中添加自己的类别。它们在筛选、导出、报告和 AI 扫描中都可使用。')}</Text>
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
                <Text style={s.sub}>{L(`${used} receipt${used === 1 ? '' : 's'}`, `${used} 张收据`)}</Text>
              </View>
              <Pressable
                hitSlop={10}
                onPress={() =>
                  showAlert(L(`Delete "${c.key}"?`, `删除“${c.key}”？`), used ? L(`Its ${used} receipt${used === 1 ? '' : 's'} will move to Others.`, `其中的 ${used} 张收据将移到“其他”。`) : L('No receipts use it.', '没有收据使用此类别。'), [
                    { text: L('Cancel', '取消'), style: 'cancel' },
                    { text: L('Delete', '删除'), style: 'destructive', onPress: () => deleteCategory(c.key) },
                  ])
                }
              >
                <Icon name="trash" size={20} color={colors.danger} />
              </Pressable>
            </View>
          );
        })}
        <Button small title={L('Add category', '添加类别')} icon="plus" variant="secondary" style={{ marginTop: 8 }} onPress={() => setCatEditor(true)} />
        <CategoryEditor visible={catEditor} onClose={() => setCatEditor(false)} />

        <View style={{ height: 18 }} />
        <Field label={L("Account's email", '会计师邮箱')} value={f.accountantEmail} onChangeText={set('accountantEmail')} keyboardType="email-address" autoCapitalize="none" />

        {webAI ? (
          <>
            <SectionTitle>{L('AI (receipt reading & assistant)', 'AI（收据读取和助手）')}</SectionTitle>
            <Text style={[s.sub, { marginBottom: 8 }]}>{L("On this page, receipt reading and the assistant use your own Claude account. You'll be asked to allow it the first time.", '在此页面上，收据读取和助手会使用你自己的 Claude 帐号。第一次使用时会请求你允许。')}</Text>
          </>
        ) : (
          <>
            <SectionTitle right={aiOpen ? <Text style={{ color: colors.accentInk, fontWeight: '700' }} onPress={() => setAiOpen(false)}>{L('Lock', '锁定')}</Text> : null}>{L('AI (receipt reading & assistant)', 'AI（收据读取和助手）')}</SectionTitle>
            {!aiOpen ? (
              <Pressable onPress={() => setPw({ mode: 'unlock', a: '' })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 8, opacity: pressed ? 0.7 : 1 })}>
                <Icon name="lock" size={22} color={colors.muted} />
                <View style={{ flex: 1 }}>
                  <Text style={[s.body, { fontWeight: '700' }]}>{L('Password protected', '密码保护')}</Text>
                  <Text style={s.sub}>{L('Enter the password to view or change the AI settings.', '输入密码以查看或更改 AI 设置。')}</Text>
                </View>
                <Text style={{ color: colors.accentInk, fontWeight: '700' }}>{L('Unlock', '解锁')}</Text>
              </Pressable>
            ) : (
            <>
            <Text style={s.label}>{L('Provider', '服务商')}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <Chip label="Claude" active={!openai} onPress={() => set('provider')('claude')} />
              <Chip label="ChatGPT (OpenAI)" active={openai} onPress={() => set('provider')('openai')} />
            </View>
            {openai ? (
              <>
                <Field label={L('OpenAI API key', 'OpenAI API 密钥')} value={f.openaiKey} onChangeText={(v) => set('openaiKey')(cleanKey(v))} placeholder="sk-…" autoCapitalize="none" autoCorrect={false} secureTextEntry />
                <Field label={L('Model', '模型')} value={f.openaiModel} onChangeText={(v) => set('openaiModel')(v.trim())} autoCapitalize="none" autoCorrect={false} />
                <Text style={[s.sub, { marginBottom: 8 }]}>{L('Get a key at platform.openai.com → API keys. API usage is billed separately from a ChatGPT Plus subscription.', '在 platform.openai.com → API keys 获取密钥。API 用量与 ChatGPT Plus 订阅分开计费。')}</Text>
              </>
            ) : (
              <>
                <Field label={L('Claude API key', 'Claude API 密钥')} value={f.apiKey} onChangeText={(v) => set('apiKey')(cleanKey(v))} placeholder="sk-ant-…" autoCapitalize="none" autoCorrect={false} secureTextEntry />
                <Field label={L('Model', '模型')} value={f.model} onChangeText={set('model')} autoCapitalize="none" autoCorrect={false} />
                <Text style={[s.sub, { marginBottom: 8 }]}>{L('Get a key at console.anthropic.com → API keys. API usage is billed separately from a Claude subscription.', '在 console.anthropic.com → API keys 获取密钥。API 用量与 Claude 订阅分开计费。')}</Text>
              </>
            )}
            <Button title={L('Test connection', '测试连接')} variant="secondary" loading={testing} onPress={test} style={{ marginBottom: 8 }} />
            <Text style={[s.sub, { marginBottom: 8 }]}>
          {L("The key is stored only on this phone and is meant for testing. Before publishing the app, move AI calls to your own server so the key isn't shipped in the app.", '密钥只保存在本手机上，仅供测试使用。正式发布应用前，请把 AI 调用移到你自己的服务器，以免密钥随应用发布。')}
            </Text>
            <Button small title={L('Change AI password', '更改 AI 密码')} icon="lock" variant="secondary" onPress={() => setPw({ mode: 'change', cur: '', a: '', b: '' })} style={{ marginBottom: 8 }} />
            </>
            )}

          </>
        )}

        <Button title={L('Save settings', '保存设置')} onPress={() => { saveForm(); nav.back(); }} style={{ marginTop: 12 }} />

        {demoCount > 0 && (
          <>
            <SectionTitle>{L('Sample data', '示例数据')}</SectionTitle>
            <Button
              title={L(`Remove ${demoCount} sample receipts`, `删除 ${demoCount} 张示例收据`)}
              variant="danger"
              onPress={() => showAlert(L('Remove sample data', '删除示例数据'), L('Your own receipts are kept.', '你自己的收据会保留。'), [{ text: L('Cancel', '取消') }, { text: L('Remove', '删除'), style: 'destructive', onPress: clearDemo }])}
            />
          </>
        )}
        <Text style={[s.sub, { textAlign: 'center', marginTop: 24, color: colors.faint }]}>ScanTrack · v1.0</Text>
      </ScrollView>
    </View>
  );
}
