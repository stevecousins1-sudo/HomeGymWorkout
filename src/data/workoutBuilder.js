import { MOVEMENTS } from './movements';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function equipBucket(equipment) {
  if (equipment.includes('Barbell')) return 'barbell';
  if (equipment.includes('Pull-up bar')) return 'pullup';
  if (equipment.includes('Cable')) return 'cable';
  if (equipment.includes('Machine')) return 'machine';
  if (equipment.includes('Dumbbell')) return 'dumbbell';
  return 'bodyweight';
}

function isCompound(movement) {
  const lower = movement.name.toLowerCase();
  const multiJointWords = [
    'press', 'squat', 'deadlift', ' row', 'pull-up', 'chin-up',
    'pulldown', 'dip', 'lunge', 'thrust', 'bridge', 'step-up',
    'split squat', 'push press', 'ohp', 'good morning', 'rack pull',
  ];
  return multiJointWords.some(w => lower.includes(w));
}

const SUPPORT_CAT = {
  Chest: 'Arms',
  Back: 'Arms',
  Shoulders: 'Arms',
  Legs: 'Core',
  Arms: null,
  Core: null,
};

function pickSupportExercise(primaryCat, usedNames, library) {
  const supportCat = SUPPORT_CAT[primaryCat];
  if (!supportCat) return null;
  const pool = shuffle(library.filter(m => m.category === supportCat && !usedNames.has(m.name)));
  if (primaryCat === 'Chest') {
    const tricep = pool.find(m => {
      const l = m.name.toLowerCase();
      return l.includes('tricep') || l.includes('skull') || l.includes('close grip') || l.includes('dip') || l.includes('kickback');
    });
    return tricep || pool[0] || null;
  }
  if (primaryCat === 'Back') {
    const bicep = pool.find(m => {
      const l = m.name.toLowerCase();
      return l.includes('curl') || l.includes('bicep') || l.includes('hammer');
    });
    return bicep || pool[0] || null;
  }
  return pool[0] || null;
}

function prescriptionFor(movement, position) {
  const compound = isCompound(movement);
  const barbell = movement.equipment.includes('Barbell');
  if (position === 0) {
    if (barbell && compound) return '5×5';
    if (compound)             return '4×8';
    return '4×12';
  }
  if (position === 1) return compound ? '4×8'  : '3×12';
  if (position === 2) return '4×10';
  if (position === 3) return '3×12';
  if (position === 4) return '3×12';
  return '3×15';
}

/**
 * Build a ~1 hour workout starting with the selected movement.
 * Movements are randomised each call so you get variety.
 *
 * `customMovements` are the user's own additions; they're drawn from on equal
 * terms with the built-in library, so a workout built around one of your
 * movements can use your others as accessories.
 */
export function buildWorkoutFromMovement(primary, customMovements = []) {
  const library     = [...MOVEMENTS, ...customMovements];
  const usedNames   = new Set([primary.name]);
  const usedBuckets = new Set([equipBucket(primary.equipment)]);

  // Shuffle so every workout is different
  const sameCat = shuffle(
    library.filter(m => m.category === primary.category && m.name !== primary.name)
  );

  const picked = [];

  // First pass: prefer different equipment buckets for variety
  for (const m of sameCat) {
    if (picked.length >= 4) break;
    const bucket = equipBucket(m.equipment);
    if (!usedBuckets.has(bucket)) {
      picked.push(m);
      usedBuckets.add(bucket);
      usedNames.add(m.name);
    }
  }

  // Second pass: fill remaining slots with any unused movement
  for (const m of sameCat) {
    if (picked.length >= 4) break;
    if (!usedNames.has(m.name)) {
      picked.push(m);
      usedNames.add(m.name);
    }
  }

  const support = pickSupportExercise(primary.category, usedNames, library);
  const exercises = [primary, ...picked.slice(0, 4), ...(support ? [support] : [])];

  return exercises.map((ex, i) => `${ex.name} — ${prescriptionFor(ex, i)}`);
}

export function workoutNameForMovement(movement) {
  return `${movement.category} Day`;
}
