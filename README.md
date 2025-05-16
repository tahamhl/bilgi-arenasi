# Bilgi Arenası

Bilgi Arenası, gerçek zamanlı çok oyunculu bir bilgi yarışması uygulamasıdır. Node.js ve Socket.IO kullanılarak geliştirilmiştir.

## 👥 Geliştiriciler

Bu proje aşağıdaki geliştiriciler tarafından ortaklaşa geliştirilmiştir:

- [İsim Soyisim 1](https://github.com/kullanici1) - Frontend Geliştirici
- [İsim Soyisim 2](https://github.com/kullanici2) - Backend Geliştirici

## 🚀 Özellikler

- Gerçek zamanlı çok oyunculu oyun
- Özel oda sistemi
- Kategori bazlı sorular
- Özel soru ekleme
- Canlı skor tablosu
- Admin kontrolleri
- Sohbet sistemi

## 🛠️ Teknolojiler

- Node.js
- Socket.IO
- MySQL
- HTML5
- TailwindCSS
- JavaScript

## ⚙️ Kurulum

1. Repoyu klonlayın:
```bash
git clone https://github.com/kullanici/bilgi-arenasi.git
```

2. Bağımlılıkları yükleyin:
```bash
cd bilgi-arenasi
npm install
```

3. MySQL veritabanını oluşturun:
```bash
mysql -u root < database.sql
```

4. `.env` dosyasını oluşturun:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=bilgi_arenasi
```

5. Uygulamayı başlatın:
```bash
node server.js
```

## 🤝 Katkıda Bulunma

1. Bu repoyu forklayın
2. Yeni bir branch oluşturun (`git checkout -b feature/yeniOzellik`)
3. Değişikliklerinizi commit edin (`git commit -am 'Yeni özellik: Açıklama'`)
4. Branch'inizi push edin (`git push origin feature/yeniOzellik`)
5. Pull Request oluşturun



## 📄 Lisans

Bu proje [MIT](LICENSE) lisansı altında lisanslanmıştır. 
