// Reminders: after any change we clear the scheduled notifications and schedule the next
// ones again from the task list (repeating tasks expanded ahead), so they never go stale.
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { fromKey, nextOccurrence } from './dates';

const isWeb = Platform.OS === 'web';
const LIMIT = 50; // Android keeps at most ~500 alarms per app; 50 upcoming is plenty
let channelReady = false;

if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

async function ensureChannel() {
  if (isWeb || channelReady) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Task reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 150, 250],
    });
  }
  channelReady = true;
}

// Ask once, the first time a reminder is set. Returns true if allowed.
export async function askPermission() {
  if (isWeb) return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const res = await Notifications.requestPermissionsAsync();
  return !!res.granted;
}

const at = (dateKey, time) => {
  const d = fromKey(dateKey);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};

export async function syncReminders(tasks, lists) {
  if (isWeb) return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!perm.granted) return;
    await ensureChannel();
    const now = Date.now();
    const upcoming = [];
    for (const t of tasks) {
      if (t.done || !t.date || !t.time) continue;
      let key = t.date;
      for (let i = 0; i < 30 && key; i++) {
        const when = at(key, t.time);
        if (when.getTime() > now) {
          upcoming.push({ t, when });
          if (!t.repeat || t.repeat === 'none') break;
          if (upcoming.length > LIMIT * 3) break;
        }
        key = t.repeat && t.repeat !== 'none' ? nextOccurrence(key, t.repeat) : null;
      }
    }
    upcoming.sort((a, b) => a.when - b.when);
    for (const { t, when } of upcoming.slice(0, LIMIT)) {
      const list = lists.find((l) => l.id === t.listId);
      await Notifications.scheduleNotificationAsync({
        content: { title: t.title, body: list ? list.name : 'Reminder', data: { taskId: t.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: 'reminders' },
      });
    }
  } catch (e) {
    // reminders are best effort; never break the app over them
  }
}

export async function permissionState() {
  if (isWeb) return 'web';
  try {
    return (await Notifications.getPermissionsAsync()).granted ? 'on' : 'off';
  } catch {
    return 'off';
  }
}
