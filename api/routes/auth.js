const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function makeToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// Crockford base32: no I, L, O or U, so the code survives being copied off a
// screen by hand without 1/I or 0/O confusion.
const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * A one-time recovery code, formatted in groups for legibility.
 *
 * 20 characters of a 32-symbol alphabet is 100 bits of entropy. There is no
 * rate limiting on this API, so the code has to be strong enough that guessing
 * it stays infeasible without one.
 */
function generateRecoveryCode() {
  const bytes = crypto.randomBytes(20);
  const chars = [...bytes].map(b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  return chars.match(/.{1,5}/g).join('-');
}

/** Codes are compared case- and separator-insensitively. */
function normaliseCode(code) {
  return String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
}

async function issueRecoveryCode(userId) {
  const code = generateRecoveryCode();
  const hash = await bcrypt.hash(normaliseCode(code), 12);
  await pool.query('UPDATE users SET recovery_code_hash = $1 WHERE id = $2', [hash, userId]);
  return code;
}

router.post('/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email.toLowerCase().trim(), hash]
    );
    const user = result.rows[0];
    // Returned exactly once — it is only ever stored hashed.
    const recoveryCode = await issueRecoveryCode(user.id);
    res.status(201).json({
      token: makeToken(user),
      user: { id: user.id, email: user.email },
      recoveryCode,
    });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already in use' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/** Issue a fresh code, invalidating the previous one. */
router.post('/recovery-code', requireAuth, async (req, res) => {
  try {
    const recoveryCode = await issueRecoveryCode(req.user.id);
    res.json({ recoveryCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/reset-password', async (req, res) => {
  const { email, code, password } = req.body;
  if (!email || !code || !password) {
    return res.status(400).json({ error: 'Email, recovery code and new password required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = result.rows[0];
    // One message for every failure, so this can't be used to discover which
    // addresses have accounts.
    const invalid = { error: 'That email and recovery code do not match' };
    if (!user || !user.recovery_code_hash) return res.status(401).json(invalid);
    if (!await bcrypt.compare(normaliseCode(code), user.recovery_code_hash)) {
      return res.status(401).json(invalid);
    }

    const hash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, user.id]);
    // The used code is spent; hand back its replacement in the same breath so
    // the user is never left without one.
    const recoveryCode = await issueRecoveryCode(user.id);
    res.json({
      token: makeToken(user),
      user: { id: user.id, email: user.email },
      recoveryCode,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = result.rows[0];
    if (!user || !await bcrypt.compare(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ token: makeToken(user), user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/refresh', requireAuth, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ token: makeToken(user), user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
