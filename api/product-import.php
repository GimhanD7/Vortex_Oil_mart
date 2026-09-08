<?php

function assertProductIdentitySchema(PDO $pdo): void {
    try {
        // Fix zero or null IDs first if any exist
        $zeroCheck = $pdo->query("SELECT COUNT(*) FROM products WHERE id IS NULL OR id <= 0");
        if ($zeroCheck && (int)$zeroCheck->fetchColumn() > 0) {
            $pdo->exec("SET @max_id = IFNULL((SELECT MAX(id) FROM products WHERE id > 0), 0)");
            $pdo->exec("UPDATE products SET id = (@max_id := @max_id + 1) WHERE id IS NULL OR id <= 0");
        }

        $columns = $pdo->query('SHOW COLUMNS FROM products')->fetchAll(PDO::FETCH_ASSOC);
        $idColumn = array_values(array_filter($columns, fn($column) => $column['Field'] === 'id'));
        $isAutoInc = $idColumn && str_contains(strtolower($idColumn[0]['Extra'] ?? ''), 'auto_increment');

        $indexes = [];
        foreach ($pdo->query('SHOW INDEX FROM products')->fetchAll(PDO::FETCH_ASSOC) as $index) {
            if ((int)$index['Non_unique'] === 0 && ($index['Key_name'] === 'PRIMARY' || $index['Key_name'] === 'PRIMARY KEY')) {
                $indexes[] = $index['Column_name'];
            }
        }
        $hasPrimaryId = in_array('id', $indexes, true);

        if (!$idColumn) {
            $pdo->exec("ALTER TABLE products ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST");
        } elseif (!$isAutoInc || !$hasPrimaryId) {
            try {
                $pdo->exec("ALTER TABLE products MODIFY COLUMN id INT AUTO_INCREMENT PRIMARY KEY");
            } catch (Throwable $e1) {
                try {
                    $pdo->exec("ALTER TABLE products MODIFY COLUMN id INT AUTO_INCREMENT");
                } catch (Throwable $e2) {
                    // Best effort
                }
            }
        }
    } catch (Throwable $t) {
        error_log("assertProductIdentitySchema notice: " . $t->getMessage());
    }
}

function ensureProductImportTables(PDO $pdo): void {
    foreach (['categories', 'brands'] as $table) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS `$table` (
            id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL UNIQUE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS sub_categories (
        id INT AUTO_INCREMENT PRIMARY KEY, category_name VARCHAR(100) NOT NULL,
        name VARCHAR(100) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY cat_subcat_idx (category_name, name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS inventory_movements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        movement_type ENUM('in', 'out', 'adjustment', 'sale', 'purchase', 'return') NOT NULL,
        quantity_change DECIMAL(12,3) NOT NULL,
        stock_before DECIMAL(12,3) NOT NULL,
        stock_after DECIMAL(12,3) NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
        reference_no VARCHAR(100) NULL,
        notes VARCHAR(500) NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_inventory_product (product_id),
        INDEX idx_inventory_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // Ensure all products columns exist
    $productCols = [
        'description' => "TEXT NULL",
        'sub_category' => "VARCHAR(100) NOT NULL DEFAULT 'General'",
        'brand' => "VARCHAR(100) NOT NULL DEFAULT 'Generic'",
        'category' => "VARCHAR(100) NOT NULL DEFAULT 'Uncategorized'",
        'product_type' => "VARCHAR(30) NOT NULL DEFAULT 'packaged'",
        'unit' => "VARCHAR(20) NOT NULL DEFAULT 'Unit'",
        'barrel_capacity_liters' => "DECIMAL(10,3) NULL",
        'reorder_level' => "DECIMAL(12,3) NOT NULL DEFAULT 10",
        'location' => "VARCHAR(100) NOT NULL DEFAULT 'Main Store'",
        'batch_no' => "VARCHAR(100) NULL",
        'supplier' => "VARCHAR(150) NOT NULL DEFAULT 'Not Assigned'",
    ];

    $existingCols = $pdo->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'")->fetchAll(PDO::FETCH_COLUMN);
    foreach ($productCols as $col => $def) {
        if (!in_array($col, $existingCols, true)) {
            try { $pdo->exec("ALTER TABLE products ADD COLUMN `$col` $def"); } catch (Throwable $t) {}
        }
    }
}

function detectDelimiter($stream): string {
    $pos = ftell($stream);
    $sample = fgets($stream, 4096);
    if ($sample === false) {
        return ',';
    }
    fseek($stream, $pos);
    
    $commaCount = substr_count($sample, ',');
    $semicolonCount = substr_count($sample, ';');
    $tabCount = substr_count($sample, "\t");
    
    if ($semicolonCount > $commaCount && $semicolonCount > $tabCount) {
        return ';';
    }
    if ($tabCount > $commaCount && $tabCount > $semicolonCount) {
        return "\t";
    }
    return ',';
}

function normalizeHeaderName(string $header): string {
    $clean = strtolower(trim(preg_replace('/^\xEF\xBB\xBF/', '', $header)));
    // Remove parentheses like (lkr), ($), (pcs), (liters)
    $clean = preg_replace('/\s*\(.*?\)/', '', $clean);
    $clean = str_replace(['_', '-'], ' ', $clean);
    $clean = trim(preg_replace('/\s+/', ' ', $clean));

    $aliases = [
        'product name' => 'name',
        'item name' => 'name',
        'product' => 'name',
        'item' => 'name',
        'product title' => 'name',
        'title' => 'name',
        'name' => 'name',

        'selling price' => 'price',
        'unit price' => 'price',
        'retail price' => 'price',
        'mrp' => 'price',
        'rate' => 'price',
        'cost' => 'price',
        'sales price' => 'price',
        'price' => 'price',

        'stock' => 'stock quantity',
        'quantity' => 'stock quantity',
        'qty' => 'stock quantity',
        'current stock' => 'stock quantity',
        'available stock' => 'stock quantity',
        'quantity in stock' => 'stock quantity',
        'stock quantity' => 'stock quantity',

        'min stock' => 'reorder level',
        'minimum stock' => 'reorder level',
        'reorder' => 'reorder level',
        'reorder level' => 'reorder level',
        'alert level' => 'reorder level',

        'product code' => 'sku',
        'item code' => 'sku',
        'code' => 'sku',
        'sku' => 'sku',
        'barcode' => 'barcode',

        'category' => 'category',
        'category name' => 'category',
        'sub category' => 'sub category',
        'sub category name' => 'sub category',
        'subcategory' => 'sub category',
        'brand' => 'brand',
        'brand name' => 'brand',

        'description' => 'description',
        'details' => 'description',
        'desc' => 'description',

        'product type' => 'product type',
        'type' => 'product type',
        'unit' => 'unit',
        'uom' => 'unit',
        'unit of measure' => 'unit',
        'barrel capacity liters' => 'barrel capacity liters',
        'barrel capacity' => 'barrel capacity liters',
        'capacity' => 'barrel capacity liters',
        'location' => 'location',
        'batch no' => 'batch no',
        'supplier' => 'supplier',
    ];

    return $aliases[$clean] ?? $clean;
}

function cleanNumericValue(string $val): string {
    $clean = trim($val);
    $clean = preg_replace('/[^\d.-]/', '', $clean);
    return $clean;
}

function readProductCsv($stream): array {
    $delimiter = detectDelimiter($stream);
    $header = fgetcsv($stream, 0, $delimiter, '"', '');
    if (!$header) throw new InvalidArgumentException('The CSV file is empty.');

    $headers = array_map('normalizeHeaderName', $header);

    // Only 'name' is strictly required; price and stock quantity default to 0 if omitted from header
    if (!in_array('name', $headers, true)) {
        throw new InvalidArgumentException("Missing 'Name' column in CSV header. The CSV must have at least a 'Name' (or 'Product Name') column.");
    }

    $rows = [];
    $line = 1;
    while (($values = fgetcsv($stream, 0, $delimiter, '"', '')) !== false) {
        $line++;
        if (count($values) === 1 && trim($values[0] ?? '') === '') continue; // Skip blank line

        if (count($values) < count($headers)) {
            $values = array_pad($values, count($headers), '');
        } elseif (count($values) > count($headers)) {
            $values = array_slice($values, 0, count($headers));
        }

        $row = array_combine($headers, array_map('trim', $values));
        if (empty($row['name'])) continue; // Skip rows without name

        // Clean numeric fields
        $priceRaw = cleanNumericValue($row['price'] ?? '');
        $stockRaw = cleanNumericValue($row['stock quantity'] ?? '');
        $reorderRaw = cleanNumericValue($row['reorder level'] ?? '');
        $barrelRaw = cleanNumericValue($row['barrel capacity liters'] ?? '');

        $row['price'] = $priceRaw !== '' ? (float)$priceRaw : 0.0;
        $row['stock quantity'] = $stockRaw !== '' ? (float)$stockRaw : 0.0;
        $row['reorder level'] = $reorderRaw !== '' ? (float)$reorderRaw : 10.0;
        $row['barrel capacity liters'] = $barrelRaw !== '' && (float)$barrelRaw > 0 ? (float)$barrelRaw : null;

        $type = strtolower(str_replace('_', ' ', $row['product type'] ?? ''));
        $row['product type'] = ($type === 'loose oil' || $type === 'loose_oil') ? 'loose_oil' : 'packaged';

        $rows[] = $row;
    }

    if (empty($rows)) {
        throw new InvalidArgumentException('The CSV file contains no valid product rows.');
    }

    return $rows;
}

function importProductRows(PDO $pdo, array $rows, ?int $actorId = null): array {
    assertProductIdentitySchema($pdo);
    ensureProductImportTables($pdo);

    // Verify actor exists to avoid foreign key errors on inventory_movements
    $validActor = null;
    if ($actorId) {
        try {
            $checkUser = $pdo->prepare('SELECT id FROM users WHERE id = ?');
            $checkUser->execute([$actorId]);
            if ($checkUser->fetchColumn()) {
                $validActor = $actorId;
            }
        } catch (Throwable $t) {}
    }

    $findSku = $pdo->prepare('SELECT id, price, stock_quantity FROM products WHERE sku = ? FOR UPDATE');
    $findName = $pdo->prepare('SELECT id, price, stock_quantity FROM products WHERE name = ? FOR UPDATE');
    $insert = $pdo->prepare('INSERT INTO products
        (name, sku, category, sub_category, brand, description, product_type, unit, barrel_capacity_liters, price, stock_quantity, reorder_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $update = $pdo->prepare('UPDATE products SET name = ?, sku = ?, category = ?, sub_category = ?, brand = ?, description = ?,
        product_type = ?, unit = ?, barrel_capacity_liters = ?, price = ?, stock_quantity = ?, reorder_level = ? WHERE id = ?');
    $category = $pdo->prepare('INSERT IGNORE INTO categories (name) VALUES (?)');
    $subcategory = $pdo->prepare('INSERT IGNORE INTO sub_categories (category_name, name) VALUES (?, ?)');
    $brand = $pdo->prepare('INSERT IGNORE INTO brands (name) VALUES (?)');
    $findCategory = $pdo->prepare('SELECT id FROM categories WHERE name = ? LIMIT 1');
    $findSubcategory = $pdo->prepare('SELECT id FROM sub_categories WHERE category_name = ? AND name = ? LIMIT 1');
    $findBrand = $pdo->prepare('SELECT id FROM brands WHERE name = ? LIMIT 1');
    $movement = $pdo->prepare("INSERT INTO inventory_movements
        (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by)
        VALUES (?, 'adjustment', ?, ?, ?, ?, 'CSV-IMPORT', 'Product CSV import', ?)");

    $result = ['created' => 0, 'updated' => 0, 'blank_stock' => 0, 'blank_prices' => 0];
    foreach ($rows as $row) {
        $sku = trim($row['sku'] ?? '');
        $find = $sku !== '' ? $findSku : $findName;
        $find->execute([$sku !== '' ? $sku : $row['name']]);
        $matches = $find->fetchAll(PDO::FETCH_ASSOC);
        $existing = $matches[0] ?? null;

        $type = $row['product type'];
        $cat = !empty($row['category']) ? $row['category'] : 'Uncategorized';
        $sub = !empty($row['sub category']) ? $row['sub category'] : 'General';
        $brandName = !empty($row['brand']) ? $row['brand'] : 'Generic';
        $stock = (float)($row['stock quantity'] ?? 0);
        $price = (float)($row['price'] ?? 0);

        $payload = [
            $row['name'],
            $sku !== '' ? $sku : 'NOM-' . strtoupper(substr(hash('sha256', $row['name']), 0, 12)),
            $cat,
            $sub,
            $brandName,
            $row['description'] ?? '',
            $type,
            $type === 'loose_oil' ? 'L' : (!empty($row['unit']) ? $row['unit'] : 'Unit'),
            $type === 'loose_oil' && !empty($row['barrel capacity liters']) ? (float)$row['barrel capacity liters'] : null,
            $price,
            $stock,
            !empty($row['reorder level']) ? (float)$row['reorder level'] : ($type === 'loose_oil' ? 20 : 10),
        ];

        if ($existing) {
            $productId = (int)$existing['id'];
            $update->execute([...$payload, $productId]);
            $result['updated']++;
        } else {
            $insert->execute($payload);
            $productId = (int)$pdo->lastInsertId();
            $result['created']++;
        }

        // Ensure category / subcategory / brand exist
        try {
            $findCategory->execute([$cat]);
            if ($findCategory->fetchColumn() === false) $category->execute([$cat]);
            $findSubcategory->execute([$cat, $sub]);
            if ($findSubcategory->fetchColumn() === false) $subcategory->execute([$cat, $sub]);
            $findBrand->execute([$brandName]);
            if ($findBrand->fetchColumn() === false) $brand->execute([$brandName]);
        } catch (Throwable $t) {}

        $before = (float)($existing['stock_quantity'] ?? 0);
        if (abs($stock - $before) >= 0.0005) {
            try {
                $movement->execute([$productId, $stock - $before, $before, $stock, $price, $validActor]);
            } catch (Throwable $t) {
                error_log("Inventory movement log error during import: " . $t->getMessage());
            }
        }
    }
    return $result;
}
