// Pure task helpers shared by the app and the home-screen widget.
import { nextOccurrence } from './dates';

export const KEY = 'tidy:v1';
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// Ticking a repeating task keeps a done copy and moves the task on to its next date.
export function toggleIn(tasks, id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return tasks;
  if (!t.done && t.repeat && t.repeat !== 'none' && t.date) {
    const doneCopy = { ...t, id: uid(), done: true, doneAt: Date.now(), repeat: 'none', time: null };
    return [...tasks.map((x) => (x.id === id ? { ...x, date: nextOccurrence(x.date, x.repeat) } : x)), doneCopy];
  }
  return tasks.map((x) => (x.id === id ? { ...x, done: !x.done, doneAt: x.done ? null : Date.now() } : x));
}

// Sort: undone first; tasks you arranged by hand (order) in that order, ahead of the rest;
// then by date/time (no date last), then created.
export function sortTasks(a, b) {
  if (a.done !== b.done) return a.done ? 1 : -1;
  const ao = a.order != null, bo = b.order != null;
  if (ao && bo && a.order !== b.order) return a.order - b.order;
  if (ao !== bo) return ao ? -1 : 1;
  const ad = a.date || '9999', bd = b.date || '9999';
  if (ad !== bd) return ad < bd ? -1 : 1;
  const at = a.time || '99', bt = b.time || '99';
  if (at !== bt) return at < bt ? -1 : 1;
  return a.createdAt - b.createdAt;
}
