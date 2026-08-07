import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import bcrypt from 'bcryptjs';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = (await params).id;
    const { username, role, password } = await request.json();

    if (!username || !role) {
      return NextResponse.json({ error: 'Username and role are required' }, { status: 400 });
    }

    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      await pool.query(
        'UPDATE users SET username = ?, role = ?, password = ? WHERE id = ?',
        [username, role, hashedPassword, id]
      );
    } else {
      await pool.query(
        'UPDATE users SET username = ?, role = ? WHERE id = ?',
        [username, role, id]
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
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Could not delete user. They may have associated sales records.' }, { status: 400 });
  }
}
