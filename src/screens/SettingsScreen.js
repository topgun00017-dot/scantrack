// Settings: week start, completed tasks, reminders permission, start over.
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Icon } from '../icons';
import { colors, shadow } from '../theme';
import { useStore } from '../store';
import { askPermission, permissionState } from '../notify';
import { TopBar, showDialog, toast } from '../ui';

const Card = ({ children }) => <View style={[{ backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 16, marginBottom: 16 }, shadow]}>{children}</View>;
function Row({ icon, label, sub, right, onPress, last, color = colors.text }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderColor: colors.border }}>
      <Icon name={icon} size={20} color={color} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color }}>{label}</Text>
        {!!sub && <Text style={{ fontSize: 12, color: colors.sub, marginTop: 2 }}>{sub}</Text>}
      </View>
      {right}
    </Pressable>
  );
}

export default function SettingsScreen({ nav }) {
  const { tasks, lists, settings, setSettings, resetAll } = useStore();
  const [notif, setNotif] = useState(null);
  useEffect(() => {
    permissionState().then(setNotif);
  }, []);

  const allow = async () => {
    const ok = await askPermission();
    if (ok) {
      setNotif('on');
      toast('Reminders are on');
    } else Linking.openSettings();
  };

  return (
    <View style={{ flex: 1 }}>
      <TopBar onBack={nav.back} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <Text style={{ fontSize: 26, fontWeight: '600', color: colors.text, marginBottom: 16, marginLeft: 4 }}>Settings</Text>
        <Card>
          <Row
            icon="calendar-days"
            label="Week starts on"
            right={
              <View style={{ flexDirection: 'row', backgroundColor: '#F0F0F3', borderRadius: 999, padding: 3 }}>
                {[
                  [1, 'Mon'],
                  [0, 'Sun'],
                ].map(([v, l]) => (
                  <Pressable key={v} onPress={() => setSettings({ weekStart: v })} style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 999, backgroundColor: settings.weekStart === v ? colors.surface : 'transparent' }}>
                    <Text style={{ fontWeight: '600', color: settings.weekStart === v ? colors.text : colors.sub }}>{l}</Text>
                  </Pressable>
                ))}
              </View>
            }
          />
          <Row icon="eye" label="Show completed tasks" last right={<Switch value={!!settings.showCompleted} onValueChange={(v) => setSettings({ showCompleted: v })} trackColor={{ true: colors.accent }} thumbColor="#fff" />} />
        </Card>
        <Card>
          <Row
            icon="bell"
            label="Reminders"
            sub={notif === 'on' ? 'Notifications are allowed' : notif === 'web' ? 'Reminders work in the Android app' : 'Allow notifications so reminders can pop up'}
            last
            onPress={notif === 'off' ? allow : undefined}
            right={notif === 'off' ? <Text style={{ color: colors.accentDark, fontWeight: '700' }}>Allow</Text> : notif === 'on' ? <Icon name="check" size={18} color={colors.accent} /> : null}
          />
        </Card>
        <Card>
          <Row icon="list-todo" label={`${tasks.filter((t) => !t.done).length} open tasks in ${lists.length} lists`} sub={`${tasks.filter((t) => t.done).length} completed`} />
          <Row
            icon="rotate-ccw"
            label="Delete all tasks and lists"
            color={colors.danger}
            last
            onPress={() =>
              showDialog('Start over?', 'Every task and list on this phone will be deleted. This cannot be undone.', [
                { text: 'Cancel' },
                { text: 'Delete all', style: 'destructive', onPress: () => (resetAll(), toast('Everything deleted')) },
              ])
            }
          />
        </Card>
        <Text style={{ textAlign: 'center', color: colors.faint, fontSize: 12 }}>Tidy 1.0 · your tasks stay on this phone</Text>
      </ScrollView>
    </View>
  );
}
