import { useState, useMemo } from 'react';
import { MOVEMENTS } from '../../data/movements';
import { buildWorkoutFromMovement, workoutNameForMovement } from '../../data/workoutBuilder';
import WorkoutOverlay from '../../components/WorkoutOverlay/WorkoutOverlay';
import WorkoutBuilder from '../../components/WorkoutBuilder/WorkoutBuilder';
import { useApp } from '../../context/AppContext';
import styles from './Workout.module.css';

const CATEGORIES = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
const MUS_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbell', 'Cable machine', 'Machine',
  'Bodyweight', 'Kettlebell', 'Resistance band', 'EZ bar', 'Other',
];

const EMPTY_FORM = { name: '', category: 'Chest', equipment: 'Barbell', unit: 'lb' };

export default function Workout() {
  const { customMovements, addCustomMovement, deleteCustomMovement, setUnitPref } = useApp();
  const [filter, setFilter]   = useState('All');
  const [overlay, setOverlay] = useState(null);
  const [building, setBuilding] = useState(false);
  const [adding, setAdding]   = useState(false);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [errors, setErrors]   = useState({});

  const allMovements = useMemo(() => [...MOVEMENTS, ...customMovements], [customMovements]);

  const visible = filter === 'All'
    ? allMovements
    : allMovements.filter(m => m.category === filter);

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

  function openAdd() {
    setForm(EMPTY_FORM);
    setErrors({});
    setAdding(true);
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Name is required';
    else if (allMovements.some(m => m.name.toLowerCase() === form.name.trim().toLowerCase()))
      e.name = 'A movement with this name already exists';
    return e;
  }

  function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    addCustomMovement({ name: form.name.trim(), category: form.category, equipment: form.equipment });
    setUnitPref(form.name.trim(), form.unit);
    setAdding(false);
  }

  return (
    <>
      <div className={styles.screen}>
        <div className={styles.heading}>Workout</div>

        {/* Custom workout builder entry point */}
        <button className={styles.buildCustomBtn} onClick={() => setBuilding(true)}>
          <span className={styles.buildCustomIcon}>+</span>
          <div className={styles.buildCustomText}>
            <div className={styles.buildCustomTitle}>Build custom workout</div>
            <div className={styles.buildCustomSub}>Pick a muscle group, then choose your exercises</div>
          </div>
          <span className={styles.buildCustomArrow}>→</span>
        </button>

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
              <div className={styles.cardActions}>
                {m.custom && (
                  <button
                    className={styles.deleteMovementBtn}
                    onClick={() => deleteCustomMovement(m.name)}
                    aria-label="Delete movement"
                  >
                    ×
                  </button>
                )}
                <button className={styles.startBtn} onClick={() => startWorkout(m)}>
                  Start
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className={styles.addMovementBtn} onClick={openAdd}>
          + Add movement
        </button>
      </div>

      {/* Add movement modal */}
      {adding && (
        <>
          <div className={styles.modalBackdrop} onClick={() => setAdding(false)} />
          <div className={styles.modalSheet}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Add movement</span>
              <button className={styles.modalClose} onClick={() => setAdding(false)}>✕</button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Movement name</label>
                <input
                  className={`${styles.fieldInput}${errors.name ? ' ' + styles.fieldInputError : ''}`}
                  placeholder="e.g. Landmine squat"
                  value={form.name}
                  onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors({}); }}
                />
                {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Muscle group</label>
                <div className={styles.pillRow}>
                  {MUS_GROUPS.map(g => (
                    <button
                      key={g}
                      className={`${styles.optionPill}${form.category === g ? ' ' + styles.optionPillActive : ''}`}
                      onClick={() => setForm(f => ({ ...f, category: g }))}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Equipment</label>
                <div className={styles.pillRow}>
                  {EQUIPMENT_OPTIONS.map(eq => (
                    <button
                      key={eq}
                      className={`${styles.optionPill}${form.equipment === eq ? ' ' + styles.optionPillActive : ''}`}
                      onClick={() => setForm(f => ({ ...f, equipment: eq }))}
                    >
                      {eq}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Default weight unit</label>
                <div className={styles.unitToggle}>
                  <button
                    className={`${styles.unitBtn}${form.unit === 'lb' ? ' ' + styles.unitBtnActive : ''}`}
                    onClick={() => setForm(f => ({ ...f, unit: 'lb' }))}
                  >
                    lb
                  </button>
                  <button
                    className={`${styles.unitBtn}${form.unit === 'kg' ? ' ' + styles.unitBtnActive : ''}`}
                    onClick={() => setForm(f => ({ ...f, unit: 'kg' }))}
                  >
                    kg
                  </button>
                </div>
              </div>

              <button className={styles.saveBtn} onClick={handleSave}>
                Save movement
              </button>
            </div>
          </div>
        </>
      )}

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
