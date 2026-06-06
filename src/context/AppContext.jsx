import { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import { authStore, auth, historyApi, settingsApi } from '../lib/api';

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
      }
    });
    return unsub;
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
        setHistory(histRes.value.map(recordToEntry));
      }

      if (settingsRes.status === 'fulfilled') {
        const s = settingsRes.value;
        setActivePlanState(s.active_plan || null);
        setUnitPrefsState(s.unit_prefs || {});
        setGlobalUnitState(s.global_unit || 'lb');
        setRestPrefsState(s.rest_prefs || {});
        setCustomMovementsState(s.custom_movements || []);
        setTemplatesState(s.templates || []);
      } else if (settingsRes.reason?.status === 404) {
        // First login — create default settings with empty history
        await settingsApi.create({ active_plan: null, unit_prefs: {}, global_unit: 'lb', rest_prefs: {}, custom_movements: [], templates: [] });
        setHistory([]);
      }
    } catch (e) {
      console.error('Failed to load user data:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function patchSettings(patch) {
    try {
      await settingsApi.patch(patch);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  }

  const setActivePlan = useCallback((plan) => {
    setActivePlanState(plan);
    patchSettings({ active_plan: plan });
  }, []);

  const cancelPlan = useCallback(() => {
    setActivePlanState(null);
    patchSettings({ active_plan: null });
  }, []);

  const addHistory = useCallback(async (entry) => {
    const tempId = `temp_${Date.now()}`;
    setHistory(prev => [{ ...entry, id: tempId }, ...prev]);
    try {
      const record = await historyApi.create({
        entry_date: entry.date,
        name: entry.name,
        day_name: entry.dayName,
        duration: entry.duration,
        volume: entry.volume,
        sets: entry.sets,
        exercises: entry.exercises || [],
        notes: entry.notes || null,
      });
      setHistory(prev => prev.map(h => h.id === tempId ? recordToEntry(record) : h));
    } catch (e) {
      console.error('Failed to save workout:', e);
    }
  }, []);

  const importHistory = useCallback(async (entries) => {
    const results = [];
    for (const entry of entries) {
      try {
        const record = await historyApi.create({
          entry_date: entry.date,
          name: entry.name,
          day_name: entry.dayName || entry.name,
          duration: entry.duration || 0,
          volume: entry.volume || 0,
          sets: entry.sets || 0,
          exercises: entry.exercises || [],
        });
        results.push(recordToEntry(record));
      } catch (e) {
        console.error('Failed to import entry:', entry.date, e);
      }
    }
    if (results.length > 0) {
      setHistory(prev => {
        const merged = [...results, ...prev];
        merged.sort((a, b) => b.date.localeCompare(a.date));
        return merged;
      });
    }
    return results.length;
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
      importHistory,
      customMovements,
      addCustomMovement,
      deleteCustomMovement,
      templates,
      saveTemplate,
      deleteTemplate,
      setUnitPref,
      setGlobalUnit,
      setRestPref,
      markScheduleEntry,
      retryLoad: loadUserData,
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
