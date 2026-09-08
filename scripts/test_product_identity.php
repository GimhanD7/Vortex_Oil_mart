<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/environment.php';

class ProductResponse extends RuntimeException {
    public function __construct(public array $data, public int $status) { parent::__construct('Route completed'); }
}
function requireAuth(): array { return ['id' => 1, 'role' => 'admin']; }
function sendJson($data, $status = 200): void { throw new ProductResponse($data, $status); }

$scenario = $argv[1] ?? '';
$cases = [
    'zero-delete' => ['DELETE', '0', 409, false],
    'zero-update' => ['PUT', '0', 409, false],
    'zero-post' => ['POST', '0', 404, false],
    'bad-schema-create' => ['POST', null, 409, false],
    'bad-schema-import' => ['POST', 'import', 409, false],
    'bad-schema-update' => ['PUT', '1', 409, false],
    'bad-schema-delete' => ['DELETE', '1', 409, false],
    'valid-create' => ['POST', null, 201, true],
    'valid-update' => ['PUT', '1', 200, true],
    'valid-delete' => ['DELETE', '1', 200, true],
    'missing-update' => ['PUT', '999', 404, true],
    'missing-delete' => ['DELETE', '999', 404, true],
];
if (!isset($cases[$scenario])) throw new RuntimeException('Specify a product identity test scenario.');
[$method, $id, $expected, $healthy] = $cases[$scenario];
$pdo = connectDatabase();
if ($healthy) {
    $pdo->exec('CREATE TEMPORARY TABLE test_products LIKE products');
    $pdo->exec('ALTER TABLE test_products RENAME TO products');
    $pdo->exec('CREATE TEMPORARY TABLE test_inventory LIKE inventory_movements');
    $pdo->exec('ALTER TABLE test_inventory RENAME TO inventory_movements');
    $pdo->exec("INSERT INTO products (name, price, stock_quantity) VALUES ('Original product', 1, 0)");
} else {
    // Deliberately broken hosting schema, isolated from the real database.
    $pdo->exec('CREATE TEMPORARY TABLE products (id INT DEFAULT 0, name VARCHAR(100))');
    $pdo->exec("INSERT INTO products VALUES (0, 'Broken A'), (0, 'Broken B'), (1, 'Other')");
}
$before = $pdo->query('SELECT * FROM products ORDER BY name')->fetchAll(PDO::FETCH_ASSOC);
$inputData = ['name' => 'Updated product', 'price' => 5, 'stock_quantity' => 0, 'sku' => 'IDENTITY-TEST'];
try {
    require __DIR__ . '/../api/routes/products.php';
    throw new RuntimeException('Missing response');
} catch (ProductResponse $response) {
    if ($response->status !== $expected) throw new RuntimeException("$scenario: expected $expected, got {$response->status}");
    $after = $pdo->query('SELECT * FROM products ORDER BY name')->fetchAll(PDO::FETCH_ASSOC);
    if ($expected >= 400 && $before !== $after) throw new RuntimeException('Rejected request changed records');
    if ($scenario === 'valid-update' && (count($after) !== 1 || $after[0]['name'] !== 'Updated product')) throw new RuntimeException('Update created a duplicate or failed');
    if ($scenario === 'valid-delete' && count($after) !== 0) throw new RuntimeException('Delete failed');
    if ($scenario === 'valid-create' && (count($after) !== 2 || (int)$response->data['id'] <= 1)) throw new RuntimeException('Create did not generate a new ID');
    echo "PASS: $scenario\n";
}
