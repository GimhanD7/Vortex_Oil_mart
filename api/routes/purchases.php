<?php
global $pdo, $inputData, $id, $method;
$user = requireAuth(); // Require auth for purchases

function ensurePurchaseTables() {
    global $pdo;
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS purchases (
            id INT AUTO_INCREMENT PRIMARY KEY,
            supplier VARCHAR(150) NOT NULL,
            payment_method VARCHAR(40) NOT NULL DEFAULT 'Cash',
            total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
            status VARCHAR(30) NOT NULL DEFAULT 'received',
            notes VARCHAR(500),
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS purchase_items (
            id INT AUTO_INCREMENT PRIMARY KEY,
            purchase_id INT NOT NULL,
            product_id INT NOT NULL,
            quantity INT NOT NULL,
            unit_cost DECIMAL(10, 2) NOT NULL,
            FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS inventory_movements (
            id INT AUTO_INCREMENT PRIMARY KEY,
            product_id INT NOT NULL,
            movement_type ENUM('in', 'out', 'adjustment', 'sale', 'purchase') NOT NULL,
            quantity_change INT NOT NULL,
            stock_before INT NOT NULL,
            stock_after INT NOT NULL,
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
}

function purchaseItems($purchaseId) {
    global $pdo;
    $stmt = $pdo->prepare("
        SELECT pi.id, pi.product_id, pi.quantity, pi.unit_cost, p.name AS product_name, p.sku
        FROM purchase_items pi
        JOIN products p ON p.id = pi.product_id
        WHERE pi.purchase_id = ?
        ORDER BY pi.id ASC
    ");
    $stmt->execute([$purchaseId]);
    return $stmt->fetchAll();
}

function reverseReceivedStock($purchaseId, $createdBy) {
    global $pdo;
    $items = purchaseItems($purchaseId);
    foreach ($items as $item) {
        $stmt = $pdo->prepare('SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE');
        $stmt->execute([$item['product_id']]);
        $product = $stmt->fetch();
        
        $stockBefore = (int)$product['stock_quantity'];
        if ($stockBefore < (int)$item['quantity']) {
            throw new Exception("Cannot reverse {$item['product_name']}; current stock is below purchase quantity");
        }
        
        $stockAfter = $stockBefore - (int)$item['quantity'];
        
        $stmt = $pdo->prepare('UPDATE products SET stock_quantity = ? WHERE id = ?');
        $stmt->execute([$stockAfter, $item['product_id']]);
        
        $stmt = $pdo->prepare("
            INSERT INTO inventory_movements
            (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by)
            VALUES (?, 'out', ?, ?, ?, ?, ?, 'Purchase stock reversed', ?)
        ");
        $stmt->execute([
            $item['product_id'], -$item['quantity'], $stockBefore, $stockAfter, 
            $item['unit_cost'], "PUR-CANCEL-{$purchaseId}", $createdBy
        ]);
    }
}

if ($method === 'GET' && !$id) {
    try {
        ensurePurchaseTables();
        $stmt = $pdo->query("
            SELECT p.id, p.supplier, p.payment_method, p.total_amount, p.status, p.notes, p.created_at,
                   u.username AS created_by,
                   COALESCE(SUM(pi.quantity), 0) AS item_count
            FROM purchases p
            LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
            LEFT JOIN users u ON u.id = p.created_by
            GROUP BY p.id, p.supplier, p.payment_method, p.total_amount, p.status, p.notes, p.created_at, u.username
            ORDER BY p.id DESC
        ");
        $purchases = $stmt->fetchAll();
        sendJson($purchases);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'POST' && !$id) {
    try {
        ensurePurchaseTables();
        
        $supplier = isset($inputData['supplier']) ? trim($inputData['supplier']) : '';
        $payment_method = isset($inputData['payment_method']) ? $inputData['payment_method'] : 'Cash';
        $notes = !empty($inputData['notes']) ? trim($inputData['notes']) : null;
        $created_by = isset($inputData['created_by']) ? (int)$inputData['created_by'] : $user['id'];
        $items = isset($inputData['items']) && is_array($inputData['items']) ? $inputData['items'] : [];

        $validPaymentMethods = ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Credit'];
        if (!in_array($payment_method, $validPaymentMethods)) {
            $payment_method = 'Cash';
        }

        if (empty($supplier) || empty($items)) {
            sendJson(["error" => "Supplier and at least one purchase item are required"], 400);
        }

        $pdo->beginTransaction();

        $total = 0;
        $normalized = [];

        foreach ($items as $item) {
            $productId = (int)$item['product_id'];
            $quantity = (int)$item['quantity'];
            $unitCost = (float)$item['unit_cost'];
            
            if ($productId <= 0 || $quantity <= 0 || $unitCost < 0) {
                throw new Exception("Purchase items need a product, positive quantity, and valid unit cost");
            }
            
            $stmt = $pdo->prepare('SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE');
            $stmt->execute([$productId]);
            $product = $stmt->fetch();
            
            if (!$product) throw new Exception("Product {$productId} not found");
            
            $total += $quantity * $unitCost;
            $normalized[] = [
                'product_id' => $productId,
                'quantity' => $quantity,
                'unit_cost' => $unitCost,
                'stock_before' => (int)$product['stock_quantity']
            ];
        }

        $stmt = $pdo->prepare("
            INSERT INTO purchases (supplier, payment_method, total_amount, status, notes, created_by)
            VALUES (?, ?, ?, 'received', ?, ?)
        ");
        $stmt->execute([$supplier, $payment_method, $total, $notes, $created_by]);
        $purchaseId = $pdo->lastInsertId();

        foreach ($normalized as $item) {
            $stockAfter = $item['stock_before'] + $item['quantity'];
            
            $stmt = $pdo->prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, unit_cost) VALUES (?, ?, ?, ?)');
            $stmt->execute([$purchaseId, $item['product_id'], $item['quantity'], $item['unit_cost']]);
            
            $stmt = $pdo->prepare('UPDATE products SET stock_quantity = ? WHERE id = ?');
            $stmt->execute([$stockAfter, $item['product_id']]);
            
            $stmt = $pdo->prepare("
                INSERT INTO inventory_movements
                (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by)
                VALUES (?, 'in', ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $item['product_id'], $item['quantity'], $item['stock_before'], $stockAfter, 
                $item['unit_cost'], "PUR-{$purchaseId}", "Purchase received from {$supplier}", $created_by
            ]);
        }

        $pdo->commit();
        sendJson(["id" => $purchaseId, "message" => "Purchase received successfully", "total_amount" => $total], 201);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        sendJson(["error" => $e->getMessage()], 400);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'GET' && $id) {
    try {
        $stmt = $pdo->prepare('SELECT * FROM purchases WHERE id = ?');
        $stmt->execute([$id]);
        $purchase = $stmt->fetch();
        
        if (!$purchase) {
            sendJson(["error" => "Purchase not found"], 404);
        }
        
        $items = purchaseItems($id);
        sendJson(["purchase" => $purchase, "items" => $items]);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'PATCH' && $id) {
    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare('SELECT * FROM purchases WHERE id = ? FOR UPDATE');
        $stmt->execute([$id]);
        $purchase = $stmt->fetch();
        
        if (!$purchase) {
            $pdo->rollBack();
            sendJson(["error" => "Purchase not found"], 404);
        }
        
        $status = isset($inputData['status']) ? $inputData['status'] : null;
        
        if ($status === 'cancelled' && $purchase['status'] !== 'cancelled') {
            if ($purchase['status'] === 'received') {
                reverseReceivedStock($id, $purchase['created_by']);
            }
            $stmt = $pdo->prepare("UPDATE purchases SET status = 'cancelled' WHERE id = ?");
            $stmt->execute([$id]);
        } else {
            $supplier = isset($inputData['supplier']) ? trim($inputData['supplier']) : $purchase['supplier'];
            $payment_method = isset($inputData['payment_method']) ? trim($inputData['payment_method']) : $purchase['payment_method'];
            $notes = isset($inputData['notes']) ? trim($inputData['notes']) : $purchase['notes'];
            
            $stmt = $pdo->prepare("
                UPDATE purchases
                SET supplier = ?, payment_method = ?, notes = ?
                WHERE id = ?
            ");
            $stmt->execute([$supplier, $payment_method, $notes, $id]);
        }
        
        $pdo->commit();
        sendJson(["message" => "Purchase updated successfully"]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        sendJson(["error" => $e->getMessage()], 400);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'DELETE' && $id) {
    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare('SELECT * FROM purchases WHERE id = ? FOR UPDATE');
        $stmt->execute([$id]);
        $purchase = $stmt->fetch();
        
        if (!$purchase) {
            $pdo->rollBack();
            sendJson(["error" => "Purchase not found"], 404);
        }
        
        if ($purchase['status'] === 'received') {
            reverseReceivedStock($id, $purchase['created_by']);
        }
        
        $stmt = $pdo->prepare('DELETE FROM purchases WHERE id = ?');
        $stmt->execute([$id]);
        
        $pdo->commit();
        sendJson(["message" => "Purchase deleted successfully"]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        sendJson(["error" => $e->getMessage()], 400);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
