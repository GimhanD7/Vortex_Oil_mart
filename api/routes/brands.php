<?php
global $pdo, $inputData, $method;
requireAuth(); // Require auth for both GET and POST

function ensureBrandsTable() {
    global $pdo;
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS brands (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
}

if ($method === 'GET') {
    try {
        ensureBrandsTable();
        $stmt = $pdo->query('SELECT MIN(id) AS id, name FROM brands GROUP BY name ORDER BY name ASC');
        $brands = $stmt->fetchAll();
        sendJson($brands);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'POST') {
    try {
        ensureBrandsTable();
        $name = isset($inputData['name']) ? trim($inputData['name']) : '';
        if (empty($name)) {
            sendJson(["error" => "Name is required"], 400);
        }
        
        $existing = $pdo->prepare('SELECT MIN(id) FROM brands WHERE name = ?');
        $existing->execute([$name]);
        if ($existingId = $existing->fetchColumn()) sendJson(["id" => $existingId, "message" => "Brand already exists"], 200);
        $stmt = $pdo->prepare('INSERT IGNORE INTO brands (name) VALUES (?)');
        $stmt->execute([$name]);
        sendJson(["id" => $pdo->lastInsertId(), "message" => "Brand added"], 201);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
