import { MOVEMENTS } from './movements';

export const GOALS = [
  { id: 'strength',    label: 'Strength',    focusKey: 'str', desc: 'Build raw strength with heavy compound lifts' },
  { id: 'hypertrophy', label: 'Hypertrophy', focusKey: 'hyp', desc: 'Maximise muscle size with moderate weight and volume' },
  { id: 'fat_loss',    label: 'Fat Loss',    focusKey: 'fat', desc: 'Burn calories with high-rep, circuit-style training' },
  { id: 'beginner',    label: 'Beginner',    focusKey: 'beg', desc: 'Learn the basics with simple, effective movements' },
];

export const MUSCLE_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

const SPLITS = {
  2: { offsets: [0, 3], pattern: ['full', 'full'] },
  3: { offsets: [0, 2, 4], pattern: ['full', 'full', 'full'] },
  4: { offsets: [0, 1, 3, 4], pattern: ['upper', 'lower', 'upper', 'lower'] },
  5: { offsets: [0, 1, 2, 3, 4], pattern: ['push', 'pull', 'legs', 'upper', 'full'] },
  6: { offsets: [0, 1, 2, 3, 4, 5], pattern: ['push', 'pull', 'legs', 'push', 'pull', 'legs'] },
};

const DAY_CATS = {
  push:  ['Chest', 'Shoulders', 'Arms'],
  pull:  ['Back', 'Arms'],
  legs:  ['Legs', 'Core'],
  upper: ['Chest', 'Back', 'Shoulders', 'Arms'],
  lower: ['Legs', 'Core'],
  full:  ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'],
};

const DAY_LABEL_POOLS = {
  push:  ['Push A', 'Push B', 'Push C'],
  pull:  ['Pull A', 'Pull B', 'Pull C'],
  legs:  ['Legs A', 'Legs B', 'Legs C'],
  upper: ['Upper A', 'Upper B', 'Upper C'],
  lower: ['Lower A', 'Lower B', 'Lower C'],
  full:  ['Full Body A', 'Full Body B', 'Full Body C'],
};

const PRESC = {
  strength:    { p0: '5×5', p1: '4×6', p2: '3×8' },
  hypertrophy: { p0: '4×8', p1: '3×10', p2: '3×12' },
  fat_loss:    { p0: '3×15', p1: '3×15', p2: '4×20' },
  beginner:    { p0: '3×10', p1: '3×10', p2: '3×12' },
};

const EX_COUNTS = {
  strength: 5,
  hypertrophy: 6,
  fat_loss: 6,
  beginner: 4,
};

function equipScore(m, goal) {
  const eq = m.equipment;
  const hasBarbell    = eq.includes('Barbell');
  const hasDumbbell   = eq.includes('Dumbbell');
  const hasBodyweight = eq.includes('Bodyweight');
  const hasCable      = eq.includes('Cable');

  if (goal === 'strength') {
    if (hasBarbell)    return 4;
    if (hasBodyweight) return 2;
    if (hasDumbbell)   return 1;
    return 1;
  }
  if (goal === 'hypertrophy') {
    if (hasBarbell || hasDumbbell) return 3;
    if (hasCable || hasBodyweight) return 2;
    return 1;
  }
  if (goal === 'fat_loss') {
    if (hasBodyweight) return 4;
    if (hasDumbbell)   return 3;
    if (hasCable)      return 2;
    return 1;
  }
  // beginner
  if (hasBodyweight) return 4;
  if (hasBarbell)    return 3;
  if (hasDumbbell)   return 2;
  return 1;
}

function pickExercises(categories, focus, goal, count, hasMachines = true, library = MOVEMENTS) {
  let pool = library.filter(m => categories.includes(m.category));
  if (!hasMachines) pool = pool.filter(m => m.equipment !== 'Machine');
  const scored = pool.map(m => ({
    m,
    score: (focus.includes(m.category) ? 2 : 1) * equipScore(m, goal) + Math.random() * 0.4,
  })).sort((a, b) => b.score - a.score);

  const picked = [];
  const seen = new Set();
  for (const { m } of scored) {
    if (seen.has(m.name)) continue;
    seen.add(m.name);
    picked.push(m);
    if (picked.length >= count) break;
  }
  return picked;
}

function prescribe(idx, goal) {
  const p = PRESC[goal];
  if (idx === 0) return p.p0;
  if (idx === 1) return p.p1;
  return p.p2;
}

export function buildCustomPlan({ goal, focus, daysPerWeek, weeks, name, hasMachines = true, customMovements = [] }) {
  // A generated plan should be buildable from the equipment you actually have,
  // which includes whatever movements you've added yourself.
  const library = [...MOVEMENTS, ...customMovements];
  const split = SPLITS[daysPerWeek] || SPLITS[3];
  const patterns = split.pattern;
  const exCount = EX_COUNTS[goal] || 5;

  // Assign unique day names per type
  const typeCounts = {};
  const dayNames = patterns.map(type => {
    const n = typeCounts[type] || 0;
    typeCounts[type] = n + 1;
    const labels = DAY_LABEL_POOLS[type];
    return labels[n] || `${type.charAt(0).toUpperCase() + type.slice(1)} ${n + 1}`;
  });

  // Generate exercise templates (by unique day name)
  const exerciseTemplates = {};
  for (let i = 0; i < patterns.length; i++) {
    const dayName = dayNames[i];
    if (exerciseTemplates[dayName]) continue; // same day name already built
    const cats = DAY_CATS[patterns[i]];
    const exercises = pickExercises(cats, focus, goal, exCount, hasMachines, library);
    exerciseTemplates[dayName] = exercises.map((ex, j) => `${ex.name} — ${prescribe(j, goal)}`);
  }

  const goalObj = GOALS.find(g => g.id === goal);

  return {
    id: `custom_${Date.now()}`,
    name,
    focus: goalObj?.focusKey || 'hyp',
    description: `Custom ${goalObj?.label || ''} plan · ${daysPerWeek} days/week · ${weeks} weeks`,
    daysPerWeek,
    weeks,
    schedule: split.offsets,
    dayNames,
    exerciseTemplates,
    isCustom: true,
  };
}
