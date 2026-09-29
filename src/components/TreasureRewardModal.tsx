import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import chestClosed from '../assets/chest_closed_3d.webp';
import chestOpen from '../assets/chest_open_3d.webp';

// Sabit sikke yörüngeleri: [x kayması px, yükseklik px, gecikme sn]
const COINS: [number, number, number][] = [
  [-110, 190, 1.0], [-70, 240, 1.05], [-30, 280, 1.1], [10, 300, 1.02], [50, 265, 1.08],
  [90, 230, 1.14], [-90, 150, 1.2], [70, 160, 1.25], [-10, 200, 1.3], [120, 170, 1.18],
];
// Parıltı yıldızları: [x px, y px, gecikme sn, boyut px]
const SPARKS: [number, number, number, number][] = [
  [-130, -60, 1.1, 22], [120, -80, 1.2, 26], [-90, -150, 1.3, 18], [80, -170, 1.15, 20],
  [0, -190, 1.35, 28], [-150, 20, 1.4, 16], [150, 10, 1.25, 18],
];

const CSS = `
@keyframes tr-fade{0%{opacity:0}12%{opacity:1}90%{opacity:1}100%{opacity:0}}
@keyframes tr-rays{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes tr-rayin{0%{opacity:0;scale:.4}100%{opacity:1;scale:1}}
@keyframes tr-drop{0%{opacity:0;transform:translateY(-320px) scale(.5)}55%{opacity:1;transform:translateY(0) scale(1.15,.85)}72%{transform:translateY(-26px) scale(.95,1.05)}100%{transform:translateY(0) scale(1)}}
@keyframes tr-wobble{0%,100%{transform:rotate(0)}20%{transform:rotate(-8deg) scale(1.03)}40%{transform:rotate(8deg) scale(1.05)}60%{transform:rotate(-6deg) scale(1.06)}80%{transform:rotate(5deg) scale(1.08)}}
@keyframes tr-closed{0%,99%{opacity:1}100%{opacity:0}}
@keyframes tr-open{0%{opacity:0;transform:scale(.85)}60%{transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}
@keyframes tr-flash{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}25%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(5)}}
@keyframes tr-ring{0%{opacity:.9;transform:translate(-50%,-50%) scale(.2)}100%{opacity:0;transform:translate(-50%,-50%) scale(4.5)}}
@keyframes tr-beam{0%{opacity:0;transform:translateX(-50%) scaleY(.2)}40%{opacity:.9}100%{opacity:.55;transform:translateX(-50%) scaleY(1)}}
@keyframes tr-coin{0%{opacity:0;transform:translate(0,0) scale(.4) rotateY(0)}12%{opacity:1}50%{transform:translate(calc(var(--dx)*.6),calc(var(--h)*-1)) scale(1.1) rotateY(540deg)}100%{opacity:0;transform:translate(var(--dx),90px) scale(.9) rotateY(1080deg)}}
@keyframes tr-spark{0%{opacity:0;transform:scale(0) rotate(0)}40%{opacity:1;transform:scale(1.2) rotate(90deg)}100%{opacity:0;transform:scale(.3) rotate(200deg)}}
@keyframes tr-amount{0%{opacity:0;transform:translateX(-50%) translateY(30px) scale(.4)}60%{transform:translateX(-50%) translateY(-6px) scale(1.12)}100%{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
@keyframes tr-float{0%,100%{translate:0 0}50%{translate:0 -8px}}
`;

const abs = { position: 'absolute' as const, left: '50%', top: '50%' };

export function TreasureRewardModal({ amount, onClose }: { amount: number; onClose: () => void }) {
  const { t } = useTranslation();

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const id = setTimeout(() => closeRef.current(), 3500);
    return () => clearTimeout(id);
  }, []);

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999, cursor: 'pointer', overflow: 'hidden',
        background: 'radial-gradient(circle at 50% 50%, rgba(60,35,5,0.85), rgba(0,0,0,0.92))',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        animation: 'tr-fade 3.5s ease-in-out forwards'
      }}
    >
      <style>{CSS}</style>

      {/* a) Dönen altın güneş ışınları */}
      <div style={{ ...abs, width: 0, height: 0, opacity: 0, animation: 'tr-rayin 0.8s ease-out 0.9s forwards' }}>
        <div style={{
          position: 'absolute', left: '50%', top: '50%', width: 900, height: 900,
          transform: 'translate(-50%,-50%)', borderRadius: '50%',
          background: 'repeating-conic-gradient(from 0deg, rgba(255,215,0,0.4) 0deg 10deg, transparent 10deg 30deg)',
          WebkitMaskImage: 'radial-gradient(circle, #000 0%, transparent 68%)',
          maskImage: 'radial-gradient(circle, #000 0%, transparent 68%)',
          animation: 'tr-rays 14s linear infinite'
        }} />
      </div>

      {/* Sahne: sandığın merkezi ekran ortası */}
      <div style={{ ...abs, width: 0, height: 0 }}>
        {/* c) Şok dalgası + ışık patlaması */}
        <div style={{ position: 'absolute', left: 0, top: 0, width: 260, height: 260, borderRadius: '50%', opacity: 0,
          background: 'radial-gradient(circle,#fff 0%,#ffe27a 35%,rgba(255,180,0,0) 70%)',
          animation: 'tr-flash 0.9s ease-out 1s forwards' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 200, height: 200, borderRadius: '50%', opacity: 0,
          border: '4px solid rgba(255,235,150,0.95)', boxShadow: '0 0 30px rgba(255,200,0,0.8)',
          animation: 'tr-ring 1s ease-out 1s forwards' }} />

        {/* İlahi ışık hüzmesi */}
        <div style={{ position: 'absolute', left: 0, bottom: 0, width: 150, height: 420, opacity: 0, transformOrigin: '50% 100%',
          background: 'linear-gradient(to top, rgba(255,230,120,0.9), rgba(255,215,0,0))',
          clipPath: 'polygon(35% 100%, 65% 100%, 100% 0, 0 0)', filter: 'blur(6px)',
          animation: 'tr-beam 0.7s ease-out 1s forwards' }} />

        {/* b) Sandık: düşüş + titreme */}
        <div style={{ position: 'absolute', left: -125, top: -110, width: 250, height: 220, animation: 'tr-drop 0.8s cubic-bezier(.3,1.4,.5,1) both' }}>
          <div style={{ position: 'absolute', inset: 0, transformOrigin: '50% 90%', animation: 'tr-wobble 0.35s ease-in-out 0.8s 1' }}>
            <img src={chestClosed} alt="" draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain',
                animation: 'tr-closed 1s linear forwards' }} />
          </div>
          <img src={chestOpen} alt="" draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0,
              animation: 'tr-open 0.5s ease-out 1s forwards' }} />
        </div>

        {/* d) Fışkıran altın paralar */}
        {COINS.map(([dx, h, delay], i) => (
          <span key={i} style={{
            position: 'absolute', left: -14, top: -40, fontSize: '1.8rem', opacity: 0,
            ['--dx' as any]: `${dx}px`, ['--h' as any]: `${h}px`,
            filter: 'drop-shadow(0 0 8px rgba(255,200,0,0.9))',
            animation: `tr-coin 1.6s ease-out ${delay}s forwards`
          }}>🪙</span>
        ))}
        {/* Parıltı yıldızları */}
        {SPARKS.map(([x, y, delay, size], i) => (
          <span key={i} style={{
            position: 'absolute', left: x, top: y, fontSize: size, opacity: 0, color: '#fff6c2',
            textShadow: '0 0 10px #ffd700, 0 0 20px #ff9d00',
            animation: `tr-spark 1.2s ease-out ${delay}s forwards`
          }}>✦</span>
        ))}

        {/* e) 3D altın tipografi tabelası */}
        <div style={{ position: 'absolute', left: 0, top: -230, width: 0, height: 0 }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap', opacity: 0,
            fontSize: '2.4rem', fontWeight: 900, letterSpacing: '0.02em',
            background: 'linear-gradient(180deg,#fff7c2 0%,#ffd700 45%,#b8860b 55%,#ffe066 100%)',
            WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 0 #7a4a00) drop-shadow(0 4px 0 #5c3600) drop-shadow(0 0 16px rgba(255,200,0,0.8))',
            animation: 'tr-amount 0.6s cubic-bezier(.3,1.4,.5,1) 1.2s forwards'
          }}>
            <span style={{ display: 'inline-block', animation: 'tr-float 1.6s ease-in-out 1.8s infinite' }}>
              +{amount.toLocaleString()} {t('gold_currency_label', 'Altın')}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
