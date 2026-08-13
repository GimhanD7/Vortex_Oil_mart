<?php
global $pdo, $inputData, $method;
requireAuth();

function ensureReportColumns() {
    global $pdo;
    $stmt = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'business_date'");
    $existing = $stmt->fetchAll();
    if (empty($existing)) {
        $pdo->exec('ALTER TABLE sales ADD COLUMN business_date DATE NULL');
        $pdo->exec('UPDATE sales SET business_date = DATE(created_at) WHERE business_date IS NULL');
    }
}

if ($method === 'GET') {
    try {
        ensureReportColumns();
        
        $stmt = $pdo->query("
            SELECT COALESCE(business_date, DATE(created_at)) as date, SUM(total_amount) as total, COUNT(id) as orders
            FROM sales
            WHERE COALESCE(business_date, DATE(created_at)) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
              AND (status IS NULL OR status != 'refunded')
            GROUP BY COALESCE(business_date, DATE(created_at))
            ORDER BY date ASC
        ");
        $daily = $stmt->fetchAll();

        $stmt = $pdo->query("
            SELECT DATE_FORMAT(COALESCE(business_date, DATE(created_at)), '%Y-%m') as month, SUM(total_amount) as total, COUNT(id) as orders
            FROM sales
            WHERE COALESCE(business_date, DATE(created_at)) >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
              AND (status IS NULL OR status != 'refunded')
            GROUP BY month
            ORDER BY month ASC
        ");
        $monthly = $stmt->fetchAll();

        $stmt = $pdo->query("
            SELECT YEAR(COALESCE(business_date, DATE(created_at))) as year, SUM(total_amount) as total, COUNT(id) as orders
            FROM sales
            WHERE status IS NULL OR status != 'refunded'
            GROUP BY year
            ORDER BY year ASC
        ");
        $yearly = $stmt->fetchAll();

        $stmt = $pdo->query("
            SELECT p.brand, SUM(si.quantity * si.price_at_time) as total, SUM(si.quantity) as items_sold
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON s.id = si.sale_id
            WHERE s.status IS NULL OR s.status != 'refunded'
            GROUP BY p.brand
            ORDER BY total DESC
        ");
        $brands = $stmt->fetchAll();

        $stmt = $pdo->query("
            SELECT p.category, SUM(si.quantity * si.price_at_time) as total, SUM(si.quantity) as items_sold
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON s.id = si.sale_id
            WHERE s.status IS NULL OR s.status != 'refunded'
            GROUP BY p.category
            ORDER BY total DESC
        ");
        $categories = $stmt->fetchAll();

        $stmt = $pdo->query("
            SELECT u.username as cashier, COUNT(s.id) as orders, SUM(s.total_amount) as total
            FROM sales s
            LEFT JOIN users u ON s.cashier_id = u.id
            WHERE s.status IS NULL OR s.status != 'refunded'
            GROUP BY u.id, u.username
            ORDER BY total DESC
        ");
        $staff = $stmt->fetchAll();

        $stmt = $pdo->query("
            SELECT COALESCE(payment_method, 'Cash') AS payment_method, COUNT(*) AS orders, SUM(total_amount) AS total
            FROM sales
            WHERE status IS NULL OR status != 'refunded'
            GROUP BY COALESCE(payment_method, 'Cash')
            ORDER BY total DESC
        ");
        $payment_methods = $stmt->fetchAll();

        $stmt = $pdo->query("
            SELECT DATE(created_at) AS date, COUNT(*) AS purchases, SUM(total_amount) AS total
            FROM purchases
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date ASC
        ");
        $purchases = $stmt->fetchAll();

        $stmt = $pdo->query("
            SELECT movement_type, COUNT(*) AS transactions,
                   SUM(quantity_change) AS quantity,
                   SUM(ABS(quantity_change) * unit_price) AS value
            FROM inventory_movements
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY movement_type
            ORDER BY value DESC
        ");
        $inventory_movements = $stmt->fetchAll();

        sendJson([
            "daily" => $daily,
            "monthly" => $monthly,
            "yearly" => $yearly,
            "brands" => $brands,
            "categories" => $categories,
            "staff" => $staff,
            "payment_methods" => $payment_methods,
            "purchases" => $purchases,
            "inventory_movements" => $inventory_movements
        ]);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
