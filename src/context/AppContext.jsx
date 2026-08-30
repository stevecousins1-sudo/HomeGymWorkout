import { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { authStore, auth, historyApi, settingsApi } from '../lib/api';
import { enqueue, flush, subscribe as subscribeOutbox, onOpSynced, onOpFailed } from '../lib/outbox';

const AppContext = createContext(null);


function recordToEntry(r) {
  return {
    id: r.id,
    date: r.entry_date,
    name: r.name,
    dayName: r.day_name,
    duration: Number(r.duration),
    volume: Number(r.volume),
    sets: Number(r.sets),
    exercises: r.exercises || [],
    notes: r.notes || '',
  };
}

let clientSeq = 0;
function nextClientId() {
  clientSeq += 1;
  return `local_${Date.now()}_${clientSeq}`;
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => authStore.model);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activePlan, setActivePlanState] = useState(null);
  const [history, setHistory] = useState([]);
  const [unitPrefs, setUnitPrefsState] = useState({});
  const [globalUnit, setGlobalUnitState] = useState('lb');
  const [restPrefs, setRestPrefsState] = useState({});
  const [customMovements, setCustomMovementsState] = useState([]);
  const [templates, setTemplatesState] = useState([]);
  const [customPlans, setCustomPlansState] = useState([]);
  const [theme, setThemeState] = useState(() => localStorage.getItem('gymTheme') || 'auto');
  const [bodyWeightLog, setBodyWeightLogState] = useState([]);
  const [hasMachines, setHasMachinesState] = useState(null);
  const [syncState, setSyncState] = useState({ pending: 0, pendingWorkouts: 0, syncing: false, lastError: null });

  const unitPrefsRef = useRef({});
  const restPrefsRef = useRef({});
  useEffect(() => { unitPrefsRef.current = unitPrefs; }, [unitPrefs]);
  useEffect(() => { restPrefsRef.current = restPrefs; }, [restPrefs]);

  useEffect(() => {
    const unsub = authStore.onChange((_, model) => {
      setUser(model);
      if (!model) {
        setLoading(false);
        setLoadError(false);
        setHistory([]);
        setActivePlanState(null);
        setUnitPrefsState({});
        setGlobalUnitState('lb');
        setRestPrefsState({});
        setCustomMovementsState([]);
        setTemplatesState([]);
        setCustomPlansState([]);
        setBodyWeightLogState([]);
        setHasMachinesState(null);
      }
    });
    return unsub;
  }, []);

  // Mirror the outbox into React state, and reconcile optimistic rows once
  // their queued write actually lands on the server.
  useEffect(() => {
    const unsubState = subscribeOutbox(setSyncState);
    const unsubSynced = onOpSynced((op, result) => {
      if (op.kind !== 'history.create' || !result) return;
      setHistory(prev => prev.map(h =>
        h.clientId === op.meta?.clientId ? { ...recordToEntry(result), clientId: op.meta.clientId } : h
      ));
    });
    const unsubFailed = onOpFailed((op) => {
      if (op.kind !== 'history.create') return;
      setHistory(prev => prev.map(h =>
        h.clientId === op.meta?.clientId ? { ...h, pending: false, syncFailed: true } : h
      ));
    });
    return () => { unsubState(); unsubSynced(); unsubFailed(); };
  }, []);

  useEffect(() => {
    if (!authStore.isValid) {
      authStore.clear();
      setLoading(false);
      return;
    }
    auth.refresh().catch(err => {
      if (err?.status === 401 || err?.status === 403) {
        authStore.clear();
        setLoading(false);
      }
    });
    loadUserData();
  }, [user?.id]);

  async function loadUserData() {
    setLoading(true);
    setLoadError(false);
    try {
      const [histRes, settingsRes] = await Promise.allSettled([
        historyApi.list(),
        settingsApi.get(),
      ]);

      if (histRes.status === 'rejected' && settingsRes.status === 'rejected') {
        const err = histRes.reason;
        if (!err?.status || err.status === 0 || err.status >= 500) {
          setLoadError(true);
          return;
        }
      }

      if (histRes.status === 'fulfilled') {
        const serverEntries = histRes.value.map(recordToEntry);
        // Workouts still sitting in the outbox aren't on the server yet —
        // keep them on screen instead of letting the fetch erase them.
        setHistory(prev => {
          const unsynced = prev.filter(h => h.pending || h.syncFailed);
          if (!unsynced.length) return serverEntries;
          return [...unsynced, ...serverEntries].sort((a, b) => b.date.localeCompare(a.date));
        });
      }

      if (settingsRes.status === 'fulfilled') {
        const s = settingsRes.value;
        setActivePlanState(s.active_plan || null);
        setUnitPrefsState(s.unit_prefs || {});
        setGlobalUnitState(s.global_unit || 'lb');
        setRestPrefsState(s.rest_prefs || {});
        setCustomMovementsState(s.custom_movements || []);
        setTemplatesState(s.templates || []);
        setCustomPlansState(s.custom_plans || []);
        setBodyWeightLogState(s.body_weight_log || []);
        setHasMachinesState(s.has_machines ?? null);
      } else if (settingsRes.reason?.status === 404) {
        // First login — create default settings with empty history
        await settingsApi.create({ active_plan: null, unit_prefs: {}, global_unit: 'lb', rest_prefs: {}, custom_movements: [], templates: [], custom_plans: [] });
        setHistory([]);
      }
    } catch (e) {
      console.error('Failed to load user data:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
      flush(); // push anything queued from a previous offline session
    }
  }

  // Settings go through the outbox so a patch made offline still lands later.
  function patchSettings(patch) {
    enqueue('settings.patch', patch);
  }

  const setActivePlan = useCallback((plan) => {
    setActivePlanState(plan);
    setHasMachinesState(null); // re-ask machine question for each new plan
    patchSettings({ active_plan: plan, has_machines: null });
  }, []);

  // Persisted, so a reload doesn't re-ask a question the user already answered.
  const setHasMachines = useCallback((val) => {
    setHasMachinesState(val);
    patchSettings({ has_machines: val });
  }, []);

  const cancelPlan = useCallback(() => {
    setActivePlanState(null);
    patchSettings({ active_plan: null });
  }, []);

  // The workout is committed to the outbox synchronously, so finishing a
  // session can never fail — the set data is durable before the network is
  // ever involved.
  const addHistory = useCallback((entry) => {
    const clientId = nextClientId();
    setHistory(prev => [{ ...entry, id: clientId, clientId, pending: true }, ...prev]);
    enqueue('history.create', {
      entry_date: entry.date,
      name: entry.name,
      day_name: entry.dayName,
      duration: entry.duration,
      volume: entry.volume,
      sets: entry.sets,
      exercises: entry.exercises || [],
      notes: entry.notes || null,
    }, { clientId });
  }, []);

  // A mistyped set poisons every derived number — records, PR toasts, the
  // progress chart and the next session's suggestion all key off best e1RM —
  // so a logged session has to be correctable after the fact.
  const updateHistoryEntry = useCallback((id, entry) => {
    setHistory(prev => prev.map(h => (h.id === id ? { ...h, ...entry } : h)));
    enqueue('history.update', {
      id,
      entry: {
        entry_date: entry.date,
        name: entry.name,
        day_name: entry.dayName || entry.name,
        duration: entry.duration || 0,
        volume: entry.volume || 0,
        sets: entry.sets || 0,
        exercises: entry.exercises || [],
        notes: entry.notes || null,
      },
    });
  }, []);

  const deleteHistoryEntry = useCallback((id) => {
    setHistory(prev => prev.filter(h => h.id !== id));
    enqueue('history.remove', { id });
  }, []);

  // Imports go through the outbox too, so a restore performed on a flaky
  // connection can't silently drop half the file.
  const importHistory = useCallback((entries) => {
    const rows = entries.map(entry => ({
      clientId: nextClientId(),
      entry: {
        date: entry.date,
        name: entry.name,
        dayName: entry.dayName || entry.name,
        duration: entry.duration || 0,
        volume: entry.volume || 0,
        sets: entry.sets || 0,
        exercises: entry.exercises || [],
        notes: entry.notes || '',
      },
    }));

    setHistory(prev => {
      const merged = [
        ...rows.map(({ entry, clientId }) => ({ ...entry, id: clientId, clientId, pending: true })),
        ...prev,
      ];
      merged.sort((a, b) => b.date.localeCompare(a.date));
      return merged;
    });

    for (const { entry, clientId } of rows) {
      enqueue('history.create', {
        entry_date: entry.date,
        name: entry.name,
        day_name: entry.dayName,
        duration: entry.duration,
        volume: entry.volume,
        sets: entry.sets,
        exercises: entry.exercises,
        notes: entry.notes || null,
      }, { clientId });
    }

    return rows.length;
  }, []);

  const setUnitPref = useCallback((movementName, unit) => {
    const newPrefs = { ...unitPrefsRef.current, [movementName]: unit };
    setUnitPrefsState(newPrefs);
    patchSettings({ unit_prefs: newPrefs });
  }, []);

  const setRestPref = useCallback((movementName, duration) => {
    const newPrefs = { ...restPrefsRef.current, [movementName]: duration };
    setRestPrefsState(newPrefs);
    patchSettings({ rest_prefs: newPrefs });
  }, []);

  const addCustomMovement = useCallback((movement) => {
    setCustomMovementsState(prev => {
      const updated = [...prev, { ...movement, custom: true }];
      patchSettings({ custom_movements: updated });
      return updated;
    });
  }, []);

  const deleteCustomMovement = useCallback((name) => {
    setCustomMovementsState(prev => {
      const updated = prev.filter(m => m.name !== name);
      patchSettings({ custom_movements: updated });
      return updated;
    });
  }, []);

  const saveTemplate = useCallback((template) => {
    setTemplatesState(prev => {
      const updated = [...prev, { ...template, id: Date.now() }];
      patchSettings({ templates: updated });
      return updated;
    });
  }, []);

  const deleteTemplate = useCallback((id) => {
    setTemplatesState(prev => {
      const updated = prev.filter(t => t.id !== id);
      patchSettings({ templates: updated });
      return updated;
    });
  }, []);

  const setTheme = useCallback((t) => {
    setThemeState(t);
    localStorage.setItem('gymTheme', t);
    patchSettings({ theme: t });
  }, []);

  const addBodyWeightEntry = useCallback(({ date, weight, unit }) => {
    setBodyWeightLogState(prev => {
      const filtered = prev.filter(e => e.date !== date);
      const updated = [...filtered, { date, weight, unit }].sort((a, b) => a.date.localeCompare(b.date));
      patchSettings({ body_weight_log: updated });
      return updated;
    });
  }, []);

  const saveCustomPlan = useCallback((plan) => {
    setCustomPlansState(prev => {
      const updated = [...prev.filter(p => p.id !== plan.id), plan];
      patchSettings({ custom_plans: updated });
      return updated;
    });
  }, []);

  const deleteCustomPlan = useCallback((id) => {
    setCustomPlansState(prev => {
      const updated = prev.filter(p => p.id !== id);
      patchSettings({ custom_plans: updated });
      return updated;
    });
  }, []);

  const updatePlanDayTemplate = useCallback((dayName, exerciseStrings) => {
    setActivePlanState(prev => {
      if (!prev || !prev.isCustom) return prev;
      const updated = {
        ...prev,
        exerciseTemplates: { ...prev.exerciseTemplates, [dayName]: exerciseStrings },
      };
      patchSettings({ active_plan: updated });
      return updated;
    });
  }, []);

  const setGlobalUnit = useCallback((unit) => {
    setGlobalUnitState(unit);
    patchSettings({ global_unit: unit });
  }, []);

  const markScheduleEntry = useCallback((date, field, value) => {
    setActivePlanState(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        schedule: prev.schedule.map(e => e.date === date ? { ...e, [field]: value } : e),
      };
      patchSettings({ active_plan: updated });
      return updated;
    });
  }, []);

  const logout = useCallback(() => {
    authStore.clear();
  }, []);

  return (
    <AppContext.Provider value={{
      user,
      loading,
      loadError,
      activePlan,
      history,
      unitPrefs,
      globalUnit,
      restPrefs,
      setActivePlan,
      cancelPlan,
      addHistory,
      updateHistoryEntry,
      deleteHistoryEntry,
      importHistory,
      customMovements,
      addCustomMovement,
      deleteCustomMovement,
      templates,
      saveTemplate,
      deleteTemplate,
      customPlans,
      saveCustomPlan,
      deleteCustomPlan,
      updatePlanDayTemplate,
      theme,
      setTheme,
      bodyWeightLog,
      addBodyWeightEntry,
      setUnitPref,
      setGlobalUnit,
      setRestPref,
      markScheduleEntry,
      hasMachines,
      setHasMachines,
      retryLoad: loadUserData,
      syncState,
      retrySync: flush,
      logout,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
