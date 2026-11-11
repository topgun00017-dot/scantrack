// Shared period selection: one or more months of a year (e.g. Nov + Dec), or the whole year.
// period = { mode: 'month', year, months: [10, 11] }  or  { mode: 'year', year }
import { Icon } from './icons';
import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { Button, Chip, s } from './components';
import { colors, radius } from './theme';
import { toISO } from './utils';

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Older code stored a single `month`; treat it as a one-month list.
const monthsOf = (p) => (p.months && p.months.length ? [...p.months].sort((a, b) => a - b) : [p.month ?? new Date().getMonth()]);

export function currentPeriod() {
  const now = new Date();
  return { mode: 'month', year: now.getFullYear(), months: [now.getMonth()] };
}

// Date span covering the period (first selected month to last).
export function periodRange(p) {
  if (p.mode === 'year') return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
  const ms = monthsOf(p);
  return { from: toISO(new Date(p.year, ms[0], 1)), to: toISO(new Date(p.year, ms[ms.length - 1] + 1, 0)) };
}

// True if a YYYY-MM-DD date falls in the period (handles gaps such as Jan + Mar).
export function inPeriod(p, iso) {
  if (!iso) return false;
  const [y, m] = iso.split('-').map(Number);
  if (y !== p.year) return false;
  return p.mode === 'year' || monthsOf(p).includes(m - 1);
}

const consecutive = (ms) => ms.every((m, i) => i === 0 || m === ms[i - 1] + 1);

function monthsText(p, names) {
  const ms = monthsOf(p);
  if (ms.length === 1) return `${names[ms[0]]} ${p.year}`;
  if (ms.length === 12) return `${p.year}`;
  if (consecutive(ms)) return `${names[ms[0]]} – ${names[ms[ms.length - 1]]} ${p.year}`;
  if (ms.length <= 3) return `${ms.map((m) => MONTHS[m]).join(', ')} ${p.year}`;
  return `${ms.length} months of ${p.year}`;
}

export const periodLabel = (p) => (p.mode === 'year' ? `${p.year}` : monthsText(p, MONTHS_LONG));
const shortLabel = (p) => monthsText(p, MONTHS);

// "Nov – Dec 2026 ▾" (opens a Jan–Dec grid: tap months to pick one or more, then Apply) and "This year".
export function PeriodPicker({ period, onChange }) {
  const now = new Date();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(period.year);
  const [picked, setPicked] = useState([]);

  const openPicker = () => {
    setYear(period.year);
    setPicked(period.mode === 'month' ? monthsOf(period) : []);
    setOpen(true);
  };
  const changeYear = (d) => {
    setYear((y) => y + d);
    setPicked([]); // a selection belongs to one year
  };
  const toggle = (i) => setPicked((ps) => (ps.includes(i) ? ps.filter((x) => x !== i) : [...ps, i].sort((a, b) => a - b)));
  const apply = () => {
    if (!picked.length) return;
    onChange({ mode: 'month', year, months: picked });
    setOpen(false);
  };

  return (
    <>
      <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
        <Chip icon="calendar" label={`${period.mode === 'month' ? shortLabel(period) : `${MONTHS[now.getMonth()]} ${now.getFullYear()}`}  ▾`} active={period.mode === 'month'} onPress={openPicker} />
        <Chip label="This year" active={period.mode === 'year'} onPress={() => onChange({ mode: 'year', year: now.getFullYear(), months: monthsOf(period) })} />
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }} onPress={() => setOpen(false)}>
          <Pressable style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16 }} onPress={() => {}}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Pressable hitSlop={10} style={{ paddingHorizontal: 12 }} onPress={() => changeYear(-1)}>
                <Icon name="chevron-left" size={26} color={colors.accentInk} />
              </Pressable>
              <Text style={s.h2}>{year}</Text>
              <Pressable hitSlop={10} style={{ paddingHorizontal: 12 }} onPress={() => changeYear(1)}>
                <Icon name="chevron-right" size={26} color={colors.accentInk} />
              </Pressable>
            </View>
            <Text style={[s.sub, { textAlign: 'center', marginBottom: 12 }]}>Tap one or more months</Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {MONTHS.map((m, i) => {
                const on = picked.includes(i);
                const isNow = year === now.getFullYear() && i === now.getMonth();
                return (
                  <Pressable
                    key={m}
                    onPress={() => toggle(i)}
                    style={{
                      width: '31%',
                      paddingVertical: 12,
                      borderRadius: radius.md,
                      alignItems: 'center',
                      flexDirection: 'row',
                      justifyContent: 'center',
                      gap: 4,
                      backgroundColor: on ? colors.accent : colors.surface2,
                      borderWidth: 1,
                      borderColor: isNow && !on ? colors.accent : 'transparent',
                    }}
                  >
                    {on && <Icon name="check" size={14} color={colors.accentText} />}
                    <Text style={{ color: on ? colors.accentText : colors.text, fontWeight: '700' }}>{m}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <Button small title="Clear" variant="secondary" style={{ flex: 1 }} disabled={!picked.length} onPress={() => setPicked([])} />
              <Button
                small
                title={picked.length ? `Apply · ${picked.length} month${picked.length > 1 ? 's' : ''}` : 'Pick a month'}
                style={{ flex: 2 }}
                disabled={!picked.length}
                onPress={apply}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
