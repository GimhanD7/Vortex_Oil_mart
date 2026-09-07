const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { databaseOptions } = require('./db-config');

async function setup() {
  console.log('Connecting to MySQL...');
  
  // Connect without a specific database first to create it if it doesn't exist
  const config = databaseOptions();
  const connection = await mysql.createConnection({ ...config, database: undefined });

  try {
    console.log('Preparing the configured database...');
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${mysql.escapeId(config.database)}`);
    await connection.query(`USE ${mysql.escapeId(config.database)}`);

    console.log('Creating users table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'cashier') DEFAULT 'cashier',
        permissions JSON NULL,
        full_name VARCHAR(150) NULL,
        address VARCHAR(500) NULL,
        phone VARCHAR(30) NULL,
        id_number VARCHAR(80) NULL,
        employment_start_date DATE NULL,
        employment_end_date DATE NULL,
        employment_status VARCHAR(20) NOT NULL DEFAULT 'active',
        employee_notes VARCHAR(1000) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    try {
      await connection.query('ALTER TABLE users ADD COLUMN permissions JSON NULL');
    } catch (err) {
      if (err.code !== 'ER_DUP_FIELDNAME') throw err;
    }

    console.log('Creating products table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        stock_quantity DECIMAL(12,3) DEFAULT 0,
        sku VARCHAR(100) UNIQUE,
        barcode VARCHAR(100) UNIQUE,
        category VARCHAR(100) NOT NULL DEFAULT 'Uncategorized',
        sub_category VARCHAR(100) NOT NULL DEFAULT 'General',
        brand VARCHAR(100) NOT NULL DEFAULT 'Generic',
        product_type VARCHAR(30) NOT NULL DEFAULT 'packaged',
        unit VARCHAR(20) NOT NULL DEFAULT 'Unit',
        barrel_capacity_liters DECIMAL(10,3) NULL,
        reorder_level DECIMAL(12,3) NOT NULL DEFAULT 10,
        location VARCHAR(100) NOT NULL DEFAULT 'Main Store',
        batch_no VARCHAR(100),
        supplier VARCHAR(150) NOT NULL DEFAULT 'Not Assigned',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating sales table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cashier_id INT NOT NULL,
        customer_id INT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        payment_method VARCHAR(40) NOT NULL DEFAULT 'Cash',
        status VARCHAR(30) NOT NULL DEFAULT 'completed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (cashier_id) REFERENCES users(id)
      )
    `);

    console.log('Creating sale_items table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sale_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity DECIMAL(12,3) NOT NULL,
        purchase_unit VARCHAR(20) NOT NULL DEFAULT 'Unit',
        barrel_count DECIMAL(10,3) NULL,
        barrel_capacity_liters DECIMAL(10,3) NULL,
        price_at_time DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    console.log('Creating inventory movements table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        movement_type ENUM('in', 'out', 'adjustment', 'sale') NOT NULL,
        quantity_change DECIMAL(12,3) NOT NULL,
        stock_before DECIMAL(12,3) NOT NULL,
        stock_after DECIMAL(12,3) NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        reference_no VARCHAR(100),
        notes VARCHAR(500),
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_inventory_product (product_id),
        INDEX idx_inventory_created (created_at),
        FOREIGN KEY (product_id) REFERENCES products(id),
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    console.log('Creating purchases tables...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        supplier VARCHAR(150) NOT NULL,
        payment_method VARCHAR(40) NOT NULL DEFAULT 'Cash',
        total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'received',
        notes VARCHAR(500),
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity DECIMAL(12,3) NOT NULL,
        unit_cost DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    for (const role of ['admin', 'cashier']) {
      const prefix = `INITIAL_${role.toUpperCase()}`;
      const username = process.env[`${prefix}_USERNAME`];
      const password = process.env[`${prefix}_PASSWORD`];
      if (!username && !password) continue;
      if (!username || !password || password.length < 12 || Buffer.byteLength(password) > 72) throw new Error(`${prefix} requires a username and a password between 12 and 72 bytes.`);
      const [existing] = await connection.query('SELECT id FROM users WHERE username = ?', [username]);
      if (existing.length) continue;
      const permissions = role === 'admin' ? ['view_sales', 'manage_inventory', 'manage_products', 'manage_customers', 'view_reports', 'manage_users', 'manage_settings', 'pos_billing', 'view_inventory'] : ['pos_billing', 'view_inventory'];
      await connection.query('INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)', [username, await bcrypt.hash(password, 12), role, JSON.stringify(permissions)]);
      console.log(`Created configured ${role} account.`);
    }

    console.log('Database setup complete!');
  } catch (err) {
    console.error('Error setting up database:', err);
  } finally {
    await connection.end();
  }
}

setup();
