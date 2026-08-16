<?php
global $pdo, $method;
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

function reportQuery($sql) {
    global $pdo;
    try {
        $stmt = $pdo->query($sql);
        return $stmt->fetchAll();
    } catch (Exception $e) {
        return [];
    }
}

function reportOne($sql, $fallback = []) {
    $rows = reportQuery($sql);
    return count($rows) ? $rows[0] : $fallback;
}

function selectedReportScope() {
    global $pdo;
    $period = isset($_GET['period']) ? $_GET['period'] : 'daily';
    if (!in_array($period, ['daily', 'monthly', 'yearly'])) {
        $period = 'daily';
    }

    $date = isset($_GET['date']) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['date']) ? $_GET['date'] : date('Y-m-d');
    $month = isset($_GET['month']) && preg_match('/^\d{4}-\d{2}$/', $_GET['month']) ? $_GET['month'] : date('Y-m');
    $year = isset($_GET['year']) && preg_match('/^\d{4}$/', $_GET['year']) ? $_GET['year'] : date('Y');

    if ($period === 'monthly') {
        $label = date('F Y', strtotime($month . '-01'));
        $salesWhere = "DATE_FORMAT(COALESCE(s.business_date, DATE(s.created_at)), '%Y-%m') = " . $pdo->quote($month);
        $plainSalesWhere = "DATE_FORMAT(COALESCE(business_date, DATE(created_at)), '%Y-%m') = " . $pdo->quote($month);
        $createdWhere = "DATE_FORMAT(created_at, '%Y-%m') = " . $pdo->quote($month);
    } elseif ($period === 'yearly') {
        $label = $year;
        $salesWhere = "YEAR(COALESCE(s.business_date, DATE(s.created_at))) = " . (int)$year;
        $plainSalesWhere = "YEAR(COALESCE(business_date, DATE(created_at))) = " . (int)$year;
        $createdWhere = "YEAR(created_at) = " . (int)$year;
    } else {
        $label = date('d M Y', strtotime($date));
        $salesWhere = "COALESCE(s.business_date, DATE(s.created_at)) = " . $pdo->quote($date);
        $plainSalesWhere = "COALESCE(business_date, DATE(created_at)) = " . $pdo->quote($date);
        $createdWhere = "DATE(created_at) = " . $pdo->quote($date);
    }

    return [
        "period" => $period,
        "date" => $date,
        "month" => $month,
        "year" => $year,
        "label" => $label,
        "sales_where" => $salesWhere,
        "plain_sales_where" => $plainSalesWhere,
        "created_where" => $createdWhere
    ];
}

if ($method === 'GET') {
    try {
        ensureReportColumns();

        $completedSaleWhere = "(s.status IS NULL OR s.status = '' OR s.status = 'completed')";
        $completedPlainWhere = "(status IS NULL OR status = '' OR status = 'completed')";
        $scope = selectedReportScope();

        $daily = reportQuery("
            SELECT COALESCE(business_date, DATE(created_at)) as date, COALESCE(SUM(total_amount), 0) as total, COUNT(id) as orders
            FROM sales
            WHERE COALESCE(business_date, DATE(created_at)) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
              AND $completedPlainWhere
            GROUP BY COALESCE(business_date, DATE(created_at))
            ORDER BY date ASC
        ");

        $monthly = reportQuery("
            SELECT DATE_FORMAT(COALESCE(business_date, DATE(created_at)), '%Y-%m') as month, COALESCE(SUM(total_amount), 0) as total, COUNT(id) as orders
            FROM sales
            WHERE COALESCE(business_date, DATE(created_at)) >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
              AND $completedPlainWhere
            GROUP BY month
            ORDER BY month ASC
        ");

        $yearly = reportQuery("
            SELECT YEAR(COALESCE(business_date, DATE(created_at))) as year, COALESCE(SUM(total_amount), 0) as total, COUNT(id) as orders
            FROM sales
            WHERE $completedPlainWhere
            GROUP BY year
            ORDER BY year ASC
        ");

        $summary = reportOne("
            SELECT
                COUNT(DISTINCT s.id) AS invoices,
                COALESCE(SUM(s.subtotal_amount), 0) AS subtotal,
                COALESCE(SUM(s.discount_amount), 0) AS discounts,
                COALESCE(SUM(s.total_amount), 0) AS net_sales,
                COALESCE(SUM(si.quantity), 0) AS items_sold,
                COALESCE(AVG(s.total_amount), 0) AS average_order,
                COUNT(DISTINCT s.customer_id) AS customers
            FROM sales s
            LEFT JOIN sale_items si ON si.sale_id = s.id
            WHERE {$scope['sales_where']} AND $completedSaleWhere
        ", [
            "invoices" => 0,
            "subtotal" => 0,
            "discounts" => 0,
            "net_sales" => 0,
            "items_sold" => 0,
            "average_order" => 0,
            "customers" => 0
        ]);

        $sales = reportQuery("
            SELECT
                s.id,
                s.business_date,
                s.created_at,
                s.subtotal_amount,
                s.discount_amount,
                s.total_amount,
                s.payment_method,
                s.status,
                COALESCE(u.username, CONCAT('User #', s.cashier_id)) AS cashier,
                COALESCE(c.name, 'Walk-in Customer') AS customer,
                COALESCE(SUM(si.quantity), 0) AS item_count
            FROM sales s
            LEFT JOIN users u ON u.id = s.cashier_id
            LEFT JOIN customers c ON c.id = s.customer_id
            LEFT JOIN sale_items si ON si.sale_id = s.id
            WHERE {$scope['sales_where']} AND $completedSaleWhere
            GROUP BY s.id, s.business_date, s.created_at, s.subtotal_amount, s.discount_amount, s.total_amount, s.payment_method, s.status, u.username, c.name
            ORDER BY s.created_at DESC, s.id DESC
            LIMIT 500
        ");

        $products = reportQuery("
            SELECT
                p.name,
                p.sku,
                p.category,
                p.brand,
                p.unit,
                SUM(si.quantity) AS quantity,
                SUM(si.quantity * si.price_at_time) AS revenue,
                COUNT(DISTINCT s.id) AS invoices
            FROM sale_items si
            JOIN products p ON p.id = si.product_id
            JOIN sales s ON s.id = si.sale_id
            WHERE {$scope['sales_where']} AND $completedSaleWhere
            GROUP BY p.id, p.name, p.sku, p.category, p.brand, p.unit
            ORDER BY revenue DESC, quantity DESC
            LIMIT 500
        ");

        $line_items = reportQuery("
            SELECT
                s.id AS sale_id,
                s.created_at,
                COALESCE(u.username, CONCAT('User #', s.cashier_id)) AS cashier,
                COALESCE(c.name, 'Walk-in Customer') AS customer,
                p.name AS product,
                p.sku,
                p.unit,
                si.quantity,
                si.price_at_time,
                (si.quantity * si.price_at_time) AS total
            FROM sale_items si
            JOIN sales s ON s.id = si.sale_id
            JOIN products p ON p.id = si.product_id
            LEFT JOIN users u ON u.id = s.cashier_id
            LEFT JOIN customers c ON c.id = s.customer_id
            WHERE {$scope['sales_where']} AND $completedSaleWhere
            ORDER BY s.created_at DESC, s.id DESC
            LIMIT 750
        ");

        $brands = reportQuery("
            SELECT p.brand, COALESCE(SUM(si.quantity * si.price_at_time), 0) as total, COALESCE(SUM(si.quantity), 0) as items_sold
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON s.id = si.sale_id
            WHERE {$scope['sales_where']} AND $completedSaleWhere
            GROUP BY p.brand
            ORDER BY total DESC
        ");

        $categories = reportQuery("
            SELECT p.category, COALESCE(SUM(si.quantity * si.price_at_time), 0) as total, COALESCE(SUM(si.quantity), 0) as items_sold
            FROM sale_items si
            JOIN products p ON si.product_id = p.id
            JOIN sales s ON s.id = si.sale_id
            WHERE {$scope['sales_where']} AND $completedSaleWhere
            GROUP BY p.category
            ORDER BY total DESC
        ");

        $staff = reportQuery("
            SELECT COALESCE(u.username, CONCAT('User #', s.cashier_id)) as cashier, COUNT(DISTINCT s.id) as orders, COALESCE(SUM(s.total_amount), 0) as total
            FROM sales s
            LEFT JOIN users u ON s.cashier_id = u.id
            WHERE {$scope['sales_where']} AND $completedSaleWhere
            GROUP BY s.cashier_id, u.username
            ORDER BY total DESC
        ");

        $payment_methods = reportQuery("
            SELECT COALESCE(payment_method, 'Cash') AS payment_method, COUNT(*) AS orders, COALESCE(SUM(total_amount), 0) AS total
            FROM sales
            WHERE {$scope['plain_sales_where']} AND $completedPlainWhere
            GROUP BY COALESCE(payment_method, 'Cash')
            ORDER BY total DESC
        ");

        $purchases = reportQuery("
            SELECT DATE(created_at) AS date, supplier, payment_method, COUNT(*) AS purchases, COALESCE(SUM(total_amount), 0) AS total
            FROM purchases
            WHERE {$scope['created_where']}
            GROUP BY DATE(created_at), supplier, payment_method
            ORDER BY date DESC, total DESC
        ");

        $purchaseSummary = reportOne("
            SELECT COUNT(*) AS purchases, COALESCE(SUM(total_amount), 0) AS total
            FROM purchases
            WHERE {$scope['created_where']}
        ", ["purchases" => 0, "total" => 0]);

        $inventory_movements = reportQuery("
            SELECT movement_type, COUNT(*) AS transactions,
                   COALESCE(SUM(quantity_change), 0) AS quantity,
                   COALESCE(SUM(ABS(quantity_change) * unit_price), 0) AS value
            FROM inventory_movements
            WHERE {$scope['created_where']}
            GROUP BY movement_type
            ORDER BY value DESC
        ");

        $revocations = reportQuery("
            SELECT
                tr.created_at,
                tr.sale_id,
                tr.action_type,
                tr.reason,
                tr.affected_amount,
                COALESCE(cashier.username, 'Unknown') AS cashier,
                COALESCE(approver.username, 'Not required') AS approver
            FROM transaction_revocations tr
            LEFT JOIN users cashier ON cashier.id = tr.cashier_id
            LEFT JOIN users approver ON approver.id = tr.approver_id
            WHERE {$scope['created_where']}
            ORDER BY tr.created_at DESC
            LIMIT 300
        ");

        sendJson([
            "daily" => $daily,
            "monthly" => $monthly,
            "yearly" => $yearly,
            "selected" => [
                "period" => $scope["period"],
                "date" => $scope["date"],
                "month" => $scope["month"],
                "year" => $scope["year"],
                "label" => $scope["label"],
                "summary" => $summary,
                "purchase_summary" => $purchaseSummary,
                "sales" => $sales,
                "products" => $products,
                "line_items" => $line_items,
                "brands" => $brands,
                "categories" => $categories,
                "staff" => $staff,
                "payment_methods" => $payment_methods,
                "purchases" => $purchases,
                "inventory_movements" => $inventory_movements,
                "revocations" => $revocations
            ]
        ]);
    } catch (PDOException $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
