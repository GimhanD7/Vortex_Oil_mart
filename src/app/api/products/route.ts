import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [rows] = await pool.query('SELECT * FROM products ORDER BY id DESC');
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { name, description, price, stock_quantity, sku, barcode, category, brand, reorder_level, location, batch_no, supplier } = await request.json();

    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
    }

    const numericPrice = Number(price);
    const numericStock = Number(stock_quantity || 0);
    if (!Number.isFinite(numericPrice) || numericPrice < 0 || !Number.isInteger(numericStock) || numericStock < 0) {
      return NextResponse.json({ error: 'Price and stock must be valid non-negative numbers' }, { status: 400 });
    }

    const [result]: any = await pool.query(
      `INSERT INTO products
       (name, description, price, stock_quantity, sku, barcode, category, brand, reorder_level, location, batch_no, supplier)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name.trim(), description || '', numericPrice, numericStock, sku || null, barcode || null,
       category || 'Uncategorized', brand || 'Generic', Number(reorder_level) || 10,
       location || 'Main Store', batch_no || null, supplier || 'Not Assigned']
    );

    if (numericStock > 0) {
      await pool.query(
        `INSERT INTO inventory_movements
         (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, notes)
         VALUES (?, 'in', ?, 0, ?, ?, 'Initial product stock')`,
        [result.insertId, numericStock, numericStock, numericPrice]
      );
    }

    return NextResponse.json({ id: result.insertId, message: 'Product created' }, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
