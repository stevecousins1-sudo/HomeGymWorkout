import { useState, useEffect, useRef } from 'react';

export function useWorkoutTimer(running) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    if (!running) return;
    // Use wall-clock time so the timer stays accurate when the tab is
    // backgrounded or the browser throttles setInterval.
    if (!startRef.current) startRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  return elapsed;
}
