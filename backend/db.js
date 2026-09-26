const { Pool } = require('pg');
require('dotenv').config();
console.log("hek")
console.log(process.env.DATABASE_URL)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false   // Aiven requires SSL, but you can skip cert validation
  },
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});
(async () => {
  try {
    const res = await pool.query('SELECT current_database();');
    console.log('Connected to DB:', res.rows[0].current_database);
    console.log('Initializing database schema & auto-migrations...');

    // Auto-migrate schema updates
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL;`);
    await pool.query(`ALTER TABLE templates ADD COLUMN IF NOT EXISTS default_parameter_mapping JSONB DEFAULT '{}'::jsonb;`);
    console.log('Database schema & auto-migrations initialized successfully.');
  } catch (err) {
    console.error('Error initializing DB schema:', err);
  }
})();
console.log("end")
module.exports = pool;
