import { useState, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { getExercisesForDay } from '../../data/exercises';
import { MOVEMENTS } from '../../data/movements';
import WorkoutOverlay from '../../components/WorkoutOverlay/WorkoutOverlay';
import ProgressChart from '../../components/ProgressChart/ProgressChart';
import BodyWeightChart from '../../components/BodyWeightChart/BodyWeightChart';
import { formatDate, formatDuration, formatVolume, todayISO } from '../../utils';
import styles from './History.module.css';

const MOV_CAT_MAP = new Map(MOVEMENTS.map(m => [m.name.toLowerCase(), m.category]));
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
  const { history, importHistory, bodyWeightLog, addBodyWeightEntry, globalUnit } = useApp();
  const [activeTab, setActiveTab]       = useState('history');
  const [detail, setDetail]             = useState(null);
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

  // All-time records grouped by muscle category
  const groupedRecords = useMemo(() => {
    const recs = {};
    for (const entry of history) {
      for (const ex of (entry.exercises || [])) {
        if (!recs[ex.name]) recs[ex.name] = { weight: 0, rawWeight: 0, unit: ex.unit || 'lb', volume: 0 };
        const exUnit = ex.unit || 'lb';
        for (const s of (ex.sets || [])) {
          if (!s.done) continue;
          const w = parseFloat(s.weight) || 0;
          const r = parseFloat(s.reps) || 0;
          const wLb = exUnit === 'kg' ? w * 2.2046 : w;
          if (wLb > recs[ex.name].weight) {
            recs[ex.name] = { weight: wLb, rawWeight: w, unit: exUnit, volume: recs[ex.name].volume };
          }
          if (wLb * r > recs[ex.name].volume) recs[ex.name].volume = wLb * r;
        }
      }
    }
    const grouped = {};
    for (const [name, rec] of Object.entries(recs)) {
      const cat = MOV_CAT_MAP.get(name.toLowerCase()) || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ name, ...rec });
    }
    for (const cat of Object.keys(grouped)) {
      grouped[cat].sort((a, b) => b.weight - a.weight);
    }
    return grouped;
  }, [history]);

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

    return (
      <>
        <div className={styles.screen}>
          <button className={styles.backBtn} onClick={() => setDetail(null)}>← Back</button>
          <div className={styles.detailName}>{detail.name}</div>
          <div className={styles.detailDate}>{formatDate(detail.date)}</div>

          <div className={styles.chips}>
            <div className={styles.chip}>
              <div className={styles.chipValue}>{formatDuration(detail.duration)}</div>
              <div className={styles.chipLabel}>Duration</div>
            </div>
            <div className={styles.chip}>
              <div className={styles.chipValue}>{formatVolume(detail.volume)}</div>
              <div className={styles.chipLabel}>Volume</div>
            </div>
            <div className={styles.chip}>
              <div className={styles.chipValue}>{detail.sets}</div>
              <div className={styles.chipLabel}>Sets done</div>
            </div>
          </div>

          {detail.notes?.trim() && (
            <div className={styles.detailNotes}>
              <div className={styles.detailNotesLabel}>NOTES</div>
              <div className={styles.detailNotesText}>{detail.notes}</div>
            </div>
          )}

          <div className={styles.sectionTitle}>MOVEMENTS</div>

          {hasExerciseData
            ? detail.exercises.map((ex, i) => {
                const doneSets = ex.sets.filter(s => s.done);
                return (
                  <div key={i} className={styles.exCard}>
                    <div className={styles.exHeader}>
                      <div className={styles.exName}>{ex.name}</div>
                      <span className={styles.setBadge}>{doneSets.length}/{ex.sets.length} sets</span>
                    </div>
                    {ex.sets.map((s, si) => (
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
                      <div className={styles.recordName}>{rec.name}</div>
                      <div className={styles.recordBests}>
                        {rec.rawWeight > 0 && (
                          <span className={styles.recordBest}>
                            🏆 {rec.rawWeight} {rec.unit}
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
