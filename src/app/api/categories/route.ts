import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DEFAULT_CATEGORIES = [
  'Engine Oils',
  'Gear Oils',
  'Lubricants',
  'Filters',
  'Brake Pads',
  'Batteries',
  'Spark Plugs',
  'General',
];

async function ensureCategoriesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    INSERT IGNORE INTO categories (name)
    SELECT DISTINCT category
    FROM products
    WHERE category IS NOT NULL AND category != ''
  `);
  for (const category of DEFAULT_CATEGORIES) {
    await pool.query('INSERT IGNORE INTO categories (name) VALUES (?)', [category]);
  }
}

export async function GET() {
  try {
    await ensureCategoriesTable();
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureCategoriesTable();
    const { name } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const [result]: any = await pool.query(
      `INSERT IGNORE INTO categories (name) VALUES (?)`,
      [name.trim()]
    );
    return NextResponse.json({ id: result.insertId, message: 'Category added' }, { status: 201 });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
