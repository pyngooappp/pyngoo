import { useState, useRef, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { InAppAuth } from '@ccatto/capacitor-inapp-auth';
import { supabase } from '../lib/supabase';
import { Mail, Camera, ArrowLeft, ShieldCheck, CheckCircle, ChevronDown, XCircle, Check, ArrowRight, AlertCircle, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as faceapi from 'face-api.js';
import LegalModal from '../components/LegalModal';
import { detectUserDefaultLanguage } from '../utils/i18n';
import { sendNewRegistrationToTelegram } from '../utils/telegramAlert';

interface LoginProps {
  onLogin: (userId: string, initialProfile?: any) => void;
}

// Orijinal Google 4 Renkli Logo SVG
const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
  </svg>
);

// Orijinal Apple Logo SVG
const AppleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 170 170" fill="currentColor" style={{ flexShrink: 0 }}>
    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.6-7.76-11.71-14.16-6.3-9.88-11.24-21.43-14.81-34.64-3.57-13.22-5.36-25.07-5.36-35.56 0-16.73 4.23-30.46 12.69-41.19 8.46-10.74 19.12-16.27 31.98-16.6 4.9 0 10.37 1.25 16.42 3.75 6.04 2.5 10.15 3.8 12.33 3.91 1.74 0 6.08-1.42 13.03-4.25 6.95-2.84 12.87-4.14 17.76-3.92 13.91.76 25.04 5.76 33.39 15.01-12.18 7.4-18.17 17.63-17.96 30.68.22 10.23 4.13 18.94 11.75 26.13 7.61 7.18 16.86 11.21 27.74 12.08-2.29 7.07-5.33 14.65-9.13 22.75zM119.22 33.56c0-7.72 2.76-14.92 8.27-21.6 5.51-6.68 12.29-11.08 20.34-13.2-1.09 7.51-4.02 14.54-8.81 21.08-4.79 6.53-11.09 10.9-18.91 13.12-.22-.76-.55-1.57-.89-2.4v-3z" />
  </svg>
);

// Net Vektör Türk Bayrağı SVG (Windows'ta bozulmaz, her ekranda pırıl pırıl görünür)
const TurkishFlag = () => (
  <svg width="22" height="15" viewBox="0 0 1200 800" style={{ borderRadius: '3px', flexShrink: 0, display: 'inline-block' }}>
    <rect width="1200" height="800" fill="#E30A17"/>
    <circle cx="425" cy="400" r="200" fill="#ffffff"/>
    <circle cx="475" cy="400" r="160" fill="#E30A17"/>
    <polygon points="583.33,400 706.77,440.11 659.84,319.89 659.84,480.11 706.77,359.89" fill="#ffffff"/>
  </svg>
);

// Desteklenen Ülkeler Listesi
const COUNTRIES = [
  { code: 'tr', name: 'Türkiye', flagUrl: 'https://flagcdn.com/w40/tr.png' },
  { code: 'en', name: 'English', flagUrl: 'https://flagcdn.com/w40/gb.png' },
  { code: 'de', name: 'Deutschland', flagUrl: 'https://flagcdn.com/w40/de.png' },
  { code: 'fr', name: 'France', flagUrl: 'https://flagcdn.com/w40/fr.png' },
  { code: 'es', name: 'España', flagUrl: 'https://flagcdn.com/w40/es.png' },
  { code: 'ru', name: 'Россия', flagUrl: 'https://flagcdn.com/w40/ru.png' },
  { code: 'ar', name: 'العربية', flagUrl: 'https://flagcdn.com/w40/sa.png' },
  { code: 'az', name: 'Azərbaycan', flagUrl: 'https://flagcdn.com/w40/az.png' },
  { code: 'it', name: 'Italia', flagUrl: 'https://flagcdn.com/w40/it.png' },
  { code: 'pt', name: 'Brasil / Portugal', flagUrl: 'https://flagcdn.com/w40/br.png' },
];

export default function Login({ onLogin }: LoginProps) {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sekmeler & Görünüm Modu
  const [isLoginMode, setIsLoginMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search);
      if (p.get('mode') === 'register') return false;
      if (p.get('mode') === 'login') return true;
    }
    return false;
  }); // false: Kayıt Ol, true: Giriş Yap
  const [isEmailMode, setIsEmailMode] = useState(false); // E-posta tıklandığında açılır

  // Form Alanları - Çıkış yapıldığında veya sayfa açıldığında her zaman tertemiz ve BOŞ gelsin
  const [nickname, setNickname] = useState('');
  const [nicknameStatus, setNicknameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'too_short' | 'error'>('idle');
  const [gender, setGender] = useState<'erkek' | 'kadin' | null>(null);
  const [selectedCountry, setSelectedCountry] = useState(() => {
    const auto = detectUserDefaultLanguage();
    const current = (localStorage.getItem('i18nextLng') || localStorage.getItem('pending_language') || i18n.language || auto).toLowerCase();
    const found = COUNTRIES.find(c => current.startsWith(c.code));
    return found ? found.code : auto;
  });
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isTermsAccepted, setIsTermsAccepted] = useState(true);

  // Modallar
  const [showKvkkModal, setShowKvkkModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Kadınlar İçin Apple Face ID Biyometrik Doğrulama
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiStep, setAiStep] = useState<'info' | 'camera'>('info');
  const [faceStep, setFaceStep] = useState<'center' | 'right' | 'left' | 'smile' | 'success'>('center');
  const [faceProgress, setFaceProgress] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState('');
  const [isFaceVerified, setIsFaceVerified] = useState(false);
  const [isMaleDetected, setIsMaleDetected] = useState(false);
  const [pendingAuthAction, setPendingAuthAction] = useState<(() => void) | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stepTimerRef = useRef<any>(null);
  const detectIntervalRef = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showNotFoundModal, setShowNotFoundModal] = useState(false);
  const [showAccountDeletedModal, setShowAccountDeletedModal] = useState(false);

  // URL'de deleted=1 veya not_found=1 varsa ilgili modalı aç & Eski kullanıcı adı artıklarını temizle
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!window.location.search.includes('oauth_login') && !window.location.hash.includes('access_token')) {
      localStorage.removeItem('pending_nickname');
      localStorage.removeItem('pending_gender');
      localStorage.removeItem('pending_role');
    }
    if (params.get('email_taken') === '1') {
      const existingName = params.get('name') || '';
      const msg = existingName 
        ? t('login_err_email_taken_with_name', `⚠️ Bu hesap ile zaten kayıtlı bir profiliniz bulunmaktadır! (@${existingName}). Lütfen 'Giriş Yap' sekmesinden hesabınıza bağlanın.`, { name: existingName })
        : t('login_err_email_taken', "⚠️ Bu hesap ile zaten kayıtlı bir profiliniz bulunmaktadır! Lütfen 'Giriş Yap' sekmesinden giriş yapın.");
      setError(msg);
      setIsLoginMode(true);
      setIsEmailMode(false);
      setShowNotFoundModal(false);
      const newUrl = window.location.pathname + '?mode=login';
      window.history.replaceState({}, document.title, newUrl);
    } else if (params.get('server_busy') === '1') {
      setError(t('login_err_server_busy', "⚠️ Sunucuya şu an ulaşılamıyor. Lütfen birkaç saniye sonra tekrar deneyin."));
      setIsLoginMode(true);
      const newUrl = window.location.pathname + '?mode=login';
      window.history.replaceState({}, document.title, newUrl);
    } else if (params.get('deleted') === '1') {
      setShowAccountDeletedModal(true);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (params.get('not_found') === '1') {
      setShowNotFoundModal(true);
      setIsLoginMode(false);
      const newUrl = window.location.pathname + (params.get('mode') ? `?mode=${params.get('mode')}` : '');
      window.history.replaceState({}, document.title, newUrl);
    }

    // Google / Apple OAuth dönüşünde kullanıcının veritabanında kaydı yoksa bilgileri doldur ve Kayıt Ol moduna al
    const checkOAuthUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          const userMeta = data.user.user_metadata;
          const oauthName = userMeta?.display_name || userMeta?.user_name;
          if (oauthName && !nickname) {
            setNickname(oauthName);
          }
          if (data.user.email && !email) {
            setEmail(data.user.email);
          }
        }
      } catch (_) {}
    };
    checkOAuthUser();
  }, []);

  // Dışarı tıklayınca ülke menüsünü kapat
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCountryItem = COUNTRIES.find(c => c.code === selectedCountry) || COUNTRIES[0];

  // Kullanıcı adı kontrolü. Sonuç: true = alınmış, false = müsait, null = kontrol edilemedi (hata/zaman aşımı)
  const checkNicknameTaken = async (name: string): Promise<boolean | null> => {
    const cleanName = name.trim().toLowerCase();
    if (!cleanName) return false;

    // Sunucu 520 verip hiç yanıt vermezse bile isteğin sonsuza dek asılı kalmasını engelle.
    const withTimeout = <T,>(p: PromiseLike<T>, ms: number): Promise<T> =>
      Promise.race([
        Promise.resolve(p),
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
      ]);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // GÜVENLİK: profiles tablosu artık anonim (girişsiz) okumaya KAPALI.
        // İsim kontrolü sunucu tarafındaki check_nickname_taken RPC ile yapılır.
        const { data, error } = await withTimeout(
          supabase.rpc('check_nickname_taken', { p_nickname: cleanName }),
          4000
        ) as { data: { taken?: boolean } | null; error: any };

        if (error) throw error;
        return data?.taken === true;
      } catch (err) {
        console.warn(`İsim kontrolü denemesi ${attempt + 1}/3 başarısız:`, err);
        if (attempt < 2) {
          await new Promise(res => setTimeout(res, 500 * (attempt + 1)));
        }
      }
    }

    // Sunucuya 3 denemede de ulaşılamadı: ASLA "müsait" diye gösterme, belirsiz olarak işaretle.
    return null;
  };

  // Kullanıcı Adını Anlık Canlı Sorgulama (Yazarken otomatik kontrol)
  useEffect(() => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setNicknameStatus('idle');
      return;
    }
    if (trimmed.length < 3) {
      setNicknameStatus('too_short');
      return;
    }

    let cancelled = false;
    setNicknameStatus('checking');
    const timer = setTimeout(async () => {
      const isTaken = await checkNicknameTaken(trimmed);
      if (cancelled) return;
      if (isTaken === null) {
        setNicknameStatus('error');
      } else if (isTaken) {
        setNicknameStatus('taken');
      } else {
        setNicknameStatus('available');
      }
    }, 300);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [nickname]);

  // Ön Koşulları Kontrol Et ve Aksiyonu Çalıştır
  const checkPreconditionsAndRun = async (action: () => void) => {
    setError(null);
    setSuccess(null);

    // Giriş Modu
    if (isLoginMode) {
      action();
      return;
    }
    
    // Kayıt Modu Kontrolleri
    if (!nickname.trim()) {
      setError(t('login_err_nickname'));
      return;
    }
    if (nickname.trim().length < 3) {
      setError(t('login_err_nickname_len'));
      return;
    }
    if (!gender) {
      setError(t('login_err_gender'));
      return;
    }
    if (!isTermsAccepted) {
      setError(t('login_err_terms'));
      return;
    }
    
    setLoading(true);
    const isTaken = await checkNicknameTaken(nickname);
    setLoading(false);
    
    if (isTaken === null) {
      setError(t('login_nickname_check_failed', '⚠️ Kullanıcı adı kontrol edilemedi, lütfen tekrar deneyin.'));
      setNicknameStatus('error');
      return;
    }
    if (isTaken) {
      setError(t('login_err_taken'));
      return;
    }
    
    // E-posta ile kayıt olunuyorsa ve e-posta adresi doluysa önceden veritabanında var mı kontrol et (Yüz taramasına boşuna sokma!)
    if (email.trim() && email.includes('@')) {
      setLoading(true);
      try {
        const { data: checkRes } = await supabase.rpc('check_email_exists', { p_email: email.trim() });
        if (checkRes && checkRes.exists) {
          const existingName = checkRes.display_name || '';
          const msg = existingName 
            ? t('login_err_email_taken_with_name', `⚠️ Bu hesap ile zaten kayıtlı bir profiliniz bulunmaktadır! (@${existingName}). Lütfen 'Giriş Yap' sekmesinden hesabınıza bağlanın.`, { name: existingName })
            : t('login_err_email_taken', "⚠️ Bu e-posta adresi ile zaten kayıtlı aktif bir hesap var! Lütfen 'Giriş Yap' sekmesinden şifrenizle giriş yapın.");
          setError(msg);
          setIsLoginMode(true);
          setIsEmailMode(true);
          setLoading(false);
          return;
        }
      } catch (_) {}
      setLoading(false);
    }
    
    // Kadın kullanıcılarda ZORUNLU yüz doğrulaması
    if (gender === 'kadin' && !isFaceVerified) {
      setPendingAuthAction(() => action);
      setAiStep('info');
      setShowAiModal(true);
      return;
    }
    
    action();
  };

  // E-posta ile Kayıt & Giriş İşlemi
  const executeEmailAuth = async () => {
    setError(null);
    setSuccess(null);

    if (!email.trim() || !email.includes('@')) {
      setError(t('login_err_email'));
      return;
    }
    if (!password || password.length < 6) {
      setError(t('login_err_password'));
      return;
    }

    const activeGender = gender || localStorage.getItem('pending_gender') || localStorage.getItem('pyngoo_gender') || 'erkek';
    const isKadin = activeGender === 'kadin';

    if (!isLoginMode) {
      localStorage.setItem('pending_gender', activeGender);
      localStorage.setItem('pyngoo_gender', activeGender);
      if (isKadin) {
        localStorage.setItem('pending_role', 'streamer');
      }
      localStorage.setItem('pending_nickname', nickname.trim());
      localStorage.setItem('pending_language', selectedCountry);
    }
    localStorage.setItem('has_visited', 'true');

    localStorage.setItem('pyngoo_force_claim_device', 'true');
    try {
      setLoading(true);

      if (!isLoginMode) {
        // Ayrılmış ve yetkili kullanıcı adlarını koru
        const cleanNick = nickname.trim().toLowerCase();
        const RESERVED_NAMES = ['omer', 'ömer', 'apoo', 'apo', 'admin', 'moderator', 'mod', 'pyngoo', 'destek', 'support', 'sistem', 'system'];
        if (RESERVED_NAMES.includes(cleanNick)) {
          throw new Error(t('login_err_nickname_reserved'));
        }

        // ÖN KONTROL 1: Bu e-posta adresi ile zaten kayıtlı AKTİF bir profil var mı?
        try {
          const { data: checkRes } = await supabase.rpc('check_email_exists', { p_email: email.trim() });
          if (checkRes && checkRes.exists) {
            const existingName = checkRes.display_name || '';
            const msg = existingName 
              ? t('login_err_email_taken_with_name', `⚠️ Bu hesap ile zaten kayıtlı bir profiliniz bulunmaktadır! (@${existingName}). Lütfen 'Giriş Yap' sekmesinden hesabınıza bağlanın.`, { name: existingName })
              : t('login_err_email_taken', "⚠️ Bu e-posta adresi ile zaten kayıtlı aktif bir hesap var! Lütfen 'Giriş Yap' sekmesinden şifrenizle giriş yapın.");
            setError(msg);
            setIsLoginMode(true);
            setIsEmailMode(true);
            setLoading(false);
            return;
          }
        } catch (_) {}

        // ÖN KONTROL 2: Şifre ile giriş denemesi
        const { data: preSignInData } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password
        });

        if (preSignInData?.session?.user?.id) {
          const existingUid = preSignInData.session.user.id;
          const { data: existingProf } = await supabase.from('profiles').select('id, display_name, role').eq('id', existingUid).maybeSingle();
          if (existingProf && existingProf.role !== 'deleted') {
            await supabase.auth.signOut();
            setError(t('login_err_email_taken_with_name', `⚠️ Bu hesap ile zaten kayıtlı bir profiliniz bulunmaktadır! (@${existingProf.display_name}). Lütfen 'Giriş Yap' sekmesinden hesabınıza bağlanın.`, { name: existingProf.display_name }));
            setIsLoginMode(true);
            setIsEmailMode(true);
            setLoading(false);
            return;
          }
        }

        // KABUK HESAP KURTARMA: auth.users'ta kayıt var ama profiles'ta satır
        // yoksa (önceki yarım kalan deneme) kullanıcı "zaten kayıtlı" <->
        // "seni bulamadık" döngüsünde sıkışır. Bunu engellemek için aynı
        // şifreyle giriş deneyip profili sıfırdan oluşturuyoruz.
        const claimShellAccount = async (): Promise<
          { status: 'claimed'; uid: string } | { status: 'blocked'; name: string } | { status: 'failed' }
        > => {
          try {
            const { data: inData } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
            const uid = inData?.session?.user?.id;
            if (!uid) return { status: 'failed' };
            const { data: prof } = await supabase.from('profiles').select('id, display_name, role').eq('id', uid).maybeSingle();
            if (prof && prof.role !== 'deleted') {
              try { await supabase.auth.signOut(); } catch (_) {}
              return { status: 'blocked', name: prof.display_name || '' };
            }
            return { status: 'claimed', uid };
          } catch (_) {
            return { status: 'failed' };
          }
        };

        // Kayıt Ol
        let claimedShellUid: string | null = null;
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
          options: {
            data: {
              display_name: nickname.trim(),
              gender: isKadin ? 'kadin' : 'erkek',
              role: isKadin ? 'streamer' : 'user',
              preferred_language: selectedCountry
            }
          }
        });

        if (signUpErr) {
          const errMsg = signUpErr.message?.toLowerCase() || '';
          if (errMsg.includes('already') || errMsg.includes('registered') || errMsg.includes('exists') || errMsg.includes('kayıtlı')) {
            const shell = await claimShellAccount();
            if (shell.status === 'claimed') {
              claimedShellUid = shell.uid;
            } else if (shell.status === 'blocked') {
              setError(t('login_err_email_taken_with_name', `⚠️ Bu hesap ile zaten kayıtlı bir profiliniz bulunmaktadır! (@${shell.name}). Lütfen 'Giriş Yap' sekmesinden hesabınıza bağlanın.`, { name: shell.name }));
              setIsLoginMode(true);
              setIsEmailMode(true);
              setLoading(false);
              return;
            } else {
              setError(t('login_err_email_taken', "⚠️ Bu e-posta adresi ile zaten kayıtlı aktif bir hesap var! Lütfen 'Giriş Yap' sekmesinden şifrenizle giriş yapın."));
              setIsLoginMode(true);
              setIsEmailMode(true);
              setLoading(false);
              return;
            }
          } else {
            throw signUpErr;
          }
        } else {
          // KABUK HESAP: e-posta auth tarafinda kayitli ama profili yoksa
          // Supabase bos `identities` dondurur. Eskiden bu dal kullaniciyi
          // "zaten kayitli" -> "seni bulamadik" dongusune sokuyordu.
          const isEmailAlreadyRegisteredInAuth = Boolean(data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0);

          if (isEmailAlreadyRegisteredInAuth) {
            try { await supabase.auth.signOut(); } catch (_) {}
            const shell = await claimShellAccount();
            if (shell.status === 'claimed') {
              claimedShellUid = shell.uid;
            } else if (shell.status === 'blocked') {
              setError(t('login_err_email_taken_with_name', `⚠️ Bu hesap ile zaten kayıtlı bir profiliniz bulunmaktadır! (@${shell.name}). Lütfen 'Giriş Yap' sekmesinden hesabınıza bağlanın.`, { name: shell.name }));
              setIsLoginMode(true);
              setIsEmailMode(true);
              setLoading(false);
              return;
            } else {
              setError(t('login_err_email_taken', "⚠️ Bu e-posta adresi ile zaten kayıtlı aktif bir hesap var! Lütfen 'Giriş Yap' sekmesinden şifrenizle giriş yapın."));
              setIsLoginMode(true);
              setIsEmailMode(true);
              setLoading(false);
              return;
            }
          }
        }

        let newUid = claimedShellUid || data?.session?.user?.id || data?.user?.id;

        // Session dönmediyse anında şifreyle giriş dene
        if (!newUid) {
          const { data: signInData } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password: password
          });
          if (signInData?.session?.user) {
            newUid = signInData.session.user.id;
          }
        }

        if (newUid) {
          // Zaten var olan AKTİF profil var mı kontrol et
          const { data: existingProf } = await supabase.from('profiles').select('id, display_name, role').eq('id', newUid).maybeSingle();

          if (existingProf && existingProf.role !== 'deleted') {
            await supabase.auth.signOut();
            setError(t('login_err_email_taken_with_name', `⚠️ Bu hesap ile zaten kayıtlı bir profiliniz bulunmaktadır! (@${existingProf.display_name}). Lütfen 'Giriş Yap' sekmesinden hesabınıza bağlanın.`, { name: existingProf.display_name }));
            setIsLoginMode(true); // Kullanıcıyı doğrudan Giriş Yap sekmesine geçir
            setIsEmailMode(true);
            setLoading(false);
            return;
          }

          // Profil silinmişti veya yoktu -> Yeni seçilen rumuz ve cinsiyet ile SIFIRDAN PROFİL OLUŞTUR!
          const profilePayload = {
            id: newUid,
            display_name: nickname.trim() || `User_${newUid.slice(0, 4)}`,
            gender: isKadin ? 'kadin' : 'erkek',
            role: isKadin ? 'streamer' : 'user',
            preferred_language: selectedCountry,
            total_gold: 0,
            total_diamonds: 0,
            free_extensions: 2
          };

          // Supabase Auth metadata'yı yeni rumuz ile güncelle (Google Ad-Soyad verisini tamamen mühürle!)
          try {
            await supabase.auth.updateUser({
              data: {
                full_name: nickname.trim(),
                name: nickname.trim(),
                display_name: nickname.trim(),
                user_name: nickname.trim(),
                gender: isKadin ? 'kadin' : 'erkek',
                role: isKadin ? 'streamer' : 'user'
              }
            });
          } catch (_) {}

          // Profil hafızaya ve veritabanına mühürlenir
          localStorage.setItem(`pyngoo_user_profile_${newUid}`, JSON.stringify(profilePayload));
          localStorage.setItem('pyngoo_gender', isKadin ? 'kadin' : 'erkek');
          localStorage.setItem('pending_gender', isKadin ? 'kadin' : 'erkek');
          localStorage.setItem('pending_nickname', profilePayload.display_name);
          if (isKadin) {
            localStorage.setItem(`pyngoo_role_${newUid}`, 'streamer');
            localStorage.setItem('pending_role', 'streamer');
            localStorage.removeItem(`pyngoo_is_streamer_${newUid}`);
            localStorage.removeItem(`pyngoo_streamer_avatar_${newUid}`);
          }

          try {
            await supabase.from('profiles').upsert([profilePayload]);
          } catch (_) {}

          // Yeni kayıt bildirimi Telegram'a gönderilir (asenkron, UI'ı bekletmez)
          sendNewRegistrationToTelegram({
            displayName: profilePayload.display_name,
            userId: newUid!,
            gender: profilePayload.gender,
            authMethod: 'E-posta',
            preferredLanguage: selectedCountry,
            email: email.trim()
          }).catch(() => {});

          localStorage.setItem('pyngoo_just_registered', 'true');
          setSuccess(t('login_success_profile_created'));
          setTimeout(() => onLogin(newUid!, profilePayload), 300);
          return;
        }

      } else {
        // Giriş Yap
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password
        });

        if (signInErr) {
          setError(t('login_err_invalid_credentials', 'Girdiğiniz e-posta adresi veya şifre hatalı. Lütfen tekrar deneyin.'));
          setLoading(false);
          return;
        }

        if (data?.session?.user) {
          const authUid = data.session.user.id;

          // Veritabanında profil kontrolü: Silinmiş veya veritabanında olmayan hesaplar
          const { data: checkProf, error: checkErr } = await supabase
            .from('profiles')
            .select('id, role, is_banned')
            .eq('id', authUid)
            .maybeSingle();

          if (checkProf?.role === 'deleted') {
            try { await supabase.rpc('delete_user_account'); } catch (_) {}
            await supabase.auth.signOut();
            const devId = localStorage.getItem('pyngoo_client_device_id');
            localStorage.clear();
            sessionStorage.clear();
            if (devId) localStorage.setItem('pyngoo_client_device_id', devId);
            setShowAccountDeletedModal(true);
            setIsLoginMode(false); // Kayıt Ol sekmesine geçir
            setIsEmailMode(true);
            return;
          }

          if (checkErr || !checkProf) {
            await supabase.auth.signOut();
            const devId = localStorage.getItem('pyngoo_client_device_id');
            localStorage.clear();
            sessionStorage.clear();
            if (devId) localStorage.setItem('pyngoo_client_device_id', devId);
            setShowNotFoundModal(true);
            setIsLoginMode(false); // Kayıt Ol sekmesine geçir
            setLoading(false);
            return;
          }

          if (checkProf?.is_banned === true) {
            await supabase.auth.signOut();
            const devId = localStorage.getItem('pyngoo_client_device_id');
            localStorage.clear();
            sessionStorage.clear();
            if (devId) localStorage.setItem('pyngoo_client_device_id', devId);
            alert(t('account_banned_alert'));
            return;
          }

          const userMeta = data.session.user.user_metadata;
          const isMetaKadin = userMeta?.gender === 'kadin' || localStorage.getItem('pyngoo_gender') === 'kadin';
          if (isMetaKadin) {
            try {
              await supabase.from('profiles').update({
                gender: 'kadin',
                role: 'user',
                is_streamer: false
              }).eq('id', authUid);
            } catch (_) {}
            localStorage.setItem('pyngoo_gender', 'kadin');
          }
          setSuccess(t('login_success_redirecting'));
          setTimeout(() => onLogin(authUid), 500);
        }
      }
    } catch (err: any) {
      setError(err.message || t('login_err_generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleEmailFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkPreconditionsAndRun(executeEmailAuth);
  };

  // Google OAuth ile Giriş
  const executeOAuthLogin = async (provider: 'google' | 'apple') => {
    const activeGender = gender || localStorage.getItem('pending_gender') || localStorage.getItem('pyngoo_gender') || 'erkek';
    const isKadin = activeGender === 'kadin';
    const activeNick = nickname.trim() || localStorage.getItem('pending_nickname') || '';
    const activeLang = selectedCountry || localStorage.getItem('pending_language') || 'tr';

    // 1. localStorage'a yaz
    localStorage.setItem('pending_gender', activeGender);
    localStorage.setItem('pyngoo_gender', activeGender);
    localStorage.setItem('pending_role', isKadin ? 'streamer' : 'user');
    if (activeNick) localStorage.setItem('pending_nickname', activeNick);
    localStorage.setItem('pending_language', activeLang);
    localStorage.setItem('has_visited', 'true');
    localStorage.setItem('pyngoo_force_claim_device', 'true');
    sessionStorage.setItem('pyngoo_force_claim_device', 'true');
    
    const currentMode = isLoginMode ? 'login' : 'register';
    localStorage.setItem('pyngoo_auth_mode', currentMode);
    sessionStorage.setItem('pyngoo_auth_mode', currentMode);

    if (isLoginMode) {
      localStorage.removeItem('pyngoo_just_registered');
      sessionStorage.removeItem('pyngoo_just_signed_up');
      localStorage.removeItem('pending_nickname');
      localStorage.removeItem('pending_gender');
      localStorage.removeItem('pending_role');
      localStorage.removeItem('pyngoo_gender');
    } else {
      localStorage.setItem('pyngoo_just_registered', 'true');
      sessionStorage.setItem('pyngoo_just_signed_up', 'true');
      localStorage.setItem('pending_gender', activeGender);
      localStorage.setItem('pyngoo_gender', activeGender);
      localStorage.setItem('pending_role', isKadin ? 'streamer' : 'user');
      if (activeNick) localStorage.setItem('pending_nickname', activeNick);
    }

    // 2. Cookie'lere yaz (Cross-origin ve Safari OAuth redirect koruması!)
    try {
      const maxAge = 86400; // 24 saat
      if (!isLoginMode) {
        document.cookie = `p_gen=${encodeURIComponent(activeGender)}; path=/; max-age=${maxAge}; SameSite=Lax`;
        document.cookie = `p_role=${encodeURIComponent(isKadin ? 'streamer' : 'user')}; path=/; max-age=${maxAge}; SameSite=Lax`;
        if (activeNick) {
          document.cookie = `p_nick=${encodeURIComponent(activeNick)}; path=/; max-age=${maxAge}; SameSite=Lax`;
        }
      }
      document.cookie = `p_lang=${encodeURIComponent(activeLang)}; path=/; max-age=${maxAge}; SameSite=Lax`;
      document.cookie = `p_auth_mode=${encodeURIComponent(currentMode)}; path=/; max-age=600; SameSite=Lax`;
    } catch (_) {}

    // 3. Redirect URL'ine query param olarak ekle
    const redirectParams = new URLSearchParams();
    if (!isLoginMode) {
      redirectParams.set('p_gen', activeGender);
      redirectParams.set('p_role', isKadin ? 'streamer' : 'user');
      if (activeNick) redirectParams.set('p_nick', activeNick);
    }
    redirectParams.set('p_lang', activeLang);
    redirectParams.set('oauth_login', '1');
    redirectParams.set('auth_mode', currentMode);
    redirectParams.set('p_auth_mode', currentMode);

    const isNative = Capacitor.isNativePlatform();

    // 🍏 iOS Yerel Apple Girişi (Sıfır Safari, Sıfır Tarayıcı Barı - Doğrudan iOS Face ID / Apple Kimliği penceresi)
    if (provider === 'apple' && isNative && Capacitor.getPlatform() === 'ios') {
      try {
        setLoading(true);
        setError(null);
        const { AppleSignIn, SignInScope } = await import('@capawesome/capacitor-apple-sign-in');
        const appleRes = await AppleSignIn.signIn({
          scopes: [SignInScope.Email, SignInScope.FullName]
        });

        if (appleRes?.idToken) {
          const { data: authData, error: authErr } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: appleRes.idToken
          });
          if (authErr) throw authErr;
          if (authData?.session) {
            setLoading(false);
            return;
          }
        }
      } catch (nativeAppleErr: any) {
        console.warn("Yerel Apple Giriş hatası veya kullanıcı iptal etti:", nativeAppleErr);
        const errMsg = (nativeAppleErr?.message || '').toLowerCase();
        if (errMsg.includes('cancel') || errMsg.includes('iptal') || nativeAppleErr?.code === '1001') {
          setLoading(false);
          return;
        }
        // İptal edilmediyse yedek güvenli akışa geç
      }
    }

    // Mobilde doğrudan temiz sistem şeması pyngoo://auth-callback ile yönlendir!
    // Supabase panelindeki whitelist ile birebir eşleşmesi için sorgu parametresi (query param) ASLA eklenmez!
    const redirectUri = isNative
      ? 'pyngoo://auth-callback'
      : `${window.location.origin}/?${redirectParams.toString()}`;

    try {
      setLoading(true);
      setError(null);
      const optionsPayload: any = {
        redirectTo: redirectUri,
        skipBrowserRedirect: isNative
      };

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: optionsPayload
      });
      if (error) throw error;

      if (isNative && data?.url) {
        // 🍏 iOS için Apple'ın ASWebAuthenticationSession yerel kimlik doğrulama penceresini kullan
        // (Sıfır Safari uygulaması, sıfır alt tarayıcı barı, sıfır X butonu - işlem bitince otomatik kapanır!)
        if (Capacitor.getPlatform() === 'ios') {
          try {
            const authRes = await InAppAuth.start({
              url: data.url,
              callbackScheme: 'pyngoo'
            });

            if (authRes?.url) {
              const rawUrl = authRes.url;
              let hashPart = '';
              let queryPart = '';
              if (rawUrl.includes('#')) {
                const splitHash = rawUrl.split('#');
                hashPart = splitHash[1] || '';
                queryPart = splitHash[0].includes('?') ? splitHash[0].split('?')[1] : '';
              } else if (rawUrl.includes('?')) {
                queryPart = rawUrl.split('?')[1] || '';
              }

              const combinedParams = new URLSearchParams([hashPart, queryPart].filter(Boolean).join('&'));
              const code = combinedParams.get('code');
              const accessToken = combinedParams.get('access_token');
              const refreshToken = combinedParams.get('refresh_token');

              if (code) {
                const { data: codeData, error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
                if (codeErr) throw codeErr;
                if (codeData?.session) {
                  setLoading(false);
                  return;
                }
              } else if (accessToken) {
                await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken || ''
                });
                setLoading(false);
                return;
              }
            }
            setLoading(false);
            return;
          } catch (inAppErr: any) {
            console.warn("[InAppAuth] Hata veya iptal:", inAppErr);
            setLoading(false);
            return; // iOS'ta ASLA Safari Browser.open çağrılmaz!
          }
        }

        // Android platformu için Browser.open (iOS'ta asla çağrılmaz)
        if (Capacitor.getPlatform() === 'android') {
          setLoading(false);
          await Browser.open({
            url: data.url,
            presentationStyle: 'popover'
          });
        } else {
          setLoading(false);
        }
      }
    } catch (err: any) {
      setError(err.message || t('login_err_oauth_failed'));
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider: 'google' | 'apple') => {
    setError(null);
    setSuccess(null);

    // Giriş Yap modu -> Anında senkron olarak OAuth başlat (Safari gesture koruması!)
    if (isLoginMode) {
      executeOAuthLogin(provider);
      return;
    }

    // Kayıt Ol modu -> checkPreconditionsAndRun üzerinden tüm kontrolleri (cinsiyet, kullanıcı adı, e-posta & kadın AI yüz doğrulaması) çalıştır
    checkPreconditionsAndRun(() => executeOAuthLogin(provider));
  };

  // E-posta Moduna Geçiş
  const handleOpenEmailMode = () => {
    if (!isLoginMode) {
      if (!nickname.trim()) {
        setError(t('login_err_nickname'));
        return;
      }
      if (nickname.trim().length < 3) {
        setError(t('login_err_nickname_len'));
        return;
      }
      if (!gender) {
        setError(t('login_err_gender'));
        return;
      }
      if (!isTermsAccepted) {
        setError(t('login_err_terms'));
        return;
      }
    }
    setError(null);
    setIsEmailMode(true);
  };


  // Face ID Doğrulama Başarılı Ses Efekti (Apple iOS Face ID Çanı)
  const playFaceIdSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12); // A5
      gain2.gain.setValueAtTime(0.18, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } catch (_) {}
  };

  const stopCameraTracks = () => {
    if (stepTimerRef.current) {
      clearTimeout(stepTimerRef.current);
      stepTimerRef.current = null;
    }
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(t => t.stop());
      } catch (_) {}
      streamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      } catch (_) {}
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    stopCameraTracks();
    setIsMaleDetected(false);
    try {
      setAiLoading(true);
      setCameraError(null);
      setFaceStep('center');
      setFaceProgress(15);
      setAiMessage(t('login_ai_preparing'));

      // 1. Modelleri yükle (public/models klasöründen yerel ve anında yüklenir)
      try {
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
          await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        }
        if (!faceapi.nets.ageGenderNet.isLoaded) {
          await faceapi.nets.ageGenderNet.loadFromUri('/models');
        }
      } catch (mErr) {
        console.warn("Model yükleme uyarısı:", mErr);
      }

      // 2. Kamerayı başlat
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 640 }
        },
        audio: false
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (_) {}
      }
      setAiLoading(false);
      setFaceProgress(30);
      setAiMessage(t('login_ai_align_face'));

      // 3. Canlı Biyometrik Cinsiyet & Yüz Analiz Döngüsü
      let femaleConfirmedCount = 0;
      let checkCount = 0;

      detectIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || videoRef.current.paused || videoRef.current.ended) return;

        try {
          const detection = await faceapi.detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.35 })
          ).withAgeAndGender();

          checkCount++;

          if (detection) {
            const detectedGender = detection.gender; // 'male' or 'female'
            const prob = detection.genderProbability;

            // ERKEK ALGILANDI!
            if (detectedGender === 'male' && prob > 0.60) {
              if (detectIntervalRef.current) {
                clearInterval(detectIntervalRef.current);
                detectIntervalRef.current = null;
              }
              setIsMaleDetected(true);
              setFaceStep('center');
              setCameraError(t('login_ai_err_male'));
              setAiMessage(t('login_ai_msg_male'));
              return;
            }

            // KADIN ALGILANDI!
            if (detectedGender === 'female' && prob > 0.50) {
              femaleConfirmedCount++;
              setIsMaleDetected(false);
              setCameraError(null);

              if (femaleConfirmedCount === 1) {
                setFaceStep('right');
                setFaceProgress(60);
                setAiMessage(t('login_ai_msg_turn_right'));
              } else if (femaleConfirmedCount === 2) {
                setFaceStep('left');
                setFaceProgress(80);
                setAiMessage(t('login_ai_msg_turn_left'));
              } else if (femaleConfirmedCount >= 3) {
                if (detectIntervalRef.current) {
                  clearInterval(detectIntervalRef.current);
                  detectIntervalRef.current = null;
                }
                setFaceStep('success');
                setFaceProgress(100);
                setAiMessage(t('login_ai_msg_verified'));
                setIsFaceVerified(true);
                playFaceIdSuccessSound();

                if (typeof navigator !== 'undefined' && navigator.vibrate) {
                  try { navigator.vibrate([40, 80, 40]); } catch (_) {}
                }

                stopCameraTracks();

                setTimeout(() => {
                  setShowAiModal(false);
                  if (pendingAuthAction) {
                    const act = pendingAuthAction;
                    setPendingAuthAction(null);
                    act();
                  }
                }, 1000);
              }
            }
          } else {
            if (checkCount > 10) {
              setCameraError(t('login_ai_face_not_recognized', "⚠️ Yüz algılanamadı veya net görünmüyor. Lütfen aydınlık bir ortamda kameraya doğrudan bakın."));
              setAiMessage(t('login_ai_face_not_recognized', "⚠️ Yüz algılanamadı veya net görünmüyor. Lütfen aydınlık bir ortamda kameraya doğrudan bakın."));
            } else if (checkCount > 4) {
              setAiMessage(t('login_ai_msg_closer'));
            }
          }
        } catch (detErr) {
          console.warn("Face detection cycle error:", detErr);
        }
      }, 600);

    } catch (err: any) {
      console.warn("Kamera açılamadı:", err);
      setAiLoading(false);
      setCameraError(t('login_ai_cam_perm_err'));
      setAiMessage(t('login_ai_cam_perm_required'));
    }
  };

  useEffect(() => {
    if (showAiModal && aiStep === 'camera') {
      startCamera();
    } else {
      stopCameraTracks();
    }

    return () => {
      stopCameraTracks();
    };
  }, [showAiModal, aiStep]);

  const handleSwitchToMale = () => {
    stopCameraTracks();
    setGender('erkek');
    localStorage.setItem('pending_gender', 'erkek');
    localStorage.setItem('pyngoo_gender', 'erkek');
    setShowAiModal(false);
    setIsFaceVerified(false);
    if (pendingAuthAction) {
      const act = pendingAuthAction;
      setPendingAuthAction(null);
      setTimeout(() => act(), 100);
    }
  };

  const handleRetryAi = () => {
    setAiStep('camera');
    startCamera();
  };

  const renderLanguageDropdown = () => (
    <div style={{ marginBottom: '12px', position: 'relative', width: '100%' }} ref={dropdownRef}>
      <div 
        onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
        style={{
          width: '100%', padding: '10px 14px', borderRadius: '12px',
          border: isCountryDropdownOpen ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.2)',
          background: 'rgba(21, 22, 42, 0.95)', color: '#fff', fontSize: '0.90rem', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: isCountryDropdownOpen ? '0 0 10px rgba(0,242,254,0.25)' : 'none',
          boxSizing: 'border-box',
          transition: 'all 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {selectedCountryItem.code === 'tr' ? (
            <TurkishFlag />
          ) : (
            <img 
              src={selectedCountryItem.flagUrl} 
              alt="" 
              style={{ width: '22px', height: '15px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }} 
            />
          )}
          <span style={{ fontWeight: '700' }}>{selectedCountryItem.name}</span>
        </div>
        <ChevronDown size={18} color="rgba(255,255,255,0.7)" style={{ transform: isCountryDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </div>

      {isCountryDropdownOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 5px)', left: 0, right: 0,
          background: 'rgba(19, 20, 40, 0.98)', border: '1px solid rgba(255,255,255,0.2)',
          backdropFilter: 'blur(20px)',
          borderRadius: '14px', maxHeight: '210px', overflowY: 'auto',
          zIndex: 150, boxShadow: '0 12px 35px rgba(0,0,0,0.9)',
          padding: '4px',
          boxSizing: 'border-box'
        }}>
          {COUNTRIES.map((c) => (
            <div
              key={c.code}
              onClick={() => {
                setSelectedCountry(c.code);
                i18n.changeLanguage(c.code);
                localStorage.setItem('i18nextLng', c.code);
                localStorage.setItem('pending_language', c.code);
                document.documentElement.lang = c.code;
                setIsCountryDropdownOpen(false);
              }}
              style={{
                padding: '9px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                cursor: 'pointer',
                borderRadius: '8px',
                background: selectedCountry === c.code ? 'rgba(0, 242, 254, 0.18)' : 'transparent',
                color: selectedCountry === c.code ? '#00f2fe' : '#ffffff',
                fontSize: '0.88rem',
                fontWeight: selectedCountry === c.code ? '800' : '500',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = selectedCountry === c.code ? 'rgba(0, 242, 254, 0.18)' : 'transparent'; }}
            >
              {c.code === 'tr' ? (
                <TurkishFlag />
              ) : (
                <img 
                  src={c.flagUrl} 
                  alt="" 
                  style={{ width: '22px', height: '15px', borderRadius: '3px', objectFit: 'cover', flexShrink: 0 }} 
                />
              )}
              <span>{c.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="login-container" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom)) 16px',
      overflow: 'hidden',
      overscrollBehavior: 'none',
      touchAction: 'none',
      boxSizing: 'border-box'
    }}>
      <div className="glow-circle glow-1"></div>
      <div className="glow-circle glow-2"></div>

      <div className="login-card glassmorphism" style={{ 
        padding: '28px 24px', 
        width: '92%', 
        maxWidth: '400px', 
        borderRadius: '24px',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}>
        
        {/* Logo ve Başlık */}
        <div className="logo-container" style={{ textAlign: 'center', marginBottom: '16px' }}>
          <div style={{ marginBottom: '8px' }}>
            <img src="/logo.png" alt="Pyngoo Logo" className="pyngoo-logo-image" style={{ width: '60px', height: '60px', borderRadius: '16px' }} />
          </div>
          <h1 style={{ fontSize: '2rem', margin: 0, fontWeight: '900', letterSpacing: '-0.5px' }}>Pyngoo</h1>
          <p className="subtitle" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>
            {isLoginMode ? t('login_subtitle_signin') : t('login_subtitle_signup')}
          </p>
        </div>

        {/* Sekmeler: Giriş Yap | Kayıt Ol */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '20px' }}>
          <button 
            type="button"
            onClick={() => { setIsLoginMode(false); setIsEmailMode(false); setError(null); setSuccess(null); }}
            style={{ 
              background: 'transparent', border: 'none', 
              borderBottom: !isLoginMode ? '2px solid #00f2fe' : '2px solid transparent', 
              color: !isLoginMode ? '#00f2fe' : 'rgba(255,255,255,0.5)', 
              fontSize: '1.05rem', fontWeight: '800', paddingBottom: '6px', cursor: 'pointer', transition: 'all 0.2s' 
            }}
          >
            {t('login_signup')}
          </button>
          <button 
            type="button"
            onClick={() => { 
              setIsLoginMode(true); 
              setIsEmailMode(false); 
              setError(null); 
              setSuccess(null);
              localStorage.removeItem('pyngoo_just_registered');
              sessionStorage.removeItem('pyngoo_just_signed_up');
              localStorage.removeItem('pending_nickname');
              localStorage.removeItem('pending_gender');
              localStorage.removeItem('pending_role');
            }}
            style={{ 
              background: 'transparent', border: 'none', 
              borderBottom: isLoginMode ? '2px solid #00f2fe' : '2px solid transparent', 
              color: isLoginMode ? '#00f2fe' : 'rgba(255,255,255,0.5)', 
              fontSize: '1.05rem', fontWeight: '800', paddingBottom: '6px', cursor: 'pointer', transition: 'all 0.2s' 
            }}
          >
            {t('login_signin')}
          </button>
        </div>

        {/* KAYIT OL MODU - ADIM 1 (Kullanıcı Adı, Cinsiyet) */}
        {!isLoginMode && !isEmailMode && (
          <div style={{ animation: 'fadeIn 0.3s ease', marginBottom: '18px' }}>
            
            {/* Kullanıcı Adı (Canlı Doğrulama ve Yeşil Tik / Kırmızı Uyarı) */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ position: 'relative' }}>
                <input 
                  type="text" 
                  placeholder={t('login_nickname_placeholder')} 
                  value={nickname}
                  onChange={e => {
                    const val = e.target.value;
                    setNickname(val);
                    localStorage.setItem('pending_nickname', val.trim());
                    try {
                      document.cookie = `p_nick=${encodeURIComponent(val.trim())}; path=/; max-age=86400; SameSite=Lax`;
                    } catch (_) {}
                  }}
                  maxLength={20}
                  style={{ 
                    width: '100%', padding: '12px 42px 12px 16px', borderRadius: '12px', 
                    border: nicknameStatus === 'taken' 
                      ? '2px solid #ff2d55' 
                      : nicknameStatus === 'available' 
                      ? '2px solid #2ecc71' 
                      : '1px solid rgba(255,255,255,0.2)', 
                    background: nicknameStatus === 'taken' 
                      ? 'rgba(255, 45, 85, 0.10)' 
                      : nicknameStatus === 'available' 
                      ? 'rgba(46, 204, 113, 0.10)' 
                      : 'rgba(0,0,0,0.3)', 
                    color: 'white', fontSize: '0.95rem',
                    textAlign: 'center', outline: 'none',
                    boxShadow: nicknameStatus === 'taken' 
                      ? '0 0 14px rgba(255, 45, 85, 0.35)' 
                      : nicknameStatus === 'available' 
                      ? '0 0 14px rgba(46, 204, 113, 0.35)' 
                      : 'none',
                    transition: 'all 0.25s'
                  }}
                />

                {/* Sağ Taraf Canlı Gösterge İkonu */}
                <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                  {nicknameStatus === 'checking' && (
                    <div style={{ 
                      width: '18px', height: '18px', 
                      border: '2px solid rgba(255,255,255,0.25)', 
                      borderTopColor: '#00f2fe', borderRadius: '50%', 
                      animation: 'spin 0.8s linear infinite' 
                    }} />
                  )}
                  {nicknameStatus === 'available' && (
                    <CheckCircle size={20} color="#2ecc71" style={{ filter: 'drop-shadow(0 0 4px rgba(46,204,113,0.6))' }} />
                  )}
                  {nicknameStatus === 'taken' && (
                    <XCircle size={20} color="#ff2d55" style={{ filter: 'drop-shadow(0 0 4px rgba(255,45,85,0.6))' }} />
                  )}
                  {nicknameStatus === 'error' && (
                    <XCircle size={20} color="#f5a623" style={{ filter: 'drop-shadow(0 0 4px rgba(245,166,35,0.6))' }} />
                  )}
                </div>
              </div>

              {/* Canlı Durum Alt Uyarısı */}
              {nicknameStatus === 'taken' && (
                <div style={{ color: '#ff416c', fontSize: '0.78rem', marginTop: '5px', textAlign: 'center', fontWeight: '800' }}>
                  {t('login_nickname_taken')}
                </div>
              )}
              {nicknameStatus === 'available' && (
                <div style={{ color: '#2ecc71', fontSize: '0.78rem', marginTop: '5px', textAlign: 'center', fontWeight: '800' }}>
                  {t('login_nickname_available')}
                </div>
              )}
              {nicknameStatus === 'error' && (
                <div style={{ color: '#f5a623', fontSize: '0.78rem', marginTop: '5px', textAlign: 'center', fontWeight: '800' }}>
                  {t('login_nickname_check_failed', '⚠️ Kullanıcı adı kontrol edilemedi, lütfen tekrar deneyin.')}
                </div>
              )}
              {nicknameStatus === 'too_short' && (
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.74rem', marginTop: '4px', textAlign: 'center' }}>
                  {t('login_nickname_min_chars')}
                </div>
              )}
            </div>

            {/* Cinsiyet Butonları */}
            <div style={{ display: 'flex', gap: '10px', width: '100%', marginBottom: '12px' }}>
              <button 
                type="button"
                onClick={() => {
                  setGender('erkek');
                  localStorage.setItem('pending_gender', 'erkek');
                  localStorage.setItem('pyngoo_gender', 'erkek');
                  localStorage.setItem('pending_role', 'user');
                  try {
                    document.cookie = "p_gen=erkek; path=/; max-age=86400; SameSite=Lax";
                    document.cookie = "p_role=user; path=/; max-age=86400; SameSite=Lax";
                  } catch (_) {}
                }}
                style={{ 
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: gender === 'erkek' ? '2px solid #00f2fe' : '1px solid rgba(255,255,255,0.2)',
                  background: gender === 'erkek' ? 'rgba(0, 242, 254, 0.2)' : 'rgba(0,0,0,0.25)',
                  color: gender === 'erkek' ? '#00f2fe' : 'white', cursor: 'pointer', fontWeight: '800',
                  fontSize: '0.92rem'
                }}
              >
                👦 {t('login_male')}
              </button>
              <button 
                type="button"
                onClick={() => {
                  setGender('kadin');
                  localStorage.setItem('pending_gender', 'kadin');
                  localStorage.setItem('pyngoo_gender', 'kadin');
                  localStorage.setItem('pending_role', 'streamer');
                  try {
                    document.cookie = "p_gen=kadin; path=/; max-age=86400; SameSite=Lax";
                    document.cookie = "p_role=streamer; path=/; max-age=86400; SameSite=Lax";
                  } catch (_) {}
                }}
                style={{ 
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: gender === 'kadin' ? '2px solid #ff416c' : '1px solid rgba(255,255,255,0.2)',
                  background: gender === 'kadin' ? 'rgba(255, 65, 108, 0.2)' : 'rgba(0,0,0,0.25)',
                  color: gender === 'kadin' ? '#ff416c' : 'white', cursor: 'pointer', fontWeight: '800',
                  fontSize: '0.92rem'
                }}
              >
                👧 {t('login_female')}
              </button>
            </div>

            {/* Orijinal Dil Seçici (Cinsiyet Seçiminin Altında, Sözleşme Onayının Üstünde) */}
            {renderLanguageDropdown()}

            {/* 18+ ve Sözleşme Onayı */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '8px 10px', borderRadius: '10px' }}>
              <input 
                type="checkbox" 
                id="kvkk" 
                checked={isTermsAccepted} 
                onChange={(e) => setIsTermsAccepted(e.target.checked)} 
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
              <label htmlFor="kvkk" style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', lineHeight: '1.3' }}>
                <span style={{ color: '#00f2fe', fontWeight: 'bold' }}>[18+]</span> <span onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }} style={{ textDecoration: 'underline', color: '#00f2fe' }}>{t('login_terms_label_terms')}</span>{t('login_terms_label_and')}<span onClick={(e) => { e.preventDefault(); setShowKvkkModal(true); }} style={{ textDecoration: 'underline', color: '#00f2fe' }}>{t('login_terms_label_privacy')}</span>{t('login_terms_label_confirm')}
              </label>
            </div>
          </div>
        )}

        {/* Hata ve Başarı Mesajları */}
        {error && (
          <div style={{ 
            color: '#ff4b72', fontSize: '0.86rem', textAlign: 'center', fontWeight: '700',
            background: 'rgba(255, 75, 114, 0.15)', padding: '12px 14px', borderRadius: '14px', 
            border: '1px solid rgba(255, 75, 114, 0.45)', marginBottom: '16px',
            boxShadow: '0 4px 18px rgba(255, 75, 114, 0.25)', lineHeight: '1.45'
          }}>
            {error.startsWith('⚠️') ? error : `⚠️ ${error}`}
          </div>
        )}

        {success && (
          <div style={{ 
            color: '#00f2fe', fontSize: '0.86rem', textAlign: 'center', fontWeight: '700',
            background: 'rgba(0, 242, 254, 0.12)', padding: '12px 14px', borderRadius: '14px', 
            border: '1px solid rgba(0, 242, 254, 0.35)', marginBottom: '16px' 
          }}>
            {success}
          </div>
        )}

        {/* E-POSTA FORMU */}
        {isEmailMode ? (
          <form onSubmit={handleEmailFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input 
              type="email" 
              placeholder={t('login_email')} 
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ 
                width: '100%', padding: '13px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', 
                background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.95rem', outline: 'none' 
              }}
              autoFocus
            />
            <input 
              type="password" 
              placeholder={t('login_password')} 
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ 
                width: '100%', padding: '13px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.2)', 
                background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '0.95rem', outline: 'none' 
              }}
            />
            <button 
              type="submit" 
              disabled={loading}
              style={{ 
                width: '100%', padding: '14px', borderRadius: '14px', border: 'none',
                background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                color: '#050510', fontSize: '1rem', fontWeight: '900', cursor: 'pointer',
                boxShadow: '0 8px 25px rgba(0, 242, 254, 0.35)', marginTop: '4px'
              }}
            >
              {loading ? t('login_processing') : (!isLoginMode ? `🚀 ${t('login_signup')}` : `🔑 ${t('login_signin')}`)}
            </button>
            <button 
              type="button" 
              onClick={() => { setIsEmailMode(false); setError(null); }}
              style={{ 
                background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', 
                cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px' 
              }}
            >
              <ArrowLeft size={16} /> {t('login_btn_back_options')}
            </button>
          </form>
        ) : (
          /* SOSYAL GİRİŞ BUTONLARI (Orijinal Google, Apple, E-posta Logolu) */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              type="button"
              onClick={() => handleOAuthLogin('apple')}
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', 
                padding: '13px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.25)', 
                background: '#000', color: 'white', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(0,0,0,0.4)', transition: 'all 0.2s'
              }}
            >
              <AppleIcon />
              <span>{isLoginMode ? t('login_btn_apple_signin') : t('login_btn_apple_signup')}</span>
            </button>

            <button 
              type="button"
              onClick={() => handleOAuthLogin('google')}
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', 
                padding: '13px', borderRadius: '14px', border: 'none', background: 'white', 
                color: '#111', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(255,255,255,0.15)', transition: 'all 0.2s'
              }}
            >
              <GoogleIcon />
              <span>{isLoginMode ? t('login_btn_google_signin') : t('login_btn_google_signup')}</span>
            </button>

            <button 
              type="button"
              onClick={handleOpenEmailMode}
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', 
                padding: '13px', borderRadius: '14px', border: '1px solid rgba(0, 242, 254, 0.4)', 
                background: 'rgba(0, 242, 254, 0.10)', color: 'white', fontWeight: '800', fontSize: '0.95rem', cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Mail size={20} color="#00f2fe" />
              <span>{isLoginMode ? t('login_btn_email_signin') : t('login_btn_email_signup')}</span>
            </button>
          </div>
        )}

        {/* Giriş Yap Modunda Kart İçi Dil Seçici */}
        {isLoginMode && (
          <div style={{ marginTop: '14px' }}>
            {renderLanguageDropdown()}
          </div>
        )}

      </div>

      {/* Kadın Kullanıcılar İçin Zorunlu AI Yüz Doğrulama Modalı */}
      {showAiModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#131428', padding: '28px', borderRadius: '24px', maxWidth: '400px', width: '100%', textAlign: 'center', border: '2px solid #ff416c', boxShadow: '0 10px 40px rgba(255, 65, 108, 0.3)' }}>
            
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255, 65, 108, 0.2)', border: '2px solid #ff416c', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto' }}>
              <Camera size={28} color="#ff416c" />
            </div>

            <h3 style={{ color: 'white', marginBottom: '6px', fontSize: '1.25rem', fontWeight: '800' }}>
              {t('login_ai_title', 'Kadın Profili Güvenlik Doğrulaması')}
            </h3>
            
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 65, 108, 0.15)', border: '1px solid rgba(255, 65, 108, 0.35)', borderRadius: '20px', padding: '4px 14px', marginBottom: '16px', fontSize: '0.78rem', color: '#ff416c', fontWeight: '800' }}>
              <ShieldCheck size={14} color="#ff416c" />
              <span>{t('login_ai_badge', '🛡️ %100 Gizlilik & Güvenli Doğrulama')}</span>
            </div>

            {aiStep === 'info' ? (
              <div>
                {/* KIRMIZI VURGULU VE KURUMSAL GİZLİLİK GÜVENCE KUTUSU */}
                <div style={{
                  background: 'rgba(255, 65, 108, 0.08)',
                  border: '1.5px solid #ff416c',
                  borderRadius: '16px',
                  padding: '16px 16px 14px 16px',
                  marginBottom: '18px',
                  textAlign: 'left',
                  boxShadow: '0 4px 20px rgba(255, 65, 108, 0.15)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <ShieldCheck size={20} color="#ff416c" />
                    <span style={{ color: '#ff416c', fontWeight: '900', fontSize: '0.92rem' }}>
                      {t('login_ai_privacy_title', 'Önemli Gizlilik & Biyometrik Güvence')}
                    </span>
                  </div>

                  <p style={{
                    margin: '0 0 12px 0',
                    color: 'rgba(255, 255, 255, 0.92)',
                    fontSize: '0.83rem',
                    lineHeight: '1.55',
                    fontWeight: '500'
                  }}>
                    {t('login_ai_privacy_desc', 'Kameranız yalnızca gerçek kadın topluluğu güvenliğini sağlamak amacıyla 3 saniyelik anlık yapay zeka biyometrik cinsiyet doğrulaması için kullanılır. Canlı görüntünüz veya sesiniz kesinlikle KAYDEDİLMEZ, sunucularımızda SAKLANMAZ ve 3. şahıslarla PAYLAŞILMAZ. Doğrulama cihazınızda uçtan uca şifreli olarak tamamlanır.')}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', borderTop: '1px solid rgba(255, 65, 108, 0.25)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.76rem', color: '#fff' }}>
                      <span style={{ color: '#2ecc71', fontWeight: '900' }}>✓</span>
                      <span><strong>{t('login_ai_point1_title', 'Görüntü Kaydı Asla Yapılmaz')}</strong>: {t('login_ai_point1_desc', 'Hiçbir fotoğraf veya video sunucularımıza yüklenmez.')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.76rem', color: '#fff' }}>
                      <span style={{ color: '#2ecc71', fontWeight: '900' }}>✓</span>
                      <span><strong>{t('login_ai_point2_title', 'Anlık Biyometrik AI Kontrolü')}</strong>: {t('login_ai_point2_desc', 'Sadece kadın profilini teyit eden 3 saniyelik yerel yapay zeka analizi çalışır.')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.76rem', color: '#fff' }}>
                      <span style={{ color: '#2ecc71', fontWeight: '900' }}>✓</span>
                      <span><strong>{t('login_ai_point3_title', '%100 KVKK & GDPR Uyumlu')}</strong>: {t('login_ai_point3_desc', 'Gizliliğiniz ve kimliğiniz tam güvence altındadır.')}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button 
                    type="button"
                    onClick={() => setAiStep('camera')}
                    style={{ width: '100%', padding: '14px', borderRadius: '14px', background: 'linear-gradient(135deg, #ff416c, #ff4b2b)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: '800', fontSize: '1rem', boxShadow: '0 4px 15px rgba(255,65,108,0.4)' }}
                  >
                    {t('login_ai_btn_start', 'Güvenli Doğrulamayı Başlat (3 Saniye)')}
                  </button>
                  <button 
                    type="button"
                    onClick={handleSwitchToMale}
                    style={{ width: '100%', padding: '12px', borderRadius: '14px', background: 'rgba(79, 172, 254, 0.15)', border: '1px solid rgba(79, 172, 254, 0.3)', color: '#4facfe', cursor: 'pointer', fontWeight: '700', fontSize: '0.88rem' }}
                  >
                    {t('login_ai_btn_switch_male', 'Erkek Olarak Devam Et')}
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setShowAiModal(false);
                      setIsFaceVerified(false);
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.82rem', marginTop: '4px' }}
                  >
                    {t('login_ai_btn_cancel', 'İptal Et')}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Animasyon Stilleri */}
                <style>{`
                  @keyframes faceLaserScan {
                    0% { top: 14%; opacity: 0.85; }
                    50% { top: 84%; opacity: 1; }
                    100% { top: 14%; opacity: 0.85; }
                  }
                  @keyframes faceArrowBounceRight {
                    0%, 100% { transform: translateX(0); }
                    50% { transform: translateX(6px); }
                  }
                  @keyframes faceArrowBounceLeft {
                    0%, 100% { transform: translateX(0); }
                    50% { transform: translateX(-6px); }
                  }
                  @keyframes faceSuccessPop {
                    0% { transform: scale(0.6); opacity: 0; }
                    70% { transform: scale(1.12); }
                    100% { transform: scale(1); opacity: 1; }
                  }
                `}</style>

                {/* KAMERA ESNASINDA ŞEFFAFLIK ROZETİ */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '7px 12px',
                  background: 'rgba(255, 65, 108, 0.15)',
                  border: '1px solid rgba(255, 65, 108, 0.4)',
                  borderRadius: '12px',
                  marginBottom: '14px',
                  fontSize: '0.74rem',
                  color: '#ff6b8b',
                  fontWeight: '800'
                }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ff416c', boxShadow: '0 0 6px #ff416c' }}></span>
                  <span>{t('login_ai_cam_notice', '🔴 Canlı Yayın Değildir • Görüntünüz Kaydedilmez')}</span>
                </div>

                {/* APPLE FACE ID DAİRESEL KAMERA ÇERÇEVESİ */}
                <div style={{
                  position: 'relative',
                  width: '230px',
                  height: '230px',
                  margin: '0 auto 16px auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {/* Dairesel SVG İlerleme Çubuğu */}
                  <svg 
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      transform: 'rotate(-90deg)',
                      zIndex: 4,
                      pointerEvents: 'none'
                    }}
                    viewBox="0 0 100 100"
                  >
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke="rgba(255, 255, 255, 0.12)"
                      strokeWidth="3.5"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="46"
                      fill="none"
                      stroke={faceStep === 'success' ? '#00ff88' : '#ff416c'}
                      strokeWidth="4"
                      strokeDasharray={2 * Math.PI * 46}
                      strokeDashoffset={2 * Math.PI * 46 * (1 - faceProgress / 100)}
                      strokeLinecap="round"
                      style={{
                        transition: 'stroke-dashoffset 0.4s ease, stroke 0.3s ease',
                        filter: faceStep === 'success' 
                          ? 'drop-shadow(0 0 8px rgba(0, 255, 136, 0.8))' 
                          : 'drop-shadow(0 0 8px rgba(255, 65, 108, 0.8))'
                      }}
                    />
                  </svg>

                  {/* 4 Köşeli Apple Face ID Çerçeve Köşebentleri */}
                  <div style={{ position: 'absolute', top: '10px', left: '10px', width: '22px', height: '22px', borderTop: '3px solid #ff416c', borderLeft: '3px solid #ff416c', borderTopLeftRadius: '8px', zIndex: 5, pointerEvents: 'none' }}></div>
                  <div style={{ position: 'absolute', top: '10px', right: '10px', width: '22px', height: '22px', borderTop: '3px solid #ff416c', borderRight: '3px solid #ff416c', borderTopRightRadius: '8px', zIndex: 5, pointerEvents: 'none' }}></div>
                  <div style={{ position: 'absolute', bottom: '10px', left: '10px', width: '22px', height: '22px', borderBottom: '3px solid #ff416c', borderLeft: '3px solid #ff416c', borderBottomLeftRadius: '8px', zIndex: 5, pointerEvents: 'none' }}></div>
                  <div style={{ position: 'absolute', bottom: '10px', right: '10px', width: '22px', height: '22px', borderBottom: '3px solid #ff416c', borderRight: '3px solid #ff416c', borderBottomRightRadius: '8px', zIndex: 5, pointerEvents: 'none' }}></div>

                  {/* Dairesel Canlı Kamera Aynası */}
                  <div style={{
                    width: '206px',
                    height: '206px',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    position: 'relative',
                    background: '#000',
                    border: `2px solid ${faceStep === 'success' ? 'rgba(0, 255, 136, 0.6)' : 'rgba(255, 65, 108, 0.4)'}`,
                    boxShadow: faceStep === 'success' 
                      ? '0 0 30px rgba(0, 255, 136, 0.4)' 
                      : '0 0 25px rgba(255, 65, 108, 0.3)',
                    zIndex: 2
                  }}>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      muted 
                      playsInline 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover',
                        transform: 'scaleX(-1)' // Ayna efekti
                      }}
                    />

                    {/* Face ID Lazer Tarama Çizgisi */}
                    {faceStep !== 'success' && !aiLoading && !cameraError && (
                      <div style={{
                        position: 'absolute',
                        left: '12%',
                        width: '76%',
                        height: '3px',
                        background: 'linear-gradient(90deg, transparent, #ff416c, #00f2fe, transparent)',
                        boxShadow: '0 0 10px #00f2fe, 0 0 20px #ff416c',
                        borderRadius: '2px',
                        animation: 'faceLaserScan 1.6s ease-in-out infinite alternate',
                        pointerEvents: 'none'
                      }} />
                    )}

                    {/* Step İpucu Rozetleri */}
                    {faceStep === 'right' && (
                      <div style={{
                        position: 'absolute',
                        bottom: '16px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(8px)',
                        border: '1.5px solid #00f2fe',
                        color: '#00f2fe',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        fontWeight: '800',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        animation: 'faceArrowBounceRight 1s infinite'
                      }}>
                        <span>{t('login_ai_turn_right')}</span>
                        <ArrowRight size={15} />
                      </div>
                    )}

                    {faceStep === 'left' && (
                      <div style={{
                        position: 'absolute',
                        bottom: '16px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(8px)',
                        border: '1.5px solid #00f2fe',
                        color: '#00f2fe',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        fontWeight: '800',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        animation: 'faceArrowBounceLeft 1s infinite'
                      }}>
                        <ArrowLeft size={15} />
                        <span>{t('login_ai_turn_left')}</span>
                      </div>
                    )}

                    {faceStep === 'smile' && (
                      <div style={{
                        position: 'absolute',
                        bottom: '16px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'rgba(0, 0, 0, 0.8)',
                        backdropFilter: 'blur(8px)',
                        border: '1.5px solid #ffd700',
                        color: '#ffd700',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        fontWeight: '800',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span>{t('login_ai_smile')}</span>
                      </div>
                    )}

                    {/* Yükleniyor Göstergesi */}
                    {aiLoading && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', gap: '10px' }}>
                        <div className="spinner"></div>
                        <span style={{ color: '#ff416c', fontSize: '0.8rem', fontWeight: '700' }}>{t('login_ai_cam_opening')}</span>
                      </div>
                    )}

                    {/* Başarılı Onay İkonu (Face ID Yeşil Tik Animasyonu) */}
                    {faceStep === 'success' && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'rgba(0, 30, 15, 0.7)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        animation: 'faceSuccessPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                      }}>
                        <div style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, #00ff88, #00b0ff)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 25px rgba(0, 255, 136, 0.7)'
                        }}>
                          <Check size={38} color="#000" strokeWidth={3.5} />
                        </div>
                        <span style={{ color: '#00ff88', fontWeight: '900', fontSize: '0.88rem', marginTop: '8px' }}>
                          {t('login_ai_verified')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* YÖNERGE & İLERLEME KUTUSU */}
                <div style={{ 
                  background: faceStep === 'success' ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255,255,255,0.08)', 
                  color: faceStep === 'success' ? '#2ecc71' : '#fff',
                  border: faceStep === 'success' ? '1px solid rgba(46, 204, 113, 0.5)' : '1px solid rgba(255,255,255,0.12)',
                  padding: '12px 14px', borderRadius: '16px', marginBottom: '14px', textAlign: 'center'
                }}>
                  <div style={{ fontSize: '0.98rem', fontWeight: '800', marginBottom: '8px' }}>
                    {aiMessage}
                  </div>

                  {/* İlerleme Çubuğu */}
                  <div style={{
                    width: '100%',
                    height: '6px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${faceProgress}%`,
                      height: '100%',
                      background: faceStep === 'success' 
                        ? 'linear-gradient(90deg, #00ff88, #00b0ff)' 
                        : 'linear-gradient(90deg, #ff416c, #00f2fe)',
                      borderRadius: '4px',
                      transition: 'width 0.35s ease'
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                    <span>{t('login_ai_biometric_test')}</span>
                    <span style={{ fontWeight: '800', color: faceStep === 'success' ? '#00ff88' : '#ff416c' }}>%{faceProgress}</span>
                  </div>
                </div>

                {/* Kamera Hata Bildirimi (Varsa) */}
                {cameraError && (
                  <div style={{
                    background: 'rgba(255, 45, 85, 0.15)',
                    border: '1px solid #ff2d55',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    color: '#ff6b8b',
                    fontSize: '0.80rem',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    textAlign: 'left'
                  }}>
                    <AlertCircle size={18} color="#ff2d55" style={{ flexShrink: 0 }} />
                    <div>{cameraError}</div>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {faceStep !== 'success' && (
                    <button 
                      type="button"
                      onClick={handleRetryAi}
                      style={{ 
                        width: '100%', 
                        padding: '12px', 
                        borderRadius: '14px', 
                        background: 'linear-gradient(135deg, #ff416c, #ff4b2b)', 
                        border: 'none', 
                        color: 'white', 
                        cursor: 'pointer', 
                        fontWeight: '800', 
                        fontSize: '0.92rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 14px rgba(255, 65, 108, 0.4)'
                      }}
                    >
                      <RefreshCw size={18} />
                      <span>{t('login_ai_btn_retry', '🔄 Tekrar Tara')}</span>
                    </button>
                  )}

                  <button 
                    type="button"
                    onClick={handleSwitchToMale}
                    style={{ 
                      width: '100%', padding: isMaleDetected ? '14px' : '11px', borderRadius: '14px', 
                      background: isMaleDetected ? 'linear-gradient(135deg, #00f2fe, #4facfe)' : 'rgba(79, 172, 254, 0.15)', 
                      border: isMaleDetected ? 'none' : '1px solid rgba(79, 172, 254, 0.3)', 
                      color: isMaleDetected ? '#050510' : '#4facfe', 
                      cursor: 'pointer', fontWeight: '900', fontSize: isMaleDetected ? '0.96rem' : '0.85rem',
                      boxShadow: isMaleDetected ? '0 6px 22px rgba(0, 242, 254, 0.45)' : 'none',
                      transition: 'all 0.25s'
                    }}
                  >
                    👦 {t('login_ai_btn_switch_male', 'Erkek Olarak Devam Et')}
                  </button>

                  <button 
                    type="button"
                    onClick={() => {
                      stopCameraTracks();
                      setShowAiModal(false);
                      setIsFaceVerified(false);
                    }}
                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.82rem', marginTop: '4px' }}
                  >
                    {t('login_ai_btn_cancel', 'İptal Et')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TATLI VE DUYGUSAL KAYDINIZ BULUNAMADI / ÜYE OL MODALI */}
      {showNotFoundModal && (
        <div 
          onClick={() => setShowNotFoundModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.84)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999, backdropFilter: 'blur(10px)', padding: '20px',
            animation: 'fadeIn 0.25s ease-out'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #1f142b 0%, #120c1a 100%)',
              border: '1.5px solid rgba(255, 117, 140, 0.35)',
              borderRadius: '28px', padding: '28px 22px', width: '100%', maxWidth: '390px',
              boxShadow: '0 20px 60px rgba(255, 107, 139, 0.25)', textAlign: 'center',
              position: 'relative'
            }}
          >
            {/* Tatlı Duygusal Rozet */}
            <div style={{
              width: '74px', height: '74px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,107,139,0.25) 0%, rgba(255,107,139,0.05) 100%)',
              border: '2px solid rgba(255, 107, 139, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px auto', fontSize: '2.5rem',
              boxShadow: '0 8px 25px rgba(255, 107, 139, 0.25)'
            }}>
              🥺
            </div>

            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: '800', color: '#fff' }}>
              {t('login_not_found_title', 'Seni Aramızda Göremedik 🥺')}
            </h3>

            <p style={{ margin: '0 0 12px 0', fontSize: '0.96rem', color: '#ff8da1', fontWeight: '700' }}>
              {t('login_not_found_subtitle', 'Seni aramızda görmek için lütfen üye ol! 🥰')}
            </p>

            <p style={{ margin: '0 0 24px 0', fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: '1.55' }}>
              {t('login_not_found_desc', 'Girdiğin hesapla kayıtlı bir üyelik bulunamadı. Kullanıcı adını ve cinsiyetini belirleyerek hemen aramıza katılabilirsin!')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Birincil Buton: Hemen Üye Ol 🥰 */}
              <button
                type="button"
                onClick={() => {
                  setShowNotFoundModal(false);
                  setIsLoginMode(false); // Kayıt Ol sekmesine geçir
                }}
                style={{
                  background: 'linear-gradient(135deg, #ff4d6d 0%, #ff758c 100%)',
                  border: 'none', color: '#fff', padding: '14px', borderRadius: '18px',
                  fontSize: '0.95rem', fontWeight: '800', cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(255, 77, 109, 0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <span>{t('login_not_found_btn', 'Hemen Üye Ol 🥰')}</span>
              </button>

              {/* İkincil Buton: Kapat */}
              <button
                type="button"
                onClick={() => {
                  setShowNotFoundModal(false);
                  setIsLoginMode(false);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'rgba(255, 255, 255, 0.7)', padding: '12px', borderRadius: '16px',
                  fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <span>{t('close', 'Kapat')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HESABINIZ DAHA ÖNCE SİLİNMİŞTİR MODALI / POPUP */}
      {showAccountDeletedModal && (
        <div 
          onClick={() => setShowAccountDeletedModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999, backdropFilter: 'blur(10px)', padding: '20px',
            animation: 'fadeIn 0.25s ease-out'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #1f142b 0%, #120c1a 100%)',
              border: '1.5px solid rgba(255, 117, 140, 0.35)',
              borderRadius: '28px', padding: '28px 22px', width: '100%', maxWidth: '390px',
              boxShadow: '0 20px 60px rgba(255, 107, 139, 0.25)', textAlign: 'center',
              position: 'relative'
            }}
          >
            {/* Tatlı Karşılama Rozeti */}
            <div style={{
              width: '74px', height: '74px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,107,139,0.25) 0%, rgba(255,107,139,0.05) 100%)',
              border: '2px solid rgba(255, 107, 139, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px auto', fontSize: '2.5rem',
              boxShadow: '0 8px 25px rgba(255, 107, 139, 0.25)'
            }}>
              🥺
            </div>

            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: '800', color: '#fff' }}>
              {t('login_deleted_title', 'Hesabınız Silinmiştir 🥺')}
            </h3>

            <p style={{ margin: '0 0 12px 0', fontSize: '0.96rem', color: '#ff8da1', fontWeight: '700' }}>
              {t('login_deleted_subtitle', 'Seni Tekrar Aramızda Görmek İsteriz! 🥰')}
            </p>

            <p style={{ margin: '0 0 24px 0', fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.72)', lineHeight: '1.55' }}>
              {t('login_deleted_desc', 'Bu hesap daha önce kalıcı olarak silinmiş. Seni tekrar aramızda görmekten büyük mutluluk duyarız! Birkaç saniyede yeni üyeliğini oluşturup hemen aramıza katılabilirsin.')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setShowAccountDeletedModal(false);
                  setIsLoginMode(false); // Kayıt Ol sekmesine geçir
                }}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, #ff4d6d 0%, #ff758c 100%)',
                  border: 'none', color: '#fff', padding: '14px', borderRadius: '18px',
                  fontSize: '0.95rem', fontWeight: '800', cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(255, 77, 109, 0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <span>{t('login_not_found_btn', 'Hemen Üye Ol 🥰')}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAccountDeletedModal(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'rgba(255, 255, 255, 0.7)', padding: '12px', borderRadius: '16px',
                  fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <span>{t('close', 'Kapat')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Yasal Sözleşmeler ve Gizlilik Modalları */}
      {showTermsModal && <LegalModal type="terms" onClose={() => setShowTermsModal(false)} />}
      {showKvkkModal && <LegalModal type="privacy" onClose={() => setShowKvkkModal(false)} />}

    </div>
  );
}
