import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MOVEMENTS } from '../../data/movements';
import styles from './WorkoutBuilder.module.css';

const CATEGORIES = [
  { name: 'Chest',     muscles: 'Pectorals · Front deltoid · Tricep' },
  { name: 'Back',      muscles: 'Lats · Rhomboids · Rear deltoid' },
  { name: 'Legs',      muscles: 'Quads · Hamstrings · Glutes · Calves' },
  { name: 'Shoulders', muscles: 'Deltoids · Traps' },
  { name: 'Arms',      muscles: 'Biceps · Triceps · Forearms' },
  { name: 'Core',      muscles: 'Abs · Obliques · Lower back' },
];

// 3 sets × 1 min work + 2 × 1.5 min rest + 2 min setup between exercises
function estimateMinutes(count) {
  if (count === 0) return 0;
  const perExercise = 3 * 1 + 2 * 1.5; // 6 min
  const setupTime   = Math.max(0, count - 1) * 2;
  return Math.round(count * perExercise + setupTime);
}

export default function WorkoutBuilder({ onStart, onClose }) {
  const { customMovements } = useApp();
  const [category, setCategory] = useState(null);
  const [selected, setSelected] = useState([]); // array of movement objects

  function toggleExercise(movement) {
    setSelected(prev => {
      const exists = prev.some(m => m.name === movement.name);
      return exists
        ? prev.filter(m => m.name !== movement.name)
        : [...prev, movement];
    });
  }

  function handleStart() {
    if (selected.length === 0) return;
    onStart({
      name: `${category} Day`,
      dayName: `${category} Day`,
      exercises: selected.map(m => `${m.name} — 3×10`),
    });
  }

  const est = estimateMinutes(selected.length);

  // Movements the user added themselves belong here just as much as the
  // built-in library — this list is "everything I can train", not "everything
  // that shipped with the app".
  const movList = useMemo(
    () => category
      ? [...MOVEMENTS, ...customMovements].filter(m => m.category === category)
      : [],
    [category, customMovements]
  );

  // ── Step 1: category selection ──────────────────────────────
  if (!category) {
    return (
      <div className={styles.overlay}>
        <div className={styles.header}>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
          <span className={styles.headerTitle}>Custom Workout</span>
          <div className={styles.spacer} />
        </div>
        <div className={styles.scrollArea}>
          <div className={styles.stepHint}>Choose a muscle group</div>
          <div className={styles.categoryGrid}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.name}
                className={styles.catCard}
                onClick={() => { setCategory(cat.name); setSelected([]); }}
              >
                <div className={styles.catName}>{cat.name}</div>
                <div className={styles.catMuscles}>{cat.muscles}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: exercise multi-select ───────────────────────────
  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => { setCategory(null); setSelected([]); }}>
          ← Back
        </button>
        <span className={styles.headerTitle}>{category}</span>
        <button
          className={styles.startHeaderBtn}
          disabled={selected.length === 0}
          onClick={handleStart}
        >
          Start
        </button>
      </div>

      <div className={styles.estimateBar}>
        {selected.length === 0
          ? <span className={styles.estimateHint}>Tap exercises to add them to your workout</span>
          : (
            <>
              <span className={styles.estimatePill}>{selected.length} exercise{selected.length !== 1 ? 's' : ''}</span>
              <span className={styles.estimateDot}>·</span>
              <span className={styles.estimatePill}>~{est} min incl. rest</span>
            </>
          )
        }
      </div>

      <div className={styles.scrollArea}>
        {movList.map(m => {
          const isSelected = selected.some(s => s.name === m.name);
          return (
            <button
              key={m.name}
              className={`${styles.exRow}${isSelected ? ' ' + styles.exRowSelected : ''}`}
              onClick={() => toggleExercise(m)}
            >
              <div className={styles.exInfo}>
                <div className={styles.exName}>{m.name}</div>
                <div className={styles.exMeta}>{m.equipment}</div>
              </div>
              <div className={`${styles.checkBox}${isSelected ? ' ' + styles.checkBoxActive : ''}`}>
                {isSelected && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"
                    strokeLinecap="round" strokeLinejoin="round" className={styles.checkIcon}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </div>
            </button>
          );
        })}
        <div className={styles.listPad} />
      </div>

      {selected.length > 0 && (
        <div className={styles.bottomBar}>
          <button className={styles.startFullBtn} onClick={handleStart}>
            Start Workout · {selected.length} exercise{selected.length !== 1 ? 's' : ''} · ~{est} min
          </button>
        </div>
      )}
    </div>
  );
}
