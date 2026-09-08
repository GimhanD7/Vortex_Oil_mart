<?php
global $pdo, $inputData, $id, $method;
requireAuth(); // All product endpoints require authentication
require_once __DIR__ . '/../product-import.php';

if (in_array($method, ['PUT', 'DELETE'], true) && filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]) === false) {
    sendJson(['error' => 'Invalid product ID. The database record needs repair; no product was changed.', 'code' => 'invalid_product_id'], 409);
}
if ($method === 'POST' && $id !== null && $id !== 'import') sendJson(['error' => 'Endpoint not found'], 404);
if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) {
    try { assertProductIdentitySchema($pdo); }
    catch (InvalidArgumentException $e) { sendJson(['error' => $e->getMessage(), 'code' => 'invalid_product_schema'], 409); }
}
if (in_array($method, ['PUT', 'DELETE'], true)) {
    $existingProduct = $pdo->prepare('SELECT id FROM products WHERE id = ?');
    $existingProduct->execute([$id]);
    if (!$existingProduct->fetch()) sendJson(['error' => 'Product not found. Refresh the product list.'], 404);
}

try {
    $pdo->exec("ALTER TABLE products ADD COLUMN sub_category VARCHAR(100) DEFAULT 'General'");
} catch (PDOException $e) {
    // Column likely already exists
}

function ensureLooseOilProductColumns() {
    global $pdo;
    $columnAdds = [
        "product_type" => "ALTER TABLE products ADD COLUMN product_type VARCHAR(30) NOT NULL DEFAULT 'packaged'",
        "unit" => "ALTER TABLE products ADD COLUMN unit VARCHAR(20) NOT NULL DEFAULT 'Unit'",
        "barrel_capacity_liters" => "ALTER TABLE products ADD COLUMN barrel_capacity_liters DECIMAL(10,3) NULL",
    ];

    foreach ($columnAdds as $query) {
        try {
            $pdo->exec($query);
        } catch (PDOException $e) {
            // Column likely already exists
        }
    }

    foreach ([
        "ALTER TABLE products MODIFY COLUMN stock_quantity DECIMAL(12,3) NOT NULL DEFAULT 0",
        "ALTER TABLE products MODIFY COLUMN reorder_level DECIMAL(12,3) NOT NULL DEFAULT 10",
    ] as $query) {
        try {
            $pdo->exec($query);
        } catch (PDOException $e) {
            // Older databases may already be compatible
        }
    }

    try {
        $pdo->exec("UPDATE products SET product_type = 'packaged' WHERE product_type IS NULL OR product_type = ''");
        $pdo->exec("UPDATE products SET unit = 'Unit' WHERE unit IS NULL OR unit = ''");
    } catch (PDOException $e) {
        // Best-effort normalization
    }
}

ensureLooseOilProductColumns();

if ($method === 'POST' && $id === 'import') {
    $user = requireAuth();
    if (($user['role'] ?? '') !== 'admin' && !in_array('manage_products', $user['permissions'] ?? [], true)) {
        sendJson(['error' => 'Product management permission is required.'], 403);
    }
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
        sendJson(['error' => 'Upload a valid product CSV file.'], 400);
    }
    try {
        $stream = fopen($_FILES['file']['tmp_name'], 'rb');
        try {
            $rows = readProductCsv($stream);
        } finally {
            fclose($stream);
        }
        ensureProductImportTables($pdo);
        $pdo->beginTransaction();
        $result = importProductRows($pdo, $rows, (int)$user['id']);
        $pdo->commit();
        sendJson($result + ['message' => 'Products imported successfully.']);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        $invalid = $e instanceof InvalidArgumentException;
        sendJson(['error' => $invalid ? $e->getMessage() : 'Import failed. No products were changed. Check for duplicate SKUs or invalid values.'], $invalid ? 400 : 500);
    }
}

if ($method === 'GET' && $id === null) {
    try {
        $stmt = $pdo->query('SELECT * FROM products ORDER BY id DESC');
        $products = $stmt->fetchAll();
        sendJson($products);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'POST' && $id === null) {
    try {
        $name = isset($inputData['name']) ? trim($inputData['name']) : '';
        $price = isset($inputData['price']) ? $inputData['price'] : null;
        $description = isset($inputData['description']) ? $inputData['description'] : '';
        $stock_quantity = isset($inputData['stock_quantity']) ? $inputData['stock_quantity'] : 0;
        $sku = isset($inputData['sku']) ? $inputData['sku'] : null;
        $barcode = isset($inputData['barcode']) ? $inputData['barcode'] : null;
        $category = isset($inputData['category']) ? $inputData['category'] : 'Uncategorized';
        $sub_category = isset($inputData['sub_category']) ? $inputData['sub_category'] : 'General';
        $brand = isset($inputData['brand']) ? $inputData['brand'] : 'Generic';
        $product_type = isset($inputData['product_type']) && $inputData['product_type'] === 'loose_oil' ? 'loose_oil' : 'packaged';
        $unit = isset($inputData['unit']) ? trim($inputData['unit']) : ($product_type === 'loose_oil' ? 'L' : 'Unit');
        if ($unit === '') $unit = $product_type === 'loose_oil' ? 'L' : 'Unit';
        $barrel_capacity_liters = isset($inputData['barrel_capacity_liters']) && $inputData['barrel_capacity_liters'] !== '' ? (float)$inputData['barrel_capacity_liters'] : null;
        $reorder_level = isset($inputData['reorder_level']) ? (float)$inputData['reorder_level'] : ($product_type === 'loose_oil' ? 20 : 10);
        $location = isset($inputData['location']) ? $inputData['location'] : 'Main Store';
        $batch_no = isset($inputData['batch_no']) ? $inputData['batch_no'] : null;
        $supplier = isset($inputData['supplier']) ? $inputData['supplier'] : 'Not Assigned';

        if (empty($name) || $price === null) {
            sendJson(["error" => "Name and price are required"], 400);
        }

        $numericPrice = (float)$price;
        $numericStock = (float)$stock_quantity;

        if ($numericPrice < 0 || $numericStock < 0 || $reorder_level < 0 || ($barrel_capacity_liters !== null && $barrel_capacity_liters <= 0)) {
            sendJson(["error" => "Price and stock must be valid non-negative numbers"], 400);
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare('
            INSERT INTO products 
            (name, description, price, stock_quantity, sku, barcode, category, sub_category, brand, product_type, unit, barrel_capacity_liters, reorder_level, location, batch_no, supplier)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $name, $description, $numericPrice, $numericStock, $sku, $barcode, 
            $category, $sub_category, $brand, $product_type, $unit, $barrel_capacity_liters, $reorder_level, $location, $batch_no, $supplier
        ]);

        $productId = $pdo->lastInsertId();

        if ($numericStock > 0) {
            $stmt = $pdo->prepare("
                INSERT INTO inventory_movements
                (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, notes)
                VALUES (?, 'in', ?, 0, ?, ?, 'Initial product stock')
            ");
            $stmt->execute([$productId, $numericStock, $numericStock, $numericPrice]);
        }

        $pdo->commit();
        sendJson(["id" => $productId, "message" => "Product created"], 201);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        if ($e->getCode() == 23000) { // Duplicate entry
            sendJson(["error" => "Product with this SKU/Barcode already exists"], 400);
        }
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'PUT' && $id) {
    try {
        $name = isset($inputData['name']) ? trim($inputData['name']) : '';
        $price = isset($inputData['price']) ? $inputData['price'] : null;
        $description = isset($inputData['description']) ? $inputData['description'] : '';
        $stock_quantity = isset($inputData['stock_quantity']) ? (float)$inputData['stock_quantity'] : 0;
        $sku = isset($inputData['sku']) ? $inputData['sku'] : null;
        $category = isset($inputData['category']) ? $inputData['category'] : 'Uncategorized';
        $sub_category = isset($inputData['sub_category']) ? $inputData['sub_category'] : 'General';
        $brand = isset($inputData['brand']) ? $inputData['brand'] : 'Generic';
        $product_type = isset($inputData['product_type']) && $inputData['product_type'] === 'loose_oil' ? 'loose_oil' : 'packaged';
        $unit = isset($inputData['unit']) ? trim($inputData['unit']) : ($product_type === 'loose_oil' ? 'L' : 'Unit');
        if ($unit === '') $unit = $product_type === 'loose_oil' ? 'L' : 'Unit';
        $barrel_capacity_liters = isset($inputData['barrel_capacity_liters']) && $inputData['barrel_capacity_liters'] !== '' ? (float)$inputData['barrel_capacity_liters'] : null;
        $reorder_level = isset($inputData['reorder_level']) ? (float)$inputData['reorder_level'] : ($product_type === 'loose_oil' ? 20 : 10);

        if (empty($name) || $price === null) {
            sendJson(["error" => "Name and price are required"], 400);
        }

        if ((float)$price < 0 || $stock_quantity < 0 || $reorder_level < 0 || ($barrel_capacity_liters !== null && $barrel_capacity_liters <= 0)) {
            sendJson(["error" => "Price, stock, reorder level, and barrel capacity must be valid numbers"], 400);
        }

        $stmt = $pdo->prepare('
            UPDATE products
            SET name = ?, description = ?, price = ?, stock_quantity = ?, sku = ?, category = ?, sub_category = ?,
                brand = ?, product_type = ?, unit = ?, barrel_capacity_liters = ?, reorder_level = ?
            WHERE id = ?
        ');
        $stmt->execute([
            $name, $description, (float)$price, $stock_quantity, $sku, $category, $sub_category,
            $brand, $product_type, $unit, $barrel_capacity_liters, $reorder_level, $id
        ]);

        sendJson(["message" => "Product updated successfully"]);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'DELETE' && $id) {
    try {
        $stmt = $pdo->prepare('DELETE FROM products WHERE id = ?');
        $stmt->execute([$id]);
        sendJson(["message" => "Product deleted successfully"]);
    } catch (PDOException $e) {
        // Foreign key constraint fails if product has sales
        if ($e->getCode() == 23000) {
            sendJson(["error" => "Could not delete product. It may be linked to existing sales."], 400);
        }
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
