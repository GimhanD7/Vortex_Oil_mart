<?php

function appEnv(string $key, ?string $default = null): ?string {
    static $fileValues;
    if ($fileValues === null) {
        $path = getenv('OIL_MART_ENV_FILE') ?: __DIR__ . '/.env';
        $fileValues = is_file($path) ? parse_ini_file($path, false, INI_SCANNER_RAW) : [];
        if ($fileValues === false) throw new RuntimeException('Invalid environment configuration.');
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
