import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const { name, description, price, stock_quantity } = await request.json();

    if (!name || price === undefined) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
    }

    await pool.query(
      'UPDATE products SET name = ?, description = ?, price = ?, stock_quantity = ? WHERE id = ?',
      [name, description || '', price, stock_quantity || 0, id]
    );

    return NextResponse.json({ message: 'Product updated successfully' });
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    await pool.query('DELETE FROM products WHERE id = ?', [id]);
    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    // Note: Foreign key constraint fails if product has sales
    return NextResponse.json({ error: 'Could not delete product. It may be linked to existing sales.' }, { status: 400 });
  }
}
