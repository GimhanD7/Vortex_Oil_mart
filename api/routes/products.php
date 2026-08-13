<?php
global $pdo, $inputData, $id, $method;
requireAuth(); // All product endpoints require authentication

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
        $brand = isset($inputData['brand']) ? $inputData['brand'] : 'Generic';
        $reorder_level = isset($inputData['reorder_level']) ? (int)$inputData['reorder_level'] : 10;
        $location = isset($inputData['location']) ? $inputData['location'] : 'Main Store';
        $batch_no = isset($inputData['batch_no']) ? $inputData['batch_no'] : null;
        $supplier = isset($inputData['supplier']) ? $inputData['supplier'] : 'Not Assigned';

        if (empty($name) || $price === null) {
            sendJson(["error" => "Name and price are required"], 400);
        }

        $numericPrice = (float)$price;
        $numericStock = (int)$stock_quantity;

        if ($numericPrice < 0 || $numericStock < 0) {
            sendJson(["error" => "Price and stock must be valid non-negative numbers"], 400);
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare('
            INSERT INTO products 
            (name, description, price, stock_quantity, sku, barcode, category, brand, reorder_level, location, batch_no, supplier)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $name, $description, $numericPrice, $numericStock, $sku, $barcode, 
            $category, $brand, $reorder_level, $location, $batch_no, $supplier
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
        $stock_quantity = isset($inputData['stock_quantity']) ? (int)$inputData['stock_quantity'] : 0;
        $sku = isset($inputData['sku']) ? $inputData['sku'] : null;
        $category = isset($inputData['category']) ? $inputData['category'] : 'Uncategorized';
        $brand = isset($inputData['brand']) ? $inputData['brand'] : 'Generic';

        if (empty($name) || $price === null) {
            sendJson(["error" => "Name and price are required"], 400);
        }

        $stmt = $pdo->prepare('
            UPDATE products SET name = ?, description = ?, price = ?, stock_quantity = ?, sku = ?, category = ?, brand = ? WHERE id = ?
        ');
        $stmt->execute([
            $name, $description, (float)$price, $stock_quantity, $sku, $category, $brand, $id
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
