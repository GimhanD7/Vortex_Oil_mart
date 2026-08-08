import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const body = await request.json();
    const { name, phone, email, address, company_notes, customer_type, status, credit_limit, outstanding_balance, total_purchases } = body;

    if (!name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    await pool.query(
      `UPDATE customers SET 
        name = ?, 
        phone = ?, 
        email = ?, 
        address = ?, 
        company_notes = ?, 
        customer_type = ?, 
        status = ?, 
        credit_limit = ?,
        outstanding_balance = ?,
        total_purchases = ?
      WHERE id = ?`,
      [
        name, 
        phone || null, 
        email || null, 
        address || null, 
        company_notes || null, 
        customer_type || 'Regular Customer', 
        status || 'Active', 
        credit_limit || 0.00,
        outstanding_balance || 0.00,
        total_purchases || 0.00,
        id
      ]
    );

    return NextResponse.json({ message: 'Customer updated successfully' });
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    
    // Perform soft delete or check for dependencies before hard delete if needed.
    // For now, doing hard delete.
    const [result]: any = await pool.query('DELETE FROM customers WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Customer deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting customer:', error);
    // Handle foreign key constraint error if sales are linked later
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return NextResponse.json({ error: 'Cannot delete customer because they have associated sales records.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
