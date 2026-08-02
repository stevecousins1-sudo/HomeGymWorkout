import { useState, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { MOVEMENTS } from '../../data/movements';
import MovementForm from '../../components/MovementForm/MovementForm';
import styles from './Movements.module.css';

const CATEGORIES = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

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

  function handleSave(movement, unit) {
    addCustomMovement(movement);
    setUnitPref(movement.name, unit);
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
          <button className={styles.addBtn} onClick={() => setAdding(true)}>+ Add</button>
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

            <MovementForm
              existing={allMovements}
              submitLabel="Save movement"
              onSave={handleSave}
            />
          </div>
        </>
      )}
    </>
  );
}
