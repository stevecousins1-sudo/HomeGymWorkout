import { useState, useEffect } from 'react';
import styles from './RestTimer.module.css';

export default function RestTimer({ duration = 90, onDone }) {
  const [remaining, setRemaining] = useState(duration);

  useEffect(() => {
    if (remaining <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onDone]);

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
