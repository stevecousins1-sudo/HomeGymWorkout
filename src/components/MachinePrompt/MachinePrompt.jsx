import styles from './MachinePrompt.module.css';

export default function MachinePrompt({ onAnswer }) {
  return (
    <>
      <div className={styles.backdrop} />
      <div className={styles.sheet}>
        <div className={styles.handle} />
        <div className={styles.title}>Do you have gym machines?</div>
        <div className={styles.subtitle}>e.g. leg press, pec deck, hack squat</div>
        <div className={styles.btnGroup}>
          <button className={styles.btnYes} onClick={() => onAnswer(true)}>
            Yes — I have machines
          </button>
          <button className={styles.btnNo} onClick={() => onAnswer(false)}>
            No — dumbbells &amp; cables only
          </button>
        </div>
        <div className={styles.hint}>Your answer is saved for this plan</div>
      </div>
    </>
  );
}
