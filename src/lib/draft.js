// In-progress workout persistence.
//
// The workout overlay holds a whole session in component state. iOS will
// happily evict a backgrounded PWA mid-session, and a reload used to wipe
// every set logged so far. A snapshot is written on every change so the
// session can be picked back up exactly where it was left.

const KEY     = 'hgw_workout_draft';
const VERSION = 1;

// Past this, an abandoned draft is noise rather than something to resume.
const MAX_AGE_MS = 20 * 60 * 60 * 1000;

export function saveDraft(draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      version: VERSION,
      savedAt: Date.now(),
      draft,
    }));
  } catch {
    // Out of storage — the workout carries on in memory.
  }
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== VERSION || !parsed.draft) return null;
    if (Date.now() - (parsed.savedAt || 0) > MAX_AGE_MS) {
      clearDraft();
      return null;
    }
    return parsed.draft;
  } catch {
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* nothing useful to do */ }
}

/** True when the draft has at least one completed set worth resuming. */
export function draftHasProgress(draft) {
  return (draft?.exercises || []).some(ex =>
    (ex.sets || []).some(s => s.done) || (ex.warmupSets || []).some(s => s.done)
  );
}
