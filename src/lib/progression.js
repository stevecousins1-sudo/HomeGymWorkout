// Autoregulated progression.
//
// Replaces "add a fixed increment to last session's top weight" with double
// progression over the prescribed rep range, modulated by logged RPE:
//
//   • hit the top of the range on every set  → add weight, reset to bottom
//   • inside the range                       → same weight, one more rep
//   • missed the bottom of the range         → repeat the session
//   • missed twice in a row                  → back off 10%
//
// RPE overrides the rep verdict at the extremes: an easy session (RPE ≤ 6)
// earns a double jump, a maximal one (RPE ≥ 9) holds the weight even if the
// reps were there.

import { toLb, fromLb } from './strength';

// Smallest change you can actually load. Plates go on a barbell in pairs, so
// the smallest kg plate (1.25) moves the bar by 2.5; dumbbells and cable
// stacks move in finer steps.
const ROUNDING = {
  kg: { compound: 2.5, isolation: 1.25 },
  lb: { compound: 5,   isolation: 2.5 },
};

// Per-session weight jump. Compounds move in bigger steps than isolation work.
const INCREMENT = {
  kg: { compound: 2.5, isolation: 1.25 },
  lb: { compound: 5,   isolation: 2.5 },
};

const EASY_RPE = 6;   // at or below → session had plenty left in the tank
const HARD_RPE = 9;   // at or above → at or near failure

function roundToStep(value, unit, isCompound) {
  const step = (ROUNDING[unit] ?? ROUNDING.lb)[isCompound ? 'compound' : 'isolation'];
  return Math.round(value / step) * step;
}

/**
 * Parse a prescription like "4×8-10", "5×5" or "3×60s" into a target rep range.
 * Returns null for prescriptions with no numeric rep target (time-based holds,
 * "5/3/1 set", "5×FSL"), which the caller treats as "no suggestion".
 */
export function parseRepRange(prescription) {
  const repPart = prescription?.split(/[×x]/)[1]?.trim();
  if (!repPart) return null;

  const range = repPart.match(/^(\d+)\s*-\s*(\d+)/);
  if (range) {
    return { min: parseInt(range[1], 10), max: parseInt(range[2], 10) };
  }
  // A bare number only counts if it isn't a duration ("60s") or a label.
  const single = repPart.match(/^(\d+)(?![\ds])/);
  if (single) {
    const n = parseInt(single[1], 10);
    return { min: n, max: n };
  }
  return null;
}

/** Most recent sessions containing this exercise, newest first. */
function recentSessions(exName, history, limit = 2) {
  const out = [];
  for (const entry of history || []) {
    const ex = entry.exercises?.find(e => e.name === exName);
    if (ex) out.push({ date: entry.date, ex });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Summarise how a logged exercise actually went: the working (heaviest) weight,
 * the worst rep count achieved at that weight, and the average RPE across it.
 */
function summarise(ex) {
  const unit = ex?.unit || 'lb';
  const done = (ex?.sets || []).filter(
    s => s.done && (parseFloat(s.reps) || 0) > 0
  );
  if (!done.length) return null;

  const topWeight = Math.max(...done.map(s => parseFloat(s.weight) || 0));
  const topSets   = done.filter(s => (parseFloat(s.weight) || 0) === topWeight);

  const reps   = topSets.map(s => parseFloat(s.reps) || 0);
  const rpes   = topSets.map(s => parseFloat(s.rpe)).filter(v => !isNaN(v));
  const avgRpe = rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

  return {
    unit,
    weight: topWeight,
    setCount: topSets.length,
    minReps: Math.min(...reps),
    maxReps: Math.max(...reps),
    avgRpe,
  };
}

/** Did this session fall short of the prescribed range? */
function missedRange(summary, range) {
  return summary && range ? summary.minReps < range.min : false;
}

/**
 * Work out what to do next for one exercise.
 *
 * @returns {null|{action,weight,reps,unit,delta,label,rationale}}
 *          null when there's no history to reason from, or the prescription
 *          has no numeric rep target.
 */
export function getProgression({ exName, prescription, unit, history, isCompound = false }) {
  const range = parseRepRange(prescription);
  if (!range) return null;

  const sessions = recentSessions(exName, history, 2);
  if (!sessions.length) return null;

  const last = summarise(sessions[0].ex);
  if (!last) return null;

  // Bodyweight work (or anything logged without a load): progress reps only.
  if (last.weight <= 0) {
    const target = Math.min(last.minReps + 1, range.max);
    if (target <= last.minReps) return null;
    return {
      action: 'add-rep', weight: null, reps: target, unit, delta: 0,
      label: `Try ${target} reps`,
      rationale: `Last time: ${last.setCount}×${last.minReps}. Add a rep.`,
    };
  }

  // Last session's weight, expressed in the unit currently on screen.
  const lastWeight = last.unit === unit
    ? last.weight
    : roundToStep(fromLb(toLb(last.weight, last.unit), unit), unit, isCompound);

  const inc  = INCREMENT[unit]?.[isCompound ? 'compound' : 'isolation']
            ?? INCREMENT.lb.isolation;
  const rpe  = last.avgRpe;
  const reps = last.minReps;

  const rpeNote = rpe != null ? ` @ RPE ${rpe % 1 ? rpe.toFixed(1) : rpe}` : '';
  const lastNote = `Last: ${last.setCount}×${reps} @ ${last.weight} ${last.unit}${rpeNote}`;

  const suggest = (action, weight, targetReps, rationale) => ({
    action,
    weight: weight == null ? null : Math.round(weight * 100) / 100,
    reps: targetReps,
    unit,
    delta: weight == null ? 0 : Math.round((weight - lastWeight) * 100) / 100,
    label: weight == null ? `Try ${targetReps} reps` : `${weight} ${unit} × ${targetReps}`,
    rationale,
  });

  // ── Missed the bottom of the range ─────────────────────────────────────────
  if (missedRange(last, range)) {
    const prior = sessions[1] ? summarise(sessions[1].ex) : null;
    if (prior && missedRange(prior, range)) {
      const deloaded = roundToStep(lastWeight * 0.9, unit, isCompound);
      return suggest('deload', deloaded, range.min,
        `${lastNote}. Missed ${range.min} reps twice — back off 10% and rebuild.`);
    }
    return suggest('hold', lastWeight, range.min,
      `${lastNote}. Short of ${range.min} — repeat this weight.`);
  }

  // ── Hit the top of the range on every set ──────────────────────────────────
  if (reps >= range.max) {
    if (rpe != null && rpe >= HARD_RPE) {
      return suggest('hold', lastWeight, range.max,
        `${lastNote}. Reps were there but it was maximal — repeat before adding load.`);
    }
    const jump = (rpe != null && rpe <= EASY_RPE) ? inc * 2 : inc;
    const next = roundToStep(lastWeight + jump, unit, isCompound);
    return suggest('increase', next, range.min,
      rpe != null && rpe <= EASY_RPE
        ? `${lastNote}. Comfortably done — take a double jump.`
        : `${lastNote}. Top of the range cleared — add load.`);
  }

  // ── Inside the range: add a rep before adding weight ───────────────────────
  if (rpe != null && rpe >= HARD_RPE + 0.5) {
    return suggest('hold', lastWeight, reps,
      `${lastNote}. Near failure — match it before pushing on.`);
  }
  return suggest('add-rep', lastWeight, Math.min(reps + 1, range.max),
    `${lastNote}. Add a rep — weight goes up at ${range.max}.`);
}

/** Short arrow prefix for the suggestion chip. */
export const ACTION_ICON = {
  increase: '↑',
  'add-rep': '+',
  hold: '=',
  deload: '↓',
};
