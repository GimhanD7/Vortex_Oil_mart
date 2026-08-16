<?php
global $pdo, $inputData, $id, $method;
$user = requireAuth(); // Require auth

function ensureInventoryMovementTable() {
    global $pdo;
    foreach ([
        "ALTER TABLE products ADD COLUMN product_type VARCHAR(30) NOT NULL DEFAULT 'packaged'",
        "ALTER TABLE products ADD COLUMN unit VARCHAR(20) NOT NULL DEFAULT 'Unit'",
        "ALTER TABLE products ADD COLUMN barrel_capacity_liters DECIMAL(10,3) NULL",
    ] as $query) {
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
            // Already compatible
        }
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS inventory_movements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_id INT NOT NULL,
            movement_type ENUM('in', 'out', 'adjustment', 'sale', 'purchase') NOT NULL,
            quantity_change DECIMAL(12,3) NOT NULL,
            stock_before DECIMAL(12,3) NOT NULL,
            stock_after DECIMAL(12,3) NOT NULL,
            unit_price DECIMAL(10, 2) NOT NULL,
            reference_no VARCHAR(100),
            notes VARCHAR(500),
            created_by INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_inventory_product (product_id),
            INDEX idx_inventory_created (created_at),
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
    ");

    foreach ([
        "ALTER TABLE inventory_movements MODIFY COLUMN quantity_change DECIMAL(12,3) NOT NULL",
        "ALTER TABLE inventory_movements MODIFY COLUMN stock_before DECIMAL(12,3) NOT NULL",
        "ALTER TABLE inventory_movements MODIFY COLUMN stock_after DECIMAL(12,3) NOT NULL",
    ] as $query) {
        try {
            $pdo->exec($query);
        } catch (PDOException $e) {
            // Already compatible
        }
    }
}

if ($method === 'GET' && !$id) {
    try {
        ensureInventoryMovementTable();
        
        $stmt = $pdo->query("
            SELECT p.id, p.name, p.description, p.price, p.stock_quantity, p.sku, p.barcode, p.category, p.brand,
                   p.product_type, p.unit, p.barrel_capacity_liters,
                   p.reorder_level, p.location, p.batch_no, p.supplier, p.updated_at,
                   COALESCE(SUM(CASE WHEN m.quantity_change > 0 THEN m.quantity_change ELSE 0 END), 0) AS monthly_in,
                   COALESCE(SUM(CASE WHEN m.quantity_change < 0 THEN ABS(m.quantity_change) ELSE 0 END), 0) AS monthly_out,
                   (p.stock_quantity - COALESCE(SUM(m.quantity_change), 0)) AS monthly_start_stock
            FROM products p
            LEFT JOIN inventory_movements m ON p.id = m.product_id AND m.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
            GROUP BY p.id
            ORDER BY p.name ASC
        ");
        $items = $stmt->fetchAll();

        $stmt = $pdo->query('
            SELECT COUNT(*) AS total_items,
                   COALESCE(SUM(price * stock_quantity), 0) AS stock_value,
                   SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= 10 THEN 1 ELSE 0 END) AS low_stock,
                   SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock,
                   4 AS locations
            FROM products
        ');
        $summary = $stmt->fetch();

        $stmt = $pdo->query("
            SELECT COUNT(*) AS transactions,
                   COALESCE(SUM(CASE WHEN quantity_change > 0 THEN quantity_change * unit_price ELSE 0 END), 0) AS total_inward,
                   COALESCE(SUM(CASE WHEN quantity_change < 0 THEN ABS(quantity_change) * unit_price ELSE 0 END), 0) AS total_outward
            FROM inventory_movements
            WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        ");
        $movements = $stmt->fetch();

        sendJson([
            "items" => $items,
            "summary" => $summary,
            "movements" => $movements
        ]);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'POST' && !$id) {
    try {
        ensureInventoryMovementTable();
        
        $product_id = isset($inputData['product_id']) ? (int)$inputData['product_id'] : 0;
        $quantity_change = isset($inputData['quantity_change']) ? (float)$inputData['quantity_change'] : 0;
        $notes = !empty($inputData['notes']) ? trim($inputData['notes']) : 'Manual stock adjustment';
        $created_by = isset($inputData['created_by']) ? (int)$inputData['created_by'] : $user['id'];

        if ($product_id <= 0 || $quantity_change === 0) {
            sendJson(["error" => "A valid product and non-zero adjustment are required"], 400);
        }

        $pdo->beginTransaction();

        $stmt = $pdo->prepare('SELECT id, price, stock_quantity FROM products WHERE id = ? FOR UPDATE');
        $stmt->execute([$product_id]);
        $product = $stmt->fetch();

        if (!$product) {
            $pdo->rollBack();
            sendJson(["error" => "Product not found"], 404);
        }

        $stock_before = (float)$product['stock_quantity'];
        $stock_after = $stock_before + $quantity_change;

        if ($stock_after < 0) {
            $pdo->rollBack();
            sendJson(["error" => "Adjustment exceeds available stock ($stock_before)"], 400);
        }

        $stmt = $pdo->prepare('UPDATE products SET stock_quantity = ? WHERE id = ?');
        $stmt->execute([$stock_after, $product_id]);

        $movement_type = $quantity_change > 0 ? 'in' : 'out';
        $reference_no = 'ADJ-' . round(microtime(true) * 1000);

        $stmt = $pdo->prepare("
            INSERT INTO inventory_movements
            (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $product_id, $movement_type, $quantity_change, $stock_before, $stock_after, 
            $product['price'], $reference_no, $notes, $created_by
        ]);
        $movement_id = $pdo->lastInsertId();

        $pdo->commit();

        sendJson([
            "message" => "Stock adjusted successfully",
            "movement_id" => $movement_id,
            "product_id" => $product_id,
            "stock_before" => $stock_before,
            "stock_after" => $stock_after
        ], 201);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'GET' && $id === 'movements') {
    try {
        $product_id = isset($_GET['product_id']) ? $_GET['product_id'] : null;
        $type = isset($_GET['type']) ? $_GET['type'] : null;
        $date_from = isset($_GET['date_from']) ? $_GET['date_from'] : null;
        $date_to = isset($_GET['date_to']) ? $_GET['date_to'] : null;
        $limit = isset($_GET['limit']) ? max(1, min(200, (int)$_GET['limit'])) : 50;

        $where = [];
        $values = [];

        if ($product_id) {
            $where[] = 'm.product_id = ?';
            $values[] = $product_id;
        }
        if ($type && $type !== 'All Types') {
            $where[] = 'm.movement_type = ?';
            $values[] = $type;
        }
        if ($date_from) {
            $where[] = 'DATE(m.created_at) >= ?';
            $values[] = $date_from;
        }
        if ($date_to) {
            $where[] = 'DATE(m.created_at) <= ?';
            $values[] = $date_to;
        }

        $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';
        $values[] = $limit;

        $stmt = $pdo->prepare("
            SELECT m.id, m.product_id, p.name AS product_name, p.sku, p.unit,
                   m.movement_type, m.quantity_change, m.stock_before, m.stock_after,
                   m.unit_price, m.reference_no, m.notes, u.username AS created_by,
                   m.created_at
            FROM inventory_movements m
            JOIN products p ON p.id = m.product_id
            LEFT JOIN users u ON u.id = m.created_by
            $whereClause
            ORDER BY m.created_at DESC, m.id DESC
            LIMIT ?
        ");
        
        // PDO needs limit bound as int if emulate prepares is false, but we passed it normally
        // Workaround for LIMIT with positional params
        foreach ($values as $index => $value) {
            $stmt->bindValue($index + 1, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->execute();
        $movements = $stmt->fetchAll();

        sendJson($movements);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
