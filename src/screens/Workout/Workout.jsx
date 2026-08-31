import { useState, useMemo } from 'react';
import { MOVEMENTS, searchMovements } from '../../data/movements';
import { buildWorkoutFromMovement, workoutNameForMovement } from '../../data/workoutBuilder';
import WorkoutOverlay from '../../components/WorkoutOverlay/WorkoutOverlay';
import WorkoutBuilder from '../../components/WorkoutBuilder/WorkoutBuilder';
import { useApp } from '../../context/AppContext';
import styles from './Workout.module.css';

const CATEGORIES = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

export default function Workout() {
  const { customMovements, templates, deleteTemplate } = useApp();
  const [filter, setFilter]         = useState('All');
  const [search, setSearch]         = useState('');
  const [overlay, setOverlay]       = useState(null);
  const [building, setBuilding]     = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Your own movements first — the built-in library is long enough to bury them.
  const allMovements = useMemo(() => [...customMovements, ...MOVEMENTS], [customMovements]);

  const visible = useMemo(() => {
    const list = filter === 'All' ? allMovements : allMovements.filter(m => m.category === filter);
    return searchMovements(list, search);
  }, [allMovements, filter, search]);

  function startWorkout(movement) {
    setOverlay({
      name:      workoutNameForMovement(movement),
      dayName:   workoutNameForMovement(movement),
      exercises: buildWorkoutFromMovement(movement, customMovements),
    });
  }

  function startFromTemplate(template) {
    setOverlay({
      name:      template.name,
      dayName:   template.name,
      exercises: template.exercises.map(e => `${e.name} — ${e.prescription}`),
    });
  }

  function handleBuilderStart({ name, dayName, exercises }) {
    setBuilding(false);
    setOverlay({ name, dayName, exercises });
  }

  return (
    <>
      <div className={styles.screen}>
        <div className={styles.heading}>Workout</div>

        <button className={styles.buildCustomBtn} onClick={() => setBuilding(true)}>
          <span className={styles.buildCustomIcon}>+</span>
          <div className={styles.buildCustomText}>
            <div className={styles.buildCustomTitle}>Build custom workout</div>
            <div className={styles.buildCustomSub}>Pick a muscle group, then choose your exercises</div>
          </div>
          <span className={styles.buildCustomArrow}>→</span>
        </button>

        {/* Templates section */}
        {templates.length > 0 && (
          <div className={styles.templatesSection}>
            <button
              className={styles.templatesSectionHeader}
              onClick={() => setTemplatesOpen(o => !o)}
            >
              <span>My Templates ({templates.length})</span>
              <span className={styles.templatesChevron}>{templatesOpen ? '▲' : '▼'}</span>
            </button>
            {templatesOpen && (
              <div className={styles.templatesList}>
                {templates.map(t => (
                  <div key={t.id} className={styles.templateCard}>
                    <div className={styles.templateInfo}>
                      <div className={styles.templateName}>{t.name}</div>
                      <div className={styles.templateMeta}>{t.exercises.length} exercises</div>
                    </div>
                    <div className={styles.templateActions}>
                      <button
                        className={styles.templateDeleteBtn}
                        onClick={() => deleteTemplate(t.id)}
                      >✕</button>
                      <button
                        className={styles.templateStartBtn}
                        onClick={() => startFromTemplate(t)}
                      >Start</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Search movements…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filters}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`${styles.pill}${filter === cat ? ' ' + styles.active : ''}`}
              onClick={() => setFilter(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className={styles.list}>
          {visible.map(m => (
            <div key={m.name} className={styles.card}>
              <div className={styles.info}>
                <div className={styles.name}>
                  {m.name}
                  {m.custom && <span className={styles.customBadge}>custom</span>}
                </div>
                <div className={styles.meta}>{m.category} · {m.equipment}</div>
              </div>
              <button className={styles.startBtn} onClick={() => startWorkout(m)}>
                Start
              </button>
            </div>
          ))}
        </div>
      </div>

      {building && (
        <WorkoutBuilder
          onStart={handleBuilderStart}
          onClose={() => setBuilding(false)}
        />
      )}

      {overlay && (
        <WorkoutOverlay
          workoutName={overlay.name}
          dayName={overlay.dayName}
          exercises={overlay.exercises}
          onClose={() => setOverlay(null)}
        />
      )}
    </>
  );
}
