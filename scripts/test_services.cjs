const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { databaseOptions } = require('./db-config');

const base = process.env.API_TEST_BASE || 'http://127.0.0.1/Vortex_Oil_Mart/api';
const marker = `service_test_${crypto.randomBytes(6).toString('hex')}`;
const password = crypto.randomBytes(24).toString('hex');

(async () => {
  const config = databaseOptions();
  assert.equal(process.env.APP_ENV, 'local', 'Run service tests only against local data.');
  assert.ok(['127.0.0.1', 'localhost'].includes(config.host));
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
  const db = await mysql.createConnection(config);
  let userId;
  let cookie;
  const products = [];
  const sales = [];
  async function request(path, method = 'GET', body, expected = 200) {
    const response = await fetch(base + path, {
      method, redirect: 'manual', headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(body === undefined || body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
    const result = await response.json();
    assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
    return result;
  }
  async function product(name, type, stock = 0) {
    const body = { name: `${marker}_${name}`, sku: `${marker}_${name}`, price: 200, product_type: type, stock_quantity: stock };
    const result = await request('/products', 'POST', body, 201);
    products.push(Number(result.id));
    return { ...body, id: Number(result.id) };
  }
  async function stock(id) {
    const [rows] = await db.execute('SELECT stock_quantity FROM products WHERE id = ?', [id]);
    return Number(rows[0].stock_quantity);
  }
  async function sell(items, expected = 201) {
    const result = await request('/sales', 'POST', { items, payment_method: 'Cash' }, expected);
    if (result.saleId) sales.push(Number(result.saleId));
    return Number(result.saleId);
  }
  try {
    const [created] = await db.execute('INSERT INTO users (username, password, role, permissions, employment_status) VALUES (?, ?, ?, ?, ?)',
      [marker, await bcrypt.hash(password, 10), 'admin', '[]', 'active']);
    userId = created.insertId;
    const login = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: marker, password }) });
    assert.equal(login.status, 200, 'Test login failed');
    cookie = login.headers.get('set-cookie').split(';')[0];

    const service = await product('charging', 'service', 99);
    const physical = await product('physical', 'packaged', 5);
    const empty = await product('convertible', 'packaged');
    assert.equal(await stock(service.id), 0, 'Service must ignore physical stock');
    await request(`/products/${empty.id}`, 'PUT', { ...empty, product_type: 'service' });
    await request(`/products/${physical.id}`, 'PUT', { ...physical, product_type: 'service' }, 400);

    const mixedSale = await sell([{ product_id: service.id, quantity: 2 }, { product_id: physical.id, quantity: 1 }]);
    assert.equal(await stock(service.id), 0);
    assert.equal(await stock(physical.id), 4);
    const [totals] = await db.execute('SELECT total_amount FROM sales WHERE id = ?', [mixedSale]);
    assert.equal(Number(totals[0].total_amount), 600);
    await sell([{ product_id: service.id, quantity: 1.5 }], 400);
    await sell([{ product_id: physical.id, quantity: 100 }], 400);
    await request(`/products/${service.id}`, 'PUT', { ...service, product_type: 'packaged', stock_quantity: 0 }, 400);
    const [items] = await db.execute('SELECT id FROM sale_items WHERE sale_id = ? AND product_id = ?', [mixedSale, service.id]);
    const returnBody = { reason: 'Service regression test', resolution: 'Cash', items: [{ sale_item_id: items[0].id, quantity: 1, disposition: 'resellable' }] };
    await request(`/sales/${mixedSale}/returns`, 'POST', { ...returnBody, items: [{ ...returnBody.items[0], quantity: 0.5 }] }, 400);
    await request(`/sales/${mixedSale}/returns`, 'POST', returnBody, 201);
    assert.equal(await stock(service.id), 0, 'Refund must not restore service stock');
    const cancelled = await sell([{ product_id: service.id, quantity: 3 }]);
    await request(`/sales/${cancelled}`, 'PATCH', { action: 'cancel', reason: 'Service regression test' });
    assert.equal(await stock(service.id), 0, 'Cancellation must not restore service stock');
    await request('/inventory', 'POST', { product_id: service.id, quantity_change: 1 }, 400);
    const inventory = await request('/inventory');
    assert.ok(!inventory.items.some(item => Number(item.id) === service.id));
    const [movements] = await db.execute('SELECT COUNT(*) AS count FROM inventory_movements WHERE product_id = ?', [service.id]);
    assert.equal(Number(movements[0].count), 0);

    const csv = new FormData();
    csv.append('file', new Blob([`Name,SKU,Price,Product Type,Stock Quantity\n${empty.name},${empty.sku},300,service,50\n`], { type: 'text/csv' }), 'services.csv');
    await request('/products/import', 'POST', csv);
    assert.equal(await stock(empty.id), 0, 'CSV service import must ignore stock');
    console.log('PASS: service create/edit/import, mixed sale totals, whole-number quantity, stock isolation, refunds, cancellations, inventory exclusion and type-history protection.');
  } finally {
    for (const id of sales) {
      await db.execute('DELETE sri FROM sale_return_items sri JOIN sale_returns sr ON sr.id = sri.return_id WHERE sr.original_sale_id = ?', [id]);
      await db.execute('DELETE FROM sale_returns WHERE original_sale_id = ?', [id]);
      await db.execute('DELETE FROM sale_items WHERE sale_id = ?', [id]);
      await db.execute('DELETE FROM sales WHERE id = ?', [id]);
    }
    for (const id of products) {
      await db.execute('DELETE FROM inventory_movements WHERE product_id = ?', [id]);
      await db.execute('DELETE FROM products WHERE id = ?', [id]);
    }
    if (userId) {
      await db.execute('DELETE FROM auth_sessions WHERE user_id = ?', [userId]);
      await db.execute('DELETE FROM users WHERE id = ?', [userId]);
    }
    await db.end();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
