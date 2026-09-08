<?php

function getDefaultConfig(): array {
    $host = $_SERVER['HTTP_HOST'] ?? $_SERVER['SERVER_NAME'] ?? '';
    $isLocal = in_array($host, ['localhost', '127.0.0.1', 'localhost:3000'], true)
        || str_starts_with($host, 'localhost:')
        || str_starts_with($host, '127.0.0.1:')
        || (php_sapi_name() === 'cli' && empty(getenv('APP_ENV')));

    if ($isLocal) {
        return [
            'APP_ENV'        => 'local',
            'APP_ORIGIN'     => 'http://localhost:3000',
            'MYSQL_HOST'     => '127.0.0.1',
            'MYSQL_PORT'     => '3306',
            'MYSQL_DATABASE' => 'oil_mart',
            'MYSQL_USER'     => 'root',
            'MYSQL_PASSWORD' => '',
            'JWT_SECRET'     => 'a015d75ffa94272bed8bd82355b4a4e099b861ce345ae9c627d01fa25561a8a4d5e05561c1fcb685f59d90a08d44b7e9',
        ];
    }

    // Production / cPanel settings (nadapos.vortexdigitallabs.org)
    return [
        'APP_ENV'        => 'production',
        'APP_ORIGIN'     => 'https://nadapos.vortexdigitallabs.org',
        'MYSQL_HOST'     => 'localhost',
        'MYSQL_PORT'     => '3306',
        'MYSQL_DATABASE' => 'vortdbyg_oil_mart',
        'MYSQL_USER'     => 'vortdbyg_gimhana',
        'MYSQL_PASSWORD' => '_je-P_vSa}09V21J',
        'JWT_SECRET'     => 'a015d75ffa94272bed8bd82355b4a4e099b861ce345ae9c627d01fa25561a8a4d5e05561c1fcb685f59d90a08d44b7e9',
    ];
}

function appEnv(string $key, ?string $default = null): ?string {
    static $fileValues = null;
    $defaults = getDefaultConfig();

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
                        if (strlen($v) >= 2 && (($v[0] === '"' && $v[-1] === '"') || ($v[0] === "'" && $v[-1] === "'"))) {
                            $v = substr($v, 1, -1);
                        }
                        $fileValues[$k] = $v;
                    }
                }
            }
        }
    }

    $value = getenv($key);
    if ($value !== false && $value !== null && $value !== '') {
        return $value;
    }

    if (isset($fileValues[$key]) && $fileValues[$key] !== '') {
        return $fileValues[$key];
    }

    return $defaults[$key] ?? $default;
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
