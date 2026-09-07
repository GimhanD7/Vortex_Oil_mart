<?php
ini_set('display_errors', '0');
ini_set('log_errors', '1');
require_once __DIR__ . '/environment.php';

function sendJson($data, $statusCode = 200) {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, private');
    header('X-Content-Type-Options: nosniff');
    if (is_array($data) && isset($data['details'])) unset($data['details']);
    if (is_array($data) && isset($data['error']) && str_contains((string)$data['error'], 'SQLSTATE[')) {
        error_log((string)$data['error']);
        $data['error'] = 'Database operation failed.';
        $statusCode = 500;
    }
    http_response_code($statusCode);
    echo json_encode($data, JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

set_exception_handler(function (Throwable $error) {
    global $pdo;
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Oil Mart API: ' . $error->getMessage());
    sendJson(['error' => 'Internal server error.'], 500);
});

try {
    $jwt_secret = appEnv('JWT_SECRET');
    if (!$jwt_secret || strlen($jwt_secret) < 64 || $jwt_secret === str_repeat('0', 64)) throw new RuntimeException('Configure a random JWT_SECRET of at least 64 characters.');
    $pdo = connectDatabase();
} catch (Throwable $error) {
    error_log('Oil Mart configuration: ' . $error->getMessage());
    sendJson(['error' => 'Server configuration or database connection is unavailable.'], 503);
}
