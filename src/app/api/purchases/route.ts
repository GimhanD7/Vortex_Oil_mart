/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

const paymentMethods = new Set(['Cash', 'Card', 'UPI', 'Bank Transfer', 'Credit']);

async function ensurePurchaseTables(connection: PoolConnection | typeof pool = pool) {
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
}

export async function GET() {
  try {
    await ensurePurchaseTables();
    const [rows] = await pool.query(`
      SELECT p.id, p.supplier, p.payment_method, p.total_amount, p.status, p.notes, p.created_at,
             u.username AS created_by,
             COALESCE(SUM(pi.quantity), 0) AS item_count
      FROM purchases p
      LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
      LEFT JOIN users u ON u.id = p.created_by
      GROUP BY p.id, p.supplier, p.payment_method, p.total_amount, p.status, p.notes, p.created_at, u.username
      ORDER BY p.id DESC
    `);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    return NextResponse.json({ error: 'Unable to load purchases' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let connection: PoolConnection | null = null;
  try {
    const body = await request.json();
    const supplier = typeof body.supplier === 'string' ? body.supplier.trim() : '';
    const paymentMethod = paymentMethods.has(body.payment_method) ? body.payment_method : 'Cash';
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null;
    const createdBy = body.created_by ? Number(body.created_by) : null;
    const items = Array.isArray(body.items) ? body.items : [];

    if (!supplier || items.length === 0) {
      return NextResponse.json({ error: 'Supplier and at least one purchase item are required' }, { status: 400 });
    }

    connection = await pool.getConnection();
    await ensurePurchaseTables(connection);
    await connection.beginTransaction();

    let total = 0;
    const normalized: Array<{ product_id: number; quantity: number; unit_cost: number; stock_before: number }> = [];
    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);
      const unitCost = Number(item.unit_cost);
      if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(unitCost) || unitCost < 0) {
        throw new Error('Purchase items need a product, positive quantity, and valid unit cost');
      }
      const [productRows]: any = await connection.query('SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE', [productId]);
      if (productRows.length === 0) throw new Error(`Product ${productId} not found`);
      total += quantity * unitCost;
      normalized.push({ product_id: productId, quantity, unit_cost: unitCost, stock_before: Number(productRows[0].stock_quantity) });
    }

    const [purchaseResult]: any = await connection.query(
      `INSERT INTO purchases (supplier, payment_method, total_amount, status, notes, created_by)
       VALUES (?, ?, ?, 'received', ?, ?)`,
      [supplier, paymentMethod, total, notes, createdBy]
    );
    const purchaseId = purchaseResult.insertId;

    for (const item of normalized) {
      const stockAfter = item.stock_before + item.quantity;
      await connection.query(
        'INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost) VALUES (?, ?, ?, ?)',
        [purchaseId, item.product_id, item.quantity, item.unit_cost]
      );
      await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [stockAfter, item.product_id]);
      await connection.query(
        `INSERT INTO inventory_movements
         (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by)
         VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?)`,
        [item.product_id, item.quantity, item.stock_before, stockAfter, item.unit_cost, `PUR-${purchaseId}`, `Purchase received from ${supplier}`, createdBy]
      );
    }

    await connection.commit();
    return NextResponse.json({ id: purchaseId, message: 'Purchase received successfully', total_amount: total }, { status: 201 });
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error creating purchase:', error);
    return NextResponse.json({ error: error.message || 'Unable to create purchase' }, { status: 500 });
  } finally {
    connection?.release();
  }
}
