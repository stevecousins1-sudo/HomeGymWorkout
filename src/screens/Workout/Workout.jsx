import { useState, useMemo } from 'react';
import { MOVEMENTS } from '../../data/movements';
import { buildWorkoutFromMovement, workoutNameForMovement } from '../../data/workoutBuilder';
import WorkoutOverlay from '../../components/WorkoutOverlay/WorkoutOverlay';
import WorkoutBuilder from '../../components/WorkoutBuilder/WorkoutBuilder';
import { useApp } from '../../context/AppContext';
import styles from './Workout.module.css';

const CATEGORIES = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

export default function Workout() {
  const { customMovements } = useApp();
  const [filter, setFilter]   = useState('All');
  const [search, setSearch]   = useState('');
  const [overlay, setOverlay] = useState(null);
  const [building, setBuilding] = useState(false);

  const allMovements = useMemo(() => [...MOVEMENTS, ...customMovements], [customMovements]);

  const visible = useMemo(() => {
    let list = filter === 'All' ? allMovements : allMovements.filter(m => m.category === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q) || m.equipment.toLowerCase().includes(q));
    }
    return list;
  }, [allMovements, filter, search]);

  function startWorkout(movement) {
    setOverlay({
      name:      workoutNameForMovement(movement),
      dayName:   workoutNameForMovement(movement),
      exercises: buildWorkoutFromMovement(movement),
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
