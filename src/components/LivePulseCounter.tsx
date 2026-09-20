import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface LivePulseCounterProps {
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Sıfır DB / API maliyetiyle çalışan organik canlı kullanıcı sayacı.
 * Günün saatine göre (akşam zirve, sabah sakin) doğal bir taban hesaplar,
 * her 8-15 saniyede bir ufak dalgalanmalar (+/-) yaparak tamamen canlı hissi verir.
 */
export const LivePulseCounter: React.FC<LivePulseCounterProps> = ({ style, className }) => {
  const { t } = useTranslation();

  const calculateBaseCount = (): number => {
    const hour = new Date().getHours();
    // 20:00 - 02:00: Zirve (1,900 - 2,750)
    // 02:00 - 06:00: Gece (1,100 - 1,500)
    // 06:00 - 12:00: Sabah (850 - 1,250)
    // 12:00 - 20:00: Gündüz / Akşamüstü (1,450 - 2,100)
    if (hour >= 20 || hour < 2) {
      return 2150 + (Math.sin(hour) * 300);
    } else if (hour >= 2 && hour < 6) {
      return 1200 + (Math.cos(hour) * 200);
    } else if (hour >= 6 && hour < 12) {
      return 950 + (Math.sin(hour) * 150);
    } else {
      return 1650 + (Math.cos(hour) * 250);
    }
  };

  const [count, setCount] = useState<number>(() => {
    const saved = sessionStorage.getItem('pyngoo_live_counter_val');
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num > 500) return num;
    }
    return Math.floor(calculateBaseCount() + (Math.random() * 40 - 20));
  });

  useEffect(() => {
    sessionStorage.setItem('pyngoo_live_counter_val', count.toString());

    // 8 - 14 saniyede bir rastgele ufak dalgalanma (+4, -3, +6 vb.)
    const intervalTime = 8000 + Math.floor(Math.random() * 6000);
    const timer = setInterval(() => {
      setCount((prev) => {
        const base = calculateBaseCount();
        const delta = Math.floor(Math.random() * 9) - 4; // -4 ile +4 arası
        let next = prev + delta;
        // Aşırı sapmayı engelle
        if (next < base - 150) next = Math.floor(base - 100);
        if (next > base + 250) next = Math.floor(base + 200);
        sessionStorage.setItem('pyngoo_live_counter_val', next.toString());
        return next;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '9px',
        background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.14), rgba(0, 230, 118, 0.1))',
        border: '1.5px solid #00f2fe',
        borderRadius: '30px',
        padding: '7px 18px',
        fontSize: '0.92rem',
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: '0.4px',
        backdropFilter: 'blur(12px)',
        userSelect: 'none',
        animation: 'pyngooNeonBorderPulse 2s ease-in-out infinite',
        cursor: 'default',
        ...style,
      }}
      title="Canlı Eşleşme Odaları & Aktif Çevrim İçi Kullanıcılar"
    >
      <style>{`
        @keyframes pyngooNeonBorderPulse {
          0% {
            border-color: rgba(0, 242, 254, 0.5);
            box-shadow: 0 0 10px rgba(0, 242, 254, 0.3), inset 0 0 8px rgba(0, 242, 254, 0.15);
            transform: scale(1);
          }
          50% {
            border-color: #00f2fe;
            box-shadow: 0 0 24px rgba(0, 242, 254, 0.85), 0 0 36px rgba(0, 230, 118, 0.45), inset 0 0 14px rgba(0, 242, 254, 0.4);
            transform: scale(1.02);
          }
          100% {
            border-color: rgba(0, 242, 254, 0.5);
            box-shadow: 0 0 10px rgba(0, 242, 254, 0.3), inset 0 0 8px rgba(0, 242, 254, 0.15);
            transform: scale(1);
          }
        }
        @keyframes pyngooLiveDotGlow {
          0% {
            transform: scale(0.9);
            box-shadow: 0 0 8px #00e676, 0 0 16px rgba(0, 230, 118, 0.6);
            opacity: 0.85;
          }
          50% {
            transform: scale(1.35);
            box-shadow: 0 0 16px #00e676, 0 0 30px #00f2fe;
            opacity: 1;
          }
          100% {
            transform: scale(0.9);
            box-shadow: 0 0 8px #00e676, 0 0 16px rgba(0, 230, 118, 0.6);
            opacity: 0.85;
          }
        }
      `}</style>
      <span
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: '#00e676',
          boxShadow: '0 0 10px #00e676, 0 0 20px rgba(0, 230, 118, 0.8)',
          display: 'inline-block',
          animation: 'pyngooLiveDotGlow 1.6s ease-in-out infinite',
          flexShrink: 0,
        }}
      />
      <span style={{ textShadow: '0 0 12px rgba(0, 242, 254, 0.5)' }}>
        {t('live_counter_badge', {
          count: count.toLocaleString(),
          defaultValue: `${count.toLocaleString()}+ Kişi Çevrim İçi`,
        })}
      </span>
    </div>
  );
};

export default LivePulseCounter;
