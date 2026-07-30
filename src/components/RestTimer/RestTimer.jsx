import { useState, useEffect, useRef } from 'react';
import styles from './RestTimer.module.css';

function playBeep(audioCtx) {
  if (!audioCtx) return;
  try {
    const play = () => {
      const osc  = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
    };
    if (audioCtx.state === 'suspended') audioCtx.resume().then(play).catch(() => {});
    else play();
  } catch {}
}

export default function RestTimer({ duration = 90, onDone, audioCtx }) {
  const [remaining, setRemaining] = useState(duration);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  // Counted off a wall-clock deadline rather than by decrementing once a
  // second: browsers throttle timers in backgrounded tabs, and a rest timer
  // that pauses while the phone is locked is worse than no timer at all.
  useEffect(() => {
    const deadline = Date.now() + duration * 1000;
    let fired = false;

    const tick = () => {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      setRemaining(Math.max(0, left));
      if (left > 0 || fired) return;
      fired = true;
      playBeep(audioCtx);
      navigator.vibrate?.([200, 100, 200]);
      onDoneRef.current();
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [duration, audioCtx]);

  const pct = (remaining / duration) * 100;

  return (
    <div className={styles.bar}>
      <span className={styles.label}>Rest</span>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${pct}%` }} />
      </div>
      <span className={styles.countdown}>{remaining}s</span>
      <button className={styles.skip} onClick={onDone}>Skip</button>
    </div>
  );
}
