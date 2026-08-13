<?php
global $pdo, $inputData, $method;
requireAuth(); // Require auth for both GET and POST

$DEFAULT_CATEGORIES = [
  'Engine Oils', 'Gear Oils', 'Lubricants', 'Filters', 'Brake Pads', 'Batteries', 'Spark Plugs', 'General'
];

function ensureCategoriesTable() {
    global $pdo, $DEFAULT_CATEGORIES;
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("
        INSERT IGNORE INTO categories (name)
        SELECT DISTINCT category
        FROM products
        WHERE category IS NOT NULL AND category != ''
    ");
    
    $stmt = $pdo->prepare('INSERT IGNORE INTO categories (name) VALUES (?)');
    foreach ($DEFAULT_CATEGORIES as $category) {
        $stmt->execute([$category]);
    }
}

if ($method === 'GET') {
    try {
        ensureCategoriesTable();
        $stmt = $pdo->query('SELECT * FROM categories ORDER BY name ASC');
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
        
        $stmt = $pdo->prepare('INSERT IGNORE INTO categories (name) VALUES (?)');
        $stmt->execute([$name]);
        sendJson(["id" => $pdo->lastInsertId(), "message" => "Category added"], 201);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
