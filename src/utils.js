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
        date: d.toISOString().split('T')[0],
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
  return new Date().toISOString().split('T')[0];
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
