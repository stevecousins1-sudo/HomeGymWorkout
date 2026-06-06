const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entry_date TEXT NOT NULL,
      name TEXT NOT NULL,
      day_name TEXT,
      duration INTEGER DEFAULT 0,
      volume NUMERIC DEFAULT 0,
      sets INTEGER DEFAULT 0,
      exercises JSONB DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      active_plan JSONB,
      unit_prefs JSONB DEFAULT '{}',
      global_unit TEXT DEFAULT 'lb',
      rest_prefs JSONB DEFAULT '{}',
      custom_movements JSONB DEFAULT '[]',
      templates JSONB DEFAULT '[]'
    );
    ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS custom_movements JSONB DEFAULT '[]';
    ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS templates JSONB DEFAULT '[]';
    ALTER TABLE history ADD COLUMN IF NOT EXISTS notes TEXT;
  `);
  console.log('Database ready');
}

module.exports = { pool, initDb };
