import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import WorkoutOverlay from '../../components/WorkoutOverlay/WorkoutOverlay';
import { getExercisesForDay } from '../../data/exercises';
import { formatDate, getGreeting, todayISO } from '../../utils';
import styles from './Today.module.css';

function getTodayExercises(activePlan, dayName) {
  if (activePlan?.isCustom && activePlan.exerciseTemplates?.[dayName]) {
    return activePlan.exerciseTemplates[dayName];
  }
  return getExercisesForDay(dayName);
}

function formatShortDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { dow: days[d.getDay()], day: d.getDate() };
}

const QUICK_STARTS = [
  { name: 'Push & Pull', desc: 'Chest, back, shoulders', dayName: 'Push A' },
  { name: 'Legs & Core', desc: 'Quads, hamstrings, abs', dayName: 'Legs A' },
  { name: 'Full Body', desc: 'Balanced full-body session', dayName: 'Full Body A' },
];

export default function Today() {
  const { activePlan, markScheduleEntry, updatePlanDayTemplate, user, logout } = useApp();
  const [overlay, setOverlay] = useState(null);
  const [previewEntry, setPreviewEntry] = useState(null);
  const stripRef = useRef(null);
  const today = todayISO();

  const todayEntry = activePlan?.schedule.find(e => e.date === today);
  const doneCount = activePlan?.schedule.filter(e => e.done).length ?? 0;
  const totalCount = activePlan?.schedule.length ?? 0;
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  const nextSession = activePlan?.schedule.find(
    e => !e.done && !e.skipped && e.date > today
  );

  // Sessions for the strip: from today going forward, up to 12 entries
  const upcomingEntries = activePlan?.schedule.filter(e => e.date >= today).slice(0, 12) ?? [];
  // Also include the last 3 past entries so you can see recent history in context
  const pastEntries = activePlan?.schedule.filter(e => e.date < today).slice(-3) ?? [];
  const stripEntries = [...pastEntries, ...upcomingEntries];

  // Auto-scroll the strip so today is visible
  useEffect(() => {
    if (!stripRef.current) return;
    const todayEl = stripRef.current.querySelector('[data-today="true"]');
    if (todayEl) {
      const stripLeft = stripRef.current.getBoundingClientRect().left;
      const elLeft = todayEl.getBoundingClientRect().left;
      stripRef.current.scrollLeft += elLeft - stripLeft - 16;
    }
  }, [activePlan?.planId]);

  function handleSkip() {
    markScheduleEntry(today, 'skipped', true);
  }

  function startOverlay(name, dayName, exercises) {
    setOverlay({ name, dayName, exercises });
    setPreviewEntry(null);
  }

  function handleStripTap(entry) {
    if (previewEntry?.date === entry.date) {
      setPreviewEntry(null);
    } else {
      setPreviewEntry(entry);
    }
  }

  function getSessionExercises(entry) {
    return getTodayExercises(activePlan, entry.dayName);
  }

  return (
    <>
      <div className={styles.screen}>
        {/* Header */}
        <div className={styles.dateRow}>
          <div>
            <div className={styles.greeting}>{getGreeting()}</div>
            <div className={styles.date}>{formatDate(today)}</div>
          </div>
          <button className={styles.signOutBtn} onClick={logout} title={user?.email}>
            Sign out
          </button>
        </div>

        {/* ── No plan ─────────────────────────────────────────────────────── */}
        {!activePlan && (
          <div className={`${styles.card} ${styles.cardGrey}`}>
            <div className={styles.cardTitle}>No active plan</div>
            <div className={styles.cardMeta}>
              Choose a plan to get structured workouts each day.
            </div>
            <Link to="/plans" className={styles.noPlanCta}>Browse plans →</Link>
          </div>
        )}

        {/* ── Active plan progress bar ─────────────────────────────────────── */}
        {activePlan && (
          <div className={styles.planHeader}>
            <div className={styles.planHeaderTop}>
              <span className={styles.planName}>{activePlan.planName}</span>
              <span className={styles.planSessions}>{doneCount}/{totalCount} sessions</span>
            </div>
            <div className={styles.planTrack}>
              <div className={styles.planFill} style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}

        {/* ── Today: scheduled & pending ───────────────────────────────────── */}
        {activePlan && todayEntry && !todayEntry.done && !todayEntry.skipped && (() => {
          const exercises = getSessionExercises(todayEntry);
          const preview = exercises.slice(0, 3);
          const more = exercises.length - 3;
          return (
            <div className={`${styles.card} ${styles.cardPurple}`}>
              <div className={styles.scheduledLabel}>SCHEDULED TODAY</div>
              <div className={styles.cardTitle}>{todayEntry.dayName}</div>
              <div className={styles.cardMeta}>{exercises.length} exercises · Week {todayEntry.week}</div>
              <ul className={styles.exerciseList}>
                {preview.map((ex, i) => (
                  <li key={i} className={styles.exerciseItem}>{ex.split(' — ')[0]}</li>
                ))}
                {more > 0 && <li className={styles.more}>+{more} more</li>}
              </ul>
              <div className={styles.actions}>
                <button
                  className={styles.btnPrimary}
                  onClick={() => startOverlay(todayEntry.dayName, todayEntry.dayName, activePlan?.isCustom ? exercises : undefined)}
                >
                  Start workout
                </button>
                <button className={styles.btnOutline} onClick={handleSkip}>Skip</button>
              </div>
            </div>
          );
        })()}

        {activePlan && todayEntry?.done && (
          <div className={`${styles.card} ${styles.cardGreen}`}>
            <div className={styles.scheduledLabel} style={{ color: 'var(--green-text)' }}>COMPLETED TODAY</div>
            <div className={styles.cardTitle}>{todayEntry.dayName}</div>
            {nextSession && (
              <div className={styles.cardMeta}>Next: <strong>{nextSession.dayName}</strong> on {formatDate(nextSession.date)}</div>
            )}
          </div>
        )}

        {activePlan && todayEntry?.skipped && (
          <div className={`${styles.card} ${styles.cardGrey}`}>
            <div className={styles.scheduledLabel} style={{ color: 'var(--text-secondary)' }}>SKIPPED</div>
            <div className={styles.cardTitle}>{todayEntry.dayName}</div>
            {nextSession && (
              <div className={styles.cardMeta}>Next: <strong>{nextSession.dayName}</strong> on {formatDate(nextSession.date)}</div>
            )}
          </div>
        )}

        {activePlan && !todayEntry && (
          <div className={`${styles.card} ${styles.cardGrey}`}>
            <div className={styles.cardTitle}>Rest day</div>
            {nextSession && (
              <div className={styles.cardMeta}>Next: <strong>{nextSession.dayName}</strong> on {formatDate(nextSession.date)}</div>
            )}
          </div>
        )}

        {/* ── Plan schedule strip ──────────────────────────────────────────── */}
        {activePlan && stripEntries.length > 0 && (
          <div className={styles.scheduleSection}>
            <div className={styles.scheduleSectionTitle}>PLAN SCHEDULE</div>
            <div className={styles.strip} ref={stripRef}>
              {stripEntries.map(entry => {
                const isToday = entry.date === today;
                const isPast = entry.date < today;
                const isSelected = previewEntry?.date === entry.date;
                const { dow, day } = formatShortDate(entry.date);

                let chipClass = styles.stripChip;
                if (isSelected) chipClass += ' ' + styles.stripChipSelected;
                else if (entry.done) chipClass += ' ' + styles.stripChipDone;
                else if (entry.skipped) chipClass += ' ' + styles.stripChipSkipped;
                else if (isToday) chipClass += ' ' + styles.stripChipToday;
                else if (isPast) chipClass += ' ' + styles.stripChipPast;
                else chipClass += ' ' + styles.stripChipFuture;

                return (
                  <button
                    key={entry.date}
                    className={chipClass}
                    data-today={isToday ? 'true' : 'false'}
                    onClick={() => handleStripTap(entry)}
                  >
                    <span className={styles.stripDow}>{dow}</span>
                    <span className={styles.stripDay}>{day}</span>
                    <span className={styles.stripName}>{entry.dayName.split(' ').slice(0, 2).join(' ')}</span>
                    {entry.done && <span className={styles.stripBadge}>✓</span>}
                    {entry.skipped && <span className={styles.stripBadge}>✗</span>}
                    {isToday && !entry.done && !entry.skipped && <span className={styles.stripDot} />}
                  </button>
                );
              })}
            </div>

            {/* Session preview card (shown when a strip item is tapped) */}
            {previewEntry && (() => {
              const exercises = getSessionExercises(previewEntry);
              const isToday = previewEntry.date === today;
              const isPast = previewEntry.date < today;
              const canStart = !previewEntry.done && !previewEntry.skipped;
              return (
                <div className={styles.previewCard}>
                  <div className={styles.previewTop}>
                    <div>
                      <div className={styles.previewName}>{previewEntry.dayName}</div>
                      <div className={styles.previewMeta}>
                        {formatDate(previewEntry.date)} · Week {previewEntry.week} · {exercises.length} exercises
                      </div>
                    </div>
                    <button className={styles.previewClose} onClick={() => setPreviewEntry(null)}>✕</button>
                  </div>
                  {previewEntry.done && <div className={styles.previewStatus + ' ' + styles.previewStatusDone}>Completed</div>}
                  {previewEntry.skipped && <div className={styles.previewStatus + ' ' + styles.previewStatusSkipped}>Skipped</div>}
                  <ul className={styles.previewExList}>
                    {exercises.map((ex, i) => (
                      <li key={i} className={styles.previewEx}>{ex.split(' — ')[0]}<span className={styles.previewPrescription}>{ex.split(' — ')[1] || ''}</span></li>
                    ))}
                  </ul>
                  {canStart && (
                    <button
                      className={styles.previewStartBtn}
                      onClick={() => startOverlay(previewEntry.dayName, previewEntry.dayName, activePlan?.isCustom ? exercises : undefined)}
                    >
                      {isToday ? 'Start workout' : 'Start early'}
                    </button>
                  )}
                  {isPast && !previewEntry.done && !previewEntry.skipped && (
                    <div className={styles.previewMissed}>This session was missed</div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── Quick start ──────────────────────────────────────────────────── */}
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
          exercises={overlay.exercises}
          onComplete={(exerciseStrings, dayName) => {
            if (activePlan?.isCustom && dayName) {
              updatePlanDayTemplate(dayName, exerciseStrings);
            }
          }}
          onClose={() => setOverlay(null)}
        />
      )}
    </>
  );
}
