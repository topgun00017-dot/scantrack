// Shared period selection: a month (Jan–Dec of any year) or the whole current year.
import { Icon } from './icons';
import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Chip, s } from './components';
import { colors, radius } from './theme';
import { toISO } from './utils';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function currentPeriod() {
  const now = new Date();
  return { mode: 'month', year: now.getFullYear(), month: now.getMonth() };
}

export function periodRange({ mode, year, month }) {
  if (mode === 'year') return { from: `${year}-01-01`, to: `${year}-12-31` };
  return { from: toISO(new Date(year, month, 1)), to: toISO(new Date(year, month + 1, 0)) };
}

export const periodLabel = (p) => (p.mode === 'year' ? `${p.year}` : `${MONTHS_LONG[p.month]} ${p.year}`);

// "Nov 2026 ▾" (opens a Jan–Dec grid with year arrows) and "This year".
export function PeriodPicker({ period, onChange }) {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(period.year);
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
        <Chip
          icon="calendar"
          label={`${MONTHS[period.month]} ${period.year}  ▾`}
          active={period.mode === 'month'}
          onPress={() => {
            setYear(period.year);
            setOpen(true);
          }}
        />
        <Chip label="This year" active={period.mode === 'year'} onPress={() => onChange({ ...period, mode: 'year', year: now.getFullYear() })} />
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }} onPress={() => setOpen(false)}>
          <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16 }} onPress={() => {}}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Pressable hitSlop={10} style={{ paddingHorizontal: 12 }} onPress={() => setYear((y) => y - 1)}><Icon name="chevron-left" size={26} color={colors.accentInk} /></Pressable>
              <Text style={s.h2}>{year}</Text>
              <Pressable hitSlop={10} style={{ paddingHorizontal: 12 }} onPress={() => setYear((y) => y + 1)}><Icon name="chevron-right" size={26} color={colors.accentInk} /></Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MONTHS.map((m, i) => {
                const active = period.mode === 'month' && period.year === year && period.month === i;
                const isNow = year === now.getFullYear() && i === now.getMonth();
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      onChange({ mode: 'month', year, month: i });
                      setOpen(false);
                    }}
                    style={{
                      width: '31%',
                      paddingVertical: 12,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      backgroundColor: active ? colors.accent : colors.surface2,
                      borderWidth: 1,
                      borderColor: isNow && !active ? colors.accent : 'transparent',
                    }}
                  >
                    <Text style={{ color: active ? colors.accentText : colors.text, fontWeight: '700' }}>{m}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
