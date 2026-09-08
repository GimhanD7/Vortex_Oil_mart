<?php
global $pdo, $inputData, $method;
requireAuth(); // Require auth for both GET and POST

function ensureCategoriesTable() {
    global $pdo;
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    
}

if ($method === 'GET') {
    try {
        ensureCategoriesTable();
        $stmt = $pdo->query('SELECT MIN(id) AS id, name FROM categories GROUP BY name ORDER BY name ASC');
        $categories = $stmt->fetchAll();
        sendJson($categories);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'POST') {
    try {
        ensureCategoriesTable();
        $name = isset($inputData['name']) ? trim($inputData['name']) : '';
        if (empty($name)) {
            sendJson(["error" => "Name is required"], 400);
        }
        
        $existing = $pdo->prepare('SELECT MIN(id) FROM categories WHERE name = ?');
        $existing->execute([$name]);
        if ($existingId = $existing->fetchColumn()) sendJson(["id" => $existingId, "message" => "Category already exists"], 200);
        $stmt = $pdo->prepare('INSERT IGNORE INTO categories (name) VALUES (?)');
        $stmt->execute([$name]);
        sendJson(["id" => $pdo->lastInsertId(), "message" => "Category added"], 201);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
