import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET() {
  try {
    const [rows] = await pool.query(`
      SELECT s.id, s.total_amount, s.created_at, u.username as cashier_name
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      ORDER BY s.id DESC
    `);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching sales:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const { cashier_id, items } = await request.json();

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
      'INSERT INTO sales (cashier_id, total_amount) VALUES (?, ?)',
      [cashier_id, total_amount]
    );
    const saleId = saleResult.insertId;

    // Insert into sale_items and update stock
    for (const item of items) {
      const [productRows]: any = await connection.query('SELECT price FROM products WHERE id = ?', [item.product_id]);
      const price_at_time = productRows[0].price;

      await connection.query(
        'INSERT INTO sale_items (sale_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)',
        [saleId, item.product_id, item.quantity, price_at_time]
      );

      await connection.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [item.quantity, item.product_id]
      );
    }

    await connection.commit();
    return NextResponse.json({ message: 'Sale completed successfully', saleId }, { status: 201 });
  } catch (error: any) {
    await connection.rollback();
    console.error('Error processing sale:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  } finally {
    connection.release();
  }
}
