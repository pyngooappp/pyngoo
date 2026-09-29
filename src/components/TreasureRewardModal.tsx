import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

export function TreasureRewardModal({ amount, onClose }: { amount: number; onClose: () => void }) {
  const { t } = useTranslation();
  const [showBanner, setShowBanner] = useState(false);
  const [closing, setClosing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Yumuşak kapanış: önce fade-out, sonra onClose
  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(() => closeRef.current(), 300);
  };
  const closeFn = useRef(close);
  closeFn.current = close;

  useEffect(() => {
    // Video yüklenemez/oynatılamazsa modal ekranda takılı kalmasın
    const id = setTimeout(() => closeFn.current(), 8000);
    const v = videoRef.current;
    // Sesli autoplay tarayıcıca engellenirse sessiz oynat
    v?.play().catch(() => { if (v) { v.muted = true; v.play().catch(() => {}); } });
    return () => clearTimeout(id);
  }, []);

  return createPortal(
    <div
      onClick={close}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999, cursor: 'pointer',
        background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        opacity: closing ? 0 : 1, transition: 'opacity 0.3s ease'
      }}
    >
      <div style={{ width: '90%', maxWidth: 380, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          textAlign: 'center', marginBottom: 8, pointerEvents: 'none',
          opacity: showBanner ? 1 : 0,
          transform: showBanner ? 'translateY(0) scale(1)' : 'translateY(-20px) scale(0.85)',
          transition: 'opacity 0.5s cubic-bezier(0.34,1.56,0.64,1), transform 0.5s cubic-bezier(0.34,1.56,0.64,1)'
        }}>
          <div style={{
            fontSize: '2.3rem', fontWeight: 900, letterSpacing: '-0.5px',
            background: 'linear-gradient(180deg,#fff7c2 0%,#ffd700 45%,#b8860b 55%,#ffe066 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 0 #7a4a00) drop-shadow(0 4px 8px rgba(255,215,0,0.6))'
          }}>
            +{amount.toLocaleString()} {t('gold_currency_label', 'Altın')}
          </div>
          <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginTop: 2, letterSpacing: '0.2px', textShadow: '0 2px 4px rgba(0,0,0,0.6)' }}>
            {t('gold_reward_subtitle', 'Hesabınıza Başarıyla Eklendi ✨')}
          </div>
        </div>

        <div style={{
          width: '100%', aspectRatio: '16 / 9', borderRadius: 26, overflow: 'hidden', background: '#000',
          border: '1.5px solid rgba(255,215,0,0.45)',
          boxShadow: '0 0 45px rgba(255,200,0,0.35), 0 16px 36px rgba(0,0,0,0.8)'
        }}>
          <video
            ref={videoRef}
            src="/videos/chest_reward.mp4"
            playsInline
            autoPlay
            preload="auto"
            onTimeUpdate={e => { if (e.currentTarget.currentTime >= 1.2) setShowBanner(true); }}
            onEnded={close}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
