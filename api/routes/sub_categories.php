<?php
global $pdo, $inputData, $method;
requireAuth(); // Require auth for both GET and POST

function ensureSubCategoriesTable() {
    global $pdo;
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS sub_categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            category_name VARCHAR(100) NOT NULL,
            name VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY cat_subcat_idx (category_name, name)
        )
    ");
    
}

if ($method === 'GET') {
    try {
        ensureSubCategoriesTable();
        $category = isset($_GET['category']) ? $_GET['category'] : '';
        
        if ($category) {
            $stmt = $pdo->prepare('SELECT MIN(id) AS id, category_name, name FROM sub_categories WHERE category_name = ? GROUP BY category_name, name ORDER BY name ASC');
            $stmt->execute([$category]);
        } else {
            $stmt = $pdo->query('SELECT MIN(id) AS id, category_name, name FROM sub_categories GROUP BY category_name, name ORDER BY category_name ASC, name ASC');
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
        
        $existing = $pdo->prepare('SELECT MIN(id) FROM sub_categories WHERE category_name = ? AND name = ?');
        $existing->execute([$category_name, $name]);
        if ($existingId = $existing->fetchColumn()) sendJson(["id" => $existingId, "message" => "Sub-Category already exists"], 200);
        $stmt = $pdo->prepare('INSERT IGNORE INTO sub_categories (category_name, name) VALUES (?, ?)');
        $stmt->execute([$category_name, $name]);
        sendJson(["id" => $pdo->lastInsertId(), "message" => "Sub-Category added"], 201);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
