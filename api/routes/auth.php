<?php
global $pdo, $jwt_secret, $inputData, $id, $method;

// Compatibility for installations created before employee status was added.
$statusColumn = $pdo->query("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'employment_status'")->fetchColumn();
if (!(int)$statusColumn) $pdo->exec("ALTER TABLE users ADD COLUMN employment_status VARCHAR(20) NOT NULL DEFAULT 'active'");

if ($method === 'POST' && in_array($id, ['login', 'verify-admin'], true)) {
    if ($id === 'verify-admin') requireAuth();
    $username = $inputData['username'] ?? '';
    $password = $inputData['password'] ?? '';
    if (!is_string($username) || !is_string($password) || $username === '' || $password === '' || strlen($username) > 255 || strlen($password) > 1024) {
        sendJson(['error' => 'A valid username and password are required.'], 400);
    }
    enforceLoginRateLimit($username);
    $stmt = $pdo->prepare('SELECT id, username, password, role, permissions, employment_status FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    if (!$user || $user['employment_status'] !== 'active' || !password_verify($password, $user['password']) || ($id === 'verify-admin' && $user['role'] !== 'admin')) {
        sendJson(['error' => 'Invalid credentials.'], 401);
    }
    if ($id === 'verify-admin') sendJson(['success' => true, 'admin_id' => $user['id']]);

    $expires = time() + 86400;
    $token = signJWT(['id' => (int)$user['id'], 'iat' => time(), 'exp' => $expires, 'jti' => bin2hex(random_bytes(24))], $jwt_secret);
    $pdo->prepare('INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, FROM_UNIXTIME(?))')->execute([hash('sha256', $token), $user['id'], $expires]);
    $pdo->exec('DELETE FROM auth_sessions WHERE expires_at <= NOW() LIMIT 100');
    setcookie('auth_token', $token, sessionCookieOptions($expires));
    sendJson(['message' => 'Login successful', 'user' => [
        'id' => (int)$user['id'], 'username' => $user['username'], 'role' => $user['role'], 'permissions' => userPermissions($user),
    ]]);
}

if ($method === 'POST' && $id === 'logout') {
    ensureAuthTables();
    $tokens = [];
    if (isset($_COOKIE['auth_token']) && is_string($_COOKIE['auth_token'])) $tokens[] = $_COOKIE['auth_token'];
    if (preg_match('/Bearer\s(\S+)/', getAuthorizationHeader() ?? '', $matches)) $tokens[] = $matches[1];
    $stmt = $pdo->prepare('DELETE FROM auth_sessions WHERE token_hash = ?');
    foreach (array_unique($tokens) as $token) $stmt->execute([hash('sha256', $token)]);
    setcookie('auth_token', '', sessionCookieOptions(time() - 3600));
    sendJson(['message' => 'Logged out']);
}

if ($method === 'GET' && $id === 'me') sendJson(requireAuth());
sendJson(['error' => 'Endpoint not found'], 404);
