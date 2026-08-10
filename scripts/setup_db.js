const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function setup() {
  console.log('Connecting to MySQL...');
  
  // Connect without a specific database first to create it if it doesn't exist
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
  });

  try {
    console.log('Creating database oil_mart if not exists...');
    await connection.query('CREATE DATABASE IF NOT EXISTS oil_mart;');
    await connection.query('USE oil_mart;');

    console.log('Creating users table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        role ENUM('admin', 'cashier') DEFAULT 'cashier',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Creating products table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10, 2) NOT NULL,
        stock_quantity INT DEFAULT 0,
        sku VARCHAR(100) UNIQUE,
        barcode VARCHAR(100) UNIQUE,
        category VARCHAR(100) NOT NULL DEFAULT 'Uncategorized',
        brand VARCHAR(100) NOT NULL DEFAULT 'Generic',
        reorder_level INT NOT NULL DEFAULT 10,
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
        quantity INT NOT NULL,
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
        quantity_change INT NOT NULL,
        stock_before INT NOT NULL,
        stock_after INT NOT NULL,
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
        quantity INT NOT NULL,
        unit_cost DECIMAL(10, 2) NOT NULL,
        FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    // Insert default admin user if not exists
    const [rows] = await connection.query('SELECT * FROM users WHERE username = "admin"');
    if (rows.length === 0) {
      console.log('Creating default admin user...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      await connection.query(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        ['admin', hashedPassword, 'admin']
      );
      console.log('Default admin created: admin / admin123');
    }

    // Insert default cashier user if not exists
    const [cashierRows] = await connection.query('SELECT * FROM users WHERE username = "cashier"');
    if (cashierRows.length === 0) {
      console.log('Creating default cashier user...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('cashier123', salt);
      await connection.query(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        ['cashier', hashedPassword, 'cashier']
      );
      console.log('Default cashier created: cashier / cashier123');
    }

    console.log('Database setup complete!');
  } catch (err) {
    console.error('Error setting up database:', err);
  } finally {
    await connection.end();
  }
}

setup();
