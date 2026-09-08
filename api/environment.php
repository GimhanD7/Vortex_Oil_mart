<?php

function appEnv(string $key, ?string $default = null): ?string {
    static $fileValues = null;
    if ($fileValues === null) {
        $fileValues = [];
        $path = getenv('OIL_MART_ENV_FILE') ?: __DIR__ . '/.env';
        if (is_file($path)) {
            $parsed = @parse_ini_file($path, false, INI_SCANNER_RAW);
            if ($parsed !== false) {
                $fileValues = $parsed;
            } else {
                $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                if ($lines !== false) {
                    foreach ($lines as $line) {
                        $line = trim($line);
                        if ($line === '' || str_starts_with($line, '#') || str_starts_with($line, ';')) continue;
                        $pos = strpos($line, '=');
                        if ($pos === false) continue;
                        $k = trim(substr($line, 0, $pos));
                        $v = trim(substr($line, $pos + 1));
                        if (strlen($v) >= 2 && (($v[0] === '"' && $v[-1] === '"') || ($v[0] === "'" && $v[-1] === "'"))) $v = substr($v, 1, -1);
                        $fileValues[$k] = $v;
                    }
                }
            }
        }
    }
    $value = getenv($key);
    return $value !== false ? $value : ($fileValues[$key] ?? $default);
}

function databaseConfig(): array {
    $config = [];
    foreach (['host' => 'MYSQL_HOST', 'database' => 'MYSQL_DATABASE', 'user' => 'MYSQL_USER', 'password' => 'MYSQL_PASSWORD'] as $name => $key) {
        $value = appEnv($key);
        if ($value === null || ($value === '' && $name !== 'password')) throw new RuntimeException("Missing environment setting: $key");
        $config[$name] = $value;
    }
    $config['port'] = appEnv('MYSQL_PORT', '3306');
    if (!ctype_digit($config['port']) || (int)$config['port'] < 1 || (int)$config['port'] > 65535) throw new RuntimeException('Invalid database port.');
    if (appEnv('APP_ENV', 'production') !== 'local' && $config['password'] === '') throw new RuntimeException('Production database password must not be empty.');
    return $config;
}

function connectDatabase(): PDO {
    $config = databaseConfig();
    return new PDO("mysql:host={$config['host']};port={$config['port']};dbname={$config['database']};charset=utf8mb4", $config['user'], $config['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
}
