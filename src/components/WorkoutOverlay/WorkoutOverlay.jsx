import { useState, useCallback, useRef, useMemo, useEffect, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useWorkoutTimer } from '../../hooks/useWorkoutTimer';
import { getExercisesForDay } from '../../data/exercises';
import { MOVEMENTS } from '../../data/movements';
import RestTimer from '../RestTimer/RestTimer';
import WorkoutSummary from '../WorkoutSummary/WorkoutSummary';
import { calcPlates } from '../../lib/plates';
import { padToMinDuration } from '../../lib/workoutPadder';
import { saveDraft, clearDraft } from '../../lib/draft';
import { getProgression, ACTION_ICON } from '../../lib/progression';
import { buildRecords, e1rm, toLb } from '../../lib/strength';
import { applyMachineSubs } from '../../data/machineSubs';
import { formatTimer, formatDate, todayISO, convertWeight, getDefaultUnit } from '../../utils';
import { getBuildLabel } from '../../lib/version';
import styles from './WorkoutOverlay.module.css';

const REST_DEFAULT   = 90;
const REST_STEP      = 15;
const REST_MIN       = 15;
const REST_MAX       = 300;
const SWIPE_LOCK_PX  = 60;
const SWIPE_DELETE_W = 72;

const BUILD_LABEL    = getBuildLabel();
const MOV_CATEGORIES = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

function parseExercise(str) {
  const parts = str.split(' — ');
  return { name: parts[0], prescription: parts[1] || '' };
}
function buildSets(prescription) {
  const n = parseInt(prescription.match(/^(\d+)/)?.[1] ?? '3', 10);
  return Array.from({ length: n }, () => ({ weight: '', reps: '', done: false }));
}
function makeSet() { return { weight: '', reps: '', done: false }; }

function buildExercises(dayNameOrList) {
  const rawList = Array.isArray(dayNameOrList) ? dayNameOrList : getExercisesForDay(dayNameOrList);
  return rawList.map(str => {
    const { name, prescription } = parseExercise(str);
    return { name, prescription, sets: buildSets(prescription), warmupSets: [] };
  });
}

function getLastSets(exName, history) {
  for (const entry of history) {
    if (!entry.exercises) continue;
    const ex = entry.exercises.find(e => e.name === exName);
    if (ex) return { sets: ex.sets, unit: ex.unit };
  }
  return null;
}
function getExerciseHistory(exName, history, limit = 4) {
  return history.filter(h => h.exercises?.some(e => e.name === exName)).slice(0, limit);
}

export default function WorkoutOverlay({ workoutName, dayName, exercises: exercisesProp, isPlanWorkout, hasMachines = true, draft = null, onComplete, onClose }) {
  const { addHistory, markScheduleEntry, activePlan, unitPrefs, setUnitPref,
          restPrefs, setRestPref, history, customMovements, addCustomMovement } = useApp();
  const navigate = useNavigate();
  // Owned here (not by the hook) so a resumed session keeps its original
  // start time and the timer doesn't reset to zero on reload.
  const [startedAt] = useState(() => draft?.startedAt ?? Date.now());
  const elapsed  = useWorkoutTimer(true, startedAt);

  // Merged movement list (built-in + custom). Custom last here so that on a
  // name clash the user's own definition wins when building the lookup map.
  const allMovements = useMemo(() => [...MOVEMENTS, ...customMovements], [customMovements]);
  const movMap = useMemo(() => new Map(allMovements.map(m => [m.name.toLowerCase(), m])), [allMovements]);
  // For pickers, show the user's own movements first — same as the builder.
  const pickerMovements = useMemo(() => [...customMovements, ...MOVEMENTS], [customMovements]);
  const getMovement   = name => movMap.get(name.toLowerCase()) ?? null;
  const isBodyweight  = name => getMovement(name)?.equipment?.includes('Bodyweight') ?? false;
  const isBarbell     = name => getMovement(name)?.equipment?.toLowerCase().includes('barbell') ?? false;

  // Compute (and pad) the initial exercise string list once, reused by all state initialisers.
  const _paddedStrings = useRef(null);
  function getPaddedStrings() {
    if (!_paddedStrings.current) {
      let raw = exercisesProp ?? getExercisesForDay(dayName);
      if (!hasMachines) raw = applyMachineSubs(raw);
      _paddedStrings.current = isPlanWorkout ? padToMinDuration(raw, { customMovements }) : raw;
    }
    return _paddedStrings.current;
  }

  const initList = () => buildExercises(getPaddedStrings());

  const [exercises, setExercises]         = useState(() => draft?.exercises ?? initList());
  const [units, setUnits]                 = useState(() => draft?.units ??
    initList().reduce((acc, ex) => ({ ...acc, [ex.name]: unitPrefs[ex.name] ?? getDefaultUnit(ex.name) }), {})
  );
  const [restDurations, setRestDurations] = useState(() => draft?.restDurations ??
    initList().reduce((acc, ex) => ({ ...acc, [ex.name]: restPrefs[ex.name] ?? REST_DEFAULT }), {})
  );
  const [restVisible, setRestVisible]               = useState(false);
  const [activeRestDuration, setActiveRestDuration] = useState(REST_DEFAULT);
  const [swapIdx, setSwapIdx]                       = useState(null);
  const [historyOpen, setHistoryOpen]               = useState(new Set());
  const [flashSet, setFlashSet]                     = useState(null);
  const [warmupPrompt, setWarmupPrompt]             = useState(null);
  const [lockedSwipe, setLockedSwipe]               = useState(null);
  const [prToast, setPrToast]                       = useState(null);
  const [addingExercise, setAddingExercise]         = useState(false);
  const [addFilter, setAddFilter]                   = useState('All');
  const [showSummary, setShowSummary]               = useState(false);
  const [sessionNotes, setSessionNotes]             = useState(draft?.notes ?? '');
  const [dragIdx, setDragIdx]                       = useState(null);
  const [dropLineIdx, setDropLineIdx]               = useState(null);
  const [creatingExercise, setCreatingExercise]     = useState(false);
  const [newExName, setNewExName]                   = useState('');
  const [newExCategory, setNewExCategory]           = useState('Chest');
  const [newExEquipment, setNewExEquipment]         = useState('Cable machine');
  const [reexpanding, setReexpanding]               = useState(false);

  const swipeRefs    = useRef({});
  const touchStartX  = useRef(0);
  const activeSwipeK = useRef(null);
  const audioCtxRef  = useRef(null);
  const cardRefs     = useRef([]);
  const dragActive   = useRef(null);

  function ensureAudioCtx() {
    if (audioCtxRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Unlock audio on iOS with a silent buffer
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start();
      audioCtxRef.current = ctx;
    } catch {}
  }

  const handleDismissRest = useCallback(() => setRestVisible(false), []);

  // ── Draft persistence ────────────────────────────────────────────────────────
  // The session lives in component state, and a backgrounded PWA can be evicted
  // at any moment. Snapshot it so a crash or reload never costs logged sets.
  const finishedRef = useRef(false);
  const draftRef    = useRef(null);

  useEffect(() => {
    if (finishedRef.current) return;
    draftRef.current = {
      workoutName, dayName, isPlanWorkout, startedAt,
      exercises, units, restDurations, notes: sessionNotes,
    };
    const id = setTimeout(() => saveDraft(draftRef.current), 400);
    return () => clearTimeout(id);
  }, [exercises, units, restDurations, sessionNotes,
      workoutName, dayName, isPlanWorkout, startedAt]);

  // Eviction comes with no warning, so don't let the debounce swallow the
  // last change when the app goes into the background.
  useEffect(() => {
    const flushDraft = () => {
      if (!finishedRef.current && draftRef.current) saveDraft(draftRef.current);
    };
    window.addEventListener('pagehide', flushDraft);
    document.addEventListener('visibilitychange', flushDraft);
    return () => {
      window.removeEventListener('pagehide', flushDraft);
      document.removeEventListener('visibilitychange', flushDraft);
    };
  }, []);

  function endSession() {
    finishedRef.current = true;
    clearDraft();
  }

  // ── All-time bests from history (heaviest weight + best estimated 1RM) ───────
  const prsByExercise = useMemo(() => buildRecords(history), [history]);

  // Bests set earlier in *this* session, so a second PR set only celebrates if
  // it actually beats the first one rather than re-firing off stale history.
  const sessionBestRef = useRef({});

  // ── Unit toggle ──────────────────────────────────────────────────────────────
  function toggleUnit(exIdx, exName, newUnit) {
    const oldUnit = units[exName];
    if (oldUnit === newUnit) return;
    setExercises(prev => prev.map((ex, i) =>
      i !== exIdx ? ex : { ...ex, sets: ex.sets.map(s => ({ ...s, weight: convertWeight(s.weight, oldUnit, newUnit) })) }
    ));
    setUnits(prev => ({ ...prev, [exName]: newUnit }));
    setUnitPref(exName, newUnit);
  }

  // ── Rest duration ────────────────────────────────────────────────────────────
  function adjustRest(exName, delta) {
    const next = Math.max(REST_MIN, Math.min(REST_MAX, (restDurations[exName] ?? REST_DEFAULT) + delta));
    setRestDurations(prev => ({ ...prev, [exName]: next }));
    setRestPref(exName, next);
  }

  // ── History panel ────────────────────────────────────────────────────────────
  function toggleHistoryPanel(exName) {
    setHistoryOpen(prev => { const n = new Set(prev); n.has(exName) ? n.delete(exName) : n.add(exName); return n; });
  }

  // ── Working sets ─────────────────────────────────────────────────────────────
  function updateSet(exIdx, setIdx, field, value) {
    setExercises(prev => prev.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      const prevValue = ex.sets[setIdx][field];
      return {
        ...ex,
        sets: ex.sets.map((s, si) => {
          if (si === setIdx) return { ...s, [field]: value };
          if (si > setIdx && !s.done && (!s[field] || s[field] === prevValue)) return { ...s, [field]: value };
          return s;
        }),
      };
    }));
  }

  function adjustReps(exIdx, setIdx, delta) {
    setExercises(prev => prev.map((ex, ei) =>
      ei !== exIdx ? ex : {
        ...ex,
        sets: ex.sets.map((s, si) => si !== setIdx ? s : {
          ...s, reps: String(Math.max(1, (parseInt(s.reps, 10) || 0) + delta)),
        }),
      }
    ));
  }

  function toggleDone(exIdx, setIdx) {
    const ex  = exercises[exIdx];
    const set = ex.sets[setIdx];
    if (!set.done && !isBodyweight(ex.name) && (!set.weight || !set.reps)) {
      const key = `${exIdx}-${setIdx}`;
      setFlashSet(key);
      setTimeout(() => setFlashSet(null), 700);
      return;
    }
    ensureAudioCtx();
    setExercises(prev => {
      const next = prev.map((e, ei) =>
        ei !== exIdx ? e : { ...e, sets: e.sets.map((s, si) => si !== setIdx ? s : { ...s, done: !s.done }) }
      );
      if (!set.done) {
        setActiveRestDuration(restDurations[prev[exIdx].name] ?? REST_DEFAULT);
        setRestVisible(true);

        // PR check — measured on estimated 1RM so a heavy triple can outrank a
        // light set of twelve, with heaviest-ever weight tracked alongside it.
        const exName = ex.name;
        const unit   = units[exName];
        const wLb    = toLb(set.weight, unit);
        const r      = parseFloat(set.reps) || 0;
        if (wLb > 0 && r > 0) {
          const allTime = prsByExercise[exName];
          const inSession = sessionBestRef.current[exName];
          const bestWeight = Math.max(allTime?.weight || 0, inSession?.weight || 0);
          const bestE1rm   = Math.max(allTime?.e1rm  || 0, inSession?.e1rm  || 0);

          const est = e1rm(wLb, r);
          const isWeightPR = wLb > bestWeight;
          const isStrengthPR = est > bestE1rm;

          if (isWeightPR || isStrengthPR) {
            sessionBestRef.current[exName] = {
              weight: Math.max(bestWeight, wLb),
              e1rm: Math.max(bestE1rm, est),
            };
            setPrToast(isWeightPR ? '🏆 Heaviest ever!' : '🏆 Strength PR!');
            setTimeout(() => setPrToast(null), 3000);
          }
        }
      }
      return next;
    });
  }

  function addSet(exIdx) {
    setExercises(prev => prev.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: [...ex.sets, makeSet()] }));
  }

  function updateRPE(exIdx, setIdx, rpe) {
    setExercises(prev => prev.map((ex, ei) =>
      ei !== exIdx ? ex : { ...ex, sets: ex.sets.map((s, si) => si !== setIdx ? s : { ...s, rpe }) }
    ));
  }

  /** Prefill every not-yet-completed set with the suggested weight and reps. */
  function applyProgression(exIdx, prog) {
    setExercises(prev => prev.map((ex, ei) =>
      ei !== exIdx ? ex : {
        ...ex,
        sets: ex.sets.map(s => s.done ? s : {
          ...s,
          weight: prog.weight != null ? String(prog.weight) : s.weight,
          reps:   prog.reps   != null ? String(prog.reps)   : s.reps,
        }),
      }
    ));
  }

  function getSuggestion(ex, unit) {
    return getProgression({
      exName: ex.name,
      prescription: ex.prescription,
      unit,
      history,
      isCompound: isBarbell(ex.name),
    });
  }

  function removeSet(exIdx, setIdx) {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx || ex.sets.length <= 1) return ex;
      return { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) };
    }));
    setLockedSwipe(null);
  }

  // ── Delete / add exercise ────────────────────────────────────────────────────
  function deleteExercise(exIdx) {
    setExercises(prev => prev.filter((_, i) => i !== exIdx));
  }

  function addExercise(movement) {
    const prescription = '3×10';
    setExercises(prev => [
      ...prev,
      { name: movement.name, prescription, sets: buildSets(prescription), warmupSets: [] },
    ]);
    setUnits(prev => ({ ...prev, [movement.name]: unitPrefs[movement.name] ?? getDefaultUnit(movement.name) }));
    setRestDurations(prev => ({ ...prev, [movement.name]: restPrefs[movement.name] ?? REST_DEFAULT }));
    setAddingExercise(false);
  }

  // ── Warmup sets ──────────────────────────────────────────────────────────────
  function addWarmupSets(exIdx, count) {
    setExercises(prev => prev.map((ex, i) =>
      i !== exIdx ? ex : { ...ex, warmupSets: [...(ex.warmupSets ?? []), ...Array.from({ length: count }, makeSet)] }
    ));
  }

  function updateWarmupSet(exIdx, setIdx, field, value) {
    setExercises(prev => prev.map((ex, ei) => {
      if (ei !== exIdx) return ex;
      const prevValue = ex.warmupSets[setIdx][field];
      return {
        ...ex,
        warmupSets: ex.warmupSets.map((s, si) => {
          if (si === setIdx) return { ...s, [field]: value };
          if (si > setIdx && !s.done && (!s[field] || s[field] === prevValue)) return { ...s, [field]: value };
          return s;
        }),
      };
    }));
  }

  function adjustWarmupReps(exIdx, setIdx, delta) {
    setExercises(prev => prev.map((ex, ei) =>
      ei !== exIdx ? ex : {
        ...ex,
        warmupSets: ex.warmupSets.map((s, si) => si !== setIdx ? s : {
          ...s, reps: String(Math.max(1, (parseInt(s.reps, 10) || 0) + delta)),
        }),
      }
    ));
  }

  function toggleWarmupDone(exIdx, setIdx) {
    setExercises(prev => prev.map((ex, ei) =>
      ei !== exIdx ? ex : {
        ...ex,
        warmupSets: ex.warmupSets.map((s, si) => si !== setIdx ? s : { ...s, done: !s.done }),
      }
    ));
  }

  function removeWarmupSet(exIdx, setIdx) {
    setExercises(prev => prev.map((ex, i) =>
      i !== exIdx ? ex : { ...ex, warmupSets: ex.warmupSets.filter((_, si) => si !== setIdx) }
    ));
    setLockedSwipe(null);
  }

  // ── Swipe-to-delete ──────────────────────────────────────────────────────────
  function swipeStart(e, key) {
    if (lockedSwipe && lockedSwipe !== key) {
      const el = swipeRefs.current[lockedSwipe];
      if (el) { el.style.transition = 'transform 0.2s'; el.style.transform = 'translateX(0)'; }
      setLockedSwipe(null);
    }
    touchStartX.current = e.touches[0].clientX;
    activeSwipeK.current = key;
    const el = swipeRefs.current[key];
    if (el) el.style.transition = 'none';
  }

  function swipeMove(e) {
    const key = activeSwipeK.current;
    if (!key) return;
    const delta = touchStartX.current - e.touches[0].clientX;
    const el = swipeRefs.current[key];
    if (!el) return;
    if (delta > 0) el.style.transform = `translateX(-${Math.min(SWIPE_DELETE_W, delta)}px)`;
    else if (delta < -10) el.style.transform = 'translateX(0)';
  }

  function swipeEnd(key, isDone) {
    if (activeSwipeK.current !== key) return;
    activeSwipeK.current = null;
    const el = swipeRefs.current[key];
    if (!el) return;
    el.style.transition = 'transform 0.2s';
    if (isDone) { el.style.transform = 'translateX(0)'; return; }
    const m = el.style.transform.match(/translateX\(-(\d+)/);
    const offset = m ? parseInt(m[1]) : 0;
    if (offset >= SWIPE_LOCK_PX) {
      el.style.transform = `translateX(-${SWIPE_DELETE_W}px)`;
      setLockedSwipe(key);
    } else {
      el.style.transform = 'translateX(0)';
      if (lockedSwipe === key) setLockedSwipe(null);
    }
  }

  function closeSwipe(key) {
    const el = swipeRefs.current[key];
    if (el) { el.style.transition = 'transform 0.2s'; el.style.transform = 'translateX(0)'; }
    setLockedSwipe(null);
  }

  // ── Swap exercise ────────────────────────────────────────────────────────────
  function swapExercise(newMov) {
    if (swapIdx === null) return;
    const old = exercises[swapIdx];
    setExercises(prev => prev.map((ex, i) =>
      i !== swapIdx ? ex : { name: newMov.name, prescription: old.prescription, sets: old.sets.map(() => makeSet()), warmupSets: [] }
    ));
    setUnits(prev => ({ ...prev, [newMov.name]: unitPrefs[newMov.name] ?? getDefaultUnit(newMov.name) }));
    setRestDurations(prev => ({ ...prev, [newMov.name]: restPrefs[newMov.name] ?? REST_DEFAULT }));
    setSwapIdx(null);
  }

  // ── Finish ───────────────────────────────────────────────────────────────────
  function handleFinish() {
    setShowSummary(true);
  }

  function handleSave() {
    const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.done).length, 0);
    const totalVolume = exercises.reduce((acc, ex) => {
      const unit = units[ex.name];
      return acc + ex.sets.filter(s => s.done).reduce((a, s) => {
        const w = parseFloat(s.weight) || 0;
        const r = parseFloat(s.reps) || 0;
        return a + (unit === 'kg' ? w * 2.2046 : w) * r;
      }, 0);
    }, 0);
    const today = todayISO();
    if (activePlan) {
      const entry = activePlan.schedule.find(e => e.date === today && !e.skipped);
      if (entry) markScheduleEntry(today, 'done', true);
    }
    const exerciseData = exercises.map(ex => ({
      name: ex.name, unit: units[ex.name], prescription: ex.prescription,
      // RPE is what lets the next session autoregulate — it has to survive the save.
      sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps, done: s.done, rpe: s.rpe })),
      warmupSets: (ex.warmupSets ?? []).map(s => ({ weight: s.weight, reps: s.reps, done: s.done })),
    }));
    addHistory({
      id: Date.now(), date: today, name: workoutName, dayName: dayName || workoutName,
      duration: elapsed, volume: Math.round(totalVolume), sets: totalSets,
      notes: sessionNotes,
      exercises: exerciseData,
    });
    if (onComplete) {
      const exerciseStrings = exercises.map(ex => `${ex.name} — ${ex.prescription}`);
      onComplete(exerciseStrings, dayName || workoutName);
    }
    endSession();
    onClose();
    navigate('/history');
  }

  function handleDiscard() {
    endSession();
    onClose();
  }

  function handleCancel() {
    if (window.confirm('Cancel workout? Progress will be lost.')) {
      endSession();
      onClose();
    }
  }

  // ── Exercise drag-to-reorder ─────────────────────────────────────────────────
  function startExerciseDrag(e, idx) {
    e.preventDefault();
    setDragIdx(idx);
    setDropLineIdx(idx);
    dragActive.current = { startIdx: idx, currentDropLine: idx };

    const getY = ev => ev.touches ? ev.touches[0].clientY : ev.clientY;

    const onMove = ev => {
      if (!dragActive.current) return;
      if (ev.cancelable) ev.preventDefault();
      const y = getY(ev);
      let dropLine = 0;
      for (let i = 0; i < cardRefs.current.length; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (y > rect.top + rect.height / 2) dropLine = i + 1;
      }
      if (dropLine !== dragActive.current.currentDropLine) {
        dragActive.current.currentDropLine = dropLine;
        setDropLineIdx(dropLine);
      }
    };

    const onEnd = () => {
      if (!dragActive.current) return;
      const from = dragActive.current.startIdx;
      const dl   = dragActive.current.currentDropLine;
      const to   = dl > from ? dl - 1 : dl;
      if (from !== to) {
        setExercises(prev => {
          const next = [...prev];
          const [item] = next.splice(from, 1);
          next.splice(to, 0, item);
          return next;
        });
      }
      dragActive.current = null;
      setDragIdx(null);
      setDropLineIdx(null);
      setReexpanding(true);
      setTimeout(() => setReexpanding(false), 220);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchend', onEnd);
  }

  // ── Create & add custom exercise ─────────────────────────────────────────────
  function handleCreateExercise() {
    const name = newExName.trim();
    if (!name) return;
    const movement = { name, category: newExCategory, equipment: newExEquipment.trim() || 'Cable machine' };
    addCustomMovement(movement);
    addExercise(movement);
    setCreatingExercise(false);
    setNewExName('');
    setNewExEquipment('Cable machine');
  }

  // ── Set row renderer ─────────────────────────────────────────────────────────
  function renderSetRow(exIdx, setIdx, set, isWarmup) {
    const ex     = exercises[exIdx];
    const unit   = units[ex.name];
    const key    = isWarmup ? `w-${exIdx}-${setIdx}` : `${exIdx}-${setIdx}`;
    const label  = isWarmup ? `W${setIdx + 1}` : `Set ${setIdx + 1}`;

    const lastData = getLastSets(ex.name, history);
    const last     = !isWarmup ? lastData?.sets?.[setIdx] : null;
    const lastW    = last?.weight ? convertWeight(last.weight, lastData.unit, unit) : null;

    const canRemove    = isWarmup ? true : ex.sets.length > 1;
    const isFlash      = !isWarmup && flashSet === key;
    const isLocked     = lockedSwipe === key;
    const onUpdate     = isWarmup ? updateWarmupSet  : updateSet;
    const onAdjReps    = isWarmup ? adjustWarmupReps  : adjustReps;
    const onToggleDone = isWarmup ? toggleWarmupDone  : toggleDone;
    const onRemove     = isWarmup ? () => removeWarmupSet(exIdx, setIdx) : () => removeSet(exIdx, setIdx);

    return (
      <Fragment key={key}>
        <div className={styles.swipeWrapper}>
          {canRemove && (
            <div className={styles.deleteZone}>
              <button className={styles.deleteBtn} onClick={onRemove}>Remove</button>
            </div>
          )}
          <div
            ref={el => { if (el) swipeRefs.current[key] = el; }}
            className={[
              styles.setRow,
              set.done ? styles.done    : '',
              isWarmup ? styles.warmupRow : '',
              isFlash  ? styles.flashRow  : '',
            ].filter(Boolean).join(' ')}
            onTouchStart={e => swipeStart(e, key)}
            onTouchMove={swipeMove}
            onTouchEnd={() => swipeEnd(key, set.done)}
            onClick={() => { if (isLocked) closeSwipe(key); }}
          >
            <div className={styles.setLabelCol}>
              <span className={`${styles.setLabel}${isWarmup ? ' ' + styles.warmupLabel : ''}`}>{label}</span>
              {!isWarmup && lastW && last?.reps && (
                <span className={styles.lastHint}>{lastW} {unit} × {last.reps}</span>
              )}
            </div>
            <input
              className={styles.weightInput}
              type="number" inputMode="decimal"
              placeholder={lastW || '—'}
              value={set.weight}
              onChange={e => onUpdate(exIdx, setIdx, 'weight', e.target.value)}
            />
            <span className={styles.unitLabel}>{unit}</span>
            <span className={styles.times}>×</span>
            <button className={styles.repAdj} onClick={() => onAdjReps(exIdx, setIdx, -1)}>−</button>
            <input
              className={styles.repsInput}
              type="number" inputMode="numeric"
              placeholder={last?.reps || '—'}
              value={set.reps}
              onChange={e => onUpdate(exIdx, setIdx, 'reps', e.target.value)}
            />
            <button className={styles.repAdj} onClick={() => onAdjReps(exIdx, setIdx, 1)}>+</button>
            <button
              className={`${styles.completeBtn}${set.done ? ' ' + styles.done : ''}`}
              onClick={() => onToggleDone(exIdx, setIdx)}
            >
              {set.done && (
                <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          </div>
        </div>
        {set.done && !isWarmup && (
          <div className={styles.rpeBar}>
            <span className={styles.rpeLabel}>RPE</span>
            {[6, 7, 8, 9, 10].map(r => {
              const color = r <= 7 ? 'var(--green)' : r <= 9 ? 'var(--amber)' : 'var(--red)';
              return (
                <button
                  key={r}
                  className={`${styles.rpeBtn}${set.rpe === r ? ' ' + styles.rpeBtnActive : ''}`}
                  style={set.rpe === r ? { background: color, borderColor: color } : {}}
                  onClick={() => updateRPE(exIdx, setIdx, set.rpe === r ? undefined : r)}
                >
                  {r}
                </button>
              );
            })}
          </div>
        )}
      </Fragment>
    );
  }

  const swapCategory = swapIdx !== null ? getMovement(exercises[swapIdx]?.name)?.category : null;
  const swapOptions  = swapCategory
    ? pickerMovements.filter(m => m.category === swapCategory && m.name !== exercises[swapIdx]?.name)
    : [];

  const addOptions = pickerMovements.filter(m =>
    (addFilter === 'All' || m.category === addFilter) &&
    !exercises.find(e => e.name === m.name)
  );

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <button className={styles.cancelBtn} onClick={handleCancel}>✕ Cancel</button>
        <div className={styles.centre}>
          <div className={styles.workoutName}>{workoutName}</div>
          <div className={styles.timer}>{formatTimer(elapsed)}</div>
          <div className={styles.buildLabel}>{BUILD_LABEL}</div>
        </div>
        <button className={styles.finishBtn} onClick={handleFinish}>Finish</button>
      </div>

      {prToast && <div className={styles.prToast}>{prToast}</div>}
      {restVisible && (
        <RestTimer
          duration={activeRestDuration}
          onDone={handleDismissRest}
          audioCtx={audioCtxRef.current}
        />
      )}

      <div className={styles.scrollArea}>
        {exercises.map((ex, exIdx) => {
          const unit         = units[ex.name];
          const restDur      = restDurations[ex.name] ?? REST_DEFAULT;
          const exHistory    = getExerciseHistory(ex.name, history);
          const showHistory  = historyOpen.has(ex.name);
          const showWarmupUi = warmupPrompt?.exIdx === exIdx;
          const warmupSets   = ex.warmupSets ?? [];

          // Plate calculator
          const maxWeight    = ex.sets.reduce((m, s) => Math.max(m, parseFloat(s.weight) || 0), 0);
          const plates       = isBarbell(ex.name) && maxWeight > 0 ? calcPlates(maxWeight, unit) : null;

          const isDragging = dragIdx === exIdx;
          const collapsedMode = dragIdx !== null;
          const isDnDNoOp  = collapsedMode && (dropLineIdx === dragIdx || dropLineIdx === dragIdx + 1);
          const showDropBefore = !isDnDNoOp && dropLineIdx === exIdx && collapsedMode;

          return (
            <Fragment key={exIdx}>
              {showDropBefore && <div className={styles.dropLine} />}
              <div
                ref={el => { cardRefs.current[exIdx] = el; }}
                className={[styles.exerciseCard, isDragging ? styles.draggingCard : ''].filter(Boolean).join(' ')}
              >
              <div className={[styles.exerciseHeader, collapsedMode ? styles.exerciseHeaderCollapsed : ''].filter(Boolean).join(' ')}>
                <div className={styles.exerciseTitleRow}>
                  <button
                    className={styles.dragHandle}
                    onMouseDown={e => startExerciseDrag(e, exIdx)}
                    onTouchStart={e => startExerciseDrag(e, exIdx)}
                  >
                    ☰
                  </button>
                  <div className={styles.exerciseTitleInfo}>
                    <div className={styles.exerciseName}>{ex.name}</div>
                    {!collapsedMode && ex.prescription && <div className={styles.exercisePrescription}>{ex.prescription}</div>}
                    {!collapsedMode && (() => {
                      const sug = getSuggestion(ex, units[ex.name]);
                      if (!sug) return null;
                      return (
                        <button
                          className={`${styles.overloadChip} ${styles['overload_' + sug.action] ?? ''}`}
                          onClick={() => applyProgression(exIdx, sug)}
                          title={sug.rationale}
                        >
                          <span className={styles.overloadLabel}>
                            {ACTION_ICON[sug.action]} {sug.label}
                          </span>
                          <span className={styles.overloadReason}>{sug.rationale}</span>
                        </button>
                      );
                    })()}
                  </div>
                  {!collapsedMode && (
                    <div className={styles.titleActions}>
                      <div className={styles.exUnitToggle}>
                        <button className={`${styles.exUnitBtn}${unit === 'lb' ? ' ' + styles.exUnitActive : ''}`} onClick={() => toggleUnit(exIdx, ex.name, 'lb')}>lb</button>
                        <button className={`${styles.exUnitBtn}${unit === 'kg' ? ' ' + styles.exUnitActive : ''}`} onClick={() => toggleUnit(exIdx, ex.name, 'kg')}>kg</button>
                      </div>
                      {exercises.length > 1 && (
                        <button className={styles.deleteExBtn} onClick={() => deleteExercise(exIdx)}>✕</button>
                      )}
                    </div>
                  )}
                </div>

                {!collapsedMode && (
                  <>
                    <div className={styles.exerciseActions}>
                      <div className={styles.restControl}>
                        <span className={styles.restIcon}>⏱</span>
                        <button className={styles.restAdj} onClick={() => adjustRest(ex.name, -REST_STEP)} disabled={restDur <= REST_MIN}>−</button>
                        <span className={styles.restVal}>{restDur}s</span>
                        <button className={styles.restAdj} onClick={() => adjustRest(ex.name, REST_STEP)} disabled={restDur >= REST_MAX}>+</button>
                      </div>
                      <div className={styles.actionBtns}>
                        <button
                          className={`${styles.actionBtn}${showWarmupUi ? ' ' + styles.actionBtnActive : ''}`}
                          onClick={() => setWarmupPrompt(showWarmupUi ? null : { exIdx, count: 2 })}
                        >Warmup</button>
                        <button
                          className={`${styles.actionBtn}${showHistory ? ' ' + styles.actionBtnActive : ''}`}
                          onClick={() => toggleHistoryPanel(ex.name)}
                        >📈</button>
                        <button className={styles.actionBtn} onClick={() => setSwapIdx(exIdx)}>Swap ↕</button>
                      </div>
                    </div>
                    {showWarmupUi && (
                      <div className={styles.warmupPrompt}>
                        <span className={styles.warmupPromptLabel}>Warmup sets:</span>
                        <button className={styles.warmupAdj} onClick={() => setWarmupPrompt(p => ({ ...p, count: Math.max(1, p.count - 1) }))}>−</button>
                        <span className={styles.warmupCount}>{warmupPrompt.count}</span>
                        <button className={styles.warmupAdj} onClick={() => setWarmupPrompt(p => ({ ...p, count: Math.min(6, p.count + 1) }))}>+</button>
                        <button className={styles.warmupAddBtn} onClick={() => { addWarmupSets(exIdx, warmupPrompt.count); setWarmupPrompt(null); }}>Add</button>
                        <button className={styles.warmupCancelBtn} onClick={() => setWarmupPrompt(null)}>✕</button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {!collapsedMode && (
                <div className={reexpanding ? styles.reexpandContent : ''}>
                  {showHistory && (
                    <div className={styles.historyPanel}>
                      <div className={styles.historyPanelTitle}>PREVIOUS SESSIONS</div>
                      {exHistory.length === 0
                        ? <div className={styles.historyEmpty}>No previous sessions recorded</div>
                        : exHistory.map((session, si) => {
                            const sx    = session.exercises?.find(e => e.name === ex.name);
                            const sUnit = sx?.unit || 'lb';
                            const done  = sx?.sets?.filter(s => s.done) ?? [];
                            return (
                              <div key={si} className={styles.historySession}>
                                <div className={styles.historyDate}>{formatDate(session.date)}</div>
                                {done.length === 0
                                  ? <div className={styles.historySetRow}>No sets recorded</div>
                                  : done.map((s, di) => (
                                      <div key={di} className={styles.historySetRow}>
                                        <span className={styles.historySetNum}>Set {di + 1}</span>
                                        <span className={styles.historySetData}>{s.weight || '—'} {sUnit} × {s.reps || '—'} reps</span>
                                      </div>
                                    ))
                                }
                              </div>
                            );
                          })
                      }
                    </div>
                  )}
                  {warmupSets.map((set, si) => renderSetRow(exIdx, si, set, true))}
                  {ex.sets.map((set, si) => renderSetRow(exIdx, si, set, false))}
                  {plates && plates.length > 0 && (
                    <div className={styles.platePanel}>
                      <span className={styles.platePanelLabel}>Each side:</span>
                      {plates.map(({ plate, count }) => (
                        <span key={plate} className={styles.plateChip}>{count}×{plate}</span>
                      ))}
                    </div>
                  )}
                  <button className={styles.addSetBtn} onClick={() => addSet(exIdx)}>+ Add set</button>
                </div>
              )}
              </div>
            </Fragment>
          );
        })}
        {dragIdx !== null && !((dropLineIdx === dragIdx || dropLineIdx === dragIdx + 1)) && dropLineIdx === exercises.length && (
          <div className={styles.dropLine} />
        )}

        <div className={styles.notesSection}>
          <label className={styles.notesLabel}>Session notes</label>
          <textarea
            className={styles.notesArea}
            placeholder="How did it feel? Any observations…"
            value={sessionNotes}
            onChange={e => setSessionNotes(e.target.value)}
            rows={3}
          />
        </div>

        <button className={styles.addExerciseBtn} onClick={() => setAddingExercise(true)}>
          + Add exercise
        </button>
      </div>

      {/* Workout summary */}
      {showSummary && (
        <WorkoutSummary
          workoutName={workoutName}
          elapsed={elapsed}
          exercises={exercises}
          units={units}
          prsByExercise={prsByExercise}
          notes={sessionNotes}
          onSave={handleSave}
          onDiscard={handleDiscard}
        />
      )}

      {/* Swap sheet */}
      {swapIdx !== null && (
        <>
          <div className={styles.swapBackdrop} onClick={() => setSwapIdx(null)} />
          <div className={styles.swapSheet}>
            <div className={styles.swapHeader}>
              <span className={styles.swapTitle}>Swap · {swapCategory}</span>
              <button className={styles.swapClose} onClick={() => setSwapIdx(null)}>✕</button>
            </div>
            <div className={styles.swapList}>
              {swapOptions.map(m => (
                <button key={m.name} className={styles.swapOption} onClick={() => swapExercise(m)}>
                  <span className={styles.swapOptName}>
                    {m.name}
                    {m.custom && <span className={styles.customBadge}>custom</span>}
                  </span>
                  <span className={styles.swapOptMeta}>{m.equipment}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Add exercise sheet */}
      {addingExercise && (
        <>
          <div className={styles.swapBackdrop} onClick={() => { setAddingExercise(false); setCreatingExercise(false); setNewExName(''); }} />
          <div className={styles.swapSheet}>
            <div className={styles.swapHeader}>
              <span className={styles.swapTitle}>Add exercise</span>
              <button className={styles.swapClose} onClick={() => { setAddingExercise(false); setCreatingExercise(false); setNewExName(''); }}>✕</button>
            </div>

            {creatingExercise ? (
              <div className={styles.createForm}>
                <input
                  className={styles.createFormInput}
                  value={newExName}
                  onChange={e => setNewExName(e.target.value)}
                  placeholder="Exercise name"
                  autoFocus
                />
                <select
                  className={styles.createFormSelect}
                  value={newExCategory}
                  onChange={e => setNewExCategory(e.target.value)}
                >
                  {MOV_CATEGORIES.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <input
                  className={styles.createFormInput}
                  value={newExEquipment}
                  onChange={e => setNewExEquipment(e.target.value)}
                  placeholder="Equipment (e.g. Cable machine)"
                />
                <div className={styles.createFormBtns}>
                  <button className={styles.createCancelBtn} onClick={() => { setCreatingExercise(false); setNewExName(''); }}>Cancel</button>
                  <button className={styles.createConfirmBtn} onClick={handleCreateExercise} disabled={!newExName.trim()}>Create &amp; add</button>
                </div>
              </div>
            ) : (
              <button className={styles.createNewExBtn} onClick={() => setCreatingExercise(true)}>
                + Create new exercise
              </button>
            )}

            <div className={styles.addFilterRow}>
              {MOV_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`${styles.addFilterPill}${addFilter === cat ? ' ' + styles.addFilterActive : ''}`}
                  onClick={() => setAddFilter(cat)}
                >{cat}</button>
              ))}
            </div>
            <div className={styles.swapList}>
              {addOptions.map(m => (
                <button key={m.name} className={styles.swapOption} onClick={() => addExercise(m)}>
                  <span className={styles.swapOptName}>
                    {m.name}
                    {m.custom && <span className={styles.customBadge}>custom</span>}
                  </span>
                  <span className={styles.swapOptMeta}>{m.category} · {m.equipment}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
