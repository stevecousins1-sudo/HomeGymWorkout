import { createContext, useContext, useCallback, useState, useEffect, useRef } from 'react';
import pb from '../lib/pb';

const AppContext = createContext(null);

const SEED_HISTORY = [
  { date:'2026-05-10', name:'Push Day A',  dayName:'Push A',          duration:3120, volume:12840, sets:17 },
  { date:'2026-05-08', name:'Leg Day',     dayName:'Legs',            duration:3660, volume:18560, sets:20 },
  { date:'2026-05-07', name:'Pull Day A',  dayName:'Pull A',          duration:2880, volume:14320, sets:16 },
  { date:'2026-05-05', name:'Push Day B',  dayName:'Chest & Triceps', duration:3300, volume:13100, sets:18 },
  { date:'2026-05-04', name:'Leg Day',     dayName:'Legs',            duration:3480, volume:17890, sets:19 },
];

function recordToEntry(r) {
  return {
    id: r.id,
    date: r.entry_date,
    name: r.name,
    dayName: r.day_name,
    duration: r.duration,
    volume: r.volume,
    sets: r.sets,
    exercises: r.exercises || [],
  };
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => pb.authStore.model);
  const [loading, setLoading] = useState(true);
  const [activePlan, setActivePlanState] = useState(null);
  const [history, setHistory] = useState([]);
  const [unitPrefs, setUnitPrefsState] = useState({});
  const [globalUnit, setGlobalUnitState] = useState('lb');
  const [restPrefs, setRestPrefsState] = useState({});
  const [loadError, setLoadError] = useState(false);

  const settingsIdRef = useRef(null);
  const unitPrefsRef = useRef({});
  const restPrefsRef = useRef({});
  useEffect(() => { unitPrefsRef.current = unitPrefs; }, [unitPrefs]);
  useEffect(() => { restPrefsRef.current = restPrefs; }, [restPrefs]);

  useEffect(() => {
    const unsub = pb.authStore.onChange((_, model) => {
      setUser(model);
      if (!model) {
        setLoading(false);
        setHistory([]);
        setActivePlanState(null);
        setUnitPrefsState({});
        setGlobalUnitState('lb');
        setRestPrefsState({});
        setLoadError(false);
        settingsIdRef.current = null;
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!pb.authStore.isValid) {
      // Stale model in localStorage but token is expired — clear it so the
      // Auth screen is shown rather than a broken main-app state.
      pb.authStore.clear();
      setLoading(false);
      return;
    }
    // Silently renew the auth token on every app open.  This resets the
    // expiry clock so users are never prompted to re-login as long as they
    // open the app within the token lifetime.
    pb.collection('users').authRefresh().catch(err => {
      // Only force re-login on definitive auth failures (not network errors)
      // so an offline start doesn't unexpectedly log the user out.
      if (err?.status === 401 || err?.status === 403) {
        pb.authStore.clear();
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
        pb.collection('history').getFullList({ sort: '-entry_date,-created' }),
        pb.collection('user_settings').getFirstListItem(''),
      ]);

      // If both failed with a network error, PocketBase is likely still
      // starting up — surface an error so the user can retry.
      if (histRes.status === 'rejected' && settingsRes.status === 'rejected') {
        const err = histRes.reason;
        if (!err?.status || err.status >= 500 || err.status === 0) {
          setLoadError(true);
          return;
        }
      }

      if (histRes.status === 'fulfilled') {
        setHistory(histRes.value.map(recordToEntry));
      }

      if (settingsRes.status === 'fulfilled') {
        const s = settingsRes.value;
        settingsIdRef.current = s.id;
        setActivePlanState(s.active_plan || null);
        setUnitPrefsState(s.unit_prefs || {});
        setGlobalUnitState(s.global_unit || 'lb');
        setRestPrefsState(s.rest_prefs || {});
      } else {
        // First login — create settings and seed history
        const newSettings = await pb.collection('user_settings').create({
          user: pb.authStore.model.id,
          active_plan: null,
          unit_prefs: {},
          global_unit: 'lb',
        });
        settingsIdRef.current = newSettings.id;

        for (const entry of SEED_HISTORY) {
          await pb.collection('history').create({
            user: pb.authStore.model.id,
            entry_date: entry.date,
            name: entry.name,
            day_name: entry.dayName,
            duration: entry.duration,
            volume: entry.volume,
            sets: entry.sets,
            exercises: [],
          });
        }
        const seeded = await pb.collection('history').getFullList({ sort: '-entry_date' });
        setHistory(seeded.map(recordToEntry));
      }
    } catch (e) {
      console.error('Failed to load user data:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  async function patchSettings(patch) {
    if (!settingsIdRef.current) return;
    try {
      await pb.collection('user_settings').update(settingsIdRef.current, patch);
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
      const record = await pb.collection('history').create({
        user: pb.authStore.model.id,
        entry_date: entry.date,
        name: entry.name,
        day_name: entry.dayName,
        duration: entry.duration,
        volume: entry.volume,
        sets: entry.sets,
        exercises: entry.exercises || [],
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
        const record = await pb.collection('history').create({
          user: pb.authStore.model.id,
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
    pb.authStore.clear();
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
