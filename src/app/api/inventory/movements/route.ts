import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('product_id');
    const type = searchParams.get('type');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200);
    const values: Array<string | number> = [];
    const where: string[] = [];
    if (productId) {
      where.push('m.product_id = ?');
      values.push(productId);
    }
    if (type && type !== 'All Types') {
      where.push('m.movement_type = ?');
      values.push(type);
    }
    if (dateFrom) {
      where.push('DATE(m.created_at) >= ?');
      values.push(dateFrom);
    }
    if (dateTo) {
      where.push('DATE(m.created_at) <= ?');
      values.push(dateTo);
    }
    values.push(limit);

    const [rows] = await pool.query(
      `SELECT m.id, m.product_id, p.name AS product_name, p.sku,
              m.movement_type, m.quantity_change, m.stock_before, m.stock_after,
              m.unit_price, m.reference_no, m.notes, u.username AS created_by,
              m.created_at
       FROM inventory_movements m
       JOIN products p ON p.id = m.product_id
       LEFT JOIN users u ON u.id = m.created_by
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ?`,
      values
    );
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching inventory movements:', error);
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || error instanceof AggregateError) {
      return NextResponse.json(
        { error: 'Inventory database is unavailable. Start MySQL on 127.0.0.1:3306.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Unable to load inventory movements' }, { status: 500 });
  }
}
