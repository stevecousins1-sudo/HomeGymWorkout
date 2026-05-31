import { useState } from 'react';
import pb from '../../lib/pb';
import styles from './Auth.module.css';

export default function Auth() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      if (mode === 'register') {
        await pb.collection('users').create({ email, password, passwordConfirm });
        // Registration succeeded — switch to login and prompt user to sign in
        setSuccess('Account created! Please sign in below.');
        setMode('login');
        setPassword('');
        setPasswordConfirm('');
        setSubmitting(false);
        return;
      }
      await pb.collection('users').authWithPassword(email, password);
    } catch (err) {
      console.error('[Auth] error:', err);
      let msg = 'Something went wrong.';
      if (err?.status === 0) {
        msg = 'Cannot reach the server — check your connection.';
      } else if (err?.response?.message) {
        msg = err.response.message;
      } else if (err?.message) {
        msg = err.message;
      }
      // Show data field errors if present (e.g. "password too short")
      const data = err?.response?.data;
      if (data) {
        const fieldErrors = Object.entries(data)
          .map(([k, v]) => `${k}: ${v?.message ?? v}`)
          .join('; ');
        if (fieldErrors) msg += ` — ${fieldErrors}`;
      }
      setError(`${msg} (status: ${err?.status ?? 'network'})`);
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setSuccess('');
  }

  const pbUrl = import.meta.env.VITE_PB_URL || 'http://localhost:8090';

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
          <div className={styles.field}>
            <label>Password</label>
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
          {mode === 'register' && (
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
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        {error && (
          <div className={styles.debugUrl}>API: {pbUrl}</div>
        )}
      </div>
    </div>
  );
}
