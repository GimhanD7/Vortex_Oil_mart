<?php
global $pdo, $inputData, $id, $method;
$user = requireAuth(); // Require auth for sales

$salesColumns = [
    'payment_method', 'status', 'customer_id', 'subtotal_amount', 'discount_rate',
    'discount_amount', 'tax_rate', 'tax_amount', 'business_date', 'cash_received',
    'cash_balance', 'sales_cycle_id', 'opening_cash_balance'
];

function ensureSalesColumns() {
    global $pdo, $salesColumns;
    
    // PHP/PDO version of adding missing columns (simplified check)
    // Normally migrations should be handled separately, but replicating Next.js logic here
    $stmt = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales'");
    $existingColumns = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    $alterQueries = [];
    if (!in_array('customer_id', $existingColumns)) $alterQueries[] = 'ADD COLUMN customer_id INT NULL';
    if (!in_array('payment_method', $existingColumns)) $alterQueries[] = "ADD COLUMN payment_method VARCHAR(40) NOT NULL DEFAULT 'Cash'";
    if (!in_array('status', $existingColumns)) $alterQueries[] = "ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'completed'";
    if (!in_array('subtotal_amount', $existingColumns)) $alterQueries[] = 'ADD COLUMN subtotal_amount DECIMAL(10,2) NOT NULL DEFAULT 0';
    if (!in_array('discount_rate', $existingColumns)) $alterQueries[] = 'ADD COLUMN discount_rate DECIMAL(5,2) NOT NULL DEFAULT 0';
    if (!in_array('discount_amount', $existingColumns)) $alterQueries[] = 'ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0';
    if (!in_array('tax_rate', $existingColumns)) $alterQueries[] = 'ADD COLUMN tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0';
    if (!in_array('tax_amount', $existingColumns)) $alterQueries[] = 'ADD COLUMN tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0';
    if (!in_array('business_date', $existingColumns)) {
        $pdo->exec('ALTER TABLE sales ADD COLUMN business_date DATE NULL');
        $pdo->exec('UPDATE sales SET business_date = DATE(created_at) WHERE business_date IS NULL');
    }
    if (!in_array('cash_received', $existingColumns)) $alterQueries[] = 'ADD COLUMN cash_received DECIMAL(10,2) NULL';
    if (!in_array('cash_balance', $existingColumns)) $alterQueries[] = 'ADD COLUMN cash_balance DECIMAL(10,2) NULL';
    if (!in_array('sales_cycle_id', $existingColumns)) $alterQueries[] = 'ADD COLUMN sales_cycle_id VARCHAR(60) NULL';
    if (!in_array('opening_cash_balance', $existingColumns)) $alterQueries[] = 'ADD COLUMN opening_cash_balance DECIMAL(10,2) NULL';
    
    if (count($alterQueries) > 0) {
        $pdo->exec('ALTER TABLE sales ' . implode(', ', $alterQueries));
    }
}

if ($method === 'GET' && !$id) {
    try {
        ensureSalesColumns();
        
        $dateFrom = isset($_GET['date_from']) ? $_GET['date_from'] : null;
        $dateTo = isset($_GET['date_to']) ? $_GET['date_to'] : null;
        $cashier = isset($_GET['cashier']) ? $_GET['cashier'] : null;
        $paymentMethod = isset($_GET['payment_method']) ? $_GET['payment_method'] : null;
        $status = isset($_GET['status']) ? $_GET['status'] : null;
        $cycleId = isset($_GET['cycle_id']) ? $_GET['cycle_id'] : null;

        $where = [];
        $values = [];

        if ($dateFrom) {
            $where[] = 'COALESCE(s.business_date, DATE(s.created_at)) >= ?';
            $values[] = $dateFrom;
        }
        if ($dateTo) {
            $where[] = 'COALESCE(s.business_date, DATE(s.created_at)) <= ?';
            $values[] = $dateTo;
        }
        if ($cashier && $cashier !== 'All Cashiers') {
            $where[] = 'u.username = ?';
            $values[] = $cashier;
        }
        if ($paymentMethod && $paymentMethod !== 'All Payment Methods') {
            $where[] = 's.payment_method = ?';
            $values[] = $paymentMethod;
        }
        if ($status && $status !== 'All Status') {
            $where[] = 's.status = ?';
            $values[] = strtolower($status);
        }
        if ($cycleId) {
            $where[] = 's.sales_cycle_id = ?';
            $values[] = $cycleId;
        }

        $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

        $sql = "
            SELECT s.id, s.subtotal_amount, s.discount_rate, s.discount_amount,
                   s.tax_rate, s.tax_amount, s.business_date, s.cash_received, s.cash_balance,
                   s.sales_cycle_id, s.opening_cash_balance,
                   s.total_amount, s.payment_method, s.status, s.created_at,
                   u.username as cashier_name, c.name as customer_name,
                   COALESCE(SUM(si.quantity), 0) as item_count
            FROM sales s
            LEFT JOIN users u ON s.cashier_id = u.id
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN sale_items si ON si.sale_id = s.id
            $whereClause
            GROUP BY s.id, s.subtotal_amount, s.discount_rate, s.discount_amount,
                     s.tax_rate, s.tax_amount, s.business_date, s.cash_received, s.cash_balance,
                     s.sales_cycle_id, s.opening_cash_balance,
                     s.total_amount, s.payment_method, s.status, s.created_at, u.username, c.name
            ORDER BY s.id DESC
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($values);
        $sales = $stmt->fetchAll();

        sendJson($sales);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'POST' && !$id) {
    try {
        ensureSalesColumns();
        
        $cashier_id = isset($inputData['cashier_id']) ? (int)$inputData['cashier_id'] : 0;
        $customer_id = !empty($inputData['customer_id']) ? (int)$inputData['customer_id'] : null;
        $items = isset($inputData['items']) ? $inputData['items'] : [];
        $payment_method = !empty($inputData['payment_method']) ? $inputData['payment_method'] : 'Cash';
        $discount_rate = isset($inputData['discount_rate']) ? (float)$inputData['discount_rate'] : 0;
        $tax_rate = isset($inputData['tax_rate']) ? (float)$inputData['tax_rate'] : 0;
        $business_date = !empty($inputData['business_date']) ? $inputData['business_date'] : null;
        $cash_received = isset($inputData['cash_received']) && $inputData['cash_received'] !== null ? (float)$inputData['cash_received'] : null;
        $cash_balance = isset($inputData['cash_balance']) && $inputData['cash_balance'] !== null ? (float)$inputData['cash_balance'] : null;
        $sales_cycle_id = !empty($inputData['sales_cycle_id']) ? $inputData['sales_cycle_id'] : null;
        $opening_cash_balance = isset($inputData['opening_cash_balance']) && $inputData['opening_cash_balance'] !== null ? (float)$inputData['opening_cash_balance'] : null;

        $validPaymentMethods = ['Cash', 'Card', 'Wallet', 'Bank Transfer', 'Credit'];
        if (!in_array($payment_method, $validPaymentMethods)) {
            $payment_method = 'Cash';
        }

        if (!$cashier_id || empty($items)) {
            sendJson(["error" => "Invalid sale data"], 400);
        }

        $pdo->beginTransaction();

        $subtotalAmount = 0;
        foreach ($items as $item) {
            $stmt = $pdo->prepare('SELECT price, stock_quantity FROM products WHERE id = ?');
            $stmt->execute([$item['product_id']]);
            $product = $stmt->fetch();
            
            if (!$product) {
                throw new Exception("Product {$item['product_id']} not found");
            }
            if ($product['stock_quantity'] < $item['quantity']) {
                throw new Exception("Insufficient stock for product ID {$item['product_id']}");
            }
            $subtotalAmount += $product['price'] * $item['quantity'];
        }

        $normalizedDiscountRate = min(100, max(0, $discount_rate));
        $discountAmount = $subtotalAmount * ($normalizedDiscountRate / 100);
        
        $normalizedTaxRate = max(0, $tax_rate);
        $taxableAmount = max(0, $subtotalAmount - $discountAmount);
        $taxAmount = $taxableAmount * ($normalizedTaxRate / 100);
        
        $totalAmount = $taxableAmount + $taxAmount;

        $stmt = $pdo->prepare("
            INSERT INTO sales
            (cashier_id, customer_id, subtotal_amount, discount_rate, discount_amount,
             tax_rate, tax_amount, business_date, total_amount, payment_method, status,
             cash_received, cash_balance, sales_cycle_id, opening_cash_balance)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $cashier_id, $customer_id, $subtotalAmount, $normalizedDiscountRate, $discountAmount,
            $normalizedTaxRate, $taxAmount, $business_date, $totalAmount, $payment_method, 'completed',
            $cash_received, $cash_balance, $sales_cycle_id, $opening_cash_balance
        ]);
        $saleId = $pdo->lastInsertId();

        if ($customer_id) {
            $stmt = $pdo->prepare('UPDATE customers SET total_purchases = total_purchases + ? WHERE id = ?');
            $stmt->execute([$totalAmount, $customer_id]);
        }

        foreach ($items as $item) {
            $stmt = $pdo->prepare('SELECT price, stock_quantity FROM products WHERE id = ? FOR UPDATE');
            $stmt->execute([$item['product_id']]);
            $product = $stmt->fetch();
            
            $price_at_time = $product['price'];
            $stockBefore = (int)$product['stock_quantity'];
            $stockAfter = $stockBefore - (int)$item['quantity'];

            $stmt = $pdo->prepare('INSERT INTO sale_items (sale_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)');
            $stmt->execute([$saleId, $item['product_id'], $item['quantity'], $price_at_time]);

            $stmt = $pdo->prepare('UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?');
            $stmt->execute([$item['quantity'], $item['product_id']]);

            $stmt = $pdo->prepare("
                INSERT INTO inventory_movements
                (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by)
                VALUES (?, 'sale', ?, ?, ?, ?, ?, 'Stock deducted by POS sale', ?)
            ");
            $stmt->execute([
                $item['product_id'], -$item['quantity'], $stockBefore, $stockAfter, $price_at_time, "SALE-{$saleId}", $cashier_id
            ]);
        }

        $pdo->commit();

        sendJson([
            "message" => "Sale completed successfully",
            "saleId" => $saleId,
            "subtotal_amount" => $subtotalAmount,
            "discount_amount" => $discountAmount,
            "tax_amount" => $taxAmount,
            "total_amount" => $totalAmount,
            "payment_method" => $payment_method,
            "status" => "completed"
        ], 201);
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

if ($id === 'cycles') {
    function ensureSalesCyclesTable() {
        global $pdo;
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS sales_cycles (
                cycle_id VARCHAR(60) PRIMARY KEY,
                cashier_id INT NOT NULL,
                opened_at DATETIME NOT NULL,
                opened_date DATE NOT NULL,
                opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
                closing_balance DECIMAL(10,2) NULL,
                closed_at DATETIME NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'open',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        ");
    }

    if ($method === 'GET') {
        try {
            ensureSalesCyclesTable();
            ensureSalesColumns();
            
            $dateFrom = isset($_GET['date_from']) ? $_GET['date_from'] : null;
            $dateTo = isset($_GET['date_to']) ? $_GET['date_to'] : null;
            $cashier = isset($_GET['cashier']) ? $_GET['cashier'] : null;
            $status = isset($_GET['status']) ? $_GET['status'] : null;

            $where = [];
            $values = [];

            if ($dateFrom) {
                $where[] = 'sc.opened_date >= ?';
                $values[] = $dateFrom;
            }
            if ($dateTo) {
                $where[] = 'sc.opened_date <= ?';
                $values[] = $dateTo;
            }
            if ($cashier && $cashier !== 'All Cashiers') {
                $where[] = 'u.username = ?';
                $values[] = $cashier;
            }
            if ($status && $status !== 'All Status') {
                $where[] = 'sc.status = ?';
                $values[] = strtolower($status);
            }

            $whereClause = count($where) > 0 ? 'WHERE ' . implode(' AND ', $where) : '';

            $sql = "
                SELECT
                    sc.cycle_id, sc.cashier_id,
                    COALESCE(u.username, CONCAT('Cashier #', sc.cashier_id)) AS cashier_name,
                    sc.opened_date, sc.opened_at, sc.closed_at, sc.status,
                    sc.opening_balance, sc.closing_balance,
                    COALESCE(s.invoice_count, 0) AS invoice_count,
                    COALESCE(s.item_count, 0) AS item_count,
                    COALESCE(s.total_sales, 0) AS total_sales,
                    COALESCE(s.cash_sales, 0) AS cash_sales,
                    COALESCE(s.card_sales, 0) AS card_sales,
                    COALESCE(s.bank_sales, 0) AS bank_sales,
                    COALESCE(s.discount_total, 0) AS discount_total,
                    COALESCE(s.tax_total, 0) AS tax_total,
                    (sc.opening_balance + COALESCE(s.cash_sales, 0)) AS expected_cash,
                    CASE
                        WHEN sc.closing_balance IS NULL THEN NULL
                        ELSE sc.closing_balance - (sc.opening_balance + COALESCE(s.cash_sales, 0))
                    END AS cash_difference
                FROM sales_cycles sc
                LEFT JOIN users u ON u.id = sc.cashier_id
                LEFT JOIN (
                    SELECT
                        s.sales_cycle_id,
                        COUNT(DISTINCT s.id) AS invoice_count,
                        COALESCE(SUM(s.total_amount), 0) AS total_sales,
                        COALESCE(SUM(CASE WHEN s.payment_method = 'Cash' THEN s.total_amount ELSE 0 END), 0) AS cash_sales,
                        COALESCE(SUM(CASE WHEN s.payment_method = 'Card' THEN s.total_amount ELSE 0 END), 0) AS card_sales,
                        COALESCE(SUM(CASE WHEN s.payment_method = 'Bank Transfer' THEN s.total_amount ELSE 0 END), 0) AS bank_sales,
                        COALESCE(SUM(s.discount_amount), 0) AS discount_total,
                        COALESCE(SUM(s.tax_amount), 0) AS tax_total,
                        COALESCE(SUM(items.item_count), 0) AS item_count
                    FROM sales s
                    LEFT JOIN (
                        SELECT sale_id, SUM(quantity) AS item_count
                        FROM sale_items
                        GROUP BY sale_id
                    ) items ON items.sale_id = s.id
                    WHERE s.sales_cycle_id IS NOT NULL
                      AND (s.status IS NULL OR s.status != 'refunded')
                    GROUP BY s.sales_cycle_id
                ) s ON s.sales_cycle_id = sc.cycle_id
                $whereClause
                ORDER BY sc.opened_at DESC
            ";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($values);
            $cycles = $stmt->fetchAll();

            sendJson($cycles);
        } catch (PDOException $e) {
            sendJson(["error" => "Internal server error"], 500);
        }
    }

    if ($method === 'POST') {
        try {
            ensureSalesCyclesTable();
            $cycle_id = isset($inputData['cycle_id']) ? $inputData['cycle_id'] : null;
            $cashier_id = isset($inputData['cashier_id']) ? $inputData['cashier_id'] : null;
            $opened_at = isset($inputData['opened_at']) ? $inputData['opened_at'] : null;
            $opened_date = isset($inputData['opened_date']) ? $inputData['opened_date'] : null;
            $opening_balance = isset($inputData['opening_balance']) ? (float)$inputData['opening_balance'] : null;

            if (!$cycle_id || !$cashier_id || !$opened_at || !$opened_date || $opening_balance === null || $opening_balance < 0) {
                sendJson(["error" => "Invalid sales cycle data"], 400);
            }

            $stmt = $pdo->prepare("
                INSERT INTO sales_cycles (cycle_id, cashier_id, opened_at, opened_date, opening_balance, status)
                VALUES (?, ?, ?, ?, ?, 'open')
                ON DUPLICATE KEY UPDATE
                    opened_at = VALUES(opened_at),
                    opened_date = VALUES(opened_date),
                    opening_balance = VALUES(opening_balance),
                    status = 'open',
                    closing_balance = NULL,
                    closed_at = NULL
            ");
            $stmt->execute([$cycle_id, $cashier_id, $opened_at, $opened_date, $opening_balance]);

            sendJson(["message" => "Sales cycle opened", "cycle_id" => $cycle_id]);
        } catch (PDOException $e) {
            sendJson(["error" => "Internal server error"], 500);
        }
    }

    // Since next.js uses PATCH for closing, we use PATCH here too (PHP handles it via $method)
    if ($method === 'PATCH') {
        try {
            ensureSalesCyclesTable();
            $cycle_id = isset($inputData['cycle_id']) ? $inputData['cycle_id'] : null;
            $cashier_id = isset($inputData['cashier_id']) ? $inputData['cashier_id'] : null;
            $opened_at = isset($inputData['opened_at']) ? $inputData['opened_at'] : null;
            $opened_date = isset($inputData['opened_date']) ? $inputData['opened_date'] : null;
            $opening_balance = isset($inputData['opening_balance']) ? (float)$inputData['opening_balance'] : 0;
            $closing_balance = isset($inputData['closing_balance']) ? (float)$inputData['closing_balance'] : null;
            $closed_at = isset($inputData['closed_at']) ? $inputData['closed_at'] : null;

            if (!$cycle_id || $closing_balance === null || $closing_balance < 0) {
                sendJson(["error" => "Invalid closing balance"], 400);
            }

            $stmt = $pdo->prepare("
                SELECT
                    COUNT(*) AS invoice_count,
                    COALESCE(SUM(total_amount), 0) AS total_sales,
                    COALESCE(SUM(CASE WHEN payment_method = 'Cash' THEN total_amount ELSE 0 END), 0) AS cash_sales,
                    COALESCE(SUM(CASE WHEN payment_method = 'Card' THEN total_amount ELSE 0 END), 0) AS card_sales,
                    COALESCE(SUM(CASE WHEN payment_method = 'Bank Transfer' THEN total_amount ELSE 0 END), 0) AS bank_sales
                FROM sales
                WHERE sales_cycle_id = ?
            ");
            $stmt->execute([$cycle_id]);
            $summary = $stmt->fetch();

            $stmt = $pdo->prepare("
                UPDATE sales_cycles
                SET closing_balance = ?, closed_at = ?, status = 'closed'
                WHERE cycle_id = ?
            ");
            $closedAtDate = $closed_at ? $closed_at : date('Y-m-d H:i:s');
            $stmt->execute([$closing_balance, $closedAtDate, $cycle_id]);

            if ($stmt->rowCount() === 0) {
                if (!$cashier_id || !$opened_at || !$opened_date || $opening_balance === null) {
                    sendJson(["error" => "Sales cycle not found"], 404);
                }
                $stmt = $pdo->prepare("
                    INSERT INTO sales_cycles
                    (cycle_id, cashier_id, opened_at, opened_date, opening_balance, closing_balance, closed_at, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'closed')
                ");
                $stmt->execute([$cycle_id, $cashier_id, $opened_at, $opened_date, $opening_balance, $closing_balance, $closedAtDate]);
            }

            sendJson([
                "message" => "Sales cycle closed",
                "cycle_id" => $cycle_id,
                "summary" => $summary
            ]);
        } catch (PDOException $e) {
            sendJson(["error" => "Internal server error"], 500);
        }
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
