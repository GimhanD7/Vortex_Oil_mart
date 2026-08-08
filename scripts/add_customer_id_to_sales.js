const mysql = require('mysql2/promise');

async function updateSalesTable() {
  console.log('Connecting to MySQL...');
  
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'oil_mart',
  });

  try {
    console.log('Adding customer_id to sales table...');
    await connection.query(`
      ALTER TABLE sales 
      ADD COLUMN customer_id INT NULL AFTER cashier_id,
      ADD CONSTRAINT fk_sales_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
    `);
    
    console.log('Successfully updated sales table with customer_id!');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('customer_id column already exists, skipping.');
    } else {
      console.error('Error updating sales table:', err);
    }
  } finally {
    await connection.end();
  }
}

updateSalesTable();
