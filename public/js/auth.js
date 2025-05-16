const socket = io();

// Form geçişleri için fonksiyon
function toggleForms() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    loginForm.classList.toggle('hidden');
    registerForm.classList.toggle('hidden');
}

// Giriş işlemi
async function login() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        alert('Lütfen tüm alanları doldurun!');
        return;
    }

    socket.emit('login', { email, password }, (response) => {
        if (response.success) {
            localStorage.setItem('token', response.token);
            localStorage.setItem('user', JSON.stringify(response.user));
            window.location.href = '/game.html';
        } else {
            alert(response.message || 'Giriş başarısız!');
        }
    });
}

// Kayıt işlemi
async function register() {
    const username = document.getElementById('register-username').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;

    if (!username || !email || !password) {
        alert('Lütfen tüm alanları doldurun!');
        return;
    }

    socket.emit('register', { username, email, password }, (response) => {
        if (response.success) {
            alert('Kayıt başarılı! Şimdi giriş yapabilirsiniz.');
            toggleForms();
        } else {
            alert(response.message || 'Kayıt başarısız!');
        }
    });
}

// Sayfa yüklendiğinde token kontrolü
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token) {
        socket.emit('verifyToken', { token }, (response) => {
            if (response.success) {
                window.location.href = '/game.html';
            } else {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        });
    }
}); 