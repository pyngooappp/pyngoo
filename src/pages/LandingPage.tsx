import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Video, Mic, ShieldCheck, Zap, Gift, Globe, 
  Sparkles, ChevronDown, ArrowRight, Lock, Eye,
  RefreshCw, Shield
} from 'lucide-react';
import logoImg from '/logo.png';
import CookieBanner from '../components/CookieBanner';
import LegalModal, { type LegalModalType } from '../components/LegalModal';
import { updateSeoForLanguage } from '../utils/seoService';
import LivePulseCounter from '../components/LivePulseCounter';

const InstagramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ff416c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

interface LandingPageProps {
  onStartApp: () => void;
}

const COUNTRIES = [
  { code: 'tr', name: 'Türkçe', flagUrl: 'https://flagcdn.com/w40/tr.png' },
  { code: 'en', name: 'English', flagUrl: 'https://flagcdn.com/w40/gb.png' },
  { code: 'de', name: 'Deutsch', flagUrl: 'https://flagcdn.com/w40/de.png' },
  { code: 'fr', name: 'Français', flagUrl: 'https://flagcdn.com/w40/fr.png' },
  { code: 'es', name: 'Español', flagUrl: 'https://flagcdn.com/w40/es.png' },
  { code: 'ru', name: 'Русский', flagUrl: 'https://flagcdn.com/w40/ru.png' },
  { code: 'ar', name: 'العربية', flagUrl: 'https://flagcdn.com/w40/sa.png' },
  { code: 'az', name: 'Azərbaycan', flagUrl: 'https://flagcdn.com/w40/az.png' },
  { code: 'it', name: 'Italiano', flagUrl: 'https://flagcdn.com/w40/it.png' },
  { code: 'pt', name: 'Português', flagUrl: 'https://flagcdn.com/w40/br.png' },
];

export default function LandingPage({ onStartApp }: LandingPageProps) {
  const { t, i18n } = useTranslation();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [openCookiePolicy, setOpenCookiePolicy] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Legal Modallar State
  const [legalModalType, setLegalModalType] = useState<LegalModalType>(null);

  // Canlı Video Mockup State'leri (Livu Tarzı Profesyonel Çoklu Canlı Vitrin)
  const [matchIndex, setMatchIndex] = useState(0);
  const [isSafetyBlur, setIsSafetyBlur] = useState(false);
  const [countdown, setCountdown] = useState(38);
  const [floatingGifts, setFloatingGifts] = useState<{ id: number; icon: string; left: number }[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);

  const SHOWCASE_PARTNERS = [
    { nameTr: 'Elif, 22 • İstanbul', nameEn: 'Elif, 22 • Istanbul' },
    { nameTr: 'Selin, 23 • İzmir', nameEn: 'Selin, 23 • Izmir' },
    { nameTr: 'Tuğçe, 24 • Antalya', nameEn: 'Tugce, 24 • Antalya' },
  ];

  // Canlı Video Geri Sayımı Simülasyonu
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(prev => (prev > 1 ? prev - 1 : 45));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Özel Pyngoo Video döngüsü: Elif -> Selin -> Tuğçe geçişi
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const curTime = videoRef.current.currentTime;
      if (curTime >= 17.5) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
        setMatchIndex(0);
      } else if (curTime >= 11.8) {
        if (matchIndex !== 2) setMatchIndex(2);
      } else if (curTime >= 5.9) {
        if (matchIndex !== 1) setMatchIndex(1);
      } else {
        if (matchIndex !== 0) setMatchIndex(0);
      }
    }
  };

  // Sonraki eşleşmeye tıklandığında (Elif -> Selin -> Tuğçe)
  const handleNextMatch = () => {
    const nextIdx = (matchIndex + 1) % 3;
    setMatchIndex(nextIdx);
    setCountdown(45);
    if (videoRef.current) {
      const timePoints = [0, 5.9, 11.8];
      videoRef.current.currentTime = timePoints[nextIdx];
      videoRef.current.play().catch(() => {});
    }
  };

  // Yükselen Canlı Kalp / Hediye Efekti Simülasyonu
  useEffect(() => {
    const giftIcons = ['❤️', '💖', '🌹', '💎', '✨'];
    const interval = setInterval(() => {
      const randomIcon = giftIcons[Math.floor(Math.random() * giftIcons.length)];
      const newGift = {
        id: Date.now(),
        icon: randomIcon,
        left: Math.floor(Math.random() * 60) + 20
      };
      setFloatingGifts(prev => [...prev.slice(-5), newGift]);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: t('landing_faq1_q'),
      a: t('landing_faq1_a')
    },
    {
      q: t('landing_faq2_q'),
      a: t('landing_faq2_a')
    },
    {
      q: t('landing_faq3_q'),
      a: t('landing_faq3_a')
    },
    {
      q: t('landing_faq4_q'),
      a: t('landing_faq4_a')
    },
    {
      q: t('landing_faq5_q'),
      a: t('landing_faq5_a')
    }
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#070712', color: '#ffffff', fontFamily: 'system-ui, -apple-system, sans-serif', overflowX: 'hidden' }}>
      
      {/* 1. ÇEREZ POLİTİKASI BİLDİRİMİ */}
      <CookieBanner forceOpenModal={openCookiePolicy} onCloseModal={() => setOpenCookiePolicy(false)} />

      {/* 2. ÜST GEZİNME ÇUBUĞU (NAVBAR) */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(9, 10, 22, 0.88)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: '1240px', margin: '0 auto'
      }}>
        {/* Logo & Marka */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <img src={logoImg} alt="Pyngoo Logo" style={{ width: '38px', height: '38px', borderRadius: '10px', boxShadow: '0 0 18px rgba(0, 242, 254, 0.45)' }} />
          <span style={{ fontSize: '1.45rem', fontWeight: '900', letterSpacing: '1px', background: 'linear-gradient(135deg, #00f2fe, #4facfe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Pyngoo
          </span>
        </div>

        {/* Masaüstü Menü Linkleri */}
        <div style={{ display: 'none', gap: '30px', alignItems: 'center' }} className="desktop-menu">
          <a href="#features" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: '500', transition: '0.2s' }}>{t('landing_nav_features')}</a>
          <a href="#how-it-works" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: '500', transition: '0.2s' }}>{t('landing_nav_how')}</a>
          <a href="#safety" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: '500', transition: '0.2s' }}>{t('landing_nav_safety')}</a>
          <a href="#faq" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: '0.95rem', fontWeight: '500', transition: '0.2s' }}>{t('landing_nav_faq')}</a>
        </div>

        {/* Dil Seçici & Giriş Butonu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          
          {/* 10 Ülke Bayraklı Modern Dil Seçici Dropdown */}
          <div style={{ position: 'relative' }}>
            {(() => {
              const activeCountry = COUNTRIES.find(c => (i18n.language || 'tr').startsWith(c.code)) || COUNTRIES[0];
              return (
                <button
                  type="button"
                  onClick={() => setShowLangMenu(!showLangMenu)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.16)',
                    color: '#fff',
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '0.85rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  <img src={activeCountry.flagUrl} alt={activeCountry.name} style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} />
                  <span style={{ textTransform: 'uppercase' }}>{activeCountry.code}</span>
                  <ChevronDown size={14} color="rgba(255,255,255,0.6)" />
                </button>
              );
            })()}

            {showLangMenu && (
              <>
                <div 
                  onClick={() => setShowLangMenu(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 1000 }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '115%',
                    right: 0,
                    background: 'rgba(18, 20, 38, 0.98)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(0, 242, 254, 0.35)',
                    borderRadius: '16px',
                    padding: '8px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.85)',
                    zIndex: 1001,
                    minWidth: '175px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    maxHeight: '340px',
                    overflowY: 'auto'
                  }}
                >
                  {COUNTRIES.map((c) => {
                    const isSel = (i18n.language || 'tr').startsWith(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          i18n.changeLanguage(c.code);
                          try {
                            localStorage.setItem('i18nextLng', c.code);
                            localStorage.setItem('pending_language', c.code);
                          } catch (_) {}
                          updateSeoForLanguage(c.code);
                          setShowLangMenu(false);
                        }}
                        style={{
                          background: isSel ? 'rgba(0, 242, 254, 0.15)' : 'transparent',
                          border: isSel ? '1px solid rgba(0, 242, 254, 0.4)' : '1px solid transparent',
                          borderRadius: '10px',
                          padding: '7px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          textAlign: 'left',
                          color: isSel ? '#00f2fe' : '#fff',
                          fontSize: '0.82rem',
                          fontWeight: '600',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <img src={c.flagUrl} alt={c.name} style={{ width: '18px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} />
                          <span>{c.name}</span>
                        </div>
                        {isSel && <span style={{ color: '#00f2fe', fontSize: '0.85rem' }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Giriş & Başla Butonu */}
          <button 
            onClick={onStartApp}
            style={{
              background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
              color: '#050510', border: 'none', padding: '10px 22px', borderRadius: '24px',
              fontWeight: '700', fontSize: '0.95rem', cursor: 'pointer',
              boxShadow: '0 0 20px rgba(0, 242, 254, 0.4)', transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex', alignItems: 'center', gap: '8px'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Zap size={16} /> {t('landing_cta_web')}
          </button>
        </div>
      </nav>

      {/* 3. KARŞILAMA ALANI (HERO SECTION & CANLI VİDEO MOCKUP'I) */}
      <section style={{
        paddingTop: '125px', paddingBottom: '70px', paddingLeft: '20px', paddingRight: '20px',
        maxWidth: '1240px', margin: '0 auto', textAlign: 'center', position: 'relative'
      }}>
        {/* Neon Glow Efektleri */}
        <div style={{ position: 'absolute', top: '15%', left: '50%', transform: 'translate(-50%, -50%)', width: '650px', height: '350px', background: 'radial-gradient(circle, rgba(0, 242, 254, 0.18) 0%, rgba(255, 65, 108, 0.12) 50%, transparent 80%)', filter: 'blur(85px)', pointerEvents: 'none' }} />

        {/* Üst Rozet */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '22px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 20px',
            background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(0, 242, 254, 0.35)',
            borderRadius: '30px', backdropFilter: 'blur(10px)'
          }}>
            <Sparkles size={16} color="#00f2fe" />
            <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#00f2fe', letterSpacing: '0.5px' }}>
              {t('landing_badge')}
            </span>
          </div>
        </div>

        {/* Ana Slogan */}
        <h1 style={{
          fontSize: 'clamp(2.4rem, 5.5vw, 4.2rem)', fontWeight: '900', lineHeight: '1.14',
          margin: '0 auto 20px auto', maxWidth: '880px', letterSpacing: '-0.5px'
        }}>
          {t('landing_hero_title_1')} <br />
          <span style={{ background: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 50%, #ff416c 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {t('landing_hero_title_2')}
          </span>
        </h1>

        {/* Alt Açıklama */}
        <p style={{
          fontSize: 'clamp(1rem, 2vw, 1.25rem)', color: 'rgba(255, 255, 255, 0.72)',
          maxWidth: '680px', margin: '0 auto 35px auto', lineHeight: '1.65'
        }}>
          {t('landing_hero_desc')}
        </p>

        {/* Aksiyon Butonları */}
        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '28px' }}>
          <button 
            onClick={onStartApp}
            style={{
              background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
              color: '#050510', border: 'none', padding: '16px 38px', borderRadius: '32px',
              fontSize: '1.1rem', fontWeight: '800', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '10px',
              boxShadow: '0 10px 30px rgba(0, 242, 254, 0.45)', transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            <Globe size={22} /> {t('landing_cta_web')} <ArrowRight size={20} />
          </button>

          <a 
            href="https://instagram.com/pyngoo.app" 
            target="_blank" 
            rel="noreferrer"
            style={{
              background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'white', padding: '16px 28px', borderRadius: '32px',
              fontSize: '1rem', fontWeight: '600', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: '10px', transition: 'all 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
          >
            <InstagramIcon /> @pyngoo.app
          </a>
        </div>

        {/* Kullanıcının İşaret Ettiği Tek Canlı Çevrim İçi Sayacı (Butonlar ile Video Vitrini Arasında) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '38px' }}>
          <LivePulseCounter style={{ padding: '9px 24px', fontSize: '0.98rem' }} />
        </div>

        {/* 4. CANLI VİDEO AKIŞLI AKILLI TELEFON VİTRİNİ */}
        <div style={{ position: 'relative', maxWidth: '380px', margin: '0 auto' }}>
          
          {/* Sol Üst Uçan Rozet (Hızlı Eşleşme) */}
          <div style={{
            position: 'absolute', top: '46%', left: '-80px', zIndex: 30,
            background: 'rgba(15, 17, 35, 0.9)', border: '1px solid rgba(0, 242, 254, 0.4)',
            padding: '10px 18px', borderRadius: '20px', backdropFilter: 'blur(16px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(0, 242, 254, 0.2)',
            display: 'none', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700'
          }} className="floating-badge-left">
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ecc71', boxShadow: '0 0 8px #2ecc71' }}></span>
            <span>{t('landing_badge_speed')}</span>
          </div>

          {/* Sağ Alt Uçan Rozet (Güvenlik / Elmas) */}
          <div style={{
            position: 'absolute', bottom: '22%', right: '-85px', zIndex: 30,
            background: 'rgba(15, 17, 35, 0.9)', border: '1px solid rgba(255, 65, 108, 0.4)',
            padding: '10px 18px', borderRadius: '20px', backdropFilter: 'blur(16px)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.6), 0 0 20px rgba(255, 65, 108, 0.2)',
            display: 'none', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: '700'
          }} className="floating-badge-right">
            <span>{t('landing_badge_shield')}</span>
          </div>

          {/* Akıllı Telefon Kasası */}
          <div style={{
            position: 'relative',
            background: 'linear-gradient(180deg, #1f2038 0%, #0d0e1d 100%)',
            borderRadius: '46px',
            padding: '12px',
            border: '4px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 35px 90px rgba(0, 242, 254, 0.25), 0 15px 40px rgba(0, 0, 0, 0.9)',
            overflow: 'hidden'
          }}>
            
            {/* Telefon Ekranı */}
            <div style={{
              position: 'relative',
              borderRadius: '36px',
              overflow: 'hidden',
              height: '560px',
              background: '#0a0a14',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between'
            }}>
              
              {/* CANLI GERÇEK VİDEO OYNATICI (MP4 - ÖZEL PYNGOO ÇOKLU CANLI VİTRİN) */}
              <video
                ref={videoRef}
                src="/videos/pyngoo_custom_showcase.mp4"
                poster="/logo.png"
                autoPlay
                loop
                muted
                playsInline
                onTimeUpdate={handleTimeUpdate}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  filter: isSafetyBlur ? 'blur(16px)' : 'none',
                  transition: 'filter 0.4s ease',
                  zIndex: 1
                }}
              />

              {/* Görüntü Üzerine Karartma Gradyanı */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.85) 100%)',
                zIndex: 2,
                pointerEvents: 'none'
              }} />

              {/* GÜVENLİK BULANIKLIĞI KALKANI (Aktifse) */}
              {isSafetyBlur && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 3,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.35)',
                  padding: '20px'
                }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(0, 242, 254, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', border: '2px solid #00f2fe', boxShadow: '0 0 16px rgba(0, 242, 254, 0.4)' }}>
                    <Shield size={28} color="#00f2fe" />
                  </div>
                  <div style={{ fontSize: '0.92rem', fontWeight: '800', color: '#fff', marginBottom: '3px', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
                    {t('landing_demo_blur_on', 'Güvenlik Bulanıklığı Aktif')}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', marginBottom: '10px', textAlign: 'center' }}>
                    {t('landing_demo_blur_sub')}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSafetyBlur(false)}
                    style={{
                      background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                      border: 'none',
                      color: '#000',
                      padding: '7px 18px',
                      borderRadius: '20px',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(0, 242, 254, 0.5)'
                    }}
                  >
                    {t('video_unblur_btn', 'Bulanıklığı Kaldır')}
                  </button>
                </div>
              )}

              {/* Yükselen Animasyonlu Canlı Hediyeler */}
              <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 4 }}>
                {floatingGifts.map(item => (
                  <div
                    key={item.id}
                    style={{
                      position: 'absolute',
                      bottom: '90px',
                      left: `${item.left}%`,
                      fontSize: '1.8rem',
                      animation: 'floatUp 2.8s forwards ease-out',
                      textShadow: '0 0 10px rgba(255, 65, 108, 0.8)'
                    }}
                  >
                    {item.icon}
                  </div>
                ))}
              </div>


              {/* TELEFON ÜST ÇUBUĞU */}
              <div style={{ position: 'relative', zIndex: 5, padding: '16px 14px 0 14px' }}>
                
                {/* Üst Canlı Bilgi Satırı */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  
                  {/* Canlı Yayın + 45s Geri Sayım */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)', padding: '5px 10px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.15)' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ff416c', animation: 'pulse 1.5s infinite' }}></span>
                    <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#ff416c' }}>LIVE</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.72rem' }}>|</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#00f2fe' }}>00:{countdown < 10 ? `0${countdown}` : countdown}</span>
                  </div>

                  {/* Güvenlik Bulanıklığı Test Butonu */}
                  <button
                    type="button"
                    onClick={() => setIsSafetyBlur(!isSafetyBlur)}
                    title={t('landing_demo_tap_blur')}
                    style={{
                      background: isSafetyBlur ? 'rgba(0, 242, 254, 0.3)' : 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      color: isSafetyBlur ? '#00f2fe' : '#fff',
                      padding: '5px 10px',
                      borderRadius: '16px',
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      backdropFilter: 'blur(10px)'
                    }}
                  >
                    <Eye size={13} /> {isSafetyBlur ? t('landing_blur_btn_on') : t('landing_blur_btn_off')}
                  </button>
                </div>


                {/* Eşleşilen Kişi Kartı */}
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  
                  {/* Profil Bilgisi */}
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(12px)',
                    padding: '6px 14px', borderRadius: '18px', border: '1px solid rgba(255,255,255,0.12)',
                    display: 'flex', alignItems: 'center', gap: '8px'
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ecc71', boxShadow: '0 0 6px #2ecc71' }}></span>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: '800', color: '#fff' }}>
                        {i18n.language?.startsWith('tr') ? SHOWCASE_PARTNERS[matchIndex]?.nameTr : SHOWCASE_PARTNERS[matchIndex]?.nameEn}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#00f2fe', fontWeight: '600' }}>
                        {t('landing_demo_status')}
                      </div>
                    </div>
                  </div>

                </div>

              </div>

              {/* TELEFON ALT AKSİYON ALANI */}
              <div style={{ position: 'relative', zIndex: 5, padding: '0 16px 20px 16px' }}>
                
                {/* 1. Tekil İkonlu Mod Butonları */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '12px' }}>
                  <span style={{ background: 'rgba(0, 242, 254, 0.25)', color: '#00f2fe', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', backdropFilter: 'blur(10px)', border: '1px solid rgba(0, 242, 254, 0.3)' }}>
                    {t('mode_video')}
                  </span>
                  <span style={{ background: 'rgba(255, 65, 108, 0.25)', color: '#ff416c', padding: '4px 12px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', backdropFilter: 'blur(10px)', border: '1px solid rgba(255, 65, 108, 0.3)' }}>
                    {t('mode_voice')}
                  </span>
                </div>

                {/* 2. Sonraki Eşleşme Butonu (Çift Dilli ve Temiz) */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '15px' }}>
                  <button
                    type="button"
                    onClick={handleNextMatch}
                    style={{
                      background: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      color: '#fff',
                      padding: '7px 18px',
                      borderRadius: '16px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      backdropFilter: 'blur(10px)',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
                  >
                    <RefreshCw size={13} color="#00f2fe" />
                    <span>{t('landing_next_match')}</span>
                  </button>
                </div>

                {/* 3. Ana Eşleşme Başlat Butonu */}
                <button 
                  onClick={onStartApp}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                    border: 'none',
                    padding: '14px',
                    borderRadius: '18px',
                    color: '#050510',
                    fontWeight: '800',
                    cursor: 'pointer',
                    fontSize: '0.98rem',
                    boxShadow: '0 6px 25px rgba(0, 242, 254, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.transform = 'scale(1.03)'}
                  onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <Zap size={18} /> {t('landing_match_now')}
                </button>

              </div>

            </div>
          </div>
        </div>

      </section>

      {/* 5. RAKAMLAR VE GÜVEN SAYACI */}
      <section style={{
        borderTop: '1px solid rgba(255,255,255,0.08)', borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255, 255, 255, 0.02)', padding: '40px 20px'
      }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '30px', textAlign: 'center' }}>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#00f2fe', marginBottom: '6px' }}>45s</div>
            <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>{t('landing_stat_45s')}</div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#ff416c', marginBottom: '6px' }}>%100</div>
            <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>{t('landing_stat_ai')}</div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#ffd700', marginBottom: '6px' }}>4s</div>
            <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>{t('landing_stat_blur')}</div>
          </div>
          <div>
            <div style={{ fontSize: '2.5rem', fontWeight: '900', color: '#2ecc71', marginBottom: '6px' }}>IBAN / Bank</div>
            <div style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>{t('landing_stat_cash')}</div>
          </div>
        </div>
      </section>

      {/* 6. ÖZELLİKLER (GRID KARTLAR) */}
      <section id="features" style={{ padding: '80px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '60px' }}>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: '800', margin: '0 0 16px 0' }}>
            {t('landing_why_title')} <span style={{ color: '#00f2fe' }}>Pyngoo?</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto' }}>
            {t('landing_why_desc')}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '25px' }}>
          
          {/* Kart 1 */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px', transition: '0.3s' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(0, 242, 254, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <Video size={28} color="#00f2fe" />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '12px' }}>{t('landing_feat1_title')}</h3>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: '1.6', fontSize: '0.95rem' }}>
              {t('landing_feat1_desc')}
            </p>
          </div>

          {/* Kart 2 */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px', transition: '0.3s' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255, 65, 108, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <Mic size={28} color="#ff416c" />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '12px' }}>{t('landing_feat2_title')}</h3>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: '1.6', fontSize: '0.95rem' }}>
              {t('landing_feat2_desc')}
            </p>
          </div>

          {/* Kart 3 */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px', transition: '0.3s' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(0, 242, 254, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <ShieldCheck size={28} color="#00f2fe" />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '12px' }}>{t('landing_feat3_title')}</h3>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: '1.6', fontSize: '0.95rem' }}>
              {t('landing_feat3_desc')}
            </p>
          </div>

          {/* Kart 4 */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px', transition: '0.3s' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255, 215, 0, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <Gift size={28} color="#ffd700" />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '12px' }}>{t('landing_feat4_title')}</h3>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: '1.6', fontSize: '0.95rem' }}>
              {t('landing_feat4_desc')}
            </p>
          </div>

          {/* Kart 5 (Güvenlik) */}
          <div id="safety" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px', transition: '0.3s' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(0, 242, 254, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <Eye size={28} color="#00f2fe" />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '12px' }}>{t('landing_feat5_title')}</h3>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: '1.6', fontSize: '0.95rem' }}>
              {t('landing_feat5_desc')}
            </p>
          </div>

          {/* Kart 6 */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '32px', transition: '0.3s' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255, 65, 108, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
              <Lock size={28} color="#ff416c" />
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '12px' }}>{t('landing_feat6_title')}</h3>
            <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: '1.6', fontSize: '0.95rem' }}>
              {t('landing_feat6_desc')}
            </p>
          </div>

        </div>
      </section>

      {/* 7. NASIL ÇALIŞIR? (3 ADIM) */}
      <section id="how-it-works" style={{ padding: '80px 20px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)', fontWeight: '800', marginBottom: '16px' }}>
            {t('landing_how_title')} <span style={{ color: '#4facfe' }}>{t('landing_how_works')}</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.1rem', marginBottom: '50px' }}>
            {t('landing_how_desc')}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '30px', textAlign: 'left' }}>
            
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '30px', position: 'relative' }}>
              <div style={{ fontSize: '3rem', fontWeight: '900', color: 'rgba(0, 242, 254, 0.25)', position: 'absolute', top: '15px', right: '20px' }}>01</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '10px' }}>{t('landing_step1_title')}</h3>
              <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: '1.6' }}>
                {t('landing_step1_desc')}
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '30px', position: 'relative' }}>
              <div style={{ fontSize: '3rem', fontWeight: '900', color: 'rgba(255, 65, 108, 0.25)', position: 'absolute', top: '15px', right: '20px' }}>02</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '10px' }}>{t('landing_step2_title')}</h3>
              <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: '1.6' }}>
                {t('landing_step2_desc')}
              </p>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '30px', position: 'relative' }}>
              <div style={{ fontSize: '3rem', fontWeight: '900', color: 'rgba(255, 215, 0, 0.25)', position: 'absolute', top: '15px', right: '20px' }}>03</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '10px' }}>{t('landing_step3_title')}</h3>
              <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: '1.6' }}>
                {t('landing_step3_desc')}
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 8. SSS (SIKÇA SORULAN SORULAR) */}
      <section id="faq" style={{ padding: '80px 20px', maxWidth: '850px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '50px' }}>
          <h2 style={{ fontSize: 'clamp(2rem, 4vw, 2.6rem)', fontWeight: '800', marginBottom: '12px' }}>
            {t('landing_faq_title')} <span style={{ color: '#00f2fe' }}>{t('landing_faq_highlight')}</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem' }}>
            {t('landing_faq_desc')}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {faqs.map((faq, idx) => (
            <div 
              key={idx} 
              style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px', overflow: 'hidden', transition: 'all 0.3s'
              }}
            >
              <button 
                onClick={() => toggleFaq(idx)}
                style={{
                  width: '100%', padding: '20px 24px', background: 'transparent', border: 'none',
                  color: 'white', fontWeight: '600', fontSize: '1.05rem', display: 'flex',
                  alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left'
                }}
              >
                <span>{faq.q}</span>
                <ChevronDown size={20} style={{ transform: openFaq === idx ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.3s' }} />
              </button>
              {openFaq === idx && (
                <div style={{ padding: '0 24px 20px 24px', color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', lineHeight: '1.6' }}>
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 9. CTA ÇAĞRI ALANI */}
      <section style={{
        padding: '70px 20px', textAlign: 'center',
        background: 'linear-gradient(180deg, rgba(10, 10, 20, 0) 0%, rgba(0, 242, 254, 0.08) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.08)'
      }}>
        <h2 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: '900', marginBottom: '16px' }}>
          {t('landing_cta_bottom_title')}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 30px auto' }}>
          {t('landing_cta_bottom_desc')}
        </p>
        <button 
          onClick={onStartApp}
          style={{
            background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
            color: '#050510', border: 'none', padding: '16px 40px', borderRadius: '35px',
            fontSize: '1.15rem', fontWeight: '800', cursor: 'pointer',
            boxShadow: '0 10px 30px rgba(0, 242, 254, 0.4)', transition: 'transform 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {t('landing_cta_bottom_btn')}
        </button>
      </section>

      {/* 10. KURUMSAL ALT BİLGİ (FOOTER) */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.08)', background: '#05050e',
        padding: '50px 20px 30px 20px', fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px', alignItems: 'center', textAlign: 'center' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img src={logoImg} alt="Pyngoo" style={{ width: '30px', height: '30px', borderRadius: '8px' }} />
            <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'white' }}>Pyngoo</span>
          </div>

          <div style={{ display: 'flex', gap: '25px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="https://instagram.com/pyngoo.app" target="_blank" rel="noreferrer" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none' }}>Instagram: @pyngoo.app</a>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span style={{ cursor: 'pointer' }} onClick={() => setLegalModalType('kvkk')}>KVKK</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span style={{ cursor: 'pointer' }} onClick={() => setLegalModalType('terms')}>{t('landing_footer_terms')}</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span style={{ cursor: 'pointer', color: '#ffd700' }} onClick={() => setLegalModalType('refund')}>{t('landing_footer_refund', 'İade Politikası')}</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span style={{ cursor: 'pointer' }} onClick={() => setLegalModalType('cookies')}>{t('landing_footer_cookies')}</span>
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>•</span>
            <span style={{ cursor: 'pointer' }} onClick={() => setLegalModalType('privacy')}>{t('landing_footer_privacy')}</span>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px', width: '100%' }}>
            {t('landing_footer_rights')}
          </div>
        </div>
      </footer>

      {/* Yasal Sözleşmeler ve Gizlilik Modalı */}
      <LegalModal type={legalModalType} onClose={() => setLegalModalType(null)} />

      {/* Global CSS Animasyonları ve Responsive Kuralları */}
      <style>{`
        @media (min-width: 768px) {
          .desktop-menu { display: flex !important; }
        }
        @media (min-width: 900px) {
          .floating-badge-left { display: flex !important; }
          .floating-badge-right { display: flex !important; }
        }
        @keyframes floatUp {
          0% { opacity: 0.9; transform: translateY(0) scale(0.8); }
          50% { opacity: 1; transform: translateY(-70px) scale(1.15); }
          100% { opacity: 0; transform: translateY(-150px) scale(1.3); }
        }
      `}</style>

    </div>
  );
}
