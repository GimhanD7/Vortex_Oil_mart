const mysql = require('mysql2/promise');

async function ensureColumn(connection, table, name, definition) {
  const [rows] = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, name]
  );
  if (rows.length === 0) {
    await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
  }
}

async function setupInventory() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'oil_mart',
  });

  try {
    const columns = {
      sku: "VARCHAR(100) NULL UNIQUE",
      barcode: "VARCHAR(100) NULL UNIQUE",
      category: "VARCHAR(100) NOT NULL DEFAULT 'Uncategorized'",
      brand: "VARCHAR(100) NOT NULL DEFAULT 'Generic'",
      reorder_level: "INT NOT NULL DEFAULT 10",
      location: "VARCHAR(100) NOT NULL DEFAULT 'Main Store'",
      batch_no: "VARCHAR(100) NULL",
      supplier: "VARCHAR(150) NOT NULL DEFAULT 'Not Assigned'",
      updated_at: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    };

    for (const [name, definition] of Object.entries(columns)) {
      await ensureColumn(connection, 'products', name, definition);
    }

    await ensureColumn(connection, 'sales', 'customer_id', 'INT NULL');
    await ensureColumn(connection, 'sales', 'payment_method', "VARCHAR(40) NOT NULL DEFAULT 'Cash'");
    await ensureColumn(connection, 'sales', 'status', "VARCHAR(30) NOT NULL DEFAULT 'completed'");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        movement_type ENUM('in', 'out', 'adjustment', 'sale') NOT NULL,
        quantity_change INT NOT NULL,
        stock_before INT NOT NULL,
        stock_after INT NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        reference_no VARCHAR(100) NULL,
        notes VARCHAR(500) NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_inventory_product (product_id),
        INDEX idx_inventory_created (created_at),
        CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products(id),
        CONSTRAINT fk_inventory_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`UPDATE products SET sku = CONCAT('SKU-', LPAD(id, 5, '0')) WHERE sku IS NULL OR sku = ''`);
    await connection.query(`UPDATE products SET barcode = CONCAT('89010409', LPAD(id, 5, '0')) WHERE barcode IS NULL OR barcode = ''`);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        supplier VARCHAR(150) NOT NULL,
        payment_method VARCHAR(40) NOT NULL DEFAULT 'Cash',
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        status VARCHAR(30) NOT NULL DEFAULT 'received',
        notes VARCHAR(500) NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_purchase_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity INT NOT NULL,
        unit_cost DECIMAL(10,2) NOT NULL,
        CONSTRAINT fk_purchase_item_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
        CONSTRAINT fk_purchase_item_product FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);

    const [productCount] = await connection.query('SELECT COUNT(*) AS count FROM products');
    if (Number(productCount[0].count) === 0) {
      const seedProducts = [
        ['Shell Helix Ultra 5W-40 4L', 'Engine oil', 2650, 64, 'SHL-UL-5W40-4L', '8901040900001', 'Engine Oils', 'Shell India', 10, 'Warehouse A', 'BATCH-2405-001', 'Shell India'],
        ['Castrol EDGE 5W-30 4L', 'Engine oil', 2450, 48, 'CST-EDGE-5W30-4L', '8901040900002', 'Engine Oils', 'Castrol India', 10, 'Main Store', 'BATCH-2405-002', 'Castrol India'],
        ['Bosch Oil Filter P7150', 'Oil filter', 250, 40, 'BOS-P7150', '8901040900003', 'Filters', 'Bosch Ltd.', 10, 'Main Store', 'BATCH-2405-003', 'Bosch Ltd.'],
        ['Brake Pad Set (Front)', 'Brake pads', 1250, 4, 'BRK-PAD-FRT-SDZ', '8901040900004', 'Brake System', 'Brembo India', 10, 'Warehouse A', 'BATCH-2405-004', 'Brembo India'],
        ['Amaron Go Battery 55B24L', 'Battery', 4850, 24, 'AMR-55B24L', '8901040900005', 'Batteries', 'Amaron', 8, 'Main Store', 'BATCH-2405-005', 'Amaron'],
        ['NGK Spark Plug SILZKR7B11', 'Spark plug', 180, 32, 'NGK-SILZKR7B11', '8901040900006', 'Spark Plugs', 'NGK India', 10, 'Main Store', 'BATCH-2405-006', 'NGK India'],
        ['Mobil 1 5W-40 4L', 'Engine oil', 2600, 0, 'MOB1-5W40-4L', '8901040900007', 'Engine Oils', 'ExxonMobil', 10, 'Warehouse A', null, 'ExxonMobil'],
        ['Air Filter Hyundai i20', 'Air filter', 650, 16, 'AIR-FT-HYN-I20', '8901040900008', 'Filters', 'Mann+Hummel', 5, 'Main Store', 'BATCH-2405-007', 'Mann+Hummel'],
      ];
      for (const product of seedProducts) {
        const [result] = await connection.query(
          `INSERT INTO products
           (name, description, price, stock_quantity, sku, barcode, category, brand, reorder_level, location, batch_no, supplier)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          product
        );
        if (Number(product[3]) > 0) {
          await connection.query(
            `INSERT INTO inventory_movements
             (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes)
             VALUES (?, 'in', ?, 0, ?, ?, 'INITIAL-STOCK', 'Initial inventory seed')`,
            [result.insertId, product[3], product[3], product[2]]
          );
        }
      }
      console.log('Seeded initial Oil Mart inventory.');
    }
    console.log('Inventory database migration completed.');
  } finally {
    await connection.end();
  }
}

setupInventory().catch((error) => {
  console.error('Inventory migration failed:', error);
  process.exitCode = 1;
});
