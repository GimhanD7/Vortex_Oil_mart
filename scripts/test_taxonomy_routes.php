<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/environment.php';

class TaxonomyResponse extends RuntimeException {
    public function __construct(public array $data, public int $status) { parent::__construct('Route completed'); }
}
function requireAuth(): array { return ['id' => 1, 'role' => 'admin']; }
function sendJson($data, $status = 200): void { throw new TaxonomyResponse($data, $status); }

$table = $argv[1] ?? '';
$method = $argv[2] ?? 'GET';
if (!in_array($table, ['categories', 'brands', 'sub_categories'], true) || !in_array($method, ['GET', 'POST'], true)) throw new RuntimeException('Usage: php scripts/test_taxonomy_routes.php categories|brands|sub_categories GET|POST');
$pdo = connectDatabase();
// All writes target temporary tables, never the actual store records.
$pdo->exec("CREATE TEMPORARY TABLE `$table` (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, category_name VARCHAR(100), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
$pdo->exec("INSERT INTO `$table` (name, category_name) VALUES ('Oil Filter', 'Filters'), ('Oil Filter', 'Filters'), ('Air Filter', 'Filters')");
if ($table === 'sub_categories') $pdo->exec("INSERT INTO sub_categories (name, category_name) VALUES ('Oil Filter', 'Other')");
$pdo->exec("CREATE TEMPORARY TABLE products (category VARCHAR(100), sub_category VARCHAR(100), brand VARCHAR(100))");
$pdo->exec("INSERT INTO products VALUES ('Filters', 'Oil Filter', 'Test'), ('Filters', 'Air Filter', 'Test'), ('Other', 'New', 'New')");
$inputData = ['name' => 'Oil Filter', 'category_name' => 'Filters'];
if (($argv[3] ?? '') === 'filtered') $_GET['category'] = 'Filters';
try {
    require __DIR__ . "/../api/routes/$table.php";
    throw new RuntimeException('Missing response');
} catch (TaxonomyResponse $response) {
    if ($response->status !== 200) throw new RuntimeException('Unexpected status');
    if ((int)$pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn() !== ($table === 'sub_categories' ? 4 : 3)) throw new RuntimeException('Request inserted duplicate or derived rows');
    $expected = $table === 'sub_categories' && empty($_GET['category']) ? 3 : 2;
    if ($method === 'GET' && count($response->data) !== $expected) throw new RuntimeException('GET returned duplicate names or lost a distinct category');
    if ($method === 'POST' && (int)$response->data['id'] !== 1) throw new RuntimeException('Existing ID not returned');
    echo "PASS: $table $method returns unique names/existing ID without inserting rows on a legacy schema.\n";
}
