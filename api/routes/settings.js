const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM user_settings WHERE user_id = $1', [req.user.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const { active_plan, unit_prefs, global_unit, rest_prefs, custom_movements, templates, custom_plans } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO user_settings (user_id, active_plan, unit_prefs, global_unit, rest_prefs, custom_movements, templates, custom_plans)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id) DO UPDATE SET
         active_plan = EXCLUDED.active_plan,
         unit_prefs = EXCLUDED.unit_prefs,
         global_unit = EXCLUDED.global_unit,
         rest_prefs = EXCLUDED.rest_prefs,
         custom_movements = EXCLUDED.custom_movements,
         templates = EXCLUDED.templates,
         custom_plans = EXCLUDED.custom_plans
       RETURNING *`,
      [req.user.id, JSON.stringify(active_plan ?? null), JSON.stringify(unit_prefs || {}), global_unit || 'lb', JSON.stringify(rest_prefs || {}), JSON.stringify(custom_movements || []), JSON.stringify(templates || []), JSON.stringify(custom_plans || [])]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/', async (req, res) => {
  const allowed = ['active_plan', 'unit_prefs', 'global_unit', 'rest_prefs', 'custom_movements', 'templates', 'custom_plans', 'body_weight_log', 'theme', 'has_machines'];
  const updates = [];
  const values = [];
  let i = 1;
  for (const key of allowed) {
    if (key in req.body) {
      updates.push(`${key} = $${i}`);
      values.push(['global_unit', 'theme'].includes(key) ? req.body[key] : JSON.stringify(req.body[key]));
      i++;
    }
  }
  if (updates.length === 0) return res.status(400).json({ error: 'Nothing to update' });
  values.push(req.user.id);
  try {
    const result = await pool.query(
      `UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = $${i} RETURNING *`,
      values
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Settings not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
