const mysql = require('mysql2/promise');
const { databaseOptions } = require('./db-config');

async function setupCustomers() {
  console.log('Connecting to MySQL...');
  
  const connection = await mysql.createConnection(databaseOptions());

  try {
    console.log('Creating customers table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        company_notes TEXT,
        customer_type VARCHAR(100) DEFAULT 'Regular Customer',
        status ENUM('Active', 'Inactive') DEFAULT 'Active',
        credit_limit DECIMAL(10, 2) DEFAULT 0.00,
        outstanding_balance DECIMAL(10, 2) DEFAULT 0.00,
        total_purchases DECIMAL(10, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Customers table ready. No demo customers added.');
  } catch (err) {
    console.error('Error creating customers table:', err);
  } finally {
    await connection.end();
  }
}

setupCustomers();
