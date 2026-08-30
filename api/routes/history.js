const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM history WHERE user_id = $1 ORDER BY entry_date DESC, created_at DESC',
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const { entry_date, name, day_name, duration, volume, sets, exercises, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO history (user_id, entry_date, name, day_name, duration, volume, sets, exercises, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.user.id, entry_date, name, day_name || name, duration || 0, volume || 0, sets || 0, JSON.stringify(exercises || []), notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Optimistic rows carry a client-side id until their create syncs. Postgres
// throws on a malformed uuid, so treat anything else as simply not found.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.put('/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  const { entry_date, name, day_name, duration, volume, sets, exercises, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE history
          SET entry_date = $1, name = $2, day_name = $3, duration = $4,
              volume = $5, sets = $6, exercises = $7, notes = $8
        WHERE id = $9 AND user_id = $10
        RETURNING *`,
      [entry_date, name, day_name || name, duration || 0, volume || 0, sets || 0,
       JSON.stringify(exercises || []), notes || null, req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(404).json({ error: 'Not found' });
  try {
    await pool.query('DELETE FROM history WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
