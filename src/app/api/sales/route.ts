/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

const paymentMethods = new Set(['Cash', 'Card', 'Wallet', 'Bank Transfer', 'Credit']);

const salesColumns = [
  'payment_method',
  'status',
  'customer_id',
  'subtotal_amount',
  'discount_rate',
  'discount_amount',
  'tax_rate',
  'tax_amount',
  'business_date',
  'cash_received',
  'cash_balance',
  'sales_cycle_id',
  'opening_cash_balance',
];

async function ensureSalesColumns(connection: PoolConnection | typeof pool = pool) {
  const [columns]: any = await connection.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales'
       AND COLUMN_NAME IN (${salesColumns.map(() => '?').join(', ')})`,
    salesColumns
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

export async function GET(request: Request) {
  try {
    await ensureSalesColumns();
    await ensureCustomersTable();
    const { searchParams } = new URL(request.url);
    const values: Array<string | number> = [];
    const where: string[] = [];
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const cashier = searchParams.get('cashier');
    const paymentMethod = searchParams.get('payment_method');
    const status = searchParams.get('status');

    if (dateFrom) {
      where.push('COALESCE(s.business_date, DATE(s.created_at)) >= ?');
      values.push(dateFrom);
    }
    if (dateTo) {
      where.push('COALESCE(s.business_date, DATE(s.created_at)) <= ?');
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
      SELECT s.id, s.subtotal_amount, s.discount_rate, s.discount_amount,
             s.tax_rate, s.tax_amount, s.business_date, s.cash_received, s.cash_balance,
             s.sales_cycle_id, s.opening_cash_balance,
             s.total_amount, s.payment_method, s.status, s.created_at,
             u.username as cashier_name, c.name as customer_name,
             COALESCE(SUM(si.quantity), 0) as item_count
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      GROUP BY s.id, s.subtotal_amount, s.discount_rate, s.discount_amount,
               s.tax_rate, s.tax_amount, s.business_date, s.cash_received, s.cash_balance,
               s.sales_cycle_id, s.opening_cash_balance,
               s.total_amount, s.payment_method, s.status, s.created_at, u.username, c.name
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
    await ensureCustomersTable(connection);
    const {
      cashier_id,
      customer_id,
      items,
      payment_method = 'Cash',
      discount_rate = 0,
      tax_rate = 0,
      business_date = null,
      cash_received = null,
      cash_balance = null,
      sales_cycle_id = null,
      opening_cash_balance = null,
    } = await request.json();
    const paymentMethod = paymentMethods.has(payment_method) ? payment_method : 'Cash';

    if (!cashier_id || !items || items.length === 0) {
      return NextResponse.json({ error: 'Invalid sale data' }, { status: 400 });
    }

    await connection.beginTransaction();

    // Calculate totals and check stock
    let subtotalAmount = 0;
    for (const item of items) {
      const [productRows]: any = await connection.query('SELECT price, stock_quantity FROM products WHERE id = ?', [item.product_id]);
      if (productRows.length === 0) {
        throw new Error(`Product ${item.product_id} not found`);
      }
      const product = productRows[0];
      if (product.stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ID ${item.product_id}`);
      }
      subtotalAmount += product.price * item.quantity;
    }
    const normalizedDiscountRate = Math.min(100, Math.max(0, Number(discount_rate || 0)));
    const discountAmount = subtotalAmount * (Number.isFinite(normalizedDiscountRate) ? normalizedDiscountRate / 100 : 0);
    const normalizedTaxRate = Math.max(0, Number(tax_rate || 0));
    const taxableAmount = Math.max(0, subtotalAmount - discountAmount);
    const taxAmount = taxableAmount * (Number.isFinite(normalizedTaxRate) ? normalizedTaxRate / 100 : 0);
    const totalAmount = taxableAmount + taxAmount;
    const cashReceivedAmount = cash_received === null ? null : Number(cash_received);
    const cashBalanceAmount = cash_balance === null ? null : Number(cash_balance);
    const openingCashBalance = opening_cash_balance === null ? null : Number(opening_cash_balance);

    // Insert into sales
    const [saleResult]: any = await connection.query(
      `INSERT INTO sales
       (cashier_id, customer_id, subtotal_amount, discount_rate, discount_amount,
        tax_rate, tax_amount, business_date, total_amount, payment_method, status,
        cash_received, cash_balance, sales_cycle_id, opening_cash_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cashier_id,
        customer_id || null,
        subtotalAmount,
        normalizedDiscountRate,
        discountAmount,
        normalizedTaxRate,
        taxAmount,
        business_date || null,
        totalAmount,
        paymentMethod,
        'completed',
        cashReceivedAmount !== null && Number.isFinite(cashReceivedAmount) ? cashReceivedAmount : null,
        cashBalanceAmount !== null && Number.isFinite(cashBalanceAmount) ? cashBalanceAmount : null,
        sales_cycle_id || null,
        openingCashBalance !== null && Number.isFinite(openingCashBalance) ? openingCashBalance : null,
      ]
    );
    const saleId = saleResult.insertId;

    if (customer_id) {
      await connection.query(
        'UPDATE customers SET total_purchases = total_purchases + ? WHERE id = ?',
        [totalAmount, customer_id]
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
    return NextResponse.json({
      message: 'Sale completed successfully',
      saleId,
      subtotal_amount: subtotalAmount,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      status: 'completed',
    }, { status: 201 });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error processing sale:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  } finally {
    connection.release();
  }
}
