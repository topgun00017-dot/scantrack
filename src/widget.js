// Home-screen widget (Android): today's and overdue tasks. Tap the circle to tick a task off,
// tap a task or the title to open Tidy, tap + to add a task.
import React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FlexWidget, ListWidget, SvgWidget, TextWidget, requestWidgetUpdate } from 'react-native-android-widget';
import { KEY, sortTasks, toggleIn } from './core';
import { friendlyDate, friendlyTime, todayKey, DAYS_SHORT, MONTHS_SHORT } from './dates';

export const WIDGET_NAME = 'TidyToday';

const C = { bg: '#FFFFFF', text: '#1D1D1F', sub: '#6E6E73', faint: '#AEAEB2', line: '#EFEFF2', red: '#E5484D', green: '#7CB342' };

const circle = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="9.2" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
const plus = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><circle cx="14" cy="14" r="14" fill="${C.green}"/><path d="M14 8v12M8 14h12" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;

// What the widget shows: undone tasks dated today or earlier.
export function widgetTasks(data) {
  const t = todayKey();
  return (data?.tasks || []).filter((x) => !x.done && x.date && x.date <= t).sort(sortTasks);
}

function Row({ task, list }) {
  const t = todayKey();
  const overdue = task.date < t;
  const sub = [list?.name, overdue ? friendlyDate(task.date) : null, task.time ? friendlyTime(task.time) : null].filter(Boolean).join(' · ');
  return (
    <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', paddingVertical: 7, paddingHorizontal: 14 }}>
      <SvgWidget svg={circle(overdue ? C.red : C.faint)} style={{ width: 22, height: 22 }} clickAction="TOGGLE" clickActionData={{ id: task.id }} />
      <FlexWidget style={{ flex: 1, marginLeft: 12 }} clickAction="OPEN_APP">
        <TextWidget text={task.title} maxLines={1} truncate="END" style={{ fontSize: 14, color: C.text }} />
        {!!sub && <TextWidget text={sub} maxLines={1} truncate="END" style={{ fontSize: 11, color: overdue ? C.red : list?.color && /^#[0-9A-Fa-f]{6}$/.test(list.color) ? list.color : C.sub, marginTop: 1 }} />}
      </FlexWidget>
    </FlexWidget>
  );
}

export function TodayWidget({ data }) {
  const tasks = widgetTasks(data);
  const lists = data?.lists || [];
  const now = new Date();
  return (
    <FlexWidget style={{ height: 'match_parent', width: 'match_parent', backgroundColor: C.bg, borderRadius: 22, flexDirection: 'column' }}>
      <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', width: 'match_parent', paddingTop: 12, paddingBottom: 6, paddingHorizontal: 14 }}>
        <FlexWidget style={{ flex: 1 }} clickAction="OPEN_APP">
          <TextWidget text="Today" style={{ fontSize: 17, fontWeight: '600', color: C.text }} />
          <TextWidget text={`${DAYS_SHORT[now.getDay()]} ${now.getDate()} ${MONTHS_SHORT[now.getMonth()]} · ${tasks.length} task${tasks.length === 1 ? '' : 's'}`} style={{ fontSize: 11, color: C.sub, marginTop: 1 }} />
        </FlexWidget>
        <SvgWidget svg={plus} style={{ width: 30, height: 30 }} clickAction="OPEN_URI" clickActionData={{ uri: 'tidy://add' }} />
      </FlexWidget>
      {tasks.length ? (
        <ListWidget style={{ height: 'match_parent', width: 'match_parent' }}>
          {tasks.slice(0, 40).map((task) => (
            <Row key={task.id} task={task} list={lists.find((l) => l.id === task.listId)} />
          ))}
        </ListWidget>
      ) : (
        <FlexWidget style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }} clickAction="OPEN_APP">
          <TextWidget text="All clear for today" style={{ fontSize: 14, color: C.sub }} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}

async function load() {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) || 'null');
  } catch {
    return null;
  }
}

// Runs in the background when the widget is added, refreshed, or tapped.
export async function widgetTaskHandler({ widgetAction, clickAction, clickActionData, renderWidget }) {
  let data = await load();
  if (widgetAction === 'WIDGET_CLICK' && clickAction === 'TOGGLE' && data && clickActionData?.id) {
    data = { ...data, tasks: toggleIn(data.tasks, clickActionData.id) };
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
  }
  if (widgetAction === 'WIDGET_DELETED') return;
  renderWidget(<TodayWidget data={data} />);
}

// Called by the app after every change.
export function updateWidgets(data) {
  if (Platform.OS !== 'android') return;
  requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: () => <TodayWidget data={data} /> }).catch(() => {});
}
