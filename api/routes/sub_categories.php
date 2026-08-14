<?php
global $pdo, $inputData, $method;
requireAuth(); // Require auth for both GET and POST

$DEFAULT_SUB_CATEGORIES = [
  ['category_name' => 'Engine Oils', 'name' => 'Synthetic'],
  ['category_name' => 'Engine Oils', 'name' => 'Semi-Synthetic'],
  ['category_name' => 'Engine Oils', 'name' => 'Mineral'],
  ['category_name' => 'Gear Oils', 'name' => 'Automatic Transmission'],
  ['category_name' => 'Gear Oils', 'name' => 'Manual Transmission'],
  ['category_name' => 'Filters', 'name' => 'Oil Filter'],
  ['category_name' => 'Filters', 'name' => 'Air Filter'],
  ['category_name' => 'Filters', 'name' => 'Fuel Filter'],
  ['category_name' => 'Brake Pads', 'name' => 'Ceramic'],
  ['category_name' => 'Brake Pads', 'name' => 'Metallic'],
];

function ensureSubCategoriesTable() {
    global $pdo, $DEFAULT_SUB_CATEGORIES;
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS sub_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            category_name VARCHAR(100) NOT NULL,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY cat_subcat_idx (category_name, name)
        )
    ");
    
    // Insert defaults if empty
    $stmt = $pdo->query('SELECT COUNT(*) FROM sub_categories');
    if ($stmt->fetchColumn() == 0) {
        $insert = $pdo->prepare('INSERT IGNORE INTO sub_categories (category_name, name) VALUES (?, ?)');
        foreach ($DEFAULT_SUB_CATEGORIES as $sub) {
            $insert->execute([$sub['category_name'], $sub['name']]);
        }
    }
}

if ($method === 'GET') {
    try {
        ensureSubCategoriesTable();
        $category = isset($_GET['category']) ? $_GET['category'] : '';
        
        if ($category) {
            $stmt = $pdo->prepare('SELECT * FROM sub_categories WHERE category_name = ? ORDER BY name ASC');
            $stmt->execute([$category]);
        } else {
            $stmt = $pdo->query('SELECT * FROM sub_categories ORDER BY category_name ASC, name ASC');
        }
        
        $sub_categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
        sendJson($sub_categories);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error: " . $e->getMessage()], 500);
    }
}

if ($method === 'POST') {
    try {
        ensureSubCategoriesTable();
        $category_name = isset($inputData['category_name']) ? trim($inputData['category_name']) : '';
        $name = isset($inputData['name']) ? trim($inputData['name']) : '';
        
        if (empty($name) || empty($category_name)) {
            sendJson(["error" => "Category and Name are required"], 400);
        }
        
        $stmt = $pdo->prepare('INSERT IGNORE INTO sub_categories (category_name, name) VALUES (?, ?)');
        $stmt->execute([$category_name, $name]);
        sendJson(["id" => $pdo->lastInsertId(), "message" => "Sub-Category added"], 201);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
