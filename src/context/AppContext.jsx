import { createContext, useContext, useCallback } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

const SEED_HISTORY = [
  { id:1, date:'2026-05-10', name:'Push Day A',  dayName:'Push A',           duration:3120, volume:12840, sets:17 },
  { id:2, date:'2026-05-08', name:'Leg Day',     dayName:'Legs',             duration:3660, volume:18560, sets:20 },
  { id:3, date:'2026-05-07', name:'Pull Day A',  dayName:'Pull A',           duration:2880, volume:14320, sets:16 },
  { id:4, date:'2026-05-05', name:'Push Day B',  dayName:'Chest & Triceps',  duration:3300, volume:13100, sets:18 },
  { id:5, date:'2026-05-04', name:'Leg Day',     dayName:'Legs',             duration:3480, volume:17890, sets:19 },
];

const DEFAULT_STATE = {
  activePlan: null,
  history: SEED_HISTORY,
  unitPrefs: {},
  globalUnit: 'lb',
};

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, setState] = useLocalStorage('workout-app-v1', DEFAULT_STATE);

  const setActivePlan = useCallback((plan) => {
    setState(prev => ({ ...prev, activePlan: plan }));
  }, [setState]);

  const addHistory = useCallback((entry) => {
    setState(prev => ({ ...prev, history: [entry, ...prev.history] }));
  }, [setState]);

  const setUnitPref = useCallback((movementName, unit) => {
    setState(prev => ({
      ...prev,
      unitPrefs: { ...prev.unitPrefs, [movementName]: unit },
    }));
  }, [setState]);

  const setGlobalUnit = useCallback((unit) => {
    setState(prev => ({ ...prev, globalUnit: unit }));
  }, [setState]);

  const markScheduleEntry = useCallback((date, field, value) => {
    setState(prev => {
      if (!prev.activePlan) return prev;
      const schedule = prev.activePlan.schedule.map(entry =>
        entry.date === date ? { ...entry, [field]: value } : entry
      );
      return { ...prev, activePlan: { ...prev.activePlan, schedule } };
    });
  }, [setState]);

  const cancelPlan = useCallback(() => {
    setState(prev => ({ ...prev, activePlan: null }));
  }, [setState]);

  return (
    <AppContext.Provider value={{
      ...state,
      setActivePlan,
      addHistory,
      setUnitPref,
      setGlobalUnit,
      markScheduleEntry,
      cancelPlan,
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
