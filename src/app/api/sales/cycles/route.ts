/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function ensureSalesCyclesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sales_cycles (
      cycle_id VARCHAR(60) PRIMARY KEY,
      cashier_id INT NOT NULL,
      opened_at DATETIME NOT NULL,
      opened_date DATE NOT NULL,
      opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
      closing_balance DECIMAL(10,2) NULL,
      closed_at DATETIME NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);
}

async function ensureCycleSalesColumns() {
  const needed = ['sales_cycle_id', 'cash_received', 'cash_balance', 'discount_amount', 'tax_amount', 'business_date'];
  const [columns]: any = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales'
       AND COLUMN_NAME IN (${needed.map(() => '?').join(', ')})`,
    needed
  );
  const names = new Set(columns.map((row: { COLUMN_NAME: string }) => row.COLUMN_NAME));
  if (!names.has('sales_cycle_id')) {
    await pool.query('ALTER TABLE sales ADD COLUMN sales_cycle_id VARCHAR(60) NULL');
  }
  if (!names.has('cash_received')) {
    await pool.query('ALTER TABLE sales ADD COLUMN cash_received DECIMAL(10,2) NULL');
  }
  if (!names.has('cash_balance')) {
    await pool.query('ALTER TABLE sales ADD COLUMN cash_balance DECIMAL(10,2) NULL');
  }
  if (!names.has('discount_amount')) {
    await pool.query('ALTER TABLE sales ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0');
  }
  if (!names.has('tax_amount')) {
    await pool.query('ALTER TABLE sales ADD COLUMN tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0');
  }
  if (!names.has('business_date')) {
    await pool.query('ALTER TABLE sales ADD COLUMN business_date DATE NULL');
    await pool.query('UPDATE sales SET business_date = DATE(created_at) WHERE business_date IS NULL');
  }
}

export async function GET(request: Request) {
  try {
    await ensureSalesCyclesTable();
    await ensureCycleSalesColumns();
    const { searchParams } = new URL(request.url);
    const values: Array<string | number> = [];
    const where: string[] = [];
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const cashier = searchParams.get('cashier');
    const status = searchParams.get('status');

    if (dateFrom) {
      where.push('sc.opened_date >= ?');
      values.push(dateFrom);
    }
    if (dateTo) {
      where.push('sc.opened_date <= ?');
      values.push(dateTo);
    }
    if (cashier && cashier !== 'All Cashiers') {
      where.push('u.username = ?');
      values.push(cashier);
    }
    if (status && status !== 'All Status') {
      where.push('sc.status = ?');
      values.push(status.toLowerCase());
    }

    const [rows] = await pool.query(`
      SELECT
        sc.cycle_id,
        sc.cashier_id,
        COALESCE(u.username, CONCAT('Cashier #', sc.cashier_id)) AS cashier_name,
        sc.opened_date,
        sc.opened_at,
        sc.closed_at,
        sc.status,
        sc.opening_balance,
        sc.closing_balance,
        COALESCE(s.invoice_count, 0) AS invoice_count,
        COALESCE(s.item_count, 0) AS item_count,
        COALESCE(s.total_sales, 0) AS total_sales,
        COALESCE(s.cash_sales, 0) AS cash_sales,
        COALESCE(s.card_sales, 0) AS card_sales,
        COALESCE(s.bank_sales, 0) AS bank_sales,
        COALESCE(s.discount_total, 0) AS discount_total,
        COALESCE(s.tax_total, 0) AS tax_total,
        (sc.opening_balance + COALESCE(s.cash_sales, 0)) AS expected_cash,
        CASE
          WHEN sc.closing_balance IS NULL THEN NULL
          ELSE sc.closing_balance - (sc.opening_balance + COALESCE(s.cash_sales, 0))
        END AS cash_difference
      FROM sales_cycles sc
      LEFT JOIN users u ON u.id = sc.cashier_id
      LEFT JOIN (
        SELECT
          s.sales_cycle_id,
          COUNT(DISTINCT s.id) AS invoice_count,
          COALESCE(SUM(s.total_amount), 0) AS total_sales,
          COALESCE(SUM(CASE WHEN s.payment_method = 'Cash' THEN s.total_amount ELSE 0 END), 0) AS cash_sales,
          COALESCE(SUM(CASE WHEN s.payment_method = 'Card' THEN s.total_amount ELSE 0 END), 0) AS card_sales,
          COALESCE(SUM(CASE WHEN s.payment_method = 'Bank Transfer' THEN s.total_amount ELSE 0 END), 0) AS bank_sales,
          COALESCE(SUM(s.discount_amount), 0) AS discount_total,
          COALESCE(SUM(s.tax_amount), 0) AS tax_total,
          COALESCE(SUM(items.item_count), 0) AS item_count
        FROM sales s
        LEFT JOIN (
          SELECT sale_id, SUM(quantity) AS item_count
          FROM sale_items
          GROUP BY sale_id
        ) items ON items.sale_id = s.id
        WHERE s.sales_cycle_id IS NOT NULL
          AND (s.status IS NULL OR s.status != 'refunded')
        GROUP BY s.sales_cycle_id
      ) s ON s.sales_cycle_id = sc.cycle_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY sc.opened_at DESC
    `, values);

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching sales cycles:', error);
    return NextResponse.json({ error: 'Unable to load sales cycles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSalesCyclesTable();
    const { cycle_id, cashier_id, opened_at, opened_date, opening_balance } = await request.json();
    const balance = Number(opening_balance);

    if (!cycle_id || !cashier_id || !opened_at || !opened_date || !Number.isFinite(balance) || balance < 0) {
      return NextResponse.json({ error: 'Invalid sales cycle data' }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO sales_cycles (cycle_id, cashier_id, opened_at, opened_date, opening_balance, status)
       VALUES (?, ?, ?, ?, ?, 'open')
       ON DUPLICATE KEY UPDATE
         opened_at = VALUES(opened_at),
         opened_date = VALUES(opened_date),
         opening_balance = VALUES(opening_balance),
         status = 'open',
         closing_balance = NULL,
         closed_at = NULL`,
      [cycle_id, cashier_id, opened_at, opened_date, balance]
    );

    return NextResponse.json({ message: 'Sales cycle opened', cycle_id });
  } catch (error) {
    console.error('Error opening sales cycle:', error);
    return NextResponse.json({ error: 'Unable to open sales cycle' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    await ensureSalesCyclesTable();
    const { cycle_id, cashier_id, opened_at, opened_date, opening_balance = 0, closing_balance, closed_at } = await request.json();
    const balance = Number(closing_balance);
    const openingBalance = Number(opening_balance);

    if (!cycle_id || !Number.isFinite(balance) || balance < 0) {
      return NextResponse.json({ error: 'Invalid closing balance' }, { status: 400 });
    }

    const [summaryRows]: any = await pool.query(
      `SELECT
         COUNT(*) AS invoice_count,
         COALESCE(SUM(total_amount), 0) AS total_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN total_amount ELSE 0 END), 0) AS cash_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'Card' THEN total_amount ELSE 0 END), 0) AS card_sales,
         COALESCE(SUM(CASE WHEN payment_method = 'Bank Transfer' THEN total_amount ELSE 0 END), 0) AS bank_sales
       FROM sales
       WHERE sales_cycle_id = ?`,
      [cycle_id]
    );

    const [result]: any = await pool.query(
      `UPDATE sales_cycles
       SET closing_balance = ?, closed_at = ?, status = 'closed'
       WHERE cycle_id = ?`,
      [balance, closed_at || new Date(), cycle_id]
    );

    if (!result.affectedRows) {
      if (!cashier_id || !opened_at || !opened_date || !Number.isFinite(openingBalance)) {
        return NextResponse.json({ error: 'Sales cycle not found' }, { status: 404 });
      }
      await pool.query(
        `INSERT INTO sales_cycles
         (cycle_id, cashier_id, opened_at, opened_date, opening_balance, closing_balance, closed_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'closed')`,
        [cycle_id, cashier_id, opened_at, opened_date, openingBalance, balance, closed_at || new Date()]
      );
    }

    return NextResponse.json({
      message: 'Sales cycle closed',
      cycle_id,
      summary: summaryRows[0],
    });
  } catch (error) {
    console.error('Error closing sales cycle:', error);
    return NextResponse.json({ error: 'Unable to close sales cycle' }, { status: 500 });
  }
}
