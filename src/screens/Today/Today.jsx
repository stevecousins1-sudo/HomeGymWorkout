import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import WorkoutOverlay from '../../components/WorkoutOverlay/WorkoutOverlay';
import MachinePrompt from '../../components/MachinePrompt/MachinePrompt';
import { getExercisesForDay } from '../../data/exercises';
import { MOVEMENTS } from '../../data/movements';
import { formatDate, getGreeting, todayISO } from '../../utils';
import { loadDraft, clearDraft } from '../../lib/draft';
import styles from './Today.module.css';

const MUSCLE_TARGETS = { Chest: 10, Back: 10, Legs: 10, Shoulders: 8, Arms: 6, Core: 6 };

function getWeekDates() {
  const today = new Date();
  const dow = today.getDay();
  const mon = new Date(today);
  mon.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

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
  const { activePlan, markScheduleEntry, updatePlanDayTemplate, history, theme, setTheme, user, logout, hasMachines, setHasMachines, customMovements } = useApp();
  const [overlay, setOverlay] = useState(null);
  const [previewEntry, setPreviewEntry] = useState(null);
  const [pendingWorkout, setPendingWorkout] = useState(null);
  // A session interrupted by a reload, a crash or an OS eviction. Its age is
  // stamped once on load rather than recomputed on every render.
  const [resumable, setResumable] = useState(() => {
    const d = loadDraft();
    if (!d) return null;
    return { ...d, ageMin: Math.round((Date.now() - (d.startedAt || Date.now())) / 60000) };
  });
  const stripRef = useRef(null);
  const today = todayISO();

  const todayEntry = activePlan?.schedule.find(e => e.date === today);
  const doneCount = activePlan?.schedule.filter(e => e.done).length ?? 0;
  const totalCount = activePlan?.schedule.length ?? 0;
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  // Custom movements count towards the heatmap too — they're often exactly the
  // ones a user does most.
  const movCatMap = useMemo(
    () => new Map([...MOVEMENTS, ...customMovements].map(m => [m.name.toLowerCase(), m.category])),
    [customMovements]
  );

  // Weekly volume per muscle group
  const weeklyVolume = useMemo(() => {
    const weekDates = new Set(getWeekDates());
    const counts = {};
    for (const entry of history) {
      if (!weekDates.has(entry.date)) continue;
      for (const ex of (entry.exercises || [])) {
        const cat = movCatMap.get(ex.name.toLowerCase());
        if (!cat) continue;
        const done = (ex.sets || []).filter(s => s.done).length;
        counts[cat] = (counts[cat] || 0) + done;
      }
    }
    return counts;
  }, [history, movCatMap]);

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

  function resumeWorkout() {
    setOverlay({
      name: resumable.workoutName,
      dayName: resumable.dayName,
      exercises: resumable.exercises.map(ex => `${ex.name} — ${ex.prescription}`),
      isPlanWorkout: resumable.isPlanWorkout,
      draft: resumable,
    });
    setResumable(null);
  }

  function discardResumable() {
    clearDraft();
    setResumable(null);
  }

  function startOverlay(name, dayName, exercises, isPlanWorkout = false) {
    setPreviewEntry(null);
    if (hasMachines === null) {
      setPendingWorkout({ name, dayName, exercises, isPlanWorkout });
    } else {
      setOverlay({ name, dayName, exercises, isPlanWorkout });
    }
  }

  function handleMachineAnswer(answer) {
    setHasMachines(answer);
    if (pendingWorkout) {
      setOverlay(pendingWorkout);
      setPendingWorkout(null);
    }
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
          <div className={styles.headerActions}>
            <button
              className={styles.themeBtn}
              onClick={() => setTheme(theme === 'dark' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'auto' : 'light') : theme === 'light' ? 'auto' : 'dark')}
              title={`Theme: ${theme}`}
            >
              {theme === 'dark' ? '☀️' : theme === 'light' ? '🌙' : '🌓'}
            </button>
            <button className={styles.signOutBtn} onClick={logout} title={user?.email}>
              Sign out
            </button>
          </div>
        </div>

        {/* ── Interrupted session ─────────────────────────────────────────── */}
        {resumable && !overlay && (() => {
          const setsDone = resumable.exercises.reduce(
            (a, ex) => a + (ex.sets || []).filter(s => s.done).length, 0
          );
          const mins = resumable.ageMin;
          return (
            <div className={`${styles.card} ${styles.cardPurple}`}>
              <div className={styles.scheduledLabel}>WORKOUT IN PROGRESS</div>
              <div className={styles.cardTitle}>{resumable.workoutName}</div>
              <div className={styles.cardMeta}>
                {setsDone} set{setsDone === 1 ? '' : 's'} logged · started {mins < 1 ? 'just now' : `${mins} min ago`}
              </div>
              <div className={styles.actions}>
                <button className={styles.btnPrimary} onClick={resumeWorkout}>Resume</button>
                <button className={styles.btnOutline} onClick={discardResumable}>Discard</button>
              </div>
            </div>
          );
        })()}

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
                  onClick={() => startOverlay(todayEntry.dayName, todayEntry.dayName, activePlan?.isCustom ? exercises : undefined, true)}
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
                      onClick={() => startOverlay(previewEntry.dayName, previewEntry.dayName, activePlan?.isCustom ? exercises : undefined, true)}
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

        {/* ── Weekly volume heatmap ────────────────────────────────────────── */}
        <div className={styles.sectionTitle}>THIS WEEK'S VOLUME</div>
        <div className={styles.heatmapGrid}>
          {Object.entries(MUSCLE_TARGETS).map(([muscle, target]) => {
            const sets = weeklyVolume[muscle] || 0;
            const pct = Math.min(1, sets / target);
            const color = sets === 0 ? 'var(--red)' : sets >= target ? 'var(--green)' : 'var(--amber)';
            return (
              <div key={muscle} className={styles.heatmapCell}>
                <div className={styles.heatmapBar}>
                  <div className={styles.heatmapFill} style={{ height: `${pct * 100}%`, background: color }} />
                </div>
                <div className={styles.heatmapSets} style={{ color }}>{sets}</div>
                <div className={styles.heatmapLabel}>{muscle}</div>
              </div>
            );
          })}
        </div>

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

      {pendingWorkout && <MachinePrompt onAnswer={handleMachineAnswer} />}

      {overlay && (
        <WorkoutOverlay
          workoutName={overlay.name}
          dayName={overlay.dayName}
          exercises={overlay.exercises}
          isPlanWorkout={!!overlay.isPlanWorkout}
          hasMachines={hasMachines !== false}
          draft={overlay.draft}
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
