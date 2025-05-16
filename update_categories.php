<?php
require_once 'config/database.php';

try {
    // Status sütununun varlığını kontrol et
    $result = $pdo->query("SHOW COLUMNS FROM categories LIKE 'status'");
    $statusExists = $result->rowCount() > 0;
    
    if (!$statusExists) {
        // Status sütunu yoksa ekle
        $pdo->exec("ALTER TABLE categories ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active'");
        echo "Status sütunu eklendi.\n";
    }
    
    // Tüm kategorileri aktif yap
    $pdo->exec("UPDATE categories SET status = 'active'");
    
    // Kategorileri ekle veya güncelle
    $sql = "INSERT INTO categories (id, name, status) VALUES
        (1, 'Genel Kültür', 'active'),
        (2, 'Tarih', 'active'),
        (3, 'Coğrafya', 'active'),
        (4, 'Bilim', 'active'),
        (5, 'Sanat', 'active'),
        (6, 'Spor', 'active'),
        (7, 'Teknoloji', 'active'),
        (8, 'Edebiyat', 'active')
        ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status)";
    
    $pdo->exec($sql);
    echo "Kategoriler başarıyla güncellendi!";
} catch (PDOException $e) {
    die("Hata: " . $e->getMessage());
} 