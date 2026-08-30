import { useState, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { getExercisesForDay } from '../../data/exercises';
import { MOVEMENTS } from '../../data/movements';
import WorkoutOverlay from '../../components/WorkoutOverlay/WorkoutOverlay';
import ProgressChart from '../../components/ProgressChart/ProgressChart';
import BodyWeightChart from '../../components/BodyWeightChart/BodyWeightChart';
import { formatDate, formatDuration, formatVolume, todayISO } from '../../utils';
import { buildRecords, fromLb } from '../../lib/strength';
import styles from './History.module.css';

const CAT_ORDER = ['Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

function parseExercise(str) {
  const parts = str.split(' — ');
  return { name: parts[0], prescription: parts[1] || '' };
}

function parseSetCount(prescription) {
  const match = prescription.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 3;
}

function entryToExerciseStrings(entry) {
  if (entry.exercises?.length > 0) {
    return entry.exercises.map(ex => `${ex.name} — ${ex.sets.length}×`);
  }
  return null;
}

export default function History() {
  const { history, importHistory, bodyWeightLog, addBodyWeightEntry, globalUnit, customMovements,
          updateHistoryEntry, deleteHistoryEntry } = useApp();
  const [activeTab, setActiveTab]       = useState('history');
  const [detail, setDetail]             = useState(null);
  // A working copy of the entry being corrected; null when not editing.
  const [editing, setEditing]           = useState(null);
  const [overlay, setOverlay]           = useState(null);
  const [importStatus, setImportStatus] = useState(null);
  const [exSearch, setExSearch]         = useState('');
  const [selectedEx, setSelectedEx]     = useState(null);
  const [exDropOpen, setExDropOpen]     = useState(false);
  const [bwInput, setBwInput]           = useState('');
  const [bwDate, setBwDate]             = useState(todayISO());
  const fileInputRef = useRef(null);

  // All unique exercise names that appear in history
  const allExerciseNames = useMemo(() => {
    const set = new Set();
    for (const h of history) {
      for (const ex of (h.exercises || [])) set.add(ex.name);
    }
    return [...set].sort();
  }, [history]);

  // Custom movements are real movements — group their records by the category
  // the user gave them rather than dumping them all in "Other".
  const movCatMap = useMemo(
    () => new Map([...MOVEMENTS, ...customMovements].map(m => [m.name.toLowerCase(), m.category])),
    [customMovements]
  );

  // All-time records grouped by muscle category, ranked by estimated 1RM
  const groupedRecords = useMemo(() => {
    const recs = buildRecords(history);
    const grouped = {};
    for (const [name, rec] of Object.entries(recs)) {
      const cat = movCatMap.get(name.toLowerCase()) || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ name, ...rec });
    }
    for (const cat of Object.keys(grouped)) {
      grouped[cat].sort((a, b) => b.e1rm - a.e1rm);
    }
    return grouped;
  }, [history, movCatMap]);

  const filteredExNames = useMemo(() => {
    const q = exSearch.trim().toLowerCase();
    return q ? allExerciseNames.filter(n => n.toLowerCase().includes(q)) : allExerciseNames;
  }, [allExerciseNames, exSearch]);

  function handleExport() {
    const data = JSON.stringify(history, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const entries = Array.isArray(parsed) ? parsed : [];
      if (entries.length === 0) { setImportStatus({ error: 'No entries found in file' }); return; }
      const existing = new Set(history.map(h => `${h.date}|${h.name}`));
      const newEntries = entries.filter(e => !existing.has(`${e.date}|${e.name}`));
      if (newEntries.length === 0) { setImportStatus({ count: 0 }); return; }
      const count = await importHistory(newEntries);
      setImportStatus({ count });
    } catch {
      setImportStatus({ error: 'Invalid backup file' });
    }
    setTimeout(() => setImportStatus(null), 4000);
  }

  const totalWorkouts = history.length;
  const totalVolume   = history.reduce((a, h) => a + h.volume, 0);
  const avgSets       = history.length > 0
    ? Math.round(history.reduce((a, h) => a + h.sets, 0) / history.length)
    : 0;

  // Volume and set count are derived, so they have to be recomputed from the
  // corrected sets — otherwise the stats keep reporting the typo.
  function recalc(entry) {
    const done = ex => (ex.sets || []).filter(s => s.done);
    const sets = (entry.exercises || []).reduce((a, ex) => a + done(ex).length, 0);
    const volume = (entry.exercises || []).reduce((a, ex) => {
      const unit = ex.unit || 'lb';
      return a + done(ex).reduce((x, s) => {
        const w = parseFloat(s.weight) || 0;
        const r = parseFloat(s.reps) || 0;
        return x + (unit === 'kg' ? w * 2.2046 : w) * r;
      }, 0);
    }, 0);
    return { ...entry, sets, volume: Math.round(volume) };
  }

  function startEdit() {
    setEditing(JSON.parse(JSON.stringify(detail)));
  }

  function editSet(exIdx, setIdx, field, value) {
    setEditing(prev => recalc({
      ...prev,
      exercises: prev.exercises.map((ex, i) => i !== exIdx ? ex : {
        ...ex,
        sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: value }),
      }),
    }));
  }

  function saveEdit() {
    const next = recalc(editing);
    updateHistoryEntry(next.id, next);
    setDetail(next);
    setEditing(null);
  }

  function removeEntry() {
    if (!window.confirm('Delete this workout permanently?')) return;
    deleteHistoryEntry(detail.id);
    setEditing(null);
    setDetail(null);
  }

  function startRedo(entry) {
    const exercises = entryToExerciseStrings(entry);
    setOverlay({ name: entry.name, dayName: entry.dayName || entry.name, exercises });
  }

  // ── Detail view ──────────────────────────────────────────────────────────────
  if (detail) {
    const hasExerciseData = detail.exercises?.length > 0;
    const planExercises   = hasExerciseData
      ? null
      : getExercisesForDay(detail.dayName || detail.name);
    // Editing an entry the server hasn't acknowledged would send a PUT for an
    // id it doesn't know yet, which the outbox would drop as a permanent 4xx.
    const awaitingSync = !!detail.pending;
    const shown = editing ?? detail;

    return (
      <>
        <div className={styles.screen}>
          <button className={styles.backBtn} onClick={() => { setEditing(null); setDetail(null); }}>← Back</button>
          <div className={styles.detailName}>{detail.name}</div>
          <div className={styles.detailDate}>{formatDate(detail.date)}</div>

          <div className={styles.chips}>
            <div className={styles.chip}>
              <div className={styles.chipValue}>{formatDuration(detail.duration)}</div>
              <div className={styles.chipLabel}>Duration</div>
            </div>
            <div className={styles.chip}>
              <div className={styles.chipValue}>{formatVolume(shown.volume)}</div>
              <div className={styles.chipLabel}>Volume</div>
            </div>
            <div className={styles.chip}>
              <div className={styles.chipValue}>{shown.sets}</div>
              <div className={styles.chipLabel}>Sets done</div>
            </div>
          </div>

          {hasExerciseData && (
            <div className={styles.editRow}>
              {awaitingSync ? (
                <span className={styles.editHint}>Still syncing — editable once saved to the server.</span>
              ) : editing ? (
                <>
                  <button className={styles.editCancelBtn} onClick={() => setEditing(null)}>Cancel</button>
                  <button className={styles.editSaveBtn} onClick={saveEdit}>Save changes</button>
                </>
              ) : (
                <>
                  <button className={styles.editBtn} onClick={startEdit}>✎ Edit sets</button>
                  <button className={styles.deleteEntryBtn} onClick={removeEntry}>Delete</button>
                </>
              )}
            </div>
          )}

          {detail.notes?.trim() && (
            <div className={styles.detailNotes}>
              <div className={styles.detailNotesLabel}>NOTES</div>
              <div className={styles.detailNotesText}>{detail.notes}</div>
            </div>
          )}

          <div className={styles.sectionTitle}>MOVEMENTS</div>

          {hasExerciseData
            ? shown.exercises.map((ex, i) => {
                const doneSets = ex.sets.filter(s => s.done);
                return (
                  <div key={i} className={styles.exCard}>
                    <div className={styles.exHeader}>
                      <div className={styles.exName}>{ex.name}</div>
                      <span className={styles.setBadge}>{doneSets.length}/{ex.sets.length} sets</span>
                    </div>
                    {ex.sets.map((s, si) => editing ? (
                      <div key={si} className={`${styles.setRowDetail}${s.done ? ' ' + styles.setDone : ''}`}>
                        <span className={styles.setNumDetail}>Set {si + 1}</span>
                        <input
                          className={styles.editInput}
                          type="number" inputMode="decimal"
                          value={s.weight ?? ''}
                          onChange={e => editSet(i, si, 'weight', e.target.value)}
                        />
                        <span className={styles.editUnit}>{ex.unit}</span>
                        <span className={styles.editTimes}>×</span>
                        <input
                          className={styles.editInput}
                          type="number" inputMode="numeric"
                          value={s.reps ?? ''}
                          onChange={e => editSet(i, si, 'reps', e.target.value)}
                        />
                        <button
                          className={`${styles.checkCircle}${s.done ? ' ' + styles.checkDone : ''}`}
                          aria-label={s.done ? 'Mark set not done' : 'Mark set done'}
                          onClick={() => editSet(i, si, 'done', !s.done)}
                        />
                      </div>
                    ) : (
                      <div key={si} className={`${styles.setRowDetail}${s.done ? ' ' + styles.setDone : ''}`}>
                        <span className={styles.setNumDetail}>Set {si + 1}</span>
                        <span className={styles.setData}>
                          {s.weight || '—'} {ex.unit} × {s.reps || '—'} reps
                        </span>
                        <div className={`${styles.checkCircle}${s.done ? ' ' + styles.checkDone : ''}`} />
                      </div>
                    ))}
                  </div>
                );
              })
            : planExercises.map((str, i) => {
                const { name, prescription } = parseExercise(str);
                const setCount = parseSetCount(prescription);
                return (
                  <div key={i} className={styles.exCard}>
                    <div className={styles.exHeader}>
                      <div>
                        <div className={styles.exName}>{name}</div>
                        {prescription && <div className={styles.exPrescription}>{prescription}</div>}
                      </div>
                      <span className={styles.setBadge}>{setCount} sets</span>
                    </div>
                    {Array.from({ length: setCount }).map((_, si) => (
                      <div key={si} className={styles.setRowDetail}>
                        <span className={styles.setNumDetail}>Set {si + 1}</span>
                        <span className={styles.setData}>— × —</span>
                        <div className={styles.checkCircle} />
                      </div>
                    ))}
                  </div>
                );
              })
          }

          <button className={styles.redoBottomBtn} onClick={() => startRedo(detail)}>
            ↺ Redo this workout
          </button>
        </div>

        {overlay && (
          <WorkoutOverlay
            workoutName={overlay.name}
            dayName={overlay.dayName}
            exercises={overlay.exercises ?? undefined}
            onClose={() => setOverlay(null)}
          />
        )}
      </>
    );
  }

  // ── Main view ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className={styles.screen}>
        <div className={styles.headingRow}>
          <div className={styles.heading}>History</div>
          <div className={styles.backupBtns}>
            <button className={styles.backupBtn} onClick={handleExport} disabled={history.length === 0}>
              Export
            </button>
            <button className={styles.backupBtn} onClick={() => fileInputRef.current?.click()}>
              Import
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              style={{ display: 'none' }}
              onChange={handleImportFile}
            />
          </div>
        </div>

        {importStatus && (
          <div className={`${styles.importBanner}${importStatus.error ? ' ' + styles.importError : ''}`}>
            {importStatus.error
              ? importStatus.error
              : importStatus.count === 0
                ? 'All entries already present — nothing imported'
                : `Imported ${importStatus.count} workout${importStatus.count !== 1 ? 's' : ''}`
            }
          </div>
        )}

        <div className={styles.statsRow}>
          <div className={styles.statChip}>
            <div className={styles.statValue}>{totalWorkouts}</div>
            <div className={styles.statLabel}>Workouts</div>
          </div>
          <div className={styles.statChip}>
            <div className={styles.statValue}>{formatVolume(totalVolume)}</div>
            <div className={styles.statLabel}>Total volume</div>
          </div>
          <div className={styles.statChip}>
            <div className={styles.statValue}>{avgSets}</div>
            <div className={styles.statLabel}>Avg sets</div>
          </div>
        </div>

        {/* Tab bar */}
        <div className={styles.tabBar}>
          {['history', 'progress', 'records', 'weight'].map(t => (
            <button
              key={t}
              className={`${styles.tabBtn}${activeTab === t ? ' ' + styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* History tab */}
        {activeTab === 'history' && (
          <>
            {history.length === 0 && (
              <div className={styles.empty}>No workouts yet. Start one to see history.</div>
            )}
            <div className={styles.list}>
              {history.map(entry => (
                <div key={entry.id} className={styles.card} onClick={() => setDetail(entry)}>
                  <div className={styles.cardTop}>
                    <div>
                      <div className={styles.cardName}>{entry.name}</div>
                      <div className={styles.cardDate}>{formatDate(entry.date)}</div>
                    </div>
                    <span className={styles.viewLink}>View →</span>
                  </div>
                  <div className={styles.cardMeta}>
                    <span className={styles.metaItem}>{formatDuration(entry.duration)}</span>
                    <span className={styles.metaItem}>{formatVolume(entry.volume)}</span>
                    <span className={styles.metaItem}>{entry.sets} sets</span>
                  </div>
                  {entry.notes?.trim() && (
                    <div className={styles.cardNotes}>{entry.notes}</div>
                  )}
                  <button
                    className={styles.redoBtn}
                    onClick={e => { e.stopPropagation(); startRedo(entry); }}
                  >
                    ↺ Redo
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Progress tab */}
        {activeTab === 'progress' && (
          <div className={styles.progressSection}>
            {allExerciseNames.length === 0 ? (
              <div className={styles.empty}>Complete some workouts to track progress.</div>
            ) : (
              <>
                <div className={styles.exPickerWrap}>
                  <input
                    className={styles.exPickerInput}
                    placeholder="Search exercise…"
                    value={selectedEx ? selectedEx : exSearch}
                    onFocus={() => { setExDropOpen(true); if (selectedEx) { setExSearch(''); setSelectedEx(null); } }}
                    onChange={e => { setExSearch(e.target.value); setSelectedEx(null); setExDropOpen(true); }}
                  />
                  {selectedEx && (
                    <button className={styles.exPickerClear} onClick={() => { setSelectedEx(null); setExSearch(''); }}>✕</button>
                  )}
                  {exDropOpen && !selectedEx && filteredExNames.length > 0 && (
                    <div className={styles.exDropdown}>
                      {filteredExNames.map(name => (
                        <button
                          key={name}
                          className={styles.exDropOption}
                          onClick={() => { setSelectedEx(name); setExDropOpen(false); setExSearch(''); }}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedEx ? (
                  <>
                    <div className={styles.chartTitle}>{selectedEx} — Best weight per session (lb)</div>
                    <ProgressChart exerciseName={selectedEx} history={history} />
                  </>
                ) : (
                  <div className={styles.chartPlaceholder}>Select an exercise to view progress</div>
                )}
              </>
            )}
          </div>
        )}
        {/* Records tab */}
        {activeTab === 'records' && (
          <div className={styles.recordsSection}>
            {Object.keys(groupedRecords).length === 0 ? (
              <div className={styles.empty}>Complete some workouts to see your records.</div>
            ) : (
              [...CAT_ORDER, 'Other'].filter(c => groupedRecords[c]).map(cat => (
                <div key={cat} className={styles.recordGroup}>
                  <div className={styles.recordGroupTitle}>{cat.toUpperCase()}</div>
                  {groupedRecords[cat].map(rec => (
                    <div key={rec.name} className={styles.recordRow}>
                      <div className={styles.recordName}>
                        {rec.name}
                        {rec.e1rmReps > 1 && (
                          <span className={styles.recordSource}>
                            from {rec.e1rmWeight} {rec.unit} × {rec.e1rmReps}
                          </span>
                        )}
                      </div>
                      <div className={styles.recordBests}>
                        {rec.e1rm > 0 && (
                          <span className={styles.recordBest}>
                            💪 {Math.round(fromLb(rec.e1rm, rec.unit))} {rec.unit} <span className={styles.recordBestLabel}>est. 1RM</span>
                          </span>
                        )}
                        {rec.rawWeight > 0 && (
                          <span className={styles.recordSecondary}>
                            🏆 {rec.rawWeight} {rec.unit} heaviest
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        )}

        {/* Weight tab */}
        {activeTab === 'weight' && (
          <div className={styles.weightSection}>
            <div className={styles.bwLogForm}>
              <input
                type="date"
                className={styles.bwDateInput}
                value={bwDate}
                max={todayISO()}
                onChange={e => setBwDate(e.target.value)}
              />
              <input
                type="number"
                inputMode="decimal"
                className={styles.bwInput}
                placeholder={`Weight (${globalUnit})`}
                value={bwInput}
                onChange={e => setBwInput(e.target.value)}
              />
              <button
                className={styles.bwLogBtn}
                disabled={!bwInput.trim()}
                onClick={() => {
                  if (!bwInput.trim()) return;
                  addBodyWeightEntry({ date: bwDate, weight: parseFloat(bwInput), unit: globalUnit });
                  setBwInput('');
                }}
              >
                Log
              </button>
            </div>

            {bodyWeightLog.length === 0 ? (
              <div className={styles.empty}>No body weight entries yet.</div>
            ) : (
              <>
                <BodyWeightChart log={bodyWeightLog} unit={globalUnit} />
                <div className={styles.bwList}>
                  {[...bodyWeightLog].reverse().slice(0, 20).map(e => (
                    <div key={e.date} className={styles.bwEntry}>
                      <span className={styles.bwEntryDate}>{formatDate(e.date)}</span>
                      <span className={styles.bwEntryWeight}>{e.weight} {e.unit}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {overlay && (
        <WorkoutOverlay
          workoutName={overlay.name}
          dayName={overlay.dayName}
          exercises={overlay.exercises ?? undefined}
          onClose={() => setOverlay(null)}
        />
      )}
    </>
  );
}
