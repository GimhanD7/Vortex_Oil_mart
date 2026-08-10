/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';

function databaseError(error: unknown) {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : '';
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || error instanceof AggregateError) {
    return NextResponse.json(
      { error: 'Inventory database is unavailable. Start MySQL on 127.0.0.1:3306 and run npm run db:inventory.' },
      { status: 503 }
    );
  }
  return NextResponse.json({ error: 'Unable to access inventory data' }, { status: 500 });
}

export const dynamic = 'force-dynamic';

async function ensureInventoryMovementTable(connection: PoolConnection | typeof pool = pool) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS inventory_movements (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_id INT NOT NULL,
      movement_type ENUM('in', 'out', 'adjustment', 'sale', 'purchase') NOT NULL,
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
}

export async function GET() {
  try {
    await ensureInventoryMovementTable();
    const [items] = await pool.query(`
      SELECT id, name, description, price, stock_quantity, sku, category, brand
      FROM products
      ORDER BY name ASC
    `);

    const [summaryRows]: any = await pool.query(`
      SELECT COUNT(*) AS total_items,
             COALESCE(SUM(price * stock_quantity), 0) AS stock_value,
             SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= 10 THEN 1 ELSE 0 END) AS low_stock,
             SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock,
             4 AS locations
      FROM products
    `);

    const [movementRows]: any = await pool.query(`
      SELECT COUNT(*) AS transactions,
             COALESCE(SUM(CASE WHEN quantity_change > 0 THEN quantity_change * unit_price ELSE 0 END), 0) AS total_inward,
             COALESCE(SUM(CASE WHEN quantity_change < 0 THEN ABS(quantity_change) * unit_price ELSE 0 END), 0) AS total_outward
      FROM inventory_movements
      WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
    `);

    return NextResponse.json({
      items,
      summary: summaryRows[0],
      movements: movementRows[0],
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  let connection: PoolConnection | null = null;
  try {
    connection = await pool.getConnection();
    await ensureInventoryMovementTable(connection);
    const body = await request.json();
    const productId = Number(body.product_id);
    const quantityChange = Number(body.quantity_change);
    const notes = typeof body.notes === 'string' ? body.notes.trim() : 'Manual stock adjustment';
    const createdBy = body.created_by ? Number(body.created_by) : null;

    if (!Number.isInteger(productId) || !Number.isInteger(quantityChange) || quantityChange === 0) {
      return NextResponse.json({ error: 'A valid product and non-zero whole-number adjustment are required' }, { status: 400 });
    }

    await connection.beginTransaction();
    const [rows]: any = await connection.query(
      'SELECT id, price, stock_quantity FROM products WHERE id = ? FOR UPDATE',
      [productId]
    );
    if (rows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const product = rows[0];
    const stockBefore = Number(product.stock_quantity);
    const stockAfter = stockBefore + quantityChange;
    if (stockAfter < 0) {
      await connection.rollback();
      return NextResponse.json({ error: `Adjustment exceeds available stock (${stockBefore})` }, { status: 400 });
    }

    await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [stockAfter, productId]);
    const movementType = quantityChange > 0 ? 'in' : 'out';
    const [movementResult]: any = await connection.query(
      `INSERT INTO inventory_movements
       (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productId, movementType, quantityChange, stockBefore, stockAfter, product.price, `ADJ-${Date.now()}`, notes, createdBy]
    );
    await connection.commit();

    return NextResponse.json({
      message: 'Stock adjusted successfully',
      movement_id: movementResult.insertId,
      product_id: productId,
      stock_before: stockBefore,
      stock_after: stockAfter,
    }, { status: 201 });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error adjusting inventory:', error);
    return databaseError(error);
  } finally {
    connection?.release();
  }
}
