import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const [rows]: any = await pool.query(
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

    const token = signToken({ id: user.id, username: user.username, role: user.role, permissions: user.permissions });

    const response = NextResponse.json({
      message: 'Login successful',
      user: { id: user.id, username: user.username, role: user.role, permissions: user.permissions }
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
    // If the database is not set up yet, provide a mock fallback for demonstration
    if ((error as any).code === 'ECONNREFUSED' || (error as any).code === 'ER_NO_SUCH_TABLE') {
        console.log("Database connection failed or table missing, using mock fallback.");
        return mockFallbackLogin(request);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Fallback for demonstration if MySQL is not running
async function mockFallbackLogin(request: Request) {
    const { username, password } = await request.json();
    if (username === 'admin' && password === 'admin123') {
        const token = signToken({ id: 1, username: 'admin', role: 'admin' });
        const res = NextResponse.json({
            message: 'Mock Login successful (DB unreachable)',
            user: { id: 1, username: 'admin', role: 'admin' }
        });
        res.cookies.set({ name: 'auth_token', value: token, httpOnly: true, path: '/' });
        return res;
    }
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}
