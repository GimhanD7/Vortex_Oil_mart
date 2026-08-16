<?php
global $pdo, $inputData, $method;
requireAuth(); // Require auth for settings

function ensureSettingsTable() {
    global $pdo;
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS app_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value TEXT NOT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    ");
}

$defaultSettings = [
    'store_name' => 'Oil Mart',
    'store_address' => '123, Industrial Area, New Delhi',
    'store_phone' => '',
    'gst_number' => '',
    'tax_rate' => '0',
    'invoice_prefix' => 'INV',
    'invoice_footer' => 'Thank you for your visit! Drive safe. Stay protected.',
    'invoice_logo_text' => 'OM',
    'invoice_print_style' => 'Dot Matrix',
    'payment_methods' => ['Cash', 'Card', 'Bank Transfer'],
];

function normalizePaymentMethods($methods) {
    if (!is_array($methods)) return [];
    $normalized = [];
    foreach ($methods as $method) {
        $normalizedMethod = $method === 'UPI' ? 'Bank Transfer' : $method;
        if ($normalizedMethod !== 'UPI' && !in_array($normalizedMethod, $normalized)) {
            $normalized[] = $normalizedMethod;
        }
    }
    return $normalized;
}

if ($method === 'GET') {
    try {
        ensureSettingsTable();
        $stmt = $pdo->query('SELECT setting_key, setting_value FROM app_settings');
        $rows = $stmt->fetchAll();
        
        $settings = $defaultSettings;
        foreach ($rows as $row) {
            if ($row['setting_key'] === 'payment_methods') {
                $settings['payment_methods'] = normalizePaymentMethods(json_decode($row['setting_value'], true));
            } else {
                $settings[$row['setting_key']] = $row['setting_value'];
            }
        }
        
        sendJson($settings);
    } catch (PDOException $e) {
        // Return default settings on error
        sendJson($defaultSettings);
    }
}

if ($method === 'POST') {
    try {
        ensureSettingsTable();
        
        $settings = $defaultSettings;
        foreach ($inputData as $key => $value) {
            $settings[$key] = $value;
        }
        
        $settings['payment_methods'] = normalizePaymentMethods(
            isset($settings['payment_methods']) && is_array($settings['payment_methods']) 
                ? $settings['payment_methods'] 
                : $defaultSettings['payment_methods']
        );
        
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare("
            INSERT INTO app_settings (setting_key, setting_value)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        ");
        
        foreach ($settings as $key => $value) {
            $storedValue = is_array($value) ? json_encode($value) : (string)$value;
            $stmt->execute([$key, $storedValue]);
        }
        
        $pdo->commit();
        
        sendJson(["message" => "Settings saved successfully", "settings" => $settings]);
    } catch (PDOException $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        sendJson(["error" => "Unable to save settings"], 500);
    }
}

sendJson(["error" => "Endpoint not found"], 404);
?>
