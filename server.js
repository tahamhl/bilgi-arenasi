require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MySQL bağlantı havuzu
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'bilgi_arenasi',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Aktif odaları tutacak obje
const activeRooms = new Map();
// Atılan oyuncuları tutacak obje
const kickedPlayers = new Map(); // {userId: {roomCode: string, kickTime: number}}

// Soru süresi dolduğunda çalışacak fonksiyon
function handleQuestionTimeout(roomCode) {
    const room = activeRooms.get(roomCode);
    if (!room || !room.started) return;

    const currentQuestion = room.questions[room.currentQuestionIndex];

    // Tüm oyuncuların puanlarını güncelle
    room.players.forEach(player => {
        if (player.lastAnswer) {
            player.score += player.lastAnswer.score;
            delete player.lastAnswer;
        }
        player.answered = false;
    });

    room.waitingForNext = true;

    // Sonuçları gönder
    io.to(roomCode).emit('questionTimeout', {
        correctAnswer: currentQuestion.correct_answer,
        scores: Array.from(room.players.values())
    });
}

// Yardımcı fonksiyonlar
function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, 'your-secret-key');
        const [users] = await pool.execute(
            'SELECT id, username, email FROM users WHERE id = ?',
            [decoded.id]
        );
        return users[0] || null;
    } catch (error) {
        return null;
    }
}

// Socket.io bağlantı yönetimi
io.on('connection', async (socket) => {
    console.log('Yeni kullanıcı bağlandı');

    // Ping kontrolü
    socket.on('ping', (callback) => {
        callback();
    });

    // Kategorileri getir
    socket.on('getCategories', async (callback) => {
        try {
            const [categories] = await pool.execute('SELECT * FROM categories');
            callback({ success: true, categories });
        } catch (error) {
            callback({ success: false, message: 'Kategoriler alınırken bir hata oluştu.' });
        }
    });

    // Kayıt işlemi
    socket.on('register', async (data, callback) => {
        try {
            const { username, email, password } = data;
            
            // E-posta kontrolü
            const [existingUsers] = await pool.execute(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );

            if (existingUsers.length > 0) {
                return callback({ success: false, message: 'Bu e-posta adresi zaten kullanımda!' });
            }

            // Şifre hashleme
            const hashedPassword = await bcrypt.hash(password, 10);

            // Kullanıcı oluşturma
            await pool.execute(
                'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
                [username, email, hashedPassword]
            );

            callback({ success: true });
        } catch (error) {
            console.error('Kayıt hatası:', error);
            callback({ success: false, message: 'Kayıt sırasında bir hata oluştu.' });
        }
    });

    // Giriş işlemi
    socket.on('login', async (data, callback) => {
        try {
            const { email, password } = data;

            // Kullanıcı kontrolü
            const [users] = await pool.execute(
                'SELECT * FROM users WHERE email = ?',
                [email]
            );

            if (users.length === 0) {
                return callback({ success: false, message: 'Kullanıcı bulunamadı!' });
            }

            const user = users[0];

            // Şifre kontrolü
            const validPassword = await bcrypt.compare(password, user.password);
            if (!validPassword) {
                return callback({ success: false, message: 'Geçersiz şifre!' });
            }

            // Token oluşturma
            const token = jwt.sign(
                { id: user.id, email: user.email },
                'your-secret-key',
                { expiresIn: '24h' }
            );

            callback({
                success: true,
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email
                }
            });
        } catch (error) {
            console.error('Giriş hatası:', error);
            callback({ success: false, message: 'Giriş sırasında bir hata oluştu.' });
        }
    });

    // Oda oluşturma
    socket.on('createRoom', async (data, callback) => {
        try {
            const user = await verifyToken(data.token);
            if (!user) {
                return callback({ success: false, message: 'Oturum geçersiz!' });
            }

            const roomCode = generateRoomCode();
            const { roomName, isPrivate, maxPlayers, questionTime, categoryId } = data;

            // Odayı veritabanına kaydet
            const [result] = await pool.execute(
                'INSERT INTO rooms (room_code, admin_id, room_name, is_private, max_players, question_time, category_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [roomCode, user.id, roomName, isPrivate, maxPlayers, questionTime, categoryId || null]
            );

            // Aktif oda bilgisini tut
            activeRooms.set(roomCode, {
                id: result.insertId,
                roomCode,
                roomName,
                adminId: user.id,
                players: new Map([[user.id, { ...user, isAdmin: true, score: 0 }]]),
                maxPlayers: parseInt(maxPlayers),
                questionTime: parseInt(questionTime),
                categoryId: categoryId || null,
                isPrivate: isPrivate === 'true' || isPrivate === true,
                questions: [],
                currentQuestionIndex: -1,
                waitingForNext: false,
                started: false
            });

            callback({
                success: true,
                roomCode,
                roomName,
                isPrivate
            });
        } catch (error) {
            console.error('Oda oluşturma hatası:', error);
            callback({ success: false, message: 'Oda oluşturulurken bir hata oluştu.' });
        }
    });

    // Aktif odaları getir
    socket.on('getActiveRooms', async (callback) => {
        try {
            // Kategori bilgilerini al
            const [categories] = await pool.execute('SELECT id, name FROM categories');
            const categoryMap = {};
            categories.forEach(category => {
                categoryMap[category.id] = category.name;
            });

            const rooms = Array.from(activeRooms.entries())
                .filter(([_, room]) => !room.started && !room.isPrivate) // Sadece başlamamış ve özel olmayan odaları göster
                .map(([roomCode, room]) => ({
                    roomCode,
                    roomName: room.roomName || 'İsimsiz Oda',
                    playerCount: room.players.size,
                    maxPlayers: room.maxPlayers,
                    started: room.started,
                    categoryId: room.categoryId,
                    categoryName: room.categoryId ? categoryMap[room.categoryId] : 'Genel'
                }));

            callback({ success: true, rooms });
        } catch (error) {
            console.error('Aktif odaları getirme hatası:', error);
            callback({ success: false, message: 'Odalar alınırken bir hata oluştu.' });
        }
    });

    // Odaya katılma
    socket.on('joinRoom', async (data, callback) => {
        try {
            const user = await verifyToken(data.token);
            if (!user) {
                return callback({ success: false, message: 'Oturum geçersiz!' });
            }

            const room = activeRooms.get(data.roomCode);
            if (!room) {
                return callback({ success: false, message: 'Oda bulunamadı!' });
            }

            // Oyun başladıysa katılımı engelle
            if (room.started) {
                return callback({ success: false, message: 'Oyun başladı, odaya katılamazsınız!' });
            }

            // Atılma kontrolü
            const kickInfo = kickedPlayers.get(user.id);
            if (kickInfo && kickInfo.roomCode === data.roomCode) {
                const timeSinceKick = Date.now() - kickInfo.kickTime;
                const waitTime = 5 * 60 * 1000; // 5 dakika
                if (timeSinceKick < waitTime) {
                    const remainingMinutes = Math.ceil((waitTime - timeSinceKick) / 60000);
                    return callback({ 
                        success: false, 
                        message: `Bu odadan atıldınız. ${remainingMinutes} dakika sonra tekrar katılabilirsiniz.` 
                    });
                } else {
                    // Süre dolduysa bilgiyi sil
                    kickedPlayers.delete(user.id);
                }
            }

            if (room.players.size >= room.maxPlayers) {
                return callback({ success: false, message: 'Oda dolu!' });
            }

            // Socket'i kullanıcıya bağla
            socket.userId = user.id;
            socket.roomCode = data.roomCode;

            // Odaya katıl
            room.players.set(user.id, {
                ...user,
                socketId: socket.id,
                isAdmin: user.id === room.adminId,
                score: 0,
                isMuted: false // Susturma durumu eklendi
            });

            // Socket'i odaya ekle
            socket.join(data.roomCode);

            // Oyuncu listesini güncelle
            io.to(data.roomCode).emit('updatePlayers', Array.from(room.players.values()));
            
            // Skor tablosunu güncelle
            io.to(data.roomCode).emit('updateScores', Array.from(room.players.values()));

            callback({
                success: true,
                isAdmin: user.id === room.adminId
            });
        } catch (error) {
            console.error('Odaya katılma hatası:', error);
            callback({ success: false, message: 'Odaya katılırken bir hata oluştu.' });
        }
    });

    // Özel soruları toplu ekleme
    socket.on('addCustomQuestions', async (data, callback) => {
        try {
            // Veri kontrolü
            if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
                return callback({ success: false, message: 'Geçersiz soru verisi!' });
            }

            if (!data.roomCode) {
                return callback({ success: false, message: 'Oda kodu bulunamadı!' });
            }

            const room = activeRooms.get(data.roomCode);
            if (!room) {
                return callback({ success: false, message: 'Oda bulunamadı!' });
            }

            // Önce veritabanından oda ID'sini al
            const [roomResult] = await pool.execute(
                'SELECT id FROM rooms WHERE room_code = ?',
                [data.roomCode]
            );

            if (!roomResult || roomResult.length === 0) {
                return callback({ success: false, message: 'Oda veritabanında bulunamadı!' });
            }

            const roomId = roomResult[0].id;

            // Tüm soruları veritabanına kaydet
            for (let i = 0; i < data.questions.length; i++) {
                const question = data.questions[i];
                
                // Soru verisi kontrolü
                if (!question.text || !question.optionA || !question.optionB || 
                    !question.optionC || !question.optionD || !question.correctAnswer) {
                    return callback({ 
                        success: false, 
                        message: `${i + 1}. sorunun tüm alanları doldurulmalıdır!` 
                    });
                }

                try {
                    const [result] = await pool.execute(
                        'INSERT INTO custom_questions (room_id, question_text, option_a, option_b, option_c, option_d, correct_answer, question_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [roomId, question.text, question.optionA, question.optionB, question.optionC, question.optionD, question.correctAnswer, i + 1]
                    );

                    // Soruyu odaya ekle
                    room.questions.push({
                        id: result.insertId,
                        text: question.text,
                        option_a: question.optionA,
                        option_b: question.optionB,
                        option_c: question.optionC,
                        option_d: question.optionD,
                        correct_answer: question.correctAnswer
                    });
                } catch (insertError) {
                    console.error('Soru ekleme SQL hatası:', insertError);
                    return callback({ 
                        success: false, 
                        message: `${i + 1}. soru eklenirken bir hata oluştu. Lütfen tekrar deneyin.` 
                    });
                }
            }

            callback({ success: true });
        } catch (error) {
            console.error('Soru ekleme genel hatası:', error);
            callback({ success: false, message: 'Sorular eklenirken bir hata oluştu. Lütfen tekrar deneyin.' });
        }
    });

    // Oyunu başlatma
    socket.on('startGame', async (data, callback) => {
        try {
            console.log('Oyun başlatma isteği:', data);
            
            const room = activeRooms.get(data.roomCode);
            if (!room) {
                console.log('Oda bulunamadı:', data.roomCode);
                return callback({ success: false, message: 'Oda bulunamadı!' });
            }

            // Admin kontrolü
            if (!socket.userId || socket.userId !== room.adminId) {
                console.log('Yetkisiz erişim:', socket.userId, room.adminId);
                return callback({ success: false, message: 'Bu işlem için yetkiniz yok!' });
            }

            // Eğer kategori seçildiyse, hazır soruları al
            if (room.categoryId) {
                console.log('Kategori soruları alınıyor:', room.categoryId);
                const [questions] = await pool.execute(
                    'SELECT * FROM predefined_questions WHERE category_id = ? ORDER BY RAND() LIMIT 10',
                    [room.categoryId]
                );

                console.log('Bulunan soru sayısı:', questions.length);

                if (questions.length === 0) {
                    return callback({ success: false, message: 'Bu kategoride yeterli soru bulunamadı!' });
                }

                room.questions = questions;
            } else {
                // Özel sorular için custom_questions tablosundan soruları al
                console.log('Özel sorular alınıyor:', data.roomCode);
                const [roomResult] = await pool.execute(
                    'SELECT id FROM rooms WHERE room_code = ?',
                    [data.roomCode]
                );

                if (roomResult.length === 0) {
                    return callback({ success: false, message: 'Oda veritabanında bulunamadı!' });
                }

                const roomId = roomResult[0].id;
                const [questions] = await pool.execute(
                    'SELECT * FROM custom_questions WHERE room_id = ? ORDER BY question_order',
                    [roomId]
                );

                console.log('Bulunan özel soru sayısı:', questions.length);

                if (questions.length === 0) {
                    return callback({ success: false, message: 'Önce soru eklemelisiniz!' });
                }

                room.questions = questions;
            }

            room.started = true;
            room.currentQuestionIndex = -1;
            room.questionStartTime = null;
            room.questionEndTime = null;
            room.waitingForNext = false;

            // Oyun durumunu güncelle
            io.to(data.roomCode).emit('gameStatus', { 
                started: true,
                totalQuestions: room.questions.length,
                currentQuestion: 0
            });

            // İlk soruyu göster
            sendNextQuestion(data.roomCode);

            callback({ success: true });
        } catch (error) {
            console.error('Oyun başlatma hatası:', error);
            console.error(error.stack); // Hata stack trace'ini yazdır
            callback({ success: false, message: 'Oyun başlatılırken bir hata oluştu: ' + error.message });
        }
    });

    // Cevap gönderme
    socket.on('submitAnswer', async (data, callback) => {
        const room = activeRooms.get(data.roomCode);
        if (!room || !room.started) {
            return callback({ success: false, message: 'Geçersiz işlem!' });
        }

        const player = room.players.get(socket.userId);
        if (!player || player.answered) {
            return callback({ success: false, message: 'Zaten cevap verdiniz!' });
        }

        const currentQuestion = room.questions[room.currentQuestionIndex];
        const timeElapsed = Date.now() - room.questionStartTime;
        const remainingTime = Math.max(0, room.questionEndTime - Date.now()) / 1000; // Saniyeye çevir
        const isCorrect = data.answer === currentQuestion.correct_answer;

        // Puanı hesapla ama henüz kaydetme
        const score = isCorrect ? Math.ceil(remainingTime * (100 / room.questionTime)) : 0;

        // Oyuncunun cevabını kaydet
        player.answered = true;
        player.lastAnswer = {
            isCorrect,
            score
        };

        callback({ success: true });
    });

    // Sonraki soruya geçme
    socket.on('nextQuestion', (data, callback) => {
        const room = activeRooms.get(data.roomCode);
        if (!room || !room.started) {
            return callback({ success: false, message: 'Geçersiz işlem!' });
        }

        if (socket.userId !== room.adminId) {
            return callback({ success: false, message: 'Bu işlem için yetkiniz yok!' });
        }

        if (!room.waitingForNext) {
            return callback({ success: false, message: 'Henüz soru süresi dolmadı!' });
        }

        sendNextQuestion(data.roomCode);
        callback({ success: true });
    });

    // Odadan çıkma
    socket.on('leaveRoom', (data) => {
        const room = activeRooms.get(data.roomCode);
        if (room && socket.userId) {
            // Oyuncuyu odadan sil
            room.players.delete(socket.userId);
            
            // Socket'i odadan çıkar
            socket.leave(data.roomCode);
            
            // Diğer oyunculara güncel listeyi gönder
            io.to(data.roomCode).emit('updatePlayers', Array.from(room.players.values()));
            io.to(data.roomCode).emit('updateScores', Array.from(room.players.values()));

            // Eğer admin çıktıysa ve başka oyuncu varsa, yeni admin ata
            if (socket.userId === room.adminId && room.players.size > 0) {
                const newAdmin = room.players.values().next().value;
                room.adminId = newAdmin.id;
                newAdmin.isAdmin = true;
                io.to(data.roomCode).emit('updatePlayers', Array.from(room.players.values()));
            }

            // Eğer odada kimse kalmadıysa odayı sil
            if (room.players.size === 0) {
                activeRooms.delete(data.roomCode);
            }

            // Socket bilgilerini temizle
            socket.userId = null;
            socket.roomCode = null;
        }
    });

    // Kullanıcıyı oyundan at
    socket.on('kickPlayer', (data) => {
        const room = activeRooms.get(data.roomCode);
        if (!room) return;

        // Admin kontrolü
        if (socket.userId !== room.adminId) {
            socket.emit('error', { message: 'Bu işlem için yetkiniz yok!' });
            return;
        }

        const playerToKick = room.players.get(data.playerId);
        if (!playerToKick) return;

        // Oyuncuyu odadan çıkar
        room.players.delete(data.playerId);
        
        // Atılma bilgisini kaydet
        kickedPlayers.set(data.playerId, {
            roomCode: data.roomCode,
            kickTime: Date.now()
        });
        
        // Oyuncuya bildirim gönder
        io.to(playerToKick.socketId).emit('kicked');
        
        // Diğer oyunculara güncel listeyi gönder
        io.to(data.roomCode).emit('updatePlayers', Array.from(room.players.values()));
        io.to(data.roomCode).emit('updateScores', Array.from(room.players.values()));
    });

    // Oyun bittiğinde odayı kapat
    function closeRoom(roomCode) {
        const room = activeRooms.get(roomCode);
        if (room) {
            // Tüm oyuncuları odadan çıkar
            room.players.forEach((player, userId) => {
                const playerSocket = io.sockets.sockets.get(player.socketId);
                if (playerSocket) {
                    playerSocket.leave(roomCode);
                }
            });

            // Odayı sil
            activeRooms.delete(roomCode);
        }
    }

    // Oyun bittiğinde odayı kapat
    socket.on('gameEnd', (data) => {
        closeRoom(data.roomCode);
    });

    // Chat mesajı gönderme
    socket.on('chatMessage', (data, callback) => {
        const room = activeRooms.get(data.roomCode);
        if (!room) {
            return callback({ success: false, message: 'Oda bulunamadı!' });
        }

        const player = room.players.get(socket.userId);
        if (!player) {
            return callback({ success: false, message: 'Oyuncu bulunamadı!' });
        }

        // Susturulmuş kullanıcı kontrolü
        if (player.isMuted) {
            return callback({ success: false, message: 'Susturulduğunuz için mesaj gönderemezsiniz!' });
        }

        // Mesajı odadaki herkese ilet
        io.to(data.roomCode).emit('chatMessage', {
            message: data.message,
            username: player.username,
            userId: socket.userId,
            isAdmin: player.isAdmin
        });

        callback({ success: true });
    });

    // Kullanıcıyı susturma/susturmayı kaldırma
    socket.on('toggleMute', (data, callback) => {
        const room = activeRooms.get(data.roomCode);
        if (!room) {
            return callback({ success: false, message: 'Oda bulunamadı!' });
        }

        const admin = room.players.get(socket.userId);
        if (!admin || !admin.isAdmin) {
            return callback({ success: false, message: 'Bu işlem için yetkiniz yok!' });
        }

        const targetPlayer = room.players.get(data.userId);
        if (!targetPlayer) {
            return callback({ success: false, message: 'Oyuncu bulunamadı!' });
        }

        // Admin kendini susturamaz
        if (data.userId === socket.userId) {
            return callback({ success: false, message: 'Kendinizi susturamazsınız!' });
        }

        // Susturma durumunu değiştir
        targetPlayer.isMuted = !targetPlayer.isMuted;

        // Susturma durumunu odadaki herkese bildir
        io.to(data.roomCode).emit('muteStatusUpdated', {
            userId: data.userId,
            isMuted: targetPlayer.isMuted,
            roomCode: data.roomCode
        });

        // Sistem mesajı gönder
        io.to(data.roomCode).emit('chatMessage', {
            message: `${targetPlayer.username} ${targetPlayer.isMuted ? 'susturuldu' : 'susturulması kaldırıldı'}.`,
            isSystem: true
        });

        callback({ success: true });
    });

    // Chat temizleme
    socket.on('clearChat', (data) => {
        const room = activeRooms.get(data.roomCode);
        if (!room) return;

        const admin = room.players.get(socket.userId);
        if (!admin || !admin.isAdmin) return;

        // Tüm odaya chat temizleme sinyali gönder
        io.to(data.roomCode).emit('chatCleared');
        
        // Sistem mesajı gönder
        io.to(data.roomCode).emit('chatMessage', {
            message: `${admin.username} sohbeti temizledi.`,
            isSystem: true
        });
    });

    // Şifre değiştirme
    socket.on('changePassword', async (data, callback) => {
        try {
            const { token, currentPassword, newPassword } = data;
            
            // Token doğrulama
            const user = await verifyToken(token);
            if (!user) {
                return callback({ success: false, message: 'Oturum geçersiz!' });
            }
            
            // Kullanıcının mevcut şifresini veritabanından al
            const [users] = await pool.execute(
                'SELECT password FROM users WHERE id = ?',
                [user.id]
            );
            
            if (users.length === 0) {
                return callback({ success: false, message: 'Kullanıcı bulunamadı!' });
            }
            
            // Mevcut şifre kontrolü
            const validPassword = await bcrypt.compare(currentPassword, users[0].password);
            if (!validPassword) {
                return callback({ success: false, message: 'Mevcut şifreniz yanlış!' });
            }
            
            // Yeni şifreyi hashle
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            
            // Şifreyi güncelle
            await pool.execute(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedNewPassword, user.id]
            );
            
            callback({ success: true, message: 'Şifreniz başarıyla değiştirildi.' });
        } catch (error) {
            console.error('Şifre değiştirme hatası:', error);
            callback({ success: false, message: 'Şifre değiştirilirken bir hata oluştu.' });
        }
    });

    socket.on('disconnect', () => {
        console.log('Kullanıcı ayrıldı');
    });
});

// Sonraki soruyu gönderme fonksiyonu
function sendNextQuestion(roomCode) {
    const room = activeRooms.get(roomCode);
    if (!room || !room.started) return;

    room.currentQuestionIndex++;
    room.waitingForNext = false;

    // Oyun bitti mi kontrol et
    if (room.currentQuestionIndex >= room.questions.length) {
        room.started = false;
        io.to(roomCode).emit('gameEnd', {
            scores: Array.from(room.players.values()),
            winner: Array.from(room.players.values()).reduce((prev, current) => 
                (prev.score > current.score) ? prev : current
            )
        });
        return;
    }

    const question = room.questions[room.currentQuestionIndex];
    
    // Geri sayım için 4 saniye (3,2,1,BAŞLA!)
    const countdownTime = 4000;
    
    // Soruyu gönder
    io.to(roomCode).emit('showQuestion', {
        number: room.currentQuestionIndex + 1,
        total: room.questions.length,
        question_text: question.question_text || question.text,
        options: {
            A: question.option_a,
            B: question.option_b,
            C: question.option_c,
            D: question.option_d
        },
        time: room.questionTime
    });

    // Geri sayımdan sonra süreyi başlat
    setTimeout(() => {
        room.questionStartTime = Date.now();
        room.questionEndTime = Date.now() + (room.questionTime * 1000);

        // Süre sonunda bekleme moduna geç
        setTimeout(() => {
            if (room.started && room.currentQuestionIndex < room.questions.length) {
                handleQuestionTimeout(roomCode);
            }
        }, room.questionTime * 1000);
    }, countdownTime);

    // Oyuncuların cevap durumunu sıfırla
    room.players.forEach(player => {
        player.answered = false;
    });
}

// Kategorileri getir
app.get('/api/categories', async (req, res) => {
    try {
        const [categories] = await pool.execute('SELECT * FROM categories WHERE status = "active" ORDER BY name');
        res.json({
            success: true,
            categories: categories
        });
    } catch (error) {
        console.error('Kategori getirme hatası:', error);
        res.status(500).json({
            success: false,
            message: 'Kategoriler alınırken bir hata oluştu.'
        });
    }
});

// Oyun sayfasına yönlendirme
app.get('/game', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'game.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server ${PORT} portunda çalışıyor`);
}); 