# R10.net Bildirim Chrome Eklentisi

Bu Chrome eklentisi, R10.net sitesindeki bildirimleri tarayıcı üzerinden takip etmenizi sağlar.

## Bilinen Sorunlar ve Çözümleri

### 1. DOMParser Hatası

**Sorun:** Background script'te DOMParser kullanılamaz çünkü Service Worker'larda DOM API'leri mevcut değildir.

**Çözüm:** XML parsing işlemi için regex tabanlı bir çözüm uygulandı.

### 2. Cloudflare Erişim Engeli

**Sorun:** R10.net, bazı IP adreslerinden gelen otomatik istekleri engelleyebilir (Error 1005).

**Çözüm:**
- User-Agent header'ı eklendi
- Engelleme tespit edildiğinde, bir süre (1 saat) bekleme mekanizması eklendi
- Engelleme durumunda kullanıcıya bilgi verilmesi sağlandı

### 3. Mesaj İletişim Hatası

**Sorun:** Popup ve background script arasındaki iletişimde sorun yaşanıyor.

**Çözüm:** Message listener düzgün şekilde yapılandırıldı ve asenkron yanıt için `return true` eklendi.

## Kurulum

1. Chrome'da `chrome://extensions/` adresine gidin
2. "Geliştirici modu"nu açın
3. "Paketlenmemiş öğe yükle" butonuna tıklayın
4. Bu klasörü seçin

## Kullanım

- Eklenti simgesine tıklayarak bildirimleri görüntüleyebilirsiniz
- Bildirimler otomatik olarak her 5 dakikada bir kontrol edilir
- Yeni bildirim geldiğinde tarayıcı bildirimi gösterilir

## Özelleştirme

- `background.js` dosyasındaki `CHECK_INTERVAL_MINUTES` değişkenini değiştirerek bildirim kontrol sıklığını ayarlayabilirsiniz
