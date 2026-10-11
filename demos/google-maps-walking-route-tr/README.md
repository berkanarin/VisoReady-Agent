# Google Haritalar’da üç duraklı yürüyüş rotası

VisoReady Agent ile gerçek Türkçe Google Haritalar arayüzünden hazırlanmış yedi ekranlık etkileşimli kullanım kılavuzu.

**Kolezyum → Panteon → Trevi Çeşmesi, Roma.** Kaynak ekranlar, açıklama başlıkları ve oynatıcı kontrolleri Türkçedir. Sokak ve işletme adları haritada özgün biçimleriyle kalır.

## Demoyu açın

- [index.html](index.html) dosyasını bilgisayarınıza indirin ve tarayıcıda açın. Tek dosyadır; oynatmak için internet veya kurulum gerekmez.
- [project.ohig.json](project.ohig.json) dosyasını VisoReady’de **Proje → Proje aç** ile içe aktarın. Görselleri, açıklamaları ve etkileşimleri düzenleyebilirsiniz.
- [review.html](review.html) ekranları, işaretli alanları ve açıklamaları birlikte gözden geçirmek içindir.

İşaretli alana tıklayarak veya **Sonraki** düğmesiyle ilerleyin. Metin girişinin sonucu ekranlarla gösterilir; bir yazma alıştırması değildir. GitHub’ın dosya görüntüleyicisi HTML’yi oynatmaz; dosyayı indirerek açın.

## Anlatılan akış

1. Kolezyum’u başlangıç noktası yapma.
2. Yürüyüş yol tarifini seçme.
3. İlk varış noktası olarak Panteon’u belirleme.
4. Yeni bir durak ekleme.
5. Trevi Çeşmesi’ni rotaya ekleme.
6. Üç duraklı rotayı inceleme.
7. Ayrıntılı yol tarifini açıp paylaşma kontrolünü bulma.

Bu, ekran görüntülerine dayanan bir kılavuzdur; canlı Google Haritalar oturumu değildir. Hesabınıza rota kaydetmez veya başka birine göndermez. Gerçek yolculuk için güncel Google Haritalar rotasını kontrol edin.

## Yeniden üretme

Paket klasöründen, kurulum tamamlandıktan sonra:

```powershell
pnpm exec tsx examples/google-maps-walking-route-tr.ts output/maps-tr-yeni
```

Yeni bir çıktı klasörü kullanın. Script, oturum açılmamış Türkçe Chromium ile gerçek ekranları yakalar; çerez ekranı çıkarsa isteğe bağlı çerezleri reddeder. Yalnız bu oturumun çerez durumu çıktıdaki özel `.auth/` klasöründe tutulur ve demo paketine alınmaz. Beklenmeyen oturum açma veya doğrulama ekranlarında işleme devam etmeyin. Google arayüzünü değiştirirse tarifin hedefleri yeniden kontrol edilmelidir.

[recipe.json](recipe.json) bu yakalamanın tarifidir. [captures/manifest.json](captures/manifest.json) kaynak URL’lerini, yakalama zamanlarını, alan koordinatlarını ve özgün görsellerin SHA-256 değerlerini içerir. Görsel baytları değiştirilmemiştir.

## Kontroller

Masaüstü ve mobilde 14/14 açıklama durumu denetlendi; otomatik kalite hatası yok. Türkçe açıklama başlıkları, altı ekran geçişi, geri/ileri gezinme, bitirme ve yeniden başlatma ayrıca kontrol edildi. Ayrıntılar: [QA.md](QA.md).

Demo masaüstü için hazırlanmıştır. Telefonda tam harita ve tıklama alanları küçük görünür; **Sonraki** düğmesini kullanabilirsiniz. Ayrı bir mobil Google Haritalar yakalaması içermez.

Google Haritalar görselleri üçüncü taraf içeriğidir; projenin MIT lisansına dahil değildir. [ATTRIBUTION.md](ATTRIBUTION.md).
