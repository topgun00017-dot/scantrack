// Add / edit a task: title, list, date, reminder, repeat, flag, link and note.
import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Icon } from './icons';
import { colors } from './theme';
import { INBOX, useStore } from './store';
import { askPermission } from './notify';
import { MonthCalendar, PillButton, Sheet, showDialog, toast } from './ui';
import { REPEATS, addDays, friendlyDate, friendlyTime, fromKey, pad, repeatLabel, todayKey } from './dates';

const blank = { title: '', listId: INBOX, date: null, time: null, repeat: 'none', flag: false, link: '', note: '' };

function Row({ icon, tint, label, value, placeholder, open, onPress, onClear }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: tint + '22', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={17} color={tint} />
      </View>
      <Text style={{ flex: 1, fontSize: 15, color: value ? colors.text : colors.faint }} numberOfLines={1}>
        {value || placeholder || label}
      </Text>
      {value && onClear ? (
        <Pressable onPress={onClear} hitSlop={10}>
          <Icon name="x" size={16} color={colors.faint} />
        </Pressable>
      ) : (
        <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.faint} />
      )}
    </Pressable>
  );
}

function Chip({ label, active, onPress, color = colors.text }) {
  return (
    <Pressable onPress={onPress} style={{ paddingVertical: 7, paddingHorizontal: 13, borderRadius: 999, backgroundColor: active ? color : '#F0F0F3' }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#fff' : colors.text }}>{label}</Text>
    </Pressable>
  );
}

const Panel = ({ children }) => <View style={{ backgroundColor: '#F7F7F9', borderRadius: 14, padding: 12, marginBottom: 6 }}>{children}</View>;

// `task`: an existing task to edit, or { ...defaults } for a new one (no id).
export default function TaskSheet({ visible, task, onClose, focus }) {
  const { lists, settings, addTask, updateTask, deleteTask } = useStore();
  const [f, setF] = useState(blank);
  const [pick, setPick] = useState(null);
  const [month, setMonth] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() });
  const isNew = !task?.id;

  useEffect(() => {
    if (!visible) return;
    const start = { ...blank, ...(task || {}) };
    setF(start);
    setPick(focus || null);
    const d = start.date ? fromKey(start.date) : new Date();
    setMonth({ y: d.getFullYear(), m: d.getMonth() });
  }, [visible, task]);

  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const toggle = (k) => setPick((p) => (p === k ? null : k));
  const list = lists.find((l) => l.id === f.listId) || lists[0];

  const setTime = async (time) => {
    if (time) {
      const ok = await askPermission();
      if (!ok && Platform.OS !== 'web') toast('Turn on notifications for Tidy to get reminders');
    }
    set({ time, date: time && !f.date ? todayKey() : f.date });
  };
  const pickClock = () => {
    const now = new Date();
    const base = f.time ? new Date(2000, 0, 1, ...f.time.split(':').map(Number)) : new Date(2000, 0, 1, now.getHours() + 1, 0);
    DateTimePickerAndroid.open({ value: base, mode: 'time', is24Hour: false, onValueChange: (_e, d) => d && setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`) });
  };

  const save = () => {
    const title = f.title.trim();
    if (!title) return showDialog('Add a title', 'Type what you need to do first.');
    const out = { ...f, title, link: f.link.trim(), note: f.note.trim() };
    if (!out.date) {
      out.time = null;
      out.repeat = 'none';
    }
    if (isNew) {
      addTask(out);
      toast('Task added');
    } else updateTask(task.id, out);
    onClose();
  };
  const remove = () =>
    showDialog('Delete task?', `"${f.title}" will be removed.`, [
      { text: 'Cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTask(task.id);
          onClose();
        },
      },
    ]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={isNew ? 'New task' : 'Edit task'}
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 8 }}>
          {!isNew && (
            <Pressable onPress={remove} hitSlop={8} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#FDECEC', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="trash" size={20} color={colors.danger} />
            </Pressable>
          )}
          <PillButton title={isNew ? 'Add task' : 'Save'} onPress={save} />
        </View>
      }
    >
      <TextInput
        value={f.title}
        onChangeText={(title) => set({ title })}
        placeholder="What do you need to do?"
        placeholderTextColor={colors.faint}
        autoFocus={isNew && !focus}
        multiline
        style={{ fontSize: 19, fontWeight: '500', color: colors.text, paddingVertical: 10, marginBottom: 6 }}
      />

      <Row icon={list.icon} tint={list.color} label="List" value={list.name} open={pick === 'list'} onPress={() => toggle('list')} />
      {pick === 'list' && (
        <Panel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {lists.map((l) => (
              <Chip key={l.id} label={l.name} active={l.id === f.listId} color={l.color} onPress={() => (set({ listId: l.id }), setPick(null))} />
            ))}
          </View>
        </Panel>
      )}

      <Row icon="calendar" tint="#4F7BE8" label="Date" placeholder="No date" value={f.date ? friendlyDate(f.date).replace(/^./, (c) => c.toUpperCase()) : ''} open={pick === 'date'} onPress={() => toggle('date')} onClear={() => set({ date: null, time: null, repeat: 'none' })} />
      {pick === 'date' && (
        <Panel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {[
              ['Today', todayKey()],
              ['Tomorrow', addDays(todayKey(), 1)],
              ['Next week', addDays(todayKey(), 7)],
            ].map(([lab, k]) => (
              <Chip key={lab} label={lab} active={f.date === k} onPress={() => (set({ date: k }), setPick(null))} />
            ))}
          </View>
          <MonthCalendar month={month} setMonth={setMonth} selected={f.date} weekStart={settings.weekStart} onSelect={(k) => (set({ date: k }), setPick(null))} />
        </Panel>
      )}

      <Row icon={f.time ? 'bell' : 'bell-off'} tint="#E08A2C" label="Reminder" placeholder="No reminder" value={f.time ? `${friendlyTime(f.time)}${f.date ? ', ' + friendlyDate(f.date) : ''}` : ''} open={pick === 'time'} onPress={() => toggle('time')} onClear={() => set({ time: null })} />
      {pick === 'time' && (
        <Panel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {['09:00', '12:00', '15:00', '18:00', '21:00'].map((t) => (
              <Chip key={t} label={friendlyTime(t)} active={f.time === t} onPress={() => (setTime(t), setPick(null))} />
            ))}
            {Platform.OS === 'android' && <Chip label="Pick a time…" onPress={pickClock} />}
          </View>
          {Platform.OS === 'web' && (
            <TextInput
              placeholder="Or type a time, e.g. 14:30"
              placeholderTextColor={colors.faint}
              onSubmitEditing={(e) => {
                const m = /^(\d{1,2}):(\d{2})$/.exec(e.nativeEvent.text.trim());
                if (m && +m[1] < 24 && +m[2] < 60) setTime(`${pad(+m[1])}:${m[2]}`);
              }}
              style={{ marginTop: 10, backgroundColor: '#fff', borderRadius: 10, padding: 10, color: colors.text }}
            />
          )}
          <Text style={{ fontSize: 12, color: colors.sub, marginTop: 10 }}>Tidy will notify you at this time{f.date ? ` on ${friendlyDate(f.date)}` : ' today'}.</Text>
        </Panel>
      )}

      <Row icon="repeat" tint="#2BA3B5" label="Repeat" value={f.repeat !== 'none' ? repeatLabel(f.repeat) : ''} placeholder="Does not repeat" open={pick === 'repeat'} onPress={() => toggle('repeat')} onClear={() => set({ repeat: 'none' })} />
      {pick === 'repeat' && (
        <Panel>
          {REPEATS.map((r) => (
            <Pressable key={r.key} onPress={() => (set({ repeat: r.key, date: r.key !== 'none' && !f.date ? todayKey() : f.date }), setPick(null))} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9 }}>
              <Text style={{ fontSize: 15, color: colors.text }}>{r.label}</Text>
              {f.repeat === r.key && <Icon name="check" size={18} color={colors.accent} />}
            </Pressable>
          ))}
        </Panel>
      )}

      <Row icon="flag" tint={colors.danger} label="Flag" value={f.flag ? 'Flagged as important' : ''} placeholder="Not flagged" onPress={() => set({ flag: !f.flag })} onClear={() => set({ flag: false })} />

      <Row icon="link" tint="#4F7BE8" label="Link" placeholder="Add a link" value={f.link && pick !== 'link' ? f.link : ''} open={pick === 'link'} onPress={() => toggle('link')} />
      {pick === 'link' && (
        <Panel>
          <TextInput value={f.link} onChangeText={(link) => set({ link })} placeholder="https://" placeholderTextColor={colors.faint} autoCapitalize="none" keyboardType="url" autoFocus style={{ fontSize: 15, color: colors.text, paddingVertical: 4 }} />
          {/^https?:\/\//.test(f.link.trim()) && (
            <Pressable onPress={() => Linking.openURL(f.link.trim())} style={{ marginTop: 8 }}>
              <Text style={{ color: '#4F7BE8', fontWeight: '600' }}>Open link</Text>
            </Pressable>
          )}
        </Panel>
      )}

      <Row icon="file-text" tint="#D9468F" label="Note" placeholder="Add a note" value={f.note && pick !== 'note' ? f.note.split('\n')[0] : ''} open={pick === 'note'} onPress={() => toggle('note')} />
      {pick === 'note' && (
        <Panel>
          <TextInput value={f.note} onChangeText={(note) => set({ note })} placeholder="Details, steps, anything" placeholderTextColor={colors.faint} multiline autoFocus style={{ fontSize: 15, color: colors.text, minHeight: 80, textAlignVertical: 'top' }} />
        </Panel>
      )}
    </Sheet>
  );
}
