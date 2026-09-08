<?php
// Unified Database Migration & Setup Script for Vortex Oil Mart
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    echo "Forbidden: CLI execution only.\n";
    exit(1);
}

require_once __DIR__ . '/../api/environment.php';

echo "===========================================\n";
echo " Vortex Oil Mart - Unified DB Migration\n";
echo "===========================================\n\n";

try {
    $config = databaseConfig();
    echo "[1/4] Connecting to MySQL server ({$config['host']}:{$config['port']})...\n";

    // Connect to MySQL server (without selecting DB first, to ensure DB exists)
    $dsnNoDb = "mysql:host={$config['host']};port={$config['port']};charset=utf8mb4";
    $pdoRoot = new PDO($dsnNoDb, $config['user'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    
    $pdoRoot->exec("CREATE DATABASE IF NOT EXISTS `{$config['database']}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    echo "  -> Database `{$config['database']}` is ready.\n\n";

    echo "[2/4] Connecting to `{$config['database']}`...\n";
    $pdo = connectDatabase();

    echo "[3/4] Creating and validating tables...\n";
    $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");

    $tables = [
        'users' => "CREATE TABLE IF NOT EXISTS `users` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `username` VARCHAR(255) NOT NULL UNIQUE,
            `password` VARCHAR(255) NOT NULL,
            `role` ENUM('admin', 'cashier') DEFAULT 'cashier',
            `permissions` JSON NULL,
            `full_name` VARCHAR(150) NULL,
            `address` VARCHAR(500) NULL,
            `phone` VARCHAR(30) NULL,
            `id_number` VARCHAR(80) NULL,
            `employment_start_date` DATE NULL,
            `employment_end_date` DATE NULL,
            `employment_status` VARCHAR(20) NOT NULL DEFAULT 'active',
            `employee_notes` VARCHAR(1000) NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'categories' => "CREATE TABLE IF NOT EXISTS `categories` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `name` VARCHAR(100) NOT NULL UNIQUE,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'brands' => "CREATE TABLE IF NOT EXISTS `brands` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `name` VARCHAR(100) NOT NULL UNIQUE,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'sub_categories' => "CREATE TABLE IF NOT EXISTS `sub_categories` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `name` VARCHAR(100) NOT NULL,
            `category_name` VARCHAR(100) NOT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY `unique_sub_cat` (`name`, `category_name`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'products' => "CREATE TABLE IF NOT EXISTS `products` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `name` VARCHAR(255) NOT NULL,
            `description` TEXT,
            `price` DECIMAL(10, 2) NOT NULL,
            `stock_quantity` DECIMAL(12,3) NOT NULL DEFAULT 0,
            `sku` VARCHAR(100) UNIQUE,
            `barcode` VARCHAR(100) UNIQUE,
            `category` VARCHAR(100) NOT NULL DEFAULT 'Uncategorized',
            `sub_category` VARCHAR(100) NOT NULL DEFAULT 'General',
            `brand` VARCHAR(100) NOT NULL DEFAULT 'Generic',
            `product_type` VARCHAR(30) NOT NULL DEFAULT 'packaged',
            `unit` VARCHAR(20) NOT NULL DEFAULT 'Unit',
            `barrel_capacity_liters` DECIMAL(10,3) NULL,
            `reorder_level` DECIMAL(12,3) NOT NULL DEFAULT 10,
            `location` VARCHAR(100) NOT NULL DEFAULT 'Main Store',
            `batch_no` VARCHAR(100),
            `supplier` VARCHAR(150) NOT NULL DEFAULT 'Not Assigned',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'customers' => "CREATE TABLE IF NOT EXISTS `customers` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `name` VARCHAR(255) NOT NULL,
            `phone` VARCHAR(50),
            `email` VARCHAR(255),
            `address` TEXT,
            `company_notes` TEXT,
            `customer_type` VARCHAR(100) DEFAULT 'Regular Customer',
            `status` ENUM('Active', 'Inactive') DEFAULT 'Active',
            `credit_limit` DECIMAL(10, 2) DEFAULT 0.00,
            `outstanding_balance` DECIMAL(10, 2) DEFAULT 0.00,
            `total_purchases` DECIMAL(10, 2) DEFAULT 0.00,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'sales' => "CREATE TABLE IF NOT EXISTS `sales` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `cashier_id` INT NOT NULL,
            `customer_id` INT NULL,
            `total_amount` DECIMAL(10, 2) NOT NULL,
            `subtotal_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
            `discount_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
            `discount_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
            `tax_rate` DECIMAL(5, 2) NOT NULL DEFAULT 0,
            `tax_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
            `payment_method` VARCHAR(40) NOT NULL DEFAULT 'Cash',
            `cash_received` DECIMAL(10, 2) NULL,
            `cash_balance` DECIMAL(10, 2) NULL,
            `status` VARCHAR(30) NOT NULL DEFAULT 'completed',
            `sales_cycle_id` VARCHAR(60) NULL,
            `opening_cash_balance` DECIMAL(10, 2) NULL,
            `original_sale_id` INT NULL,
            `transaction_type` VARCHAR(20) NOT NULL DEFAULT 'sale',
            `business_date` DATE NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_sales_cashier (`cashier_id`),
            INDEX idx_sales_customer (`customer_id`),
            INDEX idx_sales_created (`created_at`),
            FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`),
            FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'sale_items' => "CREATE TABLE IF NOT EXISTS `sale_items` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `sale_id` INT NOT NULL,
            `product_id` INT NOT NULL,
            `quantity` DECIMAL(12,3) NOT NULL,
            `purchase_unit` VARCHAR(20) NOT NULL DEFAULT 'Unit',
            `barrel_count` DECIMAL(10,3) NULL,
            `barrel_capacity_liters` DECIMAL(10,3) NULL,
            `price_at_time` DECIMAL(10, 2) NOT NULL,
            INDEX idx_sale_items_sale (`sale_id`),
            INDEX idx_sale_items_product (`product_id`),
            FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
            FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'sales_cycles' => "CREATE TABLE IF NOT EXISTS `sales_cycles` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `cycle_id` VARCHAR(60) NOT NULL UNIQUE,
            `cashier_id` INT NOT NULL,
            `opened_at` DATETIME NOT NULL,
            `opened_date` DATE NOT NULL,
            `opening_balance` DECIMAL(10,2) NOT NULL DEFAULT 0,
            `closing_balance` DECIMAL(10,2) NULL,
            `closed_at` DATETIME NULL,
            `status` VARCHAR(20) NOT NULL DEFAULT 'open',
            `notes` VARCHAR(500) NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_sales_cycle_cashier (`cashier_id`),
            INDEX idx_sales_cycle_status (`status`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'sale_returns' => "CREATE TABLE IF NOT EXISTS `sale_returns` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `original_sale_id` INT NOT NULL,
            `return_number` VARCHAR(40) NULL,
            `transaction_type` VARCHAR(20) NOT NULL DEFAULT 'return',
            `resolution` VARCHAR(30) NOT NULL DEFAULT 'Cash',
            `refund_amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
            `reason` VARCHAR(255) NULL,
            `notes` TEXT NULL,
            `replacement_sale_id` INT NULL,
            `cashier_id` INT NOT NULL,
            `sales_cycle_id` VARCHAR(60) NULL,
            `status` VARCHAR(20) NOT NULL DEFAULT 'completed',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_returns_original_sale (`original_sale_id`),
            INDEX idx_returns_replacement (`replacement_sale_id`),
            INDEX idx_returns_cycle (`sales_cycle_id`),
            INDEX idx_returns_created (`created_at`),
            FOREIGN KEY (`original_sale_id`) REFERENCES `sales`(`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'sale_return_items' => "CREATE TABLE IF NOT EXISTS `sale_return_items` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `return_id` INT NOT NULL,
            `sale_item_id` INT NOT NULL,
            `product_id` INT NOT NULL,
            `quantity` DECIMAL(12,3) NOT NULL,
            `unit_price` DECIMAL(10,2) NOT NULL,
            `line_refund` DECIMAL(10,2) NOT NULL,
            `disposition` VARCHAR(30) NOT NULL DEFAULT 'resellable',
            INDEX idx_return_items_return (`return_id`),
            INDEX idx_return_items_sale_item (`sale_item_id`),
            FOREIGN KEY (`return_id`) REFERENCES `sale_returns`(`id`) ON DELETE CASCADE,
            FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'transaction_revocations' => "CREATE TABLE IF NOT EXISTS `transaction_revocations` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `sale_id` INT NULL,
            `action_type` VARCHAR(60) NOT NULL,
            `cashier_id` INT NOT NULL,
            `approver_id` INT NULL,
            `reason` VARCHAR(255) NOT NULL,
            `affected_amount` DECIMAL(10,2) NOT NULL DEFAULT 0,
            `metadata` TEXT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_revocations_sale_id (`sale_id`),
            INDEX idx_revocations_cashier_id (`cashier_id`),
            INDEX idx_revocations_approver_id (`approver_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'purchases' => "CREATE TABLE IF NOT EXISTS `purchases` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `supplier` VARCHAR(150) NOT NULL,
            `payment_method` VARCHAR(40) NOT NULL DEFAULT 'Cash',
            `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
            `status` VARCHAR(30) NOT NULL DEFAULT 'received',
            `notes` VARCHAR(500),
            `created_by` INT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'purchase_items' => "CREATE TABLE IF NOT EXISTS `purchase_items` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `purchase_id` INT NOT NULL,
            `product_id` INT NOT NULL,
            `quantity` DECIMAL(12,3) NOT NULL,
            `purchase_unit` VARCHAR(20) NOT NULL DEFAULT 'Unit',
            `barrel_count` DECIMAL(10,3) NULL,
            `barrel_capacity_liters` DECIMAL(10,3) NULL,
            `unit_cost` DECIMAL(10, 2) NOT NULL,
            INDEX idx_purchase_items_purchase (`purchase_id`),
            INDEX idx_purchase_items_product (`product_id`),
            FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE CASCADE,
            FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'inventory_movements' => "CREATE TABLE IF NOT EXISTS `inventory_movements` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `product_id` INT NOT NULL,
            `movement_type` ENUM('in', 'out', 'adjustment', 'sale', 'purchase', 'return') NOT NULL,
            `quantity_change` DECIMAL(12,3) NOT NULL,
            `stock_before` DECIMAL(12,3) NOT NULL,
            `stock_after` DECIMAL(12,3) NOT NULL,
            `unit_price` DECIMAL(10, 2) NOT NULL,
            `reference_no` VARCHAR(100),
            `notes` VARCHAR(500),
            `created_by` INT,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_inventory_product (`product_id`),
            INDEX idx_inventory_created (`created_at`),
            FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
            FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'customer_credit_payments' => "CREATE TABLE IF NOT EXISTS `customer_credit_payments` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `customer_id` INT NOT NULL,
            `amount` DECIMAL(12,2) NOT NULL,
            `payment_method` VARCHAR(40) NOT NULL,
            `payment_date` DATETIME NOT NULL,
            `reference_number` VARCHAR(120) NULL,
            `notes` VARCHAR(500) NULL,
            `received_by` INT NULL,
            `sales_cycle_id` VARCHAR(60) NULL,
            `status` VARCHAR(30) NOT NULL DEFAULT 'completed',
            `reversed_at` DATETIME NULL,
            `reversed_by` INT NULL,
            `reversal_reason` VARCHAR(255) NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_credit_payment_customer (`customer_id`),
            INDEX idx_credit_payment_date (`payment_date`),
            INDEX idx_credit_payment_status (`status`),
            INDEX idx_credit_payment_cycle (`sales_cycle_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'customer_credit_allocations' => "CREATE TABLE IF NOT EXISTS `customer_credit_allocations` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `payment_id` INT NOT NULL,
            `sale_id` INT NOT NULL,
            `allocated_amount` DECIMAL(12,2) NOT NULL,
            `status` VARCHAR(30) NOT NULL DEFAULT 'active',
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_credit_allocation_payment (`payment_id`),
            INDEX idx_credit_allocation_sale (`sale_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'customer_credit_ledger' => "CREATE TABLE IF NOT EXISTS `customer_credit_ledger` (
            `id` INT AUTO_INCREMENT PRIMARY KEY,
            `customer_id` INT NOT NULL,
            `transaction_type` VARCHAR(40) NOT NULL,
            `debit_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
            `credit_amount` DECIMAL(12,2) NOT NULL DEFAULT 0,
            `balance_after` DECIMAL(12,2) NOT NULL DEFAULT 0,
            `sale_id` INT NULL,
            `payment_id` INT NULL,
            `reference_number` VARCHAR(120) NULL,
            `notes` VARCHAR(500) NULL,
            `created_by` INT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_credit_ledger_customer (`customer_id`),
            INDEX idx_credit_ledger_sale (`sale_id`),
            INDEX idx_credit_ledger_payment (`payment_id`),
            INDEX idx_credit_ledger_created (`created_at`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'auth_sessions' => "CREATE TABLE IF NOT EXISTS `auth_sessions` (
            `token_hash` CHAR(64) PRIMARY KEY,
            `user_id` INT NOT NULL,
            `expires_at` DATETIME NOT NULL,
            `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_auth_expiry (`expires_at`),
            INDEX idx_auth_user (`user_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'auth_login_attempts' => "CREATE TABLE IF NOT EXISTS `auth_login_attempts` (
            `attempt_key` CHAR(64) PRIMARY KEY,
            `attempts` INT NOT NULL DEFAULT 0,
            `window_started` DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",

        'app_settings' => "CREATE TABLE IF NOT EXISTS `app_settings` (
            `setting_key` VARCHAR(100) PRIMARY KEY,
            `setting_value` TEXT NOT NULL,
            `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4",
    ];

    foreach ($tables as $name => $sql) {
        $pdo->exec($sql);
        echo "  [✓] Table `{$name}` verified.\n";
    }

    // Safe column migrations (in case an existing database is missing newer columns)
    $columnUpgrades = [
        'users' => [
            'permissions' => 'JSON NULL',
            'full_name' => 'VARCHAR(150) NULL',
            'address' => 'VARCHAR(500) NULL',
            'phone' => 'VARCHAR(30) NULL',
            'id_number' => 'VARCHAR(80) NULL',
            'employment_start_date' => 'DATE NULL',
            'employment_end_date' => 'DATE NULL',
            'employment_status' => "VARCHAR(20) NOT NULL DEFAULT 'active'",
            'employee_notes' => 'VARCHAR(1000) NULL',
        ],
        'products' => [
            'sku' => 'VARCHAR(100) UNIQUE',
            'barcode' => 'VARCHAR(100) UNIQUE',
            'category' => "VARCHAR(100) NOT NULL DEFAULT 'Uncategorized'",
            'sub_category' => "VARCHAR(100) NOT NULL DEFAULT 'General'",
            'brand' => "VARCHAR(100) NOT NULL DEFAULT 'Generic'",
            'product_type' => "VARCHAR(30) NOT NULL DEFAULT 'packaged'",
            'unit' => "VARCHAR(20) NOT NULL DEFAULT 'Unit'",
            'barrel_capacity_liters' => 'DECIMAL(10,3) NULL',
            'reorder_level' => 'DECIMAL(12,3) NOT NULL DEFAULT 10',
            'location' => "VARCHAR(100) NOT NULL DEFAULT 'Main Store'",
            'batch_no' => 'VARCHAR(100) NULL',
            'supplier' => "VARCHAR(150) NOT NULL DEFAULT 'Not Assigned'",
        ],
        'sales' => [
            'customer_id' => 'INT NULL',
            'subtotal_amount' => 'DECIMAL(10, 2) NOT NULL DEFAULT 0',
            'discount_rate' => 'DECIMAL(5, 2) NOT NULL DEFAULT 0',
            'discount_amount' => 'DECIMAL(10, 2) NOT NULL DEFAULT 0',
            'tax_rate' => 'DECIMAL(5, 2) NOT NULL DEFAULT 0',
            'tax_amount' => 'DECIMAL(10, 2) NOT NULL DEFAULT 0',
            'payment_method' => "VARCHAR(40) NOT NULL DEFAULT 'Cash'",
            'cash_received' => 'DECIMAL(10, 2) NULL',
            'cash_balance' => 'DECIMAL(10, 2) NULL',
            'status' => "VARCHAR(30) NOT NULL DEFAULT 'completed'",
            'sales_cycle_id' => 'VARCHAR(60) NULL',
            'opening_cash_balance' => 'DECIMAL(10, 2) NULL',
            'original_sale_id' => 'INT NULL',
            'transaction_type' => "VARCHAR(20) NOT NULL DEFAULT 'sale'",
            'business_date' => 'DATE NULL',
        ],
        'sale_items' => [
            'purchase_unit' => "VARCHAR(20) NOT NULL DEFAULT 'Unit'",
            'barrel_count' => 'DECIMAL(10,3) NULL',
            'barrel_capacity_liters' => 'DECIMAL(10,3) NULL',
        ],
        'purchase_items' => [
            'purchase_unit' => "VARCHAR(20) NOT NULL DEFAULT 'Unit'",
            'barrel_count' => 'DECIMAL(10,3) NULL',
            'barrel_capacity_liters' => 'DECIMAL(10,3) NULL',
        ],
    ];

    foreach ($columnUpgrades as $tableName => $columns) {
        $existingCols = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '{$tableName}'")->fetchAll(PDO::FETCH_COLUMN);
        foreach ($columns as $colName => $colDef) {
            if (!in_array($colName, $existingCols, true)) {
                try {
                    $pdo->exec("ALTER TABLE `{$tableName}` ADD COLUMN `{$colName}` {$colDef}");
                    echo "  [+] Added missing column `{$colName}` to `{$tableName}`.\n";
                } catch (PDOException $e) {
                    // Ignore duplicate column errors if already added
                }
            }
        }
    }

    // Verify and auto-repair products table AUTO_INCREMENT and primary key
    try {
        $productCols = $pdo->query("SHOW COLUMNS FROM `products`")->fetchAll(PDO::FETCH_ASSOC);
        $idCol = array_values(array_filter($productCols, fn($c) => $c['Field'] === 'id'));
        $indexes = [];
        foreach ($pdo->query("SHOW INDEX FROM `products`")->fetchAll(PDO::FETCH_ASSOC) as $idx) {
            if ((int)$idx['Non_unique'] === 0) $indexes[$idx['Key_name']][] = $idx['Column_name'];
        }
        $hasPrimaryId = in_array(['id'], array_values($indexes), true);
        $isAutoInc = $idCol && str_contains(strtolower($idCol[0]['Extra'] ?? ''), 'auto_increment');

        // Fix any zero or NULL product IDs
        $hasZeroId = (int)$pdo->query("SELECT COUNT(*) FROM `products` WHERE `id` IS NULL OR `id` <= 0")->fetchColumn();
        if ($hasZeroId > 0) {
            $pdo->exec("SET @max_id = IFNULL((SELECT MAX(id) FROM products WHERE id > 0), 0);
                        UPDATE products SET id = (@max_id := @max_id + 1) WHERE id IS NULL OR id <= 0;");
            echo "  [+] Fixed {$hasZeroId} zero/invalid product ID(s).\n";
        }

        if (!$hasPrimaryId || !$isAutoInc) {
            if (!$hasPrimaryId) {
                $pdo->exec("ALTER TABLE `products` ADD PRIMARY KEY (`id`), MODIFY COLUMN `id` INT AUTO_INCREMENT;");
            } else {
                $pdo->exec("ALTER TABLE `products` MODIFY COLUMN `id` INT AUTO_INCREMENT;");
            }
            echo "  [✓] Repaired `products` AUTO_INCREMENT PRIMARY KEY.\n";
        }
    } catch (Throwable $e) {
        echo "  [!] Note on product IDs: " . $e->getMessage() . "\n";
    }

    $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");

    echo "\n[4/4] Seeding initial settings and default accounts...\n";

    // Seed default app settings
    $settings = [
        'store_name' => 'Vortex Oil Mart',
        'store_address' => '123, Mathura Road, New Delhi',
        'store_phone' => '+91 98765 43210',
        'gst_number' => '',
        'tax_rate' => '0',
        'invoice_prefix' => 'INV',
        'invoice_footer' => 'Thank you for choosing Vortex Oil Mart!',
        'invoice_logo_text' => 'VORTEX',
        'invoice_print_style' => 'Dot Matrix',
        'payment_methods' => '["Cash", "Card", "Bank Transfer", "Credit"]',
    ];

    $stmtSetting = $pdo->prepare("INSERT IGNORE INTO `app_settings` (`setting_key`, `setting_value`) VALUES (?, ?)");
    foreach ($settings as $k => $v) {
        $stmtSetting->execute([$k, $v]);
    }
    echo "  [✓] Default app settings verified.\n";

    // Seed default admin and cashier if no active users exist
    $userCount = (int)$pdo->query("SELECT COUNT(*) FROM `users` WHERE `employment_status` = 'active'")->fetchColumn();
    if ($userCount === 0) {
        echo "  [+] No existing users found. Creating default accounts...\n";
        $adminPass = password_hash('Admin@12345', PASSWORD_BCRYPT);
        $cashierPass = password_hash('Cashier@12345', PASSWORD_BCRYPT);

        $adminPerms = json_encode(['view_sales', 'manage_inventory', 'manage_products', 'manage_customers', 'view_reports', 'manage_users', 'manage_settings', 'pos_billing', 'view_inventory']);
        $cashierPerms = json_encode(['pos_billing', 'view_inventory']);

        $stmtUser = $pdo->prepare("INSERT INTO `users` (`username`, `password`, `role`, `permissions`, `full_name`, `employment_status`) VALUES (?, ?, ?, ?, ?, 'active')");
        $stmtUser->execute(['admin', $adminPass, 'admin', $adminPerms, 'System Administrator']);
        $stmtUser->execute(['cashier', $cashierPass, 'cashier', $cashierPerms, 'Store Cashier']);
        
        echo "  [✓] Created default admin account: username='admin', password='Admin@12345'\n";
        echo "  [✓] Created default cashier account: username='cashier', password='Cashier@12345'\n";
    } else {
        echo "  [✓] Found {$userCount} existing user account(s). Skipped seeding demo credentials.\n";
    }

    echo "\n===========================================\n";
    echo "  MIGRATION COMPLETED SUCCESSFULLY!\n";
    echo "===========================================\n";

} catch (Throwable $e) {
    echo "\n[ERROR] Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
