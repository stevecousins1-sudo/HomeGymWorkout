import styles from './RotateGuard.module.css';

/**
 * Portrait-only guard.
 *
 * iOS home-screen web apps cannot lock orientation: the manifest's
 * `orientation` member is ignored, and `screen.orientation.lock()` is not
 * implemented in Safari. The only thing a web app can do is decline to render
 * sideways, so this covers the screen until the phone comes back upright.
 *
 * Shown purely by media query — no resize listeners, no re-renders mid-set.
 */
export default function RotateGuard() {
  return (
    <div className={styles.guard} aria-hidden="true">
      <svg
        className={styles.icon}
        viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <line x1="10.5" y1="18.5" x2="13.5" y2="18.5" />
      </svg>
      <div className={styles.title}>Turn your phone upright</div>
      <div className={styles.subtitle}>This app is designed for portrait.</div>
    </div>
  );
}
