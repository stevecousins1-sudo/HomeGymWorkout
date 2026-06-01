import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getExercisesForDay } from '../../data/exercises';
import WorkoutOverlay from '../../components/WorkoutOverlay/WorkoutOverlay';
import { formatDate, formatDuration, formatVolume } from '../../utils';
import styles from './History.module.css';

function parseExercise(str) {
  const parts = str.split(' — ');
  return { name: parts[0], prescription: parts[1] || '' };
}

function parseSetCount(prescription) {
  const match = prescription.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 3;
}

// Convert a history entry's exercises array back to "Name — Nx" strings for WorkoutOverlay
function entryToExerciseStrings(entry) {
  if (entry.exercises?.length > 0) {
    return entry.exercises.map(ex => `${ex.name} — ${ex.sets.length}×`);
  }
  return null;
}

export default function History() {
  const { history } = useApp();
  const [detail, setDetail] = useState(null);
  const [overlay, setOverlay] = useState(null);

  const totalWorkouts = history.length;
  const totalVolume = history.reduce((a, h) => a + h.volume, 0);
  const avgSets = history.length > 0
    ? Math.round(history.reduce((a, h) => a + h.sets, 0) / history.length)
    : 0;

  function startRedo(entry) {
    const exercises = entryToExerciseStrings(entry);
    setOverlay({ name: entry.name, dayName: entry.dayName || entry.name, exercises });
  }

  if (detail) {
    const hasExerciseData = detail.exercises?.length > 0;

    // Fall back to plan template for old entries without exercise data
    const planExercises = hasExerciseData
      ? null
      : getExercisesForDay(detail.dayName || detail.name);

    return (
      <>
        <div className={styles.screen}>
          <button className={styles.backBtn} onClick={() => setDetail(null)}>← Back</button>
          <div className={styles.detailName}>{detail.name}</div>
          <div className={styles.detailDate}>{formatDate(detail.date)}</div>

          <div className={styles.chips}>
            <div className={styles.chip}>
              <div className={styles.chipValue}>{formatDuration(detail.duration)}</div>
              <div className={styles.chipLabel}>Duration</div>
            </div>
            <div className={styles.chip}>
              <div className={styles.chipValue}>{formatVolume(detail.volume)}</div>
              <div className={styles.chipLabel}>Volume</div>
            </div>
            <div className={styles.chip}>
              <div className={styles.chipValue}>{detail.sets}</div>
              <div className={styles.chipLabel}>Sets done</div>
            </div>
          </div>

          <div className={styles.sectionTitle}>MOVEMENTS</div>

          {hasExerciseData
            ? detail.exercises.map((ex, i) => {
                const doneSets = ex.sets.filter(s => s.done);
                return (
                  <div key={i} className={styles.exCard}>
                    <div className={styles.exHeader}>
                      <div className={styles.exName}>{ex.name}</div>
                      <span className={styles.setBadge}>{doneSets.length}/{ex.sets.length} sets</span>
                    </div>
                    {ex.sets.map((s, si) => (
                      <div key={si} className={`${styles.setRowDetail}${s.done ? ' ' + styles.setDone : ''}`}>
                        <span className={styles.setNumDetail}>Set {si + 1}</span>
                        <span className={styles.setData}>
                          {s.weight || '—'} {ex.unit} × {s.reps || '—'} reps
                        </span>
                        <div className={`${styles.checkCircle}${s.done ? ' ' + styles.checkDone : ''}`} />
                      </div>
                    ))}
                  </div>
                );
              })
            : planExercises.map((str, i) => {
                const { name, prescription } = parseExercise(str);
                const setCount = parseSetCount(prescription);
                return (
                  <div key={i} className={styles.exCard}>
                    <div className={styles.exHeader}>
                      <div>
                        <div className={styles.exName}>{name}</div>
                        {prescription && <div className={styles.exPrescription}>{prescription}</div>}
                      </div>
                      <span className={styles.setBadge}>{setCount} sets</span>
                    </div>
                    {Array.from({ length: setCount }).map((_, si) => (
                      <div key={si} className={styles.setRowDetail}>
                        <span className={styles.setNumDetail}>Set {si + 1}</span>
                        <span className={styles.setData}>— × —</span>
                        <div className={styles.checkCircle} />
                      </div>
                    ))}
                  </div>
                );
              })
          }

          <button className={styles.redoBottomBtn} onClick={() => startRedo(detail)}>
            ↺ Redo this workout
          </button>
        </div>

        {overlay && (
          <WorkoutOverlay
            workoutName={overlay.name}
            dayName={overlay.dayName}
            exercises={overlay.exercises ?? undefined}
            onClose={() => setOverlay(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className={styles.screen}>
        <div className={styles.heading}>History</div>

        <div className={styles.statsRow}>
          <div className={styles.statChip}>
            <div className={styles.statValue}>{totalWorkouts}</div>
            <div className={styles.statLabel}>Workouts</div>
          </div>
          <div className={styles.statChip}>
            <div className={styles.statValue}>{formatVolume(totalVolume)}</div>
            <div className={styles.statLabel}>Total volume</div>
          </div>
          <div className={styles.statChip}>
            <div className={styles.statValue}>{avgSets}</div>
            <div className={styles.statLabel}>Avg sets</div>
          </div>
        </div>

        {history.length === 0 && (
          <div className={styles.empty}>No workouts yet. Start one to see history.</div>
        )}

        <div className={styles.list}>
          {history.map(entry => (
            <div key={entry.id} className={styles.card} onClick={() => setDetail(entry)}>
              <div className={styles.cardTop}>
                <div>
                  <div className={styles.cardName}>{entry.name}</div>
                  <div className={styles.cardDate}>{formatDate(entry.date)}</div>
                </div>
                <span className={styles.viewLink}>View →</span>
              </div>
              <div className={styles.cardMeta}>
                <span className={styles.metaItem}>{formatDuration(entry.duration)}</span>
                <span className={styles.metaItem}>{formatVolume(entry.volume)}</span>
                <span className={styles.metaItem}>{entry.sets} sets</span>
              </div>
              <button
                className={styles.redoBtn}
                onClick={e => { e.stopPropagation(); startRedo(entry); }}
              >
                ↺ Redo
              </button>
            </div>
          ))}
        </div>
      </div>

      {overlay && (
        <WorkoutOverlay
          workoutName={overlay.name}
          dayName={overlay.dayName}
          exercises={overlay.exercises ?? undefined}
          onClose={() => setOverlay(null)}
        />
      )}
    </>
  );
}
