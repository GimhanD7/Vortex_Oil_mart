import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DEFAULT_BRANDS = [
  'Shell India',
  'ExxonMobil',
  'Castrol India',
  'Bosch Ltd.',
  'Amaron',
  'Brembo India',
  'NGK India',
  'Mann+Hummel',
  'Generic',
];

async function ensureBrandsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS brands (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    INSERT IGNORE INTO brands (name)
    SELECT DISTINCT brand
    FROM products
    WHERE brand IS NOT NULL AND brand != ''
  `);
  for (const brand of DEFAULT_BRANDS) {
    await pool.query('INSERT IGNORE INTO brands (name) VALUES (?)', [brand]);
  }
}

export async function GET() {
  try {
    await ensureBrandsTable();
    const [rows] = await pool.query('SELECT * FROM brands ORDER BY name ASC');
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureBrandsTable();
    const { name } = await request.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    const [result]: any = await pool.query(
      `INSERT IGNORE INTO brands (name) VALUES (?)`,
      [name.trim()]
    );
    return NextResponse.json({ id: result.insertId, message: 'Brand added' }, { status: 201 });
  } catch (error) {
    console.error('Error creating brand:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
