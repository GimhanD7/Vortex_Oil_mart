import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const { username, role, password, permissions = [] } = await request.json();
    const normalizedUsername = typeof username === 'string' ? username.trim() : '';

    if (!normalizedUsername || !role) {
      return NextResponse.json({ error: 'Username and role are required' }, { status: 400 });
    }

    if (!['admin', 'cashier'].includes(role)) {
      return NextResponse.json({ error: 'Role must be admin or cashier' }, { status: 400 });
    }

    if (password && password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const [duplicates]: any = await pool.query('SELECT id FROM users WHERE username = ? AND id <> ?', [normalizedUsername, id]);
    if (duplicates.length > 0) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    const permsJson = JSON.stringify(permissions);

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await pool.query(
        'UPDATE users SET username = ?, role = ?, password = ?, permissions = ? WHERE id = ?',
        [normalizedUsername, role, hashedPassword, permsJson, id]
      );
    } else {
      await pool.query(
        'UPDATE users SET username = ?, role = ?, permissions = ? WHERE id = ?',
        [normalizedUsername, role, permsJson, id]
      );
    }

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const [targetRows]: any = await pool.query('SELECT role FROM users WHERE id = ?', [id]);
    if (targetRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (targetRows[0].role === 'admin') {
      const [adminRows]: any = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
      if (Number(adminRows[0].count) <= 1) {
        return NextResponse.json({ error: 'The last administrator cannot be deleted' }, { status: 400 });
      }
    }
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Could not delete user. They may have associated sales records.' }, { status: 400 });
  }
}
