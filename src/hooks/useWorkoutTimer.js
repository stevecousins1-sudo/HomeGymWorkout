import { useState, useEffect, useRef } from 'react';

/**
 * Elapsed-seconds counter for a workout.
 *
 * `startedAt` is an epoch millisecond timestamp owned by the caller, so a
 * session resumed from a saved draft continues counting from when it really
 * began rather than restarting at zero.
 */
export function useWorkoutTimer(running, startedAt = null) {
  const startRef = useRef(startedAt ?? null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!running) return;
    // Use wall-clock time so the timer stays accurate when the tab is
    // backgrounded or the browser throttles setInterval.
    if (!startRef.current) startRef.current = Date.now();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startRef.current) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [running]);

  return elapsed;
}
