/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

async function ensureSalesColumns(connection: PoolConnection | typeof pool = pool) {
  const [columns]: any = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales'
       AND COLUMN_NAME IN ('payment_method', 'status', 'customer_id', 'subtotal_amount', 'discount_rate', 'discount_amount', 'tax_rate', 'tax_amount', 'business_date', 'cash_received', 'cash_balance', 'sales_cycle_id', 'opening_cash_balance')`
  );
  const names = new Set(columns.map((row: { COLUMN_NAME: string }) => row.COLUMN_NAME));
  if (!names.has('customer_id')) {
    await connection.query('ALTER TABLE sales ADD COLUMN customer_id INT NULL');
  }
  if (!names.has('payment_method')) {
    await connection.query(`ALTER TABLE sales ADD COLUMN payment_method VARCHAR(40) NOT NULL DEFAULT 'Cash'`);
  }
  if (!names.has('status')) {
    await connection.query(`ALTER TABLE sales ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'completed'`);
  }
  if (!names.has('subtotal_amount')) {
    await connection.query('ALTER TABLE sales ADD COLUMN subtotal_amount DECIMAL(10,2) NOT NULL DEFAULT 0');
  }
  if (!names.has('discount_rate')) {
    await connection.query('ALTER TABLE sales ADD COLUMN discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0');
  }
  if (!names.has('discount_amount')) {
    await connection.query('ALTER TABLE sales ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0');
  }
  if (!names.has('tax_rate')) {
    await connection.query('ALTER TABLE sales ADD COLUMN tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0');
  }
  if (!names.has('tax_amount')) {
    await connection.query('ALTER TABLE sales ADD COLUMN tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0');
  }
  if (!names.has('business_date')) {
    await connection.query('ALTER TABLE sales ADD COLUMN business_date DATE NULL');
    await connection.query('UPDATE sales SET business_date = DATE(created_at) WHERE business_date IS NULL');
  }
  if (!names.has('cash_received')) {
    await connection.query('ALTER TABLE sales ADD COLUMN cash_received DECIMAL(10,2) NULL');
  }
  if (!names.has('cash_balance')) {
    await connection.query('ALTER TABLE sales ADD COLUMN cash_balance DECIMAL(10,2) NULL');
  }
  if (!names.has('sales_cycle_id')) {
    await connection.query('ALTER TABLE sales ADD COLUMN sales_cycle_id VARCHAR(60) NULL');
  }
  if (!names.has('opening_cash_balance')) {
    await connection.query('ALTER TABLE sales ADD COLUMN opening_cash_balance DECIMAL(10,2) NULL');
  }
}

async function ensureCustomersTable(connection: PoolConnection | typeof pool = pool) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      phone VARCHAR(40) NULL,
      email VARCHAR(150) NULL,
      address TEXT NULL,
      company_notes TEXT NULL,
      customer_type VARCHAR(60) NOT NULL DEFAULT 'Regular Customer',
      status VARCHAR(30) NOT NULL DEFAULT 'Active',
      credit_limit DECIMAL(10,2) NOT NULL DEFAULT 0,
      total_purchases DECIMAL(10,2) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSalesColumns();
    await ensureCustomersTable();
    const resolvedParams = await params;
    const saleId = Number(resolvedParams.id);
    if (!saleId) {
      return NextResponse.json({ error: 'Invalid sale ID' }, { status: 400 });
    }

    const [saleRows]: any = await pool.query(`
      SELECT s.id, s.subtotal_amount, s.discount_rate, s.discount_amount,
             s.tax_rate, s.tax_amount, s.business_date, s.cash_received, s.cash_balance,
             s.sales_cycle_id, s.opening_cash_balance,
             s.total_amount, s.payment_method, s.status, s.created_at,
             u.username as cashier_name, c.name as customer_name
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ?
    `, [saleId]);

    const [itemsRows]: any = await pool.query(`
      SELECT si.product_id, si.quantity, si.price_at_time, p.name as product_name
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `, [saleId]);

    return NextResponse.json({ sale: saleRows[0] || null, items: itemsRows });
  } catch (error) {
    console.error('Error fetching sale details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let connection: PoolConnection | null = null;
  try {
    const saleId = Number((await params).id);
    const { action } = await request.json();
    if (!saleId || action !== 'refund') {
      return NextResponse.json({ error: 'Only refund action is supported' }, { status: 400 });
    }

    connection = await pool.getConnection();
    await ensureSalesColumns(connection);
    await ensureCustomersTable(connection);
    await connection.beginTransaction();

    const [saleRows]: any = await connection.query('SELECT id, cashier_id, status FROM sales WHERE id = ? FOR UPDATE', [saleId]);
    if (saleRows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }
    if (saleRows[0].status === 'refunded') {
      await connection.rollback();
      return NextResponse.json({ error: 'Invoice is already refunded' }, { status: 400 });
    }

    const [items]: any = await connection.query(
      'SELECT product_id, quantity, price_at_time FROM sale_items WHERE sale_id = ?',
      [saleId]
    );

    for (const item of items) {
      const [productRows]: any = await connection.query(
        'SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE',
        [item.product_id]
      );
      const stockBefore = Number(productRows[0]?.stock_quantity || 0);
      const stockAfter = stockBefore + Number(item.quantity);
      await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [stockAfter, item.product_id]);
      await connection.query(
        `INSERT INTO inventory_movements
         (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by)
         VALUES (?, 'adjustment', ?, ?, ?, ?, ?, 'Stock returned by invoice refund', ?)`,
        [item.product_id, Number(item.quantity), stockBefore, stockAfter, item.price_at_time, `REFUND-SALE-${saleId}`, saleRows[0].cashier_id]
      );
    }

    await connection.query(`UPDATE sales SET status = 'refunded' WHERE id = ?`, [saleId]);
    await connection.commit();
    return NextResponse.json({ message: 'Invoice refunded successfully', status: 'refunded' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error refunding sale:', error);
    return NextResponse.json({ error: 'Could not refund invoice' }, { status: 500 });
  } finally {
    connection?.release();
  }
}
