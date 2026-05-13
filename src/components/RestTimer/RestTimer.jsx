import { useState, useEffect } from 'react';
import styles from './RestTimer.module.css';

const REST_DURATION = 90;

export default function RestTimer({ onDone }) {
  const [remaining, setRemaining] = useState(REST_DURATION);

  useEffect(() => {
    if (remaining <= 0) {
      onDone();
      return;
    }
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onDone]);

  const pct = (remaining / REST_DURATION) * 100;

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
