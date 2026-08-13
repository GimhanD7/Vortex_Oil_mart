<?php
global $pdo, $inputData, $method;
requireAuth();

function ensureDashboardColumns() {
    global $pdo;
    $stmt = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sales' AND COLUMN_NAME = 'business_date'");
    if (empty($stmt->fetchAll())) {
        $pdo->exec('ALTER TABLE sales ADD COLUMN business_date DATE NULL');
        $pdo->exec('UPDATE sales SET business_date = DATE(created_at) WHERE business_date IS NULL');
    }
    
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
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ");
}

function safeQuery($sql) {
    global $pdo;
    try {
        $stmt = $pdo->query($sql);
        return $stmt->fetchAll();
    } catch (Exception $e) {
        return [];
    }
}

if ($method === 'GET') {
    try {
        ensureDashboardColumns();
        
        $metricsResult = safeQuery("
            SELECT
                COALESCE(SUM(s.total_amount), 0) AS revenue,
                COUNT(DISTINCT s.id) AS orders,
                COALESCE(SUM(si.quantity), 0) AS items_sold,
                COALESCE(AVG(s.total_amount), 0) AS average_order_value
            FROM sales s
            LEFT JOIN sale_items si ON si.sale_id = s.id
            WHERE s.status IS NULL OR s.status != 'refunded'
        ");
        $metrics = $metricsResult ? $metricsResult[0] : null;

        $inventoryResult = safeQuery("
            SELECT COUNT(*) AS total_products,
                   COUNT(DISTINCT sku) AS total_skus,
                   SUM(CASE WHEN stock_quantity > 0 THEN 1 ELSE 0 END) AS in_stock,
                   SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock,
                   SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= reorder_level THEN 1 ELSE 0 END) AS low_stock,
                   COALESCE(SUM(price * stock_quantity), 0) AS stock_value
            FROM products
        ");
        $inventory = $inventoryResult ? $inventoryResult[0] : null;

        $customersResult = safeQuery("SELECT COUNT(*) AS total_customers FROM customers");
        
        $lowStock = safeQuery("
            SELECT id, name, sku, category, stock_quantity
            FROM products
            WHERE stock_quantity > 0 AND stock_quantity <= reorder_level
            ORDER BY stock_quantity ASC, name ASC
            LIMIT 5
        ");

        $recentOrders = safeQuery("
            SELECT s.id, s.total_amount, s.status, s.created_at, c.name AS customer_name,
                   COALESCE(SUM(si.quantity), 0) AS item_count
            FROM sales s
            LEFT JOIN customers c ON c.id = s.customer_id
            LEFT JOIN sale_items si ON si.sale_id = s.id
            GROUP BY s.id, s.total_amount, s.status, s.created_at, c.name
            ORDER BY s.id DESC
            LIMIT 5
        ");

        $topProducts = safeQuery("
            SELECT p.name, p.category, SUM(si.quantity) AS quantity, SUM(si.quantity * si.price_at_time) AS total
            FROM sale_items si
            JOIN products p ON p.id = si.product_id
            JOIN sales s ON s.id = si.sale_id
            WHERE s.status IS NULL OR s.status != 'refunded'
            GROUP BY p.id, p.name, p.category
            ORDER BY quantity DESC
            LIMIT 5
        ");

        $paymentMethods = safeQuery("
            SELECT COALESCE(payment_method, 'Cash') AS method, COUNT(*) AS orders, COALESCE(SUM(total_amount), 0) AS total
            FROM sales
            WHERE status IS NULL OR status != 'refunded'
            GROUP BY COALESCE(payment_method, 'Cash')
            ORDER BY total DESC
        ");

        $categories = safeQuery("
            SELECT p.category, COALESCE(SUM(si.quantity * si.price_at_time), 0) AS total
            FROM sale_items si
            JOIN products p ON p.id = si.product_id
            JOIN sales s ON s.id = si.sale_id
            WHERE s.status IS NULL OR s.status != 'refunded'
            GROUP BY p.category
            ORDER BY total DESC
            LIMIT 6
        ");

        $daily = safeQuery("
            SELECT COALESCE(business_date, DATE(created_at)) AS date, COALESCE(SUM(total_amount), 0) AS total, COUNT(*) AS orders
            FROM sales
            WHERE COALESCE(business_date, DATE(created_at)) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
              AND (status IS NULL OR status != 'refunded')
            GROUP BY COALESCE(business_date, DATE(created_at))
            ORDER BY date ASC
        ");

        $purchasesResult = safeQuery("
            SELECT COUNT(*) AS purchase_count, COALESCE(SUM(total_amount), 0) AS purchase_value
            FROM purchases
            WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
        ");
        $purchases = $purchasesResult ? $purchasesResult[0] : ["purchase_count" => 0, "purchase_value" => 0];

        sendJson([
            "metrics" => [
                "revenue" => (float)($metrics['revenue'] ?? 0),
                "orders" => (int)($metrics['orders'] ?? 0),
                "items_sold" => (int)($metrics['items_sold'] ?? 0),
                "average_order_value" => (float)($metrics['average_order_value'] ?? 0),
                "customers" => (int)($customersResult[0]['total_customers'] ?? 0),
                "gross_profit" => round((float)($metrics['revenue'] ?? 0) * 0.22)
            ],
            "inventory" => [
                "total_products" => (int)($inventory['total_products'] ?? 0),
                "total_skus" => (int)($inventory['total_skus'] ?? 0),
                "in_stock" => (int)($inventory['in_stock'] ?? 0),
                "out_of_stock" => (int)($inventory['out_of_stock'] ?? 0),
                "low_stock" => (int)($inventory['low_stock'] ?? 0),
                "stock_value" => (float)($inventory['stock_value'] ?? 0)
            ],
            "purchases" => $purchases,
            "low_stock" => $lowStock,
            "recent_orders" => $recentOrders,
            "top_products" => $topProducts,
            "payment_methods" => $paymentMethods,
            "categories" => $categories,
            "daily" => $daily
        ]);
    } catch (Exception $e) {
        sendJson(["error" => "Internal server error"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
