export function formatDate(isoDateStr) {
  const d = new Date(isoDateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function formatTimer(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(seconds) {
  return `${Math.floor(seconds / 60)} min`;
}

export function formatVolume(lbs) {
  return lbs > 0 ? `${lbs.toLocaleString()} lb` : '—';
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Calendar dates ──────────────────────────────────────────────────────────
//
// Dates are stored as 'YYYY-MM-DD' strings meaning the user's *local* calendar
// day. They must never come from toISOString(), which gives the UTC date: east
// of UTC that turns local midnight into the previous day, and west of UTC it
// turns a late evening into tomorrow.

/** The local calendar date of a Date, as 'YYYY-MM-DD'. */
export function localISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Shift a 'YYYY-MM-DD' date by whole days, in calendar terms. */
export function addDaysISO(iso, days) {
  // Noon, not midnight: some zones change clocks at midnight, so local
  // midnight can fail to exist on the day being parsed.
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return localISO(d);
}

export function generateSchedule(plan, startDateStr) {
  const schedule = [];
  const start = new Date(startDateStr + 'T00:00:00');
  const dow = start.getDay();
  const monday = new Date(start);
  monday.setDate(start.getDate() + (dow === 0 ? -6 : 1 - dow));

  for (let week = 0; week < plan.weeks; week++) {
    plan.schedule.forEach((dayOffset, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + week * 7 + dayOffset);
      if (d < start) return;
      schedule.push({
        date: localISO(d),
        dayName: plan.dayNames[idx % plan.dayNames.length],
        week: week + 1,
        skipped: false,
        done: false,
      });
    });
  }
  return schedule;
}

export function todayISO() {
  return localISO(new Date());
}

/**
 * Put back plan dates written by the old UTC-based generateSchedule.
 *
 * Anywhere east of UTC that code stored each session one day early. Only the
 * entries generated while the offset was positive were affected, so a plan
 * that crosses a clock change can be part-shifted, part-correct — this works
 * entry by entry rather than trusting the whole plan to be one or the other.
 *
 * It only rewrites a schedule that is recognisably this bug: same length and
 * sessions as the plan's definition regenerates to, every date either correct
 * or exactly one day early, and at least one early. Anything else is left
 * alone. Returns the plan unchanged (same object) when there is nothing to do.
 */
export function repairShiftedSchedule(activePlan, planDef) {
  const stored = activePlan?.schedule;
  if (!stored?.length || !activePlan.startDate || !planDef) return activePlan;

  const expected = generateSchedule(planDef, activePlan.startDate);
  if (expected.length !== stored.length) return activePlan;

  let shifted = 0;
  for (let i = 0; i < stored.length; i++) {
    const s = stored[i], e = expected[i];
    if (s.dayName !== e.dayName || s.week !== e.week) return activePlan;
    if (s.date === e.date) continue;
    if (addDaysISO(s.date, 1) !== e.date) return activePlan;
    shifted++;
  }
  if (!shifted) return activePlan;

  // Only the date moves; done/skipped stay with the session they belong to.
  return {
    ...activePlan,
    schedule: stored.map((s, i) => ({ ...s, date: expected[i].date })),
  };
}

export function convertWeight(value, fromUnit, toUnit) {
  if (!value || fromUnit === toUnit) return value;
  const num = parseFloat(value);
  if (isNaN(num) || num === 0) return value;
  if (fromUnit === 'lb' && toUnit === 'kg') return String(Math.round(num / 2.2046 * 10) / 10);
  if (fromUnit === 'kg' && toUnit === 'lb') return String(Math.round(num * 2.2046 * 10) / 10);
  return value;
}

import { MOVEMENTS } from './data/movements';

const _movementMap = new Map(MOVEMENTS.map(m => [m.name.toLowerCase(), m]));

export function getDefaultUnit(movementName) {
  const m = _movementMap.get(movementName.toLowerCase());
  if (m) return m.equipment.includes('Barbell') ? 'kg' : 'lb';
  // Fallback for exercises not in the library (e.g. from exercise map strings)
  const lower = movementName.toLowerCase();
  const isBarbell = lower.includes('barbell') || lower.includes('deadlift') ||
    lower.includes('squat') || lower.includes('bench') || lower.includes('ohp') ||
    lower.includes('press') || lower.includes('romanian') || lower.includes('rdl') ||
    lower.includes('clean') || lower.includes('snatch') || lower.includes('row');
  return isBarbell ? 'kg' : 'lb';
}
