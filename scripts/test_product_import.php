<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/product-import.php';
require_once __DIR__ . '/../api/environment.php';

function check($condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
function csvRows(string $text): array {
    $stream = fopen('php://temp', 'r+');
    fwrite($stream, $text); rewind($stream);
    try { return readProductCsv($stream); } finally { fclose($stream); }
}

$header = "Name,SKU,Category,Sub-Category,Brand,Description,Product Type,Unit,Barrel Capacity Liters,Price,Stock Quantity,Reorder Level\n";
$rows = csvRows("\xEF\xBB\xBF" . $header . '"Oil, special",TEST-CSV,Filters,Oil Filter,Test,"First line' . "\n" . 'Second ""quoted"" line",Packaged Item,pcs,,125.50,3,0');
check($rows[0]['sub category'] === 'Oil Filter', 'Subcategory lost.');
check(str_contains($rows[0]['description'], '"quoted"'), 'Quoted multiline field corrupted.');
check($rows[0]['reorder level'] === '0', 'Zero reorder level lost.');
foreach ([$header . "Broken", $header . 'Bad,TEST,Filters,Oil,Test,,packaged,pcs,,-1,0,10', $header] as $invalid) {
    $rejected = false;
    try { csvRows($invalid); } catch (InvalidArgumentException $e) { $rejected = true; }
    check($rejected, 'Invalid CSV accepted.');
}
$duplicate = $header . "A,DUP,Filters,Oil,Test,,packaged,pcs,,1,0,10\nB,DUP,Filters,Oil,Test,,packaged,pcs,,1,0,10";
try { csvRows($duplicate); throw new RuntimeException('Duplicate CSV SKU accepted.'); } catch (InvalidArgumentException $e) {}

// Temporary tables shadow the real ones for this connection, leaving store data untouched.
$pdo = connectDatabase();
foreach (['products', 'categories', 'sub_categories', 'brands', 'inventory_movements'] as $table) {
    $pdo->exec("CREATE TEMPORARY TABLE `test_$table` LIKE `$table`");
    $pdo->exec("ALTER TABLE `test_$table` RENAME TO `$table`");
}
$pdo->beginTransaction();
$result = importProductRows($pdo, $rows);
check($result['created'] === 1, 'Product not inserted.');
check((int)$pdo->query('SELECT COUNT(*) FROM sub_categories')->fetchColumn() === 1, 'Subcategory not registered.');
check((int)$pdo->query('SELECT COUNT(*) FROM inventory_movements')->fetchColumn() === 1, 'Initial stock not recorded.');
$rows[0]['stock quantity'] = '';
$rows[0]['price'] = '';
$result = importProductRows($pdo, $rows);
check($result['updated'] === 1, 'SKU import should update existing product.');
check((float)$pdo->query('SELECT stock_quantity FROM products')->fetchColumn() === 3.0, 'Blank stock erased existing stock.');
check((float)$pdo->query('SELECT price FROM products')->fetchColumn() === 125.5, 'Blank price erased existing price.');
check((int)$pdo->query('SELECT COUNT(*) FROM inventory_movements')->fetchColumn() === 1, 'Repeated import duplicated stock history.');
$pdo->rollBack();
check((int)$pdo->query('SELECT COUNT(*) FROM products')->fetchColumn() === 0, 'Import rollback failed.');

// Reproduce a legacy hosting schema with no unique taxonomy indexes.
foreach (['categories', 'sub_categories', 'brands'] as $table) {
    $indexes = $pdo->query("SHOW INDEX FROM `$table`")->fetchAll(PDO::FETCH_ASSOC);
    foreach (array_unique(array_column(array_filter($indexes, fn($index) => (int)$index['Non_unique'] === 0 && $index['Key_name'] !== 'PRIMARY'), 'Key_name')) as $index) {
        $pdo->exec("ALTER TABLE `$table` DROP INDEX `" . str_replace('`', '``', $index) . "`");
    }
}
$pdo->beginTransaction();
importProductRows($pdo, $rows);
importProductRows($pdo, $rows);
foreach (['categories', 'sub_categories', 'brands'] as $table) check((int)$pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn() === 1, "Legacy $table duplicated on repeated import.");
$pdo->rollBack();
echo "PASS: CSV quoting, subcategories, validation, duplicate detection, upsert, blank values, stock history, rollback.\n";
