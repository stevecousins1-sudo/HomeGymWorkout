import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatTimer, formatVolume } from '../../utils';
import styles from './WorkoutSummary.module.css';

export default function WorkoutSummary({
  workoutName, elapsed, exercises, units, prsByExercise, notes, onSave, onDiscard,
}) {
  const { saveTemplate } = useApp();
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName]     = useState(workoutName);
  const [templateSaved, setTemplateSaved]   = useState(false);

  const doneSetsTotal = exercises.reduce((a, ex) => a + ex.sets.filter(s => s.done).length, 0);

  const totalVolume = exercises.reduce((acc, ex) => {
    const unit = units[ex.name] || 'lb';
    return acc + ex.sets.filter(s => s.done).reduce((a, s) => {
      const w = parseFloat(s.weight) || 0;
      const r = parseFloat(s.reps) || 0;
      return a + (unit === 'kg' ? w * 2.2046 : w) * r;
    }, 0);
  }, 0);

  const prsHit = exercises.flatMap(ex => {
    const prev = prsByExercise[ex.name];
    const unit = units[ex.name] || 'lb';
    let isWeightPR = false, isVolumePR = false;
    for (const s of ex.sets.filter(s => s.done)) {
      const w   = parseFloat(s.weight) || 0;
      const r   = parseFloat(s.reps) || 0;
      const wLb = unit === 'kg' ? w * 2.2046 : w;
      if (wLb > 0 && r > 0) {
        if (wLb > (prev?.weight || 0)) isWeightPR = true;
        if (wLb * r > (prev?.volume || 0)) isVolumePR = true;
      }
    }
    if (!isWeightPR && !isVolumePR) return [];
    return [{ name: ex.name, label: isWeightPR ? 'Weight PR 🏆' : 'Volume PR 🏆' }];
  });

  function handleSaveTemplate() {
    if (!templateName.trim()) return;
    saveTemplate({
      name: templateName.trim(),
      exercises: exercises.map(ex => ({
        name: ex.name,
        prescription: ex.prescription || `${ex.sets.length}×10`,
      })),
    });
    setSavingTemplate(false);
    setTemplateSaved(true);
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <div className={styles.completedLabel}>Workout Complete</div>
        <div className={styles.workoutName}>{workoutName}</div>
      </div>

      <div className={styles.scrollArea}>
        <div className={styles.statRow}>
          <div className={styles.stat}>
            <div className={styles.statValue}>{formatTimer(elapsed)}</div>
            <div className={styles.statLabel}>Duration</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{formatVolume(totalVolume)}</div>
            <div className={styles.statLabel}>Volume</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statValue}>{doneSetsTotal}</div>
            <div className={styles.statLabel}>Sets done</div>
          </div>
        </div>

        {prsHit.length > 0 && (
          <div className={styles.prSection}>
            <div className={styles.sectionTitle}>PERSONAL RECORDS</div>
            {prsHit.map((pr, i) => (
              <div key={i} className={styles.prRow}>
                <span className={styles.prName}>{pr.name}</span>
                <span className={styles.prType}>{pr.label}</span>
              </div>
            ))}
          </div>
        )}

        <div className={styles.sectionTitle}>EXERCISES</div>
        <div className={styles.exList}>
          {exercises.map((ex, i) => {
            const unit     = units[ex.name] || 'lb';
            const doneSets = ex.sets.filter(s => s.done);
            const maxW     = doneSets.reduce((m, s) => Math.max(m, parseFloat(s.weight) || 0), 0);
            return (
              <div key={i} className={styles.exRow}>
                <div className={styles.exName}>{ex.name}</div>
                <div className={styles.exMeta}>
                  {doneSets.length} sets{maxW > 0 ? ` · ${maxW} ${unit} max` : ''}
                </div>
              </div>
            );
          })}
        </div>

        {notes?.trim() && (
          <>
            <div className={styles.sectionTitle}>NOTES</div>
            <div className={styles.notesBlock}>{notes}</div>
          </>
        )}

        <div className={styles.templateSection}>
          {templateSaved ? (
            <div className={styles.templateSaved}>Template saved!</div>
          ) : savingTemplate ? (
            <div className={styles.templateForm}>
              <input
                className={styles.templateInput}
                value={templateName}
                onChange={e => setTemplateName(e.target.value)}
                placeholder="Template name"
              />
              <button className={styles.templateConfirm} onClick={handleSaveTemplate}>Save</button>
              <button className={styles.templateCancel} onClick={() => setSavingTemplate(false)}>✕</button>
            </div>
          ) : (
            <button className={styles.saveTemplateBtn} onClick={() => setSavingTemplate(true)}>
              Save as template
            </button>
          )}
        </div>
      </div>

      <div className={styles.actionRow}>
        <button className={styles.discardBtn} onClick={onDiscard}>Discard</button>
        <button className={styles.saveBtn} onClick={onSave}>Save & Close</button>
      </div>
    </div>
  );
}
