<?php
require_once 'config/database.php';

try {
    // SQL dosyalarını oku ve çalıştır
    $files = [
        'create_predefined_questions.sql',
        'create_custom_questions.sql'
    ];
    
    foreach ($files as $file) {
        $sql = file_get_contents($file);
        $pdo->exec($sql);
        echo "$file başarıyla çalıştırıldı.\n";
    }
    
    echo "Tüm tablolar başarıyla oluşturuldu!";
} catch (PDOException $e) {
    die("Hata: " . $e->getMessage());
} 