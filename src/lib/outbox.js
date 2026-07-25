// Durable write queue.
//
// Workouts get logged in basements, car parks and gyms with no signal. Every
// mutation is written to localStorage first and only then sent; anything that
// fails to reach the server stays queued and is retried when connectivity
// comes back — instead of being lost to a console.error.

import { historyApi, settingsApi } from './api';

const KEY          = 'hgw_outbox';
const MAX_ATTEMPTS = 8;
const BACKOFF_MS   = [2000, 5000, 15000, 30000, 60000];

let queue     = load();
let listeners = [];
let flushing  = false;
let retryTimer = null;
let lastError = null;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
  } catch {
    // Storage full or unavailable — the in-memory queue still works for
    // this session, so keep going rather than dropping the write.
  }
}

function emit() {
  const state = getState();
  listeners.forEach(fn => fn(state));
}

export function getState() {
  return {
    pending: queue.length,
    syncing: flushing,
    lastError,
    // Only unsynced *workouts* are worth nagging the user about; a settings
    // patch catching up a moment later is invisible to them.
    pendingWorkouts: queue.filter(op => op.kind === 'history.create').length,
  };
}

export function subscribe(fn) {
  listeners.push(fn);
  fn(getState());
  return () => { listeners = listeners.filter(l => l !== fn); };
}

let seq = 0;
function nextId() {
  seq += 1;
  return `op_${Date.now()}_${seq}`;
}

/**
 * Queue a mutation. Settings patches are coalesced into a single pending op —
 * only the latest value of each key matters, and replaying twenty of them on
 * reconnect would just be twenty round trips to the same end state.
 */
export function enqueue(kind, body, meta = null) {
  if (kind === 'settings.patch') {
    const existing = queue.find(op => op.kind === 'settings.patch');
    if (existing) {
      existing.body = { ...existing.body, ...body };
      existing.attempts = 0;
      persist();
      emit();
      scheduleFlush(0);
      return existing.id;
    }
  }
  const op = { id: nextId(), kind, body, meta, attempts: 0, createdAt: Date.now() };
  queue.push(op);
  persist();
  emit();
  scheduleFlush(0);
  return op.id;
}

async function send(op) {
  switch (op.kind) {
    case 'history.create':  return historyApi.create(op.body);
    case 'history.remove':  return historyApi.remove(op.body.id);
    case 'settings.patch':  return settingsApi.patch(op.body);
    default: throw Object.assign(new Error(`Unknown op ${op.kind}`), { fatal: true });
  }
}

/**
 * A 4xx means the request itself is bad — replaying it forever won't help, so
 * the op is dropped. Anything else (offline, timeout, 5xx) is worth retrying.
 */
function isPermanent(err) {
  if (err?.fatal) return true;
  const s = err?.status;
  if (!s) return false;             // network failure — retry
  if (s === 408 || s === 429) return false;
  return s >= 400 && s < 500;
}

function remove(id) {
  queue = queue.filter(op => op.id !== id);
  persist();
}

/**
 * Drain the queue in order. History creates must stay ordered relative to each
 * other, so the first retryable failure stops the pass and reschedules.
 */
export async function flush() {
  if (flushing || !queue.length) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    scheduleFlush(BACKOFF_MS[0]);
    return;
  }

  flushing = true;
  emit();

  try {
    while (queue.length) {
      const op = queue[0];
      try {
        const result = await send(op);
        remove(op.id);
        lastError = null;
        onSynced(op, result);
        emit();
      } catch (err) {
        op.attempts += 1;
        lastError = err?.message || 'Sync failed';

        if (isPermanent(err) || op.attempts >= MAX_ATTEMPTS) {
          console.error('Dropping unsendable change:', op.kind, err);
          remove(op.id);
          onFailed(op, err);
          emit();
          continue;
        }

        persist();
        emit();
        scheduleFlush(BACKOFF_MS[Math.min(op.attempts - 1, BACKOFF_MS.length - 1)]);
        return;
      }
    }
  } finally {
    flushing = false;
    emit();
  }
}

function scheduleFlush(delay) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { retryTimer = null; flush(); }, delay);
}

// ── Result hooks — let AppContext reconcile optimistic rows ─────────────────
let syncedHandlers = [];
let failedHandlers = [];

export function onOpSynced(fn) {
  syncedHandlers.push(fn);
  return () => { syncedHandlers = syncedHandlers.filter(h => h !== fn); };
}
export function onOpFailed(fn) {
  failedHandlers.push(fn);
  return () => { failedHandlers = failedHandlers.filter(h => h !== fn); };
}
function onSynced(op, result) { syncedHandlers.forEach(fn => fn(op, result)); }
function onFailed(op, err)    { failedHandlers.forEach(fn => fn(op, err)); }

// ── Triggers ────────────────────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flush());
  // Coming back to the app is a good moment to catch up — the browser doesn't
  // always fire `online` when a backgrounded PWA regains connectivity.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush();
  });
}
