# R10 Bildirim Asistanı

![R10 Bildirim Asistanı](images/icon128.png)

R10.net platformundaki bildirimlerinizi, özel mesajlarınızı ve arkadaşlık isteklerinizi gerçek zamanlı takip etmenizi sağlayan Chrome uzantısı.

## ✨ Özellikler

- 🔔 Gerçek zamanlı bildirim takibi
- 📧 Özel mesaj bildirimleri
- 👥 Arkadaşlık istekleri kontrolü
- 🔄 Otomatik yenileme (20 saniyede bir)
- 🌗 Aydınlık/Karanlık tema desteği
- 📊 Bildirim istatistikleri
- 🔒 Güvenli token yönetimi
- 🚫 Cloudflare koruma sistemi

## 🚀 Kurulum

1. Chrome'da `chrome://extensions/` adresine gidin
2. Sağ üst köşeden "Geliştirici modu"nu aktif edin
3. "Paketlenmemiş öğe yükle" butonuna tıklayın
4. İndirdiğiniz klasörü seçin

## 💡 Kullanım

- Eklenti simgesine tıklayarak tüm bildirimleri görüntüleyin
- Badge üzerinden okunmamış bildirimleri takip edin
- Masaüstü bildirimleriyle anında haberdar olun
- Tek tıkla ilgili sayfaya yönlenin

## ⚙️ Teknik Detaylar

### Bildirim Kontrol Aralıkları
```javascript
const CHECK_INTERVAL_SECONDS = 20    // Bildirim kontrolü
const TOKEN_REFRESH_MINUTES = 1      // Token yenileme
```

### Özelleştirme Seçenekleri
- `background.js` içinden kontrol aralıklarını değiştirebilirsiniz
- `popup.html` üzerinden arayüz özelleştirmesi yapabilirsiniz
- `manifest.json` dosyasından izinleri yönetebilirsiniz

## 🐛 Bilinen Sorunlar ve Çözümleri

### 1. XML Parsing Sorunu
**Sorun:** Background service worker'da DOMParser kullanılamıyor.  
**Çözüm:** Özel regex tabanlı XML parser implementasyonu.

### 2. Cloudflare Koruması
**Sorun:** Otomatik isteklerde Error 1005 hatası.  
**Çözüm:**
- Custom User-Agent kullanımı
- Rate limiting implementasyonu
- Hata durumunda otomatik bekleme sistemi

### 3. Türkçe Karakter Encoding
**Sorun:** Windows-1254 ile UTF-8 arasındaki uyumsuzluk.  
**Çözüm:** TextDecoder ile özel encoding dönüşümü.

## 🔒 Güvenlik

- Minimum izin kullanımı
- Hassas veri şifreleme
- Güvenli token yönetimi
- Cloudflare bypass koruması

## 🤝 Katkıda Bulunma

1. Fork'layın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit'leyin (`git commit -m 'feat: Add amazing feature'`)
4. Branch'e push yapın (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📝 Lisans

MIT License - Detaylar için [LICENSE](LICENSE) dosyasına bakın.

## 📫 İletişim

- GitHub: [yusuf-polat](https://github.com/yusuf-polat)
- Twitter: [@theYusufPolat](https://twitter.com/theYusufPolat)

---
⭐️ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!
