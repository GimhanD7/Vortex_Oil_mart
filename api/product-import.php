<?php

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
}

function readProductCsv($stream): array {
    $header = fgetcsv($stream, 0, ',', '"', '');
    if (!$header) throw new InvalidArgumentException('The CSV is empty.');
    $headers = array_map(function ($value) {
        $value = preg_replace('/^\xEF\xBB\xBF/', '', $value);
        return strtolower(trim(str_replace(['_', '-'], ' ', $value)));
    }, $header);
    foreach (['name', 'price', 'stock quantity'] as $required) {
        if (!in_array($required, $headers, true)) throw new InvalidArgumentException("Missing column: $required.");
    }
    if (count(array_unique($headers)) !== count($headers)) throw new InvalidArgumentException('Duplicate CSV columns.');
    $rows = [];
    $seen = [];
    $line = 1;
    while (($values = fgetcsv($stream, 0, ',', '"', '')) !== false) {
        $line++;
        if (count($values) === 1 && trim($values[0] ?? '') === '') continue;
        if (count($values) !== count($headers)) throw new InvalidArgumentException("Row $line: column count does not match the header.");
        $row = array_combine($headers, array_map('trim', $values));
        if ($row['name'] === '') throw new InvalidArgumentException("Row $line: product name is required.");
        foreach (['name' => 255, 'sku' => 100, 'category' => 100, 'sub category' => 100, 'brand' => 100, 'unit' => 20] as $field => $limit) {
            if (mb_strlen($row[$field] ?? '', 'UTF-8') > $limit) throw new InvalidArgumentException("Row $line: $field is too long.");
        }
        foreach (['price', 'stock quantity', 'reorder level', 'barrel capacity liters'] as $field) {
            $value = $row[$field] ?? '';
            if ($value !== '' && (!is_numeric($value) || !is_finite((float)$value) || (float)$value < 0)) {
                throw new InvalidArgumentException("Row $line: $field must be a non-negative number.");
            }
        }
        if (($row['barrel capacity liters'] ?? '') !== '' && (float)$row['barrel capacity liters'] <= 0) {
            throw new InvalidArgumentException("Row $line: barrel capacity must be greater than zero.");
        }
        $type = strtolower(str_replace('_', ' ', $row['product type'] ?? ''));
        if (!in_array($type, ['', 'packaged', 'packaged item', 'loose oil'], true)) {
            throw new InvalidArgumentException("Row $line: unknown product type.");
        }
        $key = mb_strtolower(($row['sku'] ?? '') !== '' ? 'sku:' . $row['sku'] : 'name:' . $row['name'], 'UTF-8');
        if (isset($seen[$key])) throw new InvalidArgumentException("Row $line: duplicate product in the CSV.");
        $seen[$key] = true;
        $row['product type'] = $type === 'loose oil' ? 'loose_oil' : 'packaged';
        $rows[] = $row;
    }
    if (!$rows) throw new InvalidArgumentException('The CSV contains no products.');
    return $rows;
}

// The caller owns the transaction so a failed import or local reset rolls back together.
function importProductRows(PDO $pdo, array $rows, ?int $actorId = null): array {
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
    $movement = $pdo->prepare("INSERT INTO inventory_movements
        (product_id, movement_type, quantity_change, stock_before, stock_after, unit_price, reference_no, notes, created_by)
        VALUES (?, 'adjustment', ?, ?, ?, ?, 'CSV-IMPORT', 'Product CSV import', ?)");
    $result = ['created' => 0, 'updated' => 0, 'blank_stock' => 0, 'blank_prices' => 0];
    foreach ($rows as $row) {
        $sku = $row['sku'] ?? '';
        $find = $sku !== '' ? $findSku : $findName;
        $find->execute([$sku !== '' ? $sku : $row['name']]);
        $matches = $find->fetchAll(PDO::FETCH_ASSOC);
        if (count($matches) > 1) throw new InvalidArgumentException('Multiple products match ' . $row['name'] . '. Specify a unique SKU.');
        $existing = $matches[0] ?? null;
        $type = $row['product type'];
        $cat = ($row['category'] ?? '') !== '' ? $row['category'] : 'Uncategorized';
        $sub = ($row['sub category'] ?? '') !== '' ? $row['sub category'] : 'General';
        $brandName = ($row['brand'] ?? '') !== '' ? $row['brand'] : 'Generic';
        $stock = $row['stock quantity'] !== '' ? (float)$row['stock quantity'] : (float)($existing['stock_quantity'] ?? 0);
        $price = $row['price'] !== '' ? (float)$row['price'] : (float)($existing['price'] ?? 0);
        $result['blank_stock'] += (int)($row['stock quantity'] === '');
        $result['blank_prices'] += (int)($row['price'] === '');
        $payload = [
            $row['name'], $sku !== '' ? $sku : 'NOM-' . strtoupper(substr(hash('sha256', $row['name']), 0, 12)),
            $cat, $sub, $brandName, $row['description'] ?? '', $type,
            $type === 'loose_oil' ? 'L' : (($row['unit'] ?? '') !== '' ? $row['unit'] : 'Unit'),
            $type === 'loose_oil' && ($row['barrel capacity liters'] ?? '') !== '' ? (float)$row['barrel capacity liters'] : null,
            $price, $stock, ($row['reorder level'] ?? '') !== '' ? (float)$row['reorder level'] : ($type === 'loose_oil' ? 20 : 10),
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
        $category->execute([$cat]);
        $subcategory->execute([$cat, $sub]);
        $brand->execute([$brandName]);
        $before = (float)($existing['stock_quantity'] ?? 0);
        if (abs($stock - $before) >= 0.0005) $movement->execute([$productId, $stock - $before, $before, $stock, $price, $actorId]);
    }
    return $result;
}
