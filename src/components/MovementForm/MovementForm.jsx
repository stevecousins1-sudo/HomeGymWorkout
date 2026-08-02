import { useState } from 'react';
import { MUSCLE_GROUPS, EQUIPMENT_OPTIONS } from '../../data/movements';
import styles from './MovementForm.module.css';

/**
 * Define a new movement. Shared by the workout builder and the in-workout add
 * sheet so a movement created mid-session is described exactly as fully as one
 * created from the Movements screen — equipment in particular, which the plate
 * calculator and the no-machines substitution both read.
 *
 * `existing` is the full movement list (built-in + custom) and is used to
 * reject duplicate names: two movements sharing a name shadow each other in
 * every name-keyed lookup in the app.
 */
export default function MovementForm({
  initialCategory = 'Chest',
  existing = [],
  submitLabel = 'Create & add',
  onSave,
  onCancel,
}) {
  const [name, setName]           = useState('');
  const [category, setCategory]   = useState(initialCategory);
  const [equipment, setEquipment] = useState('Barbell');
  const [unit, setUnit]           = useState('lb');
  const [error, setError]         = useState('');

  const trimmed = name.trim();

  function handleSubmit() {
    if (!trimmed) {
      setError('Name is required');
      return;
    }
    if (existing.some(m => m.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A movement with this name already exists');
      return;
    }
    onSave({ name: trimmed, category, equipment }, unit);
  }

  return (
    <div className={styles.form}>
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Movement name</label>
        <input
          className={`${styles.fieldInput}${error ? ' ' + styles.fieldInputError : ''}`}
          placeholder="e.g. Landmine squat"
          value={name}
          onChange={e => { setName(e.target.value); setError(''); }}
          autoFocus
        />
        {error && <span className={styles.fieldError}>{error}</span>}
      </div>

      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Muscle group</label>
        <div className={styles.pillRow}>
          {MUSCLE_GROUPS.map(g => (
            <button
              key={g}
              className={`${styles.optionPill}${category === g ? ' ' + styles.optionPillActive : ''}`}
              onClick={() => setCategory(g)}
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
              className={`${styles.optionPill}${equipment === eq ? ' ' + styles.optionPillActive : ''}`}
              onClick={() => setEquipment(eq)}
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
            className={`${styles.unitBtn}${unit === 'lb' ? ' ' + styles.unitBtnActive : ''}`}
            onClick={() => setUnit('lb')}
          >
            lb
          </button>
          <button
            className={`${styles.unitBtn}${unit === 'kg' ? ' ' + styles.unitBtnActive : ''}`}
            onClick={() => setUnit('kg')}
          >
            kg
          </button>
        </div>
      </div>

      <div className={styles.actions}>
        {onCancel && (
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        )}
        <button className={styles.saveBtn} onClick={handleSubmit} disabled={!trimmed}>
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
