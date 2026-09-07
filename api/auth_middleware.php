<?php
require_once 'config.php';
require_once __DIR__ . '/session.php';

function base64url_encode($data) {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function base64url_decode($data) {
    $padding = strlen($data) % 4;
    $padding = $padding !== 0 ? 4 - $padding : 0;
    return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', $padding), true);
}

function signJWT($payload, $secret) {
    $header = json_encode(['typ' => 'JWT', 'alg' => 'HS256']);
    $base64UrlHeader = base64url_encode($header);
    $base64UrlPayload = base64url_encode(json_encode($payload));
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    $base64UrlSignature = base64url_encode($signature);
    return $base64UrlHeader . "." . $base64UrlPayload . "." . $base64UrlSignature;
}

function verifyJWT($token, $secret) {
    $tokenParts = explode('.', $token);
    if (count($tokenParts) != 3) {
        return false;
    }
    
    $header = base64url_decode($tokenParts[0]);
    $payload = base64url_decode($tokenParts[1]);
    $signatureProvided = $tokenParts[2];
    $headerData = json_decode($header ?: '', true);
    $payloadData = json_decode($payload ?: '', true);
    if (!is_array($headerData) || ($headerData['alg'] ?? '') !== 'HS256' || !is_array($payloadData)) return false;
    if (!isset($payloadData['exp'], $payloadData['id'], $payloadData['jti']) || !is_numeric($payloadData['exp']) || (int)$payloadData['exp'] <= time()) return false;
    
    // Check signature
    $base64UrlHeader = base64url_encode($header);
    $base64UrlPayload = base64url_encode($payload);
    $signature = hash_hmac('sha256', $base64UrlHeader . "." . $base64UrlPayload, $secret, true);
    $base64UrlSignature = base64url_encode($signature);
    
    if (hash_equals($base64UrlSignature, $signatureProvided)) {
        $decodedPayload = json_decode($payload, true);
        
        // Check expiration
        if (isset($decodedPayload['exp']) && $decodedPayload['exp'] < time()) {
            return false;
        }
        
        return $decodedPayload;
    }
    
    return false;
}

function getAuthorizationHeader() {
    if (isset($_SERVER['Authorization'])) {
        return trim($_SERVER['Authorization']);
    }
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        return trim($_SERVER['HTTP_AUTHORIZATION']);
    }
    if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        return trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    }
    if (function_exists('apache_request_headers')) {
        $headers = apache_request_headers();
        if (isset($headers['Authorization'])) {
            return trim($headers['Authorization']);
        }
        if (isset($headers['authorization'])) {
            return trim($headers['authorization']);
        }
    }
    return null;
}

function authenticate() {
    global $jwt_secret, $pdo;
    $authHeader = getAuthorizationHeader();
    
    $token = null;
    if ($authHeader && preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        $token = $matches[1];
    } else if (isset($_COOKIE['auth_token'])) {
        $token = $_COOKIE['auth_token'];
    }
    
    if (!$token) {
        // Allow unauthenticated requests for login
        return null;
    }
    
    $decoded = verifyJWT($token, $jwt_secret);
    if (!$decoded) return null;
    ensureAuthTables();
    $stmt = $pdo->prepare("SELECT u.id, u.username, u.role, u.permissions, u.employment_status
        FROM auth_sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.user_id = ? AND s.expires_at > NOW() LIMIT 1");
    $stmt->execute([hash('sha256', $token), (int)$decoded['id']]);
    $user = $stmt->fetch();
    if (!$user || $user['employment_status'] !== 'active') return null;
    $user['permissions'] = userPermissions($user);
    unset($user['employment_status']);
    return $user;
}

function requireAuth() {
    $user = authenticate();
    if (!$user) {
        sendJson(["error" => "Unauthorized"], 401);
    }
    return $user;
}
?>
