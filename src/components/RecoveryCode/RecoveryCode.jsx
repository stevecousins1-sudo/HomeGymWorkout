import { useState } from 'react';
import styles from './RecoveryCode.module.css';

/**
 * A freshly issued recovery code, with a copy button and advice on keeping it.
 *
 * Shared by sign-up, password reset and the signed-in "new code" sheet, so a
 * code always looks and copies the same way wherever it is shown.
 */
export default function RecoveryCode({ code }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard blocked — the code is on screen to copy by hand */ }
  }

  return (
    <>
      {/* Rendered as discrete groups so a narrow screen wraps between them
          rather than mid-group, which is easy to transcribe wrongly. */}
      <div className={styles.codeBox}>
        {code.split('-').map((group, i) => (
          <span key={i} className={styles.codeGroup}>{group}</span>
        ))}
      </div>
      <button type="button" className={styles.copyBtn} onClick={copy}>
        {copied ? '✓ Copied' : 'Copy code'}
      </button>
      <p className={styles.hint}>
        Keep it somewhere other than this phone — a password manager or a note
        you will still have if the phone is lost.
      </p>
    </>
  );
}
