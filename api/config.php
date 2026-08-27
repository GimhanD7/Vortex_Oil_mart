<?php
// Send CORS headers immediately so errors are readable by the frontend
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Helper function to send JSON response
function sendJson($data, $statusCode = 200) {
    header('Content-Type: application/json');
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}

$host_name = isset($_SERVER['HTTP_HOST']) ? strtok($_SERVER['HTTP_HOST'], ':') : 'localhost';
$is_production = ($host_name !== 'localhost' && $host_name !== '127.0.0.1');

if ($is_production) {
    // === cPanel Production Database Credentials ===
    $host = 'localhost'; 
    $port = '3306';
    $db = 'vortdbyg_oil_mart';
    $user = 'vortdbyg_gimhana';
    $pass = 'b7gw8JuFh*71b0.w';
} else {
    // === Local XAMPP Database Credentials ===
    $host = getenv('MYSQL_HOST') ?: '127.0.0.1';
    $port = getenv('MYSQL_PORT') ?: '3306';
    $db   = getenv('MYSQL_DATABASE') ?: 'oil_mart';
    $user = getenv('MYSQL_USER') ?: 'root';
    $pass = getenv('MYSQL_PASSWORD') ?: '';
}

$charset = 'utf8mb4';
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $dsn_string = ($port == '3306' || empty($port)) 
        ? "mysql:host=$host;dbname=$db;charset=$charset" 
        : "mysql:host=$host;port=$port;dbname=$db;charset=$charset";
        
    $pdo = new PDO($dsn_string, $user, $pass, $options);
} catch (\PDOException $e) {
    // If 'localhost' socket fails on some cPanel configs, attempt 127.0.0.1 TCP
    if ($host === 'localhost') {
        try {
            $pdo = new PDO("mysql:host=127.0.0.1;port=3306;dbname=$db;charset=$charset", $user, $pass, $options);
        } catch (\PDOException $e2) {
            sendJson([
                "error" => "Database connection failed",
                "details" => $e->getMessage() . " (TCP retry: " . $e2->getMessage() . ")"
            ], 500);
        }
    } else {
        sendJson([
            "error" => "Database connection failed",
            "details" => $e->getMessage()
        ], 500);
    }
}

$jwt_secret = getenv('JWT_SECRET') ?: 'super_secret_oil_mart_key_123!';
?>
