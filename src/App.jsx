import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import BottomNav from './components/BottomNav/BottomNav';
import Today from './screens/Today/Today';
import Workout from './screens/Workout/Workout';
import Movements from './screens/Movements/Movements';
import Plans from './screens/Plans/Plans';
import History from './screens/History/History';
import Auth from './screens/Auth/Auth';
import RotateGuard from './components/RotateGuard/RotateGuard';
import styles from './App.module.css';

// Apply saved theme immediately, before React renders, so there's no flash
const _savedTheme = localStorage.getItem('gymTheme');
if (_savedTheme && _savedTheme !== 'auto') {
  document.documentElement.dataset.theme = _savedTheme;
}

function AppShell() {
  const { user, loading, loadError, retryLoad, theme, syncState, retrySync } = useApp();

  // Keep DOM attribute in sync whenever theme changes after login
  useEffect(() => {
    if (!theme || theme === 'auto') {
      delete document.documentElement.dataset.theme;
    } else {
      document.documentElement.dataset.theme = theme;
    }
  }, [theme]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div className={styles.layout}>
      {loadError && (
        <div className={styles.errorBanner}>
          Could not reach the server — your data may not have loaded.{' '}
          <button className={styles.retryBtn} onClick={retryLoad}>Retry</button>
        </div>
      )}
      {syncState?.pendingWorkouts > 0 && (
        <div className={styles.syncBanner}>
          <span className={styles.syncDot} />
          <span className={styles.syncText}>
            {syncState.pendingWorkouts} workout{syncState.pendingWorkouts > 1 ? 's' : ''} saved on this device,
            {syncState.syncing ? ' syncing…' : ' waiting to sync.'}
          </span>
          {!syncState.syncing && (
            <button className={styles.syncRetryBtn} onClick={retrySync}>Sync now</button>
          )}
        </div>
      )}
      <main className={styles.content}>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/movements" element={<Movements />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/history" element={<History />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
      {/* Outside the shell so it also covers the loading and sign-in screens. */}
      <RotateGuard />
    </AppProvider>
  );
}
