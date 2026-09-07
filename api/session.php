<?php

function ensureAuthTables(): void {
    global $pdo;
    static $ready = false;
    if ($ready) return;
    $pdo->exec("CREATE TABLE IF NOT EXISTS auth_sessions (
        token_hash CHAR(64) PRIMARY KEY, user_id INT NOT NULL,
        expires_at DATETIME NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_auth_expiry (expires_at), INDEX idx_auth_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $pdo->exec("CREATE TABLE IF NOT EXISTS auth_login_attempts (
        attempt_key CHAR(64) PRIMARY KEY, attempts INT NOT NULL DEFAULT 0,
        window_started DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    $ready = true;
}

function enforceLoginRateLimit(string $username): void {
    global $pdo;
    ensureAuthTables();
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    foreach (['ip:' . $ip => 100, 'login:' . $ip . ':' . strtolower($username) => 20] as $scope => $limit) {
        $key = hash('sha256', $scope);
        $stmt = $pdo->prepare("INSERT INTO auth_login_attempts (attempt_key, attempts, window_started) VALUES (?, 1, NOW())
            ON DUPLICATE KEY UPDATE attempts = IF(window_started < DATE_SUB(NOW(), INTERVAL 15 MINUTE), 1, attempts + 1),
            window_started = IF(window_started < DATE_SUB(NOW(), INTERVAL 15 MINUTE), NOW(), window_started)");
        $stmt->execute([$key]);
        $stmt = $pdo->prepare('SELECT attempts FROM auth_login_attempts WHERE attempt_key = ?');
        $stmt->execute([$key]);
        if ((int)$stmt->fetchColumn() > $limit) {
            header('Retry-After: 900');
            sendJson(['error' => 'Too many login attempts. Try again later.'], 429);
        }
    }
    $pdo->exec('DELETE FROM auth_login_attempts WHERE window_started < DATE_SUB(NOW(), INTERVAL 1 DAY) LIMIT 100');
}

function sessionCookieOptions(int $expires): array {
    return [
        'expires' => $expires,
        'path' => '/',
        'secure' => appEnv('APP_ENV', 'production') !== 'local' || (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ];
}

function userPermissions(array $user): array {
    $permissions = json_decode($user['permissions'] ?? '[]', true);
    return is_array($permissions) ? array_values(array_filter($permissions, 'is_string')) : [];
}

function requirePermission(string ...$permissions): array {
    $user = requireAuth();
    if ($user['role'] !== 'admin' && !array_intersect($permissions, $user['permissions'])) {
        sendJson(['error' => 'You do not have permission to perform this action.'], 403);
    }
    return $user;
}

function authorizeEndpoint(string $resource, string $method, ?string $id, ?string $action): void {
    $user = requireAuth();
    if ($user['role'] === 'admin') return;
    $read = $method === 'GET';
    switch ($resource) {
        case 'products': case 'categories': case 'sub_categories': case 'brands':
            if ($read) requirePermission('manage_products', 'manage_inventory', 'view_inventory', 'pos_billing');
            else requirePermission('manage_products');
            return;
        case 'inventory':
            if ($read && !$id) requirePermission('view_inventory', 'manage_inventory', 'pos_billing');
            else requirePermission('manage_inventory');
            return;
        case 'customers':
            if ($read || ($method === 'POST' && $action === 'payments')) requirePermission('manage_customers', 'pos_billing');
            else requirePermission('manage_customers');
            return;
        case 'sales':
            if ($read) requirePermission('view_sales', 'pos_billing');
            else requirePermission('pos_billing');
            return;
        case 'purchases': requirePermission('manage_inventory'); return;
        case 'reports': case 'dashboard': requirePermission('view_reports'); return;
        case 'settings':
            if ($read && !$id) return;
            requirePermission('manage_settings'); return;
        case 'notifications': return;
        default: sendJson(['error' => 'Administrator access required.'], 403);
    }
}

function requireSameOrigin(): void {
    if (in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', ['GET', 'HEAD', 'OPTIONS'], true)) return;
    if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') sendJson(['error' => 'Cross-site request rejected.'], 403);
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return;
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $default = appEnv('APP_ENV') === 'local' ? 'http://localhost:3000' : ($secure ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '');
    $expected = rtrim(appEnv('APP_ORIGIN', $default), '/');
    if ($origin !== $expected) sendJson(['error' => 'Cross-origin request rejected.'], 403);
}
