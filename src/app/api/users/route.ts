import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Never return the hashed password to the frontend
    const [rows] = await pool.query('SELECT id, username, role, permissions, created_at FROM users ORDER BY id DESC');
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { username, password, role, permissions = [] } = await request.json();

    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    if (!normalizedUsername || !password || !role) {
      return NextResponse.json({ error: 'Username, password, and role are required' }, { status: 400 });
    }

    if (normalizedUsername.length < 3 || password.length < 6) {
      return NextResponse.json({ error: 'Username must be at least 3 characters and password at least 6 characters' }, { status: 400 });
    }

    if (!['admin', 'cashier'].includes(role)) {
      return NextResponse.json({ error: 'Role must be admin or cashier' }, { status: 400 });
    }

    // Check if user exists
    const [existing]: any = await pool.query('SELECT id FROM users WHERE username = ?', [normalizedUsername]);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const permsJson = JSON.stringify(permissions);

    const [result]: any = await pool.query(
      'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)',
      [normalizedUsername, hashedPassword, role, permsJson]
    );

    return NextResponse.json({ id: result.insertId, message: 'User created' }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
