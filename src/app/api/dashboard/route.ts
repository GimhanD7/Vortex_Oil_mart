/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function safeQuery<T = any>(sql: string, values: Array<string | number> = [], fallback: T[] = []) {
  try {
    const [rows] = await pool.query(sql, values);
    return rows as T[];
  } catch (error) {
    console.error('Dashboard query failed:', error);
    return fallback;
  }
}

export async function GET() {
  try {
    const [metrics] = await safeQuery(`
      SELECT
        COALESCE(SUM(s.total_amount), 0) AS revenue,
        COUNT(DISTINCT s.id) AS orders,
        COALESCE(SUM(si.quantity), 0) AS items_sold,
        COALESCE(AVG(s.total_amount), 0) AS average_order_value
      FROM sales s
      LEFT JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status IS NULL OR s.status != 'refunded'
    `);

    const [inventory] = await safeQuery(`
      SELECT COUNT(*) AS total_products,
             COUNT(DISTINCT sku) AS total_skus,
             SUM(CASE WHEN stock_quantity > 0 THEN 1 ELSE 0 END) AS in_stock,
             SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock,
             SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= reorder_level THEN 1 ELSE 0 END) AS low_stock,
             COALESCE(SUM(price * stock_quantity), 0) AS stock_value
      FROM products
    `);

    const customers = await safeQuery(`SELECT COUNT(*) AS total_customers FROM customers`);
    const lowStock = await safeQuery(`
      SELECT id, name, sku, category, stock_quantity
      FROM products
      WHERE stock_quantity > 0 AND stock_quantity <= reorder_level
      ORDER BY stock_quantity ASC, name ASC
      LIMIT 5
    `);

    const recentOrders = await safeQuery(`
      SELECT s.id, s.total_amount, s.status, s.created_at, c.name AS customer_name,
             COALESCE(SUM(si.quantity), 0) AS item_count
      FROM sales s
      LEFT JOIN customers c ON c.id = s.customer_id
      LEFT JOIN sale_items si ON si.sale_id = s.id
      GROUP BY s.id, s.total_amount, s.status, s.created_at, c.name
      ORDER BY s.id DESC
      LIMIT 5
    `);

    const topProducts = await safeQuery(`
      SELECT p.name, p.category, SUM(si.quantity) AS quantity, SUM(si.quantity * si.price_at_time) AS total
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      JOIN sales s ON s.id = si.sale_id
      WHERE s.status IS NULL OR s.status != 'refunded'
      GROUP BY p.id, p.name, p.category
      ORDER BY quantity DESC
      LIMIT 5
    `);

    const paymentMethods = await safeQuery(`
      SELECT COALESCE(payment_method, 'Cash') AS method, COUNT(*) AS orders, COALESCE(SUM(total_amount), 0) AS total
      FROM sales
      WHERE status IS NULL OR status != 'refunded'
      GROUP BY COALESCE(payment_method, 'Cash')
      ORDER BY total DESC
    `);

    const categories = await safeQuery(`
      SELECT p.category, COALESCE(SUM(si.quantity * si.price_at_time), 0) AS total
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      JOIN sales s ON s.id = si.sale_id
      WHERE s.status IS NULL OR s.status != 'refunded'
      GROUP BY p.category
      ORDER BY total DESC
      LIMIT 6
    `);

    const daily = await safeQuery(`
      SELECT DATE(created_at) AS date, COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS orders
      FROM sales
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND (status IS NULL OR status != 'refunded')
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    const purchases = await safeQuery(`
      SELECT COUNT(*) AS purchase_count, COALESCE(SUM(total_amount), 0) AS purchase_value
      FROM purchases
      WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
    `);

    return NextResponse.json({
      metrics: {
        revenue: Number(metrics?.revenue || 0),
        orders: Number(metrics?.orders || 0),
        items_sold: Number(metrics?.items_sold || 0),
        average_order_value: Number(metrics?.average_order_value || 0),
        customers: Number(customers[0]?.total_customers || 0),
        gross_profit: Math.round(Number(metrics?.revenue || 0) * 0.22),
      },
      inventory: {
        total_products: Number(inventory?.total_products || 0),
        total_skus: Number(inventory?.total_skus || 0),
        in_stock: Number(inventory?.in_stock || 0),
        out_of_stock: Number(inventory?.out_of_stock || 0),
        low_stock: Number(inventory?.low_stock || 0),
        stock_value: Number(inventory?.stock_value || 0),
      },
      purchases: purchases[0] || { purchase_count: 0, purchase_value: 0 },
      low_stock: lowStock,
      recent_orders: recentOrders,
      top_products: topProducts,
      payment_methods: paymentMethods,
      categories,
      daily,
    });
  } catch (error) {
    console.error('Error loading dashboard:', error);
    return NextResponse.json({ error: 'Unable to load dashboard data' }, { status: 500 });
  }
}
