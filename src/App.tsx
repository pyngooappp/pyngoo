import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { supabase } from './lib/supabase';
import { ShieldAlert, Smartphone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { generateUUID } from './utils/uuid';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Chats from './pages/Chats';
import Wallet from './pages/Wallet';
import Market from './pages/Market';
import Explore from './pages/Explore';
import Layout from './components/Layout';
import HostCenter from './pages/HostCenter';
import ModeratorPanel from './pages/ModeratorPanel';
import { updateSeoForLanguage } from './utils/seoService';
import { detectUserDefaultLanguage } from './utils/i18n';
import { sendNewRegistrationToTelegram } from './utils/telegramAlert';
import { NetworkStatusModal } from './components/NetworkStatusModal';
import PushPermissionPrompt, { PushOpenBridge } from './components/PushPermissionPrompt';
import { notifyFollowers, unregisterPushToken } from './utils/pushService';

// Modül seviyesinde cihaz sahiplik zaman damgası (re-render'larda ASLA sıfırlanmaz!)
let moduleLastSessionClaimedAt = 0;

// Modül seviyesinde tekrar-girişi (re-entrancy) engelleme kilidi: initializeAuth ve
// onAuthStateChange aynı anda tetiklenirse handleSession'ın iki kez üst üste, yarışarak
// çalışmasını (ve birbirinin state/redirect işlemlerini ezmesini) engeller.
let isHandlingSessionGlobally = false;

// OAuth token'larını güvenli ve UTF-8 destekli şekilde doğrudan çözümleme yardımcısı
const parseJwt = (token: string) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const pad = base64.length % 4;
    const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
    const raw = atob(padded);
    const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
    const decoded = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(decoded);
  } catch (e) {
    console.error("parseJwt hatası:", e);
    return null;
  }
};

function App() {
  const isAdminHost = typeof window !== 'undefined' && (
    window.location.hostname.startsWith('admin.') || 
    window.location.hostname === 'admin.pyngoo.app'
  );

  if (isAdminHost) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<ModeratorPanel />} />
        </Routes>
      </BrowserRouter>
    );
  }

  const { t, i18n } = useTranslation();
  
  // Hash içerisinden token'ı senkron olarak çözümle (Yalnızca doğrudan Giriş Yap durumlarında 0 ms gecikme)
  // EĞER KULLANICI "KAYIT OL" MODUNDAYSA: Zaten kayıtlı profil koruması için önce veritabanı kontrolü beklenmelidir!
  const [userId, setUserId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const isRegisterAttempt = localStorage.getItem('pyngoo_just_registered') === 'true' || 
                                sessionStorage.getItem('pyngoo_just_signed_up') === 'true' ||
                                localStorage.getItem('pyngoo_auth_mode') === 'register' ||
                                sessionStorage.getItem('pyngoo_auth_mode') === 'register' ||
                                Boolean(localStorage.getItem('pending_nickname'));
      if (isRegisterAttempt) {
        return null;
      }
      if (window.location.hash.includes('access_token')) {
        try {
          const hashCleaned = window.location.hash.replace(/^#\/?/, '').replace(/\?/g, '&');
          const hashParams = new URLSearchParams(hashCleaned);
          const token = hashParams.get('access_token');
          if (token) {
            const payload = parseJwt(token);
            if (payload?.sub) return payload.sub;
          }
        } catch (_) {}
      }
    }
    return null;
  });

  const [userProfile, setUserProfile] = useState<any>(() => {
    if (typeof window !== 'undefined') {
      const isRegisterAttempt = localStorage.getItem('pyngoo_just_registered') === 'true' || 
                                sessionStorage.getItem('pyngoo_just_signed_up') === 'true' ||
                                localStorage.getItem('pyngoo_auth_mode') === 'register' ||
                                sessionStorage.getItem('pyngoo_auth_mode') === 'register' ||
                                Boolean(localStorage.getItem('pending_nickname'));
      if (isRegisterAttempt) {
        return null;
      }
      if (window.location.hash.includes('access_token')) {
        try {
          const hashCleaned = window.location.hash.replace(/^#\/?/, '').replace(/\?/g, '&');
          const hashParams = new URLSearchParams(hashCleaned);
          const token = hashParams.get('access_token');
          if (token) {
            const payload = parseJwt(token);
            if (payload?.sub) {
              const savedStr = localStorage.getItem(`pyngoo_user_profile_${payload.sub}`);
              if (savedStr) {
                try { return JSON.parse(savedStr); } catch (_) {}
              }
            }
          }
        } catch (_) {}
      }
    }
    return null;
  });

  const [loading, setLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = window.location.pathname;
      const s = window.location.search;
      const h = window.location.hash;

      // Mobil uygulamada (Capacitor iOS/Android) web tanıtım sayfası (LandingPage) gösterilmez; doğrudan Kayıt Ol / Giriş Yap açılır!
      if (Capacitor.isNativePlatform()) {
        return true;
      }

      // Eğer email_taken veya deleted veya not_found veya açık mod parametresi varsa Auth ekranı KESİNLİKLE açılmalıdır!
      if (
        s.includes('email_taken') || 
        s.includes('not_found') || 
        s.includes('deleted') || 
        s.includes('mode=') || 
        p.startsWith('/login') || 
        sessionStorage.getItem('pyngoo_show_login') === 'true'
      ) {
        return true;
      }

      // OAuth geri dönüşlerinde (access_token, oauth_login, code) oturum kurulana kadar Auth ekranı ASLA açılmamalıdır!
      if (h.includes('access_token') || s.includes('oauth_login') || s.includes('code=') || h.includes('code=')) {
        return false;
      }
    }
    return false;
  });
  const [sessionTerminated, setSessionTerminated] = useState(false);

  useEffect(() => {
    const autoLang = detectUserDefaultLanguage();
    const currentActiveLang = localStorage.getItem('i18nextLng') || autoLang;
    if (i18n.language !== currentActiveLang) {
      i18n.changeLanguage(currentActiveLang);
    }
    updateSeoForLanguage(currentActiveLang);
  }, [i18n.language]);

  // GÜVENLİK/KARARLILIK: "pyngoo_force_claim_device" bayrağı Google/Apple butonuna
  // basılır basılmaz (yönlendirmeden ÖNCE) set edilir. Kullanıcı OAuth ekranını yarıda
  // bırakırsa (geri tuşu, pencere kapama, zaman aşımı) bu bayrak temizlenmeden
  // localStorage'da SONSUZA KADAR kalabiliyordu. Bu da normal, OAuth ile alakasız bir
  // sonraki sayfa açılışını bile "az önce açık bir giriş denemesi oldu" sanıp gereksiz
  // yere sert oturum kapatma/yönlendirmeye çeviriyordu. Gerçek bir OAuth dönüşü
  // yaşanmıyorsa (adres çubuğunda access_token/code/oauth_login yoksa) bu eski bayrağı
  // her sayfa açılışında temizle.
  useEffect(() => {
    const h = window.location.hash;
    const s = window.location.search;
    const isLiveOAuthReturn = h.includes('access_token') || h.includes('code=') || s.includes('code=') || s.includes('oauth_login=');
    if (!isLiveOAuthReturn) {
      localStorage.removeItem('pyngoo_force_claim_device');
      sessionStorage.removeItem('pyngoo_force_claim_device');
      if (Capacitor.isNativePlatform()) {
        try { Browser.close(); } catch (_) {}
      }
    }
  }, []);

  // Cihaz Kimliği: Her cihazın (telefon, bilgisayar) kendine ait kalıcı benzersiz kimliği
  const getOrCreateDeviceId = () => {
    let devId = localStorage.getItem('pyngoo_client_device_id');
    if (!devId) {
      devId = 'dev_' + Date.now() + '_' + generateUUID().slice(0, 8);
      localStorage.setItem('pyngoo_client_device_id', devId);
    }
    return devId;
  };

  const syncAuthUserMetadata = async (_uid: string, displayName: string, rawToken?: string | null) => {
    if (!displayName) return;

    // 1. Supabase JS SDK üzerinden güncelle
    try {
      await supabase.auth.updateUser({
        data: {
          full_name: displayName,
          name: displayName,
          display_name: displayName,
          user_name: displayName
        }
      });
    } catch (_) {}

    // 2. Token mevcutsa doğrudan Supabase Auth REST API üzerinden güncelle (SDK oturumsuz olsa dahi kesin çalışır!)
    const sUrl = import.meta.env.VITE_SUPABASE_URL;
    const sKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const token = rawToken || (() => {
      try {
        const sbToken = localStorage.getItem('sb-rdqcwzosmikusketghyq-auth-token');
        return sbToken ? JSON.parse(sbToken)?.access_token : null;
      } catch (_) { return null; }
    })();

    if (sUrl && sKey && token) {
      try {
        fetch(`${sUrl}/auth/v1/user`, {
          method: 'PUT',
          headers: {
            'apikey': sKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            data: {
              full_name: displayName,
              name: displayName,
              display_name: displayName,
              user_name: displayName
            }
          })
        }).catch(() => {});
      } catch (_) {}
    }

    // 3. Güvenli RPC üzerinden auth.users tablosunu doğrudan güncelle
    try {
      await supabase.rpc('sync_auth_display_name', { p_display_name: displayName });
    } catch (_) {}
  };

  const claimAndBroadcastSession = async (uid: string, displayName?: string) => {
    moduleLastSessionClaimedAt = Date.now();
    const myDeviceId = getOrCreateDeviceId();
    // 1. Supabase Auth user_metadata üzerine bu cihazın kimliğini ve rumuzunu kalıcı olarak mühürle
    try {
      const updatePayload: any = {
        active_device_id: myDeviceId,
        active_device_at: Date.now()
      };
      if (displayName) {
        updatePayload.full_name = displayName;
        updatePayload.name = displayName;
        updatePayload.display_name = displayName;
        updatePayload.user_name = displayName;
      }
      await supabase.auth.updateUser({
        data: updatePayload
      });
    } catch (err) {
      console.warn('active_device_id güncellenemedi:', err);
    }

    // 2. Diğer açık cihazlara anında kapanma emri (force_logout) gönder
    try {
      const channel = supabase.channel(`user_session_${uid}`);
      const payload = { issuerDeviceId: myDeviceId };
      if (channel.state === 'joined') {
        channel.send({ type: 'broadcast', event: 'force_logout', payload });
      } else {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            channel.send({ type: 'broadcast', event: 'force_logout', payload });
          }
        });
      }
    } catch (_) {}
  };

  const purgeUserSession = async (reason?: string) => {
    if (userId) {
      try {
        localStorage.setItem(`pyngoo_streamer_online_${userId}`, 'false');
        await supabase.from('profiles').update({
          is_streamer_online: false,
          last_active_at: new Date().toISOString()
        }).eq('id', userId);
        await supabase.from('waiting_room').delete().eq('user_id', userId);
        const statusCh = supabase.channel('pyngoo_streamer_status_channel');
        statusCh.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            statusCh.send({
              type: 'broadcast',
              event: 'streamer_status_changed',
              payload: { userId, isOnline: false }
            });
          }
        });
      } catch (_) {}
    }

    try {
      await supabase.auth.signOut();
    } catch (_) {}

    try {
      const devId = localStorage.getItem('pyngoo_client_device_id');
      localStorage.clear();
      sessionStorage.clear();
      if (devId) localStorage.setItem('pyngoo_client_device_id', devId);
      document.cookie = "p_gen=; path=/; max-age=0";
      document.cookie = "p_role=; path=/; max-age=0";
      document.cookie = "p_nick=; path=/; max-age=0";
      document.cookie = "p_lang=; path=/; max-age=0";
      document.cookie = "p_auth_mode=; path=/; max-age=0";
    } catch (_) {}

    sessionStorage.setItem('pyngoo_show_login', 'true');
    setUserId(null);
    setUserProfile(null);
    setShowAuth(true);
    setLoading(false);

    if (reason && reason.includes('1 saat')) {
      alert(t('session_timeout_alert'));
      window.location.replace('/login');
    } else if (reason && reason.includes('askıya')) {
      alert(t('account_banned_alert'));
      window.location.replace('/login');
    } else if (reason && reason.includes('silin')) {
      window.location.replace('/login?mode=register&deleted=1');
    } else {
      window.location.replace('/login?mode=register&not_found=1');
    }
  };

  useEffect(() => {
    const handleSession = async (session: any, eventType?: string) => {
      if (isHandlingSessionGlobally) {
        console.warn("App.tsx: handleSession zaten çalışıyor, çakışan çağrı atlanıyor.", eventType);
        return;
      }
      isHandlingSessionGlobally = true;
      try {
        await handleSessionInner(session, eventType);
      } finally {
        isHandlingSessionGlobally = false;
      }
    };

    const handleSessionInner = async (session: any, eventType?: string) => {
      if (session?.user) {
        const uid = session.user.id;

        // 0. OAuth dönüşü veya Açık Giriş (Explicit Login) tespiti:
        const isOAuthRedirect = typeof window !== 'undefined' && (
          window.location.hash.includes('access_token') || 
          window.location.search.includes('code=') ||
          window.location.hash.includes('code=') ||
          window.location.search.includes('oauth_login=') ||
          window.location.search.includes('p_gen=') ||
          window.location.hash.includes('type=recovery')
        );

        const isOAuthUser = isOAuthRedirect || 
                            session?.user?.app_metadata?.provider === 'google' || 
                            session?.user?.app_metadata?.provider === 'apple' ||
                            Boolean(session?.user?.identities?.some((id: any) => id.provider === 'google' || id.provider === 'apple'));

        const isExplicitLogin = isOAuthRedirect ||
                                isOAuthUser ||
                                localStorage.getItem('pyngoo_force_claim_device') === 'true' || 
                                sessionStorage.getItem('pyngoo_force_claim_device') === 'true' ||
                                eventType === 'SIGNED_IN';

        // 0.1. 1 Saatlik İnaktivite Oturum Süresi Kontrolü (Session Timeout - 60 Dakika)
        const lastActiveTime = localStorage.getItem('pyngoo_last_session_active_at');
        const ONE_HOUR_MS = 60 * 60 * 1000;
        if (!isExplicitLogin && lastActiveTime) {
          const elapsed = Date.now() - Number(lastActiveTime);
          if (elapsed > ONE_HOUR_MS) {
            console.warn(`App.tsx: Oturum ${Math.round(elapsed / 60000)} dakikadır inaktif. 1 saatlik oturum süresi doldu.`);
            await purgeUserSession("1 saatlik inaktivite süresi doldu.");
            return;
          }
        }
        localStorage.setItem('pyngoo_last_session_active_at', Date.now().toString());

        // 1. Supabase Auth kullanıcısını anında al (ağ gecikmelerini ve 25 saniyelik askıda kalmayı engelle)
        let activeAuthUser = session.user;
        if (!activeAuthUser) {
          try {
            const { data: authUserData } = await supabase.auth.getUser();
            if (authUserData?.user) {
              activeAuthUser = authUserData.user;
            }
          } catch (_) {}
        }
        if (!activeAuthUser) {
          setLoading(false);
          return;
        }

        // 2. Tek Oturum (Single Active Session) Doğrulaması:
        const myDeviceId = getOrCreateDeviceId();
        const serverActiveDeviceId = activeAuthUser?.user_metadata?.active_device_id;

        // Eğer bu cihaz pasif olarak açıldıysa (örn: F5 ile sayfa yenileme) ve aktif cihaz başkasıysa:
        if (!isExplicitLogin && eventType !== 'SIGNED_IN' && serverActiveDeviceId && serverActiveDeviceId !== myDeviceId) {
          console.warn(`App.tsx: Bu cihaz (${myDeviceId}) yerine başka bir cihaz (${serverActiveDeviceId}) aktif. Bu cihaz sonlandırılıyor.`);
          setSessionTerminated(true);
          try {
            await supabase.auth.signOut({ scope: 'local' });
          } catch (_) {}
          setUserId(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }

        // 3. URL ve Cookie parametrelerini oku (auth_mode, OAuth dönüşü vb.)
        const urlParams = new URLSearchParams(window.location.search);
        let hashParams = new URLSearchParams();
        if (window.location.hash) {
          const hashCleaned = window.location.hash.replace(/^#\/?/, '').replace(/\?/g, '&');
          hashParams = new URLSearchParams(hashCleaned);
        }
        
        const getCookie = (name: string) => {
          try {
            const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
            return m ? decodeURIComponent(m[2]) : null;
          } catch (_) { return null; }
        };

        const cookieAuthMode = getCookie('p_auth_mode');
        const authMode = urlParams.get('auth_mode') || 
                         hashParams.get('auth_mode') || 
                         cookieAuthMode ||
                         localStorage.getItem('pyngoo_auth_mode') || 
                         sessionStorage.getItem('pyngoo_auth_mode') ||
                         '';
        localStorage.removeItem('pyngoo_auth_mode');
        sessionStorage.removeItem('pyngoo_auth_mode');

        // 4. Profil var mı kontrol et
        let { data: userProfile, error: profileFetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', uid)
          .maybeSingle();

        // Ağ hatası / rate-limit / 520 gibi geçici bir sorgu hatası oluştuysa birkaç kez
        // artan bekleme süresiyle tekrar deneyelim (Supabase Nano katmanında bağlantı
        // havuzu anlık doluyorsa genelde 1-2 sn içinde toparlanır).
        // Mimari Kural: DB sorgu hataları ASLA "profil yok / hesap silinmiş" olarak yorumlanamaz.
        let retryAttempt = 0;
        while (profileFetchError && retryAttempt < 3) {
          retryAttempt++;
          console.warn(`App.tsx: Profil sorgusunda geçici hata, tekrar deneniyor (${retryAttempt}/3).`, profileFetchError);
          await new Promise(res => setTimeout(res, 600 * retryAttempt));
          const retry = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .maybeSingle();
          userProfile = retry.data;
          profileFetchError = retry.error;
        }

        if (profileFetchError) {
          console.warn("App.tsx: Profil sorgusu ağ hatası nedeniyle doğrulanamadı. Güvenlik gereği hesap/oturum işlemi yapılmıyor, kullanıcıya bilgi veriliyor.", profileFetchError);
          setLoading(false);
          // ÖNEMLİ: Sadece bu anda GERÇEKTEN devam eden bir OAuth dönüşünde (adres çubuğunda
          // access_token/code varken) sert çıkış yapılıp yönlendirilir. `isExplicitLogin` ise
          // localStorage'da kalabilen (yarım kalmış girişlerden artakalan) bir bayrağa da
          // dayanabildiği için, sıradan bir sayfa yenilemesinde tek seferlik bir 520 hatasını
          // gereksiz "oturumu kapat" işlemine çevirmemesi gerekir.
          if (typeof window !== 'undefined' && isOAuthRedirect) {
            try { await supabase.auth.signOut({ scope: 'local' }); } catch (_) {}
            window.location.replace('/login?mode=login&server_busy=1');
          }
          return;
        }

        // Profil veritabanında silinmiş olarak işaretliyse:
        if (userProfile?.role === 'deleted') {
          console.warn("App.tsx: Profil veritabanında silinmiş hesap. Oturum kapatılıyor.");
          try { await supabase.rpc('delete_user_account'); } catch (_) {}
          await purgeUserSession("Hesabınız daha önce silinmiştir.");
          return;
        }

        // Yasaklanmış hesap kontrolü:
        if (userProfile?.is_banned === true) {
          console.warn("App.tsx: Yasaklanmış hesap.");
          await purgeUserSession("Hesabınız askıya alınmıştır.");
          return;
        }




        const cookieGen = getCookie('p_gen');
        const cookieRole = getCookie('p_role');
        const cookieNick = getCookie('p_nick');
        const cookieLang = getCookie('p_lang');

        const urlGender = urlParams.get('p_gen') || urlParams.get('pending_gender') || hashParams.get('p_gen') || cookieGen;
        const urlRole = urlParams.get('p_role') || urlParams.get('pending_role') || hashParams.get('p_role') || cookieRole;
        const urlNick = urlParams.get('p_nick') || urlParams.get('pending_nickname') || hashParams.get('p_nick') || cookieNick;
        const urlLang = urlParams.get('p_lang') || urlParams.get('pending_lang') || hashParams.get('p_lang') || cookieLang;

        if (urlGender) {
          localStorage.setItem('pending_gender', urlGender);
          localStorage.setItem('pyngoo_gender', urlGender);
        }
        if (urlRole) localStorage.setItem('pending_role', urlRole);
        if (urlNick) localStorage.setItem('pending_nickname', urlNick);
        if (urlLang) localStorage.setItem('pending_language', urlLang);
          
        let currentProfile = userProfile;

        const metaGender = session.user?.user_metadata?.gender;
        const metaRole = session.user?.user_metadata?.role;
        const metaName = session.user?.user_metadata?.display_name || session.user?.user_metadata?.user_name;
        const savedStr = localStorage.getItem(`pyngoo_user_profile_${uid}`);
        let savedProfile: any = null;
        try { savedProfile = savedStr ? JSON.parse(savedStr) : null; } catch (_) {}

        const isOmer = uid === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b' || 
                       uid === '22b3c0e7-e1e2-4cb5-9532-990066b5a80c' ||
                       session.user?.email === 'omersahin1623@hotmail.com' || 
                       session.user?.email === 'cosmicdreamersleep@gmail.com';

        if (isOmer) {
          localStorage.setItem('pyngoo_gender', 'erkek');
          localStorage.setItem('pending_gender', 'erkek');
          localStorage.removeItem(`pyngoo_is_streamer_${uid}`);
          localStorage.removeItem(`pyngoo_streamer_online_${uid}`);
          localStorage.removeItem(`pyngoo_streamer_avatar_${uid}`);
          localStorage.setItem(`pyngoo_role_${uid}`, 'admin');
          try {
            document.cookie = "p_gen=erkek; path=/; max-age=86400; SameSite=Lax";
            document.cookie = "p_role=admin; path=/; max-age=86400; SameSite=Lax";
          } catch (_) {}
        }

        const isKadin = !isOmer && (urlGender === 'kadin' || 
          localStorage.getItem('pending_gender') === 'kadin' || 
          localStorage.getItem('pyngoo_gender') === 'kadin' || 
          cookieGen === 'kadin' ||
          metaGender === 'kadin' || 
          savedProfile?.gender === 'kadin' ||
          uid === 'cc9587a1-5e24-4162-9be9-8ed7999c5e2a'); // Canlıda yeni kayıt olan kadın kullanıcımızın anında onarılması

        const pendingGender = isOmer ? 'erkek' : (isKadin ? 'kadin' : (urlGender || localStorage.getItem('pending_gender') || localStorage.getItem('pyngoo_gender') || metaGender || savedProfile?.gender || 'erkek'));
        const pendingRole = isOmer ? 'admin' : (isKadin ? 'streamer' : (urlRole || localStorage.getItem('pending_role') || metaRole || 'user'));
        const pendingNickname = urlNick || localStorage.getItem('pending_nickname') || savedProfile?.display_name || metaName;
        if (!currentProfile) {
          // Giriş Yap sekmesinden gelen VE veritabanında kaydı olmayan (yeni) kullanıcılar için KESİN KONTROL:
          // Kullanıcının "Kayıt Ol" sekmesinden açık ve onaylı bir kayıt başvurusu yoksa ASLA otomatik profil oluşturulamaz!
          const isExplicitLoginMode = authMode === 'login' || 
                                     urlParams.get('mode') === 'login' || 
                                     hashParams.get('mode') === 'login' ||
                                     urlParams.get('auth_mode') === 'login' ||
                                     urlParams.get('p_auth_mode') === 'login';

          const hasExplicitRegisterSubmission = !isExplicitLoginMode && Boolean(
            (authMode === 'register' || urlParams.get('mode') === 'register' || hashParams.get('mode') === 'register' || urlParams.get('p_auth_mode') === 'register' || cookieAuthMode === 'register') &&
            (localStorage.getItem('pyngoo_just_registered') === 'true' || sessionStorage.getItem('pyngoo_just_signed_up') === 'true') &&
            pendingNickname && pendingNickname.trim().length >= 3
          );

          if (!hasExplicitRegisterSubmission && !isOmer) {
            // KRİTİK KURAL: "Giriş Yap" modunda (isExplicitLoginMode=true) hesap asla silinmez!
            // Profil DB'den gelmemiş olabilir (geçici ağ hatası, Supabase nano pool dolumu, vb.).
            // "Kayıt Ol" modunda ise gerçekten yeni hesap açılıyor: o zaman temizlik yapılır.
            const shouldDeleteAuthAccount = !isExplicitLoginMode && (
              // Gerçekten yeni bir OAuth sign-up girişimi ama kayıt bayrakları yok
              isOAuthUser && !localStorage.getItem('pyngoo_just_registered') && !sessionStorage.getItem('pyngoo_just_signed_up')
            );

            console.warn("App.tsx: Kullanıcının Pyngoo profili bulunamadı.", 
              "isExplicitLoginMode:", isExplicitLoginMode,
              "shouldDeleteAuthAccount:", shouldDeleteAuthAccount,
              "isOAuthUser:", isOAuthUser,
              "authMode:", authMode
            );

            if (shouldDeleteAuthAccount) {
              // Oturumdaki geçici auth kullanıcısını sil ki auth.users tablosunda sahte/artık hesap kalmasın
              // Yalnızca "Kayıt Ol" akışında gerçekten yeni OAuth denemesi iken çalışır
              try {
                await supabase.rpc('delete_user_account');
              } catch (_) {}
            }
            try { await supabase.auth.signOut(); } catch (_) {}

            localStorage.removeItem('pending_nickname');
            localStorage.removeItem('pending_gender');
            localStorage.removeItem('pending_role');
            localStorage.removeItem('pyngoo_gender');
            localStorage.removeItem('pyngoo_just_registered');
            sessionStorage.removeItem('pyngoo_just_signed_up');
            try {
              document.cookie = "p_nick=; path=/; max-age=0";
              document.cookie = "p_gen=; path=/; max-age=0";
              document.cookie = "p_role=; path=/; max-age=0";
              document.cookie = "p_auth_mode=; path=/; max-age=0";
            } catch (_) {}

            setUserId(null);
            setUserProfile(null);
            setShowAuth(true);
            setLoading(false);
            if (typeof window !== 'undefined') {
              window.location.replace('/login?mode=register&not_found=1');
            }
            return;
          }


          const pendingLanguage = urlLang || localStorage.getItem('pending_language') || session.user?.user_metadata?.preferred_language || (navigator.language?.startsWith('tr') ? 'tr' : 'en');
          const finalName = pendingNickname ? pendingNickname.trim() : (isOmer ? 'omer' : '');
          if (!finalName && !isOmer) {
            try { await supabase.rpc('delete_user_account'); } catch (_) {}
            try { await supabase.auth.signOut(); } catch (_) {}
            if (typeof window !== 'undefined') {
              window.location.replace('/login?mode=register&not_found=1');
            }
            return;
          }

          // Güvenlik Kuralı: Yeni profil oluşturulmadan (ve kadın kullanıcıda yüz taraması başlamadan) ÖNCE,
          // bu auth hesabının e-postası veritabanında zaten farklı bir profile (farklı auth uid) bağlıysa engelle.
          const activeEmailForCheck = activeAuthUser?.email;
          console.warn("PYNGOO_DEBUG: check_email_exists öncesi -> uid:", uid, "email:", activeEmailForCheck);
          if (activeEmailForCheck) {
            try {
              const { data: emailCheckRes, error: emailCheckErr } = await supabase.rpc('check_email_exists', { p_email: activeEmailForCheck });
              console.warn("PYNGOO_DEBUG: check_email_exists sonucu:", emailCheckRes, "hata:", emailCheckErr);
              if (emailCheckRes && emailCheckRes.exists) {
                console.warn("App.tsx: Bu e-posta ile zaten kayıtlı bir profil var. Yeni profil oluşturma engellendi.");
                const existingName = emailCheckRes.display_name || '';
                try { await supabase.rpc('delete_user_account'); } catch (_) {}
                try { await supabase.auth.signOut(); } catch (_) {}
                setUserId(null);
                setUserProfile(null);
                setLoading(false);
                if (typeof window !== 'undefined') {
                  window.location.replace(`/login?mode=login&email_taken=1&name=${encodeURIComponent(existingName)}`);
                }
                return;
              }
            } catch (e) {
              console.error("PYNGOO_DEBUG: check_email_exists RPC exception:", e);
            }
          } else {
            console.warn("PYNGOO_DEBUG: activeEmailForCheck BOŞ - kontrol atlandı!");
          }

          // Yeni veya eksik kayıtlı kullanıcı için profil oluştur ve veritabanına ekle
          const newProfileData = { 
            id: uid, 
            display_name: finalName, 
            total_gold: 0, 
            total_diamonds: 0,
            gender: isKadin ? 'kadin' : pendingGender,
            role: isKadin ? 'streamer' : pendingRole,
            preferred_language: pendingLanguage,
            is_premium: false,
            free_extensions: 2
          };

          try {
            const { data: createdProfile } = await supabase.from('profiles').upsert([newProfileData]).select().maybeSingle();
            currentProfile = createdProfile || newProfileData;
          } catch (_) {
            currentProfile = newProfileData;
          }

          sessionStorage.setItem(`pyngoo_just_created_profile_${uid}`, 'true');
          localStorage.removeItem('pyngoo_just_registered');
          sessionStorage.removeItem('pyngoo_just_signed_up');
          
          // İlk günün reset tarihini kaydet
          const today = new Date().toISOString().split('T')[0];
          localStorage.setItem(`last_reset_${uid}`, today);

          // Admin'e anlık Telegram yeni üye bildirimini arka planda gönder (asenkron, UI'ı kitlemez)
          if (!isOmer) {
            sendNewRegistrationToTelegram({
              displayName: finalName,
              userId: uid,
              gender: isKadin ? 'kadin' : pendingGender,
              authMethod: activeAuthUser?.app_metadata?.provider || 'OAuth/Email',
              preferredLanguage: pendingLanguage,
              email: activeAuthUser?.email
            }).catch(() => {});
          }

          // Supabase Auth Users tablosundaki Display Name sütununu kullanıcının Pyngoo kullanıcı adına mühürle (Google Ad-Soyad verisini ez!)
          syncAuthUserMetadata(uid, finalName, hashParams.get('access_token'));
        } else if (currentProfile) {
          const isBrandNewProfileJustCreated = sessionStorage.getItem(`pyngoo_just_created_profile_${uid}`) === 'true';
          sessionStorage.removeItem(`pyngoo_just_created_profile_${uid}`);

          const isExplicitLoginMode = authMode === 'login' || 
                                     urlParams.get('mode') === 'login' || 
                                     hashParams.get('mode') === 'login' ||
                                     urlParams.get('auth_mode') === 'login' ||
                                     urlParams.get('p_auth_mode') === 'login' ||
                                     cookieAuthMode === 'login';

          const enteredNickname = !isExplicitLoginMode ? (urlNick || cookieNick || localStorage.getItem('pending_nickname')) : null;

          const isRegisterIntent = !isExplicitLoginMode && Boolean(
            authMode === 'register' ||
            urlParams.get('mode') === 'register' ||
            hashParams.get('mode') === 'register' ||
            urlParams.get('auth_mode') === 'register' ||
            urlParams.get('p_auth_mode') === 'register' ||
            cookieAuthMode === 'register' ||
            localStorage.getItem('pyngoo_just_registered') === 'true' ||
            sessionStorage.getItem('pyngoo_just_signed_up') === 'true' ||
            localStorage.getItem('pyngoo_auth_mode') === 'register' ||
            sessionStorage.getItem('pyngoo_auth_mode') === 'register'
          );

          // EĞER KULLANICI ZATEN KAYITLI İSE (Önceden var olan profil) VE "KAYIT OL" SEKMESİNDEN GİRMEYE ÇALIŞTIYSA:
          // SİSTEM HİÇBİR ŞEKİLDE ESKİ PROFİLE OTOMATİK SOKMAZ! Oturumu derhal yok eder, email_taken uyarısı verir.
          // ANCAK "GİRİŞ YAP" SEKMESİNDEYSE (isExplicitLoginMode=true) KULLANICI NORMAL GİRİŞ YAPIYORDUR, ASLA ENGELLEME!
          const isBlockedExistingProfile = Boolean(
            !isExplicitLoginMode &&
            !isBrandNewProfileJustCreated &&
            currentProfile &&
            currentProfile.role !== 'deleted' &&
            (
              isRegisterIntent ||
              (enteredNickname && enteredNickname.trim().length >= 3 && currentProfile.display_name && enteredNickname.trim().toLowerCase() !== currentProfile.display_name.trim().toLowerCase())
            )
          );

          console.warn("PYNGOO_DEBUG: mevcut profil dalı -> isExplicitLoginMode:", isExplicitLoginMode, "isRegisterIntent:", isRegisterIntent, "isBrandNewProfileJustCreated:", isBrandNewProfileJustCreated, "isBlockedExistingProfile:", isBlockedExistingProfile, "enteredNickname:", enteredNickname, "authMode:", authMode);

          if (isBlockedExistingProfile) {
            console.warn(`App.tsx: Kullanıcının zaten var olan aktif profili var (@${currentProfile.display_name}). Kayıt Ol sekmesinden giriş denemesi engellendi.`);
            
            sessionStorage.setItem('pyngoo_explicit_logout', 'true');
            sessionStorage.setItem('pyngoo_show_login', 'true');

            // TÜM Supabase Auth token'larını ve geçici bilgileri localStorage ve sessionStorage'dan kökten temizle!
            try {
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k && (
                  k.startsWith('sb-') || 
                  k.includes('auth-token') || 
                  k.startsWith('pyngoo_user_profile') || 
                  k.startsWith('pending_') || 
                  k.startsWith('pyngoo_just_') || 
                  k.startsWith('pyngoo_auth_mode') ||
                  k.startsWith('pyngoo_force_')
                )) {
                  localStorage.removeItem(k);
                }
              }
            } catch (_) {}

            try {
              sessionStorage.removeItem('pyngoo_just_signed_up');
              sessionStorage.removeItem('pyngoo_auth_mode');
              sessionStorage.removeItem('pyngoo_force_claim_device');
            } catch (_) {}

            try {
              document.cookie = "p_nick=; path=/; max-age=0";
              document.cookie = "p_gen=; path=/; max-age=0";
              document.cookie = "p_role=; path=/; max-age=0";
              document.cookie = "p_auth_mode=; path=/; max-age=0";
            } catch (_) {}

            try { await supabase.auth.signOut({ scope: 'local' }); } catch (_) {}

            setUserId(null);
            setUserProfile(null);
            setShowAuth(true);
            setLoading(false);
            if (typeof window !== 'undefined') {
              window.location.replace(`/?mode=login&email_taken=1&name=${encodeURIComponent(currentProfile.display_name)}`);
            }
            return;
          }

          localStorage.removeItem('pending_nickname');
          localStorage.removeItem('pending_gender');
          localStorage.removeItem('pending_role');
          localStorage.removeItem('pyngoo_just_registered');
          localStorage.removeItem('pyngoo_auth_mode');
          sessionStorage.removeItem('pyngoo_just_signed_up');
          sessionStorage.removeItem('pyngoo_auth_mode');
          try {
            document.cookie = "p_nick=; path=/; max-age=0";
            document.cookie = "p_gen=; path=/; max-age=0";
            document.cookie = "p_role=; path=/; max-age=0";
            document.cookie = "p_auth_mode=; path=/; max-age=0";
          } catch (_) {}

          // Normal giriş yapan kullanıcı için Supabase Auth Users tablosundaki Display Name verisini Pyngoo rumuzuna mühürle
          if (currentProfile.display_name) {
            syncAuthUserMetadata(uid, currentProfile.display_name, hashParams.get('access_token'));
          }

          // Eğer profil varsa ama kayıt anında KADIN seçildiyse veya kullanıcımız kadın ise kesinlikle güncelle!
          if (isOmer) {
            const omerUpdates: any = {
              gender: 'erkek',
              role: 'admin',
              display_name: 'omer'
            };
            if (currentProfile.gender !== 'erkek' || currentProfile.role !== 'admin' || currentProfile.display_name !== 'omer') {
              try {
                await supabase.from('profiles').update(omerUpdates).eq('id', uid);
              } catch (_) {}
              currentProfile = { ...currentProfile, ...omerUpdates };
            }
          } else if (isKadin && (currentProfile.gender !== 'kadin' || currentProfile.role !== 'streamer')) {
            const kadinUpdates = {
              gender: 'kadin',
              role: 'streamer'
            };
            try {
              await supabase.from('profiles').update(kadinUpdates).eq('id', uid);
            } catch (_) {}
            currentProfile = { ...currentProfile, ...kadinUpdates };
          }

          const today = new Date().toISOString().split('T')[0];
          const lastReset = localStorage.getItem(`last_reset_${uid}`);
          
          if (lastReset !== today) {
            // Yeni gün başlamış, hakkı kesinlikle 2'ye eşitle (devretmez)
            await supabase.from('profiles').update({ free_extensions: 2 }).eq('id', uid);
            localStorage.setItem(`last_reset_${uid}`, today);
            currentProfile.free_extensions = 2;
          } else if (currentProfile.free_extensions > 2) {
            // HATA DÜZELTME: Eski kayıtlarda 10 kalmışsa 2'ye düşür
            await supabase.from('profiles').update({ free_extensions: 2 }).eq('id', uid);
            currentProfile.free_extensions = 2;
          }
        }

        // Cinsiyet & Yayıncı durumunu localStorage'a senkronize et
        if (isOmer) {
          if (currentProfile) {
            currentProfile.gender = 'erkek';
            currentProfile.role = 'admin';
            currentProfile.display_name = 'omer';
          }
          localStorage.setItem('pyngoo_gender', 'erkek');
          localStorage.setItem('pending_gender', 'erkek');
          localStorage.removeItem(`pyngoo_is_streamer_${uid}`);
          localStorage.removeItem(`pyngoo_streamer_avatar_${uid}`);
          localStorage.setItem(`pyngoo_role_${uid}`, 'admin');
        } else if (currentProfile?.gender === 'kadin' || isKadin) {
          if (currentProfile) {
            currentProfile.gender = 'kadin';
          }
          localStorage.setItem('pyngoo_gender', 'kadin');
          localStorage.setItem('pending_gender', 'kadin');
          const isRealStreamer = Boolean(currentProfile?.avatar || localStorage.getItem(`pyngoo_streamer_avatar_${uid}`) || currentProfile?.is_streamer);
          if (isRealStreamer) {
            localStorage.setItem(`pyngoo_is_streamer_${uid}`, 'true');
            localStorage.setItem(`pyngoo_role_${uid}`, 'streamer');
          } else {
            localStorage.removeItem(`pyngoo_is_streamer_${uid}`);
          }
        } else if (currentProfile?.gender) {
          localStorage.setItem('pyngoo_gender', currentProfile.gender);
        }

        if (currentProfile) {
          localStorage.setItem(`pyngoo_user_profile_${uid}`, JSON.stringify(currentProfile));
          if (currentProfile.avatar) {
            localStorage.setItem(`pyngoo_avatar_${uid}`, currentProfile.avatar);
            localStorage.setItem(`pyngoo_streamer_avatar_${uid}`, currentProfile.avatar);
          }
        }
        
        // Yeni giriş yapan bu cihazın oturumunu aktif kıl ve eski cihazları uyar
        setSessionTerminated(false);
        if (isExplicitLogin || !serverActiveDeviceId || serverActiveDeviceId !== myDeviceId) {
          if (eventType !== 'USER_UPDATED') {
            claimAndBroadcastSession(uid, currentProfile?.display_name).catch(() => {});
          }
        }

        localStorage.removeItem('pyngoo_force_claim_device');
        sessionStorage.removeItem('pyngoo_force_claim_device');

        if (isOAuthRedirect && window.history?.replaceState) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // 5. Kullanıcının dil tercihini anında senkronize et (Türkiye ise Türkçe, vb.)
        const profileLang = currentProfile?.preferred_language || 
                           urlLang || 
                           localStorage.getItem('pending_language') || 
                           localStorage.getItem('i18nextLng') || 
                           detectUserDefaultLanguage();

        if (profileLang) {
          if (i18n.language !== profileLang) {
            console.log(`[i18n] Kullanıcı dili güncellendi: ${profileLang}`);
            i18n.changeLanguage(profileLang);
          }
          localStorage.setItem('i18nextLng', profileLang);
          localStorage.setItem('pending_language', profileLang);
          document.documentElement.lang = profileLang;
        }

        setUserProfile(currentProfile);
        setUserId(uid);
        setShowAuth(false);
        setLoading(false);
      } else {
        // EĞER URL HASH İÇERİSİNDE access_token VARSA doğrudan JWT çözerek oturum kur
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
          try {
            const hashCleaned = window.location.hash.replace(/^#\/?/, '').replace(/\?/g, '&');
            const hashParams = new URLSearchParams(hashCleaned);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken) {
              const payload = parseJwt(accessToken);
              if (payload && payload.sub) {
                console.log("App.tsx: handleSession içinde JWT çözüldü:", payload.sub);
                const activeSession = {
                  access_token: accessToken,
                  refresh_token: refreshToken || '',
                  expires_at: payload.exp || Math.floor(Date.now() / 1000) + 3600,
                  expires_in: 3600,
                  token_type: 'bearer',
                  user: {
                    id: payload.sub,
                    email: payload.email || payload.user_metadata?.email || '',
                    app_metadata: payload.app_metadata || {},
                    user_metadata: payload.user_metadata || {},
                    aud: payload.aud || 'authenticated',
                    role: payload.role || 'authenticated'
                  }
                };
                try {
                  localStorage.setItem('sb-rdqcwzosmikusketghyq-auth-token', JSON.stringify(activeSession));
                } catch (_) {}
                // Not: Zaten handleSession kilidi altında olduğumuz için burada doğrudan
                // handleSessionInner çağrılır; dıştaki handleSession'ı çağırmak kilit yüzünden atlanır.
                await handleSessionInner(activeSession, 'SIGNED_IN');
                return;
              }
            }
          } catch (_) {}
        }

        setUserId(null);
        setUserProfile(null);
        if (typeof window !== 'undefined') {
          const s = window.location.search;
          const h = window.location.hash;
          // access_token ASLA bir hata değildir! Sadece gerçek hata durumlarında temizle:
          if (s.includes('error=') || s.includes('bad_oauth_state') || h.includes('error=') || h.includes('error_description')) {
            try {
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k && (k.includes('code-verifier') || k.includes('oauth') || k.includes('auth-token') || k.startsWith('sb-'))) {
                  localStorage.removeItem(k);
                }
              }
            } catch (_) {}
            if (window.history?.replaceState) {
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }
        }
        setLoading(false);
      }
    };

    // Güvenlik zaman aşımı: Hiçbir koşulda spinner'ın 4 saniyeden fazla dönmesine izin verme
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    // 1. OAuth Dönüşü (PKCE Code veya Hash Access Token):
    const initializeAuth = async () => {
      // A. Eğer URL Query veya Hash içerisinde PKCE 'code' varsa (Google / Apple PKCE akışı):
      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const hashCleaned = window.location.hash ? window.location.hash.replace(/^#\/?/, '').replace(/\?/g, '&') : '';
        const hashParams = new URLSearchParams(hashCleaned);
        const authCode = urlParams.get('code') || hashParams.get('code');

        if (authCode) {
          console.log("App.tsx: URL içerisinden PKCE auth code tespit edildi, oturum takas ediliyor...");
          try {
            const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 3500));
            const result: any = await Promise.race([
              supabase.auth.exchangeCodeForSession(authCode),
              timeout
            ]);
            if (result && result.data?.session && !result.error) {
              console.log("App.tsx: exchangeCodeForSession başarılı, oturum kuruldu.");
              await handleSession(result.data.session, 'SIGNED_IN');
              return;
            }
          } catch (codeErr) {
            console.warn("App.tsx: exchangeCodeForSession hata verdi:", codeErr);
          }
        }
      }

      // B. Eğer URL Hash içerisinde access_token varsa (Implicit Grant):
      if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
        try {
          const hashCleaned = window.location.hash.replace(/^#\/?/, '').replace(/\?/g, '&');
          const hashParams = new URLSearchParams(hashCleaned);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          if (accessToken) {
            console.log("App.tsx: URL Hash içerisinden access_token tespit edildi, önce supabase.auth.setSession deneniyor...");

            // Güvenlik: Önce SDK'nın gerçek setSession'ı denenmeli (auto-refresh döngüsünü kurar).
            if (refreshToken) {
              try {
                const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 2500));
                const result: any = await Promise.race([
                  supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }),
                  timeout
                ]);
                if (result && result.data?.session && !result.error) {
                  console.log("App.tsx: supabase.auth.setSession başarılı, birincil oturum kuruldu.");
                  await handleSession(result.data.session, 'SIGNED_IN');
                  return;
                }
                console.warn("App.tsx: setSession başarısız/zaman aşımına uğradı, JWT fallback devrede.");
              } catch (err) {
                console.warn("App.tsx: setSession hata verdi, JWT fallback devrede.", err);
              }
            }

            const payload = parseJwt(accessToken);
            if (payload && payload.sub) {
              const activeSession = {
                access_token: accessToken,
                refresh_token: refreshToken || '',
                expires_at: payload.exp || Math.floor(Date.now() / 1000) + 3600,
                expires_in: 3600,
                token_type: 'bearer',
                user: {
                  id: payload.sub,
                  email: payload.email || payload.user_metadata?.email || '',
                  app_metadata: payload.app_metadata || {},
                  user_metadata: payload.user_metadata || {},
                  aud: payload.aud || 'authenticated',
                  role: payload.role || 'authenticated'
                }
              };

              try {
                const storageKey = 'sb-rdqcwzosmikusketghyq-auth-token';
                localStorage.setItem(storageKey, JSON.stringify(activeSession));
              } catch (_) {}

              await handleSession(activeSession, 'SIGNED_IN');
              return;
            }
          }
        } catch (err) {
          console.error("App.tsx: setSession hash hatası:", err);
        }
      }

      // 2. Normal getSession kontrolü
      const { data: { session } } = await supabase.auth.getSession();
      handleSession(session, 'INITIAL_SESSION');
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase arka plan token yenileme uyuşmazlığında oluşan SIGNED_OUT olayının
      // aktif kullanıcının oturumunu ezmesine KESİNLİKLE izin verme!
      if (event === 'SIGNED_OUT') {
        const isExplicitUserLogout = sessionStorage.getItem('pyngoo_explicit_logout') === 'true';
        if (!isExplicitUserLogout) {
          console.warn('App.tsx: Arka plan SIGNED_OUT olayı yok sayıldı (oturum korunuyor).');
          return;
        }
      }
      if (session) {
        handleSession(session, event);
      }
    });

    // 3. Mobil Uygulama Deep Link (pyngoo://auth-callback) Dinleyicisi (In-App OAuth Dönüşü)
    let appUrlSub: any = null;
    if (Capacitor.isNativePlatform()) {
      appUrlSub = CapApp.addListener('appUrlOpen', async (data) => {
        console.log('[CapApp] appUrlOpen alındı:', data.url);
        try {
          await Browser.close();
        } catch (_) {}

        try {
          const rawUrl = data.url;
          if (!rawUrl) return;

          let hashPart = '';
          let queryPart = '';
          if (rawUrl.includes('#')) {
            const splitHash = rawUrl.split('#');
            hashPart = splitHash[1] || '';
            queryPart = splitHash[0].includes('?') ? splitHash[0].split('?')[1] : '';
          } else if (rawUrl.includes('?')) {
            queryPart = rawUrl.split('?')[1] || '';
          }

          const combinedString = [hashPart, queryPart].filter(Boolean).join('&');
          const combinedParams = new URLSearchParams(combinedString);
          const code = combinedParams.get('code');
          const accessToken = combinedParams.get('access_token');
          const refreshToken = combinedParams.get('refresh_token');

          if (code) {
            console.log('[CapApp] Deep link üzerinden PKCE code yakalandı, oturum kuruluyor...');
            try {
              const res = await supabase.auth.exchangeCodeForSession(code);
              if (res.data?.session) {
                await handleSession(res.data.session, 'SIGNED_IN');
                return;
              }
            } catch (err) {
              console.warn('[CapApp] exchangeCodeForSession hatası:', err);
            }
          }

          if (accessToken) {
            console.log('[CapApp] Deep link üzerinden access_token yakalandı, oturum kuruluyor...');
            if (refreshToken) {
              try {
                const res = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
                if (res.data?.session) {
                  await handleSession(res.data.session, 'SIGNED_IN');
                  return;
                }
              } catch (_) {}
            }

            const payload = parseJwt(accessToken);
            if (payload && payload.sub) {
              const activeSession = {
                access_token: accessToken,
                refresh_token: refreshToken || '',
                expires_at: payload.exp || Math.floor(Date.now() / 1000) + 3600,
                expires_in: 3600,
                token_type: 'bearer',
                user: {
                  id: payload.sub,
                  email: payload.email || payload.user_metadata?.email || '',
                  app_metadata: payload.app_metadata || {},
                  user_metadata: payload.user_metadata || {},
                  aud: payload.aud || 'authenticated',
                  role: payload.role || 'authenticated'
                }
              };
              try {
                localStorage.setItem('sb-rdqcwzosmikusketghyq-auth-token', JSON.stringify(activeSession));
              } catch (_) {}
              await handleSession(activeSession, 'SIGNED_IN');
            }
          }
        } catch (err) {
          console.error('[CapApp] appUrlOpen işleme hatası:', err);
        }
      });
    }

    return () => {
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      if (appUrlSub) {
        appUrlSub.then((s: any) => s.remove()).catch(() => {});
      }
    };
  }, []);

  // Tek Oturum (Single Active Session) Dinleyicisi - Çift Katmanlı Koruma (Realtime + Auth Metadata)
  useEffect(() => {
    if (!userId) return;

    const myDeviceId = getOrCreateDeviceId();

    const terminateThisSession = async () => {
      console.warn('Oturum başka bir cihazdan açıldığı için bu cihaz sonlandırılıyor.');
      setSessionTerminated(true);
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (_) {}
      localStorage.removeItem('pyngoo_dev_uid');
      localStorage.removeItem('pyngoo_admin_verified');
      sessionStorage.removeItem('pyngoo_mod_auth');
      sessionStorage.removeItem('pyngoo_mod_session');
      sessionStorage.removeItem('pyngoo_is_omer');
      setUserId(null);
      setUserProfile(null);
    };

    // 1. Gerçek zamanlı Supabase Broadcast dinleyicisi (Milisaniye hızında anında kapatır)
    const sessionChannel = supabase.channel(`user_session_${userId}`)
      .on('broadcast', { event: 'force_logout' }, (data: any) => {
        const issuer = data?.payload?.issuerDeviceId;
        // Eğer bildirim bu cihazın kendisinden geldiyse KESİNLİKLE KENDİNİ ATMA!
        if (issuer && issuer === myDeviceId) {
          return;
        }
        // Eğer bildirim başka bir cihazdan (örn: telefondan bilgisayara veya bilgisayardan telefona) geldiyse eskiyi kapat!
        if (issuer && issuer !== myDeviceId) {
          console.warn(`[SingleSession] Başka cihazdan (${issuer}) anında oturum kapatma emri alındı.`);
          terminateThisSession();
        }
      })
      .subscribe();

    // 2. Kalıcı Auth Metadata & Liveness Kontrolü (Uyku modu, arka planda kalan sekmeler için garantili koruma)
    const checkOwnership = async () => {
      try {
        if (Date.now() - moduleLastSessionClaimedAt < 30000) {
          return;
        }
        const { data: authData, error } = await supabase.auth.getUser();
        if (error || !authData?.user) return;
        const serverDeviceId = authData.user.user_metadata?.active_device_id;
        if (serverDeviceId && serverDeviceId !== myDeviceId) {
          console.warn(`[SingleSession] Aktif cihaz uyuşmazlığı: Sunucu=${serverDeviceId}, Yerel=${myDeviceId}. Kapatılıyor.`);
          terminateThisSession();
        }
      } catch (_) {}
    };

    // Nano katman kuralı: periyodik polling YOK. Anlık cihaz çakışması yukarıdaki realtime broadcast
    // kanalıyla yakalanır; bu kontrol yalnızca sekme/uygulama öne geldiğinde (uyku sonrası kopmuş
    // bağlantılara karşı) yedek olarak çalışır.
    const onFocus = () => checkOwnership();
    const onVisChange = () => {
      if (!document.hidden) checkOwnership();
    };
    const onConflictEvent = () => {
      terminateThisSession();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisChange);
    window.addEventListener('pyngoo_session_conflict', onConflictEvent);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisChange);
      window.removeEventListener('pyngoo_session_conflict', onConflictEvent);
      try {
        supabase.removeChannel(sessionChannel);
      } catch (_) {}
    };
  }, [userId]);

  // Gerçek Zamanlı Kullanıcı Silinme ve Yasaklanma Dinleyicisi (Supabase DB + Auth Realtime & Periyodik Doğrulama)
  useEffect(() => {
    if (!userId) return;

    // 1. Supabase Postgres Realtime Dinleyicisi (profiles tablosunda DELETE veya UPDATE olunca anında yakalar)
    const deletionChannel = supabase.channel(`user_profile_deletion_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        async (payload: any) => {
          if (payload.eventType === 'DELETE') {
            // Supabase Realtime DELETE olaylarında filtre uygulanmaz; başka bir kullanıcının silinmesi herkesi atmasın.
            if (payload.old?.id !== userId) return;
            console.warn(`[App.tsx] Profil veritabanından silindi. Oturum kapatılıyor.`);
            await purgeUserSession("Hesabınız daha önce silinmiştir.");
          } else if (payload.new) {
            if (payload.new.role === 'deleted') {
              console.warn(`[App.tsx] Profil role='deleted' oldu. Oturum kapatılıyor.`);
              await purgeUserSession("Hesabınız daha önce silinmiştir.");
            } else if (payload.new.is_banned === true) {
              console.warn(`[App.tsx] Profil askıya alındı. Oturum kapatılıyor.`);
              await purgeUserSession("Hesabınız askıya alınmıştır.");
            }
          }
        }
      )
      .subscribe();

    // 2. Periyodik DB Doğrulama Kontrolü (Sadece kesin silinme ve ban durumlarını yakalar)
    const verifyUserStillExists = async () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      try {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, role, is_banned')
          .eq('id', userId)
          .maybeSingle();

        // Yalnızca veritabanından kesin olarak silinmiş yanıtı gelirse oturumu kapat:
        if (profileData && profileData.role === 'deleted') {
          console.warn(`[App.tsx] Profiles tablosunda role='deleted'. Oturum kapatılıyor.`);
          await purgeUserSession("Hesabınız daha önce silinmiştir.");
          return;
        }

        // Yalnızca veritabanından kesin olarak askıya alınmış yanıtı gelirse:
        if (profileData && profileData.is_banned === true) {
          console.warn(`[App.tsx] Profiles tablosunda is_banned=true. Oturum kapatılıyor.`);
          await purgeUserSession("Hesabınız askıya alınmıştır.");
          return;
        }
      } catch (_) {}
    };

    // Performans/Bağlantı Havuzu: Silinme/ban durumu zaten yukarıdaki realtime kanalıyla
    // (postgres_changes) ANINDA yakalanıyor. Ayrıca sürekli çalışan bir zamanlayıcıya gerek yok;
    // yalnızca kullanıcı sekmeye geri döndüğünde (odak/görünürlük) bir kez daha teyit yeterli
    // (realtime bağlantısı arka planda/uyku modunda kopmuş olabilir).
    const onFocus = () => verifyUserStillExists();
    const onVisChange = () => {
      if (!document.hidden) verifyUserStillExists();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisChange);
      try {
        supabase.removeChannel(deletionChannel);
      } catch (_) {}
    };
  }, [userId]);

  // 1 Saatlik Oturum & İnaktivite Süresi ve Yayıncı Çevrim İçi Kalp Atışı (Heartbeat)
  useEffect(() => {
    if (!userId) return;

    // İnaktivite kontrolü yapan yardımcı fonksiyon (1 saat = 3600000 ms)
    const checkInactivityTimeout = (): boolean => {
      const lastStamp = localStorage.getItem('pyngoo_last_session_active_at');
      if (lastStamp) {
        const elapsed = Date.now() - Number(lastStamp);
        if (elapsed > 60 * 60 * 1000) {
          console.warn(`App.tsx: ${Math.round(elapsed / 60000)} dakikadır inaktif. 1 saatlik oturum süresi doldu.`);
          purgeUserSession("1 saatlik inaktivite süresi doldu.");
          return true;
        }
      }
      return false;
    };

    // 1. Etkileşim olduğu sürece oturum aktiflik zamanını güncelle (En fazla 30 saniyede bir)
    let lastStampUpdate = 0;
    const updateActiveTimestamp = () => {
      // ÖNCE inaktivite dolmuş mu bak! (Safari background uyanışında touch/click ile saati ezmeden önce!)
      if (checkInactivityTimeout()) return;

      const now = Date.now();
      if (now - lastStampUpdate > 30000) {
        lastStampUpdate = now;
        localStorage.setItem('pyngoo_last_session_active_at', now.toString());
      }
    };

    // Sayfa/Sekme Görünür Olduğunda veya Odaklandığında ANINDA İnaktivite Kontrolü Yap (Safari / Arka plan uyanışları)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkInactivityTimeout();
      }
    };

    updateActiveTimestamp();

    window.addEventListener('mousemove', updateActiveTimestamp);
    window.addEventListener('keydown', updateActiveTimestamp);
    window.addEventListener('touchstart', updateActiveTimestamp);
    window.addEventListener('click', updateActiveTimestamp);
    window.addEventListener('scroll', updateActiveTimestamp);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // 2. Her 1 dakikada bir 1 saatlik inaktivite aşımı kontrolü yap
    const inactivityTimer = setInterval(() => {
      checkInactivityTimeout();
    }, 60000);

    // 3. Yayıncı Çevrim İçi Kalp Atışı (25 saniyede bir DB güncellemesi & sekme kapanışında offline yapma)
    const isStreamer = localStorage.getItem(`pyngoo_is_streamer_${userId}`) === 'true' ||
                       localStorage.getItem(`pyngoo_role_${userId}`) === 'streamer';

    let streamerHeartbeatTimer: any = null;
    if (isStreamer) {
      streamerHeartbeatTimer = setInterval(async () => {
        try {
          const isOnline = localStorage.getItem(`pyngoo_streamer_online_${userId}`) !== 'false';
          await supabase.from('profiles').update({
            is_streamer_online: isOnline,
            last_active_at: new Date().toISOString()
          }).eq('id', userId);
        } catch (_) {}
      }, 25000);

      // Uygulamaya girişte yayıncı çevrimiçiyse takipçilerine "çevrimiçi oldu" bildirimi
      if (localStorage.getItem(`pyngoo_streamer_online_${userId}`) !== 'false') {
        notifyFollowers('online');
      }
    }

    return () => {
      window.removeEventListener('mousemove', updateActiveTimestamp);
      window.removeEventListener('keydown', updateActiveTimestamp);
      window.removeEventListener('touchstart', updateActiveTimestamp);
      window.removeEventListener('click', updateActiveTimestamp);
      window.removeEventListener('scroll', updateActiveTimestamp);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      clearInterval(inactivityTimer);
      if (streamerHeartbeatTimer) clearInterval(streamerHeartbeatTimer);
    };
  }, [userId]);

  const handleLogout = () => {
    sessionStorage.setItem('pyngoo_explicit_logout', 'true');
    const currentUid = userId;

    // 1. Yerel durumu ve oturumu ANINDA sıfırla (0 milisaniye gecikme)
    setUserId(null);
    setUserProfile(null);
    setShowAuth(false);

    try {
      const devId = localStorage.getItem('pyngoo_client_device_id');
      localStorage.clear();
      sessionStorage.clear();
      if (devId) localStorage.setItem('pyngoo_client_device_id', devId);
      document.cookie = "p_nick=; path=/; max-age=0";
      document.cookie = "p_gen=; path=/; max-age=0";
      document.cookie = "p_role=; path=/; max-age=0";
      document.cookie = "p_lang=; path=/; max-age=0";
      document.cookie = "p_auth_mode=; path=/; max-age=0";
    } catch (_) {}

    // 2. Anında ana sayfaya yönlendir (Kullanıcı asla 5 saniye beklemez)
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }

    // 3. Veritabanı ve Supabase Auth çıkış işlemlerini arka planda asenkron tamamla
    (async () => {
      try {
        await unregisterPushToken();
        if (currentUid) {
          await supabase.from('profiles').update({
            is_streamer_online: false,
            last_active_at: new Date().toISOString()
          }).eq('id', currentUid);
          await supabase.from('waiting_room').delete().eq('user_id', currentUid);
        }
        await supabase.auth.signOut();
      } catch (_) {}
    })();
  };

  // /moderator veya /admin yolları pyngoo.app ana alan adında kesinlikle barındırılmaz (yalnızca admin.pyngoo.app subdomaininde açılır).
  // Ana sitede bu yollara gelen istekler anında ana sayfaya temizlenir.
  if (typeof window !== 'undefined' && !isAdminHost && (
    window.location.pathname.startsWith('/moderator') || 
    window.location.pathname.startsWith('/admin') ||
    window.location.hash.includes('admin') ||
    window.location.hash.includes('moderator')
  )) {
    window.history.replaceState(null, '', '/');
  }

  if (loading) {
    return (
      <>
        <div className="loading-screen"><div className="spinner"></div></div>
        <NetworkStatusModal />
      </>
    );
  }

  // Başka Cihazdan Giriş Yapıldığında Gösterilecek Güvenlik Modalı (Tek Oturum Kontrolü)
  if (sessionTerminated) {
    return (
      <>
        <div style={{
          minHeight: '100vh',
          background: '#0a0a14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: '#fff',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '440px',
            width: '100%',
            background: 'rgba(255,255,255,0.03)',
            padding: '40px 28px',
            borderRadius: '24px',
            border: '1px solid rgba(255,107,0,0.35)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{
              width: '74px', height: '74px', borderRadius: '50%',
              background: 'rgba(255,107,0,0.15)', border: '2px solid #ff6b00',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <Smartphone size={38} color="#ff6b00" />
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '800', marginBottom: '12px', color: '#fff' }}>
              {t('session_conflict_title')}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '28px' }}>
              {t('session_conflict_desc')}
            </p>
            <button
              onClick={() => {
                localStorage.setItem('pyngoo_force_claim_device', 'true');
                setSessionTerminated(false);
                setShowAuth(true);
              }}
              style={{
                width: '100%',
                padding: '14px 28px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #ff6b00, #ff8800)',
                border: 'none',
                color: '#fff', cursor: 'pointer', fontWeight: '800',
                fontSize: '1rem',
                boxShadow: '0 8px 20px rgba(255,107,0,0.35)'
              }}
            >
              {t('session_conflict_btn')}
            </button>
          </div>
        </div>
        <NetworkStatusModal />
      </>
    );
  }

  // Kullanıcı Yasaklandıysa (Banlı Hesap Ekranı)
  if (userProfile?.is_banned) {
    return (
      <>
        <div style={{
          minHeight: '100vh',
          background: '#0a0a14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          color: '#fff',
          textAlign: 'center'
        }}>
          <div style={{
            maxWidth: '440px',
            background: 'rgba(255,255,255,0.03)',
            padding: '40px 28px',
            borderRadius: '24px',
            border: '1px solid rgba(255,45,85,0.3)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)'
          }}>
            <div style={{
              width: '74px', height: '74px', borderRadius: '50%',
              background: 'rgba(255,45,85,0.2)', border: '2px solid #ff2d55',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px auto'
            }}>
              <ShieldAlert size={38} color="#ff2d55" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '12px' }}>
              {t('banned_title')}
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '28px' }}>
              {t('banned_desc')}
            </p>
            <button
              onClick={handleLogout}
              style={{
                padding: '12px 28px', borderRadius: '14px',
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', cursor: 'pointer', fontWeight: '700'
              }}
            >
              {t('profile_logout')}
            </button>
          </div>
        </div>
        <NetworkStatusModal />
      </>
    );
  }

  const handleAuthSuccess = async (id: string, initialProfile?: any) => {
    localStorage.setItem('pyngoo_force_claim_device', 'true');
    setSessionTerminated(false);
    // Güvenlik: Cihaz mühürleme render/yükleme akışını senkron kitlememeli, arka planda yürütülmeli.
    claimAndBroadcastSession(id).catch(() => {});

    const savedStr = localStorage.getItem(`pyngoo_user_profile_${id}`);
    let savedProfile: any = null;
    try { savedProfile = savedStr ? JSON.parse(savedStr) : null; } catch (_) {}

    const isOmer = id === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b' || id === '22b3c0e7-e1e2-4cb5-9532-990066b5a80c';
    const isApoo = id === '16cd9b54-a051-4548-a3ad-d34f4b5b9ab4';

    const isKadin = !isOmer && !isApoo && (localStorage.getItem('pyngoo_gender') === 'kadin' || 
                    localStorage.getItem('pending_gender') === 'kadin' ||
                    savedProfile?.gender === 'kadin' || 
                    initialProfile?.gender === 'kadin');

    let effectiveProfile = initialProfile || savedProfile || {
      id: id,
      display_name: isOmer ? 'omer' : (isApoo ? 'apoo' : (localStorage.getItem('pending_nickname') || 'Kullanıcı')),
      gender: (isOmer || isApoo) ? 'erkek' : (isKadin ? 'kadin' : 'erkek'),
      role: isOmer ? 'admin' : (isApoo ? 'moderator' : (isKadin ? 'streamer' : 'user')),
      is_moderator: isApoo ? true : false,
      total_gold: 0,
      total_diamonds: 0,
      free_extensions: 2,
      preferred_language: 'tr',
      is_premium: false
    };

    if (isOmer) {
      effectiveProfile.gender = 'erkek';
      effectiveProfile.role = 'admin';
      localStorage.setItem('pyngoo_gender', 'erkek');
      localStorage.setItem('pending_gender', 'erkek');
      localStorage.removeItem(`pyngoo_is_streamer_${id}`);
      localStorage.removeItem(`pyngoo_streamer_online_${id}`);
      localStorage.removeItem(`pyngoo_streamer_avatar_${id}`);
      localStorage.setItem(`pyngoo_role_${id}`, 'admin');
      try {
        document.cookie = "p_gen=erkek; path=/; max-age=86400; SameSite=Lax";
        document.cookie = "p_role=admin; path=/; max-age=86400; SameSite=Lax";
      } catch (_) {}
    } else if (isApoo) {
      effectiveProfile.gender = 'erkek';
      effectiveProfile.role = 'moderator';
      effectiveProfile.is_moderator = true;
      localStorage.setItem('pyngoo_gender', 'erkek');
      localStorage.setItem('pending_gender', 'erkek');
      localStorage.removeItem(`pyngoo_is_streamer_${id}`);
      localStorage.removeItem(`pyngoo_streamer_online_${id}`);
      localStorage.removeItem(`pyngoo_streamer_avatar_${id}`);
      localStorage.setItem(`pyngoo_role_${id}`, 'moderator');
      try {
        document.cookie = "p_gen=erkek; path=/; max-age=86400; SameSite=Lax";
        document.cookie = "p_role=moderator; path=/; max-age=86400; SameSite=Lax";
      } catch (_) {}
    } else if (isKadin) {
      effectiveProfile.gender = 'kadin';
      localStorage.setItem('pyngoo_gender', 'kadin');
      const isRealStreamer = Boolean(effectiveProfile?.avatar || localStorage.getItem(`pyngoo_streamer_avatar_${id}`) || effectiveProfile?.is_streamer);
      if (isRealStreamer) {
        effectiveProfile.role = 'streamer';
        localStorage.setItem(`pyngoo_is_streamer_${id}`, 'true');
        localStorage.setItem(`pyngoo_role_${id}`, 'streamer');
      } else {
        effectiveProfile.role = 'user';
        localStorage.removeItem(`pyngoo_is_streamer_${id}`);
        localStorage.removeItem(`pyngoo_role_${id}`);
      }
    }

    localStorage.setItem(`pyngoo_user_profile_${id}`, JSON.stringify(effectiveProfile));

    try {
      const { data: dbProfile } = await supabase.from('profiles').select('*').eq('id', id).single();
      if (dbProfile) {
        if (isOmer) {
          dbProfile.gender = 'erkek';
          dbProfile.role = 'admin';
          try {
            await supabase.from('profiles').update({ gender: 'erkek', role: 'admin' }).eq('id', id);
          } catch (_) {}
        } else if (isKadin && dbProfile.gender !== 'kadin') {
          dbProfile.gender = 'kadin';
          dbProfile.role = 'streamer';
          try {
            await supabase.from('profiles').update({ gender: 'kadin', role: 'streamer' }).eq('id', id);
          } catch (_) {}
        }
        effectiveProfile = dbProfile;
      }
    } catch (_) {}

    if (effectiveProfile?.avatar) {
      localStorage.setItem(`pyngoo_avatar_${id}`, effectiveProfile.avatar);
      localStorage.setItem(`pyngoo_streamer_avatar_${id}`, effectiveProfile.avatar);
    }

    setUserProfile(effectiveProfile);
    setUserId(id);
    setShowAuth(false);
  };

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: '#0a0a14',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999, gap: '16px'
      }}>
        <div style={{
          width: '50px', height: '50px',
          border: '3px solid rgba(0, 242, 254, 0.15)',
          borderTopColor: '#00f2fe',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.92rem', fontWeight: 'bold' }}>
          {t('loading', 'Yükleniyor...')}
        </span>
      </div>
    );
  }

  if (!userId) {
    const isOAuthInProgress = typeof window !== 'undefined' && (
      window.location.hash.includes('access_token') ||
      window.location.hash.includes('code=') ||
      window.location.search.includes('code=') ||
      window.location.search.includes('oauth_login=')
    );

    if (!showAuth && !Capacitor.isNativePlatform() && !isOAuthInProgress) {
      return (
        <>
          <LandingPage onStartApp={() => setShowAuth(true)} />
          <NetworkStatusModal />
        </>
      );
    }

    return (
      <div className="app-wrapper" style={{ position: 'relative' }}>
        {!Capacitor.isNativePlatform() && (
          <div style={{ position: 'absolute', top: '15px', left: '15px', zIndex: 100 }}>
            <button 
              type="button"
              onClick={() => {
                setShowAuth(false);
                try {
                  window.history.replaceState({}, document.title, '/');
                } catch (_) {}
              }}
              style={{ 
                background: 'rgba(255,255,255,0.1)', 
                border: '1px solid rgba(255,255,255,0.2)', 
                color: 'white', 
                padding: '6px 14px', 
                borderRadius: '20px', 
                cursor: 'pointer', 
                fontSize: '0.85rem' 
              }}
            >
              {t('landing_back_btn')}
            </button>
          </div>
        )}
        <Login onLogin={handleAuthSuccess} />
        {/* Mobil uygulamada bildirim izni ilk açılışta (girişten önce) sorulur */}
        {Capacitor.isNativePlatform() && <PushPermissionPrompt userId={null} />}
        <NetworkStatusModal />
      </div>
    );
  }

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout userId={userId} />}>
            <Route index element={<Home userId={userId} />} />
            <Route path="explore" element={<Explore userId={userId} />} />
            <Route path="chats" element={<Chats userId={userId} />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="market" element={<Market userId={userId} />} />
            <Route path="profile" element={<Profile userId={userId} onLogout={handleLogout} />} />
            <Route path="host-center" element={<HostCenter userId={userId} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <PushPermissionPrompt userId={userId} />
        <PushOpenBridge />
      </BrowserRouter>
      <NetworkStatusModal />
    </>
  );
}

export default App;
