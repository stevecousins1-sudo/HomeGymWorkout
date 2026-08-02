import { MOVEMENTS } from '../data/movements';

// Time estimates (minutes)
const SET_MIN         = 2.5;  // avg time per working set, including rest
const EX_TRANS_MIN    = 1.5;  // moving to next exercise + setup
const SESSION_OVER_MIN = 5;   // warmup, getting ready

const TARGET_MIN      = 45;
const MAX_SETS_PER_EX = 5;
const MAX_EXERCISES   = 10;

function parseSetCount(presc) {
  const m = presc?.match(/^(\d+)/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 3;
}

function parseReps(presc) {
  // Match the part after × (handles "8", "8-10", "FSL", "60s", etc.)
  const m = presc?.match(/×(\S+)/);
  return m ? m[1] : '10';
}

function estimateMinutes(items) {
  const totalSets = items.reduce((a, e) => a + e.setCount, 0);
  return SESSION_OVER_MIN + items.length * EX_TRANS_MIN + totalSets * SET_MIN;
}

function buildStr(ex) {
  return `${ex.name} — ${ex.setCount}×${ex.reps}`;
}

/**
 * Pads a list of exercise strings so the estimated workout is at least
 * `targetMinutes` long. Deterministic — no random selection.
 *
 * Strategy:
 *  1. Add sets to existing exercises (round-robin, up to MAX_SETS_PER_EX)
 *  2. Append accessory exercises from the same muscle categories
 *
 * Options:
 *  - `targetMinutes`   minimum session length to pad towards
 *  - `customMovements` the user's own movements, preferred over the built-in
 *                      library when picking accessories: they added them
 *                      because they can actually do them.
 */
export function padToMinDuration(exerciseStrings, { targetMinutes = TARGET_MIN, customMovements = [] } = {}) {
  if (!exerciseStrings?.length) return exerciseStrings;

  const parsed = exerciseStrings.map(str => {
    const sep = str.indexOf(' — ');
    const name = sep >= 0 ? str.slice(0, sep).trim() : str.trim();
    const presc = sep >= 0 ? str.slice(sep + 3).trim() : '3×10';
    return { name, prescription: presc, setCount: parseSetCount(presc), reps: parseReps(presc) };
  });

  let est = estimateMinutes(parsed);
  if (est >= targetMinutes) return exerciseStrings;

  // ── Step 1: round-robin add sets to existing exercises ────────────────────
  let madeProgress = true;
  while (est < targetMinutes && madeProgress) {
    madeProgress = false;
    for (const ex of parsed) {
      if (est >= targetMinutes) break;
      if (ex.setCount < MAX_SETS_PER_EX) {
        ex.setCount++;
        est += SET_MIN;
        madeProgress = true;
      }
    }
  }

  if (est >= targetMinutes) return parsed.map(buildStr);

  // ── Step 2: add more exercises from the same categories ──────────────────
  const library   = [...customMovements, ...MOVEMENTS];
  const movByName = new Map(library.map(m => [m.name.toLowerCase(), m]));
  const existingNames = new Set(parsed.map(e => e.name.toLowerCase()));

  // Which categories are already in this workout?
  const categories = new Set(
    parsed.map(e => movByName.get(e.name.toLowerCase())?.category).filter(Boolean)
  );
  if (categories.size === 0) {
    categories.add('Chest');
    categories.add('Back');
  }

  // Infer prescription style: prefer a simple "N×reps" from the majority
  const inferReps = parsed.find(e => /^\d+$/.test(e.reps))?.reps
    ?? parsed[0]?.reps
    ?? '10';
  const inferSets = 3;

  // Candidates: same categories, not already present — ordered by library index
  // (deterministic), with the user's own movements first.
  const candidates = library.filter(
    m => categories.has(m.category) && !existingNames.has(m.name.toLowerCase())
  );

  for (const cand of candidates) {
    if (est >= targetMinutes || parsed.length >= MAX_EXERCISES) break;
    parsed.push({ name: cand.name, prescription: `${inferSets}×${inferReps}`, setCount: inferSets, reps: inferReps });
    est += EX_TRANS_MIN + inferSets * SET_MIN;
    existingNames.add(cand.name.toLowerCase());
  }

  return parsed.map(buildStr);
}

/** Returns estimated workout duration in minutes for a set of exercise strings. */
export function estimateWorkoutMinutes(exerciseStrings) {
  if (!exerciseStrings?.length) return 0;
  const parsed = exerciseStrings.map(str => {
    const sep = str.indexOf(' — ');
    const presc = sep >= 0 ? str.slice(sep + 3).trim() : '3×10';
    return { setCount: parseSetCount(presc) };
  });
  return Math.round(estimateMinutes(parsed));
}
