<?php
global $pdo, $method;
$user = requireAuth();
$isAdmin = isset($user["role"]) && $user["role"] === "admin";

function notificationTableExists($table) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?");
    $stmt->execute([$table]);
    return (int)$stmt->fetchColumn() > 0;
}

function notificationColumnExists($table, $column) {
    global $pdo;
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    $stmt->execute([$table, $column]);
    return (int)$stmt->fetchColumn() > 0;
}

function notificationDateExpression($tableAlias, $tableName) {
    $prefix = $tableAlias ? $tableAlias . "." : "";
    if (notificationColumnExists($tableName, "updated_at")) {
        return "COALESCE({$prefix}updated_at, {$prefix}created_at, NOW())";
    }
    if (notificationColumnExists($tableName, "created_at")) {
        return "COALESCE({$prefix}created_at, NOW())";
    }
    return "NOW()";
}

function notificationUnit($unit) {
    return $unit && trim($unit) !== "" ? $unit : "Unit";
}

function notificationStockMessage($row) {
    $stock = rtrim(rtrim(number_format((float)$row["stock_quantity"], 3, ".", ""), "0"), ".");
    $reorder = rtrim(rtrim(number_format((float)$row["reorder_level"], 3, ".", ""), "0"), ".");
    $unit = notificationUnit($row["unit"] ?? "Unit");
    return "{$row["name"]} ({$row["sku"]}) has {$stock} {$unit} remaining. Reorder level is {$reorder} {$unit}.";
}

function notificationAmount($amount) {
    return "Rs. " . number_format((float)$amount, 2);
}

if ($method !== "GET") {
    sendJson(["error" => "Method not allowed"], 405);
}

try {
    $notifications = [];

    if (notificationTableExists("products")) {
        $productDate = notificationDateExpression("p", "products");

        $stmt = $pdo->query("
            SELECT
                p.id,
                p.name,
                COALESCE(NULLIF(p.sku, ''), CONCAT('SKU-', p.id)) AS sku,
                p.stock_quantity,
                p.reorder_level,
                p.unit,
                {$productDate} AS alert_time
            FROM products p
            WHERE COALESCE(p.stock_quantity, 0) <= 0
            ORDER BY alert_time DESC, p.id DESC
            LIMIT 20
        ");

        foreach ($stmt->fetchAll() as $row) {
            $stamp = strtotime($row["alert_time"] ?: "now");
            $notifications[] = [
                "id" => "out-stock-product-" . $row["id"] . "-" . $stamp,
                "type" => "out_of_stock",
                "severity" => "critical",
                "title" => "Out of stock",
                "message" => notificationStockMessage($row),
                "created_at" => date("c", $stamp),
                "href" => $isAdmin ? "/admin/inventory" : "/cashier/inventory"
            ];
        }

        $stmt = $pdo->query("
            SELECT
                p.id,
                p.name,
                COALESCE(NULLIF(p.sku, ''), CONCAT('SKU-', p.id)) AS sku,
                p.stock_quantity,
                p.reorder_level,
                p.unit,
                {$productDate} AS alert_time
            FROM products p
            WHERE COALESCE(p.stock_quantity, 0) > 0
              AND COALESCE(p.stock_quantity, 0) <= COALESCE(p.reorder_level, 10)
            ORDER BY p.stock_quantity ASC, alert_time DESC
            LIMIT 30
        ");

        foreach ($stmt->fetchAll() as $row) {
            $stamp = strtotime($row["alert_time"] ?: "now");
            $notifications[] = [
                "id" => "low-stock-product-" . $row["id"] . "-" . $stamp,
                "type" => "low_stock",
                "severity" => "warning",
                "title" => "Low stock alert",
                "message" => notificationStockMessage($row),
                "created_at" => date("c", $stamp),
                "href" => $isAdmin ? "/admin/inventory" : "/cashier/inventory"
            ];
        }
    }

    if ($isAdmin && notificationTableExists("transaction_revocations")) {
        $stmt = $pdo->query("
            SELECT
                tr.id,
                tr.sale_id,
                tr.action_type,
                tr.reason,
                tr.affected_amount,
                tr.created_at,
                cashier.username AS cashier_name,
                approver.username AS approver_name
            FROM transaction_revocations tr
            LEFT JOIN users cashier ON cashier.id = tr.cashier_id
            LEFT JOIN users approver ON approver.id = tr.approver_id
            WHERE tr.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            ORDER BY tr.created_at DESC, tr.id DESC
            LIMIT 30
        ");

        foreach ($stmt->fetchAll() as $row) {
            $invoice = $row["sale_id"] ? "INV-" . str_pad((string)$row["sale_id"], 6, "0", STR_PAD_LEFT) : "Draft sale";
            $action = ucwords(str_replace("_", " ", $row["action_type"]));
            $stamp = strtotime($row["created_at"] ?: "now");
            $notifications[] = [
                "id" => "revocation-" . $row["id"],
                "type" => "revocation",
                "severity" => "critical",
                "title" => $action,
                "message" => "{$invoice}: {$row["reason"]}. Affected amount " . notificationAmount($row["affected_amount"]) . ".",
                "created_at" => date("c", $stamp),
                "href" => "/admin/sales?tab=logs",
                "meta" => [
                    "cashier" => $row["cashier_name"] ?: "Unknown",
                    "approver" => $row["approver_name"] ?: "Not required"
                ]
            ];
        }
    }

    if ($isAdmin && notificationTableExists("sales")) {
        $stmt = $pdo->query("
            SELECT
                s.id,
                s.total_amount,
                s.payment_method,
                s.status,
                s.created_at,
                u.username AS cashier_name
            FROM sales s
            LEFT JOIN users u ON u.id = s.cashier_id
            WHERE COALESCE(s.status, 'completed') = 'completed'
              AND s.created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE)
            ORDER BY s.created_at DESC, s.id DESC
            LIMIT 15
        ");

        foreach ($stmt->fetchAll() as $row) {
            $stamp = strtotime($row["created_at"] ?: "now");
            $notifications[] = [
                "id" => "sale-" . $row["id"],
                "type" => "sale_completed",
                "severity" => "info",
                "title" => "Sale completed",
                "message" => "INV-" . str_pad((string)$row["id"], 6, "0", STR_PAD_LEFT) . " completed by " . ($row["cashier_name"] ?: "cashier") . " for " . notificationAmount($row["total_amount"]) . ".",
                "created_at" => date("c", $stamp),
                "href" => "/admin/sales"
            ];
        }
    }

    usort($notifications, function ($a, $b) {
        return strtotime($b["created_at"]) <=> strtotime($a["created_at"]);
    });

    $notifications = array_slice($notifications, 0, 50);
    $importantCount = count(array_filter($notifications, function ($notification) {
        return in_array($notification["severity"], ["critical", "warning"]);
    }));

    sendJson([
        "server_time" => date("c"),
        "unread_count" => $importantCount,
        "notifications" => $notifications
    ]);
} catch (PDOException $e) {
    sendJson(["error" => "Internal server error"], 500);
}
?>
