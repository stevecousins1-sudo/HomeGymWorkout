// Durable write queue.
//
// Workouts get logged in basements, car parks and gyms with no signal. Every
// mutation is written to localStorage first and only then sent; anything that
// fails to reach the server stays queued and is retried when connectivity
// comes back — instead of being lost to a console.error.
//
// Nothing is ever silently deleted. An op leaves the queue in exactly one of
// two ways: the server accepted it, or the server definitively rejected it, in
// which case it is *parked* in a second persisted store where the user can see
// it and retry. A server that simply can't be reached is retried for as long as
// it takes, because "the gym wifi has no internet" is not a reason to throw a
// workout away.

import { authStore, historyApi, settingsApi } from './api';

const KEY        = 'hgw_outbox';
const PARKED_KEY = 'hgw_outbox_parked';
const BACKOFF_MS = [2000, 5000, 15000, 30000, 60000];

// A server that answers with a 5xx may be choking on this particular op rather
// than being down. After this many, park it so it can't hold up every change
// queued behind it for ever.
const MAX_SERVER_ERRORS = 8;

let queue      = loadKey(KEY);
let parked     = loadKey(PARKED_KEY);
let listeners  = [];
let flushing   = false;
let retryTimer = null;
let lastError  = null;

function loadKey(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(queue));
    localStorage.setItem(PARKED_KEY, JSON.stringify(parked));
  } catch {
    // Storage full or unavailable — the in-memory copies still work for this
    // session, so keep going rather than dropping the write.
  }
}

// ── Ownership ───────────────────────────────────────────────────────────────
// Ops are held, not dropped, across a lapsed session, so they have to remember
// whose they are: otherwise signing in as someone else on the same phone would
// send the previous person's workouts into the new account. Ops queued before
// this existed carry no owner and go to whoever is signed in, as they always
// did.
function currentUserId() {
  return authStore.model?.id ?? null;
}

function isMine(op, me = currentUserId()) {
  return !op.owner || op.owner === me;
}

function emit() {
  const state = getState();
  listeners.forEach(fn => fn(state));
}

export function getState() {
  const me = currentUserId();
  const mine = list => list.filter(op => isMine(op, me));
  return {
    pending: mine(queue).length,
    syncing: flushing,
    lastError,
    // Only *workouts* are worth nagging the user about; a settings patch
    // catching up a moment later is invisible to them.
    pendingWorkouts: mine(queue).filter(op => op.kind === 'history.create').length,
    failedWorkouts:  mine(parked).filter(op => op.kind === 'history.create').length,
  };
}

export function subscribe(fn) {
  listeners.push(fn);
  fn(getState());
  return () => { listeners = listeners.filter(l => l !== fn); };
}

/**
 * The signed-in user's workouts that aren't on the server yet — queued or
 * parked. History is rebuilt from this on load, so an unsynced workout stays
 * visible across a reload instead of existing only in memory.
 */
export function unsyncedWorkouts() {
  const me = currentUserId();
  const pick = (list, isParked) => list
    .filter(op => op.kind === 'history.create' && isMine(op, me))
    .map(op => ({ op, parked: isParked }));
  return [...pick(queue, false), ...pick(parked, true)];
}

let seq = 0;
function nextId() {
  seq += 1;
  return `op_${Date.now()}_${seq}`;
}

/**
 * Queue a mutation. Settings patches are coalesced into a single pending op per
 * user — only the latest value of each key matters, and replaying twenty of
 * them on reconnect would just be twenty round trips to the same end state.
 */
export function enqueue(kind, body, meta = null) {
  const owner = currentUserId();
  if (kind === 'settings.patch') {
    const existing = queue.find(op => op.kind === 'settings.patch' && op.owner === owner);
    if (existing) {
      existing.body = { ...existing.body, ...body };
      existing.attempts = 0;
      existing.serverErrors = 0;
      persist();
      emit();
      scheduleFlush(0);
      return existing.id;
    }
  }
  const op = { id: nextId(), kind, body, meta, owner, attempts: 0, serverErrors: 0, createdAt: Date.now() };
  queue.push(op);
  persist();
  emit();
  scheduleFlush(0);
  return op.id;
}

async function send(op) {
  switch (op.kind) {
    case 'history.create':  return historyApi.create(op.body);
    case 'history.update':  return historyApi.update(op.body.id, op.body.entry);
    case 'history.remove':
      try {
        return await historyApi.remove(op.body.id);
      } catch (err) {
        // Already gone is exactly what a delete wants.
        if (err?.status === 404) return null;
        throw err;
      }
    case 'settings.patch':  return settingsApi.patch(op.body);
    default: throw Object.assign(new Error(`Unknown op ${op.kind}`), { fatal: true });
  }
}

/**
 * Why a send failed, which decides what happens to the op.
 *
 *   unreachable  — never got a real answer: offline, DNS, wifi with no
 *                  internet, a gateway's HTML error page (which fails to parse,
 *                  so arrives here with no status), or 408/429/502/503/504.
 *                  Retry for as long as it takes.
 *   unauthorised — 401/403: the session lapsed. Hold everything until the user
 *                  signs in again; the op itself is fine.
 *   server       — the server answered with a 5xx. Retry, but park after
 *                  MAX_SERVER_ERRORS in case it's this op that's the problem.
 *   rejected     — any other 4xx, or an op kind we don't know: replaying it
 *                  unchanged can't succeed. Park it.
 */
function classify(err) {
  if (err?.fatal) return 'rejected';
  const s = err?.status;
  if (!s) return 'unreachable';
  if (s === 401 || s === 403) return 'unauthorised';
  if ([408, 429, 502, 503, 504].includes(s)) return 'unreachable';
  if (s >= 400 && s < 500) return 'rejected';
  return 'server';
}

function park(op, err) {
  queue = queue.filter(o => o.id !== op.id);
  parked.push({
    ...op,
    parkedAt: Date.now(),
    error: err?.message || String(err),
    status: err?.status ?? null,
  });
  persist();
}

/**
 * Move the signed-in user's parked ops back into the queue and try again —
 * behind the "Retry" button, for when whatever rejected them has been fixed.
 * Returns the ops moved, so the UI can flip their rows back to pending.
 */
export function retryParked() {
  const me = currentUserId();
  const mine = parked.filter(op => isMine(op, me));
  if (mine.length) {
    parked = parked.filter(op => !mine.includes(op));
    // Back into the queue as a fresh op: drop the parking record, reset counters.
    queue.push(...mine.map(op => ({
      id: op.id, kind: op.kind, body: op.body, meta: op.meta, owner: op.owner,
      createdAt: op.createdAt, attempts: 0, serverErrors: 0,
    })));
    persist();
    emit();
  }
  flush();
  return mine;
}

function remove(id) {
  queue = queue.filter(op => op.id !== id);
  persist();
}

/**
 * Drain the signed-in user's ops in order. History creates must stay ordered
 * relative to each other, so a retryable failure stops the pass and
 * reschedules. Other users' ops are stepped over, not sent.
 */
export async function flush() {
  if (flushing) return;
  const me = currentUserId();
  // With nobody signed in there is no one to send anything as.
  if (!me || !queue.some(op => isMine(op, me))) { emit(); return; }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    scheduleFlush(BACKOFF_MS[0]);
    return;
  }

  flushing = true;
  emit();

  try {
    let i = 0;
    while (i < queue.length) {
      const op = queue[i];
      if (!isMine(op, me)) { i++; continue; }

      try {
        const result = await send(op);
        remove(op.id);
        lastError = null;
        onSynced(op, result);
        emit();
      } catch (err) {
        lastError = err?.message || 'Sync failed';
        const kind = classify(err);

        if (kind === 'server') op.serverErrors = (op.serverErrors || 0) + 1;

        if (kind === 'rejected' || (kind === 'server' && op.serverErrors >= MAX_SERVER_ERRORS)) {
          console.error('Parking a change the server will not accept:', op.kind, err);
          park(op, err);
          onFailed(op, err);
          emit();
          continue;                     // queue shifted; i now points at the next op
        }

        if (kind === 'unauthorised') {
          // Resumes on the flush that follows the next sign-in.
          persist();
          emit();
          return;
        }

        op.attempts = (op.attempts || 0) + 1;
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
