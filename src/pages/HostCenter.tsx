import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  ArrowLeft, Sparkles, Wallet, ShieldCheck, 
  Settings, Radio, 
  ExternalLink, ChevronRight, Zap, X, Upload
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { soundManager } from '../utils/SoundManager';
import { getStreamerFollowers, getProfileViews, formatMetricNumber, broadcastStreamerGoLive } from '../utils/followService';
import { validateAndSanitizeImage } from '../utils/imageSecurity';

interface HostCenterProps {
  userId: string;
}

export default function HostCenter({ userId }: HostCenterProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return localStorage.getItem(`pyngoo_streamer_online_${userId}`) !== 'false';
  });
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    return localStorage.getItem(`pyngoo_streamer_avatar_${userId}`) || 
      localStorage.getItem(`pyngoo_avatar_${userId}`) ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (data) {
        setProfile(data);
        if (data.avatar) {
          setAvatarUrl(data.avatar);
        }
      }
    };
    fetchProfile();

    const handleAvatarUpdate = (e: any) => {
      if (e.detail?.avatar) {
        setAvatarUrl(e.detail.avatar);
      }
    };
    window.addEventListener('pyngoo_streamer_updated', handleAvatarUpdate);
    window.addEventListener('pyngoo_avatar_updated', handleAvatarUpdate);
    return () => {
      window.removeEventListener('pyngoo_streamer_updated', handleAvatarUpdate);
      window.removeEventListener('pyngoo_avatar_updated', handleAvatarUpdate);
    };
  }, [userId]);

  const diamonds = profile?.total_diamonds ?? 0;
  // 1 elmas = 0.015 USD (~0.50 TL)
  const estimatedUsd = (diamonds * 0.015).toFixed(2);
  const estimatedTry = Math.round(diamonds * 0.50);

  const [followerStats, setFollowerStats] = useState(() => getStreamerFollowers(userId, diamonds));
  const [viewsCount, setViewsCount] = useState(() => getProfileViews(userId, diamonds));

  useEffect(() => {
    setFollowerStats(getStreamerFollowers(userId, diamonds));
    setViewsCount(getProfileViews(userId, diamonds));

    const handleFollowUpdate = (e: any) => {
      if (e.detail?.streamerId === userId) {
        setFollowerStats(getStreamerFollowers(userId, diamonds));
      }
    };
    const handleViewsUpdate = (e: any) => {
      if (e.detail?.streamerId === userId) {
        setViewsCount(getProfileViews(userId, diamonds));
      }
    };

    window.addEventListener('pyngoo_follow_updated', handleFollowUpdate);
    window.addEventListener('pyngoo_views_updated', handleViewsUpdate);
    return () => {
      window.removeEventListener('pyngoo_follow_updated', handleFollowUpdate);
      window.removeEventListener('pyngoo_views_updated', handleViewsUpdate);
    };
  }, [userId, diamonds]);

  const handleToggleOnline = async () => {
    const nextState = !isOnline;
    setIsOnline(nextState);
    localStorage.setItem(`pyngoo_streamer_online_${userId}`, nextState ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent('pyngoo_streamer_online_changed', { detail: { isOnline: nextState } }));

    // Realtime Supabase Broadcast (Keşfet ekranındaki diğer kullanıcılar anında görsün)
    try {
      const statusCh = supabase.channel('pyngoo_streamer_status_channel');
      statusCh.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          statusCh.send({
            type: 'broadcast',
            event: 'streamer_status_changed',
            payload: { userId, isOnline: nextState }
          });
          setTimeout(() => {
            try { supabase.removeChannel(statusCh); } catch (_) {}
          }, 2000);
        }
      });
    } catch (_) {}

    // Veritabanında güncelle (sayfa yenilendiğinde de molada gözüksün)
    try {
      await supabase.from('profiles').update({ is_streamer_online: nextState, is_streamer: true }).eq('id', userId);
    } catch (_) {}

    if (nextState) {
      soundManager.playMatchFound();
      broadcastStreamerGoLive({
        id: userId,
        name: profile?.display_name || 'Host',
        avatar: avatarUrl || ''
      });
      try {
        await supabase.from('waiting_room').upsert([{ 
          user_id: userId, 
          gender: 'kadin',
          preferred_language: profile?.preferred_language || 'tr'
        }]);
      } catch (_) {}
    } else {
      soundManager.stopRadar();
      try {
        await supabase.from('waiting_room').delete().eq('user_id', userId);
      } catch (_) {}
    }
  };

  const applyPhoto = async (dataUrl: string) => {
    setAvatarUrl(dataUrl);
    localStorage.setItem(`pyngoo_streamer_avatar_${userId}`, dataUrl);
    localStorage.setItem(`pyngoo_avatar_${userId}`, dataUrl);
    localStorage.setItem(`pyngoo_is_streamer_${userId}`, 'true');

    try {
      const savedStr = localStorage.getItem(`pyngoo_user_profile_${userId}`);
      if (savedStr) {
        const parsed = JSON.parse(savedStr);
        parsed.avatar = dataUrl;
        localStorage.setItem(`pyngoo_user_profile_${userId}`, JSON.stringify(parsed));
      }
    } catch (_) {}

    // Veritabanındaki avatarı anında kalıcı olarak güncelle
    if (userId) {
      try {
        await supabase.from('profiles').update({
          avatar: dataUrl,
          is_streamer: true,
          role: 'streamer'
        }).eq('id', userId);
        // NOT: Avatar (base64, ~200KB) ASLA auth user_metadata'ya yazılmaz! Metadata JWT'nin içine
        // gömülür; dev token her Supabase isteğinin Authorization başlığını şişirip bağlantının
        // kopmasına (ERR_CONNECTION_RESET) ve girişin tamamen çökmesine yol açıyordu.
        // Avatarın tek kaynağı profiles.avatar sütunudur.
      } catch (err) {
        console.error('Supabase profile avatar update error:', err);
      }
    }

    // Anlık Realtime yayını yap
    try {
      const channel = supabase.channel('pyngoo_streamer_status_channel');
      channel.send({
        type: 'broadcast',
        event: 'streamer_avatar_changed',
        payload: { userId, avatar: dataUrl }
      });
    } catch (_) {}

    window.dispatchEvent(new CustomEvent('pyngoo_streamer_updated', {
      detail: { userId, avatar: dataUrl }
    }));
    window.dispatchEvent(new CustomEvent('pyngoo_avatar_updated', {
      detail: { userId, avatar: dataUrl }
    }));

    setIsUploadingPhoto(false);
    setShowPhotoModal(false);
  };

  // Fotoğraf Seçimi & Güvenli Optimize Edip Yerleştirme
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const result = await validateAndSanitizeImage(file, 640, 0.88);
      if (!result.valid || !result.sanitizedDataUrl) {
        setPhotoError(t(result.errorKey || 'photo_err_invalid_type', result.errorFallback || 'Lütfen geçerli bir resim dosyası seçin.'));
        setIsUploadingPhoto(false);
        return;
      }
      applyPhoto(result.sanitizedDataUrl);
    } catch (_) {
      setPhotoError(t('photo_err_processing', 'Görsel işleme sırasında hata oluştu.'));
      setIsUploadingPhoto(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at 50% 0%, #2b114d 0%, #150a26 40%, #090412 100%)',
      color: '#fff',
      paddingBottom: 'calc(95px + env(safe-area-inset-bottom, 0px))',
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Arka Plan Atmosferik Işıklar */}
      <div style={{
        position: 'absolute', top: '-100px', left: '50%', transform: 'translateX(-50%)',
        width: '500px', height: '300px',
        background: 'radial-gradient(ellipse, rgba(168, 85, 247, 0.25) 0%, rgba(255, 215, 0, 0.12) 45%, transparent 70%)',
        filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0
      }} />

      {/* 1. ÜST BAŞLIK & GERİ DÖN BUTONU */}
      <header style={{
        padding: '18px 16px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'relative',
        zIndex: 2,
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 215, 0, 0.12)'
      }}>
        <button
          onClick={() => navigate('/profile')}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            transition: 'all 0.2s'
          }}
        >
          <ArrowLeft size={20} />
        </button>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '1.05rem',
            fontWeight: '900',
            background: 'linear-gradient(135deg, #ffd700 0%, #fff 60%, #ffd700 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '0.3px'
          }}>
            <Sparkles size={16} color="#ffd700" />
            <span>{t('host_center_title', 'VIP Yayıncı Stüdyosu')}</span>
          </div>
        </div>

        {/* Canlı Durum Rozeti */}
        <div 
          onClick={handleToggleOnline}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            background: isOnline ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255, 255, 255, 0.08)',
            border: isOnline ? '1.5px solid #2ecc71' : '1px solid rgba(255, 255, 255, 0.2)',
            color: isOnline ? '#2ecc71' : 'rgba(255,255,255,0.7)',
            fontSize: '0.74rem',
            fontWeight: '900',
            cursor: 'pointer',
            boxShadow: isOnline ? '0 0 16px rgba(46, 204, 113, 0.4)' : 'none',
            transition: 'all 0.25s'
          }}
        >
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: isOnline ? '#2ecc71' : '#888',
            boxShadow: isOnline ? '0 0 8px #2ecc71' : 'none'
          }} />
          <span>{isOnline ? 'CANLI' : 'MOLA'}</span>
        </div>
      </header>

      {/* İÇERİK GÖVDESİ */}
      <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', zIndex: 1, maxWidth: '480px', margin: '0 auto' }}>

        {/* 2. PROFİL KARTI (KIRMIZI İŞARETLİ ALANLAR KALDIRILMIŞ ŞIK VE TEMİZ HALİ) */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(35, 18, 62, 0.75) 0%, rgba(19, 10, 36, 0.85) 100%)',
          border: '1.5px solid rgba(255, 215, 0, 0.4)',
          borderRadius: '24px',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4), 0 0 20px rgba(255, 215, 0, 0.12)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Büyük Altın Çerçeveli Avatar */}
            <div style={{
              position: 'relative',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              padding: '2.5px',
              background: 'linear-gradient(135deg, #ffd700 0%, #ff416c 60%, #ffd700 100%)',
              boxShadow: '0 0 20px rgba(255, 215, 0, 0.45)'
            }}>
              <img
                src={avatarUrl}
                alt={profile?.display_name || 'Host'}
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
              <span style={{
                position: 'absolute', bottom: '1px', right: '1px',
                width: '16px', height: '16px', borderRadius: '50%',
                background: isOnline ? '#2ecc71' : '#888',
                border: '2.5px solid #130a26',
                boxShadow: isOnline ? '0 0 10px #2ecc71' : 'none'
              }} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: '900', color: '#fff' }}>
                  {profile?.display_name || 'Selin'}
                </span>
                <span style={{
                  background: 'linear-gradient(135deg, #ffd700, #ff8800)',
                  color: '#000',
                  fontSize: '0.65rem',
                  fontWeight: '900',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(255, 215, 0, 0.4)'
                }}>
                  👑 VIP STAR
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowPhotoModal(true)}
            style={{
              background: 'rgba(255, 215, 0, 0.12)',
              border: '1px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '14px',
              padding: '8px 12px',
              color: '#ffd700',
              fontSize: '0.74rem',
              fontWeight: '900',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              transition: '0.2s'
            }}
          >
            <Settings size={16} />
            <span>{t('host_center_change_photo', 'Profil Resminizi Düzenle')}</span>
          </button>
        </div>

        {/* 3. BÜYÜK CANLI KAZANÇ KARTI (VAULT HERO CARD) */}
        {/* 3. BÜYÜK CANLI KAZANÇ KARTI (PREMIUM LIVE EARNINGS & SPLINE CHART) */}
        <div style={{
          background: 'linear-gradient(150deg, #1d1332 0%, #150c26 60%, #0d0619 100%)',
          border: '1.5px solid rgba(168, 85, 247, 0.35)',
          borderRadius: '26px',
          padding: '20px 18px 16px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 35px rgba(168, 85, 247, 0.18)'
        }}>
          {/* Üst Kısım: Otantik Kabartmalı Metalik Altın Dolar Sikkesi, Başlık, Kazanç ve Ok */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              {/* Gerçekçi & Gözü Yormayan Metalik Altın Sikke (Otantik Kabartmalı SVG) */}
              <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="52" height="52" viewBox="0 0 52 52" style={{ display: 'block', filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))' }}>
                  <defs>
                    <linearGradient id="authenticCoinRim" x1="15%" y1="10%" x2="85%" y2="90%">
                      <stop offset="0%" stopColor="#f7e199" />
                      <stop offset="30%" stopColor="#d9a536" />
                      <stop offset="65%" stopColor="#9c6e18" />
                      <stop offset="100%" stopColor="#694605" />
                    </linearGradient>

                    <radialGradient id="authenticCoinFace" cx="35%" cy="30%" r="65%">
                      <stop offset="0%" stopColor="#fdf0b4" />
                      <stop offset="40%" stopColor="#e3af3d" />
                      <stop offset="78%" stopColor="#b5821c" />
                      <stop offset="100%" stopColor="#7a5008" />
                    </radialGradient>

                    <filter id="authenticEngrave" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="1" stdDeviation="0.4" floodColor="#ffffff" floodOpacity="0.65" />
                      <feDropShadow dx="0" dy="-1" stdDeviation="0.5" floodColor="#4a2e03" floodOpacity="0.85" />
                    </filter>
                  </defs>

                  {/* Dış Çerçeve & Yiv */}
                  <circle cx="26" cy="26" r="24.5" fill="url(#authenticCoinRim)" stroke="#5e3c04" strokeWidth="0.8" />
                  <circle cx="26" cy="26" r="21.5" fill="none" stroke="#754b06" strokeWidth="0.75" strokeOpacity="0.7" />
                  
                  {/* İç Yüzey */}
                  <circle cx="26" cy="26" r="20.5" fill="url(#authenticCoinFace)" />
                  <circle cx="26" cy="26" r="20.5" fill="none" stroke="#fffae0" strokeWidth="0.6" strokeOpacity="0.75" />

                  {/* Sikke Üzerine Darphanede Basılmış / Kazınmış Dolar Karakteri */}
                  <text 
                    x="26" 
                    y="33.5" 
                    fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
                    fontSize="22" 
                    fontWeight="900" 
                    fill="#6e4404" 
                    textAnchor="middle" 
                    filter="url(#authenticEngrave)"
                  >
                    $
                  </text>
                </svg>
              </div>

              {/* Kazanç Başlığı ve Tutar */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{
                  fontSize: '0.86rem',
                  color: 'rgba(255, 255, 255, 0.72)',
                  fontWeight: '600'
                }}>
                  {t('host_center_earnings_title', 'Toplam Canlı Gelirin')}
                </span>

                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '2px 0' }}>
                  <span style={{
                    fontSize: '2.3rem',
                    fontWeight: '900',
                    color: '#fff',
                    letterSpacing: '-0.5px',
                    lineHeight: 1.1
                  }}>
                    ${estimatedUsd}
                  </span>
                  <span style={{ fontSize: '0.92rem', color: 'rgba(255, 255, 255, 0.55)', fontWeight: '700' }}>
                    USD
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    color: '#00e676',
                    fontSize: '0.82rem',
                    fontWeight: '800',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px'
                  }}>
                    +12% {t('host_center_today', 'bugün')}
                  </span>
                  <span style={{ fontSize: '0.76rem', color: 'rgba(255, 215, 0, 0.85)', fontWeight: '700' }}>
                    (~{estimatedTry} ₺)
                  </span>
                </div>
              </div>
            </div>

            {/* Sağ Üst Detay Oku (Wallet linki) */}
            <button
              onClick={() => navigate('/wallet')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.45)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s'
              }}
              title="Cüzdan Detayları"
            >
              <ChevronRight size={28} />
            </button>
          </div>

          {/* Orta Kısım: Doğal & Akıcı Altın-Mor Işıltılı Spline Trend Grafiği */}
          <div style={{ width: '100%', height: '82px', margin: '6px 0 10px 0', position: 'relative' }}>
            <svg
              viewBox="0 0 360 85"
              preserveAspectRatio="none"
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="waveStrokeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f5c754" />
                  <stop offset="38%" stopColor="#d17cf7" />
                  <stop offset="68%" stopColor="#a855f7" />
                  <stop offset="85%" stopColor="#f5c754" />
                  <stop offset="100%" stopColor="#ffd700" />
                </linearGradient>

                <linearGradient id="waveFillGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.18" />
                  <stop offset="65%" stopColor="#f5c754" stopOpacity="0.05" />
                  <stop offset="100%" stopColor="#0d0619" stopOpacity="0" />
                </linearGradient>

                <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Alan Doldurma */}
              <path
                d="M 0 66 C 45 72, 80 56, 110 52 C 140 48, 160 58, 190 42 C 220 26, 240 36, 270 26 C 300 16, 330 22, 360 10 L 360 85 L 0 85 Z"
                fill="url(#waveFillGradient)"
              />

              {/* Ana Çizgi */}
              <path
                d="M 0 66 C 45 72, 80 56, 110 52 C 140 48, 160 58, 190 42 C 220 26, 240 36, 270 26 C 300 16, 330 22, 360 10"
                fill="none"
                stroke="url(#waveStrokeGradient)"
                strokeWidth="2.8"
                strokeLinecap="round"
              />

              {/* Tepe Noktasındaki Işıltılı Düğüm */}
              <circle cx="246" cy="31" r="8" fill="rgba(255, 215, 0, 0.25)" filter="url(#softGlow)" />
              <circle cx="246" cy="31" r="4.5" fill="#fff" stroke="#ffd700" strokeWidth="2.2" />
            </svg>
          </div>

          {/* Alt Kısım: 4 Bölümlü Koyu Panel (Dillere Göre Tamamen Çevrilmiş) */}
          <div style={{
            background: 'rgba(10, 6, 22, 0.65)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '18px',
            padding: '12px 14px',
            display: 'grid',
            gridTemplateColumns: '1.15fr 1.05fr 1fr 1.15fr',
            gap: '8px',
            backdropFilter: 'blur(10px)'
          }}>
            {/* 1. Elmas / Diamonds */}
            <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.08)', paddingRight: '6px' }}>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '700', marginBottom: '3px' }}>
                {t('host_center_diamonds_col', 'Elmas')}
              </div>
              <div style={{ fontSize: '1rem', fontWeight: '900', color: '#fff' }}>
                {diamonds.toLocaleString('tr-TR')}
              </div>
            </div>

            {/* 2. Hediyeler / Gifting */}
            <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.08)', paddingRight: '6px' }}>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '700', marginBottom: '3px' }}>
                {t('host_center_gifting_col', 'Hediyeler')}
              </div>
              <div style={{ fontSize: '1rem', fontWeight: '900', color: '#fff' }}>
                {diamonds > 0 ? (diamonds * 0.24).toFixed(1) + 'K' : '24.0K'}
              </div>
            </div>

            {/* 3. İzlenme / Views (Vitrin & Profil İnceleme) */}
            <div style={{ borderRight: '1px solid rgba(255, 255, 255, 0.08)', paddingRight: '6px' }}>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '700', marginBottom: '3px' }}>
                {t('host_center_views_col', 'İzlenme')}
              </div>
              <div style={{ fontSize: '1rem', fontWeight: '900', color: '#fff' }}>
                {formatMetricNumber(viewsCount)}
              </div>
            </div>

            {/* 4. Takipçi / Followers (Gerçek Takipçi ve Bugünkü Artış) */}
            <div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.6)', fontWeight: '700', marginBottom: '3px' }}>
                {t('host_center_followers_col', 'Takipçi')}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
                <span style={{ fontSize: '1rem', fontWeight: '900', color: '#00e676' }}>
                  +{followerStats.today}
                </span>
                <span style={{ fontSize: '0.64rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px', fontWeight: '600' }}>
                  {followerStats.total} {t('host_center_followers_col', 'Takipçi')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Nakit Çekim Butonu */}
        <button
          onClick={() => navigate('/wallet')}
          style={{
            width: '100%',
            padding: '13px 18px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.18), rgba(46, 204, 113, 0.22))',
            border: '1.5px solid rgba(255, 215, 0, 0.75)',
            color: '#ffd700',
            fontSize: '0.94rem',
            fontWeight: '900',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.35)',
            transition: 'all 0.2s'
          }}
        >
          <Wallet size={18} color="#ffd700" />
          <span>{t('host_center_payout_btn', 'Nakit Para Çek (IBAN / Papara)')}</span>
          <ChevronRight size={17} color="#ffd700" />
        </button>

        {/* 4. CANLIYA GEÇ / ÇAĞRI AL KONSOLU (MASTER SWITCH) */}
        <div style={{
          background: isOnline 
            ? 'linear-gradient(135deg, rgba(46, 204, 113, 0.15) 0%, rgba(20, 45, 30, 0.6) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(20, 15, 35, 0.6) 100%)',
          border: isOnline ? '2px solid #2ecc71' : '1.5px solid rgba(255, 255, 255, 0.18)',
          borderRadius: '24px',
          padding: '20px 18px',
          boxShadow: isOnline 
            ? '0 10px 35px rgba(46, 204, 113, 0.3), inset 0 0 20px rgba(46, 204, 113, 0.1)'
            : '0 8px 25px rgba(0, 0, 0, 0.4)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '14px',
              background: isOnline ? 'rgba(46, 204, 113, 0.25)' : 'rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Radio size={22} color={isOnline ? '#2ecc71' : '#aaa'} />
            </div>

            <div>
              <div style={{
                fontSize: '0.98rem',
                fontWeight: '900',
                color: isOnline ? '#2ecc71' : '#fff',
                marginBottom: '4px'
              }}>
                {isOnline 
                  ? t('host_center_status_live', 'ŞU AN CANLISIN - ÇAĞRILARA AÇIK')
                  : t('host_center_status_offline', 'ŞU AN MOLADASIN')}
              </div>
              <p style={{
                margin: 0,
                fontSize: '0.78rem',
                lineHeight: '1.4',
                color: 'rgba(255, 255, 255, 0.72)'
              }}>
                {isOnline 
                  ? t('host_center_status_live_desc', 'Erkek kullanıcılar arama başlattığında veya vitrinden seni seçtiğinde ekranına anında VIP Çağrı Daveti düşer.')
                  : t('host_center_status_offline_desc', 'Çağrı kabul edip dakika başı +50 Elmas ($0.75 / 25₺) kazanmak için canlıya geç.')}
              </p>
            </div>
          </div>

          <button
            onClick={handleToggleOnline}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '16px',
              background: isOnline 
                ? 'rgba(255, 255, 255, 0.1)' 
                : 'linear-gradient(135deg, #2ecc71 0%, #11998e 100%)',
              border: isOnline ? '1.5px solid rgba(255, 255, 255, 0.25)' : 'none',
              color: '#fff',
              fontSize: '0.98rem',
              fontWeight: '900',
              cursor: 'pointer',
              boxShadow: isOnline ? 'none' : '0 6px 25px rgba(46, 204, 113, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <span>
              {isOnline 
                ? t('host_center_go_offline_btn', 'Mola Ver (Durdur) ☕')
                : t('host_center_go_online_btn', 'CANLIYA GEÇ (ÇAĞRILARI AÇ) 🚀')}
            </span>
          </button>
        </div>

        {/* 5. 3 KOLONLU METRİK KARTLARI */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {/* Kart 1: Toplam Elmas */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 215, 0, 0.3)',
            borderRadius: '18px',
            padding: '14px 8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', fontWeight: '700' }}>
              {t('host_center_diamonds_card', 'Toplam Elmas')}
            </div>
            <div style={{ fontSize: '1.25rem', fontWeight: '900', color: '#ffd700', marginTop: '4px' }}>
              💎 {diamonds}
            </div>
          </div>

          {/* Kart 2: Dakika Ücreti */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(46, 204, 113, 0.35)',
            borderRadius: '18px',
            padding: '14px 8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', fontWeight: '700' }}>
              {t('host_center_rate_card', 'Dakika Ücreti')}
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#2ecc71', marginTop: '4px' }}>
              +50 💎/dk
            </div>
          </div>

          {/* Kart 3: Canlı Hediyeler */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(0, 242, 254, 0.35)',
            borderRadius: '18px',
            padding: '14px 8px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.6)', fontWeight: '700' }}>
              {t('host_center_gifts_card', 'Canlı Hediyeler')}
            </div>
            <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#00f2fe', marginTop: '4px' }}>
              🎁 %100 Net
            </div>
          </div>
        </div>

        {/* 6. HIZLI ERİŞİM & KEŞFET VİTRİNİNE GİT */}
        <div 
          onClick={() => navigate('/explore')}
          style={{
            background: 'linear-gradient(135deg, rgba(255, 45, 85, 0.18), rgba(255, 117, 140, 0.22))',
            border: '1.5px solid rgba(255, 45, 85, 0.5)',
            borderRadius: '20px',
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            boxShadow: '0 6px 20px rgba(255, 45, 85, 0.2)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.3rem' }}>👑</span>
            <div>
              <div style={{ fontWeight: '900', fontSize: '0.92rem', color: '#fff' }}>
                {t('host_center_view_showcase_title', 'Keşfet Vitrinindeki Profilini Gör')}
              </div>
              <div style={{ fontSize: '0.74rem', color: 'rgba(255,255,255,0.7)', marginTop: '2px' }}>
                {t('host_center_view_showcase_sub', 'Erkek kullanıcıların seni nasıl gördüğünü incele')}
              </div>
            </div>
          </div>
          <ExternalLink size={18} color="#ff4d6d" />
        </div>

        {/* 7. GİZLİLİK & GÜVENLİK BİLGİ KARTI */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '20px',
          padding: '14px 16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <ShieldCheck size={24} color="#2ecc71" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: '800', fontSize: '0.86rem', color: '#fff' }}>
              {t('host_center_privacy_title', '%100 Yüz & Kimlik Gizliliği')}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', lineHeight: '1.4' }}>
              {t('host_center_privacy_desc', 'Kendi yüzünüzü veya şahsi fotoğrafınızı göstermek şart değildir. Kimliğiniz her zaman korunur.')}
            </p>
          </div>
        </div>

        {/* 8. GELİR ARTIRMA İPUCU */}
        <div style={{
          background: 'rgba(255, 215, 0, 0.06)',
          border: '1px solid rgba(255, 215, 0, 0.25)',
          borderRadius: '20px',
          padding: '14px 16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}>
          <Zap size={22} color="#ffd700" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: '800', fontSize: '0.86rem', color: '#ffd700' }}>
              {t('host_center_tips_title', 'Kazanç Taktikleri')}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.4' }}>
              {t('host_center_tips_desc', '3 dakikayı aşan görüşmelerde üyeler 2 kat daha fazla canlı hediye ve bahşiş gönderir.')}
            </p>
          </div>
        </div>

      </div>

      {/* SADE VE KÜÇÜK VİTRİN GÖRSELİ DÜZENLEME MODALI */}
      {showPhotoModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(5, 5, 16, 0.88)',
          backdropFilter: 'blur(16px)',
          zIndex: 10005,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            width: '100%', maxWidth: '320px',
            background: 'linear-gradient(165deg, #1b1033 0%, #120b22 55%, #0d071a 100%)',
            border: '1.5px solid rgba(255, 215, 0, 0.5)',
            borderRadius: '20px', padding: '18px 16px',
            position: 'relative', textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(255, 215, 0, 0.2)'
          }}>
            {/* Kapat Butonu */}
            <button
              onClick={() => setShowPhotoModal(false)}
              style={{
                position: 'absolute', top: '12px', right: '12px',
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)', border: 'none',
                color: '#fff', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={16} />
            </button>

            <h3 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: '900', color: '#fff' }}>
              {t('host_center_edit_photo_title', '📸 Profil Resminizi Düzenle')}
            </h3>
            <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.35' }}>
              {t('host_center_modal_change_photo_desc', 'Yeni bir fotoğraf seçtiğinizde profil resminiz anında güncellenir.')}
            </p>

            {/* Mevcut Resim */}
            <div style={{
              width: '90px', height: '90px',
              borderRadius: '50%', margin: '0 auto 14px',
              padding: '2.5px',
              background: 'linear-gradient(135deg, #ffd700, #ff416c)',
              boxShadow: '0 0 20px rgba(255, 215, 0, 0.35)',
              position: 'relative'
            }}>
              <img
                src={avatarUrl}
                alt="Mevcut Resim"
                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
              />
            </div>

            <input 
              id="host-center-photo-input"
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              onChange={handlePhotoFileChange} 
            />

            {photoError && (
              <div style={{ color: '#ff6b6b', fontSize: '0.75rem', marginBottom: '10px' }}>
                {photoError}
              </div>
            )}

            <label
              htmlFor="host-center-photo-input"
              onClick={() => {
                if (!isUploadingPhoto && fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              style={{
                width: '100%',
                padding: '11px',
                borderRadius: '14px',
                background: isUploadingPhoto 
                  ? '#444' 
                  : 'linear-gradient(135deg, #2ecc71 0%, #11998e 100%)',
                border: 'none',
                color: '#fff',
                fontSize: '0.88rem',
                fontWeight: '900',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                cursor: isUploadingPhoto ? 'wait' : 'pointer',
                boxShadow: '0 4px 15px rgba(46, 204, 113, 0.4)',
                boxSizing: 'border-box',
                userSelect: 'none'
              }}
            >
              <Upload size={16} />
              <span>
                {isUploadingPhoto 
                  ? t('host_center_btn_uploading_photo', 'Görsel Güncelleniyor...') 
                  : t('host_center_btn_select_photo', '📁 Galeriden Yeni Fotoğraf Seç')}
              </span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
