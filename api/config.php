<?php
$host_name = strtok($_SERVER['HTTP_HOST'], ':'); // Removes port if present
$is_production = ($host_name !== 'localhost' && $host_name !== '127.0.0.1');

if ($is_production) {
    // === cPanel Production Database Credentials ===
     $db = 'vortdbyg_oil_mart';
    $user = 'vortdbyg_gimhana';
    $pass = '_je-P_vSa}09V21J';
} else {
    // === Local XAMPP Database Credentials ===
    $host = getenv('MYSQL_HOST') ?: '127.0.0.1';
    $port = getenv('MYSQL_PORT') ?: '3306';
    $db   = getenv('MYSQL_DATABASE') ?: 'oil_mart';
    $user = getenv('MYSQL_USER') ?: 'root';
    $pass = getenv('MYSQL_PASSWORD') ?: '';
}

$charset = 'utf8mb4';

$dsn = "mysql:host=$host;port=$port;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    // If port is default, omit it to allow socket connections on cPanel
    $dsn_string = ($port == '3306' || empty($port)) 
        ? "mysql:host=$host;dbname=$db;charset=$charset" 
        : "mysql:host=$host;port=$port;dbname=$db;charset=$charset";
        
    $pdo = new PDO($dsn_string, $user, $pass, $options);
} catch (\PDOException $e) {
    header('Content-Type: application/json');
    http_response_code(500);
    // Include the actual error message to help debug hosting issues
    echo json_encode([
        "error" => "Database connection failed",
        "details" => $e->getMessage()
    ]);
    exit;
}

$jwt_secret = getenv('JWT_SECRET') ?: 'super_secret_oil_mart_key_123!';

// Helper function to send JSON response
function sendJson($data, $statusCode = 200) {
    header('Content-Type: application/json');
    http_response_code($statusCode);
    echo json_encode($data);
    exit;
}
?>
