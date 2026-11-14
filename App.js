import React, { useState } from 'react';
import { Actions } from './src/actions';
import { todayKey } from './src/dates';
import { BackHandler, Linking, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StoreProvider } from './src/store';
import { colors } from './src/theme';
import { DialogHost, ToastHost } from './src/ui';
import TaskSheet from './src/TaskSheet';
import ListSheet from './src/ListSheet';
import QuickAdd from './src/QuickAdd';
import HomeScreen from './src/screens/HomeScreen';
import ListScreen from './src/screens/ListScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import SearchScreen from './src/screens/SearchScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const SCREENS = { home: HomeScreen, list: ListScreen, calendar: CalendarScreen, search: SearchScreen, settings: SettingsScreen };

function Shell() {
  const [stack, setStack] = useState([{ name: 'home', params: {} }]);
  const [taskSheet, setTaskSheet] = useState(null); // { task, focus }
  const [quick, setQuick] = useState(null); // defaults for a new task
  const [listSheet, setListSheet] = useState(null); // { list, onDeleted }

  const nav = {
    push: (name, params = {}) => setStack((s) => [...s, { name, params }]),
    back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
  };
  // After adding a task: close the input and show Today.
  const goToday = () => setStack([{ name: 'home', params: {} }, { name: 'list', params: { kind: 'today' } }]);
  const actions = {
    openTask: (task, focus) => setTaskSheet({ task, focus }),
    // New tasks are dated today unless the screen says otherwise, so they show on Today.
    quickAdd: (defaults) => setQuick({ date: todayKey(), ...(defaults || {}) }),
    editList: (list, onDeleted) => setListSheet({ list, onDeleted }),
  };

  // The widget's + button opens tidy://add → quick add.
  React.useEffect(() => {
    const handle = (url) => url && url.startsWith('tidy://add') && setQuick({ date: todayKey() });
    Linking.getInitialURL().then(handle).catch(() => {});
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);

  // Android back button closes a screen before leaving the app.
  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) {
        nav.back();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [stack.length]);

  const top = stack[stack.length - 1];
  const Screen = SCREENS[top.name];
  return (
    <Actions.Provider value={actions}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'left', 'right']}>
        <View style={{ flex: 1 }}>
          <Screen key={stack.length + top.name + JSON.stringify(top.params)} nav={nav} params={top.params} />
        </View>
      </SafeAreaView>
      <QuickAdd
        visible={!!quick}
        defaults={quick || {}}
        onClose={() => setQuick(null)}
        onAdded={() => {
          setQuick(null);
          goToday();
        }}
        onDetails={(draft, focus) => {
          setQuick(null);
          setTaskSheet({ task: draft, focus });
        }}
      />
      <TaskSheet visible={!!taskSheet} task={taskSheet?.task} focus={taskSheet?.focus} onClose={() => setTaskSheet(null)} onAdded={goToday} />
      <ListSheet visible={!!listSheet} list={listSheet?.list} onDeleted={listSheet?.onDeleted} onClose={() => setListSheet(null)} />
      <ToastHost />
      <DialogHost />
    </Actions.Provider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}
