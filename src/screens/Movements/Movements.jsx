import { useState, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MOVEMENTS } from '../../data/movements';
import styles from './Movements.module.css';

const CATEGORIES = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
const MUS_GROUPS = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];
const EQUIPMENT_OPTIONS = [
  'Barbell', 'Dumbbell', 'Cable machine', 'Machine',
  'Bodyweight', 'Kettlebell', 'Resistance band', 'EZ bar', 'Other',
];
const EMPTY_FORM = { name: '', category: 'Chest', equipment: 'Barbell', unit: 'lb' };

function UnitToggle({ name, unit, onToggle }) {
  return (
    <div className={styles.unitToggle}>
      <button
        className={`${styles.unitBtn}${unit === 'lb' ? ' ' + styles.active : ''}`}
        onClick={() => onToggle(name, 'lb')}
      >
        lb
      </button>
      <button
        className={`${styles.unitBtn}${unit === 'kg' ? ' ' + styles.active : ''}`}
        onClick={() => onToggle(name, 'kg')}
      >
        kg
      </button>
    </div>
  );
}

export default function Movements() {
  const { unitPrefs, globalUnit, setUnitPref, setGlobalUnit, customMovements, addCustomMovement, deleteCustomMovement } = useApp();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const [form, setForm]     = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const handleToggle = useCallback((name, unit) => {
    setUnitPref(name, unit);
  }, [setUnitPref]);

  // Your own movements first — the built-in library is long enough to bury them.
  const allMovements = useMemo(() => [...customMovements, ...MOVEMENTS], [customMovements]);

  const visible = useMemo(() => {
    let list = filter === 'All' ? allMovements : allMovements.filter(m => m.category === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(m => m.name.toLowerCase().includes(q) || m.equipment.toLowerCase().includes(q));
    }
    return list;
  }, [allMovements, filter, search]);

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
        <div className={styles.topRow}>
          <div className={styles.heading}>Movements</div>
          <div className={styles.globalToggle}>
            <button
              className={`${styles.globalBtn}${globalUnit === 'lb' ? ' ' + styles.active : ''}`}
              onClick={() => setGlobalUnit('lb')}
            >
              lb
            </button>
            <button
              className={`${styles.globalBtn}${globalUnit === 'kg' ? ' ' + styles.active : ''}`}
              onClick={() => setGlobalUnit('kg')}
            >
              kg
            </button>
          </div>
        </div>

        <div className={styles.searchRow}>
          <input
            className={styles.search}
            type="search"
            placeholder="Search movements…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button className={styles.addBtn} onClick={openAdd}>+ Add</button>
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
          {visible.map(m => {
            const unit = unitPrefs[m.name] ?? globalUnit;
            return (
              <div key={m.name} className={styles.card}>
                <div className={styles.info}>
                  <div className={styles.name}>
                    {m.name}
                    {m.custom && <span className={styles.customBadge}>custom</span>}
                  </div>
                  <div className={styles.meta}>{m.category} · {m.equipment}</div>
                </div>
                <div className={styles.cardRight}>
                  <UnitToggle name={m.name} unit={unit} onToggle={handleToggle} />
                  {m.custom && (
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteCustomMovement(m.name)}
                      aria-label="Delete movement"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

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
                <div className={styles.unitToggleModal}>
                  <button
                    className={`${styles.unitBtnModal}${form.unit === 'lb' ? ' ' + styles.unitBtnModalActive : ''}`}
                    onClick={() => setForm(f => ({ ...f, unit: 'lb' }))}
                  >
                    lb
                  </button>
                  <button
                    className={`${styles.unitBtnModal}${form.unit === 'kg' ? ' ' + styles.unitBtnModalActive : ''}`}
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
    </>
  );
}
