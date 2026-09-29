import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

// Sabit sikke yörüngeleri: [x kayması px, yükseklik px, gecikme sn]
const COINS: [number, number, number][] = [
  [-70, 120, 1.05], [-40, 150, 1.1], [-15, 170, 1.15], [15, 165, 1.08],
  [40, 145, 1.13], [70, 115, 1.18], [-55, 100, 1.25], [55, 105, 1.3],
];

const CSS = `
@keyframes tr-wobble{0%,100%{transform:rotate(0)}15%{transform:rotate(-7deg) translateX(-3px)}30%{transform:rotate(7deg) translateX(3px)}45%{transform:rotate(-6deg)}60%{transform:rotate(6deg)}75%{transform:rotate(-3deg)}}
@keyframes tr-lid{0%,30%{transform:rotate(0)}60%,100%{transform:rotate(-115deg)}}
@keyframes tr-coin{0%{opacity:0;transform:translate(0,0) scale(.4)}15%{opacity:1}50%{transform:translate(calc(var(--dx)*.6),calc(var(--h)*-1)) scale(1)}100%{opacity:0;transform:translate(var(--dx),70px) scale(.9) rotate(360deg)}}
@keyframes tr-amount{0%{opacity:0;transform:translateY(20px) scale(.5)}100%{opacity:1;transform:translateY(0) scale(1)}}
`;

export function TreasureRewardModal({ amount, onClose }: { amount: number; onClose: () => void }) {
  const { t } = useTranslation();

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const id = setTimeout(() => closeRef.current(), 3000);
    return () => clearTimeout(id);
  }, []);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999, cursor: 'pointer',
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}
    >
      <style>{CSS}</style>
      <div style={{ position: 'relative', width: 120, height: 100 }}>
        {/* Kapağın üstündeki miktar */}
        <div style={{
          position: 'absolute', left: '50%', top: -95, transform: 'translateX(-50%)',
          whiteSpace: 'nowrap', fontSize: '1.9rem', fontWeight: 900, color: '#ffd700',
          textShadow: '0 0 14px rgba(255,215,0,0.9), 0 2px 4px rgba(0,0,0,0.6)',
          opacity: 0, animation: 'tr-amount 0.5s ease-out 1.2s forwards'
        }}>
          +{amount.toLocaleString()} {t('gold_currency_label', 'Altın')}
        </div>

        {/* Sandık: titreme (ilk ~1sn) */}
        <div style={{ position: 'absolute', inset: 0, animation: 'tr-wobble 1s ease-in-out', transformOrigin: '50% 100%' }}>
          {/* Gövde */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, height: 60,
            background: 'linear-gradient(#a0611f,#6b3d10)', border: '3px solid #ffd700',
            borderRadius: '6px 6px 12px 12px', boxShadow: '0 8px 24px rgba(255,170,0,0.4)'
          }}>
            <div style={{ position: 'absolute', left: '50%', top: -3, width: 18, height: 24, marginLeft: -9, background: '#ffd700', borderRadius: '0 0 6px 6px' }} />
          </div>
          {/* Kapak */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 57, height: 34,
            background: 'linear-gradient(#c07a2a,#8a5216)', border: '3px solid #ffd700',
            borderRadius: '40px 40px 4px 4px', transformOrigin: '0% 100%',
            animation: 'tr-lid 1.2s ease-out forwards'
          }} />
        </div>

        {/* Sikkeler */}
        {COINS.map(([dx, h, delay], i) => (
          <span key={i} style={{
            position: 'absolute', left: '50%', top: 20, marginLeft: -12, fontSize: '1.5rem', opacity: 0,
            ['--dx' as any]: `${dx}px`, ['--h' as any]: `${h}px`,
            animation: `tr-coin 1.5s ease-out ${delay}s forwards`
          }}>🪙</span>
        ))}
      </div>
    </div>,
    document.body
  );
}
