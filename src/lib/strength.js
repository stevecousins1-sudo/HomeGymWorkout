// Estimated 1RM (e1RM) — the strength metric the app uses for records, charts
// and plateau detection.
//
// Raw max weight ignores reps (a grindy single beats a clean triple), and
// single-set volume (weight × reps) rewards light high-rep work over heavy
// work. e1RM normalises both onto one comparable number.

export const LB_PER_KG = 2.2046;

/** Convert any weight to pounds, the app's internal comparison unit. */
export function toLb(weight, unit) {
  const w = parseFloat(weight) || 0;
  return unit === 'kg' ? w * LB_PER_KG : w;
}

/** Convert pounds back into the given display unit. */
export function fromLb(lb, unit) {
  return unit === 'kg' ? lb / LB_PER_KG : lb;
}

// Beyond this, rep-max formulas diverge wildly and stop being meaningful.
const MAX_MODELLED_REPS = 20;

/**
 * Estimated 1RM from a single set.
 *
 * Blends Epley and Brzycki in the 2-12 rep range where both are well
 * validated, and falls back to Epley alone above that (Brzycki's linear
 * denominator degrades badly and blows up entirely at 37 reps).
 *
 * Returns 0 when the set can't be modelled, so callers can filter it out.
 */
export function e1rm(weight, reps) {
  const w = parseFloat(weight) || 0;
  const r = parseFloat(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return w;

  const capped  = Math.min(r, MAX_MODELLED_REPS);
  const epley   = w * (1 + capped / 30);
  if (capped > 12) return epley;

  const brzycki = w * 36 / (37 - capped);
  return (epley + brzycki) / 2;
}

/** e1RM of a single set, normalised to pounds. */
export function setE1rmLb(set, unit) {
  return e1rm(toLb(set?.weight, unit), set?.reps);
}

/**
 * Best e1RM (in lb) across the completed sets of one logged exercise,
 * plus the set that produced it.
 */
export function bestE1rmForExercise(ex) {
  const unit = ex?.unit || 'lb';
  let best = 0, bestSet = null;
  for (const set of (ex?.sets || [])) {
    if (!set.done) continue;
    const val = setE1rmLb(set, unit);
    if (val > best) { best = val; bestSet = set; }
  }
  return { e1rm: best, set: bestSet, unit };
}

/**
 * All-time bests per exercise name, derived from history.
 *
 * Each entry carries the best e1RM and the heaviest weight ever lifted
 * (both in lb, plus the raw value and unit they were logged in) so the UI
 * can show a true strength record alongside a simple "heaviest ever".
 */
export function buildRecords(history) {
  const recs = {};
  for (const entry of history || []) {
    for (const ex of (entry.exercises || [])) {
      const unit = ex.unit || 'lb';
      const rec = recs[ex.name] ||= {
        name: ex.name,
        e1rm: 0, e1rmDate: null, e1rmReps: 0, e1rmWeight: 0,
        weight: 0, rawWeight: 0, unit,
      };
      for (const set of (ex.sets || [])) {
        if (!set.done) continue;
        const wLb = toLb(set.weight, unit);
        const r   = parseFloat(set.reps) || 0;
        if (wLb <= 0 || r <= 0) continue;

        const est = e1rm(wLb, r);
        if (est > rec.e1rm) {
          rec.e1rm       = est;
          rec.e1rmDate   = entry.date;
          rec.e1rmReps   = r;
          rec.e1rmWeight = parseFloat(set.weight) || 0;
          rec.unit       = unit;
        }
        if (wLb > rec.weight) {
          rec.weight    = wLb;
          rec.rawWeight = parseFloat(set.weight) || 0;
          rec.unit      = unit;
        }
      }
    }
  }
  return recs;
}

/**
 * Chronological e1RM series (oldest first) for one exercise.
 * `history` is newest-first, as stored in AppContext.
 */
export function e1rmSeries(exerciseName, history, limit = 12) {
  return (history || [])
    .filter(h => h.exercises?.some(e => e.name === exerciseName))
    .slice(0, limit)
    .reverse()
    .map(session => {
      const ex = session.exercises.find(e => e.name === exerciseName);
      const { e1rm: best, set, unit } = bestE1rmForExercise(ex);
      return {
        date: session.date,
        e1rm: Math.round(best * 10) / 10,
        unit,
        weight: parseFloat(set?.weight) || 0,
        reps: parseFloat(set?.reps) || 0,
      };
    })
    .filter(p => p.e1rm > 0);
}

/**
 * Classify recent e1RM movement for an exercise.
 *
 * Compares the best e1RM of the most recent `window` sessions against the
 * `window` before it, so a single bad day doesn't read as a plateau.
 * Returns null when there isn't enough data to say anything honest.
 */
export function analyseTrend(exerciseName, history, window = 3) {
  const series = e1rmSeries(exerciseName, history, window * 2);
  if (series.length < window * 2) return null;

  const older  = series.slice(0, series.length - window);
  const recent = series.slice(series.length - window);
  const bestOf = arr => Math.max(...arr.map(p => p.e1rm));

  const prev = bestOf(older);
  const now  = bestOf(recent);
  if (prev <= 0) return null;

  const pct = (now - prev) / prev * 100;
  const status = pct >= 2 ? 'progressing' : pct <= -2 ? 'regressing' : 'plateau';
  return { status, pct: Math.round(pct * 10) / 10, prev, now, sessions: series.length };
}
