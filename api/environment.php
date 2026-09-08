<?php

function getEnvironmentSettings(): array {
    $host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? '';

    // Check if running on local development (localhost / 127.0.0.1 / XAMPP)
    $isLocal = false;
    if (PHP_SAPI === 'cli') {
        $envApp = getenv('APP_ENV');
        $isLocal = ($envApp === 'local' || empty($envApp));
    } else {
        $isLocal = str_contains($host, 'localhost') || str_contains($host, '127.0.0.1') || str_contains($host, '::1');
    }

    if ($isLocal) {
        return [
            'APP_ENV' => 'local',
            'APP_ORIGIN' => 'http://localhost:3000',
            'MYSQL_HOST' => '127.0.0.1',
            'MYSQL_PORT' => '3306',
            'MYSQL_DATABASE' => 'oil_mart',
            'MYSQL_USER' => 'root',
            'MYSQL_PASSWORD' => '',
            'JWT_SECRET' => 'a015d75ffa94272bed8bd82355b4a4e099b861ce345ae9c627d01fa25561a8a4d5e05561c1fcb685f59d90a08d44b7e9',
        ];
    }

    // Production environment settings (cPanel / Live Server)
    return [
        'APP_ENV' => 'production',
        'APP_ORIGIN' => 'https://nadapos.vortexdigitallabs.org',
        'MYSQL_HOST' => 'localhost',
        'MYSQL_PORT' => '3306',
        'MYSQL_DATABASE' => 'vortdbyg_oil_mart',
        'MYSQL_USER' => 'vortdbyg_gimhana',
        'MYSQL_PASSWORD' => '_je-P_vSa}09V21J',
        'JWT_SECRET' => 'a015d75ffa94272bed8bd82355b4a4e099b861ce345ae9c627d01fa25561a8a4d5e05561c1fcb685f59d90a08d44b7e9',
    ];
}

function appEnv(string $key, ?string $default = null): ?string {
    $val = getenv($key);
    if ($val !== false && $val !== '') {
        return $val;
    }
    $settings = getEnvironmentSettings();
    return $settings[$key] ?? $default;
}

function databaseConfig(): array {
    $config = [
        'host'     => appEnv('MYSQL_HOST', 'localhost'),
        'database' => appEnv('MYSQL_DATABASE', 'vortdbyg_oil_mart'),
        'user'     => appEnv('MYSQL_USER', 'vortdbyg_gimhana'),
        'password' => appEnv('MYSQL_PASSWORD', '_je-P_vSa}09V21J'),
        'port'     => appEnv('MYSQL_PORT', '3306'),
    ];

    if (!ctype_digit((string)$config['port']) || (int)$config['port'] < 1 || (int)$config['port'] > 65535) {
        throw new RuntimeException('Invalid database port.');
    }

    return $config;
}

function connectDatabase(): PDO {
    $config = databaseConfig();
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];

    $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['database']};charset=utf8mb4";
    try {
        return new PDO($dsn, $config['user'], $config['password'], $options);
    } catch (PDOException $e) {
        // Fallback: if 'localhost' socket fails on some cPanel setups, try '127.0.0.1' TCP
        if ($config['host'] === 'localhost') {
            try {
                $fallbackDsn = "mysql:host=127.0.0.1;port={$config['port']};dbname={$config['database']};charset=utf8mb4";
                return new PDO($fallbackDsn, $config['user'], $config['password'], $options);
            } catch (PDOException $fallbackError) {
                throw $e;
            }
        }
        throw $e;
    }
}
