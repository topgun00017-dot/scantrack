import { Icon } from './src/icons';
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StoreProvider, useStore } from './src/store';
import { colors } from './src/theme';
import DialogHost from './src/DialogHost';
import ToastHost from './src/Toast';

import HomeScreen from './src/screens/HomeScreen';
import ReceiptsScreen from './src/screens/ReceiptsScreen';
import ScanScreen from './src/screens/ScanScreen';
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
  { key: 'receipts', label: 'Receipts', icon: 'receipt', comp: ReceiptsScreen },
  { key: 'scan', label: 'Scan', icon: 'camera', comp: ScanScreen, center: true },
  { key: 'agent', label: 'Assistant', icon: 'sparkles', comp: AgentScreen },
  { key: 'more', label: 'More', icon: 'menu', comp: MoreScreen },
];

const STACK = {
  receipt: ReceiptEditScreen,
  reports: ReportsScreen,
  report: ReportDetailScreen,
  export: ExportScreen,
  accounting: AccountingScreen,
  settings: SettingsScreen,
  insights: InsightsScreen,
};

function Shell() {
  const { ready } = useStore();
  const [tab, setTab] = useState('home');
  const [stack, setStack] = useState([]); // [{ name, params }]

  const nav = {
    push: (name, params = {}) => setStack((st) => [...st, { name, params }]),
    back: () => setStack((st) => st.slice(0, -1)),
    replace: (name, params = {}) => setStack((st) => [...st.slice(0, -1), { name, params }]),
    tab: (key) => {
      setStack([]);
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
        {StackComp ? <StackComp key={stack.length} nav={nav} params={top.params} /> : <TabComp nav={nav} />}
      </View>
      {!StackComp && (
        <SafeAreaView edges={['bottom']} style={styles.tabbar}>
          {TABS.map((t) => {
            const active = t.key === tab;
            if (t.center) {
              return (
                <Pressable key={t.key} onPress={() => nav.tab(t.key)} style={styles.tab}>
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
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <Shell />
        <ToastHost />
        <DialogHost />
      </StoreProvider>
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
