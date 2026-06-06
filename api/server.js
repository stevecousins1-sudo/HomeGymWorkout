const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const authRoutes = require('./routes/auth');
const historyRoutes = require('./routes/history');
const settingsRoutes = require('./routes/settings');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/settings', settingsRoutes);

const PORT = process.env.PORT || 3000;

initDb()
  .then(() => app.listen(PORT, () => console.log(`API listening on port ${PORT}`)))
  .catch(err => { console.error('DB init failed:', err); process.exit(1); });
