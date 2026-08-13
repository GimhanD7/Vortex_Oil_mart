<?php
require_once 'auth_middleware.php';

$request = isset($_GET['request']) ? $_GET['request'] : '';
$method = $_SERVER['REQUEST_METHOD'];

// Parse request path, e.g., "products/1" -> ['products', '1']
$parts = explode('/', trim($request, '/'));
$resource = isset($parts[0]) && $parts[0] !== '' ? $parts[0] : null;
$id = isset($parts[1]) && $parts[1] !== '' ? $parts[1] : null;
$action = isset($parts[2]) && $parts[2] !== '' ? $parts[2] : null;

// Get JSON body if any
$inputData = json_decode(file_get_contents('php://input'), true);

// Routing
switch ($resource) {
    case 'auth':
        require_once 'routes/auth.php';
        break;
    case 'products':
        require_once 'routes/products.php';
        break;
    case 'categories':
        require_once 'routes/categories.php';
        break;
    case 'brands':
        require_once 'routes/brands.php';
        break;
    case 'customers':
        require_once 'routes/customers.php';
        break;
    case 'inventory':
        require_once 'routes/inventory.php';
        break;
    case 'sales':
        require_once 'routes/sales.php';
        break;
    case 'purchases':
        require_once 'routes/purchases.php';
        break;
    case 'reports':
        require_once 'routes/reports.php';
        break;
    case 'dashboard':
        require_once 'routes/dashboard.php';
        break;
    case 'users':
        require_once 'routes/users.php';
        break;
    case 'settings':
        require_once 'routes/settings.php';
        break;
    default:
        sendJson(["error" => "Endpoint not found"], 404);
}
?>
