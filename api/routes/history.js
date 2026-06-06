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
  const { entry_date, name, day_name, duration, volume, sets, exercises } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO history (user_id, entry_date, name, day_name, duration, volume, sets, exercises)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, entry_date, name, day_name || name, duration || 0, volume || 0, sets || 0, JSON.stringify(exercises || [])]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM history WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
