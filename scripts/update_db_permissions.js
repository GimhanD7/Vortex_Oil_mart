const mysql = require('mysql2/promise');

async function run() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'oil_mart',
  });

  try {
    console.log('Adding permissions column to users table...');
    await pool.query('ALTER TABLE users ADD COLUMN permissions JSON NULL');
    console.log('Successfully altered users table.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('permissions column already exists, skipping.');
    } else {
      console.error('Error altering table:', err);
    }
  } finally {
    await pool.end();
  }
}

run();
