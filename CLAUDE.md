# Pyngoo (Canlı Görüntülü ve Sesli Rastgele Sohbet) - Claude Geliştirici Kılavuzu & Proje Hafızası

Bu dosya Claude için hazırlanmış **resmi proje hafızası ve davranış kurallarıdır**. Projede yapılacak her geliştirmede, hata düzeltmesinde ve refactoring işleminde aşağıdaki kurallara harfiyen uyulmalıdır.

---

## 1. 🌍 Zorunlu 10 Dil Kuralı (Mandatory Multilingual Rule)
- Kullanıcı arayüzünde görünen hiçbir metin (buton, başlık, uyarı, modal vb.) ASLA tek bir dilde eklenemez veya değiştirilemez!
- Eklenen her yeni metin anahtar-değer çifti olarak `src/utils/i18n.ts` içinde **10 DESTEKLENEN DİLİN TAMAMINDA** eklenmelidir:
  1. 🇹🇷 Türkçe (`tr`)
  2. 🇬🇧 İngilizce (`en`)
  3. 🇩🇪 Almanca (`de`)
  4. 🇫🇷 Fransızca (`fr`)
  5. 🇪🇸 İspanyolca (`es`)
  6. 🇷🇺 Rusça (`ru`)
  7. 🇸🇦 Arapça (`ar`)
  8. 🇦🇿 Azerbaycanca (`az`)
  9. 🇮🇹 İtalyanca (`it`)
  10. 🇧🇷 Portekizce (`pt`)
- Bileşenlerde metinler daima `const { t } = useTranslation();` üzerinden `t('key')` ile çağrılmalıdır.

---

## 2. 🔐 Katı Oturum & Kimlik Doğrulama Güvenliği (Strict Auth Security)
- **Süper Admin ("omer") Kilitlenme Sigortası:**
  - Sabit UID'ler: `d6afbbb7-9a25-4552-a913-e80a1bae7e2b` ve `22b3c0e7-e1e2-4cb5-9532-990066b5a80c`, e-postalar: `omersahin1623@hotmail.com` ve `cosmicdreamersleep@gmail.com`.
  - Bu hesap için profili olmasa dahi oturum kapatılamaz, otomatik olarak admin rolü ve `omer` kullanıcı adı verilir. Bu bir hata değil, sahibin erişimini kaybetmemesi için bilinçli sigortadır.
- **Kabuk Hesap (Shell Account) ve Çakışma Koruması:**
  - Kullanıcı `profiles` tablosunda kaydı yoksa 'Giriş Yap' üzerinden otomatik geçici profil açılamaz; kullanıcı `not_found=1` ile 'Kayıt Ol' sekmesine yönlendirilir.
  - Zaten profili olan kullanıcı 'Kayıt Ol' sekmesinden tekrar girmeye çalışırsa `email_taken=1` uyarısıyla 'Giriş Yap' sekmesine aktarılır.
- **OAuth Hash & Token Koruması:**
  - Google/Apple dönüşünde URL `#access_token=...` hash'i asla erkenden temizlenemez. Önce `setSession` denenir, ağ/SDK gecikmesinde UTF-8 JWT fallback'i ile oturum anında kurulup kullanıcı ana sayfaya alınır.
- **Single Session (Tek Oturum):**
  - Cihaz çakışması kontrolü modül seviyesindeki sahiplik zaman damgasıyla korunur.

---

## 3. ⚡ Supabase Nano Katman Koruma Kuralı (Bağlantı Havuzu Limiti: 15)
- Proje Supabase Nano katmanındadır. Maksimum bağlantı havuzu 15'tir.
- **PERİYODİK POLLING YASAĞI:** Sürekli `setInterval` ile Supabase'den oturum / profil sorgulayan döngüler ASLA eklenemez (PostgREST 520 aşırı yük hatasına yol açar).
- Silinme / ban / durum kontrolleri YALNIZCA **realtime `postgres_changes`** ve sekme odaklanma (`focus` / `visibilitychange`) olayları üzerinden yapılmalıdır.

---

## 4. 📱 Mobil (iOS / Android) & AdMob Reklam Entegrasyonu
- Uygulama web ile birlikte Capacitor 8 altyapısıyla iOS ve Android'e derlenmektedir.
- **AdMob Ödüllü Reklam Birimi:** `ca-app-pub-6163702675031285/4424784328` ([admobService.ts](file:///c:/Users/PC/.gemini/antigravity/scratch/anonymous-voice-chat/src/utils/admobService.ts))
- **GADApplicationIdentifier:** `ca-app-pub-6163702675031285~1338244734` ([Info.plist](file:///c:/Users/PC/.gemini/antigravity/scratch/anonymous-voice-chat/ios/App/App/Info.plist))
- App Store incelemesindeyken akıllı test reklamı fallback'i devrededir; canlı reklam açılana kadar test reklamı üzerinden ödül (+20 altın) akışı korunur.

---

## 5. 🚀 Derleme ve Canlı Yayın Disiplini
- **Kullanıcı Onayı:** Kullanıcı açıkça *"yayınla"* veya *"pushla"* demeden ASLA masaüstü yayını veya git push yapılmaz.
- **Derleme:** `npm run build`
- **Bundle Doğrulama (Beyaz Ekran Koruması):**
  - `dist/assets/index-*.js` içinde Supabase URL'inin (`https://rdqcwzosmikusketghyq.supabase.co`) var olduğu ve gizli anahtar sızıntısı olmadığı kontrol edilmelidir.
- **PowerShell BOM Tuzağı:** Windows'ta `.env` dosyası düzenlenirken asla UTF-8 BOM (`EF BB BF`) eklenmemelidir. Aksi takdirde Vite URL'i okuyamaz ve site beyaz ekranda kalır.
- **iOS Eşitleme:** `npx cap copy ios`
- **Masaüstü Canlı Yayını:**
  - `C:\Users\PC\Desktop\Pyngoo_Site` klasörü önce tamamen temizlenmeli, ardından `dist/*` buraya kopyalanmalıdır.
