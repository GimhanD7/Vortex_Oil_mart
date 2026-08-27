<?php
global $pdo, $inputData, $id, $method;
$user = requireAuth(); // Require auth for customers
require_once __DIR__ . '/../credit.php';

function ensureCustomersTable() {
    global $pdo;
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS customers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            phone VARCHAR(40) NULL,
            email VARCHAR(150) NULL,
            address TEXT NULL,
            company_notes TEXT NULL,
            customer_type VARCHAR(60) NOT NULL DEFAULT 'Regular Customer',
            status VARCHAR(30) NOT NULL DEFAULT 'Active',
            credit_limit DECIMAL(10,2) NOT NULL DEFAULT 0,
            total_purchases DECIMAL(10,2) NOT NULL DEFAULT 0,
            outstanding_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ");

    foreach ([
        "ALTER TABLE customers ADD COLUMN email VARCHAR(150) NULL",
        "ALTER TABLE customers ADD COLUMN address TEXT NULL",
        "ALTER TABLE customers ADD COLUMN company_notes TEXT NULL",
        "ALTER TABLE customers ADD COLUMN customer_type VARCHAR(60) NOT NULL DEFAULT 'Regular Customer'",
        "ALTER TABLE customers ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'Active'",
        "ALTER TABLE customers ADD COLUMN credit_limit DECIMAL(10,2) NOT NULL DEFAULT 0",
        "ALTER TABLE customers ADD COLUMN total_purchases DECIMAL(10,2) NOT NULL DEFAULT 0",
        "ALTER TABLE customers ADD COLUMN outstanding_balance DECIMAL(10,2) NOT NULL DEFAULT 0",
        "ALTER TABLE customers ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
    ] as $query) {
        try {
            $pdo->exec($query);
        } catch (PDOException $e) {
            // Column likely already exists
        }
    }

    foreach ([
        "ALTER TABLE customers MODIFY COLUMN credit_limit DECIMAL(10,2) NOT NULL DEFAULT 0",
        "ALTER TABLE customers MODIFY COLUMN total_purchases DECIMAL(10,2) NOT NULL DEFAULT 0",
        "ALTER TABLE customers MODIFY COLUMN outstanding_balance DECIMAL(10,2) NOT NULL DEFAULT 0",
    ] as $query) {
        try {
            $pdo->exec($query);
        } catch (PDOException $e) {
            // Existing databases may already be compatible
        }
    }
}

if ($method === 'GET' && $id === 'credit-collections') {
    try {
        ensureCreditAccountTables();
        $date = isset($_GET['date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['date']) ? $_GET['date'] : date('Y-m-d');
        $cycleId = isset($_GET['sales_cycle_id']) ? trim($_GET['sales_cycle_id']) : '';
        $where = ["p.status = 'completed'", 'p.received_by = ?', 'DATE(p.payment_date) = ?'];
        $params = [$user['id'], $date];
        if ($cycleId !== '') {
            $where[] = 'p.sales_cycle_id = ?';
            $params[] = $cycleId;
        }
        $stmt = $pdo->prepare("
            SELECT p.payment_method, COUNT(*) AS payments, COALESCE(SUM(p.amount), 0) AS total
            FROM customer_credit_payments p
            WHERE " . implode(' AND ', $where) . "
            GROUP BY p.payment_method
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $totals = ['Cash' => 0, 'Card' => 0, 'Bank Transfer' => 0];
        foreach ($rows as $row) $totals[$row['payment_method']] = (float)$row['total'];
        sendJson(['date' => $date, 'sales_cycle_id' => $cycleId ?: null, 'totals' => $totals, 'rows' => $rows]);
    } catch (PDOException $e) {
        sendJson(['error' => 'Unable to load credit collections'], 500);
    }
}

if ($method === 'GET' && $id && $action === 'credit') {
    try {
        ensureCustomersTable();
        ensureCreditAccountTables();

        $stmt = $pdo->prepare('
            SELECT id, name, status, credit_limit, outstanding_balance, total_purchases,
                   GREATEST(0, credit_limit - outstanding_balance) AS available_credit
            FROM customers WHERE id = ? LIMIT 1
        ');
        $stmt->execute([$id]);
        $customer = $stmt->fetch();
        if (!$customer) sendJson(['error' => 'Customer not found'], 404);

        $stmt = $pdo->prepare("
            SELECT p.*, u.username AS received_by_name
            FROM customer_credit_payments p
            LEFT JOIN users u ON u.id = p.received_by
            WHERE p.customer_id = ?
            ORDER BY p.payment_date DESC, p.id DESC
        ");
        $stmt->execute([$id]);
        $payments = $stmt->fetchAll();

        $stmt = $pdo->prepare("
            SELECT l.*, u.username AS created_by_name
            FROM customer_credit_ledger l
            LEFT JOIN users u ON u.id = l.created_by
            WHERE l.customer_id = ?
            ORDER BY l.created_at DESC, l.id DESC
        ");
        $stmt->execute([$id]);
        $ledger = $stmt->fetchAll();

        $stmt = $pdo->prepare("
            SELECT s.id, s.created_at, s.total_amount, s.status,
                   COALESCE(SUM(CASE WHEN a.status = 'active' THEN a.allocated_amount ELSE 0 END), 0) AS paid_amount,
                   GREATEST(0, s.total_amount - COALESCE(SUM(CASE WHEN a.status = 'active' THEN a.allocated_amount ELSE 0 END), 0)) AS due_amount
            FROM sales s
            LEFT JOIN customer_credit_allocations a ON a.sale_id = s.id
            WHERE s.customer_id = ? AND s.payment_method = 'Credit'
            GROUP BY s.id, s.created_at, s.total_amount, s.status
            ORDER BY s.created_at DESC, s.id DESC
        ");
        $stmt->execute([$id]);
        $invoices = $stmt->fetchAll();

        sendJson([
            'customer' => $customer,
            'payments' => $payments,
            'ledger' => $ledger,
            'invoices' => $invoices,
        ]);
    } catch (PDOException $e) {
        sendJson(['error' => 'Unable to load customer credit account'], 500);
    }
}

if ($method === 'POST' && $id && $action === 'payments') {
    try {
        $permissions = isset($user['permissions']) && is_array($user['permissions']) ? $user['permissions'] : [];
        if ($user['role'] !== 'admin' && !in_array('pos_billing', $permissions, true) && !in_array('manage_customers', $permissions, true)) {
            sendJson(['error' => 'You do not have permission to receive credit payments'], 403);
        }
        ensureCustomersTable();
        ensureCreditAccountTables();

        $amount = isset($inputData['amount']) ? round((float)$inputData['amount'], 2) : 0;
        $paymentMethod = isset($inputData['payment_method']) ? trim($inputData['payment_method']) : '';
        $paymentDate = !empty($inputData['payment_date']) ? $inputData['payment_date'] : date('Y-m-d H:i:s');
        $reference = isset($inputData['reference_number']) ? trim($inputData['reference_number']) : null;
        $notes = isset($inputData['notes']) ? trim($inputData['notes']) : null;
        $salesCycleId = isset($inputData['sales_cycle_id']) && trim($inputData['sales_cycle_id']) !== '' ? trim($inputData['sales_cycle_id']) : null;

        if ($amount <= 0) sendJson(['error' => 'Payment amount must be greater than zero'], 400);
        if (!in_array($paymentMethod, ['Cash', 'Card', 'Bank Transfer'], true)) {
            sendJson(['error' => 'Select Cash, Card, or Bank Transfer'], 400);
        }

        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT id, name, outstanding_balance, credit_limit FROM customers WHERE id = ? FOR UPDATE');
        $stmt->execute([$id]);
        $customer = $stmt->fetch();
        if (!$customer) {
            $pdo->rollBack();
            sendJson(['error' => 'Customer not found'], 404);
        }

        $outstanding = (float)$customer['outstanding_balance'];
        if ($outstanding <= 0) throw new Exception('This customer has no outstanding credit balance');
        if ($amount > $outstanding + 0.001) {
            throw new Exception('Payment cannot exceed the outstanding balance of Rs. ' . number_format($outstanding, 2));
        }

        $stmt = $pdo->prepare("
            INSERT INTO customer_credit_payments
                (customer_id, amount, payment_method, payment_date, reference_number, notes, received_by, sales_cycle_id, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')
        ");
        $stmt->execute([$id, $amount, $paymentMethod, $paymentDate, $reference, $notes, $user['id'], $salesCycleId]);
        $paymentId = (int)$pdo->lastInsertId();

        $allocationResult = allocateCreditPayment($paymentId, $id, $amount);
        $nextBalance = max(0, $outstanding - $amount);
        $stmt = $pdo->prepare('UPDATE customers SET outstanding_balance = ? WHERE id = ?');
        $stmt->execute([$nextBalance, $id]);

        addCreditLedgerEntry(
            $id, 'payment', 0, $amount, $nextBalance, null, $paymentId,
            $reference ?: "PAY-{$paymentId}",
            $notes ?: "Credit settlement received by {$paymentMethod}",
            $user['id']
        );

        $pdo->commit();
        sendJson([
            'message' => 'Credit payment recorded successfully',
            'payment_id' => $paymentId,
            'outstanding_balance' => $nextBalance,
            'available_credit' => max(0, (float)$customer['credit_limit'] - $nextBalance),
            'allocations' => $allocationResult['allocations'],
        ], 201);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendJson(['error' => $e->getMessage()], 400);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendJson(['error' => 'Unable to record credit payment'], 500);
    }
}

if ($method === 'POST' && $id && $action === 'payment-reversal') {
    try {
        $permissions = isset($user['permissions']) && is_array($user['permissions']) ? $user['permissions'] : [];
        if ($user['role'] !== 'admin' && !in_array('manage_customers', $permissions, true)) {
            sendJson(['error' => 'Administrator approval is required to reverse credit payments'], 403);
        }
        ensureCustomersTable();
        ensureCreditAccountTables();
        $paymentId = isset($inputData['payment_id']) ? (int)$inputData['payment_id'] : 0;
        $reason = isset($inputData['reason']) ? trim($inputData['reason']) : '';
        if (!$paymentId || $reason === '') sendJson(['error' => 'Payment and reversal reason are required'], 400);

        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT * FROM customer_credit_payments WHERE id = ? AND customer_id = ? FOR UPDATE');
        $stmt->execute([$paymentId, $id]);
        $payment = $stmt->fetch();
        if (!$payment) throw new Exception('Credit payment not found');
        if ($payment['status'] !== 'completed') throw new Exception('This payment is already reversed');

        $stmt = $pdo->prepare('SELECT outstanding_balance FROM customers WHERE id = ? FOR UPDATE');
        $stmt->execute([$id]);
        $outstanding = (float)$stmt->fetchColumn();
        $nextBalance = $outstanding + (float)$payment['amount'];

        $stmt = $pdo->prepare("UPDATE customer_credit_payments SET status = 'reversed', reversed_at = NOW(), reversed_by = ?, reversal_reason = ? WHERE id = ?");
        $stmt->execute([$user['id'], $reason, $paymentId]);
        $stmt = $pdo->prepare("UPDATE customer_credit_allocations SET status = 'reversed' WHERE payment_id = ? AND status = 'active'");
        $stmt->execute([$paymentId]);
        $stmt = $pdo->prepare('UPDATE customers SET outstanding_balance = ? WHERE id = ?');
        $stmt->execute([$nextBalance, $id]);

        addCreditLedgerEntry(
            $id, 'payment_reversal', (float)$payment['amount'], 0, $nextBalance,
            null, $paymentId, "REV-PAY-{$paymentId}", $reason, $user['id']
        );

        $pdo->commit();
        sendJson(['message' => 'Credit payment reversed', 'outstanding_balance' => $nextBalance]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendJson(['error' => $e->getMessage()], 400);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        sendJson(['error' => 'Unable to reverse credit payment'], 500);
    }
}

if ($method === 'GET' && !$id) {
    try {
        ensureCustomersTable();
        $stmt = $pdo->query('SELECT * FROM customers ORDER BY id DESC');
        $customers = $stmt->fetchAll();
        sendJson($customers);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'POST' && !$id) {
    try {
        ensureCustomersTable();
        $name = isset($inputData['name']) ? trim($inputData['name']) : '';
        $phone = isset($inputData['phone']) ? $inputData['phone'] : null;
        $email = isset($inputData['email']) ? $inputData['email'] : null;
        $address = isset($inputData['address']) ? $inputData['address'] : null;
        $company_notes = isset($inputData['company_notes']) ? $inputData['company_notes'] : null;
        $customer_type = isset($inputData['customer_type']) ? $inputData['customer_type'] : 'Regular Customer';
        $status = isset($inputData['status']) ? $inputData['status'] : 'Active';
        $credit_limit = isset($inputData['credit_limit']) ? (float)$inputData['credit_limit'] : 0.00;

        if (empty($name)) {
            sendJson(["error" => "Customer name is required"], 400);
        }

        $stmt = $pdo->prepare('
            INSERT INTO customers (
                name, phone, email, address, company_notes, customer_type, status, credit_limit
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ');
        $stmt->execute([
            $name, $phone, $email, $address, $company_notes, $customer_type, $status, $credit_limit
        ]);

        sendJson(["id" => $pdo->lastInsertId(), "message" => "Customer created successfully"], 201);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'PUT' && $id) {
    try {
        ensureCustomersTable();
        $name = isset($inputData['name']) ? trim($inputData['name']) : '';
        $phone = isset($inputData['phone']) ? $inputData['phone'] : null;
        $email = isset($inputData['email']) ? $inputData['email'] : null;
        $address = isset($inputData['address']) ? $inputData['address'] : null;
        $company_notes = isset($inputData['company_notes']) ? $inputData['company_notes'] : null;
        $customer_type = isset($inputData['customer_type']) ? $inputData['customer_type'] : 'Regular Customer';
        $status = isset($inputData['status']) ? $inputData['status'] : 'Active';
        $credit_limit = isset($inputData['credit_limit']) ? (float)$inputData['credit_limit'] : 0.00;

        if (empty($name)) {
            sendJson(["error" => "Customer name is required"], 400);
        }

        $stmt = $pdo->prepare('
            UPDATE customers SET 
                name = ?, phone = ?, email = ?, address = ?, company_notes = ?, 
                customer_type = ?, status = ?, credit_limit = ?
            WHERE id = ?
        ');
        $stmt->execute([
            $name, $phone, $email, $address, $company_notes, $customer_type, 
            $status, $credit_limit, $id
        ]);

        sendJson(["message" => "Customer updated successfully"]);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'DELETE' && $id) {
    try {
        ensureCustomersTable();
        $stmt = $pdo->prepare('DELETE FROM customers WHERE id = ?');
        $stmt->execute([$id]);
        
        if ($stmt->rowCount() === 0) {
            sendJson(["error" => "Customer not found"], 404);
        }
        
        sendJson(["message" => "Customer deleted successfully"]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) { // Foreign key constraint
            sendJson(["error" => "Cannot delete customer because they have associated sales records."], 400);
        }
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
