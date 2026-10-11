# Türkçe demo kontrol raporu

Yakalama: 9 Ekim 2026. Kaynak: canlı Google Haritalar; oturum açılmamış Chromium, Türkçe arayüz, 1440 × 900.

- Yedi özgün ekran görüntüsü; Türkçe kontroller, harita döşemeleri, görünür Google atıfları ve kişisel hesap bilgisi bulunmaması açısından gözle incelendi.
- Manifest doğrulandı; görsel hash değerleri, alan sınırları ve ekran bağlantıları kontrol edildi. VisoReady projesi oluşturuldu ve gerçek editöre içe aktarıldı.
- Özgün görsel baytları, açıklama koordinatları, başlıklar ve ekran bağlantıları editör normalizasyonundan sonra korundu.
- Çevrimdışı oynatıcı 1440 × 900 ve 390 × 900 boyutlarında çalıştırıldı; 14/14 açıklama durumu ziyaret edildi. Otomatik kalite hatası: 0.
- Türkçe başlık ve açıklama eşleşmeleri, altı işaretli ekran geçişi, son ekrandan geri/ileri gezinme, Bitir ve Tura Yeniden Başla davranışları iki genişlikte kontrol edildi.
- İki genişlikte yatay taşma olmadığı ve Sonraki/Bitir yazılarının tek satır kaldığı kontrol edildi. Mobil navigasyon simgeleri erişilebilir adlarını korur.
- Proje paketinde `pnpm lint` ve `pnpm typecheck` geçti.

Kanıtlar: [verified/check.json](verified/check.json), [verified/navigation-check.json](verified/navigation-check.json), [verified/quality.json](verified/quality.json), [verified/QUALITY.md](verified/QUALITY.md).

## Kalan sınırlar

Kalite durumu `needs-review`: yedi küçük mobil hedef ve yedi küçültülmüş harita uyarısı olmak üzere 14 uyarı kaldı. Mobilde açıklama okunabilir olsa da haritadaki yazılar küçüktür. Masaüstü kullanım önerilir; mobilde Sonraki kontrolü alternatif gezinme sağlar.

Kaynak uygulamadaki paylaşma düğmesi anlatılmıştır; düğmeye basılıp rota gönderilmemiştir. Rota hesapta saklanmamıştır. Sürükleyerek durak sıralama anlatılmaz.

Geri gezinmenin tüm olası dizileri, OCR ile görsel metin denetimi veya güncel seyahat koşulları doğrulanmış değildir. Haritadaki normal Google araç ipuçları ve yer adları özgün ekranlarda kalır. Özgün yakalama dosyaları yeniden boyutlandırılmamış veya yeniden çizilmemiştir.
