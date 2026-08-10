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
  }

  try {
    console.log('Updating default user permissions...');
    await pool.query(
      `UPDATE users SET permissions = ?
       WHERE username = 'admin' AND (permissions IS NULL OR JSON_LENGTH(permissions) = 0)`,
      [JSON.stringify(['view_sales', 'manage_inventory', 'manage_products', 'manage_customers', 'view_reports', 'manage_users', 'pos_billing'])]
    );
    await pool.query(
      `UPDATE users SET permissions = ?
       WHERE username = 'cashier' AND (permissions IS NULL OR JSON_LENGTH(permissions) = 0)`,
      [JSON.stringify(['pos_billing'])]
    );
    console.log('Default permissions are ready.');
  } catch (err) {
    console.error('Error updating default permissions:', err);
  } finally {
    await pool.end();
  }
}

run();
