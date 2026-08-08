import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    const saleId = Number(resolvedParams.id);
    if (!saleId) {
      return NextResponse.json({ error: 'Invalid sale ID' }, { status: 400 });
    }

    const [itemsRows]: any = await pool.query(`
      SELECT si.quantity, si.price_at_time, p.name as product_name
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = ?
    `, [saleId]);

    return NextResponse.json(itemsRows);
  } catch (error) {
    console.error('Error fetching sale details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
