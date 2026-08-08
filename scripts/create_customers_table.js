const mysql = require('mysql2/promise');

async function setupCustomers() {
  console.log('Connecting to MySQL...');
  
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'oil_mart',
  });

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
    
    // Add some mock data to verify it works
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM customers');
    if (rows[0].count === 0) {
      console.log('Seeding initial customer data...');
      await connection.query(`
        INSERT INTO customers (name, phone, email, address, company_notes, customer_type, status, credit_limit, outstanding_balance, total_purchases)
        VALUES 
        ('Rahul Sharma', '+91 98765 43210', 'rahul@example.com', '123, Mathura Road, New Delhi - 110002', 'Sharma Motors', 'Workshop', 'Active', 50000.00, 12450.00, 185420.00),
        ('Amit Singh', '+91 98765 43211', 'amit@example.com', '45, Patel Nagar, New Delhi - 110008', 'Auto Works', 'Regular Customer', 'Active', 0.00, 3200.00, 95300.00),
        ('Vikas Verma', '+91 98765 43212', 'vikas@example.com', '78, Karol Bagh, New Delhi - 110005', 'Verma Autos', 'Fleet: 3 Vehicles', 'Active', 100000.00, 0.00, 75650.00)
      `);
    }

    console.log('Customers table created and seeded successfully!');
  } catch (err) {
    console.error('Error creating customers table:', err);
  } finally {
    await connection.end();
  }
}

setupCustomers();
