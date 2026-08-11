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
