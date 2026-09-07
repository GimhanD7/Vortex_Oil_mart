<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/product-import.php';
require_once __DIR__ . '/../api/environment.php';

// Deliberately restricted to the local XAMPP database; never uses production credentials.
$root = dirname(__DIR__);
$csv = $argv[1] ?? '';
$apply = ($argv[2] ?? '') === '--apply=oil_mart';
try {
    if (!is_file($csv)) throw new RuntimeException('Usage: php scripts/reset_local_catalog.php <products.csv> [--apply=oil_mart]');
    $stream = fopen($csv, 'rb');
    $rows = readProductCsv($stream);
    fclose($stream);
    $config = databaseConfig();
    if (appEnv('APP_ENV') !== 'local' || !in_array($config['host'], ['localhost', '127.0.0.1'], true) || $config['database'] !== 'oil_mart' || $config['port'] !== '3306') throw new RuntimeException('Reset is restricted to local oil_mart on port 3306.');
    $pdo = connectDatabase();
    $tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    $clear = ['auth_sessions', 'auth_login_attempts', 'customer_credit_allocations', 'customer_credit_ledger', 'customer_credit_payments',
        'transaction_revocations', 'sale_return_items', 'sale_returns', 'sale_items', 'purchase_items',
        'inventory_movements', 'sales', 'sales_cycles', 'purchases', 'customers', 'products', 'sub_categories', 'categories', 'brands'];
    $unknown = array_diff($tables, [...$clear, 'users', 'app_settings']);
    if ($unknown) throw new RuntimeException('Unrecognized tables; review before resetting: ' . implode(', ', $unknown));
    foreach ($pdo->query('SHOW TABLE STATUS')->fetchAll(PDO::FETCH_ASSOC) as $table) {
        if (in_array($table['Name'], $clear, true) && $table['Engine'] !== 'InnoDB') throw new RuntimeException('Reset requires transactional InnoDB tables.');
    }
    $counts = [];
    foreach (array_intersect($clear, $tables) as $table) $counts[$table] = (int)$pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
    echo json_encode(['database' => '127.0.0.1:3306/oil_mart', 'import_rows' => count($rows), 'clear' => $counts, 'preserve' => ['users', 'app_settings']], JSON_PRETTY_PRINT) . PHP_EOL;
    if (!$apply) { echo "Dry run only. No data changed.\n"; exit; }

    $backupDir = $root . '/.local-backups';
    if (!is_dir($backupDir)) mkdir($backupDir, 0700, true);
    $backup = $backupDir . '/oil_mart_before_catalog_reset_' . date('Ymd_His') . '.sql';
    $dump = 'C:/xampp/mysql/bin/mysqldump.exe';
    $process = proc_open([$dump, '--host=127.0.0.1', '--port=3306', '--user=' . $config['user'], '--single-transaction', '--routines', '--triggers', '--hex-blob', '--result-file=' . $backup, 'oil_mart'], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, null, array_merge(getenv(), ['MYSQL_PWD' => $config['password']]));
    if (!is_resource($process)) throw new RuntimeException('Could not start database backup.');
    fclose($pipes[0]);
    stream_get_contents($pipes[1]); fclose($pipes[1]);
    $error = stream_get_contents($pipes[2]); fclose($pipes[2]);
    if (proc_close($process) !== 0 || !is_file($backup) || filesize($backup) < 100) throw new RuntimeException('Backup failed; nothing reset. ' . $error);
    echo "Backup: $backup\n";

    ensureProductImportTables($pdo);
    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    $pdo->beginTransaction();
    try {
        foreach (array_intersect($clear, $tables) as $table) $pdo->exec("DELETE FROM `$table`");
        $result = importProductRows($pdo, $rows);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    } finally {
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    }
    echo json_encode(['import' => $result, 'backup' => $backup], JSON_PRETTY_PRINT) . PHP_EOL;
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . PHP_EOL);
    exit(1);
}
