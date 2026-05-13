import { useState, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { MOVEMENTS } from '../../data/movements';
import styles from './Movements.module.css';

const CATEGORIES = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms'];

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
  const { unitPrefs, globalUnit, setUnitPref, setGlobalUnit } = useApp();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const handleToggle = useCallback((name, unit) => {
    setUnitPref(name, unit);
  }, [setUnitPref]);

  const visible = MOVEMENTS.filter(m => {
    const matchCat = filter === 'All' || m.category === filter;
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
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

      <input
        className={styles.search}
        type="search"
        placeholder="Search movements…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

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
                <div className={styles.name}>{m.name}</div>
                <div className={styles.meta}>{m.category} · {m.equipment}</div>
              </div>
              <UnitToggle name={m.name} unit={unit} onToggle={handleToggle} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
