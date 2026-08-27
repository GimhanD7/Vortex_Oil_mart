<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

require_once 'config.php';

try {
    $tables = [];
    $stmt = $pdo->query("SHOW TABLES");
    while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
        $tables[] = $row[0];
    }
    
    echo json_encode([
        "status" => "SUCCESS",
        "message" => "Database connected successfully!",
        "database" => $db,
        "user" => $user,
        "tables_count" => count($tables),
        "tables" => $tables
    ], JSON_PRETTY_PRINT);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "ERROR",
        "error" => $e->getMessage()
    ], JSON_PRETTY_PRINT);
}
