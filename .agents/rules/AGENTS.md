# Pyngoo Project Development Rules & Guidelines

## 1. 🌍 Mandatory Multilingual Rule (Tüm Dillerde Güncelleme Kuralı)
- **STRICT MANDATE:** Kullanıcıya görünen hiçbir metin (başlık, alt başlık, buton, form etiketi, placeholder, hata mesajı, modal pencere, uyarı) ASLA sadece tek dilde eklenemez veya değiştirilemez!
- Herhangi bir metin değişikliği yapıldığında istisnasız **10 DESTEKLENEN DİLİN TAMAMINDA** `src/utils/i18n.ts` dosyasına eklenmeli ve çevrilmelidir:
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
- Bileşenlerde (`Login.tsx`, `LandingPage.tsx`, vb.) asla sabit Türkçe veya İngilizce metin bırakılmamalı; her zaman `useTranslation()` üzerinden `t('key')` ile çağrılmalıdır.

## 2. 📹 Platform Tanımı ve Kimliği
- Pyngoo; **"Canlı Görüntülü ve Sesli Rastgele Sohbet"** platformudur.
- Kayıt alt başlığı kalıcı olarak: **"Yeni insanlarla canlı sohbete hemen katılın"** ve tüm dillerdeki karşılıklarıdır.
- Platform asla "sadece sesli" ("sesli sohbet") olarak sınırlandırılmamalıdır.

## 3. 🛡️ Zorunlu Kadın AI Yüz Doğrulaması
- Kadın profilleri için kayıt sırasında yapay zekâ yüz doğrulama katı ve tavizsiz şekilde zorunludur. Sahte profilleri ve erkeklerin kadın taklidi yapmasını engeller.

## 4. 🚀 Otomatik Derleme ve Masaüstü Yayını
- Kodlarda yapılan her değişiklikten sonra:
  1. `npm run build` çalıştırılarak TypeScript ve derleme doğrulanmalıdır.
  2. `dist\*` içeriği masaüstündeki `C:\Users\PC\Desktop\Pyngoo_Site` klasörüne kopyalanarak canlıya alınmalıdır.

## 5. 🔐 Kesin ve Değiştirilemez Oturum & Giriş Kuralları (Strict Auth & Registration Security)
- **KAYIT OL MODUNDA ZORUNLU ALAN KONTROLÜ:** Kullanıcı "Kayıt Ol" sekmesindeyken Kullanıcı Adı (min 3 karakter), Cinsiyet seçimi ve Sözleşme onayı yapılmadan HİÇBİR ŞEKİLDE Google/Apple OAuth veya E-posta kaydı başlatılamaz! `handleOAuthLogin` kesinlikle `checkPreconditionsAndRun` üzerinden ön koşulları doğrulamalıdır.
- **ZATEN KAYITLI PROFİL KORUMASI:** Eğer kullanıcının veritabanında zaten aktif bir profili varsa, "Kayıt Ol" sekmesinden farklı bir isim yazıp girmeye çalıştığında sistem eski profiline ASLA otomatik sokmaz. Oturumu derhal kapatır (`supabase.auth.signOut()`), `email_taken=1&name=@MevcutIsim` uyarısıyla "Giriş Yap" sekmesine yönlendirir.
- **YENİ PROFİL KAYDINDA DÖNGÜ ENGELİ:** İlk kez kaydolan sıfır kullanıcıların profili oluşturulduğunda `pyngoo_just_created_profile_${uid}` bayrağı set edilmeli, `onAuthStateChange` ikinci tetiklemesinde yeni üyenin oturumu kapatılmamalıdır.
- **KADIN & ERKEK ÇİFT KATMANLI VAR OLAN E-POSTA KORUMASI:** E-posta adresi veritabanında zaten kayıtlı olan bir kullanıcı "Kayıt Ol" sekmesinden e-posta veya OAuth ile girmeye çalıştığında, sistem (kadın kullanıcıda AI Yüz Taramasını bile BAŞLATMADAN ÖNCE) `check_email_exists` RPC ile e-postayı kontrol eder. Zaten kayıtlı hesap tespit edildiği an yüz taraması açılmaz, Supabase profili ASLA üstüne yazılmaz; derhal `"Bu hesap ile zaten kayıtlı bir profiliniz bulunmaktadır! (@Mevcutİsim)"` uyarısı verilerek kullanıcı "Giriş Yap" sekmesine aktarılır.
  - **ZORUNLU KAPSAM:** `check_email_exists` kontrolü sadece e-posta/şifre formunda değil, **OAuth (Google/Apple) ile yeni profil oluşturulmadan hemen önce de** (`App.tsx` `handleSession` içinde profil upsert edilmeden önce, `activeAuthUser.email` ile) çalıştırılmalıdır. Aynı e-postanın farklı bir `auth.users` UID'i altında tekrar profil açması bu kontrol olmadan asla engellenemez.
- **GOOGLE AD SOYAD (FULL_NAME) DEĞİŞTİRME ENGELİ:** Google/Apple OAuth entegrasyonlarında Google metadata içerisinden gelen gerçek Ad Soyad (`full_name` / `name`) verisi ASLA Pyngoo `display_name` (rumuz) yerine geçirilemez. Hem `public.profiles` tablosunda hem de Supabase `auth.users` dahili tablosundaki `full_name`, `name`, `display_name` ve `user_name` alanlarının tamamına KESİNLİKLE kullanıcının Pyngoo rumuzu mühürlenir. Var olan profillerin kullanıcı adı asla ezilemez.
- **GOOGLE OAUTH İLE GİRİŞ KORUMASI:** Zaten veritabanında aktif profili (`profiles` tablosunda kaydı) olan bir kullanıcı 'Giriş Yap' sekmesinden Google/Apple OAuth ile bağlandığında sistem ASLA oturumunu kapatamaz (`signOut`) ve ASLA `not_found=1` / "Seni Aramızda Göremedik" uyarısını tetikleyemez. Kullanıcı doğrudan var olan Pyngoo profiline sorunsuz bir şekilde giriş yapmalıdır.
- **GİRİŞ YAP SEKMESİNDEN HESAPSIZ KULLANICI KORUMASI (OTOMATİK PROFİL AÇMA YASAĞI):** Bir kullanıcının veritabanında (`profiles` tablosunda) aktif profili YOKSA ve bu kullanıcı 'Giriş Yap' sekmesinden Google/Apple OAuth veya e-posta ile bağlanmaya çalışırsa, sistem ASLA otomatik `Kullanıcı_XXXX` gibi geçici veya rastgele bir profil oluşturamaz, profili veritabanına kaydedemez ve kullanıcıyı doğrudan içeri alamaz! Sistem OAuth dönüşünde oluşturulan geçici `auth.users` kaydını derhal silmeli (`delete_user_account`), oturumu kapatmalı (`supabase.auth.signOut()`) ve kullanıcıyı `not_found=1` parametresiyle doğrudan 'Kayıt Ol' sekmesine yönlendirerek `"Seni Aramızda Göremedik 🥺 Seni aramızda görmek için lütfen üye ol! 🥰"` uyarısıyla karşılamalıdır. Kullanıcı Kullanıcı Adı (min 3 karakter), Cinsiyet, Kadın ise AI Yüz Doğrulaması ve Sözleşme onayını yapmadan ASLA platforma dahil edilemez!
- **OAUTH HASH DÖNÜŞÜ VE TOKEN GÜVENLİĞİ KORUMASI (ACCESS_TOKEN İMHASI YASAĞI):** Google veya Apple OAuth dönüşünde URL hash fragment'ında gelen `#access_token=...` parametresi ASLA hata temizliği mekanizmalarına (`error=`, `bad_oauth_state`) dahil edilerek yok edilemez veya `history.replaceState` ile erkenden uçurulamaz! Sayfa açılışında hash içerisinde `access_token` varsa derhal `supabase.auth.setSession` ile oturum kurulmalı, oturum oluşana kadar `showAuth` (Login modalı) kapalı tutulmalıdır. Ayrıca yeni giriş yapan kullanıcının cihazı `claimAndBroadcastSession` ile sunucuya kaydedilmeden önce Tek Oturum (Single Session) kontrolü tarafından eski `active_device_id` uyuşmazlığı gerekçesiyle ASLA oturumu kapatılamaz! Sahiplik zaman damgası modül seviyesinde (`moduleLastSessionClaimedAt`) korunmalı, re-render ile sıfırlanması engellenmelidir.
- **OAUTH DOĞRUDAN JWT ÇÖZÜMLEME VE LANDING PAGE / SPINNER TAKILMASI ENGELİ (BULLETPROOF JWT FALLBACK):**
  1. Google veya Apple OAuth dönüşünde URL hash fragment'ında `#access_token=...` geldiğinde, sistem **önce gerçek `supabase.auth.setSession({access_token, refresh_token})` çağrısını dener** (SDK'nın otomatik token yenileme döngüsünü kurabilmesi için); ancak bu çağrıya sonsuza kadar bağımlı kalınamaz — kısa bir zaman aşımı (`Promise.race`, ~2.5 sn) ile yarıştırılıp `refresh_token` uyuşmazlığı, geçersiz refresh token veya SDK ağ gecikmesi nedeniyle başarısız/zaman aşımına uğrarsa derhal JWT fallback'ine düşülür.
  2. `setSession` başarısız olursa sistem URL hash içindeki `access_token` JWT'sini doğrudan UTF-8 destekli (`parseJwt`) çözmeli, `sub` (kullanıcı UID'si), `email` ve `user_metadata` bilgilerini anında çıkartıp sentetik aktif oturum nesnesini oluşturmalıdır.
  3. Oluşturulan bu oturum hem Supabase yerel deposuna (`sb-${projectRef}-auth-token`) mühürlenmeli hem de doğrudan `handleSession` oturum işleyicisine aktarılmalıdır.
  4. URL'de geçerli `#access_token=...` varken oturum kurulamayıp sistemin kullanıcıyı **Landing Page (`LandingPage.tsx`)** açılış ekranına düşürmesi veya `#access_token` adres çubuğunda asılı kalarak kullanıcının açıkta bırakılması KESİNLİKLE YASAKTIR!
  5. Oturum başarıyla doğrulanıp `userId` ve `userProfile` yüklendikten hemen sonra URL hash'i `window.history.replaceState` ile temizlenmeli ve kullanıcı doğrudan ana uygulamaya (`Home` / `Layout`) aktarılmalıdır.
- **YÜKLEME (LOADING/SPINNER) DURUMU KORUMASI VE ASENKRON CİHAZ MÜHÜRLEME (SONSUZ SPINNER YASAĞI):**
  1. Başarılı bir oturum açıldığında (`session.user` ve `currentProfile` yüklendiğinde) `setLoading(false)` çağrısı KESİNLİKLE ve istisnasız çalıştırılmalıdır! `setLoading(false)` asla sadece oturumsuz (`else`) blok içine hapsedilemez.
  2. Tek oturum için sunucuya yapılan cihaz kimliği güncellemesi (`claimAndBroadcastSession`), ana bileşen yükleme akışını ve render'ı senkron olarak kitlememesi için **her çağrı noktasında** (hem `handleSession` içinde hem `handleAuthSuccess` gibi login-sonrası tetikleyicilerde) arka planda asenkron (`.catch(...)`) yürütülmelidir; hiçbir yerde `await` ile senkron beklenemez.
  3. Uygulama başlatılırken olası ağ gecikmelerinde kullanıcının dönen yükleme ekranında (spinner) sonsuza kadar takılı kalmasını engellemek için maksimum 4 saniyelik emniyet zamanlayıcısı (`safetyTimer`) daima devrede tutulmalı ve `useEffect` temizliğinde sıfırlanmalıdır.
- **HATALI HESAP SİLİNDİ (FALSE DELETION PURGE) VE ASKIYA ALMA KORUMASI:**
  1. `supabase.auth.getUser()` ağ hatası (`authErr`), geçici token yenilemesi, hız sınırı (rate-limit) veya arka plan sekme gecikmeleri ASLA kullanıcının hesabı silinmiş varsayılarak `deleted=1` / "Hesabınız Silinmiştir" uyarısını tetikleyemez ve oturumu kapatamaz!
  2. Periyodik liveness kontrollerinde veya DB sorgularında oluşan ağ hataları (`profErr` veya `!profileData`) asla oturum kapatma sebebi olamaz.
  3. Bir kullanıcının oturumu "Hesabınız Silinmiştir" gerekçesiyle YALNIZCA VE YALNIZCA veritabanından `profiles` tablosunda `role === 'deleted'` yanıtı kesin ve hatasız olarak döndüğünde sonlandırılabilir.
  4. **PROFİL SORGUSU HATA KONTROLÜ ZORUNLUDUR:** `handleSession` içinde ilk profil sorgusu (`supabase.from('profiles').select('*').eq('id', uid)`) yapılırken dönen `error` MUTLAKA destructure edilip kontrol edilmelidir. Sorgu hata döndürürse (`error` doluysa) bir kez tekrar denenmeli; ikinci denemede de hata devam ediyorsa hiçbir hesap silme (`delete_user_account`), oturum kapatma veya `not_found=1`/`deleted=1` yönlendirmesi yapılmadan sadece `setLoading(false)` ile çıkılmalıdır. `data`'nın `null` gelmesi tek başına asla "profil yok" ile eş tutulamaz.
  5. **REALTIME SİLME DİNLEYİCİSİ:** `postgres_changes` üzerinden dinlenen profil silme olayında oturum SADECE `payload.eventType === 'DELETE'` şartında kapatılabilir; `!payload.new` gibi gereğinden geniş ek şartlar (RLS/policy kaynaklı görünmezlik gibi yanlış pozitiflere yol açabileceğinden) kullanılamaz.
- **SÜPER ADMİN HESABI ("omer") — KASITLI SİLİNEMEZLİK KURALI (HATA SANILIP KALDIRILMAZ):**
  1. `App.tsx` ~536'daki `isOmer` kimliği şu üçünden biriyle eşleşir: sabit uid `d6afbbb7-9a25-4552-a913-e80a1bae7e2b`, e-posta `omersahin1623@hotmail.com` veya e-posta `cosmicdreamersleep@gmail.com`.
  2. Bu hesap için normal akış bilinçli olarak atlanır: profili olmasa bile "profil yok -> auth hesabını sil + Kayıt Ol'a yönlendir" dalı ÇALIŞMAZ (`&& !isOmer`); rumuz zorla `omer`, rol `admin`, cinsiyet `erkek` olarak profil (gerekirse) SIFIRDAN oluşturulur; profil mevcutsa aynı değerler `profiles` tablosuna geri yazılır; localStorage/cookie değerleri de zorlanır.
  3. **SONUÇ:** Bu hesap Supabase panelinden (Authentication -> Users) silinse dahi, aynı Google hesabıyla yapılan ilk girişte otomatik olarak yeniden oluşturulur. Bu bir hata DEĞİL, sahibin admin erişimini kaybetmemesi için konulmuş **kilitlenme sigortasıdır**; "gizemli bug" sanılıp koddan ASLA kaldırılmamalıdır.
  4. Aynı sabit uid; `Home.tsx`, `Layout.tsx`, `Market.tsx`, `Profile.tsx`, `ModeratorPanel.tsx` içinde de özel yetki/istisna kontrolü olarak geçer. `ModeratorPanel.tsx` ayrıca "omer" kullanıcı adlı panel girişini kod içinde tanır ve moderatör listesine yoksa elle ekler.
  5. Silme/giriş akışları test edilirken bu hesap DEĞİL, normal bir test hesabı (örn. `pyngooappp@gmail.com`) kullanılır. "Sildim ama geri geliyor" durumu bu hesap için normaldir.
  6. **GÜVENLİK:** Bu e-posta listesi herkese açık bundle'da görünür. Listeye sahibi olunmayan bir adres ASLA eklenemez; o adresle giriş yapabilen kişi otomatik olarak admin olur. Yeni bir e-posta eklenecekse önce sahipliği doğrulanır.

## 6. 🧪 Geçici Test Dosyaları Temizlik Kuralı (Temporary Test File Cleanup)
- Kullanıcı "test et" dediğinde veya doğrulama gerektiğinde oluşturulan geçici test dosyaları (`scratch/*.cjs`, `scratch/*.js` vb.) test tamamlanıp sonuçlar doğrulandıktan sonra DERHAL SİLİNMELİ, projede gereksiz yer kaplaması engellenmelidir.

## 7. 🕳️ Kabuk Hesap (Shell Account) ve "Zaten Kayıtlı <-> Seni Bulamadık" Döngüsü YASAĞI
- **KABUK HESAP TANIMI:** `auth.users` tablosunda satırı OLAN ama `public.profiles` tablosunda satırı OLMAYAN hesaptır. Genellikle yarım kalan/iptal edilen bir OAuth dönüşünden veya Supabase panelinden **yalnızca profil satırının silinmesinden** oluşur. Bu hesap iki ekran arasında kilitlenir: "Kayıt Ol" -> *zaten kayıtlı, Giriş Yap* der; "Giriş Yap" -> profil olmadığı için *Seni Aramızda Göremedik* der. Kullanıcı hangi rumuzu yazarsa yazsın kurtulamaz.
- **`check_email_exists` RPC KURALI (ZORUNLU):** Bu fonksiyon ASLA salt `auth.users` varlığına bakarak `exists = true` DÖNEMEZ. `exists` yalnızca `auth.users` JOIN `public.profiles` üzerinden **aktif profili gerçekten olan** (`role <> 'deleted'` ve `is_banned = false`) hesaplar için `true` olur. Ayrıca fonksiyon **kendi uid'sini** (`auth.uid()`) her koşulda hariç tutmalıdır; kişinin kendi hesabı asla kendine engel olamaz. (Düzeltme SQL'i: `check_email_exists_fix.sql`)
- **KURTARMA AKIŞI ZORUNLULUĞU:** `Login.tsx` `executeEmailAuth` içinde `signUp` "already registered/exists/kayıtlı" hatası döndürürse VEYA `data.user.identities` boş dizi olarak gelirse, sistem kullanıcıyı "Giriş Yap" sekmesine geri göndermekle YETİNEMEZ. Derhal `claimShellAccount()` denenmelidir: aynı e-posta+şifre ile `signInWithPassword` denenir; giriş başarılı olur ve profil yoksa profil sıfırdan oluşturulur (`claimed`), aktif profil varsa ancak o zaman `email_taken` uyarısı gösterilir (`blocked`), şifre tutmazsa eski davranışa düşülür (`failed`).
- **NEDEN ÖNEMLİ:** Bu kural olmadan Supabase panelinden elle yapılan her silme işlemi, o e-postayı platformda kalıcı olarak kullanılamaz hale getirir.

## 8. 🧹 Veritabanı Yetim Kayıt Temizliği (Kalıcı DB Nesneleri - Tek Seferlik Kurulum)
- `orphan_cleanup_hardening.sql` ile kurulan nesneler **kalıcıdır ve tekrar çalıştırılması gerekmez**:
  1. `public.purge_user_data(uuid)` — veritabanını **dinamik keşifle** tarar; `profiles.id` veya `auth.users.id`'ye FK veren TÜM tabloları otomatik bulup kullanıcının satırlarını siler. FK vermemiş ama `user_id` / `sender_id` / `blocked_user_id` gibi kalıplara uyan kolonları da (b) listesiyle yakalar. Yetki koruması vardır: kullanıcı yalnızca kendi hesabını silebilir (moderator / service_role / tetikleyici istisna).
  2. `trg_auth_user_deleted` (AFTER DELETE ON `auth.users`) — Authentication -> Users sekmesinden silinen her kullanıcının TÜM bağlı verisini otomatik temizler.
  3. `trg_profile_deleted_cascade` (AFTER DELETE ON `public.profiles`) — Table Editor'dan direkt profil silinirse aynı tam temizliği yapar.
  4. `fk_profiles_auth_user` (`profiles.id -> auth.users.id ON DELETE CASCADE`) — yetim profil satırının oluşmasını veritabanı seviyesinde fiziksel olarak imkansız kılar.
  5. `delete_user_account()` artık `purge_user_data` çağırır (eski hali yalnızca 5 tabloyu siliyordu).
- **YENİ TABLO EKLENEREK KURALI:** Yeni bir tabloya `profiles.id` FK verilirse otomatik kapsama girer, hiçbir şey yapılmaz. FK verilmez VE kolon adı yukarıdaki kalıplara uymazsa `purge_user_data` içindeki (b) listesine kolon adı eklenip dosya bir kez daha çalıştırılır.
- **PANEL SİLME ALIŞKANLIĞI:** Kullanıcı silmek için her zaman **Authentication -> Users**'ı kullanın; profil satırını tek başına silmek kabuk hesap üretir (bkz. 7. madde).

## 9. ⚡ Supabase Yükünü Kontrol Altında Tutma (Nano Katman - Bağlantı Havuzu Koruması)
- Proje **Nano** compute katmanındadır: DB connection pool **15**, max client **200** (sabit, yükseltilemez). Bu limit aşıldığında PostgREST **520** döner; hata -> retry -> daha çok yük şeklinde kendi kendini besler.
- **PERİYODİK POLLING YASAĞI (ZORUNLU):** Bir durum **realtime `postgres_changes` / broadcast aboneliğiyle anlık** yakalanabiliyorsa, AYNI durum için üstüne sabit `setInterval` sorgusu KONAMAZ. Gerçekleşen ihlal buydu: tek açık sekme, üç ayrı polling döngüsünden (`checkOwnership` 20sn, `verifyUserStillExists` 30sn, `checkLiveness` 25sn) ve iki ayrı realtime aboneliğinden aynı "oturumum hâlâ geçerli mi?" işini tekrar tekrar sorguluyordu; gerçek kullanıcı yokken bile yüzlerce istek ve %39 başarı oranı üretiyordu.
- **GÜNCEL DOĞRU MİMARİ:**
  - Silinme / ban tespiti: **yalnızca realtime** (`App.tsx` ve `Layout.tsx` `postgres_changes`) + sekmeye geri dönüldüğünde (`focus` / `visibilitychange`) tek seferlik kontrol.
  - Cihaz çakışması (tek oturum): `App.tsx` `checkOwnership` **20sn** yedek poll + anlık realtime broadcast. Bu tek polling'dir, `Layout.tsx`'teki mükerrer `checkLiveness` interval'i kaldırılmıştır.
  - `streamerHeartbeatTimer` (25sn) yalnızca `isStreamer` iken çalışır, kabul edilebilir.
- **YENİ POLLING EKLEMEDEN ÖNCE:** (1) Bu bilgi realtime ile anlık alınabiliyor mu? (2) Aynı sorguyu yapan başka bir döngü zaten var mı? (3) Sadece `focus`/`visibilitychange` ile çözülebilir mi? Üçü de hayırsa ve gerçekten gerekiyorsa aralığı en az 20sn yap ve gerekçesini koda Türkçe yorum olarak yaz.
- **PARA HARCAMA KURALI:** Compute katmanını yükseltmeden ÖNCE kod tarafındaki gereksiz istek hacmi bitirilir ("para kazanmadan para harcamayalım").

## 10. ✅ Doğrulama ve Yayın Disiplini (Kanıtısız "Düzeldi" YASAĞI)
- **ÜÇ SEVİYE AYRIMI ZORUNLU:** Bir işi raporlarken hangi seviyede doğrulandığı açıkça söylenir:
  1. *Derleme doğrulandı* — `npm run build` temiz geçti. (Kodun derlendiğini kanıtlar, çalıştığını değil.)
  2. *Canlı tarayıcıda doğrulandı* — `www.pyngoo.app` üzerinde browser araçlarıyla gerçekten test edildi.
  3. *Doğrulanamadı* — gerçek kullanıcı trafiği / gerçek Google hesabı / zaman içinde ölçüm gerektirir; açıkça "doğrulayamam" denir.
- **CANLI BUILD HASH KONTROLÜ:** Teste başlamadan önce canlıdaki script hash'i yerel `dist/assets` hash'iyle karşılaştırılır (`document.querySelectorAll('script[src]')`). Eşleşmiyorsa kullanıcı henüz yüklememiştir; eski sürüm üzerinde test yapılıp "çalışıyor" denilemez.
- **GERÇEK GOOGLE OAUTH KISITI:** Google hesap kimlik bilgileri kullanılamayacağı için OAuth turu ancak Google giriş ekranına yönlendirmeye kadar doğrulanabilir. Google tarafında oturum açık bir tarayıcı profilinde akış kendiliğinden tamamlanabilir; bu bir başarı kanıtıdır ama kullanıcının kendi hesabıyla yapılan bir işlem olduğu her zaman belirtilir.
- **KULLANICI ADI (NICKNAME) KONTROL KURALI:** `checkNicknameTaken` ASLA `if (error) return false` yapamaz — her Supabase hatası (özellikle 520) "isim müsait" gibi yorumlanamaz. Zorunlu üçlü: (1) 4 sn `Promise.race` zaman aşımı, (2) artan backoff ile 3 deneme, (3) hepsi başarısızsa `null` dön (true/false'tan AYRI bir "doğrulanamadı" durumu). Dönen `null` kayıt akışını DURDURUR, devam ettirmez. UI'da ayrı bir "hata" durumu gösterilir.
- **BUILD SONRASI ZORUNLU BUNDLE DOĞRULAMASI (BEYAZ EKRAN KORUMASI):** `npm run build` temiz geçmesi çıktının ÇALIŞTIĞINI kanıtlamaz. Her build sonrası `dist/assets/index-<hash>.js` üzerinde ŞU ÜÇ kontrol yapılmadan kullanıcıya "hazır" DENİLEMEZ:
  ```powershell
  $j = Get-Content "dist\assets\index-<hash>.js" -Raw
  $j.Contains('https://rdqcwzosmikusketghyq.supabase.co')  # -> True OLMALI
  $j.Contains('8734180110')                                 # -> False OLMALI (sızıntı kontrolü)
  ```
  Supabase URL bundle'da **yoksa** `createClient('')` açılışta patlar ve site **boş beyaz** render olur. Bu durumda hata frontend kodunda DEĞİL, `.env` okunmasındadır.
- **`.env` BOM TUZAĞI (KRİTİK — bu projede yaşandı):** PowerShell'de `Get-Content` / `Set-Content` ile `.env` düzenlemek dosyanın başına görünmez **UTF-8 BOM** (`EF BB BF`) ekler. Vite ilk satırı `VITE_SUPABASE_URL` yerine `\uFEFFVITE_SUPABASE_URL` okur → değişken BOŞ kalır → site beyaz ekran olur ve hata mesajı vermez.
  - `.env` üzerinde YAZMA işlemi yapıldıktan sonra **ilk 3 bayt kontrolü zorunludur**:
    ```powershell
    ([System.IO.File]::ReadAllBytes(".env")[0..2] | ForEach-Object { $_.ToString('X2') }) -join ' '
    # Beklenen: 56 49 54 ("VIT").  EF BB BF ile başlıyorsa BOM vardır, temizlenmelidir.
    ```
  - Türkçe karakter bozulmasını (mojibake) önlemek için dosya yazımı daima `New-Object System.Text.UTF8Encoding($false)` (BOM'suz UTF-8) ile yapılır; `Set-Content`/`Out-File` kullanılmaz.
- **ANON PANEL TUZAĞI (admin.pyngoo.app — bu projede yaşandı):** `admin.pyngoo.app` ayrı bir subdomain olduğu için Supabase Auth oturumu AÇMAZ; panel kullanıcı adı/PIN ile `sessionStorage` üzerinden çalışır ve Supabase'e giden TÜM istekler `anon` rolüyle gider. Bu yüzden `profiles`/`reports` SELECT ve `admin_*` RPC EXECUTE yetkileri `anon`'dan alınırsa panel SESSİZCE BOŞLAŞIR: şikayetler "0 adet / kimse yok" görünür, "Moderatör Tanımla" çalışmaz — hata mesajı da vermez.
  - **KURAL:** Bir tabloyu/RPC'yi `anon`'dan kapatmadan ÖNCE o kaynağı kullanan istemcide Supabase oturumu olup olmadığı kontrol edilir. Oturumu olmayan (panel, landing, alt alan adı) istemciler `anon` yetkisine bağımlıdır.
  - **GÜVENLİ MODEL:** Anon'a ham tablo erişimi yerine, panel işlemlerini kimlik doğrulaması olan bir istemciye taşımak veya paneli Supabase Auth ile korunan bir rota altına almak gerekir. "Hem anon panel çalışsın hem de anon açık olmasın" aynı anda mümkün DEĞİLDİR — kullanıcıya bu seçim net söylenir.
  - Bu geçici durum için `restore_admin_panel_access.sql` hazır dosyadır; kalıcı çözüm paneli auth'lu akışa taşımaktır.
- **DEPLOY HIJYENI (ZORUNLU SIRALAMA):** `Pyngoo_Site` klasörü kopyalanmadan ÖNCE içeriği TAMAMEN silinir; asla sadece üzerine Force-copy yapılmaz (bayat hash'li bundle'lar birikip 225MB+ şişer ve Vercel'e bozuk sürüm gider).
  ```powershell
  Remove-Item 'C:\Users\PC\Desktop\Pyngoo_Site\*' -Recurse -Force
  Copy-Item -Path '<proje>\dist\*' -Destination 'C:\Users\PC\Desktop\Pyngoo_Site' -Recurse -Force
  ```
  Kopyalama sonrası klasör boyutu (~32MB) ve `assets\index-*.js` adının yeni build hash'iyle eşleştiği doğrulanır.
- **BAYRAK TEMİZLİĞİ KURALI:** `pyngoo_force_claim_device` gibi akış-sonu bayrakları, kalıcı `localStorage`'da takılı kalabilir ve sıradan bir sayfa açılışını "OAuth dönüşü" gibi davranmaya zorlayabilir. Uygulama açılışında, URL'de canlı OAuth işareti (`access_token` / `code=` / `oauth_login=`) YOKSA bu bayraklar `localStorage` VE `sessionStorage`'dan temizlenir. Sunucu-meşgul yönlendirmesi SADECE `isOAuthRedirect` ile tetiklenir; `isExplicitLogin` bu koşula ASLA eklenmez.

## 11. 🔎 Kaynağı Bilinmeyen Hata/Uyarı Mesajlarını Teşhis Yöntemi
- Ekranda görünen bir mesajın kaynağını bulmak için **sıralı kontrol** yapılır, tahmin edilmez:
  1. `src/` kaynak kodunda ara (Türkçe metnin **tamamıyla**, yarısıyla değil).
  2. **Canlı** bundle'ı indirip içinde ara: `Invoke-WebRequest https://www.pyngoo.app/assets/index-<hash>.js` ve `.Contains('tam mesaj')`. Kaynak kodda olup canlıda olmayan / canlıda olup kaynakta olmayan sürüm farkını bu gösterir.
  3. Supabase **kaynak kodunu** ara: `pg_proc` (fonksiyon/prosedür), `information_schema.views`, `pg_trigger` + `pg_get_functiondef`, `pg_constraint`, `pg_rewrite`, `pg_policy`.
  4. Supabase **verisini** ara: `public` + `auth` şemalarındaki tüm `text/varchar/json/jsonb` kolonlarında dinamik `EXECUTE ... ~*` taraması.
  5. Hiçbiri bulamazsa mesaj ya tarayıcı önbelleğindeki **bayat sürümdedir** (kullanıcıya Ctrl+Shift+R zorunlu) ya da Supabase panelinde SQL dışında tutulan bir yerdedir (Edge Functions / Auth Hooks / Webhooks).
- **PL/PgSQL KURALI:** `EXECUTE 'DELETE ...' INTO degisken` GEÇERSİZDİR (DELETE satır döndürmez). Satır sayısı için `EXECUTE ... USING ...;` ardından `GET DIAGNOSTICS v = ROW_COUNT;` kullanılır.
- **PSQL TARAMA KALIBI:** `RAISE EXCEPTION '...'` içindeki mesajı regex ile yakalarken tırnak kaçırmaları (`''`) ve büyük/küçük harf varyantları atlanır. Bu yüzden **büyük-küçük harf duyarsız (`~*`)** ve **Türkçe karakter içermeyen alt dizilerle** (`venlik`, `neticin`, `farkl`) arama yapılır; `ILIKE` yerine `~*` tercih edilir.
- **ÇOKLU SORGU UYARISI:** Supabase SQL Editor, birden fazla sorgu çalıştırıldığında **yalnızca sonuncusunun** sonucunu gösterir. Birleştirilmiş çıktı için `UNION ALL` ile tek sorgu yazılır veya sorgular tek tek çalıştırılır.
- **ARAMA KALIPLARINDA SESLİ HARF HATASI:** Türkçe karakterleri elle silerek (`Gvenlik`) kalıp uydurmak yanlış negatif üretir. Ya tam metin ya da `~*` ile regex kullanılır.

## 12. 🔒 Sunucu Tarafı Güvenlik Kuralları (RPC / Token / RLS)
- **RPC YETKİ KURALI (ZORUNLU):** `public` şemasındaki HİÇBİR fonksiyon `anon`'a açık OLAMAZ; istisna yalnızca `check_email_exists` ve `check_nickname_taken` (kayıt ekranı girişsiz çalışır). Hepsinde `GRANT EXECUTE ... TO anon` yasaktır. Yeni RPC eklendiğinde `security_scan_fixes.sql` içindeki blanket bloğu yeniden çalıştırılır.
- **YETKİ KONTROLÜ (ZORUNLU):** Yönetici/moderatör işlevli her RPC (`admin_*`, `approve_*`, `delete_report` vb.) gövdesinin BAŞINDA `IF NOT public.is_caller_staff() THEN RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz islem.'); END IF;` kontrolü bulunmalıdır. `SECURITY DEFINER` fonksiyonlar RLS'i bypass ettiği için bu kontrol TEK savunma hattıdır.
- **CANLI TARAMA ZORUNLULUĞU:** Yeni özellik/RPC eklendikçe şu canlı test yapılır: `POST {url}/rest/v1/rpc/<fonksiyon>` + anon anahtarı → gövdeli çağrı yetkisiz bir işlem yapıyorsa açık var demektir. (Bu testle `admin_set_moderator_status`'un herkese açık olduğu KANITLANDI.)
- **TOKEN KURALI:** API/bot token'ları (`TELEGRAM_BOT_TOKEN` vb.) `src/` içine ASLA yazılmaz; istemci bundle'ı herkese açıktır. Sunucu tarafı saklama yolları: Supabase Edge Function secrets (`supabase/functions/telegram-alert/index.ts`) veya `import.meta.env.VITE_*` (yalnızca zorunluysa). Sızması hâlinde ilgili serviste token DERHAL revoke edilir (Telegram: @BotFather `/revoke`).
- **RLS SIZINTI KURALI:** `profiles` tablosu anon (girişsiz) okumaya KAPALIDIR; girişsiz erişim gereken bilgiler (rumuz müsaitliği vb.) yalnızca dar kapsamlı RPC ile verilir. `reports` tablosu da anon'a tamamen kapalıdır; moderatör silme işi RPC üzerinden yürür.
- **PANEL OTURUM KURALI:** Moderatör paneli işlemleri artık yalnızca Pyngoo'ya GİRİŞ YAPMIŞ admin/moderatör oturumuyla çalışır; panel şifresi tek başına yeterli değildir (kasıtlı — güvenlik düzeltmesi). Panel testinde "omer" (admin) hesabıyla giriş yapılmış olması gerekir.

## 13. 🚫 Kod Tabanında, Dosyalarda ve Klasörlerde Asistan/Model İsimleri YASAĞI
- **KESİN YASAK:** Kod tabanında, dosya adlarında, klasörlerde (örn. `.abacusai`, `gemini`, vb.), commit mesajlarında veya kod içi yorumlarda ASLA herhangi bir yapay zekâ asistanı, aracı veya model ismi (`gemini`, `abacus`, `claude`, `chatgpt`, `antigravity`, `copilot`, vb.) yer alamaz veya bırakılamaz.
- Proje kural dosyası yalnızca `AGENTS.md` adını taşır; `GEMINI.md` adı KESİNLİKLE kullanılmaz ve proje dizininde bu isimde dosya/klasör bırakılamaz.
- Projede herhangi bir geçici araç dosyası, analiz klasörü veya AI imza kalıntısı tespit edildiğinde anında silinmelidir.
- **AYRIM:** Bu yasak, platformun kullanıcılara sunduğu meşru güvenlik özelliklerini ("Yapay Zeka Yüz Doğrulaması", "AI Face Verification", "AI-moderated") kesinlikle kapsamaz; kullanıcıya dönük ürün özellikleri 10 dilde korunmalıdır. Yasak yalnızca projenin bir yapay zekâ aracıyla yazıldığını veya geliştirildiğini ima eden araç/model/klasör izleri içindir.

## 14. 🚫 Kesin ve Kalıcı 'Sıfır Bot' Kuralı (Zero Bot Policy)
- **SİSTEMDE HİÇBİR BOT YOKTUR:** Veritabanındaki tüm yapay/bot hesaplar tamamen temizlenmiştir. Sistemde ASLA bot oluşturulamaz, bot simülasyonu yapılamaz, sahte kullanıcı/yayıncı profilleri basılamaz.
- Pyngoo tamamen %100 gerçek insanlardan oluşan canlı görüntülü ve sesli sohbet platformudur.
- Keşfet vitrini, arama, filtreleme ve eşleşme mekanizmaları YALNIZCA veritabanındaki gerçek aktif kullanıcılarla çalışır; arayüzde yapay kullanıcı veya sahte bot doldurması ASLA yapılamaz.

