import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatTimer, formatVolume } from '../../utils';
import { e1rm, toLb, fromLb } from '../../lib/strength';
import styles from './WorkoutSummary.module.css';

function buildShareText(workoutName, elapsed, exercises, units, totalVolume, prsHit) {
  const lines = [
    `💪 ${workoutName}`,
    `⏱ ${formatTimer(elapsed)}  |  📦 ${formatVolume(totalVolume)} lb vol`,
    '',
  ];
  exercises.forEach(ex => {
    const unit = units[ex.name] || 'lb';
    const doneSets = ex.sets.filter(s => s.done);
    const maxW = doneSets.reduce((m, s) => Math.max(m, parseFloat(s.weight) || 0), 0);
    lines.push(`• ${ex.name} — ${doneSets.length} sets${maxW > 0 ? ` @ ${maxW} ${unit}` : ''}`);
  });
  if (prsHit.length) {
    lines.push('', '🏆 PRs: ' + prsHit.map(p => p.name).join(', '));
  }
  lines.push('', 'Logged with HomeGym Workout');
  return lines.join('\n');
}

export default function WorkoutSummary({
  workoutName, elapsed, exercises, units, prsByExercise, notes, onSave, onDiscard,
}) {
  const { saveTemplate } = useApp();
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName]     = useState(workoutName);
  const [templateSaved, setTemplateSaved]   = useState(false);
  const [shareStatus, setShareStatus]       = useState(null); // null | 'copied'

  const doneSetsTotal = exercises.reduce((a, ex) => a + ex.sets.filter(s => s.done).length, 0);

  const totalVolume = exercises.reduce((acc, ex) => {
    const unit = units[ex.name] || 'lb';
    return acc + ex.sets.filter(s => s.done).reduce((a, s) => {
      const w = parseFloat(s.weight) || 0;
      const r = parseFloat(s.reps) || 0;
      return a + (unit === 'kg' ? w * 2.2046 : w) * r;
    }, 0);
  }, 0);

  // A PR is a new best estimated 1RM (or simply the heaviest weight ever
  // handled) — not a bigger weight × reps number, which just rewards
  // switching to lighter, higher-rep sets.
  const prsHit = exercises.flatMap(ex => {
    const prev = prsByExercise[ex.name];
    const unit = units[ex.name] || 'lb';
    let isWeightPR = false, bestE1rm = 0;
    for (const s of ex.sets.filter(s => s.done)) {
      const wLb = toLb(s.weight, unit);
      const r   = parseFloat(s.reps) || 0;
      if (wLb <= 0 || r <= 0) continue;
      if (wLb > (prev?.weight || 0)) isWeightPR = true;
      bestE1rm = Math.max(bestE1rm, e1rm(wLb, r));
    }
    const isStrengthPR = bestE1rm > (prev?.e1rm || 0);
    if (!isWeightPR && !isStrengthPR) return [];
    return [{
      name: ex.name,
      label: isWeightPR ? 'Heaviest ever 🏆' : 'Strength PR 🏆',
      detail: bestE1rm > 0
        ? `est. 1RM ${Math.round(fromLb(bestE1rm, unit))} ${unit}`
        : null,
    }];
  });

  async function handleShare() {
    const text = buildShareText(workoutName, elapsed, exercises, units, totalVolume, prsHit);
    if (navigator.share) {
      try { await navigator.share({ title: workoutName, text }); } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      setShareStatus('copied');
      setTimeout(() => setShareStatus(null), 2500);
    }
  }

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
        <button className={styles.shareBtn} onClick={handleShare}>
          {shareStatus === 'copied' ? '✓ Copied!' : '↑ Share'}
        </button>
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
                <span className={styles.prName}>
                  {pr.name}
                  {pr.detail && <span className={styles.prDetail}> · {pr.detail}</span>}
                </span>
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
