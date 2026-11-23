import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  Coins, 
  Crown, 
  ShieldCheck, 
  Zap, 
  Check, 
  ArrowLeft,
  X,
  Clock,
  Gift,
  Play,
  Volume2,
  VolumeX
} from 'lucide-react';
import { soundManager } from '../utils/SoundManager';
import { sendTelegramAlert } from '../utils/telegramAlert';
import { logTransaction } from '../utils/transactionService';
import { admobService } from '../utils/admobService';
import { LegalModal, type LegalModalType } from '../components/LegalModal';
import { TreasureRewardModal } from '../components/TreasureRewardModal';
import { isIosNative, isAndroidNative, iapAvailable, purchaseGoldProduct, restoreGoldPurchases } from '../utils/iapService';

const WebPaymentMethods = !__IS_IOS__ ? lazy(() => import('../components/WebPaymentMethods')) : null;

interface MarketProps {
  userId: string;
}

interface GoldPackage {
  id: string;
  name: string;
  gold: number;
  bonus: number;
  priceTr: string;
  priceEn: string;
  priceUsdt?: string;
  oldPriceTr: string;
  oldPriceEn: string;
  discountBadge: string;
  isPopular?: boolean;
  isBestValue?: boolean;
  isVip?: boolean;
  // Apple App Store Connect'teki In-App Purchase ürün kimliği (yalnızca iOS'ta kullanılır).
  appleProductId?: string;
  iconType: 'pouch' | 'bag' | 'chest' | 'vault' | 'crown' | 'fortune';
}

export default function Market({ userId }: MarketProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isTr = i18n.language?.startsWith('tr');

  const [profile, setProfile] = useState<any>(() => {
    try {
      const cached = localStorage.getItem(`pyngoo_user_profile_${userId}`);
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    return null;
  });
  const [selectedPackage, setSelectedPackage] = useState<GoldPackage | null>(null);
  const [purchaseSuccess, setPurchaseSuccess] = useState<GoldPackage | null>(null);
  const [legalModalType, setLegalModalType] = useState<LegalModalType>(null);

  // --- iOS Apple In-App Purchase durumları ---
  // 'waiting_credit': Apple ödemeyi onayladı, altın RevenueCat webhook üzerinden sunucuda ekleniyor.
  // 'delayed': 20 sn geçti, kredi henüz gelmedi (yine de işlem kaybolmaz, admin_notes'ta kayıtlıdır).
  const [applePurchaseState, setApplePurchaseState] = useState<'idle' | 'processing' | 'waiting_credit' | 'delayed' | 'error'>('idle');
  const [appleRestoreMsg, setAppleRestoreMsg] = useState<string | null>(null);
  // Ham hata metni (Mac/Xcode olmadan da telefon ekranından teşhis edebilmek için).
  const [appleErrorDetail, setAppleErrorDetail] = useState<string | null>(null);
  const applePendingRef = useRef<GoldPackage | null>(null);

  // NOT: Sayfa açılışında otomatik initIAP() ÇAĞRILMIYOR (bilerek). Bir teoriye göre bu
  // erken çağrı native tarafta takılıp kalıyor ve RevenueCat'in iç kuyruğu, kullanıcı
  // butona bastığında yapılan asıl isteği o takılı işlemin arkasında bekletiyor olabilir.
  // configure() artık YALNIZCA butona basıldığında (purchaseGoldProduct içinden) çağrılır.

  useEffect(() => {
    if (applePurchaseState !== 'waiting_credit') return;
    const timer = setTimeout(() => {
      setApplePurchaseState((s) => (s === 'waiting_credit' ? 'delayed' : s));
    }, 20000);
    return () => clearTimeout(timer);
  }, [applePurchaseState]);

  const [orderCode, setOrderCode] = useState(() => `PYN-${Math.floor(1000 + Math.random() * 9000)}`);

  const handleSelectPackage = (pkg: GoldPackage) => {
    setOrderCode(`PYN-${Math.floor(1000 + Math.random() * 9000)}`);
    setApplePurchaseState('idle');
    setAppleRestoreMsg(null);
    setAppleErrorDetail(null);
    setSelectedPackage(pkg);
  };

  // --- iOS: Apple In-App Purchase satın alma akışı (App Store Review 3.1.1) ---
  const handleApplePurchase = async () => {
    if (!selectedPackage?.appleProductId) return;
    setAppleRestoreMsg(null);
    setAppleErrorDetail(null);
    setApplePurchaseState('processing');
    soundManager.playCoinSound();

    const reportError = (msg: string) => {
      setApplePurchaseState('error');
      setAppleErrorDetail(`[${selectedPackage.appleProductId}] ${msg}`);
      try {
        sendTelegramAlert(
          `⚠️ <b>APPLE IAP HATASI</b>\n👤 ${profile?.display_name || 'Kullanıcı'} (<code>${userId.slice(0, 8)}</code>)\n🪙 <b>Ürün:</b> ${selectedPackage.appleProductId}\n❗ <b>Hata:</b> ${msg}`
        );
      } catch (_) {}
    };

    let outcome: Awaited<ReturnType<typeof purchaseGoldProduct>>;
    let outerTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      outcome = await Promise.race([
        purchaseGoldProduct(selectedPackage.appleProductId, userId),
        new Promise<never>((_, reject) => {
          outerTimer = setTimeout(() => reject(new Error('outer_timeout_90s')), 90000);
        }),
      ]);
    } catch (err: any) {
      reportError(`unhandled: ${err?.message || String(err)}`);
      return;
    } finally {
      clearTimeout(outerTimer);
    }

    if (outcome.status === 'cancelled') {
      setApplePurchaseState('idle');
      return;
    }
    if (outcome.status === 'error') {
      reportError(outcome.message);
      return;
    }

    // Apple ödemeyi onayladı. Altın İSTEMCİDE eklenmez; RevenueCat webhook -> credit_iap_gold
    // sunucuda ekler, biz bunu profiles realtime aboneliğinden yakalarız (bkz. yukarıdaki profileChan).
    try {
      sendTelegramAlert(
        `🍏 <b>APPLE IAP SATIN ALMA ONAYLANDI</b>\n👤 <b>Kullanıcı:</b> ${profile?.display_name || 'Kullanıcı'} (<code>${userId.slice(0, 8)}</code>)\n🪙 <b>Ürün:</b> ${selectedPackage.appleProductId}`
      );
    } catch (_) {}
    applePendingRef.current = selectedPackage;
    setApplePurchaseState('waiting_credit');
  };

  const handleAppleRestore = async () => {
    setAppleRestoreMsg(null);
    const res = await restoreGoldPurchases();
    setAppleRestoreMsg(res.success ? t('market_restore_success') : t('market_restore_error'));
  };

  const renderApplePurchasePanel = () => {
    if (!selectedPackage) return null;

    if (!iapAvailable()) {
      return (
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '16px', padding: '16px', textAlign: 'center',
          color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', lineHeight: '1.4'
        }}>
          {t('market_apple_unavailable')}
        </div>
      );
    }

    if (applePurchaseState === 'waiting_credit' || applePurchaseState === 'delayed') {
      return (
        <div style={{
          background: 'rgba(0, 230, 118, 0.14)', border: '1.5px solid #00e676',
          borderRadius: '16px', padding: '16px', textAlign: 'center', animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>🍏</div>
          <h4 style={{ color: '#00e676', margin: '0 0 4px 0', fontSize: '1rem', fontWeight: '800' }}>
            {t('market_apple_success_title')}
          </h4>
          <p style={{ color: 'rgba(255,255,255,0.9)', margin: 0, fontSize: '0.78rem', lineHeight: '1.4' }}>
            {applePurchaseState === 'delayed' ? t('market_apple_delayed_desc') : t('market_apple_success_desc')}
          </p>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {applePurchaseState === 'error' && (
          <div style={{
            background: 'rgba(255, 65, 108, 0.22)', border: '1.5px solid #ff416c',
            borderRadius: '12px', padding: '10px 14px', color: '#fff',
            fontSize: '0.78rem', fontWeight: '800', textAlign: 'center'
          }}>
            <div>{t('market_apple_error')}</div>
            {appleErrorDetail && (
              <div style={{
                marginTop: '6px', fontWeight: '400', fontFamily: 'monospace',
                fontSize: '0.68rem', color: 'rgba(255,255,255,0.85)', wordBreak: 'break-word'
              }}>
                {appleErrorDetail}
              </div>
            )}
          </div>
        )}

        <button
          onClick={handleApplePurchase}
          disabled={applePurchaseState === 'processing'}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #ffffff 0%, #d1d1d6 100%)',
            border: 'none', color: '#000', padding: '14px', borderRadius: '16px',
            fontWeight: '900', fontSize: '0.95rem',
            cursor: applePurchaseState === 'processing' ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            boxShadow: '0 6px 20px rgba(255,255,255,0.25)', transition: 'all 0.2s ease'
          }}
        >
          {applePurchaseState === 'processing' ? (
            <>
              <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
              <span>{t('market_apple_processing')}</span>
            </>
          ) : (
            <>
              <ShieldCheck size={18} color="#000" />
              <span>
                {t('market_apple_purchase_button', { price: isTr ? selectedPackage.priceTr : selectedPackage.priceEn })}
              </span>
            </>
          )}
        </button>

        <div style={{ marginTop: '4px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleAppleRestore}
            style={{
              background: 'none', border: 'none',
              fontSize: '0.76rem', color: 'rgba(255,255,255,0.7)',
              textDecoration: 'underline', cursor: 'pointer', padding: '6px 12px',
              fontWeight: '600'
            }}
          >
            {t('market_restore_purchases')}
          </button>
        </div>
        {appleRestoreMsg && (
          <span style={{ fontSize: '0.74rem', color: '#ffd700', textAlign: 'center', fontWeight: '700' }}>
            {appleRestoreMsg}
          </span>
        )}
      </div>
    );
  };

  // Flaş Fırsat İçin Canlı Geri Sayım (4 Saat 45 Dakika)
  const [countdown, setCountdown] = useState({ hours: 4, minutes: 42, seconds: 18 });

  // 🎬 Ödüllü Video Reklam Durumları (Rewarded Ad)
  const [showAdModal, setShowAdModal] = useState(false);
  const [adSecondsLeft, setAdSecondsLeft] = useState(15);
  const [adFinished, setAdFinished] = useState(false);
  const [isAdMuted, setIsAdMuted] = useState(true);
  const [remainingDailyAds, setRemainingDailyAds] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    const savedDate = localStorage.getItem(`ad_date_${userId}`);
    if (savedDate !== today) {
      localStorage.setItem(`ad_date_${userId}`, today);
      localStorage.setItem(`ad_count_${userId}`, '5');
      return 5;
    }
    const count = localStorage.getItem(`ad_count_${userId}`);
    return count !== null ? parseInt(count, 10) : 5;
  });

  useEffect(() => {
    let adInterval: any = null;
    if (showAdModal && adSecondsLeft > 0) {
      adInterval = setInterval(() => {
        setAdSecondsLeft((prev) => {
          if (prev <= 1) {
            setAdFinished(true);
            clearInterval(adInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (adInterval) clearInterval(adInterval);
    };
  }, [showAdModal, adSecondsLeft]);

  // Mobil platformda AdMob'u önceden hazırla
  useEffect(() => {
    if (admobService.isNative()) {
      admobService.initialize();
    }
  }, []);

  const handleStartWatchAd = async () => {
    if (remainingDailyAds <= 0) {
      alert(t('market_free_gold_limit_alert'));
      return;
    }

    // Mobil Uygulama (APK / IPA / Capacitor): Google AdMob Rewarded Video Oynat
    if (admobService.isNative()) {
      try {
        const result = await admobService.showRewardVideo(userId);
        if (result.rewarded) {
          await handleClaimAdReward();
        } else if (result.error && result.error !== 'not_native') {
          alert(result.error);
        }
      } catch (e: any) {
        console.error('AdMob show error:', e);
      }
      return;
    }

    // Web / Tarayıcı: Sayfadan hiç ayrılmadan uygulama içinde video reklam oynat
    setIsAdMuted(true);
    setShowAdModal(true);
    setAdSecondsLeft(15);
    setAdFinished(false);
  };

  const [isClaimingAd, setIsClaimingAd] = useState(false);

  const handleClaimAdReward = async () => {
    if (!profile || isClaimingAd || remainingDailyAds <= 0) return;

    const lastClaim = Number(sessionStorage.getItem('pyngoo_last_ad_claim') || '0');
    if (Date.now() - lastClaim < 20000) {
      return;
    }
    sessionStorage.setItem('pyngoo_last_ad_claim', String(Date.now()));

    setIsClaimingAd(true);

    try {
      // Güvenlik: +20 altın, günlük limit (5) ve bekleme süresi SUNUCUDA (claim_ad_reward RPC) uygulanır.
      const { data: adRes, error: adErr } = await supabase.rpc('claim_ad_reward');
      if (adErr || !adRes?.success) {
        // Limit dolduysa / çok hızlı tıklandıysa altın eklenmez ve ekranda da gösterilmez
        console.warn('claim_ad_reward başarısız:', adErr || adRes?.error);
        if (adRes && typeof adRes.remaining === 'number') {
          localStorage.setItem(`ad_count_${userId}`, String(adRes.remaining));
          setRemainingDailyAds(adRes.remaining);
        }
        return;
      }
      const newGold = adRes.new_gold;
      const newRemaining = Math.max(0, adRes.remaining ?? remainingDailyAds - 1);

      localStorage.setItem(`ad_count_${userId}`, String(newRemaining));
      setRemainingDailyAds(newRemaining);
      setProfile({ ...profile, total_gold: newGold });
      logTransaction(userId, 20, 'ad_reward');
      soundManager.playCoinSound();

      setShowAdModal(false);
      setPurchaseSuccess({
        id: 'ad_reward',
        name: t('market_ad_reward_name'),
        gold: 20,
        bonus: 0,
        priceTr: t('market_free_text'),
        priceEn: t('market_free_text'),
        oldPriceTr: '',
        oldPriceEn: '',
        discountBadge: t('market_badge_ad_reward'),
        iconType: 'pouch'
      });
      setTimeout(() => setPurchaseSuccess(null), 3000);
    } catch (e) {
      console.error('Ad reward claim error:', e);
    } finally {
      setIsClaimingAd(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 4, minutes: 59, seconds: 59 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Profil Verisini Çek & Canlı Bakiye Takibi
  useEffect(() => {
    const isOmer = !__IS_IOS__ && (userId === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b' || userId === '22b3c0e7-e1e2-4cb5-9532-990066b5a80c');
    const fetchProfile = async () => {
      if (!userId) return;
      try {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (data) {
          if (isOmer) {
            data.gender = 'erkek';
            data.role = 'admin';
          }
          setProfile(data);
        }
      } catch (e) {
        console.warn('Market fetchProfile error:', e);
      }
    };
    fetchProfile();

    const handleGoldUpdated = (e: any) => {
      if (e.detail?.newGold !== undefined) {
        setProfile((prev: any) => ({ ...(prev || {}), total_gold: e.detail.newGold }));
      }
    };
    window.addEventListener('pyngoo_gold_updated', handleGoldUpdated);

    const profileChan = supabase.channel(`market_profile_sub_${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, (payload: any) => {
        if (payload?.new) {
          setProfile(payload.new);
          // Bekleyen bir Apple satın alması varsa, bu profil güncellemesi RevenueCat webhook'unun
          // altını eklediği andır (polling YOK — doğrudan realtime üzerinden yakalanır).
          if (applePendingRef.current) {
            const pkg = applePendingRef.current;
            applePendingRef.current = null;
            setApplePurchaseState('idle');
            setSelectedPackage(null);
            soundManager.playCoinSound();
            setPurchaseSuccess(pkg);
            setTimeout(() => setPurchaseSuccess(null), 3000);
          }
        }
      })
      .subscribe();

    return () => {
      window.removeEventListener('pyngoo_gold_updated', handleGoldUpdated);
      supabase.removeChannel(profileChan);
    };
  }, [userId, navigate]);

  // 7 Aşamalı Yüksek Limitli & Rekabetçi VIP Altın Paketleri
  const packages: GoldPackage[] = [
    {
      id: 'pack_650',
      name: t('market_pkg_650', 'Başlangıç Paketi'),
      gold: 650,
      bonus: 150,
      priceTr: '139.99 ₺',
      priceEn: '$3.69',
      priceUsdt: '3.70',
      oldPriceTr: '249.99 ₺',
      oldPriceEn: '$6.99',
      discountBadge: t('market_discount_badge', { pct: 45 }),
      appleProductId: 'com.pyngoo.gold.650',
      iconType: 'pouch'
    },
    {
      id: 'pack_1400',
      name: t('market_pkg_1400', 'Altın Torbası'),
      gold: 1400,
      bonus: 400,
      priceTr: '279.99 ₺',
      priceEn: '$6.99',
      priceUsdt: '7.00',
      oldPriceTr: '549.99 ₺',
      oldPriceEn: '$13.99',
      discountBadge: t('market_discount_badge', { pct: 50 }),
      isPopular: true,
      appleProductId: 'com.pyngoo.gold.1400',
      iconType: 'bag'
    },
    {
      id: 'pack_3800',
      name: t('market_pkg_3800', 'Hazine Sandığı'),
      gold: 3800,
      bonus: 1200,
      priceTr: '699.99 ₺',
      priceEn: '$17.99',
      priceUsdt: '18.00',
      oldPriceTr: '1,399.99 ₺',
      oldPriceEn: '$35.99',
      discountBadge: t('market_discount_badge', { pct: 55 }),
      isBestValue: true,
      appleProductId: 'com.pyngoo.gold.3800',
      iconType: 'chest'
    },
    {
      id: 'pack_8500',
      name: t('market_pkg_8500', 'Elit Kasa'),
      gold: 8500,
      bonus: 3500,
      priceTr: '1,399.99 ₺',
      priceEn: '$34.99',
      priceUsdt: '35.00',
      oldPriceTr: '3,199.99 ₺',
      oldPriceEn: '$79.99',
      discountBadge: t('market_discount_badge', { pct: 60 }),
      isVip: true,
      appleProductId: 'com.pyngoo.gold.8500',
      iconType: 'vault'
    },
    {
      id: 'pack_18000',
      name: t('market_pkg_18000', 'VIP Taç Paketi'),
      gold: 18000,
      bonus: 7000,
      priceTr: '2,799.99 ₺',
      priceEn: '$69.99',
      priceUsdt: '70.00',
      oldPriceTr: '6,999.99 ₺',
      oldPriceEn: '$169.99',
      discountBadge: t('market_discount_badge', { pct: 65 }),
      isVip: true,
      appleProductId: 'com.pyngoo.gold.18000',
      iconType: 'crown'
    },
    {
      id: 'pack_40000',
      name: t('market_pkg_40000', 'Kraliyet Hazinesi'),
      gold: 40000,
      bonus: 15000,
      priceTr: '5,999.99 ₺',
      priceEn: '$149.99',
      priceUsdt: '150.00',
      oldPriceTr: '14,999.99 ₺',
      oldPriceEn: '$379.99',
      discountBadge: t('market_discount_badge', { pct: 70 }),
      isVip: true,
      appleProductId: 'com.pyngoo.gold.40000',
      iconType: 'fortune'
    },
    {
      id: 'pack_85000',
      name: t('market_pkg_85000', 'İmparatorluk Serveti'),
      gold: 85000,
      bonus: 35000,
      priceTr: '11,999.99 ₺',
      priceEn: '$299.99',
      priceUsdt: '300.00',
      oldPriceTr: '29,999.99 ₺',
      oldPriceEn: '$749.99',
      discountBadge: t('market_discount_badge', { pct: 75 }),
      isVip: true,
      appleProductId: 'com.pyngoo.gold.85000',
      iconType: 'fortune'
    }
  ];


  // 3D Altın ve Hazine İllüstrasyonları (Vektörel SVG)
  const renderPackageIcon = (type: GoldPackage['iconType']) => {
    switch (type) {
      case 'pouch':
        return (
          <div style={{ position: 'relative', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '3rem', filter: 'drop-shadow(0 6px 12px rgba(255, 215, 0, 0.4))' }}>🪙</span>
          </div>
        );
      case 'bag':
        return (
          <div style={{ position: 'relative', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '3rem', filter: 'drop-shadow(0 6px 14px rgba(255, 140, 0, 0.5))' }}>💰</span>
          </div>
        );
      case 'chest':
        return (
          <div style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '3.3rem', filter: 'drop-shadow(0 8px 18px rgba(0, 242, 254, 0.6))', animation: 'pulse 2s infinite' }}>💎</span>
          </div>
        );
      case 'vault':
        return (
          <div style={{ position: 'relative', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '3rem', filter: 'drop-shadow(0 8px 16px rgba(255, 215, 0, 0.5))' }}>🏆</span>
          </div>
        );
      case 'crown':
        return (
          <div style={{ position: 'relative', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '3.2rem', filter: 'drop-shadow(0 8px 18px rgba(255, 215, 0, 0.7))' }}>👑</span>
          </div>
        );
      case 'fortune':
        return (
          <div style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '3.4rem', filter: 'drop-shadow(0 10px 22px rgba(255, 45, 85, 0.8))' }}>🌌</span>
          </div>
        );
    }
  };

  return (
    <div style={{
      width: '100%',
      background: 'radial-gradient(circle at top, #1c1d3b 0%, #0c0d1a 100%)',
      color: '#fff',
      paddingBottom: 'calc(95px + env(safe-area-inset-bottom, 0px))',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      {/* 1. ÜST BAR & BAŞLIK (DARALTILMIŞ / SLIM) */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(12, 13, 26, 0.92)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: 'max(env(safe-area-inset-top, 0px), 6px) 14px 6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'rgba(255,255,255,0.08)', border: 'none',
            color: '#fff', width: '34px', height: '34px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}
        >
          <ArrowLeft size={18} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <div style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #ffd700, #ff8800)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 10px rgba(255, 215, 0, 0.45)'
          }}>
            <Coins size={14} color="#000" />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.02rem', fontWeight: '800', letterSpacing: '0.2px' }}>
            {t('market_title')}
          </h2>
        </div>

        {/* Canlı Bakiye Rozeti */}
        <div style={{
          background: 'rgba(255, 215, 0, 0.12)', border: '1px solid rgba(255, 215, 0, 0.35)',
          padding: '3px 10px', borderRadius: '18px',
          display: 'flex', alignItems: 'center', gap: '5px',
          boxShadow: '0 2px 8px rgba(255, 215, 0, 0.15)'
        }}>
          <span style={{ fontSize: '0.9rem' }}>🪙</span>
          <span style={{ color: '#ffd700', fontWeight: '800', fontSize: '0.84rem' }}>
            {profile?.total_gold || 0}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '6px 12px 14px 12px' }}>

        {/* 3. GÜNÜN FLAŞ FIRSATI (CANLI GERİ SAYIM SAYACI - İNCELTİLMİŞ) */}
        <div style={{
          background: 'linear-gradient(90deg, #ff0844 0%, #ff4e50 100%)',
          borderRadius: '14px', padding: '7px 12px',
          marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 4px 14px rgba(255, 8, 68, 0.3)', animation: 'pulse 2s infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.2rem' }}>⚡</span>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: '900', color: '#fff', letterSpacing: '0.2px' }}>
                {t('market_flash_sale_title')}
              </div>
              <div style={{ fontSize: '0.67rem', color: 'rgba(255,255,255,0.92)', fontWeight: '600', lineHeight: 1.15 }}>
                {t('market_flash_sale_desc')}
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.35)', padding: '3px 8px', borderRadius: '10px',
            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: '800', color: '#fff', flexShrink: 0
          }}>
            <Clock size={12} />
            <span>
              {String(countdown.hours).padStart(2, '0')}:
              {String(countdown.minutes).padStart(2, '0')}:
              {String(countdown.seconds).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* 🎬 3.5 ÜCRETSİZ ALTIN KAZAN (ÖDÜLLÜ REKLAM BANNERI - İNCELTİLMİŞ) */}
        <div 
          onClick={handleStartWatchAd}
          style={{
            background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.15) 0%, rgba(79, 172, 254, 0.05) 100%)',
            border: '1.2px solid rgba(0, 242, 254, 0.4)',
            borderRadius: '16px', padding: '8px 12px',
            marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: remainingDailyAds > 0 ? 'pointer' : 'default',
            boxShadow: '0 3px 14px rgba(0, 242, 254, 0.12)',
            position: 'relative', overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 3px 10px rgba(0, 242, 254, 0.35)', flexShrink: 0
            }}>
              <Play size={18} color="#000" fill="#000" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.84rem', fontWeight: '900', color: '#fff' }}>
                  {t('market_free_gold_title')}
                </span>
                <span style={{
                  background: 'rgba(46, 204, 113, 0.2)', border: '1px solid #2ecc71',
                  color: '#2ecc71', fontSize: '0.65rem', fontWeight: '900',
                  padding: '1px 6px', borderRadius: '6px'
                }}>
                  {t('market_free_gold_badge')}
                </span>
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)' }}>
                {t('market_free_gold_desc')}
              </p>
            </div>
          </div>

          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{
              background: remainingDailyAds > 0 ? 'linear-gradient(135deg, #00f2fe, #4facfe)' : 'rgba(255,255,255,0.1)',
              color: remainingDailyAds > 0 ? '#000' : 'rgba(255,255,255,0.4)',
              padding: '6px 12px', borderRadius: '12px',
              fontWeight: '900', fontSize: '0.78rem',
              boxShadow: remainingDailyAds > 0 ? '0 2px 8px rgba(0,242,254,0.3)' : 'none'
            }}>
              {remainingDailyAds > 0 ? t('market_free_gold_watch') : t('market_free_gold_done')}
            </div>
            <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)', marginTop: '3px', fontWeight: '700' }}>
              {t('market_free_gold_remaining', { count: remainingDailyAds })}
            </div>
          </div>
        </div>

        {/* 4. ALTIN PAKETLERİ (2 KOLONLU KART IZGARASI) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '24px'
        }}>
          {packages.map((pkg) => {
            const isHighlighted = pkg.isBestValue || pkg.isPopular;
            return (
              <div
                key={pkg.id}
                onClick={() => handleSelectPackage(pkg)}
                style={{
                  background: isHighlighted
                    ? 'linear-gradient(165deg, rgba(255, 215, 0, 0.12) 0%, rgba(20, 22, 45, 0.95) 100%)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isHighlighted
                    ? '2px solid rgba(255, 215, 0, 0.7)'
                    : '1px solid rgba(255, 255, 255, 0.09)',
                  borderRadius: '20px',
                  padding: '14px 10px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isHighlighted 
                    ? '0 8px 25px rgba(255, 215, 0, 0.2), inset 0 0 15px rgba(255, 215, 0, 0.05)'
                    : '0 4px 15px rgba(0,0,0,0.3)',
                  transform: isHighlighted ? 'scale(1.02)' : 'none'
                }}
              >
                {/* İndirim Rozeti (Kart Üstünde Asılı Şerit) */}
                <div style={{
                  position: 'absolute', top: '-9px',
                  background: isHighlighted
                    ? 'linear-gradient(135deg, #ff0844, #ffb199)'
                    : 'linear-gradient(135deg, #ffd700, #ff9800)',
                  color: isHighlighted ? '#fff' : '#000',
                  fontSize: '0.62rem', fontWeight: '900',
                  padding: '2px 8px', borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                  letterSpacing: '0.3px', textTransform: 'uppercase'
                }}>
                  {pkg.discountBadge}
                </div>

                {/* 3D Görsel İkon */}
                <div style={{ marginTop: '8px', marginBottom: '6px' }}>
                  {renderPackageIcon(pkg.iconType)}
                </div>

                {/* Altın Miktarı */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px', marginBottom: '2px' }}>
                  <span style={{ fontSize: '1.45rem', fontWeight: '900', color: '#fff' }}>
                    {pkg.gold}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#ffd700', fontWeight: '800' }}>{t('gold_currency_label')}</span>
                </div>

                {/* Bonus Bilgisi */}
                <div style={{
                  background: 'rgba(46, 204, 113, 0.15)', border: '1px solid rgba(46, 204, 113, 0.4)',
                  color: '#2ecc71', fontSize: '0.65rem', fontWeight: '800',
                  padding: '2px 6px', borderRadius: '8px', marginBottom: '8px'
                }}>
                  {t('market_bonus_gift', { count: pkg.bonus })}
                </div>

                {/* Eski Çizili Fiyat */}
                <div style={{
                  fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)',
                  textDecoration: 'line-through', marginBottom: '4px'
                }}>
                  {isTr ? pkg.oldPriceTr : pkg.oldPriceEn}
                </div>

                {/* Satın Alma Butonu */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectPackage(pkg);
                  }}
                  style={{
                    width: '100%',
                    background: isHighlighted
                      ? 'linear-gradient(135deg, #ffd700 0%, #ff9800 100%)'
                      : 'linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.06))',
                    border: isHighlighted ? 'none' : '1px solid rgba(255,255,255,0.18)',
                    color: isHighlighted ? '#000' : '#fff',
                    padding: '8px 4px',
                    borderRadius: '14px',
                    fontWeight: '900',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    boxShadow: isHighlighted ? '0 4px 14px rgba(255, 215, 0, 0.4)' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px'
                  }}
                >
                  <span>{isTr ? pkg.priceTr : pkg.priceEn}</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* 5. AYLIK VIP KULÜBÜ KARTI (VIP PASS) */}
        <div style={{
          background: 'linear-gradient(135deg, #1f1b3c 0%, #301f4c 50%, #17152d 100%)',
          border: '1.5px solid #a855f7',
          borderRadius: '22px', padding: '18px 16px',
          marginBottom: '24px', position: 'relative', overflow: 'hidden',
          boxShadow: '0 8px 30px rgba(168, 85, 247, 0.25)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '10px',
                background: 'rgba(168, 85, 247, 0.25)', border: '1px solid #a855f7',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Crown size={20} color="#a855f7" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: '#fff' }}>
                  {t('market_vip_title')}
                </h3>
                <span style={{ fontSize: '0.72rem', color: '#c084fc', fontWeight: '700' }}>
                  {t('market_vip_subtitle')}
                </span>
              </div>
            </div>

            <span style={{
              background: 'linear-gradient(135deg, #a855f7, #ec4899)',
              padding: '4px 10px', borderRadius: '12px', color: '#fff',
              fontSize: '0.75rem', fontWeight: '800'
            }}>
              {t('market_vip_period')}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
            {[
              t('market_vip_perk_1'),
              t('market_vip_perk_2'),
              t('market_vip_perk_3'),
              t('market_vip_perk_4')
            ].map((perk, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: 'rgba(255,255,255,0.85)' }}>
                <Check size={14} color="#a855f7" />
                <span>{perk}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              handleSelectPackage({
                id: 'vip_monthly',
                name: 'Pyngoo VIP Pass',
                gold: 1500,
                bonus: 500,
                priceTr: '249.99 ₺',
                priceEn: '$4.99',
                oldPriceTr: '499.99 ₺',
                oldPriceEn: '$9.99',
                discountBadge: t('market_badge_discount_70'),
                appleProductId: 'com.pyngoo.vip.monthly',
                iconType: 'crown'
              });
            }}
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
              border: 'none', color: '#fff', padding: '10px', borderRadius: '14px',
              fontWeight: '800', fontSize: '0.88rem', cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(168, 85, 247, 0.4)'
            }}
          >
            {t('market_vip_btn')}
          </button>
        </div>

        {/* 6. GÜVENLİK & ÖDEME ROZETLERİ (TRUST BAR) */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '16px', padding: '14px', textAlign: 'center'
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#2ecc71', fontSize: '0.72rem', fontWeight: '700' }}>
              <ShieldCheck size={16} />
              <span>{t('market_trust_ssl')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#00f2fe', fontSize: '0.72rem', fontWeight: '700' }}>
              <Zap size={16} />
              <span>{t('market_trust_instant')}</span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', lineHeight: '1.4' }}>
            {t('market_trust_desc')}
          </p>
        </div>

      </div>

      {/* 7. ÖDEME ONAY MODALI (BOTTOM SHEET / POPUP) */}
      {selectedPackage && createPortal(
        <div
          onClick={() => {
            if (applePurchaseState !== 'processing') setSelectedPackage(null);
          }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 100005, animation: 'fadeIn 0.2s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '480px',
              maxHeight: '90vh', overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              background: 'linear-gradient(180deg, #1c1d3b 0%, #101124 100%)',
              border: '1px solid rgba(255,255,255,0.15)', borderBottom: 'none',
              borderRadius: '28px 28px 0 0',
              padding: '20px 20px calc(env(safe-area-inset-bottom, 24px) + 70px) 20px',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.9)',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            {/* Çekme Çubuğu */}
            <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', margin: '0 auto 16px auto' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>
                {t('market_modal_title')}
              </h3>
              <button
                disabled={applePurchaseState === 'processing'}
                onClick={() => setSelectedPackage(null)}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)', border: 'none',
                  color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Seçilen Paket Özeti */}
            <div style={{
              background: 'rgba(255, 215, 0, 0.08)', border: '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: '18px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {renderPackageIcon(selectedPackage.iconType)}
                <div>
                  <h4 style={{ margin: 0, color: '#fff', fontSize: '1.05rem', fontWeight: '800' }}>
                    {selectedPackage.gold} {t('gold_currency_label')}
                  </h4>
                  <span style={{ color: '#2ecc71', fontSize: '0.78rem', fontWeight: '700' }}>
                    {t('market_modal_bonus', { count: selectedPackage.bonus })}
                  </span>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#ffd700', fontSize: '1.3rem', fontWeight: '900' }}>
                  {isTr ? selectedPackage.priceTr : selectedPackage.priceEn}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textDecoration: 'line-through' }}>
                  {isTr ? selectedPackage.oldPriceTr : selectedPackage.oldPriceEn}
                </div>
              </div>
            </div>

            {isIosNative() || __IS_IOS__ ? (
              // iOS Platform StoreKit In-App Purchase Panel
              <div style={{ marginBottom: '16px' }}>
                {renderApplePurchasePanel()}
              </div>
            ) : isAndroidNative() ? (
              // Android Platform Panel
              <div style={{
                marginBottom: '16px', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.12)', borderRadius: '16px', padding: '16px',
                textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', lineHeight: '1.4'
              }}>
                {t('market_android_coming_soon')}
              </div>
            ) : WebPaymentMethods ? (
              <Suspense fallback={<div style={{ textAlign: 'center', padding: '16px', color: '#fff' }}>Yükleniyor...</div>}>
                <WebPaymentMethods
                  selectedPackage={selectedPackage}
                  userId={userId}
                  profile={profile}
                  orderCode={orderCode}
                  isTr={Boolean(isTr)}
                  onClose={() => setSelectedPackage(null)}
                  onSuccess={() => {
                    const pkg = selectedPackage;
                    setSelectedPackage(null);
                    setPurchaseSuccess(pkg);
                  }}
                />
              </Suspense>
            ) : null}

            {/* İade Politikası & Tüketici Güvencesi */}
            <div style={{ marginTop: '12px', textAlign: 'center' }}>
              <span
                onClick={() => setLegalModalType('refund')}
                style={{
                  fontSize: '0.72rem',
                  color: 'rgba(255, 215, 0, 0.88)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <span>🛡️</span>
                <span>{t('market_refund_hint', 'Satın alımlarınız 14 Günlük İptal ve İade Politikamıza tabidir.')}</span>
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 8. BAŞARILI SATIN ALMA TEBRİK OVERLAY'İ (KUTLAMA / CONFETTI) */}
      {purchaseSuccess && <TreasureRewardModal amount={purchaseSuccess.gold + purchaseSuccess.bonus} onClose={() => setPurchaseSuccess(null)} />}

      {/* 9. ÖDÜLLÜ VİDEO REKLAM OYNATICI MODALI (ADSENSE / REWARDED AD SIMULATION) */}
      {showAdModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(15px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 3500, animation: 'fadeIn 0.2s ease', padding: '16px'
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #181a33 0%, #0d0e1c 100%)',
            border: '2px solid rgba(0, 242, 254, 0.5)', borderRadius: '24px',
            width: '100%', maxWidth: '420px', overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(0, 242, 254, 0.3)',
            animation: 'slideUp 0.3s ease-out', position: 'relative'
          }}>
            {/* Reklam Üst Başlığı */}
            <div style={{
              background: 'rgba(0,0,0,0.6)', padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  background: '#2ecc71', color: '#000',
                  fontSize: '0.65rem', fontWeight: '900', padding: '2px 7px', borderRadius: '6px'
                }}>
                  {t('market_ad_badge')}
                </span>
                <span style={{ fontSize: '0.82rem', color: '#fff', fontWeight: '700' }}>
                  {t('market_ad_sponsor_title')}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdMuted(!isAdMuted)}
                  style={{
                    background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                    borderRadius: '8px', padding: '4px 8px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', marginLeft: '4px'
                  }}
                  title={isAdMuted ? t('market_ad_unmute') : t('market_ad_mute')}
                >
                  {isAdMuted ? <VolumeX size={14} /> : <Volume2 size={14} color="#00f2fe" />}
                </button>
              </div>

              {adFinished ? (
                <button
                  onClick={() => setShowAdModal(false)}
                  style={{
                    background: 'linear-gradient(135deg, #ff416c, #ff4b2b)', border: 'none', color: '#fff',
                    padding: '5px 12px', borderRadius: '12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '800', fontSize: '0.78rem',
                    boxShadow: '0 2px 10px rgba(255, 65, 108, 0.4)', animation: 'pulse 1.2s infinite'
                  }}
                >
                  <X size={15} /> {t('close')}
                </button>
              ) : (
                <div style={{
                  background: 'rgba(255, 45, 85, 0.25)', border: '1px solid #ff2d55',
                  color: '#ff6b81', fontSize: '0.78rem', fontWeight: '800',
                  padding: '3px 10px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  <span>⏳</span> {adSecondsLeft}s
                </div>
              )}
            </div>

            {/* Video Oynatıcı Alanı */}
            <div style={{
              height: '250px', background: '#000',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden'
            }}>
              <video
                key={showAdModal ? 'ad_active' : 'ad_inactive'}
                src="/videos/sponsor_ad.mp4"
                autoPlay
                muted={isAdMuted}
                playsInline
                loop
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />

              {/* İlerleme Çubuğu (Progress Bar) */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '5px',
                background: 'rgba(255,255,255,0.2)', zIndex: 3
              }}>
                <div style={{
                  height: '100%',
                  width: `${((15 - adSecondsLeft) / 15) * 100}%`,
                  background: 'linear-gradient(90deg, #00f2fe, #2ecc71)',
                  transition: 'width 1s linear'
                }} />
              </div>
            </div>

            {/* Reklam Alt Aksiyon Alanı */}
            <div style={{ padding: '16px 20px', background: 'rgba(0,0,0,0.5)', textAlign: 'center' }}>
              {adFinished ? (
                <button
                  onClick={handleClaimAdReward}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #2ecc71 0%, #11998e 100%)',
                    border: 'none', color: '#fff', padding: '14px', borderRadius: '16px',
                    fontWeight: '900', fontSize: '1.02rem', cursor: 'pointer',
                    boxShadow: '0 4px 25px rgba(46, 204, 113, 0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    animation: 'pulse 1s infinite'
                  }}
                >
                  <Gift size={22} />
                  <span>{t('market_ad_claim_btn')}</span>
                </button>
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.82rem', fontWeight: '600' }}>
                  {t('market_ad_time_remaining')} <strong style={{ color: '#00f2fe', fontSize: '0.95rem' }}>{adSecondsLeft}s</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Yasal & İade Politikası Modalı */}
      <LegalModal type={legalModalType} onClose={() => setLegalModalType(null)} />

    </div>
  );
}
