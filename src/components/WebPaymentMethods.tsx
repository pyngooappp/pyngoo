import { useState, useEffect } from 'react';
import { ShieldCheck, Copy, Check, Smartphone, CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../lib/supabase';
import { sendTelegramAlert } from '../utils/telegramAlert';
import { soundManager } from '../utils/SoundManager';
import { processCryptoPayment } from '../utils/cryptoVerifyService';

interface WebPaymentMethodsProps {
  selectedPackage: any;
  userId: string | null;
  profile: any;
  orderCode: string;
  isTr: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SHOPIER_PRODUCT_URLS: Record<string, string> = {
  pack_650: 'https://www.shopier.com/pyngoo/50771182',
  pack_1400: 'https://www.shopier.com/pyngoo/50771257',
  pack_3800: 'https://www.shopier.com/pyngoo/50771291',
  pack_8500: 'https://www.shopier.com/pyngoo/50771329',
  pack_18000: 'https://www.shopier.com/pyngoo/50771375',
  pack_40000: 'https://www.shopier.com/pyngoo/50771402',
  pack_85000: 'https://www.shopier.com/pyngoo/50771423',
};

const CRYPTO_WALLET = 'TDwYUwBrV6mSmJvmcP93VSTnBtWrXnpFsu';

export default function WebPaymentMethods({
  selectedPackage,
  userId,
  profile,
  orderCode,
  isTr,
  onClose,
  onSuccess: _onSuccess
}: WebPaymentMethodsProps) {
  const { t } = useTranslation();
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'crypto' | 'havale_papara'>(() => isTr ? 'havale_papara' : 'crypto');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [senderName, setSenderName] = useState('');
  const [cryptoTxId, setCryptoTxId] = useState('');
  const [transferSubmitted, setTransferSubmitted] = useState(false);
  const [cryptoSubmitted, setCryptoSubmitted] = useState(false);
  const [cryptoResult, setCryptoResult] = useState<{ isAutoCredited: boolean; message: string; goldAdded?: number } | null>(null);
  const [cardSubmitted, setCardSubmitted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (!userId) return;
    try {
      const expire = localStorage.getItem(`pyngoo_payment_cooldown_${userId}`);
      if (expire) {
        const diff = Math.ceil((parseInt(expire, 10) - Date.now()) / 1000);
        if (diff > 0) setCooldownSeconds(diff);
      }
    } catch (_) {}
  }, [userId]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  const startCooldown = (sec: number = 30) => {
    setCooldownSeconds(sec);
    try {
      localStorage.setItem(`pyngoo_payment_cooldown_${userId}`, (Date.now() + sec * 1000).toString());
    } catch (_) {}
  };

  const handleCopyText = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
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
───────────────────────
👤 <b>Kullanıcı:</b> ${profile?.display_name || 'Kullanıcı'} (<code>${(userId || '').slice(0, 8)}</code>)
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

    try {
      await supabase.from('payment_notifications').insert([{
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
    } catch (_) {}

    try {
      const msg = `
🏦 <b>YENİ VAKIFBANK HAVALE / FAST BİLDİRİMİ!</b>
───────────────────────
👤 <b>Kullanıcı:</b> ${profile?.display_name || 'Kullanıcı'} (<code>${(userId || '').slice(0, 8)}</code>)
🪙 <b>Paket:</b> ${selectedPackage.gold} Altın (+${selectedPackage.bonus} Hediye) = <b>${totalGold} Altın</b>
💵 <b>Tutar:</b> ${isTr ? selectedPackage.priceTr : selectedPackage.priceEn}
🏷️ <b>Zorunlu Kod:</b> <code>${orderCode}</code>
✍️ <b>Gönderen Ad Soyad:</b> <b>${senderName.trim()}</b>
📅 <b>Tarih:</b> ${new Date().toLocaleDateString('tr-TR')} • ${new Date().toLocaleTimeString('tr-TR')}
      `.trim();
      await sendTelegramAlert(msg);
    } catch (_) {}

    setIsProcessing(false);
    setTransferSubmitted(true);

    setTimeout(() => {
      setTransferSubmitted(false);
      onClose();
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
    const usdtAmt = selectedPackage.priceUsdt || '1.00';

    try {
      await supabase.from('payment_notifications').insert([{
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
    } catch (_) {}

    const result = await processCryptoPayment(
      userId || '',
      profile?.display_name || 'Kullanıcı',
      cryptoTxId.trim(),
      selectedPackage,
      usdtAmt,
      orderCode
    );

    setIsProcessing(false);
    setCryptoResult(result);
    setCryptoSubmitted(true);

    setTimeout(() => {
      setCryptoSubmitted(false);
      setCryptoResult(null);
      onClose();
    }, 4000);
  };

  return (
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
        {/* 1. SEÇENEK: KART (SHOPIER) */}
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
          <span style={{ fontSize: '0.58rem', color: '#2ecc71', fontWeight: '800' }}>{t('market_card_3ds_short')}</span>
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

        {/* 3. SEÇENEK: HAVALE / FAST (TR) */}
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

      {paymentMethod === 'card' && (
        <div style={{
          background: 'rgba(255, 215, 0, 0.06)', border: '1.5px solid rgba(255, 215, 0, 0.35)',
          borderRadius: '16px', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={18} color="#ffd700" />
              <span style={{ color: '#fff', fontSize: '0.86rem', fontWeight: '800' }}>
                {t('market_card_checkout_title')}
              </span>
            </div>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(0, 242, 254, 0.08)', border: '1px dashed #00f2fe',
            borderRadius: '12px', padding: '9px 12px'
          }}>
            <div>
              <div style={{ fontSize: '0.62rem', color: '#00f2fe', fontWeight: '700', textTransform: 'uppercase' }}>
                {t('market_order_tracking_code')}
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
        <div style={{
          background: 'rgba(0, 0, 0, 0.45)', border: '1.5px solid rgba(0, 230, 118, 0.35)',
          borderRadius: '16px', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px'
        }}>
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
                {selectedPackage.priceUsdt || '1.00'} USDT
              </div>
            </div>
            <div style={{
              background: 'rgba(0, 230, 118, 0.2)', border: '1px solid #00e676',
              padding: '3px 8px', borderRadius: '8px', fontSize: '0.70rem', fontWeight: '800', color: '#00e676'
            }}>
              Network: TRON (TRC-20)
            </div>
          </div>

          <div style={{
            color: '#00e676', fontWeight: '800', fontFamily: 'monospace',
            fontSize: '0.70rem', wordBreak: 'break-all', lineHeight: '1.3'
          }}>
            {CRYPTO_WALLET}
          </div>

          <input
            type="text"
            placeholder={t('market_crypto_txid_ph', 'İşlem Kodu (TXID) veya Cüzdanınız')}
            value={cryptoTxId}
            onChange={(e) => setCryptoTxId(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(0, 230, 118, 0.3)',
              color: '#fff', fontSize: '0.78rem', boxSizing: 'border-box'
            }}
          />
        </div>
      )}

      {paymentMethod === 'havale_papara' && (
        <div style={{
          background: 'rgba(0, 242, 254, 0.05)', border: '1.5px solid rgba(0, 242, 254, 0.35)',
          borderRadius: '16px', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '10px'
        }}>
          <input
            type="text"
            placeholder={t('market_transfer_sender_ph', 'Gönderen Adı Soyadı (Zorunlu)')}
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(0, 242, 254, 0.3)',
              color: '#fff', fontSize: '0.78rem', boxSizing: 'border-box'
            }}
          />
        </div>
      )}

      {validationError && (
        <div style={{ color: '#ff4d4f', fontSize: '0.76rem', marginBottom: '10px', textAlign: 'center', fontWeight: '700' }}>
          {validationError}
        </div>
      )}

      {cardSubmitted ? (
        <div style={{
          background: 'rgba(255, 215, 0, 0.12)', border: '1.5px solid #ffd700',
          borderRadius: '18px', padding: '16px', textAlign: 'center'
        }}>
          <h4 style={{ color: '#ffd700', margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: '800' }}>
            {t('market_3ds_opened_title')}
          </h4>
          <p style={{ color: 'rgba(255,255,255,0.88)', margin: '0 0 14px 0', fontSize: '0.78rem', lineHeight: '1.45' }}>
            {t('market_3ds_opened_desc')}
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
              {t('market_reopen_window')}
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'linear-gradient(135deg, #00f2fe, #4facfe)', border: 'none',
                color: '#000', padding: '8px 16px', borderRadius: '12px',
                fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer'
              }}
            >
              {t('market_done_btn')}
            </button>
          </div>
        </div>
      ) : transferSubmitted ? (
        <div style={{
          background: 'rgba(46, 204, 113, 0.2)', border: '1px solid #2ecc71',
          borderRadius: '16px', padding: '14px', textAlign: 'center'
        }}>
          <h4 style={{ color: '#2ecc71', margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: '800' }}>
            {t('market_modal_transfer_success_title', 'Havale Bildiriminiz Alındı!')}
          </h4>
        </div>
      ) : cryptoSubmitted ? (
        <div style={{
          background: 'rgba(0, 230, 118, 0.2)', border: '1px solid #00e676',
          borderRadius: '16px', padding: '14px', textAlign: 'center'
        }}>
          <h4 style={{ color: '#00e676', margin: '0 0 4px 0', fontSize: '0.95rem', fontWeight: '800' }}>
            {cryptoResult?.isAutoCredited ? t('market_crypto_auto_credited_title') : t('market_modal_crypto_success_title')}
          </h4>
        </div>
      ) : (
        <button
          type="button"
          onClick={
            paymentMethod === 'card' 
              ? handleCardSubmit 
              : (paymentMethod === 'crypto' ? handleCryptoSubmit : handleTransferSubmit)
          }
          disabled={isProcessing || (paymentMethod !== 'card' && cooldownSeconds > 0)}
          style={{
            width: '100%', padding: '14px', borderRadius: '16px', border: 'none',
            background: paymentMethod === 'card' ? 'linear-gradient(135deg, #ffd700, #ffaa00)' : (paymentMethod === 'crypto' ? 'linear-gradient(135deg, #00e676, #00c853)' : 'linear-gradient(135deg, #00f2fe, #4facfe)'),
            color: '#000', fontWeight: '800', fontSize: '0.94rem', cursor: 'pointer'
          }}
        >
          {isProcessing ? t('market_processing_payment') : (paymentMethod === 'card' ? t('market_card_pay_button') : t('market_submit_notification'))}
        </button>
      )}
    </div>
  );
}
