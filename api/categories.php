<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

require_once __DIR__ . '/../config/database.php';

try {
    // Hata raporlamayı aç
    error_reporting(E_ALL);
    ini_set('display_errors', 1);
    
    // SQL sorgusunu yazdır
    $sql = "SELECT * FROM categories WHERE status = 'active' ORDER BY name";
    error_log("SQL Query: " . $sql);
    
    $stmt = $pdo->query($sql);
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Sonuçları yazdır
    error_log("Categories Result: " . print_r($categories, true));
    
    $response = [
        'success' => true,
        'categories' => $categories
    ];
    
    // JSON'ı yazdır
    error_log("JSON Response: " . json_encode($response));
    echo json_encode($response);
} catch (PDOException $e) {
    error_log("Database Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Kategoriler alınırken bir hata oluştu: ' . $e->getMessage()
    ]);
} catch (Exception $e) {
    error_log("General Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Beklenmeyen bir hata oluştu: ' . $e->getMessage()
    ]);
}