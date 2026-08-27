<?php
global $pdo, $jwt_secret, $inputData, $id, $action;

if ($method === 'POST' && $id === 'login') {
    $username = isset($inputData['username']) ? $inputData['username'] : '';
    $password = isset($inputData['password']) ? $inputData['password'] : '';

    if (empty($username) || empty($password)) {
        sendJson(["error" => "Username and password are required"], 400);
    }

    $stmt = $pdo->prepare('SELECT id, username, password, role, permissions FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user) {
        sendJson(["error" => "Invalid credentials"], 401);
    }

    // Verify password (bcrypt)
    if (!password_verify($password, $user['password'])) {
        sendJson(["error" => "Invalid credentials"], 401);
    }

    // Normalize permissions
    $permissions = [];
    if (!empty($user['permissions'])) {
        $decoded = json_decode($user['permissions'], true);
        if (is_array($decoded)) {
            $permissions = $decoded;
        } else {
            $permissions = [$user['permissions']];
        }
    } else {
        $permissions = $user['role'] === 'admin' 
            ? ['view_sales', 'manage_inventory', 'manage_products', 'manage_customers', 'view_reports', 'manage_users', 'pos_billing', 'view_inventory']
            : ['pos_billing', 'view_inventory'];
    }

    $payload = [
        'id' => $user['id'],
        'username' => $user['username'],
        'role' => $user['role'],
        'permissions' => $permissions,
        'exp' => time() + (86400) // 1 day expiration
    ];

    $token = signJWT($payload, $jwt_secret);

    // Set cookie (optional, primarily for Next.js, but good to have)
    setcookie('auth_token', $token, time() + 86400, '/', '', isset($_SERVER['HTTPS']), true);

    sendJson([
        "message" => "Login successful",
        "user" => [
            "id" => $user['id'],
            "username" => $user['username'],
            "role" => $user['role'],
            "permissions" => $permissions
        ],
        "token" => $token // Send token in response body too
    ]);
}

if ($method === 'GET' && $id === 'me') {
    // Both cookie and Bearer token check
    $user = authenticate();
    if (!$user && isset($_COOKIE['auth_token'])) {
        $user = verifyJWT($_COOKIE['auth_token'], $jwt_secret);
    }
    
    if (!$user) {
        sendJson(["error" => "Unauthorized"], 401);
    }

    $stmt = $pdo->prepare('SELECT id, username, role, permissions FROM users WHERE id = ? LIMIT 1');
    $stmt->execute([$user['id']]);
    $dbUser = $stmt->fetch();

    if (!$dbUser) {
        sendJson(["error" => "User not found"], 401);
    }

    // Normalize permissions
    $permissions = [];
    if (!empty($dbUser['permissions'])) {
        $decoded = json_decode($dbUser['permissions'], true);
        if (is_array($decoded)) {
            $permissions = $decoded;
        } else {
            $permissions = [$dbUser['permissions']];
        }
    } else {
        $permissions = $dbUser['role'] === 'admin' 
            ? ['view_sales', 'manage_inventory', 'manage_products', 'manage_customers', 'view_reports', 'manage_users', 'pos_billing', 'view_inventory']
            : ['pos_billing', 'view_inventory'];
    }

    sendJson([
        "id" => $dbUser['id'],
        "username" => $dbUser['username'],
        "role" => $dbUser['role'],
        "permissions" => $permissions
    ]);
}

if ($method === 'POST' && $id === 'verify-admin') {
    $username = isset($inputData['username']) ? $inputData['username'] : '';
    $password = isset($inputData['password']) ? $inputData['password'] : '';

    if (empty($username) || empty($password)) {
        sendJson(["error" => "Admin username and password are required"], 400);
    }

    $stmt = $pdo->prepare('SELECT id, password, role FROM users WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $adminUser = $stmt->fetch();

    if (!$adminUser || $adminUser['role'] !== 'admin') {
        sendJson(["error" => "Invalid admin credentials or insufficient permissions"], 403);
    }

    if (!password_verify($password, $adminUser['password'])) {
        sendJson(["error" => "Invalid admin password"], 401);
    }

    sendJson(["success" => true, "admin_id" => $adminUser['id']]);
}

sendJson(["error" => "Endpoint not found"], 404);
?>
