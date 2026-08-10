/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import type { PoolConnection } from 'mysql2/promise';

export const dynamic = 'force-dynamic';

type BackupRow = Record<string, unknown>;

function nullableNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function movementType(value: unknown) {
  const normalized = nullableString(value);
  return normalized === 'in' || normalized === 'out' || normalized === 'adjustment' || normalized === 'sale'
    ? normalized
    : 'adjustment';
}

async function rowExists(connection: PoolConnection | typeof pool, table: string, id: unknown) {
  const rowId = nullableNumber(id);
  if (!rowId) return false;
  const [rows]: any = await connection.query(`SELECT id FROM \`${table}\` WHERE id = ? LIMIT 1`, [rowId]);
  return rows.length > 0;
}

async function fallbackUserId(connection: PoolConnection | typeof pool) {
  const [rows]: any = await connection.query(`SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1`);
  return rows[0]?.id || 1;
}

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
    const sales = Array.isArray(data?.sales) ? data.sales : [];
    const saleItems = Array.isArray(data?.sale_items) ? data.sale_items : [];
    const inventoryMovements = Array.isArray(data?.inventory_movements) ? data.inventory_movements : [];
    const purchases = Array.isArray(data?.purchases) ? data.purchases : [];
    const purchaseItems = Array.isArray(data?.purchase_items) ? data.purchase_items : [];

    await connection.beginTransaction();
    const adminUserId = await fallbackUserId(connection);

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
        `INSERT INTO products (id, name, description, price, stock_quantity, sku, barcode, category, brand, reorder_level, location, batch_no, supplier)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name), description = VALUES(description), price = VALUES(price),
           stock_quantity = VALUES(stock_quantity), category = VALUES(category), brand = VALUES(brand),
           reorder_level = VALUES(reorder_level), location = VALUES(location), batch_no = VALUES(batch_no),
           supplier = VALUES(supplier)`,
        [
          nullableNumber(product.id),
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
        `INSERT INTO customers (id, name, phone, email, address, company_notes, customer_type, status, credit_limit, outstanding_balance, total_purchases)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           phone = VALUES(phone), email = VALUES(email), address = VALUES(address),
           company_notes = VALUES(company_notes), customer_type = VALUES(customer_type),
           status = VALUES(status), credit_limit = VALUES(credit_limit),
           outstanding_balance = VALUES(outstanding_balance), total_purchases = VALUES(total_purchases)`,
        [
          nullableNumber(customer.id),
          String(customer.name),
          customer.phone ? String(customer.phone) : null,
          customer.email ? String(customer.email) : null,
          customer.address ? String(customer.address) : null,
          customer.company_notes ? String(customer.company_notes) : null,
          customer.customer_type ? String(customer.customer_type) : 'Regular Customer',
          customer.status ? String(customer.status) : 'Active',
          Number(customer.credit_limit || 0),
          Number(customer.outstanding_balance || 0),
          Number(customer.total_purchases || 0),
        ]
      );
    }

    for (const sale of sales as BackupRow[]) {
      const id = nullableNumber(sale.id);
      if (!id) continue;
      const cashierId = await rowExists(connection, 'users', sale.cashier_id) ? nullableNumber(sale.cashier_id) : adminUserId;
      const customerId = await rowExists(connection, 'customers', sale.customer_id) ? nullableNumber(sale.customer_id) : null;
      await connection.query(
        `INSERT INTO sales (id, cashier_id, customer_id, total_amount, payment_method, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
         ON DUPLICATE KEY UPDATE
           cashier_id = VALUES(cashier_id), customer_id = VALUES(customer_id),
           total_amount = VALUES(total_amount), payment_method = VALUES(payment_method),
           status = VALUES(status), created_at = VALUES(created_at)`,
        [
          id,
          cashierId,
          customerId,
          Number(sale.total_amount || 0),
          nullableString(sale.payment_method) || 'Cash',
          nullableString(sale.status) || 'completed',
          sale.created_at ? String(sale.created_at) : null,
        ]
      );
    }

    for (const item of saleItems as BackupRow[]) {
      const saleId = nullableNumber(item.sale_id);
      const productId = nullableNumber(item.product_id);
      if (!saleId || !productId) continue;
      if (!(await rowExists(connection, 'sales', saleId)) || !(await rowExists(connection, 'products', productId))) continue;
      await connection.query(
        `INSERT INTO sale_items (id, sale_id, product_id, quantity, price_at_time)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           sale_id = VALUES(sale_id), product_id = VALUES(product_id),
           quantity = VALUES(quantity), price_at_time = VALUES(price_at_time)`,
        [
          nullableNumber(item.id),
          saleId,
          productId,
          Number(item.quantity || 0),
          Number(item.price_at_time || 0),
        ]
      );
    }

    for (const purchase of purchases as BackupRow[]) {
      const id = nullableNumber(purchase.id);
      if (!id) continue;
      const createdBy = await rowExists(connection, 'users', purchase.created_by) ? nullableNumber(purchase.created_by) : null;
      await connection.query(
        `INSERT INTO purchases (id, supplier, payment_method, total_amount, status, notes, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
         ON DUPLICATE KEY UPDATE
           supplier = VALUES(supplier), payment_method = VALUES(payment_method),
           total_amount = VALUES(total_amount), status = VALUES(status),
           notes = VALUES(notes), created_by = VALUES(created_by), created_at = VALUES(created_at)`,
        [
          id,
          nullableString(purchase.supplier) || 'Not Assigned',
          nullableString(purchase.payment_method) || 'Cash',
          Number(purchase.total_amount || 0),
          nullableString(purchase.status) || 'received',
          nullableString(purchase.notes),
          createdBy,
          purchase.created_at ? String(purchase.created_at) : null,
        ]
      );
    }

    for (const item of purchaseItems as BackupRow[]) {
      const purchaseId = nullableNumber(item.purchase_id);
      const productId = nullableNumber(item.product_id);
      if (!purchaseId || !productId) continue;
      if (!(await rowExists(connection, 'purchases', purchaseId)) || !(await rowExists(connection, 'products', productId))) continue;
      await connection.query(
        `INSERT INTO purchase_items (id, purchase_id, product_id, quantity, unit_cost)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           purchase_id = VALUES(purchase_id), product_id = VALUES(product_id),
           quantity = VALUES(quantity), unit_cost = VALUES(unit_cost)`,
        [
          nullableNumber(item.id),
          purchaseId,
          productId,
          Number(item.quantity || 0),
          Number(item.unit_cost || 0),
        ]
      );
    }

    for (const movement of inventoryMovements as BackupRow[]) {
      const id = nullableNumber(movement.id);
      const productId = nullableNumber(movement.product_id);
      if (!id || !productId || !(await rowExists(connection, 'products', productId))) continue;
      const createdBy = await rowExists(connection, 'users', movement.created_by) ? nullableNumber(movement.created_by) : null;
      await connection.query(
        `INSERT INTO inventory_movements
         (id, product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
         ON DUPLICATE KEY UPDATE
           product_id = VALUES(product_id), movement_type = VALUES(movement_type),
           quantity_change = VALUES(quantity_change), stock_before = VALUES(stock_before),
           stock_after = VALUES(stock_after), unit_price = VALUES(unit_price),
           reference_no = VALUES(reference_no), notes = VALUES(notes),
           created_by = VALUES(created_by), created_at = VALUES(created_at)`,
        [
          id,
          productId,
          movementType(movement.movement_type),
          Number(movement.quantity_change || 0),
          Number(movement.stock_before || 0),
          Number(movement.stock_after || 0),
          Number(movement.unit_price || 0),
          nullableString(movement.reference_no),
          nullableString(movement.notes),
          createdBy,
          movement.created_at ? String(movement.created_at) : null,
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
        sales: sales.length,
        sale_items: saleItems.length,
        inventory_movements: inventoryMovements.length,
        purchases: purchases.length,
        purchase_items: purchaseItems.length,
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
