import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (remaining <= 0) {
      playBeep(audioCtx);
      navigator.vibrate?.([200, 100, 200]);
      onDone();
      return;
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onDone, audioCtx]);

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
