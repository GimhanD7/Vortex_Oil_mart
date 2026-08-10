import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Daily Sales (Last 30 Days)
    const [dailyRows] = await pool.query(`
      SELECT DATE(created_at) as date, SUM(total_amount) as total, COUNT(id) as orders
      FROM sales
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Monthly Sales (Last 12 Months)
    const [monthlyRows] = await pool.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, SUM(total_amount) as total, COUNT(id) as orders
      FROM sales
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      GROUP BY month
      ORDER BY month ASC
    `);

    // Yearly Sales
    const [yearlyRows] = await pool.query(`
      SELECT YEAR(created_at) as year, SUM(total_amount) as total, COUNT(id) as orders
      FROM sales
      GROUP BY year
      ORDER BY year ASC
    `);

    // Brand Wise Sales
    const [brandRows] = await pool.query(`
      SELECT p.brand, SUM(si.quantity * si.price_at_time) as total, SUM(si.quantity) as items_sold
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      GROUP BY p.brand
      ORDER BY total DESC
    `);
    
    // Category Wise Sales
    const [categoryRows] = await pool.query(`
      SELECT p.category, SUM(si.quantity * si.price_at_time) as total, SUM(si.quantity) as items_sold
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      GROUP BY p.category
      ORDER BY total DESC
    `);

    // Staff / Cashier Performance
    const [staffRows] = await pool.query(`
      SELECT u.username as cashier, COUNT(s.id) as orders, SUM(s.total_amount) as total
      FROM sales s
      LEFT JOIN users u ON s.cashier_id = u.id
      GROUP BY u.id, u.username
      ORDER BY total DESC
    `);

    const [paymentRows] = await pool.query(`
      SELECT COALESCE(payment_method, 'Cash') AS payment_method, COUNT(*) AS orders, SUM(total_amount) AS total
      FROM sales
      WHERE status IS NULL OR status != 'refunded'
      GROUP BY COALESCE(payment_method, 'Cash')
      ORDER BY total DESC
    `);

    const [purchaseRows] = await pool.query(`
      SELECT DATE(created_at) AS date, COUNT(*) AS purchases, SUM(total_amount) AS total
      FROM purchases
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    const [movementRows] = await pool.query(`
      SELECT movement_type, COUNT(*) AS transactions,
             SUM(quantity_change) AS quantity,
             SUM(ABS(quantity_change) * unit_price) AS value
      FROM inventory_movements
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY movement_type
      ORDER BY value DESC
    `);

    return NextResponse.json({
      daily: dailyRows,
      monthly: monthlyRows,
      yearly: yearlyRows,
      brands: brandRows,
      categories: categoryRows,
      staff: staffRows,
      payment_methods: paymentRows,
      purchases: purchaseRows,
      inventory_movements: movementRows
    });
  } catch (error) {
    console.error('Error fetching reports data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
