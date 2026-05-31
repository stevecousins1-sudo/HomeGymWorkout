import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useWorkoutTimer } from '../../hooks/useWorkoutTimer';
import { getExercisesForDay } from '../../data/exercises';
import RestTimer from '../RestTimer/RestTimer';
import { formatTimer, todayISO, convertWeight, getDefaultUnit } from '../../utils';
import styles from './WorkoutOverlay.module.css';

function parseExercise(str) {
  const parts = str.split(' — ');
  return { name: parts[0], prescription: parts[1] || '' };
}

function buildSets(prescription) {
  const match = prescription.match(/^(\d+)/);
  const count = match ? parseInt(match[1], 10) : 3;
  return Array.from({ length: count }, () => ({ weight: '', reps: '', done: false }));
}

function buildExercises(dayNameOrList) {
  const rawList = Array.isArray(dayNameOrList)
    ? dayNameOrList
    : getExercisesForDay(dayNameOrList);
  return rawList.map(str => {
    const { name, prescription } = parseExercise(str);
    return { name, prescription, sets: buildSets(prescription) };
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

export default function WorkoutOverlay({ workoutName, dayName, exercises: exercisesProp, onClose }) {
  const { addHistory, markScheduleEntry, activePlan, unitPrefs, setUnitPref, history } = useApp();
  const navigate = useNavigate();
  const elapsed = useWorkoutTimer(true);

  const [exercises, setExercises] = useState(() =>
    exercisesProp ? buildExercises(exercisesProp) : buildExercises(dayName)
  );
  const [units, setUnits] = useState(() => {
    const list = exercisesProp ? buildExercises(exercisesProp) : buildExercises(dayName);
    return list.reduce((acc, ex) => {
      acc[ex.name] = unitPrefs[ex.name] ?? getDefaultUnit(ex.name);
      return acc;
    }, {});
  });
  const [restVisible, setRestVisible] = useState(false);

  const handleDismissRest = useCallback(() => setRestVisible(false), []);

  function toggleUnit(exIdx, exName, newUnit) {
    const oldUnit = units[exName];
    if (oldUnit === newUnit) return;
    setExercises(prev => prev.map((ex, i) =>
      i === exIdx
        ? { ...ex, sets: ex.sets.map(s => ({ ...s, weight: convertWeight(s.weight, oldUnit, newUnit) })) }
        : ex
    ));
    setUnits(prev => ({ ...prev, [exName]: newUnit }));
    setUnitPref(exName, newUnit);
  }

  function updateSet(exIdx, setIdx, field, value) {
    setExercises(prev => prev.map((ex, ei) =>
      ei === exIdx
        ? { ...ex, sets: ex.sets.map((s, si) => si === setIdx ? { ...s, [field]: value } : s) }
        : ex
    ));
  }

  function toggleDone(exIdx, setIdx) {
    setExercises(prev => {
      const updated = prev.map((ex, ei) =>
        ei === exIdx
          ? { ...ex, sets: ex.sets.map((s, si) => si === setIdx ? { ...s, done: !s.done } : s) }
          : ex
      );
      const wasNotDone = !prev[exIdx].sets[setIdx].done;
      if (wasNotDone) setRestVisible(true);
      return updated;
    });
  }

  function handleFinish() {
    if (!window.confirm('Finish workout and save?')) return;

    const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.done).length, 0);
    const totalVolume = exercises.reduce((acc, ex) => {
      const unit = units[ex.name];
      return acc + ex.sets.filter(s => s.done).reduce((a, s) => {
        const w = parseFloat(s.weight) || 0;
        const r = parseFloat(s.reps) || 0;
        const lbs = unit === 'kg' ? w * 2.2046 : w;
        return a + lbs * r;
      }, 0);
    }, 0);

    const today = todayISO();

    if (activePlan) {
      const entry = activePlan.schedule.find(e => e.date === today && !e.skipped);
      if (entry) markScheduleEntry(today, 'done', true);
    }

    addHistory({
      id: Date.now(),
      date: today,
      name: workoutName,
      dayName: dayName || workoutName,
      duration: elapsed,
      volume: Math.round(totalVolume),
      sets: totalSets,
      exercises: exercises.map(ex => ({
        name: ex.name,
        unit: units[ex.name],
        sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps, done: s.done })),
      })),
    });

    onClose();
    navigate('/history');
  }

  function handleCancel() {
    if (window.confirm('Cancel workout? Progress will be lost.')) {
      onClose();
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <button className={styles.cancelBtn} onClick={handleCancel}>✕ Cancel</button>
        <div className={styles.centre}>
          <div className={styles.workoutName}>{workoutName}</div>
          <div className={styles.timer}>{formatTimer(elapsed)}</div>
        </div>
        <button className={styles.finishBtn} onClick={handleFinish}>Finish</button>
      </div>

      {restVisible && <RestTimer onDone={handleDismissRest} />}

      <div className={styles.scrollArea}>
        {exercises.map((ex, exIdx) => {
          const unit = units[ex.name];
          const lastData = getLastSets(ex.name, history);

          return (
            <div key={exIdx} className={styles.exerciseCard}>
              <div className={styles.exerciseHeader}>
                <div className={styles.exerciseTitleRow}>
                  <div>
                    <div className={styles.exerciseName}>{ex.name}</div>
                    {ex.prescription && (
                      <div className={styles.exercisePrescription}>{ex.prescription}</div>
                    )}
                  </div>
                  <div className={styles.exUnitToggle}>
                    <button
                      className={`${styles.exUnitBtn}${unit === 'lb' ? ' ' + styles.exUnitActive : ''}`}
                      onClick={() => toggleUnit(exIdx, ex.name, 'lb')}
                    >
                      lb
                    </button>
                    <button
                      className={`${styles.exUnitBtn}${unit === 'kg' ? ' ' + styles.exUnitActive : ''}`}
                      onClick={() => toggleUnit(exIdx, ex.name, 'kg')}
                    >
                      kg
                    </button>
                  </div>
                </div>
              </div>
              {ex.sets.map((set, setIdx) => {
                const last = lastData?.sets?.[setIdx];
                const lastW = last?.weight
                  ? convertWeight(last.weight, lastData.unit, unit)
                  : null;
                const hasLast = lastW && last?.reps;

                return (
                  <div key={setIdx} className={`${styles.setRow}${set.done ? ' ' + styles.done : ''}`}>
                    <div className={styles.setLabelCol}>
                      <span className={styles.setLabel}>Set {setIdx + 1}</span>
                      {hasLast && (
                        <span className={styles.lastHint}>{lastW} {unit} × {last.reps}</span>
                      )}
                    </div>
                    <input
                      className={styles.weightInput}
                      type="number"
                      inputMode="decimal"
                      placeholder={lastW || '—'}
                      value={set.weight}
                      onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                    />
                    <span className={styles.unitLabel}>{unit}</span>
                    <span className={styles.times}>×</span>
                    <input
                      className={styles.repsInput}
                      type="number"
                      inputMode="numeric"
                      placeholder={last?.reps || '—'}
                      value={set.reps}
                      onChange={e => updateSet(exIdx, setIdx, 'reps', e.target.value)}
                    />
                    <button
                      className={`${styles.completeBtn}${set.done ? ' ' + styles.done : ''}`}
                      onClick={() => toggleDone(exIdx, setIdx)}
                    >
                      {set.done && (
                        <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
