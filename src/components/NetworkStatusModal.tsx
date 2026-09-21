import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { WifiOff, RefreshCw } from 'lucide-react';

export const NetworkStatusModal: React.FC = () => {
  const { t } = useTranslation();
  const [isOffline, setIsOffline] = useState<boolean>(() => !navigator.onLine);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const checkRealConnection = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) return false;
    try {
      // Hafif bir cache-busting isteği ile gerçek bağlantı teyidi
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      await fetch(`https://rdqcwzosmikusketghyq.supabase.co/rest/v1/?_ping=${Date.now()}`, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);
      return true;
    } catch (_) {
      // Eğer fetch zaman aşımına uğradıysa veya ağ koptuysa
      return navigator.onLine;
    }
  }, []);

  const handleOnline = useCallback(async () => {
    const alive = await checkRealConnection();
    if (alive) {
      setIsOffline(false);
    }
  }, [checkRealConnection]);

  const handleOffline = useCallback(() => {
    setIsOffline(true);
  }, []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!navigator.onLine) {
          setIsOffline(true);
        } else {
          checkRealConnection().then(alive => {
            if (alive) setIsOffline(false);
          });
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleOnline, handleOffline, checkRealConnection]);

  const handleManualRetry = async () => {
    if (isChecking) return;
    setIsChecking(true);
    try {
      const alive = await checkRealConnection();
      if (alive) {
        setIsOffline(false);
      }
    } finally {
      setTimeout(() => {
        setIsChecking(false);
      }, 500);
    }
  };

  if (!isOffline) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        background: 'rgba(7, 8, 20, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        animation: 'fadeIn 0.25s ease-out'
      }}
    >
      <div 
        style={{
          width: '100%',
          maxWidth: '380px',
          background: 'linear-gradient(165deg, rgba(26, 28, 56, 0.95), rgba(15, 16, 36, 0.98))',
          borderRadius: '28px',
          padding: '32px 24px',
          textAlign: 'center',
          border: '1px solid rgba(0, 242, 254, 0.3)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.7), 0 0 40px rgba(0, 242, 254, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Sevimli Parlayan İkon */}
        <div 
          style={{
            position: 'relative',
            width: '84px',
            height: '84px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(255, 107, 107, 0.2), rgba(255, 75, 114, 0.1))',
            border: '2px solid rgba(255, 107, 107, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 25px rgba(255, 107, 107, 0.35)'
          }}
        >
          <WifiOff size={40} color="#ff6b6b" strokeWidth={2.2} />
          
          {/* Uydu minik sinyal efekti */}
          <span 
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              fontSize: '1.3rem',
              animation: 'bounce 2s infinite'
            }}
          >
            📡
          </span>
        </div>

        {/* Başlık */}
        <h2 
          style={{
            color: '#ffffff',
            fontSize: '1.3rem',
            fontWeight: '900',
            margin: '4px 0 0 0',
            letterSpacing: '-0.3px',
            lineHeight: '1.3'
          }}
        >
          {t('offline_modal_title')}
        </h2>

        {/* Tatlı ve Yatıştırıcı Açıklama */}
        <p 
          style={{
            color: 'rgba(255, 255, 255, 0.75)',
            fontSize: '0.90rem',
            lineHeight: '1.55',
            margin: '0',
            fontWeight: '500'
          }}
        >
          {t('offline_modal_desc')}
        </p>

        {/* Tekrar Dene Butonu */}
        <button
          type="button"
          onClick={handleManualRetry}
          disabled={isChecking}
          style={{
            marginTop: '8px',
            width: '100%',
            padding: '14px 20px',
            borderRadius: '16px',
            border: 'none',
            background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
            color: '#050510',
            fontSize: '0.95rem',
            fontWeight: '800',
            cursor: isChecking ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            boxShadow: '0 8px 24px rgba(0, 242, 254, 0.35)',
            transition: 'transform 0.15s ease, opacity 0.15s ease',
            opacity: isChecking ? 0.7 : 1
          }}
          onMouseDown={(e) => { if (!isChecking) e.currentTarget.style.transform = 'scale(0.98)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          <RefreshCw 
            size={18} 
            color="#050510" 
            style={{
              animation: isChecking ? 'spin 1s linear infinite' : 'none'
            }}
          />
          <span>{isChecking ? t('offline_modal_checking') : t('offline_modal_retry')}</span>
        </button>
      </div>

      <style>{`
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
};
