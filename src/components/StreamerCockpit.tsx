import { useTranslation } from 'react-i18next';
import { Wallet, Settings, ExternalLink, Flame, Radio } from 'lucide-react';

interface StreamerCockpitProps {
  profile: any;
  userId: string;
  isOnline: boolean;
  onToggleOnline: () => void;
  onOpenEditProfile: () => void;
  onOpenExplore: () => void;
  onOpenWallet: () => void;
}

export default function StreamerCockpit({
  profile,
  userId,
  isOnline,
  onToggleOnline,
  onOpenEditProfile,
  onOpenExplore,
  onOpenWallet
}: StreamerCockpitProps) {
  const { t } = useTranslation();

  const diamonds = profile?.total_diamonds || 0;
  // 1 elmas = 0.015 USD (~0.50 TL)
  const estimatedUsd = (diamonds * 0.015).toFixed(2);
  const estimatedTry = Math.round(diamonds * 0.50);

  return (
    <div style={{
      width: '100%',
      maxWidth: '460px',
      margin: '0 auto 20px',
      animation: 'fadeIn 0.3s ease'
    }}>
      {/* KOKPİT ANA KART (Lüks Koyu Mor & Altın Temalı) */}
      <div style={{
        background: 'linear-gradient(165deg, #1b1033 0%, #120b22 55%, #0d071a 100%)',
        border: isOnline 
          ? '1.5px solid rgba(46, 204, 113, 0.7)' 
          : '1.5px solid rgba(255, 215, 0, 0.45)',
        borderRadius: '26px',
        padding: '22px 18px 20px',
        boxShadow: isOnline
          ? '0 15px 45px rgba(0, 0, 0, 0.8), 0 0 30px rgba(46, 204, 113, 0.25)'
          : '0 15px 45px rgba(0, 0, 0, 0.8), 0 0 25px rgba(255, 215, 0, 0.18)',
        position: 'relative',
        overflow: 'hidden',
        color: '#fff',
        transition: 'all 0.3s ease'
      }}>

        {/* Arka Plan Işıltı Efekti */}
        <div style={{
          position: 'absolute',
          top: '-60px',
          right: '-40px',
          width: '200px',
          height: '200px',
          background: isOnline 
            ? 'radial-gradient(circle, rgba(46, 204, 113, 0.25) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(255, 215, 0, 0.22) 0%, transparent 70%)',
          filter: 'blur(30px)',
          pointerEvents: 'none'
        }} />

        {/* 1. ÜST SATIR: PROFİL BİLGİSİ & CANLI DURUM ANAHTARI (TOGGLE) */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '18px',
          position: 'relative',
          zIndex: 2
        }}>
          {/* Sol: Avatar & İsim */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              position: 'relative',
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              padding: '2px',
              background: 'linear-gradient(135deg, #ffd700, #ff416c)',
              boxShadow: '0 0 15px rgba(255, 215, 0, 0.35)'
            }}>
              <img
                src={profile?.avatar || localStorage.getItem(`pyngoo_streamer_avatar_${userId}`) || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500'}
                alt={profile?.display_name || 'Yayıncı'}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
              {/* Online/Offline Rozeti */}
              <span style={{
                position: 'absolute',
                bottom: '0px',
                right: '0px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: isOnline ? '#2ecc71' : '#888',
                border: '2px solid #1b1033',
                boxShadow: isOnline ? '0 0 8px #2ecc71' : 'none'
              }} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: '900', fontSize: '1.05rem', color: '#fff' }}>
                  {profile?.display_name || 'Yayıncı'}
                </span>
                <span style={{
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.25), rgba(255, 65, 108, 0.25))',
                  border: '1px solid #ffd700',
                  color: '#ffd700',
                  fontSize: '0.66rem',
                  fontWeight: '900',
                  padding: '2px 7px',
                  borderRadius: '10px'
                }}>
                  👑 VIP STAR
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
                {t('streamer_cockpit_title', 'Yayıncı Kokpiti')}
              </div>
            </div>
          </div>

          {/* Sağ: Canlıya Geç / Mola Ver Toggle Switch */}
          <div 
            onClick={onToggleOnline}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              background: isOnline ? 'rgba(46, 204, 113, 0.18)' : 'rgba(255, 255, 255, 0.08)',
              border: isOnline ? '1.5px solid #2ecc71' : '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '24px',
              padding: '6px 12px',
              boxShadow: isOnline ? '0 0 16px rgba(46, 204, 113, 0.35)' : 'none',
              transition: 'all 0.25s ease'
            }}
          >
            <div style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: isOnline ? '#2ecc71' : '#bbb',
              boxShadow: isOnline ? '0 0 8px #2ecc71' : 'none'
            }} />
            <span style={{
              fontSize: '0.78rem',
              fontWeight: '900',
              color: isOnline ? '#2ecc71' : 'rgba(255, 255, 255, 0.65)'
            }}>
              {isOnline ? t('streamer_status_online', 'CANLI (Açık)') : t('streamer_status_offline', 'Mola (Kapalı)')}
            </span>
          </div>
        </div>

        {/* 2. BÜYÜK CANLI KAZANÇ KARTI (DOLAR & ELMAS VURGUSU) */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 215, 0, 0.3)',
          borderRadius: '20px',
          padding: '16px 14px',
          marginBottom: '16px',
          position: 'relative'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '0.76rem', fontWeight: '800', color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('streamer_earnings_today', 'Canlı Kazancın')}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(46, 204, 113, 0.2)',
              border: '1px solid rgba(46, 204, 113, 0.4)',
              color: '#2ecc71',
              fontSize: '0.70rem',
              fontWeight: '800',
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              <Flame size={12} /> +18% bugün
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
            <span style={{
              fontSize: '2.1rem',
              fontWeight: '900',
              background: 'linear-gradient(135deg, #2ecc71 0%, #ffd700 80%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px'
            }}>
              ${estimatedUsd}
            </span>
            <span style={{ fontSize: '0.92rem', color: 'rgba(255, 255, 255, 0.65)', fontWeight: '700' }}>
              USD (~{estimatedTry} ₺)
            </span>
          </div>

          {/* İstatistik Çubukları */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '8px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            textAlign: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
                {t('streamer_total_diamonds', 'Toplam Elmas')}
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: '900', color: '#ffd700', marginTop: '2px' }}>
                💎 {diamonds}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
                {t('streamer_minute_rate', 'Dakika Ücretin')}
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: '900', color: '#2ecc71', marginTop: '2px' }}>
                +50 Elmas
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
                {t('streamer_vitrine_rank', 'Vitrin Sırası')}
              </div>
              <div style={{ fontSize: '0.86rem', fontWeight: '900', color: '#00f2fe', marginTop: '2px' }}>
                👑 #1 {t('streamer_rank_top', 'Zirve')}
              </div>
            </div>
          </div>
        </div>

        {/* 3. AKTİF DURUM BİLGİLENDİRMESİ */}
        {isOnline ? (
          <div style={{
            background: 'rgba(46, 204, 113, 0.12)',
            border: '1px solid rgba(46, 204, 113, 0.4)',
            borderRadius: '16px',
            padding: '11px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Radio size={18} color="#2ecc71" className="pulse-animation" />
            <div style={{ textAlign: 'left', fontSize: '0.78rem', lineHeight: '1.35', color: '#e8f8f0' }}>
              {t('streamer_online_hint', 'Canlı sıradasın! Erkek kullanıcılar arama yaptığında ekranına çağrı daveti düşecek.')}
            </div>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '11px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{ fontSize: '1.2rem' }}>☕</span>
            <div style={{ textAlign: 'left', fontSize: '0.78rem', lineHeight: '1.35', color: 'rgba(255,255,255,0.7)' }}>
              {t('streamer_offline_hint', 'Şu an moladasın. Çağrı alıp para kazanmak için yukarıdaki Canlı butonunu aç.')}
            </div>
          </div>
        )}

        {/* 4. HIZLI AKSİYON BUTONLARI (CÜZDAN - KEŞFET - PROFİL) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          
          {/* Para Çek / Cüzdan */}
          <button
            onClick={onOpenWallet}
            style={{
              padding: '10px 8px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.2), rgba(39, 174, 96, 0.2))',
              border: '1px solid #2ecc71',
              color: '#2ecc71',
              fontSize: '0.76rem',
              fontWeight: '800',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Wallet size={16} />
            <span>{t('streamer_withdraw_btn', 'Nakit Çek')}</span>
          </button>

          {/* Keşfet Vitrinim */}
          <button
            onClick={onOpenExplore}
            style={{
              padding: '10px 8px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.18), rgba(79, 172, 254, 0.18))',
              border: '1px solid #00f2fe',
              color: '#00f2fe',
              fontSize: '0.76rem',
              fontWeight: '800',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <ExternalLink size={16} />
            <span>{t('streamer_explore_btn', 'Keşfet Vitrini')}</span>
          </button>

          {/* Profil Fotoğrafı Düzenle */}
          <button
            onClick={onOpenEditProfile}
            style={{
              padding: '10px 8px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.18), rgba(255, 65, 108, 0.18))',
              border: '1px solid #ffd700',
              color: '#ffd700',
              fontSize: '0.76rem',
              fontWeight: '800',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Settings size={16} />
            <span>{t('streamer_edit_profile_btn', 'Görseli Değiştir')}</span>
          </button>

        </div>

      </div>
    </div>
  );
}
