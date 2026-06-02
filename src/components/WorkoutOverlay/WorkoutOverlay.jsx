import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useWorkoutTimer } from '../../hooks/useWorkoutTimer';
import { getExercisesForDay } from '../../data/exercises';
import { MOVEMENTS } from '../../data/movements';
import RestTimer from '../RestTimer/RestTimer';
import { formatTimer, formatDate, todayISO, convertWeight, getDefaultUnit } from '../../utils';
import { getBuildLabel } from '../../lib/version';
import styles from './WorkoutOverlay.module.css';

const REST_DEFAULT      = 90;
const REST_STEP         = 15;
const REST_MIN          = 15;
const REST_MAX          = 300;
const SWIPE_LOCK_PX     = 60;  // px of swipe needed to lock delete open
const SWIPE_DELETE_W    = 72;  // width of the revealed delete zone

const BUILD_LABEL = getBuildLabel();

const _movMap = new Map(MOVEMENTS.map(m => [m.name.toLowerCase(), m]));
function getMovement(name) { return _movMap.get(name.toLowerCase()) ?? null; }
function isBodyweight(name) { return getMovement(name)?.equipment?.includes('Bodyweight') ?? false; }

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

export default function WorkoutOverlay({ workoutName, dayName, exercises: exercisesProp, onClose }) {
  const { addHistory, markScheduleEntry, activePlan, unitPrefs, setUnitPref,
          restPrefs, setRestPref, history } = useApp();
  const navigate = useNavigate();
  const elapsed  = useWorkoutTimer(true);

  const initList = () => exercisesProp ? buildExercises(exercisesProp) : buildExercises(dayName);

  const [exercises, setExercises]                   = useState(initList);
  const [units, setUnits]                           = useState(() =>
    initList().reduce((acc, ex) => ({ ...acc, [ex.name]: unitPrefs[ex.name] ?? getDefaultUnit(ex.name) }), {})
  );
  const [restDurations, setRestDurations]           = useState(() =>
    initList().reduce((acc, ex) => ({ ...acc, [ex.name]: restPrefs[ex.name] ?? REST_DEFAULT }), {})
  );
  const [restVisible, setRestVisible]               = useState(false);
  const [activeRestDuration, setActiveRestDuration] = useState(REST_DEFAULT);
  const [swapIdx, setSwapIdx]                       = useState(null);
  const [historyOpen, setHistoryOpen]               = useState(new Set());
  const [flashSet, setFlashSet]                     = useState(null);     // 'exIdx-setIdx'
  const [warmupPrompt, setWarmupPrompt]             = useState(null);     // { exIdx, count }
  const [lockedSwipe, setLockedSwipe]               = useState(null);     // swipe key

  // Refs for swipe animation (direct DOM updates avoid re-renders during drag)
  const swipeRefs    = useRef({});
  const touchStartX  = useRef(0);
  const activeSwipeK = useRef(null);

  const handleDismissRest = useCallback(() => setRestVisible(false), []);

  // ── Unit toggle ─────────────────────────────────────────────────────────────
  function toggleUnit(exIdx, exName, newUnit) {
    const oldUnit = units[exName];
    if (oldUnit === newUnit) return;
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx ? { ...ex, sets: ex.sets.map(s => ({ ...s, weight: convertWeight(s.weight, oldUnit, newUnit) })) } : ex
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

  // ── Lift history panel ───────────────────────────────────────────────────────
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
          // Auto-fill sets below that are empty or still carry the previous auto-filled value
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
      // Feature 1: flash the row instead of completing
      const key = `${exIdx}-${setIdx}`;
      setFlashSet(key);
      setTimeout(() => setFlashSet(null), 700);
      return;
    }
    setExercises(prev => {
      const next = prev.map((e, ei) =>
        ei !== exIdx ? e : { ...e, sets: e.sets.map((s, si) => si !== setIdx ? s : { ...s, done: !s.done }) }
      );
      if (!set.done) {
        setActiveRestDuration(restDurations[prev[exIdx].name] ?? REST_DEFAULT);
        setRestVisible(true);
      }
      return next;
    });
  }

  function addSet(exIdx) {
    setExercises(prev => prev.map((ex, i) => i !== exIdx ? ex : { ...ex, sets: [...ex.sets, makeSet()] }));
  }

  function removeSet(exIdx, setIdx) {
    setExercises(prev => prev.map((ex, i) => {
      if (i !== exIdx || ex.sets.length <= 1) return ex;
      return { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) };
    }));
    setLockedSwipe(null);
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

  // ── Swipe-to-delete (direct DOM for smooth animation) ────────────────────────
  function swipeStart(e, key) {
    // Close any other locked swipe first
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
    if (delta > 0) {
      el.style.transform = `translateX(-${Math.min(SWIPE_DELETE_W, delta)}px)`;
    } else if (delta < -10) {
      // Swiping right — close
      el.style.transform = 'translateX(0)';
    }
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

  // ── Swap exercise ─────────────────────────────────────────────────────────────
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

  // ── Finish ────────────────────────────────────────────────────────────────────
  function handleFinish() {
    if (!window.confirm('Finish workout and save?')) return;
    // Warmup sets excluded from totals
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
    addHistory({
      id: Date.now(), date: today, name: workoutName, dayName: dayName || workoutName,
      duration: elapsed, volume: Math.round(totalVolume), sets: totalSets,
      exercises: exercises.map(ex => ({
        name: ex.name, unit: units[ex.name],
        sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps, done: s.done })),
        warmupSets: (ex.warmupSets ?? []).map(s => ({ weight: s.weight, reps: s.reps, done: s.done })),
      })),
    });
    onClose();
    navigate('/history');
  }

  function handleCancel() {
    if (window.confirm('Cancel workout? Progress will be lost.')) onClose();
  }

  // ── Set row renderer (shared for working + warmup sets) ───────────────────────
  function renderSetRow(exIdx, setIdx, set, isWarmup) {
    const ex     = exercises[exIdx];
    const unit   = units[ex.name];
    const key    = isWarmup ? `w-${exIdx}-${setIdx}` : `${exIdx}-${setIdx}`;
    const label  = isWarmup ? `W${setIdx + 1}` : `Set ${setIdx + 1}`;

    const lastData = getLastSets(ex.name, history);
    const last     = !isWarmup ? lastData?.sets?.[setIdx] : null;
    const lastW    = last?.weight ? convertWeight(last.weight, lastData.unit, unit) : null;

    const canRemove = isWarmup ? true : ex.sets.length > 1;
    const isFlash   = !isWarmup && flashSet === key;
    const isLocked  = lockedSwipe === key;

    const onUpdate     = isWarmup ? updateWarmupSet  : updateSet;
    const onAdjReps    = isWarmup ? adjustWarmupReps  : adjustReps;
    const onToggleDone = isWarmup ? toggleWarmupDone  : toggleDone;
    const onRemove     = isWarmup ? () => removeWarmupSet(exIdx, setIdx) : () => removeSet(exIdx, setIdx);

    return (
      <div key={key} className={styles.swipeWrapper}>
        {canRemove && (
          <div className={styles.deleteZone}>
            <button className={styles.deleteBtn} onClick={onRemove}>Remove</button>
          </div>
        )}
        <div
          ref={el => { if (el) swipeRefs.current[key] = el; }}
          className={[
            styles.setRow,
            set.done    ? styles.done       : '',
            isWarmup    ? styles.warmupRow  : '',
            isFlash     ? styles.flashRow   : '',
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
    );
  }

  // ── Swap options ──────────────────────────────────────────────────────────────
  const swapCategory = swapIdx !== null ? getMovement(exercises[swapIdx]?.name)?.category : null;
  const swapOptions  = swapCategory
    ? MOVEMENTS.filter(m => m.category === swapCategory && m.name !== exercises[swapIdx]?.name)
    : [];

  // ── Main render ───────────────────────────────────────────────────────────────
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

      {restVisible && <RestTimer duration={activeRestDuration} onDone={handleDismissRest} />}

      <div className={styles.scrollArea}>
        {exercises.map((ex, exIdx) => {
          const unit           = units[ex.name];
          const restDur        = restDurations[ex.name] ?? REST_DEFAULT;
          const exHistory      = getExerciseHistory(ex.name, history);
          const showHistory    = historyOpen.has(ex.name);
          const showWarmupUi   = warmupPrompt?.exIdx === exIdx;
          const warmupSets     = ex.warmupSets ?? [];

          return (
            <div key={exIdx} className={styles.exerciseCard}>
              {/* Header */}
              <div className={styles.exerciseHeader}>
                <div className={styles.exerciseTitleRow}>
                  <div>
                    <div className={styles.exerciseName}>{ex.name}</div>
                    {ex.prescription && <div className={styles.exercisePrescription}>{ex.prescription}</div>}
                  </div>
                  <div className={styles.exUnitToggle}>
                    <button className={`${styles.exUnitBtn}${unit === 'lb' ? ' ' + styles.exUnitActive : ''}`} onClick={() => toggleUnit(exIdx, ex.name, 'lb')}>lb</button>
                    <button className={`${styles.exUnitBtn}${unit === 'kg' ? ' ' + styles.exUnitActive : ''}`} onClick={() => toggleUnit(exIdx, ex.name, 'kg')}>kg</button>
                  </div>
                </div>

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

                {/* Inline warmup count picker */}
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
              </div>

              {/* Lift history panel */}
              {showHistory && (
                <div className={styles.historyPanel}>
                  <div className={styles.historyPanelTitle}>PREVIOUS SESSIONS</div>
                  {exHistory.length === 0
                    ? <div className={styles.historyEmpty}>No previous sessions recorded</div>
                    : exHistory.map((session, si) => {
                        const sx   = session.exercises?.find(e => e.name === ex.name);
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

              {/* Warmup sets */}
              {warmupSets.map((set, si) => renderSetRow(exIdx, si, set, true))}

              {/* Working sets */}
              {ex.sets.map((set, si) => renderSetRow(exIdx, si, set, false))}

              {/* Add set */}
              <button className={styles.addSetBtn} onClick={() => addSet(exIdx)}>+ Add set</button>
            </div>
          );
        })}
      </div>

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
                  <span className={styles.swapOptName}>{m.name}</span>
                  <span className={styles.swapOptMeta}>{m.equipment}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
