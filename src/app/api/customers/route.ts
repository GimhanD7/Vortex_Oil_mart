import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [rows] = await pool.query('SELECT * FROM customers ORDER BY id DESC');
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, email, address, company_notes, customer_type, status, credit_limit } = body;

    if (!name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const [result]: any = await pool.query(
      `INSERT INTO customers (
        name, phone, email, address, company_notes, customer_type, status, credit_limit
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name, 
        phone || null, 
        email || null, 
        address || null, 
        company_notes || null, 
        customer_type || 'Regular Customer', 
        status || 'Active', 
        credit_limit || 0.00
      ]
    );

    return NextResponse.json({ id: result.insertId, message: 'Customer created successfully' }, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
