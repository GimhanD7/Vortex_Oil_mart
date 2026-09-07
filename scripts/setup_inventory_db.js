const mysql = require('mysql2/promise');
const { databaseOptions } = require('./db-config');

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
  const connection = await mysql.createConnection(databaseOptions());

  try {
    const columns = {
      sku: "VARCHAR(100) NULL UNIQUE",
      barcode: "VARCHAR(100) NULL UNIQUE",
      category: "VARCHAR(100) NOT NULL DEFAULT 'Uncategorized'",
      sub_category: "VARCHAR(100) NOT NULL DEFAULT 'General'",
      brand: "VARCHAR(100) NOT NULL DEFAULT 'Generic'",
      product_type: "VARCHAR(30) NOT NULL DEFAULT 'packaged'",
      unit: "VARCHAR(20) NOT NULL DEFAULT 'Unit'",
      barrel_capacity_liters: "DECIMAL(10,3) NULL",
      reorder_level: "DECIMAL(12,3) NOT NULL DEFAULT 10",
      location: "VARCHAR(100) NOT NULL DEFAULT 'Main Store'",
      batch_no: "VARCHAR(100) NULL",
      supplier: "VARCHAR(150) NOT NULL DEFAULT 'Not Assigned'",
      updated_at: "TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    };

    for (const [name, definition] of Object.entries(columns)) {
      await ensureColumn(connection, 'products', name, definition);
    }

    await connection.query('ALTER TABLE products MODIFY COLUMN stock_quantity DECIMAL(12,3) NOT NULL DEFAULT 0');
    await connection.query('ALTER TABLE products MODIFY COLUMN reorder_level DECIMAL(12,3) NOT NULL DEFAULT 10');

    await ensureColumn(connection, 'sales', 'customer_id', 'INT NULL');
    await ensureColumn(connection, 'sales', 'payment_method', "VARCHAR(40) NOT NULL DEFAULT 'Cash'");
    await ensureColumn(connection, 'sales', 'status', "VARCHAR(30) NOT NULL DEFAULT 'completed'");

    await connection.query(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        movement_type ENUM('in', 'out', 'adjustment', 'sale') NOT NULL,
        quantity_change DECIMAL(12,3) NOT NULL,
        stock_before DECIMAL(12,3) NOT NULL,
        stock_after DECIMAL(12,3) NOT NULL,
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
    await connection.query('ALTER TABLE inventory_movements MODIFY COLUMN quantity_change DECIMAL(12,3) NOT NULL');
    await connection.query('ALTER TABLE inventory_movements MODIFY COLUMN stock_before DECIMAL(12,3) NOT NULL');
    await connection.query('ALTER TABLE inventory_movements MODIFY COLUMN stock_after DECIMAL(12,3) NOT NULL');

    await connection.query(`
      CREATE TABLE IF NOT EXISTS purchase_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        purchase_id INT NOT NULL,
        product_id INT NOT NULL,
        quantity DECIMAL(12,3) NOT NULL,
        purchase_unit VARCHAR(20) NOT NULL DEFAULT 'Unit',
        barrel_count DECIMAL(10,3) NULL,
        barrel_capacity_liters DECIMAL(10,3) NULL,
        unit_cost DECIMAL(10,2) NOT NULL,
        CONSTRAINT fk_purchase_item_purchase FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
        CONSTRAINT fk_purchase_item_product FOREIGN KEY (product_id) REFERENCES products(id)
      )
    `);
    await connection.query('ALTER TABLE purchase_items MODIFY COLUMN quantity DECIMAL(12,3) NOT NULL');
    await ensureColumn(connection, 'purchase_items', 'purchase_unit', "VARCHAR(20) NOT NULL DEFAULT 'Unit'");
    await ensureColumn(connection, 'purchase_items', 'barrel_count', 'DECIMAL(10,3) NULL');
    await ensureColumn(connection, 'purchase_items', 'barrel_capacity_liters', 'DECIMAL(10,3) NULL');
    await connection.query('ALTER TABLE sale_items MODIFY COLUMN quantity DECIMAL(12,3) NOT NULL');

    console.log('Inventory database migration completed.');
  } finally {
    await connection.end();
  }
}

setupInventory().catch((error) => {
  console.error('Inventory migration failed:', error);
  process.exitCode = 1;
});
