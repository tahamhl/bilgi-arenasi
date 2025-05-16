<?php
require_once 'config/database.php';

try {
    // Kategorileri kontrol et
    $stmt = $pdo->query("SELECT * FROM categories WHERE status = 'active'");
    $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Aktif Kategoriler:\n";
    foreach ($categories as $category) {
        echo "- {$category['name']}\n";
        
        // Her kategori için soru sayısını kontrol et
        $stmt = $pdo->prepare("SELECT COUNT(*) as total FROM predefined_questions WHERE category_id = ?");
        $stmt->execute([$category['id']]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        echo "  Soru sayısı: {$result['total']}\n";
    }
    
} catch (PDOException $e) {
    die("Hata: " . $e->getMessage());
} 