import { Icon } from './src/icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/store';
import { colors } from './src/theme';
import DialogHost from './src/DialogHost';
import ToastHost from './src/Toast';
import ReceiptResultHost from './src/ReceiptResult';
import CameraModal from './src/CameraModal';
import { openCamera } from './src/capture';
import { CompaniesProvider, useCompanies } from './src/companies';

import HomeScreen from './src/screens/HomeScreen';
import ReceiptsScreen from './src/screens/ReceiptsScreen';
import ReceiptEditScreen from './src/screens/ReceiptEditScreen';
import AgentScreen from './src/screens/AgentScreen';
import MoreScreen from './src/screens/MoreScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import ReportDetailScreen from './src/screens/ReportDetailScreen';
import ExportScreen from './src/screens/ExportScreen';
import AccountingScreen from './src/screens/AccountingScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import InsightsScreen from './src/screens/InsightsScreen';

const TABS = [
  { key: 'home', label: 'Expenses', icon: 'wallet', comp: HomeScreen },
  { key: 'insights', label: 'Insights', icon: 'chart-pie', comp: InsightsScreen },
  { key: 'scan', label: 'Scan', icon: 'camera', center: true }, // opens the receipt camera, not a page
  { key: 'receipts', label: 'Receipts', icon: 'receipt', comp: ReceiptsScreen },
  { key: 'more', label: 'More', icon: 'menu', comp: MoreScreen },
];

const STACK = {
  receipt: ReceiptEditScreen,
  reports: ReportsScreen,
  report: ReportDetailScreen,
  export: ExportScreen,
  accounting: AccountingScreen,
  settings: SettingsScreen,
  agent: AgentScreen,
};

function Shell({ tab, setTab }) {
  const { ready } = useStore();
  const [stack, setStack] = useState([]); // [{ name, params }]
  const [tabParams, setTabParams] = useState({}); // e.g. the period Insights should open on

  const nav = {
    push: (name, params = {}) => setStack((st) => [...st, { name, params }]),
    back: () => setStack((st) => st.slice(0, -1)),
    replace: (name, params = {}) => setStack((st) => [...st.slice(0, -1), { name, params }]),
    tab: (key, params) => {
      setStack([]);
      // A one-off instruction for that tab (e.g. open Insights on a period, or snap a photo); cleared on a plain tab switch.
      setTabParams((p) => ({ ...p, [key]: params ? { ...params, at: Date.now() } : undefined }));
      setTab(key);
    },
  };

  if (!ready) {
    return (
      <View style={[styles.fill, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const top = stack[stack.length - 1];
  const TabComp = TABS.find((t) => t.key === tab).comp;
  const StackComp = top ? STACK[top.name] : null;

  return (
    <SafeAreaView style={styles.fill} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1 }}>
        {StackComp ? <StackComp key={`${stack.length}:${top.params?.id || ''}`} nav={nav} params={top.params} /> : <TabComp nav={nav} params={tabParams[tab]} />}
      </View>
      {!StackComp && (
        <SafeAreaView edges={['bottom']} style={styles.tabbar}>
          {TABS.map((t) => {
            const active = t.key === tab;
            if (t.center) {
              return (
                <Pressable key={t.key} onPress={openCamera} style={styles.tab}>
                  <View style={[styles.fab, active && { borderColor: colors.text }]}>
                    <Icon name={t.icon} size={26} color={colors.accentText} />
                  </View>
                </Pressable>
              );
            }
            return (
              <Pressable key={t.key} onPress={() => nav.tab(t.key)} style={styles.tab}>
                <Icon name={t.icon} size={22} color={active ? colors.accentInk : colors.muted} />
                <Text style={[styles.tabLabel, active && { color: colors.accentInk }]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </SafeAreaView>
      )}
      <ReceiptResultHost />
      <CameraModal nav={nav} />
    </SafeAreaView>
  );
}

// Load the selected company's data. key={id} gives each company a fresh store when switching.
function Gate() {
  const { ready, active } = useCompanies();
  const [tab, setTab] = useState('home'); // kept here so switching company stays on the same tab
  if (!ready || !active) {
    return (
      <View style={[styles.fill, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }
  return (
    <StoreProvider key={active.id} dataKey={active.dataKey} withSamples={!!active.first} companyName={active.first ? '' : active.name} folderName={active.name}>
      <Shell tab={tab} setTab={setTab} />
    </StoreProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <CompaniesProvider>
        <StatusBar style="dark" />
        <Gate />
        <ToastHost />
        <DialogHost />
      </CompaniesProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  tabbar: { flexDirection: 'row', backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 6 },
  tabLabel: { color: colors.muted, fontSize: 11, marginTop: 2, fontWeight: '600' },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginTop: -22, borderWidth: 3, borderColor: colors.bg },
});
