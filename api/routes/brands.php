<?php
global $pdo, $inputData, $method;
requireAuth(); // Require auth for both GET and POST

$DEFAULT_BRANDS = [
  'Shell India', 'ExxonMobil', 'Castrol India', 'Bosch Ltd.', 'Amaron', 'Brembo India', 'NGK India', 'Mann+Hummel', 'Generic'
];

function ensureBrandsTable() {
    global $pdo, $DEFAULT_BRANDS;
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS brands (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ");
    $pdo->exec("
        INSERT IGNORE INTO brands (name)
        SELECT DISTINCT brand
        FROM products
        WHERE brand IS NOT NULL AND brand != ''
    ");
    
    $stmt = $pdo->prepare('INSERT IGNORE INTO brands (name) VALUES (?)');
    foreach ($DEFAULT_BRANDS as $brand) {
        $stmt->execute([$brand]);
    }
}

if ($method === 'GET') {
    try {
        ensureBrandsTable();
        $stmt = $pdo->query('SELECT * FROM brands ORDER BY name ASC');
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
        
        $stmt = $pdo->prepare('INSERT IGNORE INTO brands (name) VALUES (?)');
        $stmt->execute([$name]);
        sendJson(["id" => $pdo->lastInsertId(), "message" => "Brand added"], 201);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
