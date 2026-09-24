import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { 
  LogOut, 
  Coins, 
  Crown, 
  Flame, 
  Clock, 
  Heart, 
  ChevronRight, 
  Wallet as WalletIcon, 
  ShieldCheck,
  Globe,
  X,
  Trash2,
  UserX,
  FileText,
  RefreshCw,
  Camera,
  Upload
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LegalModal, { type LegalModalType } from '../components/LegalModal';
import FeedbackModal from '../components/FeedbackModal';
import { fetchBlockedUsers, unblockUser, type BlockedUserItem } from '../utils/blockService';
import { validateAndSanitizeImage } from '../utils/imageSecurity';

interface ProfileProps {
  userId: string;
  onLogout: () => void;
}

export default function Profile({ userId, onLogout }: ProfileProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(() => {
    const isOmer = userId === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b' || userId === '22b3c0e7-e1e2-4cb5-9532-990066b5a80c';
    const isApoo = userId === '16cd9b54-a051-4548-a3ad-d34f4b5b9ab4';

    const savedStr = localStorage.getItem(`pyngoo_user_profile_${userId}`);
    if (savedStr) {
      try { 
        const p = JSON.parse(savedStr); 
        if (isOmer) {
          p.gender = 'erkek';
          p.role = 'admin';
        } else if (isApoo) {
          p.gender = 'erkek';
          p.role = 'moderator';
          p.is_moderator = true;
        }
        return p;
      } catch (_) {}
    }
    const isKadin = !isOmer && !isApoo && (localStorage.getItem('pyngoo_gender') === 'kadin' || localStorage.getItem(`pyngoo_role_${userId}`) === 'streamer');
    return {
      id: userId,
      display_name: isOmer ? 'omer' : (isApoo ? 'apoo' : 'Kullanıcı'),
      total_gold: 100,
      total_diamonds: 0,
      gender: (isOmer || isApoo) ? 'erkek' : (isKadin ? 'kadin' : 'erkek'),
      role: isOmer ? 'admin' : (isApoo ? 'moderator' : (isKadin ? 'streamer' : 'user')),
      is_moderator: isApoo ? true : false,
      preferred_language: 'tr',
      is_premium: false,
      free_extensions: 2
    };
  });
  const [showLangModal, setShowLangModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserItem[]>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [legalModalType, setLegalModalType] = useState<LegalModalType | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(() => {
    return localStorage.getItem(`pyngoo_streamer_avatar_${userId}`) || 
      localStorage.getItem(`pyngoo_avatar_${userId}`) || '';
  });

  useEffect(() => {
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
  }, []);

  const applyPhoto = async (dataUrl: string) => {
    setAvatarUrl(dataUrl);
    localStorage.setItem(`pyngoo_streamer_avatar_${userId}`, dataUrl);
    localStorage.setItem(`pyngoo_avatar_${userId}`, dataUrl);

    try {
      const savedStr = localStorage.getItem(`pyngoo_user_profile_${userId}`);
      if (savedStr) {
        const parsed = JSON.parse(savedStr);
        parsed.avatar = dataUrl;
        localStorage.setItem(`pyngoo_user_profile_${userId}`, JSON.stringify(parsed));
      }
    } catch (_) {}

    if (userId) {
      try {
        await supabase.from('profiles').update({
          avatar: dataUrl
        }).eq('id', userId);
        // NOT: Avatar (base64, ~200KB) ASLA auth user_metadata'ya yazılmaz! Metadata JWT'nin içine
        // gömülür; dev token her Supabase isteğinin Authorization başlığını şişirip bağlantının
        // kopmasına (ERR_CONNECTION_RESET) ve girişin tamamen çökmesine yol açıyordu.
        // Avatarın tek kaynağı profiles.avatar sütunudur.
      } catch (err) {
        console.error('Supabase profile avatar update error:', err);
      }
    }

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

  const handleOpenBlockedModal = async () => {
    setShowBlockedModal(true);
    setIsLoadingBlocked(true);
    try {
      const list = await fetchBlockedUsers(userId);
      setBlockedUsers(list);
    } catch (e) {
      console.error('Fetch blocked users error:', e);
    } finally {
      setIsLoadingBlocked(false);
    }
  };

  const handleUnblock = async (blockedId: string) => {
    await unblockUser(userId, blockedId);
    setBlockedUsers((prev) => prev.filter((u) => u.id !== blockedId));
  };


  const COUNTRIES = [
    { code: 'tr', name: 'Türkiye', flagUrl: 'https://flagcdn.com/w40/tr.png' },
    { code: 'en', name: 'English (US / UK)', flagUrl: 'https://flagcdn.com/w40/gb.png' },
    { code: 'de', name: 'Deutschland', flagUrl: 'https://flagcdn.com/w40/de.png' },
    { code: 'fr', name: 'France', flagUrl: 'https://flagcdn.com/w40/fr.png' },
    { code: 'es', name: 'España', flagUrl: 'https://flagcdn.com/w40/es.png' },
    { code: 'ru', name: 'Россия', flagUrl: 'https://flagcdn.com/w40/ru.png' },
    { code: 'ar', name: 'العربية', flagUrl: 'https://flagcdn.com/w40/sa.png' },
    { code: 'az', name: 'Azərbaycan', flagUrl: 'https://flagcdn.com/w40/az.png' },
    { code: 'it', name: 'Italia', flagUrl: 'https://flagcdn.com/w40/it.png' },
    { code: 'pt', name: 'Brasil / Portugal', flagUrl: 'https://flagcdn.com/w40/br.png' },
  ];

  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (error) {
          console.warn('Profile.tsx network notice:', error);
          return;
        }
        if (!data) return;

        if (data.role === 'deleted' || data.is_banned === true) {
          console.warn('Profile.tsx: Profil silinmiş veya yasaklanmış.');
          if (isMounted) {
            onLogout();
            window.location.href = '/login';
          }
          return;
        }

        if (data && isMounted) {
          const isThisOmer = userId === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b' || userId === '22b3c0e7-e1e2-4cb5-9532-990066b5a80c';
          const isThisApoo = userId === '16cd9b54-a051-4548-a3ad-d34f4b5b9ab4';

          if (isThisOmer) {
            data.gender = 'erkek';
            data.role = 'admin';
            localStorage.setItem('pyngoo_gender', 'erkek');
            localStorage.setItem('pending_gender', 'erkek');
            localStorage.removeItem(`pyngoo_is_streamer_${userId}`);
            localStorage.removeItem(`pyngoo_streamer_online_${userId}`);
            localStorage.removeItem(`pyngoo_streamer_avatar_${userId}`);
            localStorage.setItem(`pyngoo_role_${userId}`, 'admin');
            try {
              await supabase.from('profiles').update({ gender: 'erkek', role: 'admin' }).eq('id', userId);
            } catch (_) {}
          } else if (isThisApoo) {
            data.gender = 'erkek';
            data.role = 'moderator';
            data.is_moderator = true;
            localStorage.setItem('pyngoo_gender', 'erkek');
            localStorage.setItem('pending_gender', 'erkek');
            localStorage.removeItem(`pyngoo_is_streamer_${userId}`);
            localStorage.removeItem(`pyngoo_streamer_online_${userId}`);
            localStorage.removeItem(`pyngoo_streamer_avatar_${userId}`);
            localStorage.setItem(`pyngoo_role_${userId}`, 'moderator');
            try {
              await supabase.from('profiles').update({ gender: 'erkek', role: 'moderator', is_moderator: true }).eq('id', userId);
            } catch (_) {}
          } else if (data.gender) {
            // Veritabanındaki gerçek cinsiyeti localStorage'a mühürle
            localStorage.setItem('pyngoo_gender', data.gender);
          }
          setProfile(data);
          if (data.avatar) {
            setAvatarUrl(data.avatar);
            localStorage.setItem(`pyngoo_avatar_${userId}`, data.avatar);
            localStorage.setItem(`pyngoo_streamer_avatar_${userId}`, data.avatar);
          }
          localStorage.setItem(`pyngoo_user_profile_${userId}`, JSON.stringify(data));
          return;
        }
      } catch (err) {
        console.warn('Profile fetch error:', err);
      }
    };
    fetchProfile();

    const handleGoldUpdated = (e: any) => {
      if (e.detail?.newGold !== undefined) {
        setProfile((prev: any) => ({ ...(prev || {}), total_gold: e.detail.newGold }));
      }
    };
    window.addEventListener('pyngoo_gold_updated', handleGoldUpdated);

    return () => { 
      isMounted = false; 
      window.removeEventListener('pyngoo_gold_updated', handleGoldUpdated);
    };
  }, [userId, onLogout]);



  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      // 0. Keşfet ve diğer panellerden derhal kalkması ve kullanıcı adının boşa çıkması için profili 'deleted' yap
      try {
        await supabase.from('profiles').update({
          role: 'deleted',
          display_name: `Silinmiş Hesap_${userId.slice(0, 8)}`,
          is_banned: true
        }).eq('id', userId);
      } catch (_) {}

      // Keşfet ve açık bileşenlere anında bildir
      window.dispatchEvent(new CustomEvent('pyngoo_profile_deleted', { detail: { userId } }));

      // 1. PostgreSQL RPC fonksiyonu ile hesabı ve tüm ilişkileri (auth.users dahil) tek hamlede sil
      try {
        await supabase.rpc('delete_user_account');
      } catch (err) {
        console.warn('RPC delete_user_account error:', err);
      }

      // 2. Yedek silme: İlgili tüm tabloları tek tek temizle
      try { await supabase.from('waiting_room').delete().eq('user_id', userId); } catch (_) {}
      try { await supabase.from('messages').delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`); } catch (_) {}
      try { await supabase.from('friends').delete().or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`); } catch (_) {}
      try { await supabase.from('reports').delete().or(`reporter_id.eq.${userId},reported_user_id.eq.${userId}`); } catch (_) {}
      try { await supabase.from('withdrawal_requests').delete().eq('user_id', userId); } catch (_) {}
      try { await supabase.from('profiles').delete().eq('id', userId); } catch (_) {}

      // 3. Tüm yerel çerezleri, tokenları ve saklanan profilleri süpür
      localStorage.clear();
      sessionStorage.clear();
      document.cookie = "p_gen=; path=/; max-age=0";
      document.cookie = "p_role=; path=/; max-age=0";
      document.cookie = "p_nick=; path=/; max-age=0";
      document.cookie = "p_lang=; path=/; max-age=0";
      document.cookie = "p_auth_mode=; path=/; max-age=0";

      // 4. Supabase oturumunu tamamen kapat
      try {
        await supabase.auth.signOut();
      } catch (_) {}

      onLogout();
      window.location.href = '/login?deleted=1';
    } catch (err: any) {
      console.error('Hesap silme hatası:', err);
      try { await supabase.auth.signOut(); } catch (_) {}
      onLogout();
      window.location.href = '/login?deleted=1';
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (!profile) {
    return <div className="loading-screen"><div className="spinner"></div></div>;
  }

  return (
    <div className="home-container" style={{ paddingBottom: 'calc(95px + env(safe-area-inset-bottom, 0px))', width: '100%' }}>
      
      {/* 1. PROFİL KART BAŞLIĞI */}
      <header className="home-header glassmorphism" style={{
        flexDirection: 'column', gap: '14px', padding: '24px 20px',
        margin: '16px 14px', borderRadius: '28px',
        background: 'linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02))',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div 
          onClick={() => setShowPhotoModal(true)}
          style={{ position: 'relative', cursor: 'pointer' }}
          title={t('host_center_change_photo', 'Profil Resminizi Düzenle')}
        >
          <div className="avatar" style={{
            width: '84px', height: '84px', fontSize: '2.4rem',
            background: avatarUrl 
              ? 'linear-gradient(135deg, #ffd700, #ff416c)' 
              : 'linear-gradient(135deg, #ff0844, #ffb199)',
            boxShadow: '0 8px 25px rgba(255, 8, 68, 0.4)',
            border: '3px solid rgba(255,255,255,0.4)',
            borderRadius: '50%',
            overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {avatarUrl ? (
              <img 
                src={avatarUrl} 
                alt={profile.display_name} 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            ) : (
              profile.display_name.charAt(0).toUpperCase()
            )}
          </div>
          {profile.is_premium && (
            <div style={{
              position: 'absolute', bottom: '-4px', right: '-4px',
              background: 'linear-gradient(135deg, #ffd700, #ff9800)',
              width: '26px', height: '26px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.5)'
            }}>
              <Crown size={15} color="#000" />
            </div>
          )}
          {/* Kamera Rozeti */}
          <div style={{
            position: 'absolute', bottom: '0px', left: '-2px',
            background: 'linear-gradient(135deg, #2ecc71, #11998e)',
            width: '26px', height: '26px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            border: '1.5px solid #fff'
          }}>
            <Camera size={14} color="#fff" />
          </div>
        </div>
        
        <div className="user-details" style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <h2 style={{ fontSize: '1.5rem', margin: 0, fontWeight: '800' }}>
              {profile.display_name}
            </h2>
            {profile.is_premium && (
              <span style={{
                background: 'linear-gradient(135deg, #ffd700, #ff9800)',
                color: '#000', fontSize: '0.65rem', fontWeight: '900',
                padding: '2px 7px', borderRadius: '8px', letterSpacing: '0.5px'
              }}>
                VIP
              </span>
            )}
          </div>

          <p style={{ color: 'rgba(255,255,255,0.6)', margin: '6px 0 8px 0', fontSize: '0.85rem' }}>
            {profile.gender === 'erkek' ? t('login_male', 'Erkek') : t('login_female', 'Kadın')}
            <span style={{ margin: '0 6px', opacity: 0.4 }}>•</span>
            <span style={{ color: '#2ecc71', fontWeight: '600' }}>{t('profile_active_member')}</span>
          </p>

          {/* Profil Resmini Düzenle Butonu */}
          <div style={{ marginBottom: '10px' }}>
            <button
              onClick={() => setShowPhotoModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                background: 'rgba(255, 215, 0, 0.12)',
                border: '1px solid rgba(255, 215, 0, 0.5)',
                color: '#ffd700',
                fontSize: '0.78rem',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <Camera size={14} />
              <span>{t('host_center_change_photo', 'Profil Resminizi Düzenle')}</span>
            </button>
          </div>
          
          {/* Bakiye Rozeti */}
          {profile.gender === 'erkek' ? (
            <div 
              onClick={() => navigate('/market')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '10px 22px', borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.18), rgba(255, 140, 0, 0.1))',
                border: '1.5px solid rgba(255, 215, 0, 0.4)',
                boxShadow: '0 4px 15px rgba(255, 215, 0, 0.2)',
                cursor: 'pointer'
              }}
            >
              <Coins size={22} color="#ffd700" />
              <span style={{ fontWeight: '900', color: '#ffd700', fontSize: '1.15rem' }}>
                {profile.total_gold} {t('gold_currency_label')}
              </span>
              <ChevronRight size={16} color="rgba(255, 215, 0, 0.7)" />
            </div>
          ) : (
            <div 
              onClick={() => navigate('/wallet')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                padding: '10px 22px', borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.18), rgba(79, 172, 254, 0.1))',
                border: '1.5px solid rgba(0, 242, 254, 0.4)',
                boxShadow: '0 4px 15px rgba(0, 242, 254, 0.2)',
                cursor: 'pointer'
              }}
            >
              <span style={{ fontSize: '1.3rem' }}>💎</span>
              <span style={{ fontWeight: '900', color: '#00f2fe', fontSize: '1.15rem' }}>
                {profile.total_diamonds || 0} {t('diamond_currency_label')}
              </span>
              <ChevronRight size={16} color="rgba(0, 242, 254, 0.7)" />
            </div>
          )}
        </div>
      </header>

      <div style={{ padding: '0 14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* 2. ERKEKLER İÇİN ALTIN MARKETİ / BAYANLAR İÇİN VIP YAYINCI MERKEZİ BANNERI */}
        {profile.gender === 'kadin' ? (
          <div 
            onClick={() => navigate('/host-center')}
            style={{
              background: 'linear-gradient(135deg, #240e3f 0%, #170929 50%, #0d0417 100%)',
              border: '1.8px solid rgba(255, 215, 0, 0.75)',
              borderRadius: '26px', padding: '18px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', position: 'relative', overflow: 'hidden',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7), 0 0 25px rgba(255, 215, 0, 0.25)',
              transition: 'transform 0.2s'
            }}
          >
            {/* Arka Plan Deseni */}
            <div style={{ position: 'absolute', right: '-15px', top: '-15px', opacity: 0.1, pointerEvents: 'none' }}>
              <Coins size={120} color="#ffd700" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', position: 'relative', zIndex: 2 }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '16px',
                background: 'linear-gradient(135deg, #ffd700 0%, #ff8800 60%, #ff416c 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 18px rgba(255, 215, 0, 0.5)',
                flexShrink: 0
              }}>
                <span style={{ fontSize: '1.6rem' }}>👑</span>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', color: '#fff' }}>
                    {t('profile_streamer_center_title', 'VIP Yayıncı Merkezi')}
                  </h3>
                  <span style={{
                    background: 'linear-gradient(135deg, #ffd700, #ff8800)',
                    color: '#000', fontSize: '0.62rem', fontWeight: '900',
                    padding: '2px 7px', borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(255, 215, 0, 0.4)'
                  }}>
                    {t('profile_streamer_center_badge', '👑 VIP STAR')}
                  </span>
                </div>
                <p style={{ margin: '3px 0 0 0', fontSize: '0.76rem', color: 'rgba(255,255,255,0.7)' }}>
                  {t('profile_streamer_center_desc', 'Canlı yayın paneli, dolar kazançların ve çağrı yönetimi')}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: '900', color: '#2ecc71',
                    background: 'rgba(46, 204, 113, 0.18)', padding: '2px 6px', borderRadius: '6px'
                  }}>
                    💵 +50 💎 / dk ($0.75)
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#ffd700', fontWeight: '800' }}>
                    • Stüdyoyu Aç ➔
                  </span>
                </div>
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #ffd700, #ff9800)',
              width: '34px', height: '34px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: '0 4px 15px rgba(255,215,0,0.4)',
              position: 'relative', zIndex: 2
            }}>
              <ChevronRight size={19} color="#000" />
            </div>
          </div>
        ) : (
          /* Erkekler İçin Altın Marketi */
          <div 
            onClick={() => navigate('/market')}
            style={{
              background: 'linear-gradient(135deg, #2b1f0c 0%, #1a1728 50%, #0e0d1a 100%)',
              border: '1.5px solid rgba(255, 215, 0, 0.5)',
              borderRadius: '24px', padding: '18px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', position: 'relative', overflow: 'hidden',
              boxShadow: '0 8px 25px rgba(255, 215, 0, 0.2)'
            }}
          >
            <div style={{ position: 'absolute', right: '-10px', top: '-10px', opacity: 0.12 }}>
              <Coins size={110} color="#ffd700" />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', position: 'relative', zIndex: 2 }}>
              <div style={{
                width: '46px', height: '46px', borderRadius: '16px',
                background: 'linear-gradient(135deg, #ffd700, #ff8800)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)'
              }}>
                <Coins size={24} color="#000" />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '900', color: '#fff' }}>
                    {t('profile_gold_market', 'Altın Marketi')}
                  </h3>
                  <span style={{
                    background: 'linear-gradient(135deg, #ff0844, #ffb199)',
                    color: '#fff', fontSize: '0.62rem', fontWeight: '900',
                    padding: '2px 6px', borderRadius: '6px'
                  }}>
                    {t('market_badge_discount_80')}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.76rem', color: 'rgba(255,255,255,0.65)' }}>
                  {t('profile_gold_card_desc')}
                </p>
              </div>
            </div>

            <div style={{
              background: 'linear-gradient(135deg, #ffd700, #ff9800)',
              width: '32px', height: '32px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, boxShadow: '0 2px 10px rgba(255,215,0,0.4)',
              position: 'relative', zIndex: 2
            }}>
              <ChevronRight size={18} color="#000" />
            </div>
          </div>
        )}



        {/* KADIN KULLANICILAR İÇİN CÜZDAN KARTI */}
        {profile.gender === 'kadin' && (
          <div 
            onClick={() => navigate('/wallet')}
            style={{
              background: 'linear-gradient(135deg, #09203f 0%, #151833 100%)',
              border: '1.5px solid rgba(0, 242, 254, 0.4)',
              borderRadius: '24px', padding: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', boxShadow: '0 8px 25px rgba(0, 242, 254, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '14px',
                background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <WalletIcon size={22} color="#000" />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '800', color: '#fff' }}>
                  {t('profile_wallet_card_title')}
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)' }}>
                  {t('profile_wallet_card_desc')}
                </p>
              </div>
            </div>
            <ChevronRight size={18} color="#00f2fe" />
          </div>
        )}

        {/* 3. KULLANICI İSTATİSTİK TABLOSU */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '18px', padding: '14px 10px', textAlign: 'center'
          }}>
            <Heart size={20} color="#ff2d55" style={{ margin: '0 auto 6px auto' }} />
            <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#fff' }}>
              {profile.total_likes || 0}
            </div>
            <div style={{ fontSize: '0.70rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
              {t('profile_likes')}
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '18px', padding: '14px 10px', textAlign: 'center'
          }}>
            <Flame size={20} color="#ff9800" style={{ margin: '0 auto 6px auto' }} />
            <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#fff' }}>
              {profile.login_streak || 1} {t('profile_days')}
            </div>
            <div style={{ fontSize: '0.70rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
              {t('profile_streak')}
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '18px', padding: '14px 10px', textAlign: 'center'
          }}>
            <Clock size={20} color="#00f2fe" style={{ margin: '0 auto 6px auto' }} />
            <div style={{ fontSize: '1.2rem', fontWeight: '900', color: '#fff' }}>
              {profile.free_extensions ?? 2}
            </div>
            <div style={{ fontSize: '0.70rem', color: 'rgba(255,255,255,0.5)', fontWeight: '600' }}>
              {t('profile_free_extensions')}
            </div>
          </div>
        </div>

        {/* 4. HESAP AYARLARI & AKSİYONLAR */}
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '22px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px'
        }}>
          {/* Dil Değiştir (10 Ülke & Bayrak Seçici) */}
          <button 
            onClick={() => setShowLangModal(true)}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', padding: '12px 16px', borderRadius: '16px',
              fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem' }}>🌐</span>
              <span>{t('profile_switch_lang')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>{i18n.language?.substring(0, 2)}</span>
              <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
            </div>
          </button>

          {/* Beraber Geliştirelim mi? (Şikayet & Öneri Butonu) */}
          <button 
            onClick={() => setShowFeedbackModal(true)}
            style={{
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.12), rgba(255, 107, 107, 0.12))',
              border: '1.5px solid rgba(255, 215, 0, 0.45)',
              color: '#fff', padding: '13px 16px', borderRadius: '16px',
              fontSize: '0.88rem', fontWeight: '800', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              boxShadow: '0 4px 15px rgba(255, 215, 0, 0.08)',
              transition: 'transform 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.25rem' }}>💡</span>
              <span style={{ color: '#ffd700' }}>{t('profile_feedback_btn', 'Beraber Geliştirelim mi? (Şikayet & Öneri)')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                fontSize: '0.70rem',
                background: 'rgba(255, 215, 0, 0.22)',
                color: '#ffd700',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: '800'
              }}>
                {t('profile_feedback_badge', 'Fikir Paylaş')}
              </span>
              <ChevronRight size={16} color="#ffd700" />
            </div>
          </button>

          {/* Engellenen Kullanıcılar (Store Compliance: Bloklananları Yönetme) */}
          <button 
            onClick={handleOpenBlockedModal}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', padding: '12px 16px', borderRadius: '16px',
              fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserX size={18} color="#ff6b6b" />
              <span>{t('profile_blocked_users')}</span>
            </div>
            <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
          </button>

          {/* Sözleşmeler & Gizlilik Politikası (Store Compliance: EULA & Privacy) */}
          <button 
            onClick={() => setLegalModalType('terms')}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', padding: '12px 16px', borderRadius: '16px',
              fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={18} color="#00f2fe" />
              <span>{t('profile_legal_docs')}</span>
            </div>
            <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
          </button>

          {/* İptal ve İade Politikası (Refund Policy) */}
          <button 
            onClick={() => setLegalModalType('refund')}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', padding: '12px 16px', borderRadius: '16px',
              fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <RefreshCw size={18} color="#ffd700" />
              <span>{t('profile_refund_policy', 'İptal ve İade Politikası')}</span>
            </div>
            <ChevronRight size={16} color="rgba(255,255,255,0.4)" />
          </button>



          {/* Gizlilik & Güvenlik Bildirimi */}
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
            padding: '12px 16px', borderRadius: '16px',
            display: 'flex', alignItems: 'center', gap: '10px',
            fontSize: '0.80rem', color: 'rgba(255,255,255,0.6)'
          }}>
            <ShieldCheck size={18} color="#2ecc71" />
            <span>{t('profile_security_shield')}</span>
          </div>
        </div>

        {/* Çıkış Yap Butonu */}
        <button 
          onClick={onLogout} 
          style={{
            background: 'rgba(255, 65, 108, 0.12)', border: '1px solid rgba(255, 65, 108, 0.3)',
            color: '#ff6b6b', padding: '14px', borderRadius: '18px',
            fontSize: '0.92rem', fontWeight: '800', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            marginTop: '8px'
          }}
        >
          <LogOut size={18} />
          <span>{t('profile_logout', 'Çıkış Yap')}</span>
        </button>

        {/* Hesabı Sil Butonu (Apple & Google Mağaza Kuralları Gereği, Dikkat Çekmeyen Sade Tasarım) */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
          <button 
            onClick={() => setShowDeleteModal(true)} 
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.35)',
              padding: '8px 16px',
              fontSize: '0.78rem',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'underline',
              transition: 'color 0.2s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ff4d6d')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.35)')}
          >
            <Trash2 size={13} />
            <span>{t('profile_delete_account')}</span>
          </button>
        </div>

      </div>

      {/* 10 ÜLKE DİL SEÇİM MODALI */}
      {showLangModal && (
        <div 
          onClick={() => setShowLangModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(10px)', zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px', animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #181a33 0%, #0d0e1c 100%)',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '24px', padding: '20px', width: '100%', maxWidth: '380px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={20} color="#00f2fe" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#fff' }}>
                  {t('profile_switch_lang')}
                </h3>
              </div>
              <button 
                onClick={() => setShowLangModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '380px', overflowY: 'auto' }}>
              {COUNTRIES.map((c) => {
                const isSelected = (i18n.language || 'tr').startsWith(c.code);
                return (
                  <button
                    key={c.code}
                    onClick={async () => {
                      i18n.changeLanguage(c.code);
                      setShowLangModal(false);
                      try {
                        await supabase.from('profiles').update({ preferred_language: c.code }).eq('id', userId);
                      } catch (_) {}
                    }}
                    style={{
                      background: isSelected ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255,255,255,0.04)',
                      border: isSelected ? '1.5px solid #00f2fe' : '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '14px', padding: '10px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      cursor: 'pointer', transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={c.flagUrl} alt={c.name} style={{ width: '24px', height: '16px', borderRadius: '3px', objectFit: 'cover' }} />
                      <span style={{ fontSize: '0.90rem', fontWeight: '700', color: isSelected ? '#00f2fe' : '#fff' }}>{c.name}</span>
                    </div>
                    {isSelected && <span style={{ color: '#00f2fe', fontSize: '1rem', fontWeight: '900' }}>✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* HESABI SİL TATLI VE DUYGUSAL ÇİFT ONAY MODALI */}
      {showDeleteModal && (
        <div 
          onClick={() => !isDeleting && setShowDeleteModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)', zIndex: 3100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #1f142b 0%, #120c1a 100%)',
              border: '1.5px solid rgba(255, 117, 140, 0.35)',
              borderRadius: '28px', padding: '26px 22px', width: '100%', maxWidth: '390px',
              boxShadow: '0 20px 60px rgba(255, 107, 139, 0.25)', textAlign: 'center',
              position: 'relative'
            }}
          >
            {/* Tatlı Duygusal Rozet */}
            <div style={{
              width: '74px', height: '74px', borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,107,139,0.2) 0%, rgba(255,107,139,0.05) 100%)',
              border: '2px solid rgba(255, 107, 139, 0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px auto', fontSize: '2.5rem',
              boxShadow: '0 8px 25px rgba(255, 107, 139, 0.25)'
            }}>
              🥺
            </div>

            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.22rem', fontWeight: '800', color: '#fff' }}>
              Aramızdan ayrılıyor musun? 🥺
            </h3>

            <p style={{ margin: '0 0 12px 0', fontSize: '0.92rem', color: '#ff8da1', fontWeight: '700' }}>
              Gitme, buralar sensiz eksik kalır... 💔
            </p>

            <p style={{ margin: '0 0 24px 0', fontSize: '0.84rem', color: 'rgba(255, 255, 255, 0.65)', lineHeight: '1.55' }}>
              Hesabını sildiğinde tüm sohbetlerin, arkadaşlıkların, kalan altınların ve profilin kalıcı olarak silinecektir. Seni çok özleyeceğiz! Gerçekten veda etmek istiyor musun?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Birincil Buton: Vazgeç, Buradayım (Kullanıcıyı tutan tatlı buton) */}
              <button
                disabled={isDeleting}
                onClick={() => setShowDeleteModal(false)}
                style={{
                  background: 'linear-gradient(135deg, #ff4d6d 0%, #ff758c 100%)',
                  border: 'none', color: '#fff', padding: '14px', borderRadius: '18px',
                  fontSize: '0.95rem', fontWeight: '800', cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(255, 77, 109, 0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                }}
              >
                <span>Vazgeç, Buradayım 🥰</span>
              </button>

              {/* İkincil Buton: Evet, Hesabımı Kalıcı Olarak Sil */}
              <button
                disabled={isDeleting}
                onClick={handleDeleteAccount}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 77, 109, 0.25)',
                  color: 'rgba(255, 130, 150, 0.85)', padding: '12px', borderRadius: '16px',
                  fontSize: '0.82rem', fontWeight: '700', cursor: isDeleting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  opacity: isDeleting ? 0.6 : 1
                }}
              >
                {isDeleting ? (
                  <span>Hesap ve veriler siliniyor...</span>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Evet, Hesabımı Kalıcı Olarak Sil</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ENGELLENEN KULLANICILAR MODALI (Store Compliance: Engellenenleri Görme ve Engeli Kaldırma) */}
      {showBlockedModal && (
        <div 
          onClick={() => setShowBlockedModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(10px)', zIndex: 3000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px', animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #181a33 0%, #0d0e1c 100%)',
              border: '1.5px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '24px', padding: '20px', width: '100%', maxWidth: '400px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserX size={20} color="#ff6b6b" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#fff' }}>
                  {t('profile_blocked_users')}
                </h3>
              </div>
              <button 
                onClick={() => setShowBlockedModal(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={16} />
              </button>
            </div>

            {isLoadingBlocked ? (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.6)', fontSize: '0.88rem' }}>
                ...
              </div>
            ) : blockedUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 16px', color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem' }}>
                {t('blocked_list_empty')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                {blockedUsers.map((b) => (
                  <div 
                    key={b.id}
                    style={{
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '14px', padding: '10px 14px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}
                  >
                    <span style={{ fontSize: '0.90rem', fontWeight: '700', color: '#fff' }}>
                      {b.name || b.id.substring(0, 8)}
                    </span>
                    <button
                      onClick={() => handleUnblock(b.id)}
                      style={{
                        background: 'rgba(255, 107, 107, 0.15)', border: '1px solid rgba(255, 107, 107, 0.3)',
                        color: '#ff6b6b', padding: '6px 12px', borderRadius: '10px',
                        fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer'
                      }}
                    >
                      {t('blocked_unblock_btn')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RESMİ HUKUKİ SÖZLEŞMELER & EULA (Apple 1.2 & Google Play Politikaları) */}
      <LegalModal type={legalModalType} onClose={() => setLegalModalType(null)} />

      {/* BERABER GELİŞTİRELİM Mİ? (ŞİKAYET & ÖNERİ MODALI) */}
      <FeedbackModal
        isOpen={showFeedbackModal}
        onClose={() => setShowFeedbackModal(false)}
        userId={userId}
        profile={profile}
      />

      {/* PROFİL RESMİNİZİ DÜZENLE MODALI */}
      {showPhotoModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(5, 5, 16, 0.88)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          zIndex: 10005,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{
            width: '100%', maxWidth: '380px',
            background: 'linear-gradient(165deg, #1b1033 0%, #120b22 55%, #0d071a 100%)',
            border: '1.5px solid rgba(255, 215, 0, 0.5)',
            borderRadius: '24px', padding: '24px 20px',
            position: 'relative', textAlign: 'center',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8), 0 0 30px rgba(255, 215, 0, 0.2)'
          }}>
            <button
              onClick={() => setShowPhotoModal(false)}
              style={{
                position: 'absolute', top: '14px', right: '14px',
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)', border: 'none',
                color: '#fff', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>

            <h3 style={{ margin: '0 0 4px', fontSize: '1.2rem', fontWeight: '900', color: '#fff' }}>
              📸 {t('host_center_change_photo', 'Profil Resminizi Düzenle')}
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>
              Yeni bir fotoğraf seçtiğinizde profil resminiz anında güncellenir.
            </p>

            {/* Mevcut Resim */}
            <div style={{
              width: '130px', height: '130px',
              borderRadius: '50%', margin: '0 auto 18px',
              padding: '3px',
              background: 'linear-gradient(135deg, #ffd700, #ff416c)',
              boxShadow: '0 0 25px rgba(255, 215, 0, 0.35)',
              position: 'relative'
            }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Mevcut Resim"
                  style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ff0844, #ffb199)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '3rem', color: '#fff', fontWeight: '900'
                }}>
                  {profile.display_name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            <input 
              id="profile-photo-input"
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
              onChange={handlePhotoFileChange} 
            />

            {photoError && (
              <div style={{ color: '#ff6b6b', fontSize: '0.78rem', marginBottom: '12px' }}>
                {photoError}
              </div>
            )}

            <label
              htmlFor="profile-photo-input"
              onClick={() => {
                if (!isUploadingPhoto && fileInputRef.current) {
                  fileInputRef.current.click();
                }
              }}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '16px',
                background: isUploadingPhoto 
                  ? '#444' 
                  : 'linear-gradient(135deg, #2ecc71 0%, #11998e 100%)',
                border: 'none',
                color: '#fff',
                fontSize: '0.96rem',
                fontWeight: '900',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                cursor: isUploadingPhoto ? 'wait' : 'pointer',
                boxShadow: '0 6px 20px rgba(46, 204, 113, 0.45)',
                boxSizing: 'border-box',
                userSelect: 'none'
              }}
            >
              <Upload size={18} />
              <span>{isUploadingPhoto ? 'Görsel Güncelleniyor...' : '📁 Galeriden Yeni Fotoğraf Seç'}</span>
            </label>
          </div>
        </div>
      )}

    </div>
  );
}
