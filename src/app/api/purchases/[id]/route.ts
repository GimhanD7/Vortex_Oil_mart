/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

async function purchaseItems(connection: PoolConnection | typeof pool, id: number) {
  const [items]: any = await connection.query(
    `SELECT pi.id, pi.product_id, pi.quantity, pi.unit_cost, p.name AS product_name, p.sku
     FROM purchase_items pi
     JOIN products p ON p.id = pi.product_id
     WHERE pi.purchase_id = ?
     ORDER BY pi.id ASC`,
    [id]
  );
  return items;
}

async function reverseReceivedStock(connection: PoolConnection, purchaseId: number, createdBy: number | null) {
  const items = await purchaseItems(connection, purchaseId);
  for (const item of items) {
    const [productRows]: any = await connection.query(
      'SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE',
      [item.product_id]
    );
    const stockBefore = Number(productRows[0]?.stock_quantity || 0);
    if (stockBefore < Number(item.quantity)) {
      throw new Error(`Cannot reverse ${item.product_name}; current stock is below purchase quantity`);
    }
    const stockAfter = stockBefore - Number(item.quantity);
    await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [stockAfter, item.product_id]);
    await connection.query(
      `INSERT INTO inventory_movements
       (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by)
       VALUES (?, 'out', ?, ?, ?, ?, ?, 'Purchase stock reversed', ?)`,
      [item.product_id, -Number(item.quantity), stockBefore, stockAfter, item.unit_cost, `PUR-CANCEL-${purchaseId}`, createdBy]
    );
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = Number((await params).id);
    if (!id) return NextResponse.json({ error: 'Invalid purchase ID' }, { status: 400 });

    const [purchaseRows]: any = await pool.query('SELECT * FROM purchases WHERE id = ?', [id]);
    if (!purchaseRows.length) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });

    const items = await purchaseItems(pool, id);
    return NextResponse.json({ purchase: purchaseRows[0], items });
  } catch (error) {
    console.error('Error loading purchase:', error);
    return NextResponse.json({ error: 'Unable to load purchase' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let connection: PoolConnection | null = null;
  try {
    const id = Number((await params).id);
    const body = await request.json();
    if (!id) return NextResponse.json({ error: 'Invalid purchase ID' }, { status: 400 });

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows]: any = await connection.query('SELECT * FROM purchases WHERE id = ? FOR UPDATE', [id]);
    if (!rows.length) {
      await connection.rollback();
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    const purchase = rows[0];
    if (body.status === 'cancelled' && purchase.status !== 'cancelled') {
      if (purchase.status === 'received') {
        await reverseReceivedStock(connection, id, purchase.created_by || null);
      }
      await connection.query(`UPDATE purchases SET status = 'cancelled' WHERE id = ?`, [id]);
    } else {
      await connection.query(
        `UPDATE purchases
         SET supplier = COALESCE(?, supplier),
             payment_method = COALESCE(?, payment_method),
             notes = COALESCE(?, notes)
         WHERE id = ?`,
        [
          typeof body.supplier === 'string' && body.supplier.trim() ? body.supplier.trim() : null,
          typeof body.payment_method === 'string' && body.payment_method.trim() ? body.payment_method.trim() : null,
          typeof body.notes === 'string' ? body.notes.trim() : null,
          id,
        ]
      );
    }

    await connection.commit();
    return NextResponse.json({ message: 'Purchase updated successfully' });
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error updating purchase:', error);
    return NextResponse.json({ error: error.message || 'Unable to update purchase' }, { status: 500 });
  } finally {
    connection?.release();
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let connection: PoolConnection | null = null;
  try {
    const id = Number((await params).id);
    if (!id) return NextResponse.json({ error: 'Invalid purchase ID' }, { status: 400 });

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows]: any = await connection.query('SELECT * FROM purchases WHERE id = ? FOR UPDATE', [id]);
    if (!rows.length) {
      await connection.rollback();
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    if (rows[0].status === 'received') {
      await reverseReceivedStock(connection, id, rows[0].created_by || null);
    }

    await connection.query('DELETE FROM purchases WHERE id = ?', [id]);
    await connection.commit();
    return NextResponse.json({ message: 'Purchase deleted successfully' });
  } catch (error: any) {
    if (connection) await connection.rollback();
    console.error('Error deleting purchase:', error);
    return NextResponse.json({ error: error.message || 'Unable to delete purchase' }, { status: 500 });
  } finally {
    connection?.release();
  }
}
