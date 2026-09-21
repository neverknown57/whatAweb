const { Pool } = require('pg');
require('dotenv').config();
console.log("hek")
console.log(process.env.DATABASE_URL)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle Postgres client', err);
});
(async () => {
  try {
    const res = await pool.query('SELECT current_database();');
    console.log('Connected to DB:', res.rows[0].current_database);
    console.log('Initializing database schema...');
  } catch (err) {
    console.error('Error connecting to DB:', err);
  } finally {
    console.log("end");
    // await pool.end(); // optional: close pool when done
  }
})();
console.log("end")
module.exports = pool;
