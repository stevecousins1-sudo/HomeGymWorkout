import { MOVEMENTS } from './movements';

// Broad equipment buckets for diversity selection
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

// Category → supporting muscle to add at end of session
const SUPPORT_CAT = {
  Chest: 'Arms',
  Back: 'Arms',
  Shoulders: 'Arms',
  Legs: 'Core',
  Arms: null,
  Core: null,
};

// Pick a support exercise that complements the main category
// For Chest/Arms: prefer triceps; for Back/Arms: prefer biceps
function pickSupportExercise(primaryCat, usedNames) {
  const supportCat = SUPPORT_CAT[primaryCat];
  if (!supportCat) return null;

  const pool = MOVEMENTS.filter(m => m.category === supportCat && !usedNames.has(m.name));

  if (primaryCat === 'Chest') {
    // Want a tricep movement
    const tricep = pool.find(m => {
      const lower = m.name.toLowerCase();
      return lower.includes('tricep') || lower.includes('skull') ||
             lower.includes('close grip') || lower.includes('dip') || lower.includes('kickback');
    });
    return tricep || pool[0] || null;
  }

  if (primaryCat === 'Back') {
    // Want a bicep movement
    const bicep = pool.find(m => {
      const lower = m.name.toLowerCase();
      return lower.includes('curl') || lower.includes('bicep') || lower.includes('hammer');
    });
    return bicep || pool[0] || null;
  }

  return pool[0] || null;
}

function prescriptionFor(movement, position) {
  const compound = isCompound(movement);
  const barbell = movement.equipment.includes('Barbell');

  if (position === 0) {
    if (barbell && compound) return '5×5';   // heavy barbell main lift
    if (compound)             return '4×8';   // machine/DB compound main
    return '4×12';                            // isolation main
  }
  if (position === 1) {
    if (compound) return '3×8';
    return '3×12';
  }
  if (position === 2) return '3×10';
  if (position === 3) return '3×12';
  return '3×15';                              // support / finisher
}

/**
 * Build a ~1 hour workout starting with the selected movement.
 * Returns an array of exercise strings in "Name — SxR" format.
 */
export function buildWorkoutFromMovement(primary) {
  const usedNames = new Set([primary.name]);
  const usedBuckets = new Set([equipBucket(primary.equipment)]);

  const sameCat = MOVEMENTS.filter(
    m => m.category === primary.category && m.name !== primary.name,
  );

  const picked = [];

  // First pass: different equipment bucket
  for (const m of sameCat) {
    if (picked.length >= 3) break;
    const bucket = equipBucket(m.equipment);
    if (!usedBuckets.has(bucket)) {
      picked.push(m);
      usedBuckets.add(bucket);
      usedNames.add(m.name);
    }
  }

  // Second pass: fill remaining slots with any unused movement
  for (const m of sameCat) {
    if (picked.length >= 3) break;
    if (!usedNames.has(m.name)) {
      picked.push(m);
      usedNames.add(m.name);
    }
  }

  const support = pickSupportExercise(primary.category, usedNames);
  const exercises = [primary, ...picked.slice(0, 3), ...(support ? [support] : [])];

  return exercises.map((ex, i) => `${ex.name} — ${prescriptionFor(ex, i)}`);
}

/**
 * Returns a human-friendly name for the auto-generated workout.
 */
export function workoutNameForMovement(movement) {
  return `${movement.category} Day`;
}
