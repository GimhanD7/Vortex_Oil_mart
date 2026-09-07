const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { databaseOptions } = require('./db-config');

const base = process.env.API_TEST_BASE || 'http://127.0.0.1/Vortex_Oil_Mart/api';
const marker = `security_${crypto.randomBytes(6).toString('hex')}`;
const password = crypto.randomBytes(24).toString('hex');
const ids = [];
const cookies = [];

async function request(path, method = 'GET', cookie, body, extraHeaders = {}) {
  return fetch(`${base}${path}`, { method, redirect: 'manual', headers: {
    ...(cookie ? { Cookie: cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extraHeaders,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}

(async () => {
  const config = databaseOptions();
  assert.equal(process.env.APP_ENV, 'local', 'Security integration tests run only against local data.');
  assert.ok(['127.0.0.1', 'localhost'].includes(config.host));
  assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
  const db = await mysql.createConnection(config);
  try {
    for (const role of ['admin', 'cashier']) {
      const [result] = await db.execute('INSERT INTO users (username, password, role, permissions, employment_status) VALUES (?, ?, ?, ?, ?)', [
        `${marker}_${role}`, await bcrypt.hash(password, 10), role, JSON.stringify(role === 'cashier' ? ['pos_billing', 'view_inventory'] : []), 'active',
      ]);
      ids.push(result.insertId);
      const response = await request('/auth/login', 'POST', null, { username: `${marker}_${role}`, password });
      assert.equal(response.status, 200, `${role} login failed: ${await response.clone().text()}`);
      const header = response.headers.get('set-cookie');
      assert.match(header, /HttpOnly/i);
      assert.match(header, /SameSite=Lax/i);
      assert.equal((await response.json()).token, undefined, 'Login exposed token to JavaScript');
      cookies.push(header.split(';')[0]);
    }
    const [admin, cashier] = cookies;
    assert.equal((await request('/products')).status, 401);
    for (const path of ['/products', '/categories', '/sub_categories', '/brands', '/inventory', '/customers', '/settings', '/sales', '/notifications']) {
      assert.equal((await request(path, 'GET', cashier)).status, 200, `Cashier read failed: ${path}`);
    }
    for (const path of ['/users', '/reports', '/dashboard', '/purchases', '/inventory/movements', '/settings/backup']) {
      assert.equal((await request(path, 'GET', cashier)).status, 403, `Cashier accessed restricted endpoint: ${path}`);
    }
    for (const [path, method] of [['/products', 'POST'], ['/products/1', 'PUT'], ['/products/1', 'DELETE'], ['/products/import', 'POST'], ['/categories', 'POST'], ['/sub_categories', 'POST'], ['/brands', 'POST'], ['/inventory', 'POST'], ['/customers', 'POST'], ['/customers/1', 'PUT'], ['/customers/1', 'DELETE'], ['/purchases', 'POST'], ['/settings', 'POST'], ['/users', 'POST']]) {
      assert.equal((await request(path, method, cashier, {})).status, 403, `Cashier mutation was not blocked: ${method} ${path}`);
    }
    for (const path of ['/products', '/users', '/reports', '/dashboard', '/purchases']) assert.equal((await request(path, 'GET', admin)).status, 200, `Admin read failed: ${path}`);
    assert.equal((await request('/sales', 'POST', cashier, { cashier_id: ids[0], items: [] })).status, 403, 'Cashier could impersonate another account');
    assert.equal((await request('/settings', 'POST', admin, {}, { Origin: 'https://untrusted.example' })).status, 403, 'Cross-origin mutation accepted');
    assert.equal((await request('/settings', 'POST', admin, {}, { 'Sec-Fetch-Site': 'cross-site' })).status, 403, 'Cross-site mutation accepted');
    for (const path of ['/.env', '/.env.cpanel', '/config.php', '/session.php', '/test_db.zip', '/routes/products.php']) {
      const response = await fetch(`${base}${path}`, { redirect: 'manual' });
      assert.ok([403, 404].includes(response.status), `Private file accessible: ${path} (${response.status})`);
    }
    const root = base.replace(/\/api$/, '');
    for (const path of ['/.git/config', '/.local-backups/', '/scripts/reset_local_catalog.php', '/cpanel_database_schema.sql']) {
      assert.ok([403, 404].includes((await fetch(root + path, { redirect: 'manual' })).status), `Private workspace file accessible: ${path}`);
    }
    await db.execute("UPDATE users SET employment_status = 'inactive' WHERE id = ?", [ids[1]]);
    assert.equal((await request('/products', 'GET', cashier)).status, 401, 'Disabled user session still authorized');
    await db.execute("UPDATE users SET employment_status = 'inactive' WHERE id = ?", [ids[0]]);
    await db.execute("UPDATE users SET employment_status = 'active' WHERE id = ?", [ids[1]]);
    assert.equal((await request('/sales/revocations', 'POST', cashier, { action_type: 'completed_sale_voided', reason: 'security check', approver_username: `${marker}_admin`, approver_pin: password })).status, 403, 'Archived administrator could approve an action');
    await db.execute("UPDATE users SET employment_status = 'active' WHERE id = ?", [ids[0]]);
    await db.execute("UPDATE users SET employment_status = 'active', permissions = '[]' WHERE id = ?", [ids[1]]);
    assert.equal((await request('/products', 'GET', cashier)).status, 403, 'Stale token permissions were trusted');
    await db.execute('UPDATE users SET permissions = ? WHERE id = ?', [JSON.stringify(['pos_billing', 'view_inventory']), ids[1]]);
    assert.equal((await request('/auth/logout', 'POST', cashier, {})).status, 200);
    assert.equal((await request('/products', 'GET', cashier)).status, 401, 'Logged-out token could be replayed');
    let limited;
    for (let i = 0; i < 21; i++) limited = await request('/auth/login', 'POST', null, { username: `${marker}_missing`, password });
    assert.equal(limited.status, 429, 'Login rate limit not enforced');
    console.log('PASS: protected secrets, admin/cashier permissions, HttpOnly cookies, CSRF rejection, account status, current permissions, sale ownership, logout replay, login rate limiting.');
  } finally {
    for (const id of ids) {
      await db.execute('DELETE FROM auth_sessions WHERE user_id = ?', [id]).catch(() => {});
      await db.execute('DELETE FROM users WHERE id = ?', [id]);
    }
    for (const suffix of ['admin', 'cashier', 'missing']) {
      const key = crypto.createHash('sha256').update(`login:127.0.0.1:${marker}_${suffix}`).digest('hex');
      await db.execute('DELETE FROM auth_login_attempts WHERE attempt_key = ?', [key]).catch(() => {});
    }
    await db.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
