const mysql = require('mysql2/promise');

async function setupCategoriesAndBrands() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'oil_mart',
  });

  try {
    // Create Categories Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Brands Table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS brands (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migrate existing data from products
    const [existingCategories] = await connection.query(`SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != ''`);
    for (const row of existingCategories) {
      await connection.query(`INSERT IGNORE INTO categories (name) VALUES (?)`, [row.category]);
    }

    const [existingBrands] = await connection.query(`SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand != ''`);
    for (const row of existingBrands) {
      await connection.query(`INSERT IGNORE INTO brands (name) VALUES (?)`, [row.brand]);
    }

    // Default categories if missing
    const defaultCats = ["Engine Oils", "Gear Oils", "Lubricants", "Filters", "Brake Pads", "Batteries", "Spark Plugs", "General"];
    for (const c of defaultCats) {
      await connection.query(`INSERT IGNORE INTO categories (name) VALUES (?)`, [c]);
    }

    const defaultBrands = ["Shell India", "ExxonMobil", "Castrol India", "Bosch Ltd.", "Amaron", "Brembo India", "NGK India", "Mann+Hummel", "Generic"];
    for (const b of defaultBrands) {
      await connection.query(`INSERT IGNORE INTO brands (name) VALUES (?)`, [b]);
    }

    console.log('Categories and Brands successfully migrated to dedicated tables.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await connection.end();
  }
}

setupCategoriesAndBrands();
