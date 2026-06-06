import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import BottomNav from './components/BottomNav/BottomNav';
import Today from './screens/Today/Today';
import Workout from './screens/Workout/Workout';
import Movements from './screens/Movements/Movements';
import Plans from './screens/Plans/Plans';
import History from './screens/History/History';
import Auth from './screens/Auth/Auth';
import styles from './App.module.css';

function AppShell() {
  const { user, loading, loadError, retryLoad } = useApp();

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
    </AppProvider>
  );
}
