/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

type BackupRow = Record<string, unknown>;

async function tableExists(table: string) {
  const [rows]: any = await pool.query(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows.length > 0;
}

async function readTable(table: string) {
  if (!(await tableExists(table))) return [];
  const [rows] = await pool.query(`SELECT * FROM \`${table}\``);
  return rows;
}

export async function GET() {
  try {
    const payload = {
      exported_at: new Date().toISOString(),
      app: 'Oil Mart POS',
      version: 1,
      data: {
        products: await readTable('products'),
        customers: await readTable('customers'),
        categories: await readTable('categories'),
        brands: await readTable('brands'),
        sales: await readTable('sales'),
        sale_items: await readTable('sale_items'),
        inventory_movements: await readTable('inventory_movements'),
        purchases: await readTable('purchases'),
        purchase_items: await readTable('purchase_items'),
      },
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="oil-mart-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error) {
    console.error('Error exporting backup:', error);
    return NextResponse.json({ error: 'Unable to export backup' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const connection = await pool.getConnection();
  try {
    const body = await request.json();
    const data = body?.data || body;
    const products = Array.isArray(data?.products) ? data.products : [];
    const customers = Array.isArray(data?.customers) ? data.customers : [];
    const categories = Array.isArray(data?.categories) ? data.categories : [];
    const brands = Array.isArray(data?.brands) ? data.brands : [];

    await connection.beginTransaction();

    for (const category of categories as BackupRow[]) {
      if (category.name) {
        await connection.query('INSERT IGNORE INTO categories (name) VALUES (?)', [String(category.name)]);
      }
    }

    for (const brand of brands as BackupRow[]) {
      if (brand.name) {
        await connection.query('INSERT IGNORE INTO brands (name) VALUES (?)', [String(brand.name)]);
      }
    }

    for (const product of products as BackupRow[]) {
      if (!product.name) continue;
      await connection.query(
        `INSERT INTO products (name, description, price, stock_quantity, sku, barcode, category, brand, reorder_level, location, batch_no, supplier)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), description = VALUES(description), price = VALUES(price),
           stock_quantity = VALUES(stock_quantity), category = VALUES(category), brand = VALUES(brand),
           reorder_level = VALUES(reorder_level), location = VALUES(location), batch_no = VALUES(batch_no),
           supplier = VALUES(supplier)`,
        [
          String(product.name),
          product.description ? String(product.description) : '',
          Number(product.price || 0),
          Number(product.stock_quantity || 0),
          product.sku ? String(product.sku) : null,
          product.barcode ? String(product.barcode) : null,
          product.category ? String(product.category) : 'General',
          product.brand ? String(product.brand) : 'Generic',
          Number(product.reorder_level || 10),
          product.location ? String(product.location) : 'Main Store',
          product.batch_no ? String(product.batch_no) : null,
          product.supplier ? String(product.supplier) : 'Not Assigned',
        ]
      );
    }

    for (const customer of customers as BackupRow[]) {
      if (!customer.name) continue;
      await connection.query(
        `INSERT INTO customers (name, phone, email, address, company_notes, customer_type, status, credit_limit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           phone = VALUES(phone), email = VALUES(email), address = VALUES(address),
           company_notes = VALUES(company_notes), customer_type = VALUES(customer_type),
           status = VALUES(status), credit_limit = VALUES(credit_limit)`,
        [
          String(customer.name),
          customer.phone ? String(customer.phone) : null,
          customer.email ? String(customer.email) : null,
          customer.address ? String(customer.address) : null,
          customer.company_notes ? String(customer.company_notes) : null,
          customer.customer_type ? String(customer.customer_type) : 'Regular Customer',
          customer.status ? String(customer.status) : 'Active',
          Number(customer.credit_limit || 0),
        ]
      );
    }

    await connection.commit();
    return NextResponse.json({
      message: 'Import completed successfully',
      imported: {
        products: products.length,
        customers: customers.length,
        categories: categories.length,
        brands: brands.length,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error importing backup:', error);
    return NextResponse.json({ error: 'Unable to import backup. Check the JSON format.' }, { status: 400 });
  } finally {
    connection.release();
  }
}
