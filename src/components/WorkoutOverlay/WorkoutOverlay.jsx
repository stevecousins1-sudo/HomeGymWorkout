import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useWorkoutTimer } from '../../hooks/useWorkoutTimer';
import { getExercisesForDay } from '../../data/exercises';
import RestTimer from '../RestTimer/RestTimer';
import { formatTimer, todayISO } from '../../utils';
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

export default function WorkoutOverlay({ workoutName, dayName, exercises: exercisesProp, onClose }) {
  const { addHistory, markScheduleEntry, activePlan } = useApp();
  const navigate = useNavigate();
  const elapsed = useWorkoutTimer(true);

  const [exercises, setExercises] = useState(() =>
    exercisesProp ? buildExercises(exercisesProp) : buildExercises(dayName)
  );
  const [restVisible, setRestVisible] = useState(false);

  const handleDismissRest = useCallback(() => setRestVisible(false), []);

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
    const totalVolume = exercises.reduce((acc, ex) =>
      acc + ex.sets.filter(s => s.done).reduce((a, s) => a + (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 0), 0)
    , 0);

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
        {exercises.map((ex, exIdx) => (
          <div key={exIdx} className={styles.exerciseCard}>
            <div className={styles.exerciseHeader}>
              <div className={styles.exerciseName}>{ex.name}</div>
              {ex.prescription && (
                <div className={styles.exercisePrescription}>{ex.prescription}</div>
              )}
            </div>
            {ex.sets.map((set, setIdx) => (
              <div key={setIdx} className={`${styles.setRow}${set.done ? ' ' + styles.done : ''}`}>
                <span className={styles.setLabel}>Set {setIdx + 1}</span>
                <input
                  className={styles.weightInput}
                  type="number"
                  inputMode="decimal"
                  placeholder="— lb"
                  value={set.weight}
                  onChange={e => updateSet(exIdx, setIdx, 'weight', e.target.value)}
                />
                <span className={styles.times}>×</span>
                <input
                  className={styles.repsInput}
                  type="number"
                  inputMode="numeric"
                  placeholder="—"
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
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
