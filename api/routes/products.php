<?php
global $pdo, $inputData, $id, $method;
requireAuth(); // All product endpoints require authentication

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

if ($method === 'GET' && !$id) {
    try {
        $stmt = $pdo->query('SELECT * FROM products ORDER BY id DESC');
        $products = $stmt->fetchAll();
        sendJson($products);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'POST' && !$id) {
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
