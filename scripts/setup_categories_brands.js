const mysql = require('mysql2/promise');
const { databaseOptions } = require('./db-config');

async function setupCategoriesAndBrands() {
  const connection = await mysql.createConnection(databaseOptions());

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

    await connection.query(`CREATE TABLE IF NOT EXISTS sub_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      category_name VARCHAR(100) NOT NULL,
      name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY cat_subcat_idx (category_name, name)
    )`);
    await connection.query(`INSERT IGNORE INTO sub_categories (category_name, name)
      SELECT DISTINCT category, sub_category FROM products
      WHERE category IS NOT NULL AND category != '' AND sub_category IS NOT NULL AND sub_category != ''`);

    console.log('Categories and Brands successfully migrated to dedicated tables.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await connection.end();
  }
}

setupCategoriesAndBrands();
