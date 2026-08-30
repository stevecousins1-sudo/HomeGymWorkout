import { useState } from 'react';
import { auth, authStore } from '../../lib/api';
import styles from './Auth.module.css';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // { code, token, user } after sign-up or a reset. Nothing can retrieve the
  // code afterwards, so the session is held here until it is acknowledged.
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      if (mode === 'reset') {
        if (password !== passwordConfirm) {
          setError('Passwords do not match');
          setSubmitting(false);
          return;
        }
        const data = await auth.resetPassword(email, recoveryCode, password);
        setIssued({ code: data.recoveryCode, token: data.token, user: data.user });
        return;
      }
      if (mode === 'register') {
        if (password !== passwordConfirm) {
          setError('Passwords do not match');
          setSubmitting(false);
          return;
        }
        const data = await auth.register(email, password);
        setIssued({ code: data.recoveryCode, token: data.token, user: data.user });
        return;
      }
      await auth.login(email, password);
    } catch (err) {
      let msg = 'Something went wrong.';
      if (err?.status === 0 || !err?.status) {
        msg = 'Cannot reach the server — check your connection.';
      } else if (err?.message) {
        msg = err.message;
      }
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setSuccess('');
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(issued.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard blocked — the code is on screen to copy by hand */ }
  }

  // ── One-time recovery code ─────────────────────────────────────────────────
  // Sign-in is deferred until this is acknowledged: once past this screen the
  // code cannot be retrieved, only replaced.
  if (issued) {
    return (
      <div className={styles.screen}>
        <div className={styles.card}>
          <div className={styles.logoRow}>
            <div className={styles.logoIcon}>🔑</div>
            <div className={styles.appName}>Save your recovery code</div>
          </div>
          <p className={styles.codeIntro}>
            This is the only way back into your account if you forget your password.
            It is shown once and cannot be looked up later.
          </p>
          {/* Rendered as discrete groups so a narrow screen wraps between them
              rather than mid-group, which is easy to transcribe wrongly. */}
          <div className={styles.codeBox}>
            {issued.code.split('-').map((group, i) => (
              <span key={i} className={styles.codeGroup}>{group}</span>
            ))}
          </div>
          <button type="button" className={styles.codeCopyBtn} onClick={copyCode}>
            {copied ? '✓ Copied' : 'Copy code'}
          </button>
          <p className={styles.codeHint}>
            Keep it somewhere other than this phone — a password manager or a note
            you will still have if the phone is lost.
          </p>
          <button
            type="button"
            className={styles.submit}
            onClick={() => authStore.save(issued.token, issued.user)}
          >
            I've saved it — continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>🏋️</div>
          <div className={styles.appName}>Home Gym Workout</div>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab}${mode === 'login' ? ' ' + styles.activeTab : ''}`}
            onClick={() => switchMode('login')}
          >
            Sign in
          </button>
          <button
            className={`${styles.tab}${mode === 'register' ? ' ' + styles.activeTab : ''}`}
            onClick={() => switchMode('register')}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>
          {mode === 'reset' && (
            <div className={styles.field}>
              <label>Recovery code</label>
              <input
                type="text"
                value={recoveryCode}
                onChange={e => setRecoveryCode(e.target.value)}
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
                required
                autoCapitalize="characters"
                autoComplete="one-time-code"
                spellCheck="false"
              />
            </div>
          )}
          <div className={styles.field}>
            <label>{mode === 'reset' ? 'New password' : 'Password'}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          {(mode === 'register' || mode === 'reset') && (
            <div className={styles.field}>
              <label>Confirm password</label>
              <input
                type="password"
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
          )}
          {success && <div className={styles.success}>{success}</div>}
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? 'Please wait…'
              : mode === 'login' ? 'Sign in'
              : mode === 'reset' ? 'Reset password'
              : 'Create account'}
          </button>
        </form>

        {mode === 'login' && (
          <button type="button" className={styles.linkBtn} onClick={() => switchMode('reset')}>
            Forgot your password?
          </button>
        )}
        {mode === 'reset' && (
          <button type="button" className={styles.linkBtn} onClick={() => switchMode('login')}>
            ← Back to sign in
          </button>
        )}
      </div>
    </div>
  );
}
