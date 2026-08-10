/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

const paymentMethods = new Set(['Cash', 'Card', 'UPI', 'Wallet', 'Bank Transfer', 'Credit']);

async function ensureSalesColumns(connection: PoolConnection | typeof pool = pool) {
  const [columns]: any = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales'
       AND COLUMN_NAME IN ('payment_method', 'status', 'customer_id')`
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
}

export async function GET(request: Request) {
  try {
    await ensureSalesColumns();
    const { searchParams } = new URL(request.url);
    const values: Array<string | number> = [];
    const where: string[] = [];
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const cashier = searchParams.get('cashier');
    const paymentMethod = searchParams.get('payment_method');
    const status = searchParams.get('status');

    if (dateFrom) {
      where.push('DATE(s.created_at) >= ?');
      values.push(dateFrom);
    }
    if (dateTo) {
      where.push('DATE(s.created_at) <= ?');
      values.push(dateTo);
    }
    if (cashier && cashier !== 'All Cashiers') {
      where.push('u.username = ?');
      values.push(cashier);
    }
    if (paymentMethod && paymentMethod !== 'All Payment Methods') {
      where.push('s.payment_method = ?');
      values.push(paymentMethod);
    }
    if (status && status !== 'All Status') {
      where.push('s.status = ?');
      values.push(status.toLowerCase());
    }

    const [rows] = await pool.query(`
      SELECT s.id, s.total_amount, s.payment_method, s.status, s.created_at,
             u.username as cashier_name, c.name as customer_name,
             COALESCE(SUM(si.quantity), 0) as item_count
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY s.id, s.total_amount, s.payment_method, s.status, s.created_at, u.username, c.name
      ORDER BY s.id DESC
    `, values);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    await ensureSalesColumns(connection);
    const { cashier_id, customer_id, items, payment_method = 'Cash' } = await request.json();
    const paymentMethod = paymentMethods.has(payment_method) ? payment_method : 'Cash';

    if (!cashier_id || !items || items.length === 0) {
      return NextResponse.json({ error: 'Invalid sale data' }, { status: 400 });
    }

    await connection.beginTransaction();

    // Calculate total amount and check stock
    let total_amount = 0;
    for (const item of items) {
      const [productRows]: any = await connection.query('SELECT price, stock_quantity FROM products WHERE id = ?', [item.product_id]);
      if (productRows.length === 0) {
        throw new Error(`Product ${item.product_id} not found`);
      }
      const product = productRows[0];
      if (product.stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ID ${item.product_id}`);
      }
      total_amount += product.price * item.quantity;
    }

    // Insert into sales
    const [saleResult]: any = await connection.query(
      'INSERT INTO sales (cashier_id, customer_id, total_amount, payment_method, status) VALUES (?, ?, ?, ?, ?)',
      [cashier_id, customer_id || null, total_amount, paymentMethod, 'completed']
    );
    const saleId = saleResult.insertId;

    if (customer_id) {
      await connection.query(
        'UPDATE customers SET total_purchases = total_purchases + ? WHERE id = ?',
        [total_amount, customer_id]
      );
    }

    // Insert into sale_items and update stock
    for (const item of items) {
      const [productRows]: any = await connection.query('SELECT price, stock_quantity FROM products WHERE id = ? FOR UPDATE', [item.product_id]);
      const price_at_time = productRows[0].price;
      const stockBefore = Number(productRows[0].stock_quantity);
      const stockAfter = stockBefore - Number(item.quantity);

      await connection.query(
        'INSERT INTO sale_items (sale_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)',
        [saleId, item.product_id, item.quantity, price_at_time]
      );

      await connection.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );

      await connection.query(
        `INSERT INTO inventory_movements
         (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by)
         VALUES (?, 'sale', ?, ?, ?, ?, ?, 'Stock deducted by POS sale', ?)`,
        [item.product_id, -Number(item.quantity), stockBefore, stockAfter, price_at_time, `SALE-${saleId}`, cashier_id]
      );
    }

    await connection.commit();
    return NextResponse.json({ message: 'Sale completed successfully', saleId, payment_method: paymentMethod, status: 'completed' }, { status: 201 });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error processing sale:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  } finally {
    connection.release();
  }
}
