import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { generateSchedule, todayISO } from '../../utils';
import styles from './PlanModal.module.css';

export default function PlanModal({ plan, onClose }) {
  const { setActivePlan } = useApp();
  const [startDate, setStartDate] = useState(todayISO());

  function handleGenerate() {
    const schedule = generateSchedule(plan, startDate);
    setActivePlan({
      planId: plan.id,
      planName: plan.name,
      startDate,
      schedule,
      ...(plan.isCustom ? { isCustom: true, exerciseTemplates: plan.exerciseTemplates } : {}),
    });
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet}>
        <div className={styles.handle} />
        <div className={styles.title}>{plan.name}</div>
        <div className={styles.sub}>{plan.weeks} weeks · {plan.daysPerWeek} days/week</div>

        <div className={styles.field}>
          <label>Start date</label>
          <input
            type="date"
            value={startDate}
            min={todayISO()}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.cancel} onClick={onClose}>Cancel</button>
          <button className={styles.generate} onClick={handleGenerate}>Generate schedule</button>
        </div>
      </div>
    </div>
  );
}
