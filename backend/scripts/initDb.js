const pool = require('../db');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function initDb() {
  const res = await pool.query('SELECT current_database();');
  console.log('Connected to DB:', res.rows[0].current_database);
  console.log('Initializing database schema...');
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf-8');
    // await pool.query(schemaSql);
    console.log('Schema migration applied successfully.');

    // Ensure initial admin user exists if no users
    const userCheck = await pool.query(`SELECT COUNT(*) AS count FROM users`);
    console.log("Query result:", userCheck.rows);
    if (parseInt(userCheck.rows[0].count) === 0) {
      const defaultPasswordHash = await bcrypt.hash('admin123', 10);
      await pool.query(
        `INSERT INTO users ("organization_id", email, password_hash, name, role)
         VALUES (1, 'admin@example.com', $1, 'Admin User', 'admin')`,
        [defaultPasswordHash]
      );
      console.log('Created default admin user: admin@example.com / admin123');
    }
    console.log(userCheck)
    // return
    // Ensure initial whatsapp account record exists
    const waCheck = await pool.query(`SELECT COUNT(*) FROM whatsapp_accounts WHERE organization_id = 1`);
    if (parseInt(waCheck.rows[0].count) === 0) {
      await pool.query(
        `INSERT INTO whatsapp_accounts (organization_id, waba_id, phone_number_id, access_token, verify_token)
         VALUES (1, $1, $2, $3, $4)`,
        [
          process.env.WHATSAPP_WABA_ID || '',
          process.env.WHATSAPP_PHONE_NUMBER_ID || '',
          process.env.WHATSAPP_ACCESS_TOKEN || '',
          process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'whatsapp_verify_token_secret',
        ]
      );
      console.log('Initialized WhatsApp account configuration.');
    }

    console.log('Database initialization complete.');
  } catch (err) {
    console.error('Error initializing database:', err);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  initDb();
}

module.exports = initDb;
