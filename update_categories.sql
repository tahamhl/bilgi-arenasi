-- Önce status sütununu kontrol et
SHOW COLUMNS FROM categories LIKE 'status';

-- Eğer status sütunu yoksa ekle
ALTER TABLE categories ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active';

-- Tüm kategorileri aktif yap
UPDATE categories SET status = 'active';

-- Kategorileri güncelle veya ekle
INSERT INTO categories (id, name, status) VALUES
(1, 'Genel Kültür', 'active'),
(2, 'Tarih', 'active'),
(3, 'Coğrafya', 'active'),
(4, 'Bilim', 'active'),
(5, 'Sanat', 'active'),
(6, 'Spor', 'active'),
(7, 'Teknoloji', 'active'),
(8, 'Edebiyat', 'active')
ON DUPLICATE KEY UPDATE name = VALUES(name), status = VALUES(status); 