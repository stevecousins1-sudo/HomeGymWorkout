import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GOALS, MUSCLE_GROUPS, buildCustomPlan } from '../../data/planBuilder';
import { generateSchedule, todayISO } from '../../utils';
import styles from './PlanBuilder.module.css';

const DAYS_OPTIONS = [2, 3, 4, 5, 6];
const WEEKS_OPTIONS = [4, 8, 12, 16];

const STEP_TITLES = ['Your goal', 'Focus areas', 'Equipment', 'Days per week', 'Plan length', 'Review & name'];

function autoName(goal, focus, days) {
  const goalObj = GOALS.find(g => g.id === goal);
  const focusStr = focus.length > 0 && focus.length <= 2 ? ` · ${focus.join('/')}` : '';
  return `${goalObj?.label || 'Custom'} ${days}×/wk${focusStr}`;
}

export default function PlanBuilder({ onClose }) {
  const { setActivePlan, saveCustomPlan, setHasMachines } = useApp();

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(null);
  const [focus, setFocus] = useState([]);
  const [builderHasMachines, setBuilderHasMachines] = useState(null);
  const [days, setDays] = useState(4);
  const [weeks, setWeeks] = useState(8);
  const [planName, setPlanName] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [nameEdited, setNameEdited] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState(null);

  function toggleFocus(group) {
    setFocus(prev =>
      prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
    );
  }

  function handleNext() {
    if ((step === 1 || step === 3) && !nameEdited) {
      setPlanName(autoName(goal, focus, days));
    }
    if (step === 4) {
      const plan = buildCustomPlan({
        goal, focus, daysPerWeek: days, weeks,
        name: planName || autoName(goal, focus, days),
        hasMachines: builderHasMachines !== false,
      });
      setGeneratedPlan(plan);
      if (!nameEdited) setPlanName(plan.name);
    }
    setStep(s => s + 1);
  }

  function handleBack() {
    setStep(s => s - 1);
  }

  function handleNameChange(e) {
    setPlanName(e.target.value);
    setNameEdited(true);
  }

  function handleStart() {
    const finalPlan = { ...generatedPlan, name: planName || generatedPlan.name };
    saveCustomPlan(finalPlan);
    const schedule = generateSchedule(finalPlan, startDate);
    setActivePlan({
      planId: finalPlan.id,
      planName: finalPlan.name,
      startDate,
      schedule,
      isCustom: true,
      exerciseTemplates: finalPlan.exerciseTemplates,
    });
    // Must come after setActivePlan, which clears hasMachines for the new plan —
    // the builder already asked, so the first workout shouldn't ask again.
    setHasMachines(builderHasMachines !== false);
    onClose();
  }

  const canNext = step === 0 ? goal !== null
    : step === 2 ? builderHasMachines !== null
    : true;

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet}>
        <div className={styles.handle} />

        {/* Progress dots */}
        <div className={styles.dots}>
          {STEP_TITLES.map((_, i) => (
            <div key={i} className={`${styles.dot}${i === step ? ' ' + styles.dotActive : i < step ? ' ' + styles.dotDone : ''}`} />
          ))}
        </div>

        <div className={styles.stepTitle}>{STEP_TITLES[step]}</div>

        {/* Step 0: Goal */}
        {step === 0 && (
          <div className={styles.goalGrid}>
            {GOALS.map(g => (
              <button
                key={g.id}
                className={`${styles.goalCard}${goal === g.id ? ' ' + styles.goalCardActive : ''}`}
                onClick={() => setGoal(g.id)}
              >
                <div className={styles.goalLabel}>{g.label}</div>
                <div className={styles.goalDesc}>{g.desc}</div>
              </button>
            ))}
          </div>
        )}

        {/* Step 1: Focus muscle groups */}
        {step === 1 && (
          <div>
            <div className={styles.stepSub}>Select all muscle groups you want to prioritise (optional)</div>
            <div className={styles.pillRow}>
              {MUSCLE_GROUPS.map(mg => (
                <button
                  key={mg}
                  className={`${styles.pill}${focus.includes(mg) ? ' ' + styles.pillActive : ''}`}
                  onClick={() => toggleFocus(mg)}
                >
                  {mg}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Equipment */}
        {step === 2 && (
          <div>
            <div className={styles.stepSub}>Do you have access to gym machines?</div>
            <div className={styles.stepSubHint}>e.g. leg press, pec deck, hack squat, cable machine</div>
            <div className={styles.equipRow}>
              <button
                className={`${styles.equipBtn}${builderHasMachines === true ? ' ' + styles.equipBtnActive : ''}`}
                onClick={() => setBuilderHasMachines(true)}
              >
                <div className={styles.equipBtnLabel}>Yes, I have machines</div>
                <div className={styles.equipBtnHint}>All exercises available</div>
              </button>
              <button
                className={`${styles.equipBtn}${builderHasMachines === false ? ' ' + styles.equipBtnActive : ''}`}
                onClick={() => setBuilderHasMachines(false)}
              >
                <div className={styles.equipBtnLabel}>No, dumbbells &amp; cables</div>
                <div className={styles.equipBtnHint}>Machine exercises replaced automatically</div>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Days per week */}
        {step === 3 && (
          <div>
            <div className={styles.stepSub}>How many days a week can you train?</div>
            <div className={styles.daysRow}>
              {DAYS_OPTIONS.map(d => (
                <button
                  key={d}
                  className={`${styles.dayBtn}${days === d ? ' ' + styles.dayBtnActive : ''}`}
                  onClick={() => setDays(d)}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className={styles.daysLabel}>{days} day{days !== 1 ? 's' : ''}/week</div>
          </div>
        )}

        {/* Step 4: Plan length */}
        {step === 4 && (
          <div>
            <div className={styles.stepSub}>How many weeks should the plan run?</div>
            <div className={styles.weeksRow}>
              {WEEKS_OPTIONS.map(w => (
                <button
                  key={w}
                  className={`${styles.weekBtn}${weeks === w ? ' ' + styles.weekBtnActive : ''}`}
                  onClick={() => setWeeks(w)}
                >
                  <span className={styles.weekNum}>{w}</span>
                  <span className={styles.weekLabel}>weeks</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && generatedPlan && (
          <div className={styles.review}>
            <div className={styles.nameField}>
              <label className={styles.nameLabel}>Plan name</label>
              <input
                className={styles.nameInput}
                value={planName}
                onChange={handleNameChange}
                placeholder="My custom plan"
              />
            </div>

            <div className={styles.summaryChips}>
              <div className={styles.summaryChip}>
                <div className={styles.chipVal}>{days}</div>
                <div className={styles.chipLbl}>Days/week</div>
              </div>
              <div className={styles.summaryChip}>
                <div className={styles.chipVal}>{weeks}</div>
                <div className={styles.chipLbl}>Weeks</div>
              </div>
              <div className={styles.summaryChip}>
                <div className={styles.chipVal}>{days * weeks}</div>
                <div className={styles.chipLbl}>Sessions</div>
              </div>
            </div>

            <div className={styles.templateList}>
              {Object.entries(generatedPlan.exerciseTemplates).map(([dayName, exercises]) => (
                <div key={dayName} className={styles.templateDay}>
                  <div className={styles.templateDayName}>{dayName}</div>
                  {exercises.map((ex, i) => (
                    <div key={i} className={styles.templateEx}>{ex.split(' — ')[0]}</div>
                  ))}
                </div>
              ))}
            </div>

            <div className={styles.startDateField}>
              <label className={styles.nameLabel}>Start date</label>
              <input
                type="date"
                className={styles.nameInput}
                value={startDate}
                min={todayISO()}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Nav buttons */}
        <div className={styles.navRow}>
          {step > 0 ? (
            <button className={styles.backBtn} onClick={handleBack}>Back</button>
          ) : (
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          )}
          {step < 5 ? (
            <button
              className={styles.nextBtn}
              disabled={!canNext}
              onClick={handleNext}
            >
              Next
            </button>
          ) : (
            <button className={styles.startBtn} onClick={handleStart}>
              Start plan
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
