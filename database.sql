-- Veritabanını oluştur
CREATE DATABASE IF NOT EXISTS bilgi_arenasi CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bilgi_arenasi;

-- Users tablosu
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'banned') DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Kategoriler tablosu
CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'passive') DEFAULT 'active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hazır sorular tablosu
CREATE TABLE IF NOT EXISTS predefined_questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT,
    question_text TEXT NOT NULL,
    option_a VARCHAR(255) NOT NULL,
    option_b VARCHAR(255) NOT NULL,
    option_c VARCHAR(255) NOT NULL,
    option_d VARCHAR(255) NOT NULL,
    correct_answer CHAR(1) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Odalar tablosu
CREATE TABLE IF NOT EXISTS rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_code VARCHAR(6) NOT NULL UNIQUE,
    admin_id INT NOT NULL,
    room_name VARCHAR(100) NOT NULL,
    password VARCHAR(255),
    max_players INT DEFAULT 20,
    question_time INT DEFAULT 30,
    question_count INT DEFAULT 10,
    category_id INT,
    is_custom_questions BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP NULL,
    ended_at TIMESTAMP NULL,
    is_private BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Özel sorular tablosu
CREATE TABLE IF NOT EXISTS custom_questions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL,
    question_text TEXT NOT NULL,
    option_a VARCHAR(255) NOT NULL,
    option_b VARCHAR(255) NOT NULL,
    option_c VARCHAR(255) NOT NULL,
    option_d VARCHAR(255) NOT NULL,
    correct_answer CHAR(1) NOT NULL,
    question_order INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Oda katılımcıları tablosu
CREATE TABLE IF NOT EXISTS room_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    score INT DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('active', 'left') DEFAULT 'active',
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Participant Answers tablosu
CREATE TABLE IF NOT EXISTS participant_answers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT,
    question_id INT,
    user_id INT,
    answer_id INT,
    response_time INT,
    is_correct BOOLEAN DEFAULT FALSE,
    points_earned INT DEFAULT 0,
    answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (answer_id) REFERENCES answers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Stats tablosu
CREATE TABLE IF NOT EXISTS user_stats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE,
    total_points BIGINT DEFAULT 0,
    games_played INT DEFAULT 0,
    games_won INT DEFAULT 0,
    correct_answers INT DEFAULT 0,
    wrong_answers INT DEFAULT 0,
    fastest_answer INT,
    total_time_played BIGINT DEFAULT 0,
    last_played_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Achievements tablosu
CREATE TABLE IF NOT EXISTS achievements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    points INT DEFAULT 0,
    icon_url VARCHAR(255),
    required_score INT,
    type ENUM('score', 'games', 'answers', 'time') NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Achievements tablosu
CREATE TABLE IF NOT EXISTS user_achievements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    achievement_id INT,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Leaderboards tablosu
CREATE TABLE IF NOT EXISTS leaderboards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    category_id INT,
    points BIGINT DEFAULT 0,
    player_rank INT,
    period ENUM('daily', 'weekly', 'monthly', 'all-time') NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- İndeksler
CREATE INDEX idx_room_code ON rooms(room_code);
CREATE INDEX idx_user_stats ON user_stats(total_points);
CREATE INDEX idx_leaderboards ON leaderboards(points, period);

-- Örnek kategoriler
INSERT INTO categories (name, description) VALUES
('Spor', 'Spor ile ilgili sorular'),
('Siyaset', 'Siyaset ile ilgili sorular'),
('Tarih', 'Tarih ile ilgili sorular'),
('Bilim', 'Bilim ile ilgili sorular'),
('Sanat', 'Sanat ile ilgili sorular'),
('Genel Kültür', 'Genel kültür soruları');

-- Admin kullanıcısı oluştur
INSERT INTO users (username, email, password, role) VALUES
('admin', 'admin@bilgiarenasi.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Örnek kategori verileri
INSERT INTO categories (name) VALUES 
('Spor'),
('Tarih'),
('Bilim'),
('Coğrafya'),
('Genel Kültür'),
('Sanat'),
('Teknoloji'),
('Edebiyat'); 