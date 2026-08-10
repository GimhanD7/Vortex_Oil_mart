import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2/promise';

type UserRow = RowDataPacket & {
  id: number;
  username: string;
  password: string;
  role: 'admin' | 'cashier';
  permissions: string[] | string | null;
};

function normalizePermissions(value: UserRow['permissions'], role: UserRow['role']) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return role === 'admin'
    ? ['view_sales', 'manage_inventory', 'manage_products', 'manage_customers', 'view_reports', 'manage_users', 'pos_billing']
    : ['pos_billing'];
}

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const [rows] = await pool.query<UserRow[]>(
      'SELECT id, username, password, role, permissions FROM users WHERE username = ? LIMIT 1',
      [username]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const user = rows[0];

    // For testing without hashing you might use: const isMatch = password === user.password;
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const permissions = normalizePermissions(user.permissions, user.role);
    const token = signToken({ id: user.id, username: user.username, role: user.role, permissions });

    const response = NextResponse.json({
      message: 'Login successful',
      user: { id: user.id, username: user.username, role: user.role, permissions }
    });

    // Set cookie
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24, // 1 day
    });

    return response;

  } catch (error) {
    console.error('Login error:', error);
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
    if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ER_NO_SUCH_TABLE' || error instanceof AggregateError) {
      return NextResponse.json(
        { error: 'Database is unavailable. Start MySQL and run npm run db:inventory.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
