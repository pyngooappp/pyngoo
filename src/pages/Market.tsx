import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { 
  Coins, 
  Crown, 
  ShieldCheck, 
  Zap, 
  Check, 
  CreditCard, 
  ArrowLeft,
  X,
  Clock,
  Gift,
  Play,
  Copy,
  Smartphone,
  Volume2,
  VolumeX
} from 'lucide-react';
import { soundManager } from '../utils/SoundManager';
import { sendTelegramAlert } from '../utils/telegramAlert';
import { logTransaction } from '../utils/transactionService';
import { processCryptoPayment } from '../utils/cryptoVerifyService';
import { admobService } from '../utils/admobService';
import { LegalModal, type LegalModalType } from '../components/LegalModal';

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
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'crypto' | 'havale_papara'>(() => isTr ? 'havale_papara' : 'crypto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState<GoldPackage | null>(null);
  const [legalModalType, setLegalModalType] = useState<LegalModalType>(null);

  // Kripto (USDT - TRC20) Durumları (Binance Global)
  const CRYPTO_WALLET = 'TDwYUwBrV6mSmJvmcP93VSTnBtWrXnpFsu';
  const [cryptoTxId, setCryptoTxId] = useState('');
  const [cryptoSubmitted, setCryptoSubmitted] = useState(false);
  const [cryptoResult, setCryptoResult] = useState<{ isAutoCredited: boolean; message: string; goldAdded?: number } | null>(null);

  const getUsdtPrice = (pkg: GoldPackage | null) => {
    if (!pkg) return '1.00';
    return pkg.priceUsdt || '1.00';
  };

  // Havale / EFT & Transfer Durumları
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [senderName, setSenderName] = useState('');
  const [transferSubmitted, setTransferSubmitted] = useState(false);
  const [cardSubmitted, setCardSubmitted] = useState(false);
  const [orderCode, setOrderCode] = useState(() => `PYN-${Math.floor(1000 + Math.random() * 9000)}`);
  const [validationError, setValidationError] = useState<string | null>(null);

  // 30 Saniye Spam Engelleme / Rate Limit Geri Sayımı
  const [cooldownSeconds, setCooldownSeconds] = useState(() => {
    try {
      const expire = localStorage.getItem(`pyngoo_payment_cooldown_${userId}`);
      if (expire) {
        const remaining = Math.ceil((parseInt(expire, 10) - Date.now()) / 1000);
        return remaining > 0 ? remaining : 0;
      }
    } catch (_) {}
    return 0;
  });

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const startCooldown = (sec = 30) => {
    setCooldownSeconds(sec);
    try {
      localStorage.setItem(`pyngoo_payment_cooldown_${userId}`, (Date.now() + sec * 1000).toString());
    } catch (_) {}
  };

  const handleSelectPackage = (pkg: GoldPackage) => {
    // Her paket açılışında benzersiz yeni sipariş kodu üret
    setOrderCode(`PYN-${Math.floor(1000 + Math.random() * 9000)}`);
    setCardSubmitted(false);
    setTransferSubmitted(false);
    setCryptoSubmitted(false);
    setValidationError(null);
    if (!isTr && paymentMethod === 'havale_papara') {
      setPaymentMethod('card');
    }
    setSelectedPackage(pkg);
  };

  const handleCopyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

const SHOPIER_PRODUCT_URLS: Record<string, string> = {
  pack_650: 'https://www.shopier.com/pyngoo/50771182',
  pack_1400: 'https://www.shopier.com/pyngoo/50771257',
  pack_3800: 'https://www.shopier.com/pyngoo/50771291',
  pack_8500: 'https://www.shopier.com/pyngoo/50771329',
  pack_18000: 'https://www.shopier.com/pyngoo/50771375',
  pack_40000: 'https://www.shopier.com/pyngoo/50771402',
  pack_85000: 'https://www.shopier.com/pyngoo/50771423',
};

  const openShopierPopup = () => {
    const targetUrl = (selectedPackage && SHOPIER_PRODUCT_URLS[selectedPackage.id]) || 'https://www.shopier.com/pyngoo';
    const width = 500;
    const height = 750;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const popupFeatures = `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no,location=no,scrollbars=yes`;
    window.open(targetUrl, 'PyngooShopierPay', popupFeatures);
  };

  const handleCardSubmit = () => {
    if (!selectedPackage) return;
    setIsProcessing(true);
    soundManager.playCoinSound();

    try {
      const msg = `
💳 <b>YENİ SHOPIER KART ÖDEME TALEBİ!</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Kullanıcı:</b> ${profile?.display_name || 'Kullanıcı'} (<code>${userId.slice(0, 8)}</code>)
🪙 <b>Paket:</b> ${selectedPackage.gold} Altın (+${selectedPackage.bonus} Hediye)
💵 <b>Tutar:</b> ${isTr ? selectedPackage.priceTr : selectedPackage.priceEn}
🏷️ <b>Sipariş Kodu:</b> <code>${orderCode}</code>
📅 <b>Tarih:</b> ${new Date().toLocaleDateString('tr-TR')} • ${new Date().toLocaleTimeString('tr-TR')}
      `.trim();
      sendTelegramAlert(msg);
    } catch (_) {}

    openShopierPopup();

    setTimeout(() => {
      setIsProcessing(false);
      setCardSubmitted(true);
    }, 600);
  };

  const handleTransferSubmit = async () => {
    setValidationError(null);
    if (!selectedPackage) return;

    if (cooldownSeconds > 0) {
      setValidationError(`⚠️ Lütfen tekrar bildirim göndermek için ${cooldownSeconds} saniye bekleyin.`);
      return;
    }

    if (!senderName.trim() || senderName.trim().length < 3) {
      setValidationError('⚠️ Havale/FAST transferlerinde banka dekontundaki "Gönderen Adı Soyadı" zorunludur!');
      return;
    }

    setIsProcessing(true);
    soundManager.playCoinSound();
    startCooldown(30);

    const totalGold = (selectedPackage.gold || 0) + (selectedPackage.bonus || 0);

    // 1. Veritabanına payment_notifications kaydı ekle (Yönetici Paneli için)
    try {
      const { error: insErr } = await supabase.from('payment_notifications').insert([{
        user_id: userId,
        user_name: profile?.display_name || 'Kullanıcı',
        payment_method: 'havale',
        gold_amount: selectedPackage.gold || 0,
        bonus_amount: selectedPackage.bonus || 0,
        total_gold: totalGold,
        price_text: isTr ? selectedPackage.priceTr : selectedPackage.priceEn,
        order_code: orderCode,
        sender_name: senderName.trim(),
        status: 'pending'
      }]);

      if (insErr) {
        console.warn('payment_notifications veritabanı uyarısı (yedek alınıyor):', insErr);
        const localOrders = JSON.parse(localStorage.getItem('pyngoo_local_payment_notifications') || '[]');
        localOrders.unshift({
          id: `local_${Date.now()}`,
          user_id: userId,
          user_name: profile?.display_name || 'Kullanıcı',
          payment_method: 'havale',
          gold_amount: selectedPackage.gold || 0,
          bonus_amount: selectedPackage.bonus || 0,
          total_gold: totalGold,
          price_text: isTr ? selectedPackage.priceTr : selectedPackage.priceEn,
          order_code: orderCode,
          sender_name: senderName.trim(),
          status: 'pending',
          created_at: new Date().toISOString()
        });
        localStorage.setItem('pyngoo_local_payment_notifications', JSON.stringify(localOrders.slice(0, 100)));
      }
    } catch (_) {}

    // 2. Telegram Bildirimi Gönder
    try {
      const msg = `
🏦 <b>YENİ VAKIFBANK HAVALE / FAST BİLDİRİMİ!</b>
━━━━━━━━━━━━━━━━━━━━━━
👤 <b>Kullanıcı:</b> ${profile?.display_name || 'Kullanıcı'} (<code>${userId.slice(0, 8)}</code>)
🪙 <b>Paket:</b> ${selectedPackage.gold} Altın (+${selectedPackage.bonus} Hediye) = <b>${totalGold} Altın</b>
💵 <b>Tutar:</b> ${isTr ? selectedPackage.priceTr : selectedPackage.priceEn}
🏷️ <b>Zorunlu Kod:</b> <code>${orderCode}</code>
✍️ <b>Gönderen Ad Soyad:</b> <b>${senderName.trim()}</b>
📅 <b>Tarih:</b> ${new Date().toLocaleDateString('tr-TR')} • ${new Date().toLocaleTimeString('tr-TR')}

<i>Lütfen VakıfBank hesabınızı kontrol edip Moderatör Panelinden tek tıkla onaylayınız.</i>
      `.trim();
      await sendTelegramAlert(msg);
    } catch (_) {}

    setIsProcessing(false);
    setTransferSubmitted(true);

    setTimeout(() => {
      setTransferSubmitted(false);
      setSelectedPackage(null);
      setSenderName('');
      setOrderCode(`PYN-${Math.floor(1000 + Math.random() * 9000)}`);
    }, 4000);
  };

  const handleCryptoSubmit = async () => {
    setValidationError(null);
    if (!selectedPackage) return;

    if (cooldownSeconds > 0) {
      setValidationError(`⚠️ Lütfen tekrar bildirim göndermek için ${cooldownSeconds} saniye bekleyin.`);
      return;
    }

    if (!cryptoTxId.trim() || cryptoTxId.trim().length < 8) {
      setValidationError('⚠️ Kripto transferlerinde "İşlem Kodu (TXID)" veya "Gönderici Cüzdan Adresi" zorunludur!');
      return;
    }

    setIsProcessing(true);
    soundManager.playCoinSound();
    startCooldown(30);

    const totalGold = (selectedPackage.gold || 0) + (selectedPackage.bonus || 0);
    const usdtAmt = getUsdtPrice(selectedPackage);

    // 1. Veritabanına payment_notifications kaydı ekle (Yönetici Paneli için)
    try {
      const { error: insErr } = await supabase.from('payment_notifications').insert([{
        user_id: userId,
        user_name: profile?.display_name || 'Kullanıcı',
        payment_method: 'crypto',
        gold_amount: selectedPackage.gold || 0,
        bonus_amount: selectedPackage.bonus || 0,
        total_gold: totalGold,
        price_text: `${usdtAmt} USDT`,
        order_code: orderCode,
        crypto_txid: cryptoTxId.trim(),
        status: 'pending'
      }]);

      if (insErr) {
        console.warn('payment_notifications veritabanı uyarısı (yedek alınıyor):', insErr);
        const localOrders = JSON.parse(localStorage.getItem('pyngoo_local_payment_notifications') || '[]');
        localOrders.unshift({
          id: `local_${Date.now()}`,
          user_id: userId,
          user_name: profile?.display_name || 'Kullanıcı',
          payment_method: 'crypto',
          gold_amount: selectedPackage.gold || 0,
          bonus_amount: selectedPackage.bonus || 0,
          total_gold: totalGold,
          price_text: `${usdtAmt} USDT`,
          order_code: orderCode,
          crypto_txid: cryptoTxId.trim(),
          status: 'pending',
          created_at: new Date().toISOString()
        });
        localStorage.setItem('pyngoo_local_payment_notifications', JSON.stringify(localOrders.slice(0, 100)));
      }
    } catch (_) {}

    const result = await processCryptoPayment(
      userId,
      profile?.display_name || 'Kullanıcı',
      cryptoTxId.trim(),
      selectedPackage,
      usdtAmt,
      orderCode
    );

    setIsProcessing(false);
    setCryptoSubmitted(true);
    setCryptoResult(result);

    if (result.isAutoCredited && result.goldAdded) {
      setProfile((prev: any) => ({ ...prev, total_gold: (prev?.total_gold || 0) + result.goldAdded }));
      soundManager.playCoinSound();
    }

    setTimeout(() => {
      setCryptoSubmitted(false);
      setCryptoResult(null);
      setSelectedPackage(null);
      setCryptoTxId('');
    }, 5500);
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
    const isOmer = userId === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b' || userId === '22b3c0e7-e1e2-4cb5-9532-990066b5a80c';
    if (!isOmer && profile?.gender === 'kadin') {
      navigate('/wallet', { replace: true });
      return;
    }
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
          if (!isOmer && data.gender === 'kadin') {
            navigate('/wallet', { replace: true });
            return;
          }
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
        }
      })
      .subscribe();

    return () => {
      window.removeEventListener('pyngoo_gold_updated', handleGoldUpdated);
      supabase.removeChannel(profileChan);
    };
  }, [userId, navigate]);

  const isOmer = userId === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b' || userId === '22b3c0e7-e1e2-4cb5-9532-990066b5a80c';
  // Yalnızca profili kesin olarak kadın olan kullanıcılar için Altın Marketi kapalıdır
  if (!isOmer && profile?.gender === 'kadin') {
    return null;
  }

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
      discountBadge: '%45 İndirim',
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
      discountBadge: '%50 İndirim',
      isPopular: true,
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
      discountBadge: '%55 İndirim',
      isBestValue: true,
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
      discountBadge: '%60 İndirim',
      isVip: true,
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
      discountBadge: '%65 İndirim',
      isVip: true,
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
      discountBadge: '%70 İndirim',
      isVip: true,
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
      discountBadge: '%75 İndirim',
      isVip: true,
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
      {/* 1. ÜST BAR & BAŞLIK */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(12, 13, 26, 0.85)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'rgba(255,255,255,0.08)', border: 'none',
            color: '#fff', width: '38px', height: '38px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #ffd700, #ff8800)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(255, 215, 0, 0.5)'
          }}>
            <Coins size={16} color="#000" />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', letterSpacing: '0.3px' }}>
            {t('market_title')}
          </h2>
        </div>

        {/* Canlı Bakiye Rozeti */}
        <div style={{
          background: 'rgba(255, 215, 0, 0.12)', border: '1px solid rgba(255, 215, 0, 0.35)',
          padding: '4px 12px', borderRadius: '20px',
          display: 'flex', alignItems: 'center', gap: '6px',
          boxShadow: '0 2px 10px rgba(255, 215, 0, 0.15)'
        }}>
          <span style={{ fontSize: '1rem' }}>🪙</span>
          <span style={{ color: '#ffd700', fontWeight: '800', fontSize: '0.9rem' }}>
            {profile?.total_gold || 0}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '16px 14px' }}>

        {/* 3. GÜNÜN FLAŞ FIRSATI (CANLI GERİ SAYIM SAYACI) */}
        <div style={{
          background: 'linear-gradient(90deg, #ff0844 0%, #ff4e50 100%)',
          borderRadius: '18px', padding: '12px 16px',
          marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 6px 20px rgba(255, 8, 68, 0.35)', animation: 'pulse 2s infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.5rem' }}>⚡</span>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: '900', color: '#fff', letterSpacing: '0.3px' }}>
                {t('market_flash_sale_title')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.9)', fontWeight: '600' }}>
                {t('market_flash_sale_desc')}
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: '12px',
            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: '800', color: '#fff'
          }}>
            <Clock size={13} />
            <span>
              {String(countdown.hours).padStart(2, '0')}:
              {String(countdown.minutes).padStart(2, '0')}:
              {String(countdown.seconds).padStart(2, '0')}
            </span>
          </div>
        </div>

        {/* 🎬 3.5 ÜCRETSİZ ALTIN KAZAN (ÖDÜLLÜ REKLAM BANNERI) */}
        <div 
          onClick={handleStartWatchAd}
          style={{
            background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.15) 0%, rgba(79, 172, 254, 0.05) 100%)',
            border: '1.5px solid rgba(0, 242, 254, 0.4)',
            borderRadius: '20px', padding: '14px 16px',
            marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            cursor: remainingDailyAds > 0 ? 'pointer' : 'default',
            boxShadow: '0 4px 20px rgba(0, 242, 254, 0.15)',
            position: 'relative', overflow: 'hidden'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '14px',
              background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 242, 254, 0.4)', flexShrink: 0
            }}>
              <Play size={22} color="#000" fill="#000" />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.92rem', fontWeight: '900', color: '#fff' }}>
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
                priceTr: '149.99 ₺',
                priceEn: '$4.99',
                oldPriceTr: '299.99 ₺',
                oldPriceEn: '$9.99',
                discountBadge: t('market_badge_discount_70'),
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
      {selectedPackage && (
        <div
          onClick={() => {
            if (!isProcessing) setSelectedPackage(null);
          }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            zIndex: 2000, animation: 'fadeIn 0.2s ease'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '480px',
              background: 'linear-gradient(180deg, #1c1d3b 0%, #101124 100%)',
              border: '1px solid rgba(255,255,255,0.15)', borderBottom: 'none',
              borderRadius: '28px 28px 0 0',
              padding: '20px 20px calc(env(safe-area-inset-bottom, 0px) + 24px) 20px',
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
                disabled={isProcessing}
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

            {/* Ödeme Yöntemi Seçim Sekmeleri (Shopier Kart vs Kripto vs IBAN / Papara) */}
            {/* Ödeme Yöntemi Seçim Sekmeleri (Türkçe için 3 Kolon, Diğer Diller için 2 Kolon) */}
            <div style={{ marginBottom: '16px' }}>
              <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', fontWeight: '700', display: 'block', marginBottom: '8px' }}>
                {t('market_modal_select_method', 'Select Payment Method:')}
              </span>
              
              <div style={{
                display: 'grid',
                gridTemplateColumns: isTr ? '1fr 1fr 1fr' : '1fr 1fr',
                gap: '8px',
                marginBottom: '14px'
              }}>
                {/* 1. SEÇENEK: KART (SHOPIER - ONAY AŞAMASINDA) */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  style={{
                    padding: '10px 6px', borderRadius: '14px', textAlign: 'center',
                    background: paymentMethod === 'card' ? 'rgba(255, 215, 0, 0.16)' : 'rgba(255,255,255,0.04)',
                    border: paymentMethod === 'card' ? '2px solid #ffd700' : '1px solid rgba(255,255,255,0.1)',
                    color: paymentMethod === 'card' ? '#ffd700' : 'rgba(255,255,255,0.8)',
                    cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px'
                  }}
                >
                  <CreditCard size={19} color={paymentMethod === 'card' ? '#ffd700' : '#fff'} />
                  <span style={{ fontSize: '0.74rem', fontWeight: '800' }}>{t('market_modal_credit_card', 'Credit Card')}</span>
                  <span style={{ fontSize: '0.58rem', color: '#2ecc71', fontWeight: '800' }}>{isTr ? '⚡ 3D Secure Kart' : '⚡ 3D Secure'}</span>
                </button>

                {/* 2. SEÇENEK: KRİPTO (USDT - TRC20) */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('crypto')}
                  style={{
                    padding: '10px 6px', borderRadius: '14px', textAlign: 'center',
                    background: paymentMethod === 'crypto' ? 'rgba(0, 230, 118, 0.16)' : 'rgba(255,255,255,0.04)',
                    border: paymentMethod === 'crypto' ? '2px solid #00e676' : '1px solid rgba(255,255,255,0.1)',
                    color: paymentMethod === 'crypto' ? '#00e676' : 'rgba(255,255,255,0.8)',
                    cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px'
                  }}
                >
                  <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>🪙</span>
                  <span style={{ fontSize: '0.74rem', fontWeight: '800' }}>{t('market_modal_crypto_title', 'Crypto (USDT)')}</span>
                  <span style={{ fontSize: '0.58rem', color: '#00e676', fontWeight: '700' }}>{t('market_modal_crypto_sub', 'Zero Fee')}</span>
                </button>

                {/* 3. SEÇENEK: HAVALE / FAST (SADECE TÜRKÇE KULLANICILAR İÇİN GÖRÜNÜR) */}
                {isTr && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('havale_papara')}
                    style={{
                      padding: '10px 6px', borderRadius: '14px', textAlign: 'center',
                      background: paymentMethod === 'havale_papara' ? 'rgba(0, 242, 254, 0.16)' : 'rgba(255,255,255,0.04)',
                      border: paymentMethod === 'havale_papara' ? '2px solid #00f2fe' : '1px solid rgba(255,255,255,0.1)',
                      color: paymentMethod === 'havale_papara' ? '#00f2fe' : 'rgba(255,255,255,0.8)',
                      cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px'
                    }}
                  >
                    <Smartphone size={19} color={paymentMethod === 'havale_papara' ? '#00f2fe' : '#fff'} />
                    <span style={{ fontSize: '0.74rem', fontWeight: '800' }}>{t('market_modal_transfer', 'Havale / EFT')}</span>
                    <span style={{ fontSize: '0.58rem', color: '#00f2fe', fontWeight: '700' }}>{t('market_modal_transfer_sub', '7/24 FAST & Havale')}</span>
                  </button>
                )}
              </div>

              {/* SEÇİLEN ÖDEME YÖNTEMİNİN İÇERİĞİ */}
              {paymentMethod === 'card' && (
                /* 💳 KREDİ / BANKA KARTI (SHOPIER 3D SECURE) */
                <div style={{
                  background: 'rgba(255, 215, 0, 0.06)', border: '1.5px solid rgba(255, 215, 0, 0.35)',
                  borderRadius: '16px', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ShieldCheck size={18} color="#ffd700" />
                      <span style={{ color: '#fff', fontSize: '0.86rem', fontWeight: '800' }}>
                        {isTr ? 'Shopier 3D Secure Kart ile Ödeme' : 'Shopier 3D Secure Card Checkout'}
                      </span>
                    </div>
                    <span style={{ background: 'rgba(46, 204, 113, 0.2)', border: '1px solid #2ecc71', color: '#2ecc71', fontSize: '0.62rem', fontWeight: '800', padding: '2px 7px', borderRadius: '8px' }}>
                      7/24 AKTİF
                    </span>
                  </div>

                  <div style={{
                    background: 'rgba(255, 255, 255, 0.04)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    fontSize: '0.76rem',
                    color: 'rgba(255, 255, 255, 0.85)',
                    lineHeight: '1.45'
                  }}>
                    {isTr 
                      ? 'Tüm yerli ve yabancı Visa, Mastercard ve Troy kartlarınızla 256-Bit SSL şifreleme ve 3D Secure SMS onayı ile anında güvenle ödeyebilirsiniz.' 
                      : 'Pay securely with Visa, Mastercard and all credit/debit cards protected by 256-Bit SSL and 3D Secure.'}
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(0, 242, 254, 0.08)', border: '1px dashed #00f2fe',
                    borderRadius: '12px', padding: '9px 12px'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.62rem', color: '#00f2fe', fontWeight: '700', textTransform: 'uppercase' }}>
                        {isTr ? 'Sipariş / Eşleşme Takip Kodunuz' : 'Order Tracking Code'}
                      </div>
                      <div style={{ color: '#fff', fontWeight: '900', fontFamily: 'monospace', fontSize: '0.88rem', marginTop: '1px' }}>
                        {orderCode}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyText(orderCode, 'code')}
                      style={{
                        background: copiedField === 'code' ? '#2ecc71' : 'rgba(0, 242, 254, 0.2)',
                        border: '1px solid rgba(0, 242, 254, 0.4)',
                        color: copiedField === 'code' ? '#000' : '#00f2fe',
                        padding: '5px 10px', borderRadius: '8px',
                        fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      {copiedField === 'code' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedField === 'code' ? t('market_modal_copied', 'Kopyalandı!') : t('market_modal_copy', 'Kopyala')}</span>
                    </button>
                  </div>
                </div>
              )}

              {paymentMethod === 'crypto' && (
                /* 🪙 KRİPTO (USDT - TRC20) DETAYI */
                <div style={{
                  background: 'rgba(0, 0, 0, 0.45)', border: '1.5px solid rgba(0, 230, 118, 0.35)',
                  borderRadius: '16px', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px'
                }}>
                  {/* Ödenecek USDT Tutarı & Ağ Rozeti */}
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.15), rgba(0, 200, 83, 0.1))',
                    border: '1px solid rgba(0, 230, 118, 0.3)',
                    borderRadius: '12px', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.66rem', color: '#00e676', fontWeight: '700', textTransform: 'uppercase' }}>
                        {t('market_crypto_amount_label', 'CRYPTO AMOUNT TO PAY')}
                      </div>
                      <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: '900' }}>
                        {getUsdtPrice(selectedPackage)} USDT
                      </div>
                    </div>
                    <div style={{
                      background: 'rgba(0, 230, 118, 0.2)', border: '1px solid #00e676',
                      padding: '3px 8px', borderRadius: '8px', fontSize: '0.70rem', fontWeight: '800', color: '#00e676'
                    }}>
                      {t('market_crypto_network_label', 'Network: TRON (TRC-20)')}
                    </div>
                  </div>

                  {/* QR Kodu & Cüzdan Adresi */}
                  <div style={{
                    display: 'flex', gap: '10px', alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.03)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <div style={{
                      background: '#fff', padding: '4px', borderRadius: '8px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${CRYPTO_WALLET}`}
                        alt="USDT TRC20 QR Code"
                        style={{ width: '75px', height: '75px', display: 'block' }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.66rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '2px' }}>
                        {t('market_crypto_address_label', 'Binance Global USDT (TRC-20) Deposit Address:')}
                      </div>
                      <div style={{
                        color: '#00e676', fontWeight: '800', fontFamily: 'monospace',
                        fontSize: '0.70rem', wordBreak: 'break-all', lineHeight: '1.3', marginBottom: '6px'
                      }}>
                        {CRYPTO_WALLET}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(CRYPTO_WALLET, 'crypto_wallet')}
                        style={{
                          background: copiedField === 'crypto_wallet' ? '#00e676' : 'rgba(0, 230, 118, 0.18)',
                          border: '1px solid #00e676', color: copiedField === 'crypto_wallet' ? '#000' : '#00e676',
                          padding: '3px 8px', borderRadius: '6px',
                          fontSize: '0.68rem', fontWeight: '800', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        {copiedField === 'crypto_wallet' ? <Check size={11} /> : <Copy size={11} />}
                        <span>{copiedField === 'crypto_wallet' ? t('market_modal_copied', 'Copied!') : t('market_crypto_copy_btn', 'Copy Address')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Zorunlu Takip Kodu */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255, 255, 255, 0.04)', padding: '6px 10px', borderRadius: '10px', fontSize: '0.72rem'
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>{t('market_crypto_order_code_label', 'Your Order Tracking Code:')}</span>
                    <span style={{ color: '#ffd700', fontWeight: '800', letterSpacing: '1px' }}>{orderCode}</span>
                  </div>

                  {/* TXID Giriş Kutusu */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.70rem', color: '#fff', fontWeight: '800' }}>
                        {t('market_crypto_txid_title', 'İşlem Kodu (TXID) veya Cüzdan')} <span style={{ color: '#ff416c' }}>*</span>
                      </span>
                      <span style={{ fontSize: '0.64rem', color: '#ff416c', fontWeight: '700' }}>Zorunlu Alan</span>
                    </div>
                    <input
                      type="text"
                      placeholder={t('market_crypto_txid_placeholder', 'Transfer İşlem Kodu (TXID) veya Gönderici Cüzdan...')}
                      value={cryptoTxId}
                      onChange={(e) => {
                        setCryptoTxId(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.06)', 
                        border: validationError && (!cryptoTxId.trim() || cryptoTxId.trim().length < 8) ? '1.5px solid #ff416c' : '1px solid rgba(0, 230, 118, 0.4)',
                        color: '#fff', fontSize: '0.78rem', outline: 'none'
                      }}
                    />
                    <div style={{ fontSize: '0.64rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px' }}>
                      {t('market_crypto_hint', '💡 Transfer from Binance, Bybit, Trust Wallet etc. and notify.')}
                    </div>
                  </div>
                </div>
              )}

              {paymentMethod === 'havale_papara' && (
                /* 📱 HAVALE / FAST & PAPARA BİLGİ KARTI */
                <div style={{
                  background: 'rgba(0, 0, 0, 0.4)', border: '1px solid rgba(0, 242, 254, 0.3)',
                  borderRadius: '16px', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px'
                }}>
                  {/* Önemli Uyarı Kodu */}
                  <div style={{
                    background: 'rgba(255, 8, 68, 0.15)', border: '1px solid #ff0844',
                    borderRadius: '12px', padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{ fontSize: '0.65rem', color: '#ff8899', fontWeight: '700', textTransform: 'uppercase' }}>
                        {t('market_modal_code_label', 'Açıklamaya Yazılacak Kod')}
                      </div>
                      <div style={{ fontSize: '1rem', color: '#fff', fontWeight: '900', letterSpacing: '1px' }}>
                        {orderCode}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyText(orderCode, 'code')}
                      style={{
                        background: copiedField === 'code' ? '#2ecc71' : 'rgba(255,255,255,0.15)',
                        border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '8px',
                        fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      {copiedField === 'code' ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedField === 'code' ? t('market_modal_copied', 'Kopyalandı!') : t('market_modal_copy', 'Kopyala')}</span>
                    </button>
                  </div>

                  {/* 1. Alıcı Adı Soyadı Satırı (Ayrı Kopyalama Butonlu) */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(255, 255, 255, 0.04)', padding: '10px 12px', borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.08)'
                  }}>
                    <div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.66rem', fontWeight: '700', textTransform: 'uppercase' }}>
                        {t('market_modal_receiver_name', 'Alıcı Adı Soyadı')}
                      </div>
                      <div style={{ color: '#fff', fontWeight: '800', fontSize: '0.88rem', marginTop: '2px' }}>
                        Ömer Faruk Şahin
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyText('Ömer Faruk Şahin', 'receiver_name')}
                      style={{
                        background: copiedField === 'receiver_name' ? '#2ecc71' : 'rgba(255, 255, 255, 0.12)',
                        border: 'none', color: copiedField === 'receiver_name' ? '#000' : '#fff',
                        padding: '6px 12px', borderRadius: '8px',
                        fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      {copiedField === 'receiver_name' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedField === 'receiver_name' ? t('market_modal_copied', 'Kopyalandı!') : t('market_modal_copy_name', 'İsmi Kopyala')}</span>
                    </button>
                  </div>

                  {/* 2. IBAN Bilgisi (VakıfBank - 7/24 FAST) */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(0, 242, 254, 0.05)', padding: '10px 12px', borderRadius: '12px',
                    border: '1px solid rgba(0, 242, 254, 0.25)'
                  }}>
                    <div>
                      <div style={{ color: '#00f2fe', fontSize: '0.66rem', fontWeight: '800' }}>
                        VAKIFBANK IBAN (7/24 FAST)
                      </div>
                      <div style={{ color: '#00f2fe', fontWeight: '900', fontFamily: 'monospace', fontSize: '0.86rem', marginTop: '2px', letterSpacing: '0.5px' }}>
                        TR14 0001 5001 5800 7309 8205 56
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyText('TR140001500158007309820556', 'iban')}
                      style={{
                        background: copiedField === 'iban' ? '#2ecc71' : 'rgba(0, 242, 254, 0.2)',
                        border: '1px solid rgba(0, 242, 254, 0.4)', color: copiedField === 'iban' ? '#000' : '#00f2fe',
                        padding: '6px 12px', borderRadius: '8px',
                        fontSize: '0.72rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      {copiedField === 'iban' ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedField === 'iban' ? t('market_modal_copied', 'Kopyalandı!') : t('market_modal_copy_iban', 'IBAN Kopyala')}</span>
                    </button>
                  </div>

                  {/* Gönderen Adı Soyadı Inputu */}
                  <div style={{ marginTop: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.70rem', color: '#fff', fontWeight: '800' }}>
                        {t('market_modal_sender_title', 'Banka Dekontundaki Gönderen Adı Soyadı')} <span style={{ color: '#ff416c' }}>*</span>
                      </span>
                      <span style={{ fontSize: '0.64rem', color: '#ff416c', fontWeight: '700' }}>Zorunlu Alan</span>
                    </div>
                    <input
                      type="text"
                      placeholder={t('market_modal_sender_placeholder', 'Banka hesabınızdaki adınız ve soyadınız...')}
                      value={senderName}
                      onChange={(e) => {
                        setSenderName(e.target.value);
                        if (validationError) setValidationError(null);
                      }}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '10px',
                        background: 'rgba(255,255,255,0.06)', 
                        border: validationError && (!senderName.trim() || senderName.trim().length < 3) ? '1.5px solid #ff416c' : '1px solid rgba(0, 242, 254, 0.4)',
                        color: '#fff', fontSize: '0.78rem', outline: 'none'
                      }}
                    />
                    <div style={{
                      marginTop: '6px', fontSize: '0.66rem', color: '#ffb74d',
                      background: 'rgba(255, 183, 77, 0.08)', padding: '6px 8px', borderRadius: '8px',
                      border: '1px solid rgba(255, 183, 77, 0.2)', lineHeight: '1.4'
                    }}>
                      💡 <b>7/24 Anında Yükleme:</b> Gece saatlerinde beklemeden hemen konuşmak için <b>Kredi Kartı</b> veya <b>Kripto (USDT)</b> tercih edebilirsiniz. Havale/EFT işlemleri mesai saatlerinde onaylanır.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {cardSubmitted ? (
              <div style={{
                background: 'rgba(255, 215, 0, 0.12)', border: '1.5px solid #ffd700',
                borderRadius: '18px', padding: '16px', textAlign: 'center', animation: 'fadeIn 0.2s ease'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '6px' }}>⚡</div>
                <h4 style={{ color: '#ffd700', margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: '800' }}>
                  {isTr ? '3D Secure Ödeme Penceresi Açıldı!' : '3D Secure Checkout Window Opened!'}
                </h4>
                <p style={{ color: 'rgba(255,255,255,0.88)', margin: '0 0 14px 0', fontSize: '0.78rem', lineHeight: '1.45' }}>
                  {isTr 
                    ? `Açılan pop-up penceresinde güvenle kartınızı onaylayabilirsiniz. Siteniz bu esnada arka planda açık kalmaya devam eder.` 
                    : `Complete your card payment in the secure pop-up window. Your Pyngoo page remains open in the background.`}
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={openShopierPopup}
                    style={{
                      background: 'rgba(255, 215, 0, 0.2)', border: '1px solid #ffd700',
                      color: '#ffd700', padding: '8px 14px', borderRadius: '12px',
                      fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer'
                    }}
                  >
                    {isTr ? '🔄 Pencereyi Tekrar Aç' : '🔄 Re-open Window'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCardSubmitted(false);
                      setSelectedPackage(null);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #00f2fe, #4facfe)', border: 'none',
                      color: '#000', padding: '8px 16px', borderRadius: '12px',
                      fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer'
                    }}
                  >
                    {isTr ? '✓ Tamam' : '✓ Done'}
                  </button>
                </div>
              </div>
            ) : transferSubmitted ? (
              <div style={{
                background: 'rgba(46, 204, 113, 0.2)', border: '1px solid #2ecc71',
                borderRadius: '16px', padding: '14px', textAlign: 'center', animation: 'fadeIn 0.2s ease'
              }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '4px' }}>🎉</div>
                <h4 style={{ color: '#2ecc71', margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: '800' }}>
                  {t('market_modal_transfer_success_title', 'Havale Bildiriminiz Alındı!')}
                </h4>
                <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0, fontSize: '0.74rem', lineHeight: '1.4' }}>
                  {t('market_modal_transfer_success_desc', { code: orderCode })}
                </p>
              </div>
            ) : cryptoSubmitted ? (
              <div style={{
                background: cryptoResult?.isAutoCredited ? 'rgba(0, 230, 118, 0.22)' : 'rgba(0, 230, 118, 0.16)',
                border: '1.5px solid #00e676',
                borderRadius: '16px', padding: '16px', textAlign: 'center', animation: 'fadeIn 0.2s ease'
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>{cryptoResult?.isAutoCredited ? '🎉' : '🪙'}</div>
                <h4 style={{ color: '#00e676', margin: '0 0 4px 0', fontSize: '1rem', fontWeight: '800' }}>
                  {cryptoResult?.isAutoCredited ? t('market_crypto_success_title', 'Altınlarınız 7/24 Anında Yüklendi!') : t('market_crypto_pending_title', 'Kripto Bildiriminiz Alındı!')}
                </h4>
                <p style={{ color: 'rgba(255,255,255,0.9)', margin: 0, fontSize: '0.78rem', lineHeight: '1.4' }}>
                  {cryptoResult?.message || `${orderCode} - ${getUsdtPrice(selectedPackage)} USDT`}
                </p>
              </div>
            ) : (
              <div>
                {/* Doğrulama Hatası Uyarısı */}
                {validationError && (
                  <div style={{
                    background: 'rgba(255, 65, 108, 0.22)',
                    border: '1.5px solid #ff416c',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    color: '#fff',
                    fontSize: '0.78rem',
                    fontWeight: '800',
                    textAlign: 'center',
                    marginBottom: '12px',
                    boxShadow: '0 4px 15px rgba(255, 65, 108, 0.3)'
                  }}>
                    {validationError}
                  </div>
                )}

                {/* Ödemeyi Tamamla Butonu */}
                <button
                  onClick={
                    paymentMethod === 'card' 
                      ? handleCardSubmit 
                      : (paymentMethod === 'crypto' ? handleCryptoSubmit : handleTransferSubmit)
                  }
                  disabled={isProcessing || (paymentMethod !== 'card' && cooldownSeconds > 0)}
                  style={{
                    width: '100%',
                    background: (paymentMethod !== 'card' && cooldownSeconds > 0)
                      ? 'rgba(255,255,255,0.12)'
                      : (paymentMethod === 'card'
                          ? 'linear-gradient(135deg, #ffd700 0%, #ff9800 100%)'
                          : (paymentMethod === 'crypto'
                              ? 'linear-gradient(135deg, #00e676 0%, #00c853 100%)'
                              : 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)')),
                    border: (paymentMethod !== 'card' && cooldownSeconds > 0) ? '1px solid rgba(255,255,255,0.2)' : 'none',
                    color: (paymentMethod !== 'card' && cooldownSeconds > 0) ? '#aaa' : '#000',
                    padding: '14px', borderRadius: '16px',
                    fontWeight: '900', fontSize: '0.95rem',
                    cursor: (isProcessing || (paymentMethod !== 'card' && cooldownSeconds > 0)) ? 'not-allowed' : 'pointer',
                    boxShadow: (paymentMethod !== 'card' && cooldownSeconds > 0) 
                      ? 'none' 
                      : (paymentMethod === 'card' 
                          ? '0 6px 20px rgba(255, 215, 0, 0.4)' 
                          : (paymentMethod === 'crypto' ? '0 6px 20px rgba(0, 230, 118, 0.4)' : '0 6px 20px rgba(0, 242, 254, 0.35)')),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {isProcessing ? (
                    <>
                      <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
                      <span>{t('market_modal_processing')}</span>
                    </>
                  ) : paymentMethod !== 'card' && cooldownSeconds > 0 ? (
                    <>
                      <span>⏳</span>
                      <span>Lütfen Bekleyin ({cooldownSeconds}s)</span>
                    </>
                  ) : (
                    <>
                      {paymentMethod === 'card' && <CreditCard size={18} color="#000" />}
                      {paymentMethod === 'crypto' && <Check size={18} color="#000" />}
                      {paymentMethod === 'havale_papara' && <Check size={18} color="#000" />}
                      <span>
                        {paymentMethod === 'card' 
                          ? (isTr ? `Shopier ile Güvenli Öde (${selectedPackage.priceTr})` : `Pay with Shopier (${selectedPackage.priceEn})`)
                          : (paymentMethod === 'crypto' 
                              ? t('market_crypto_submit_btn', { amount: getUsdtPrice(selectedPackage) }) 
                              : t('market_modal_notify_btn'))}
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}

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
        </div>
      )}

      {/* 8. BAŞARILI SATIN ALMA TEBRİK OVERLAY'İ (KUTLAMA / CONFETTI) */}
      {purchaseSuccess && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 3000, animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #1c1d3b, #121324)',
            border: '2px solid #ffd700', borderRadius: '28px',
            padding: '36px 24px', textAlign: 'center', maxWidth: '380px', width: '90%',
            boxShadow: '0 0 50px rgba(255, 215, 0, 0.6)',
            animation: 'giftPop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            <div style={{ fontSize: '4.5rem', marginBottom: '10px', animation: 'pulse 1s infinite' }}>
              🪙✨
            </div>

            <h2 style={{ fontSize: '1.6rem', fontWeight: '900', color: '#ffd700', margin: '0 0 6px 0' }}>
              {t('market_success_title')}
            </h2>

            <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: '800', margin: '0 0 12px 0' }}>
              {t('market_success_amount', { amount: purchaseSuccess.gold + purchaseSuccess.bonus })}
            </p>

            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', margin: '0 0 20px 0', lineHeight: '1.4' }}>
              {t('market_success_desc')}
            </p>

            <button
              onClick={() => setPurchaseSuccess(null)}
              style={{
                background: 'linear-gradient(135deg, #ffd700, #ff8800)',
                border: 'none', color: '#000', padding: '12px 32px', borderRadius: '20px',
                fontWeight: '900', fontSize: '0.95rem', cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)'
              }}
            >
              {t('market_success_continue_btn')}
            </button>
          </div>
        </div>
      )}

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
                  REKLAM
                </span>
                <span style={{ fontSize: '0.82rem', color: '#fff', fontWeight: '700' }}>
                  Ödüllü Sponsor Yayını
                </span>
                <button
                  type="button"
                  onClick={() => setIsAdMuted(!isAdMuted)}
                  style={{
                    background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff',
                    borderRadius: '8px', padding: '4px 8px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', marginLeft: '4px'
                  }}
                  title={isAdMuted ? 'Sesi Aç' : 'Sesi Kapat'}
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
                  <X size={15} /> Kapat
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
