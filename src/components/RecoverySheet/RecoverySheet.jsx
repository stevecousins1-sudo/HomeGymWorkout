import { useState } from 'react';
import { auth, authStore } from '../../lib/api';
import RecoveryCode from '../RecoveryCode/RecoveryCode';
import styles from './RecoverySheet.module.css';

/**
 * Issue a recovery code while signed in.
 *
 * Needed by every account created before recovery codes existed — those have
 * no code at all, so "Forgot your password?" can never succeed for them — and
 * by anyone who has lost the one they were given. Issuing a code always
 * replaces the previous one; codes are only stored hashed, so an existing one
 * can't be shown again.
 */
export default function RecoverySheet({ hasCode, onClose }) {
  const [code, setCode]       = useState(null);
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');

  async function issue() {
    setBusy(true);
    setError('');
    try {
      const { recoveryCode } = await auth.newRecoveryCode();
      setCode(recoveryCode);
      // The server has already swapped the hash, so the account now has a code
      // whatever happens next — reflect that so the prompt goes away.
      authStore.save(authStore.token, { ...authStore.model, hasRecoveryCode: true });
    } catch (err) {
      setError(err?.status
        ? (err.message || 'Could not create a code.')
        : 'Cannot reach the server — a new code needs a connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* A shown code is the only copy that will ever exist, so don't let a
          stray tap on the backdrop throw it away. */}
      <div className={styles.backdrop} onClick={code ? undefined : onClose} />
      <div className={styles.sheet} role="dialog" aria-label="Recovery code">
        <div className={styles.header}>
          <span className={styles.title}>Recovery code</span>
          {!code && <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>}
        </div>

        <div className={styles.body}>
          {code ? (
            <>
              <p className={styles.intro}>
                This replaces any code you had before. It is shown once and
                cannot be looked up later.
              </p>
              <RecoveryCode code={code} />
            </>
          ) : (
            <>
              <p className={styles.intro}>
                If you forget your password, your email and this code are the
                only way back into your account and your training history.
              </p>
              {hasCode ? (
                <p className={styles.warning}>
                  You already have a code. Creating a new one stops the old one
                  working.
                </p>
              ) : (
                <p className={styles.warning}>
                  Your account doesn't have one yet, so a forgotten password
                  can't currently be reset.
                </p>
              )}
              {error && <p className={styles.error}>{error}</p>}
            </>
          )}
        </div>

        <div className={styles.actions}>
          {code ? (
            <button className={styles.primary} onClick={onClose}>I've saved it</button>
          ) : (
            <button className={styles.primary} onClick={issue} disabled={busy}>
              {busy ? 'Creating…' : hasCode ? 'Create a new code' : 'Create my recovery code'}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
