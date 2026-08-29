<?php
global $pdo, $inputData, $id, $method;
$currentUser = requireAuth();
if ($currentUser['role'] !== 'admin') sendJson(["error" => "Administrator access required"], 403);

function ensureEmployeeUserColumns() {
    global $pdo;
    $columns = ["full_name VARCHAR(150) NULL", "address VARCHAR(500) NULL", "phone VARCHAR(30) NULL", "id_number VARCHAR(80) NULL", "employment_start_date DATE NULL", "employment_end_date DATE NULL", "employment_status VARCHAR(20) NOT NULL DEFAULT 'active'", "employee_notes VARCHAR(1000) NULL"];
    $stmt = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'");
    $existing = $stmt->fetchAll(PDO::FETCH_COLUMN);
    foreach ($columns as $definition) {
        $name = explode(' ', $definition)[0];
        if (!in_array($name, $existing, true)) $pdo->exec("ALTER TABLE users ADD COLUMN $definition");
    }
}
ensureEmployeeUserColumns();

if ($method === 'GET' && !$id) {
    try {
        $stmt = $pdo->query('SELECT id, username, role, permissions, full_name, address, phone, id_number, employment_start_date, employment_end_date, employment_status, employee_notes, created_at FROM users ORDER BY id DESC');
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
        $fullName = trim($inputData['full_name'] ?? ''); $address = trim($inputData['address'] ?? '');
        $phone = trim($inputData['phone'] ?? ''); $idNumber = trim($inputData['id_number'] ?? '');
        $startDate = !empty($inputData['employment_start_date']) ? $inputData['employment_start_date'] : date('Y-m-d');
        $notes = trim($inputData['employee_notes'] ?? '');

        if (empty($username) || empty($password) || empty($role)) {
            sendJson(["error" => "Username, password, and role are required"], 400);
        }

        if (strlen($username) < 3 || strlen($password) < 6) {
            sendJson(["error" => "Username must be at least 3 characters and password at least 6 characters"], 400);
        }

        if (!in_array($role, ['admin', 'cashier'])) {
            sendJson(["error" => "Role must be admin or cashier"], 400);
        }
        if ($role === 'cashier' && (!$fullName || !$address || !$phone || !$idNumber || !$startDate)) sendJson(["error" => "Cashier full name, address, phone, ID number, and employment start date are required"], 400);

        $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ?');
        $stmt->execute([$username]);
        if ($stmt->rowCount() > 0) {
            sendJson(["error" => "Username already exists"], 400);
        }

        $hashedPassword = password_hash($password, PASSWORD_BCRYPT);
        $permsJson = json_encode($permissions);

        $stmt = $pdo->prepare("INSERT INTO users (username, password, role, permissions, full_name, address, phone, id_number, employment_start_date, employment_status, employee_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)");
        $stmt->execute([$username, $hashedPassword, $role, $permsJson, $fullName ?: null, $address ?: null, $phone ?: null, $idNumber ?: null, $startDate, $notes ?: null]);
        
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
        $fullName = trim($inputData['full_name'] ?? ''); $address = trim($inputData['address'] ?? '');
        $phone = trim($inputData['phone'] ?? ''); $idNumber = trim($inputData['id_number'] ?? '');
        $startDate = !empty($inputData['employment_start_date']) ? $inputData['employment_start_date'] : null;
        $endDate = !empty($inputData['employment_end_date']) ? $inputData['employment_end_date'] : null;
        $employmentStatus = ($inputData['employment_status'] ?? 'active') === 'inactive' ? 'inactive' : 'active';
        $notes = trim($inputData['employee_notes'] ?? '');

        if (empty($username) || empty($role)) {
            sendJson(["error" => "Username and role are required"], 400);
        }

        if (!in_array($role, ['admin', 'cashier'])) {
            sendJson(["error" => "Role must be admin or cashier"], 400);
        }
        if ($role === 'cashier' && (!$fullName || !$address || !$phone || !$idNumber || !$startDate)) sendJson(["error" => "Cashier full name, address, phone, ID number, and employment start date are required"], 400);
        if ($employmentStatus === 'inactive' && !$endDate) $endDate = date('Y-m-d');

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
            $stmt = $pdo->prepare('UPDATE users SET username=?, role=?, password=?, permissions=?, full_name=?, address=?, phone=?, id_number=?, employment_start_date=?, employment_end_date=?, employment_status=?, employee_notes=? WHERE id=?');
            $stmt->execute([$username,$role,$hashedPassword,$permsJson,$fullName?:null,$address?:null,$phone?:null,$idNumber?:null,$startDate,$endDate,$employmentStatus,$notes?:null,$id]);
        } else {
            $stmt = $pdo->prepare('UPDATE users SET username=?, role=?, permissions=?, full_name=?, address=?, phone=?, id_number=?, employment_start_date=?, employment_end_date=?, employment_status=?, employee_notes=? WHERE id=?');
            $stmt->execute([$username,$role,$permsJson,$fullName?:null,$address?:null,$phone?:null,$idNumber?:null,$startDate,$endDate,$employmentStatus,$notes?:null,$id]);
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
            $stmt = $pdo->query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND employment_status = 'active'");
            $adminCount = $stmt->fetch();
            if ($adminCount['count'] <= 1) {
                sendJson(["error" => "The last administrator cannot be deleted"], 400);
            }
        }
        
        $stmt = $pdo->prepare("UPDATE users SET employment_status='inactive', employment_end_date=COALESCE(employment_end_date, CURDATE()) WHERE id=?");
        $stmt->execute([$id]);
        
        sendJson(["message" => "User archived; employment history was preserved"]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            sendJson(["error" => "Could not delete user. They may have associated sales records."], 400);
        }
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
