<?php
$_SERVER['REQUEST_METHOD'] = 'POST';
$_GET['request'] = 'auth/login';

// Mock php://input
$input = json_encode(['username' => 'admin', 'password' => 'admin123']);
file_put_contents('php://memory', $input);

// We can't mock php://input easily if it's read with file_get_contents('php://input'), but we can just require the index.php and override it if needed.
// Wait, file_get_contents('php://input') is used. Let's just create a test that calls the auth route directly.
require 'config.php';
$method = 'POST';
$id = 'login';
$inputData = ['username' => 'admin', 'password' => 'admin123'];

require 'routes/auth.php';
