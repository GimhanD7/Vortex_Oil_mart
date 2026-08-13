<?php
global $pdo, $inputData, $id, $method;
requireAuth(); // Require auth

if ($method === 'GET' && !$id) {
    try {
        $stmt = $pdo->query('SELECT id, username, role, permissions, created_at FROM users ORDER BY id DESC');
        $users = $stmt->fetchAll();
        sendJson($users);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'POST' && !$id) {
    try {
        $username = isset($inputData['username']) ? trim($inputData['username']) : '';
        $password = isset($inputData['password']) ? $inputData['password'] : '';
        $role = isset($inputData['role']) ? $inputData['role'] : '';
        $permissions = isset($inputData['permissions']) && is_array($inputData['permissions']) ? $inputData['permissions'] : [];

        if (empty($username) || empty($password) || empty($role)) {
            sendJson(["error" => "Username, password, and role are required"], 400);
        }

        if (strlen($username) < 3 || strlen($password) < 6) {
            sendJson(["error" => "Username must be at least 3 characters and password at least 6 characters"], 400);
        }

        if (!in_array($role, ['admin', 'cashier'])) {
            sendJson(["error" => "Role must be admin or cashier"], 400);
        }

        $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
        $stmt->execute([$username]);
        if ($stmt->rowCount() > 0) {
            sendJson(["error" => "Username already exists"], 400);
        }

        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
        $permsJson = json_encode($permissions);

        $stmt = $pdo->prepare('INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)');
        $stmt->execute([$username, $hashedPassword, $role, $permsJson]);
        
        sendJson(["id" => $pdo->lastInsertId(), "message" => "User created"], 201);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'PUT' && $id) {
    try {
        $username = isset($inputData['username']) ? trim($inputData['username']) : '';
        $password = isset($inputData['password']) ? $inputData['password'] : '';
        $role = isset($inputData['role']) ? $inputData['role'] : '';
        $permissions = isset($inputData['permissions']) && is_array($inputData['permissions']) ? $inputData['permissions'] : [];

        if (empty($username) || empty($role)) {
            sendJson(["error" => "Username and role are required"], 400);
        }

        if (!in_array($role, ['admin', 'cashier'])) {
            sendJson(["error" => "Role must be admin or cashier"], 400);
        }

        if (!empty($password) && strlen($password) < 6) {
            sendJson(["error" => "Password must be at least 6 characters"], 400);
        }

        $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? AND id <> ?');
        $stmt->execute([$username, $id]);
        if ($stmt->rowCount() > 0) {
            sendJson(["error" => "Username already exists"], 400);
        }

        $permsJson = json_encode($permissions);

        if (!empty($password)) {
            $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
            $stmt = $pdo->prepare('UPDATE users SET username = ?, role = ?, password = ?, permissions = ? WHERE id = ?');
            $stmt->execute([$username, $role, $hashedPassword, $permsJson, $id]);
        } else {
            $stmt = $pdo->prepare('UPDATE users SET username = ?, role = ?, permissions = ? WHERE id = ?');
            $stmt->execute([$username, $role, $permsJson, $id]);
        }

        sendJson(["message" => "User updated successfully"]);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'DELETE' && $id) {
    try {
        $stmt = $pdo->prepare('SELECT role FROM users WHERE id = ?');
        $stmt->execute([$id]);
        $user = $stmt->fetch();
        
        if (!$user) {
            sendJson(["error" => "User not found"], 404);
        }
        
        if ($user['role'] === 'admin') {
            $stmt = $pdo->query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
            $adminCount = $stmt->fetch();
            if ($adminCount['count'] <= 1) {
                sendJson(["error" => "The last administrator cannot be deleted"], 400);
            }
        }
        
        $stmt = $pdo->prepare('DELETE FROM users WHERE id = ?');
        $stmt->execute([$id]);
        
        sendJson(["message" => "User deleted successfully"]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            sendJson(["error" => "Could not delete user. They may have associated sales records."], 400);
        }
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
