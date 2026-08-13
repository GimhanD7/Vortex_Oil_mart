<?php
global $pdo, $inputData, $id, $method;
requireAuth(); // Require auth for customers

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
        $name = isset($inputData['name']) ? trim($inputData['name']) : '';
        $phone = isset($inputData['phone']) ? $inputData['phone'] : null;
        $email = isset($inputData['email']) ? $inputData['email'] : null;
        $address = isset($inputData['address']) ? $inputData['address'] : null;
        $company_notes = isset($inputData['company_notes']) ? $inputData['company_notes'] : null;
        $customer_type = isset($inputData['customer_type']) ? $inputData['customer_type'] : 'Regular Customer';
        $status = isset($inputData['status']) ? $inputData['status'] : 'Active';
        $credit_limit = isset($inputData['credit_limit']) ? (float)$inputData['credit_limit'] : 0.00;
        $outstanding_balance = isset($inputData['outstanding_balance']) ? (float)$inputData['outstanding_balance'] : 0.00;
        $total_purchases = isset($inputData['total_purchases']) ? (float)$inputData['total_purchases'] : 0.00;

        if (empty($name)) {
            sendJson(["error" => "Customer name is required"], 400);
        }

        $stmt = $pdo->prepare('
            UPDATE customers SET 
                name = ?, phone = ?, email = ?, address = ?, company_notes = ?, 
                customer_type = ?, status = ?, credit_limit = ?, outstanding_balance = ?, total_purchases = ?
            WHERE id = ?
        ');
        $stmt->execute([
            $name, $phone, $email, $address, $company_notes, $customer_type, 
            $status, $credit_limit, $outstanding_balance, $total_purchases, $id
        ]);

        sendJson(["message" => "Customer updated successfully"]);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

if ($method === 'DELETE' && $id) {
    try {
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
