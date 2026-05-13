import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import WorkoutOverlay from '../../components/WorkoutOverlay/WorkoutOverlay';
import { getExercisesForDay } from '../../data/exercises';
import { formatDate, getGreeting, todayISO } from '../../utils';
import styles from './Today.module.css';

const QUICK_STARTS = [
  { name: 'Push & Pull', desc: 'Chest, back, shoulders', dayName: 'Push A' },
  { name: 'Legs & Core', desc: 'Quads, hamstrings, abs', dayName: 'Legs A' },
  { name: 'Full Body', desc: 'Balanced full-body session', dayName: 'Full Body A' },
];

export default function Today() {
  const { activePlan, markScheduleEntry } = useApp();
  const [overlay, setOverlay] = useState(null);
  const today = todayISO();

  const todayEntry = activePlan?.schedule.find(e => e.date === today);
  const doneCount = activePlan?.schedule.filter(e => e.done).length ?? 0;
  const totalCount = activePlan?.schedule.length ?? 0;

  const nextSession = activePlan?.schedule.find(
    e => !e.done && !e.skipped && e.date > today
  );

  function handleSkip() {
    markScheduleEntry(today, 'skipped', true);
  }

  function startOverlay(name, dayName) {
    setOverlay({ name, dayName });
  }

  return (
    <>
      <div className={styles.screen}>
        <div className={styles.dateRow}>
          <div>
            <div className={styles.greeting}>{getGreeting()}</div>
            <div className={styles.date}>{formatDate(today)}</div>
          </div>
          {activePlan && (
            <div className={styles.progress}>
              <div>{activePlan.planName}</div>
              <div>{doneCount}/{totalCount} sessions</div>
            </div>
          )}
        </div>

        {!activePlan && (
          <div className={`${styles.card} ${styles.cardGrey}`} style={{ paddingLeft: 18 }}>
            <div className={styles.cardTitle}>No active plan</div>
            <div className={styles.cardMeta} style={{ marginBottom: 8 }}>
              Choose a plan to get structured workouts each day.
            </div>
            <Link to="/plans" className={styles.noPlanCta}>Browse plans →</Link>
          </div>
        )}

        {activePlan && todayEntry && !todayEntry.done && !todayEntry.skipped && (() => {
          const exercises = getExercisesForDay(todayEntry.dayName);
          const preview = exercises.slice(0, 3);
          const more = exercises.length - 3;
          return (
            <div className={`${styles.card} ${styles.cardPurple}`} style={{ paddingLeft: 18 }}>
              <div className={styles.scheduledLabel}>SCHEDULED TODAY</div>
              <div className={styles.cardTitle}>{todayEntry.dayName}</div>
              <div className={styles.cardMeta}>{exercises.length} exercises · Week {todayEntry.week}</div>
              <ul className={styles.exerciseList}>
                {preview.map((ex, i) => (
                  <li key={i} className={styles.exerciseItem}>{ex.split(' — ')[0]}</li>
                ))}
                {more > 0 && <li className={styles.more}>+ {more} more</li>}
              </ul>
              <div className={styles.actions}>
                <button className={styles.btnPrimary} onClick={() => startOverlay(todayEntry.dayName, todayEntry.dayName)}>
                  Start workout
                </button>
                <button className={styles.btnOutline} onClick={handleSkip}>Skip</button>
              </div>
            </div>
          );
        })()}

        {activePlan && todayEntry?.done && (
          <div className={`${styles.card} ${styles.cardGreen}`} style={{ paddingLeft: 18 }}>
            <div className={styles.scheduledLabel} style={{ color: 'var(--green-text)' }}>COMPLETED TODAY</div>
            <div className={styles.cardTitle}>{todayEntry.dayName}</div>
            {nextSession && (
              <div className={styles.cardMeta}>Next: {nextSession.dayName} on {formatDate(nextSession.date)}</div>
            )}
          </div>
        )}

        {activePlan && todayEntry?.skipped && (
          <div className={`${styles.card} ${styles.cardGrey}`} style={{ paddingLeft: 18 }}>
            <div className={styles.scheduledLabel} style={{ color: 'var(--text-secondary)' }}>SKIPPED</div>
            <div className={styles.cardTitle}>{todayEntry.dayName}</div>
            {nextSession && (
              <div className={styles.cardMeta}>Next: {nextSession.dayName} on {formatDate(nextSession.date)}</div>
            )}
          </div>
        )}

        {activePlan && !todayEntry && (
          <div className={`${styles.card} ${styles.cardGrey}`} style={{ paddingLeft: 18 }}>
            <div className={styles.cardTitle}>Rest day</div>
            {nextSession && (
              <div className={styles.cardMeta}>Next: {nextSession.dayName} on {formatDate(nextSession.date)}</div>
            )}
          </div>
        )}

        <div className={styles.sectionTitle}>QUICK START</div>
        <div className={styles.quickGrid}>
          {QUICK_STARTS.map(qs => (
            <div key={qs.name} className={styles.quickCard}>
              <div className={styles.quickInfo}>
                <span className={styles.quickName}>{qs.name}</span>
                <span className={styles.quickDesc}>{qs.desc}</span>
              </div>
              <button className={styles.quickStart} onClick={() => startOverlay(qs.name, qs.dayName)}>
                Start
              </button>
            </div>
          ))}
        </div>
      </div>

      {overlay && (
        <WorkoutOverlay
          workoutName={overlay.name}
          dayName={overlay.dayName}
          onClose={() => setOverlay(null)}
        />
      )}
    </>
  );
}
