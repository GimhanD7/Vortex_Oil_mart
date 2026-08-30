<?php

function ensureCreditColumn($table, $column, $definition) {
    global $pdo;
    try {
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
        $stmt->execute([$table, $column]);
        if ((int)$stmt->fetchColumn() === 0) {
            $pdo->exec("ALTER TABLE `$table` ADD COLUMN $definition");
        }
    } catch (Exception $e) {}
}

function ensureCreditAccountTables() {
    global $pdo;

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS customer_credit_payments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT NOT NULL,
            amount DECIMAL(12,2) NOT NULL,
            payment_method VARCHAR(40) NOT NULL,
            payment_date DATETIME NOT NULL,
            reference_number VARCHAR(120) NULL,
            notes VARCHAR(500) NULL,
            received_by INT NULL,
            sales_cycle_id VARCHAR(60) NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'completed',
            reversed_at DATETIME NULL,
            reversed_by INT NULL,
            reversal_reason VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_credit_payment_customer (customer_id),
            INDEX idx_credit_payment_date (payment_date),
            INDEX idx_credit_payment_status (status),
            INDEX idx_credit_payment_cycle (sales_cycle_id)
        )
    ");

    ensureCreditColumn('customer_credit_payments', 'received_by', '`received_by` INT NULL');
    ensureCreditColumn('customer_credit_payments', 'sales_cycle_id', '`sales_cycle_id` VARCHAR(60) NULL');
    ensureCreditColumn('customer_credit_payments', 'reference_number', '`reference_number` VARCHAR(120) NULL');
    ensureCreditColumn('customer_credit_payments', 'notes', '`notes` VARCHAR(500) NULL');
    ensureCreditColumn('customer_credit_payments', 'status', "`status` VARCHAR(30) NOT NULL DEFAULT 'completed'");
    ensureCreditColumn('customer_credit_payments', 'reversed_at', '`reversed_at` DATETIME NULL');
    ensureCreditColumn('customer_credit_payments', 'reversed_by', '`reversed_by` INT NULL');
    ensureCreditColumn('customer_credit_payments', 'reversal_reason', '`reversal_reason` VARCHAR(255) NULL');

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS customer_credit_allocations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            payment_id INT NOT NULL,
            sale_id INT NOT NULL,
            allocated_amount DECIMAL(12,2) NOT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_credit_allocation_payment (payment_id),
            INDEX idx_credit_allocation_sale (sale_id),
            INDEX idx_credit_allocation_status (status)
        )
    ");

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS customer_credit_ledger (
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_id INT NOT NULL,
            transaction_type VARCHAR(40) NOT NULL,
            debit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            credit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            balance_after DECIMAL(12,2) NOT NULL DEFAULT 0,
            sale_id INT NULL,
            payment_id INT NULL,
            reference_number VARCHAR(120) NULL,
            notes VARCHAR(500) NULL,
            created_by INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_credit_ledger_customer (customer_id),
            INDEX idx_credit_ledger_sale (sale_id),
            INDEX idx_credit_ledger_payment (payment_id),
            INDEX idx_credit_ledger_created (created_at)
        )
    ");

    ensureCreditColumn('customer_credit_ledger', 'sale_id', '`sale_id` INT NULL');
    ensureCreditColumn('customer_credit_ledger', 'payment_id', '`payment_id` INT NULL');
    ensureCreditColumn('customer_credit_ledger', 'reference_number', '`reference_number` VARCHAR(120) NULL');
    ensureCreditColumn('customer_credit_ledger', 'notes', '`notes` VARCHAR(500) NULL');
    ensureCreditColumn('customer_credit_ledger', 'created_by', '`created_by` INT NULL');

    try {
        $pdo->exec("ALTER TABLE customer_credit_ledger MODIFY COLUMN reference_type VARCHAR(40) NULL");
        $pdo->exec("ALTER TABLE customer_credit_ledger MODIFY COLUMN reference_id INT NULL");
    } catch (Exception $e) {}

    try {
        $pdo->exec("
            INSERT INTO customer_credit_ledger
                (customer_id, transaction_type, debit_amount, credit_amount, balance_after, reference_number, notes)
            SELECT c.id, 'opening_balance', c.outstanding_balance, 0, c.outstanding_balance,
                   'MIGRATION', 'Opening balance migrated from existing customer account'
            FROM customers c
            WHERE c.outstanding_balance > 0
              AND NOT EXISTS (
                  SELECT 1 FROM customer_credit_ledger l WHERE l.customer_id = c.id
              )
        ");
    } catch (Exception $e) {}
}

function addCreditLedgerEntry($customerId, $type, $debit, $credit, $balanceAfter, $saleId = null, $paymentId = null, $reference = null, $notes = null, $createdBy = null) {
    global $pdo;
    $stmt = $pdo->prepare("
        INSERT INTO customer_credit_ledger
            (customer_id, transaction_type, debit_amount, credit_amount, balance_after,
             sale_id, payment_id, reference_number, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $stmt->execute([
        $customerId, $type, $debit, $credit, $balanceAfter,
        $saleId, $paymentId, $reference, $notes, $createdBy
    ]);
    return (int)$pdo->lastInsertId();
}

function activeCreditAllocationsForSale($saleId) {
    global $pdo;
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(allocated_amount), 0)
        FROM customer_credit_allocations
        WHERE sale_id = ? AND status = 'active'
    ");
    $stmt->execute([$saleId]);
    return (float)$stmt->fetchColumn();
}

function allocateCreditPayment($paymentId, $customerId, $amount) {
    global $pdo;
    $remaining = (float)$amount;
    $allocations = [];

    $stmt = $pdo->prepare("
        SELECT s.id, s.total_amount,
               COALESCE(SUM(CASE WHEN a.status = 'active' THEN a.allocated_amount ELSE 0 END), 0) AS paid_amount
        FROM sales s
        LEFT JOIN customer_credit_allocations a ON a.sale_id = s.id
        WHERE s.customer_id = ?
          AND s.payment_method = 'Credit'
          AND (s.status IS NULL OR s.status = 'completed')
        GROUP BY s.id, s.total_amount, s.created_at
        HAVING paid_amount < s.total_amount
        ORDER BY s.created_at ASC, s.id ASC
        FOR UPDATE
    ");
    $stmt->execute([$customerId]);
    $sales = $stmt->fetchAll();

    $insert = $pdo->prepare("
        INSERT INTO customer_credit_allocations (payment_id, sale_id, allocated_amount, status)
        VALUES (?, ?, ?, 'active')
    ");

    foreach ($sales as $sale) {
        if ($remaining <= 0.001) break;
        $due = max(0, (float)$sale['total_amount'] - (float)$sale['paid_amount']);
        if ($due <= 0) continue;
        $allocated = min($remaining, $due);
        $insert->execute([$paymentId, $sale['id'], $allocated]);
        $allocations[] = [
            'sale_id' => (int)$sale['id'],
            'allocated_amount' => $allocated,
        ];
        $remaining -= $allocated;
    }

    return [
        'allocations' => $allocations,
        'unallocated_amount' => max(0, $remaining),
    ];
}

?>
