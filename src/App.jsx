import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import BottomNav from './components/BottomNav/BottomNav';
import Today from './screens/Today/Today';
import Workout from './screens/Workout/Workout';
import Movements from './screens/Movements/Movements';
import Plans from './screens/Plans/Plans';
import History from './screens/History/History';
import styles from './App.module.css';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className={styles.layout}>
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
      </BrowserRouter>
    </AppProvider>
  );
}
