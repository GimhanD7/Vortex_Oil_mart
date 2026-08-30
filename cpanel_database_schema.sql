-- Vortex Oil Mart Database Schema for cPanel / MySQL
-- Character Set: utf8mb4

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS `users` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default admin (password: admin123) and default cashier (password: cashier123)
INSERT INTO `users` (`id`, `username`, `password`, `role`, `permissions`) VALUES
(1, 'admin', '$2a$10$tZ2yYq/9v0RZZQ1qB2uK8eeCj4sJ.e0W5Gz9mS7eU1f.C7yN9o4.C', 'admin', '["view_sales", "manage_inventory", "manage_products", "manage_customers", "view_reports", "manage_users", "pos_billing", "view_inventory"]')
ON DUPLICATE KEY UPDATE `username`=`username`;

INSERT INTO `users` (`id`, `username`, `password`, `role`, `permissions`) VALUES
(2, 'cashier', '$2a$10$95S1O5/Yg8yM6Cj8T2Bge.s1c2h4i5e6r7.k8e9y0.z1x2c3v4b5n', 'cashier', '["pos_billing", "view_inventory"]')
ON DUPLICATE KEY UPDATE `username`=`username`;

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `categories` (`name`) VALUES
('Engine Oils'), ('Gear Oils'), ('Lubricants'), ('Filters'), ('Brake Pads'), ('Batteries'), ('Spark Plugs'), ('General');

-- 3. Brands Table
CREATE TABLE IF NOT EXISTS `brands` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `brands` (`name`) VALUES
('Shell India'), ('ExxonMobil'), ('Castrol India'), ('Bosch Ltd.'), ('Amaron'), ('Brembo India'), ('NGK India'), ('Mann+Hummel'), ('Generic');

-- 4. Sub-Categories Table
CREATE TABLE IF NOT EXISTS `sub_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `category_name` VARCHAR(100) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `unique_sub_cat` (`name`, `category_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Products Table
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `description` TEXT,
  `price` DECIMAL(10, 2) NOT NULL,
  `stock_quantity` DECIMAL(12,3) NOT NULL DEFAULT 0,
  `sku` VARCHAR(100) UNIQUE,
  `barcode` VARCHAR(100) UNIQUE,
  `category` VARCHAR(100) NOT NULL DEFAULT 'Uncategorized',
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Customers Table
CREATE TABLE IF NOT EXISTS `customers` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. Sales Table
CREATE TABLE IF NOT EXISTS `sales` (
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
  FOREIGN KEY (`cashier_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Sale Items Table
CREATE TABLE IF NOT EXISTS `sale_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `sale_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `purchase_unit` VARCHAR(20) NOT NULL DEFAULT 'Unit',
  `barrel_count` DECIMAL(10,3) NULL,
  `barrel_capacity_liters` DECIMAL(10,3) NULL,
  `price_at_time` DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Sales Cycles Table
CREATE TABLE IF NOT EXISTS `sales_cycles` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Sale Returns Table
CREATE TABLE IF NOT EXISTS `sale_returns` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Sale Return Items Table
CREATE TABLE IF NOT EXISTS `sale_return_items` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Transaction Revocations (Audit) Table
CREATE TABLE IF NOT EXISTS `transaction_revocations` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. Purchases Table
CREATE TABLE IF NOT EXISTS `purchases` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `supplier` VARCHAR(150) NOT NULL,
  `payment_method` VARCHAR(40) NOT NULL DEFAULT 'Cash',
  `total_amount` DECIMAL(10, 2) NOT NULL DEFAULT 0,
  `status` VARCHAR(30) NOT NULL DEFAULT 'received',
  `notes` VARCHAR(500),
  `created_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. Purchase Items Table
CREATE TABLE IF NOT EXISTS `purchase_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `purchase_id` INT NOT NULL,
  `product_id` INT NOT NULL,
  `quantity` DECIMAL(12,3) NOT NULL,
  `purchase_unit` VARCHAR(20) NOT NULL DEFAULT 'Unit',
  `barrel_count` DECIMAL(10,3) NULL,
  `barrel_capacity_liters` DECIMAL(10,3) NULL,
  `unit_cost` DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. Inventory Movements Table
CREATE TABLE IF NOT EXISTS `inventory_movements` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. Customer Credit Payments Table
CREATE TABLE IF NOT EXISTS `customer_credit_payments` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 17. Customer Credit Allocations Table
CREATE TABLE IF NOT EXISTS `customer_credit_allocations` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `payment_id` INT NOT NULL,
  `sale_id` INT NOT NULL,
  `allocated_amount` DECIMAL(12,2) NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_credit_allocation_payment (`payment_id`),
  INDEX idx_credit_allocation_sale (`sale_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 18. Customer Credit Ledger Table
CREATE TABLE IF NOT EXISTS `customer_credit_ledger` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 19. App Settings Table
CREATE TABLE IF NOT EXISTS `app_settings` (
  `setting_key` VARCHAR(100) PRIMARY KEY,
  `setting_value` TEXT NOT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `app_settings` (`setting_key`, `setting_value`) VALUES
('store_name', 'Vortex Oil Mart'),
('store_address', '123, Mathura Road, New Delhi'),
('store_phone', '+91 98765 43210'),
('gst_number', ''),
('tax_rate', '0'),
('invoice_prefix', 'INV'),
('invoice_footer', 'Thank you for choosing Vortex Oil Mart!'),
('invoice_logo_text', 'VORTEX'),
('invoice_print_style', 'Dot Matrix'),
('payment_methods', '["Cash", "Card", "Bank Transfer", "Credit"]');

SET FOREIGN_KEY_CHECKS = 1;
