<?php

// Veritabanı bağlantı bilgileri
$host = 'localhost';
$dbname = 'bilgi_arenasi';
$username = 'root';
$password = '';

try {
    // PDO bağlantısı oluştur
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Excel dosyasını oku
    $excel_file = 'Kahoot_Soru_Bankasi_300_Soru.xlsx';
    
    // PHPExcel kütüphanesi yerine basit bir CSV okuma kullanacağız
    // Excel dosyasını önce CSV olarak kaydedin
    
    // Kategorileri ekle
    $categories = [
        'Genel Kültür' => 1,
        'Tarih' => 2,
        'Coğrafya' => 3,
        'Bilim' => 4,
        'Sanat' => 5,
        'Spor' => 6,
        'Teknoloji' => 7,
        'Edebiyat' => 8
    ];

    // Kategorileri veritabanına ekle
    $stmt = $pdo->prepare("INSERT IGNORE INTO categories (id, name) VALUES (?, ?)");
    foreach ($categories as $name => $id) {
        $stmt->execute([$id, $name]);
    }

    // CSV dosyasını oku
    if (($handle = fopen("sorular.csv", "r")) !== FALSE) {
        // İlk satırı atla (başlıklar)
        fgetcsv($handle);
        
        // Soruları ekle
        $stmt = $pdo->prepare("INSERT INTO predefined_questions (category_id, question_text, option_a, option_b, option_c, option_d, correct_answer) VALUES (?, ?, ?, ?, ?, ?, ?)");
        
        while (($data = fgetcsv($handle)) !== FALSE) {
            $category_id = isset($categories[$data[0]]) ? $categories[$data[0]] : 1; // Varsayılan olarak Genel Kültür
            $question_text = $data[1];
            $option_a = $data[2];
            $option_b = $data[3];
            $option_c = $data[4];
            $option_d = $data[5];
            $correct_answer = strtoupper($data[6]);
            
            try {
                $stmt->execute([$category_id, $question_text, $option_a, $option_b, $option_c, $option_d, $correct_answer]);
                echo "Soru eklendi: " . $question_text . "\n";
            } catch (PDOException $e) {
                echo "Hata: " . $e->getMessage() . "\n";
            }
        }
        fclose($handle);
    }

    echo "Sorular başarıyla içe aktarıldı!";
} catch (PDOException $e) {
    die("Veritabanı hatası: " . $e->getMessage());
} 