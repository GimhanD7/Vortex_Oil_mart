<?php
global $pdo, $inputData, $id, $method;
$user = requireAuth(); // Require auth for sales
require_once __DIR__ . '/../credit.php';

$salesColumns = [
    'payment_method', 'status', 'customer_id', 'subtotal_amount', 'discount_rate',
    'discount_amount', 'tax_rate', 'tax_amount', 'business_date', 'cash_received',
    'cash_balance', 'sales_cycle_id', 'opening_cash_balance'
];

function ensureSalesColumns() {
    global $pdo, $salesColumns;
    foreach ([
        "ALTER TABLE products ADD COLUMN product_type VARCHAR(30) NOT NULL DEFAULT 'packaged'",
        "ALTER TABLE products ADD COLUMN unit VARCHAR(20) NOT NULL DEFAULT 'Unit'",
        "ALTER TABLE products ADD COLUMN barrel_capacity_liters DECIMAL(10,3) NULL",
        "ALTER TABLE products MODIFY COLUMN stock_quantity DECIMAL(12,3) NOT NULL DEFAULT 0",
        "ALTER TABLE products MODIFY COLUMN reorder_level DECIMAL(12,3) NOT NULL DEFAULT 10",
        "ALTER TABLE sale_items MODIFY COLUMN quantity DECIMAL(12,3) NOT NULL",
        "ALTER TABLE inventory_movements MODIFY COLUMN quantity_change DECIMAL(12,3) NOT NULL",
        "ALTER TABLE inventory_movements MODIFY COLUMN stock_before DECIMAL(12,3) NOT NULL",
        "ALTER TABLE inventory_movements MODIFY COLUMN stock_after DECIMAL(12,3) NOT NULL",
    ] as $query) {
        try {
            $pdo->exec($query);
        } catch (PDOException $e) {
            // Existing databases may already match this shape
        }
    }
    
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

function ensureRevocationAuditTable() {
    global $pdo;
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS transaction_revocations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sale_id INT NULL,
            action_type VARCHAR(60) NOT NULL,
            cashier_id INT NOT NULL,
            approver_id INT NULL,
            reason VARCHAR(255) NOT NULL,
            affected_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            metadata TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_revocations_sale_id (sale_id),
            INDEX idx_revocations_cashier_id (cashier_id),
            INDEX idx_revocations_approver_id (approver_id),
            INDEX idx_revocations_created_at (created_at)
        )
    ");
}

function supervisorApproval() {
    global $pdo, $inputData;
    $username = isset($inputData['approver_username']) ? trim($inputData['approver_username']) : '';
    $pin = isset($inputData['approver_pin']) ? $inputData['approver_pin'] : '';

    if ($username === '' || $pin === '') {
        sendJson(["error" => "Supervisor/admin approval is required"], 400);
    }

    $stmt = $pdo->prepare("SELECT id, username, password, role FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $approver = $stmt->fetch();

    if (!$approver || $approver['role'] !== 'admin' || !password_verify($pin, $approver['password'])) {
        sendJson(["error" => "Invalid supervisor/admin PIN"], 403);
    }

    return $approver;
}

function recordRevocation($saleId, $actionType, $cashierId, $approverId, $reason, $affectedAmount, $metadata = []) {
    global $pdo;

    $stmt = $pdo->prepare("
        INSERT INTO transaction_revocations
        (sale_id, action_type, cashier_id, approver_id, reason, affected_amount, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $saleId,
        $actionType,
        $cashierId,
        $approverId,
        $reason,
        $affectedAmount,
        json_encode($metadata)
    ]);

    return $pdo->lastInsertId();
}

function saleItems($saleId) {
    global $pdo;
    $stmt = $pdo->prepare("
        SELECT
            si.product_id,
            si.quantity,
            si.price_at_time,
            COALESCE(p.name, CONCAT('Product #', si.product_id)) AS product_name,
            p.sku
            ,p.unit
            ,p.product_type
        FROM sale_items si
        LEFT JOIN products p ON p.id = si.product_id
        WHERE si.sale_id = ?
        ORDER BY si.id ASC
    ");
    $stmt->execute([$saleId]);
    return $stmt->fetchAll();
}

if ($method === 'POST' && $id === 'revocations') {
    try {
        ensureSalesColumns();
        ensureRevocationAuditTable();
        ensureCreditAccountTables();

        $actionType = isset($inputData['action_type']) ? trim($inputData['action_type']) : '';
        $reason = isset($inputData['reason']) ? trim($inputData['reason']) : '';
        $affectedAmount = isset($inputData['affected_amount']) ? (float)$inputData['affected_amount'] : 0;
        $metadata = isset($inputData['metadata']) && is_array($inputData['metadata']) ? $inputData['metadata'] : [];
        $saleId = isset($inputData['sale_id']) && $inputData['sale_id'] !== null ? (int)$inputData['sale_id'] : null;
        $approvalRequired = in_array($actionType, ['completed_sale_voided', 'refund_return_cancelled']);
        $approver = $approvalRequired ? supervisorApproval() : null;

        if ($actionType === '' || $reason === '') {
            sendJson(["error" => "Revocation type and reason are required"], 400);
        }

        $auditId = recordRevocation(
            $saleId,
            $actionType,
            $user['id'],
            $approver ? $approver['id'] : null,
            $reason,
            $affectedAmount,
            $metadata
        );

        sendJson(["message" => "Revocation recorded", "audit_id" => $auditId], 201);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'GET' && $id === 'revocations') {
    try {
        ensureSalesColumns();
        ensureRevocationAuditTable();

        $stmt = $pdo->prepare("
            SELECT
                tr.id,
                tr.sale_id,
                tr.action_type,
                tr.reason,
                tr.affected_amount,
                tr.metadata,
                tr.created_at,
                cashier.username AS cashier_name,
                approver.username AS approver_name,
                s.status AS sale_status,
                s.payment_method,
                s.total_amount,
                s.created_at AS sale_created_at,
                c.name AS customer_name
            FROM transaction_revocations tr
            LEFT JOIN users cashier ON cashier.id = tr.cashier_id
            LEFT JOIN users approver ON approver.id = tr.approver_id
            LEFT JOIN sales s ON s.id = tr.sale_id
            LEFT JOIN customers c ON c.id = s.customer_id
            ORDER BY tr.created_at DESC, tr.id DESC
            LIMIT 300
        ");
        $stmt->execute();
        sendJson($stmt->fetchAll());
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
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
        ensureCreditAccountTables();
        
        $cashier_id = isset($inputData['cashier_id']) ? (int)$inputData['cashier_id'] : 0;
        $customer_id = !empty($inputData['customer_id']) ? (int)$inputData['customer_id'] : null;
        $items = isset($inputData['items']) ? $inputData['items'] : [];
        $payment_method = !empty($inputData['payment_method']) ? $inputData['payment_method'] : 'Cash';
        $discount_rate = isset($inputData['discount_rate']) ? (float)$inputData['discount_rate'] : 0;
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
            $quantity = isset($item['quantity']) ? (float)$item['quantity'] : 0;
            if ($quantity <= 0) {
                throw new Exception("Sale items need a positive quantity");
            }

            $stmt = $pdo->prepare('SELECT price, stock_quantity FROM products WHERE id = ?');
            $stmt->execute([$item['product_id']]);
            $product = $stmt->fetch();
            
            if (!$product) {
                throw new Exception("Product {$item['product_id']} not found");
            }
            if ((float)$product['stock_quantity'] < $quantity) {
                throw new Exception("Insufficient stock for product ID {$item['product_id']}");
            }
            $subtotalAmount += (float)$product['price'] * $quantity;
        }

        $normalizedDiscountRate = min(100, max(0, $discount_rate));
        $discountAmount = $subtotalAmount * ($normalizedDiscountRate / 100);
        
        $normalizedTaxRate = 0;
        $taxAmount = 0;
        $totalAmount = max(0, $subtotalAmount - $discountAmount);

        $customerCredit = null;
        if ($payment_method === 'Credit') {
            if (!$customer_id) {
                throw new Exception('Select a customer before using Credit payment');
            }

            $stmt = $pdo->prepare('
                SELECT id, name, status, credit_limit, outstanding_balance
                FROM customers
                WHERE id = ?
                FOR UPDATE
            ');
            $stmt->execute([$customer_id]);
            $customerCredit = $stmt->fetch();

            if (!$customerCredit) {
                throw new Exception('Selected customer was not found');
            }
            if (strtolower((string)$customerCredit['status']) !== 'active') {
                throw new Exception('Credit is available only for active customers');
            }

            $creditLimit = (float)$customerCredit['credit_limit'];
            $outstandingBalance = (float)$customerCredit['outstanding_balance'];
            $availableCredit = max(0, $creditLimit - $outstandingBalance);

            if ($creditLimit <= 0) {
                throw new Exception('This customer does not have an approved credit limit');
            }
            if ($totalAmount > $availableCredit + 0.001) {
                throw new Exception('Insufficient customer credit. Available credit is Rs. ' . number_format($availableCredit, 2));
            }
        }

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
            if ($payment_method === 'Credit') {
                $stmt = $pdo->prepare('
                    UPDATE customers
                    SET total_purchases = total_purchases + ?,
                        outstanding_balance = outstanding_balance + ?
                    WHERE id = ?
                ');
                $stmt->execute([$totalAmount, $totalAmount, $customer_id]);
                $newOutstandingBalance = (float)$customerCredit['outstanding_balance'] + $totalAmount;
                addCreditLedgerEntry(
                    $customer_id,
                    'credit_sale',
                    $totalAmount,
                    0,
                    $newOutstandingBalance,
                    $saleId,
                    null,
                    "INV-{$saleId}",
                    'Credit sale posted to customer account',
                    $cashier_id
                );
            } else {
                $stmt = $pdo->prepare('UPDATE customers SET total_purchases = total_purchases + ? WHERE id = ?');
                $stmt->execute([$totalAmount, $customer_id]);
            }
        }

        foreach ($items as $item) {
            $quantity = isset($item['quantity']) ? (float)$item['quantity'] : 0;
            $stmt = $pdo->prepare('SELECT price, stock_quantity FROM products WHERE id = ? FOR UPDATE');
            $stmt->execute([$item['product_id']]);
            $product = $stmt->fetch();
            
            $price_at_time = $product['price'];
            $stockBefore = (float)$product['stock_quantity'];
            $stockAfter = $stockBefore - $quantity;

            if ($quantity <= 0 || $stockAfter < 0) {
                throw new Exception("Insufficient stock for product ID {$item['product_id']}");
            }

            $stmt = $pdo->prepare('INSERT INTO sale_items (sale_id, product_id, quantity, price_at_time) VALUES (?, ?, ?, ?)');
            $stmt->execute([$saleId, $item['product_id'], $quantity, $price_at_time]);

            $stmt = $pdo->prepare('UPDATE products SET stock_quantity = ? WHERE id = ?');
            $stmt->execute([$stockAfter, $item['product_id']]);

            $stmt = $pdo->prepare("
                INSERT INTO inventory_movements
                (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by)
                VALUES (?, 'sale', ?, ?, ?, ?, ?, 'Stock deducted by POS sale', ?)
            ");
            $stmt->execute([
                $item['product_id'], -$quantity, $stockBefore, $stockAfter, $price_at_time, "SALE-{$saleId}", $cashier_id
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
            "status" => "completed",
            "customer_credit" => $payment_method === 'Credit' ? [
                "customer_id" => $customer_id,
                "credit_limit" => (float)$customerCredit['credit_limit'],
                "outstanding_balance" => (float)$customerCredit['outstanding_balance'] + $totalAmount,
                "available_credit" => max(0, (float)$customerCredit['credit_limit'] - (float)$customerCredit['outstanding_balance'] - $totalAmount)
            ] : null
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

if ($method === 'GET' && $id === 'items') {
    try {
        ensureSalesColumns();

        $date = isset($_GET['date']) && $_GET['date'] !== '' ? $_GET['date'] : date('Y-m-d');

        $stmt = $pdo->prepare("
            SELECT
                si.product_id,
                COALESCE(p.name, CONCAT('Product #', si.product_id)) AS product_name,
                p.sku,
                p.category,
                p.unit,
                p.product_type,
                SUM(si.quantity) AS quantity,
                SUM(si.quantity * si.price_at_time) AS total_amount,
                COUNT(DISTINCT s.id) AS invoice_count
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            LEFT JOIN products p ON p.id = si.product_id
            WHERE COALESCE(s.business_date, DATE(s.created_at)) = ?
              AND (s.status IS NULL OR s.status != 'refunded')
            GROUP BY si.product_id, p.name, p.sku, p.category, p.unit, p.product_type
            ORDER BY quantity DESC, total_amount DESC, product_name ASC
        ");
        $stmt->execute([$date]);
        $items = $stmt->fetchAll();

        $summary = [
            "date" => $date,
            "product_count" => count($items),
            "quantity" => 0,
            "total_amount" => 0,
            "invoice_count" => 0
        ];

        foreach ($items as $item) {
            $summary["quantity"] += (float)$item["quantity"];
            $summary["total_amount"] += (float)$item["total_amount"];
        }

        $stmt = $pdo->prepare("
            SELECT COUNT(DISTINCT id) AS invoice_count
            FROM sales
            WHERE COALESCE(business_date, DATE(created_at)) = ?
              AND (status IS NULL OR status != 'refunded')
        ");
        $stmt->execute([$date]);
        $row = $stmt->fetch();
        $summary["invoice_count"] = (int)($row["invoice_count"] ?? 0);

        sendJson([
            "summary" => $summary,
            "items" => $items
        ]);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'GET' && $id) {
    try {
        ensureSalesColumns();

        $stmt = $pdo->prepare("
            SELECT s.id, s.subtotal_amount, s.discount_rate, s.discount_amount,
                   s.tax_rate, s.tax_amount, s.business_date, s.cash_received, s.cash_balance,
                   s.sales_cycle_id, s.opening_cash_balance,
                   s.total_amount, s.payment_method, s.status, s.created_at,
                   u.username as cashier_name, c.name as customer_name
            FROM sales s
            LEFT JOIN users u ON s.cashier_id = u.id
            LEFT JOIN customers c ON s.customer_id = c.id
            WHERE s.id = ?
            LIMIT 1
        ");
        $stmt->execute([$id]);
        $sale = $stmt->fetch();

        if (!$sale) {
            sendJson(["error" => "Sale not found"], 404);
        }

        sendJson([
            "sale" => $sale,
            "items" => saleItems($id)
        ]);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'PATCH' && $id) {
    try {
        ensureSalesColumns();
        ensureRevocationAuditTable();
        ensureCreditAccountTables();

        $action = isset($inputData['action']) ? $inputData['action'] : null;
        if (!in_array($action, ['refund', 'void'])) {
            sendJson(["error" => "Unsupported sales action"], 400);
        }
        $reason = isset($inputData['reason']) ? trim($inputData['reason']) : '';
        if ($reason === '') {
            sendJson(["error" => "Reason is required"], 400);
        }
        $approver = supervisorApproval();

        $pdo->beginTransaction();

        $stmt = $pdo->prepare('SELECT * FROM sales WHERE id = ? FOR UPDATE');
        $stmt->execute([$id]);
        $sale = $stmt->fetch();

        if (!$sale) {
            $pdo->rollBack();
            sendJson(["error" => "Sale not found"], 404);
        }

        if (in_array($sale['status'], ['refunded', 'voided', 'cancelled'])) {
            $pdo->rollBack();
            sendJson(["message" => "Invoice is already reversed"]);
        }

        $items = saleItems($id);
        foreach ($items as $item) {
            $stmt = $pdo->prepare('SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE');
            $stmt->execute([$item['product_id']]);
            $product = $stmt->fetch();

            if (!$product) {
                throw new Exception("Product {$item['product_id']} not found");
            }

            $stockBefore = (float)$product['stock_quantity'];
            $quantity = (float)$item['quantity'];
            $stockAfter = $stockBefore + $quantity;

            $stmt = $pdo->prepare('UPDATE products SET stock_quantity = ? WHERE id = ?');
            $stmt->execute([$stockAfter, $item['product_id']]);

            $stmt = $pdo->prepare("
                INSERT INTO inventory_movements
                (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by)
                VALUES (?, 'adjustment', ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $item['product_id'],
                $quantity,
                $stockBefore,
                $stockAfter,
                $item['price_at_time'],
                strtoupper($action) . "-{$id}",
                $action === 'refund' ? 'Refund returned stock' : 'Void returned stock',
                $user['id']
            ]);
        }

        if (!empty($sale['customer_id'])) {
            if ($sale['payment_method'] === 'Credit') {
                $allocatedAmount = activeCreditAllocationsForSale($id);
                if ($allocatedAmount > 0.001) {
                    throw new Exception('Reverse the customer payment allocation before refunding or voiding this credit invoice');
                }
                $customerStmt = $pdo->prepare('SELECT outstanding_balance FROM customers WHERE id = ? FOR UPDATE');
                $customerStmt->execute([$sale['customer_id']]);
                $customerBalance = (float)$customerStmt->fetchColumn();
                $nextCustomerBalance = max(0, $customerBalance - (float)$sale['total_amount']);
                $stmt = $pdo->prepare('
                    UPDATE customers
                    SET total_purchases = GREATEST(0, total_purchases - ?),
                        outstanding_balance = GREATEST(0, outstanding_balance - ?)
                    WHERE id = ?
                ');
                $stmt->execute([(float)$sale['total_amount'], (float)$sale['total_amount'], $sale['customer_id']]);
                addCreditLedgerEntry(
                    $sale['customer_id'],
                    $action === 'refund' ? 'credit_sale_refund' : 'credit_sale_void',
                    0,
                    (float)$sale['total_amount'],
                    $nextCustomerBalance,
                    $id,
                    null,
                    strtoupper($action) . "-{$id}",
                    $action === 'refund' ? 'Credit invoice refunded' : 'Credit invoice voided',
                    $user['id']
                );
            } else {
                $stmt = $pdo->prepare('UPDATE customers SET total_purchases = GREATEST(0, total_purchases - ?) WHERE id = ?');
                $stmt->execute([(float)$sale['total_amount'], $sale['customer_id']]);
            }
        }

        $nextStatus = $action === 'refund' ? 'refunded' : 'voided';
        $stmt = $pdo->prepare("UPDATE sales SET status = ? WHERE id = ?");
        $stmt->execute([$nextStatus, $id]);

        recordRevocation(
            $id,
            $action === 'refund' ? 'completed_sale_refunded' : 'completed_sale_voided',
            $user['id'],
            $approver['id'],
            $reason,
            (float)$sale['total_amount'],
            [
                "previous_status" => $sale['status'],
                "next_status" => $nextStatus,
                "payment_method" => $sale['payment_method'],
                "sales_cycle_id" => $sale['sales_cycle_id']
            ]
        );

        $pdo->commit();
        sendJson(["message" => $action === 'refund' ? "Invoice refunded and stock returned" : "Invoice voided and stock returned"]);
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
