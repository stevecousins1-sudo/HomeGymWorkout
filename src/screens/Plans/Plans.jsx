import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PLANS, FOCUS_LABELS, FOCUS_STYLES } from '../../data/plans';
import { getExercisesForDay } from '../../data/exercises';
import PlanModal from '../../components/PlanModal/PlanModal';
import PlanBuilder from '../../components/PlanBuilder/PlanBuilder';
import { formatDate } from '../../utils';
import styles from './Plans.module.css';

export default function Plans() {
  const { activePlan, cancelPlan, customPlans, deleteCustomPlan } = useApp();
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  const doneCount = activePlan?.schedule.filter(e => e.done).length ?? 0;
  const totalCount = activePlan?.schedule.length ?? 0;
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  if (selected) {
    const isActive = activePlan?.planId === selected.id;
    const totalSessions = selected.weeks * selected.daysPerWeek;

    return (
      <div className={styles.screen}>
        <button className={styles.backBtn} onClick={() => setSelected(null)}>
          ← Back
        </button>

        <div className={styles.detailHeader}>
          <span
            className={styles.focusBadge}
            style={FOCUS_STYLES[selected.focus]}
          >
            {FOCUS_LABELS[selected.focus]}
          </span>
          <div className={styles.detailName}>{selected.name}</div>
          <div className={styles.detailDesc}>{selected.description}</div>
        </div>

        <div className={styles.chips}>
          <div className={styles.chip}>
            <div className={styles.chipValue}>{selected.daysPerWeek}</div>
            <div className={styles.chipLabel}>Days/week</div>
          </div>
          <div className={styles.chip}>
            <div className={styles.chipValue}>{selected.weeks}</div>
            <div className={styles.chipLabel}>Weeks</div>
          </div>
          <div className={styles.chip}>
            <div className={styles.chipValue}>{totalSessions}</div>
            <div className={styles.chipLabel}>Sessions</div>
          </div>
        </div>

        <div className={styles.scheduleTitle}>WEEKLY SCHEDULE</div>
        <ul className={styles.scheduleList}>
          {selected.dayNames.map((dayName, i) => {
            const exCount = selected.isCustom
              ? (selected.exerciseTemplates?.[dayName]?.length ?? 0)
              : getExercisesForDay(dayName).length;
            return (
              <li key={i} className={styles.scheduleItem}>
                <div className={styles.dayCircle}>{i + 1}</div>
                <div className={styles.dayName}>{dayName}</div>
                <div className={styles.exCount}>{exCount} exercises</div>
              </li>
            );
          })}
        </ul>

        <button
          className={styles.startPlanBtn}
          disabled={isActive}
          onClick={() => !isActive && setShowModal(true)}
        >
          {isActive ? 'Currently active' : 'Start this plan'}
        </button>

        {selected.isCustom && (
          <button
            className={styles.deletePlanBtn}
            onClick={() => {
              if (window.confirm('Delete this custom plan?')) {
                deleteCustomPlan(selected.id);
                setSelected(null);
              }
            }}
          >
            Delete plan
          </button>
        )}

        {showModal && (
          <PlanModal plan={selected} onClose={() => { setShowModal(false); setSelected(null); }} />
        )}
      </div>
    );
  }

  return (
    <>
      <div className={styles.screen}>
        <div className={styles.headingRow}>
          <div className={styles.heading}>Plans</div>
          <button className={styles.createBtn} onClick={() => setShowBuilder(true)}>+ Create</button>
        </div>

        {activePlan && (
          <div className={styles.activePlanCard}>
            <div className={styles.activePlanName}>{activePlan.planName}</div>
            <div className={styles.activePlanMeta}>
              Started {formatDate(activePlan.startDate)} · {doneCount}/{totalCount} sessions
            </div>
            <div className={styles.progressTrack}>
              <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            </div>
            <button className={styles.cancelBtn} onClick={() => {
              if (window.confirm('Cancel this plan?')) cancelPlan();
            }}>
              Cancel plan
            </button>
          </div>
        )}

        {customPlans.length > 0 && (
          <>
            <div className={styles.sectionLabel}>MY PLANS</div>
            <div className={styles.grid}>
              {customPlans.map(plan => (
                <div key={plan.id} className={styles.planCard} onClick={() => setSelected(plan)}>
                  <span className={styles.focusBadge} style={FOCUS_STYLES[plan.focus]}>
                    {FOCUS_LABELS[plan.focus]}
                  </span>
                  <div className={styles.planName}>{plan.name}</div>
                  <div className={styles.planMeta}>{plan.daysPerWeek} days/week · {plan.weeks} weeks</div>
                  <div className={styles.customPlanTag}>Custom</div>
                </div>
              ))}
            </div>
            <div className={styles.sectionLabel}>LIBRARY</div>
          </>
        )}

        <div className={styles.grid}>
          {PLANS.map(plan => (
            <div key={plan.id} className={styles.planCard} onClick={() => setSelected(plan)}>
              <span
                className={styles.focusBadge}
                style={FOCUS_STYLES[plan.focus]}
              >
                {FOCUS_LABELS[plan.focus]}
              </span>
              <div className={styles.planName}>{plan.name}</div>
              <div className={styles.planMeta}>{plan.daysPerWeek} days/week · {plan.weeks} weeks</div>
            </div>
          ))}
        </div>
      </div>

      {showBuilder && <PlanBuilder onClose={() => setShowBuilder(false)} />}
    </>
  );
}
