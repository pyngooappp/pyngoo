import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { 
  PhoneCall, Sparkles, 
  MapPin, Radio, CheckCircle2,
  Coins, X, AlertTriangle, UserPlus, UserCheck, Eye, Crown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateUUID } from '../utils/uuid';
import { soundManager } from '../utils/SoundManager';
import { 
  toggleFollowStreamer, 
  recordProfileView, 
  subscribeToStreamerGoLive, 
  broadcastStreamerGoLive 
} from '../utils/followService';

interface ExploreProps {
  userId: string;
}

export default function Explore({ userId }: ExploreProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const outletContext = useOutletContext<{
    startDirectCall?: (callId: string, partner: { id: string; name: string }) => void;
    profile?: any;
    onlineUsers?: Set<string>;
  }>() || {};

  const [realFemales, setRealFemales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [languageFilter, setLanguageFilter] = useState<'same' | 'all'>('same');
  const [statusFilter, setStatusFilter] = useState<'all' | 'online' | 'popular'>('all');
  const [callingBotId, setCallingBotId] = useState<string | null>(null);
  const [confirmCallCreator, setConfirmCallCreator] = useState<any | null>(null);
  const [inspectingCreator, setInspectingCreator] = useState<any | null>(null);

  const isFemale = outletContext.profile?.gender === 'kadin' || localStorage.getItem('pyngoo_gender') === 'kadin';

  const [followedSet, setFollowedSet] = useState<Set<string>>(() => {
    try {
      const list = JSON.parse(localStorage.getItem(`pyngoo_user_follows_${userId}`) || '[]');
      return new Set(list);
    } catch (_) {
      return new Set();
    }
  });
  const [liveAlert, setLiveAlert] = useState<{ id: string; name: string; avatar: string } | null>(null);

  useEffect(() => {
    const unsub = subscribeToStreamerGoLive(userId, (streamer) => {
      soundManager.playMatchFound();
      setLiveAlert(streamer);
      setTimeout(() => {
        setLiveAlert((prev) => (prev?.id === streamer.id ? null : prev));
      }, 10000);
    });

    const handleFollowChange = (e: any) => {
      if (e.detail?.followerId === userId) {
        try {
          const list = JSON.parse(localStorage.getItem(`pyngoo_user_follows_${userId}`) || '[]');
          setFollowedSet(new Set(list));
        } catch (_) {}
      }
    };
    window.addEventListener('pyngoo_follow_updated', handleFollowChange);

    return () => {
      unsub();
      window.removeEventListener('pyngoo_follow_updated', handleFollowChange);
    };
  }, [userId]);

  const handleToggleFollow = async (creator: any) => {
    const res = await toggleFollowStreamer(userId, creator.id, creator.name);
    setFollowedSet((prev) => {
      const next = new Set(prev);
      if (res.isFollowing) {
        next.add(creator.id);
        soundManager.playMatchFound();
      } else {
        next.delete(creator.id);
      }
      return next;
    });
  };

  const userGold = outletContext.profile?.total_gold ?? 0;

  const [streamerOnline, setStreamerOnline] = useState(() => localStorage.getItem(`pyngoo_streamer_online_${userId}`) !== 'false');
  const [streamerAvatar, setStreamerAvatar] = useState(() => localStorage.getItem(`pyngoo_streamer_avatar_${userId}`) || '');
  const [streamerStatusMap, setStreamerStatusMap] = useState<Map<string, boolean>>(() => new Map());

  useEffect(() => {
    // Tüm yayıncıların mola / çevrim içi durumlarını ve profil resim değişikliklerini anlık dinle
    const statusChannel = supabase
      .channel('pyngoo_streamer_status_channel')
      .on('broadcast', { event: 'streamer_status_changed' }, (payload: any) => {
        const { userId: sId, isOnline: sOnline } = payload?.payload || {};
        if (sId) {
          setStreamerStatusMap((prev) => {
            const next = new Map(prev);
            next.set(sId, !!sOnline);
            return next;
          });
        }
      })
      .on('broadcast', { event: 'streamer_avatar_changed' }, (payload: any) => {
        const { userId: sId, avatar: sAvatar } = payload?.payload || {};
        if (sId && sAvatar) {
          setRealFemales((prev) =>
            prev.map((f: any) => (f.id === sId ? { ...f, avatar: sAvatar } : f))
          );
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(statusChannel);
    };
  }, []);

  useEffect(() => {
    const handleStatusChange = () => {
      setStreamerOnline(localStorage.getItem(`pyngoo_streamer_online_${userId}`) !== 'false');
      setStreamerAvatar(localStorage.getItem(`pyngoo_streamer_avatar_${userId}`) || '');
    };
    const handleAvatarChange = (e: any) => {
      const { userId: sId, avatar: sAvatar } = e?.detail || {};
      if (sId && sAvatar) {
        setRealFemales((prev) =>
          prev.map((f: any) => (f.id === sId ? { ...f, avatar: sAvatar } : f))
        );
      }
    };
    window.addEventListener('pyngoo_streamer_online_changed', handleStatusChange);
    window.addEventListener('pyngoo_streamer_updated', handleStatusChange);
    window.addEventListener('pyngoo_avatar_updated', handleAvatarChange);
    window.addEventListener('storage', handleStatusChange);
    return () => {
      window.removeEventListener('pyngoo_streamer_online_changed', handleStatusChange);
      window.removeEventListener('pyngoo_streamer_updated', handleStatusChange);
      window.removeEventListener('pyngoo_avatar_updated', handleAvatarChange);
      window.removeEventListener('storage', handleStatusChange);
    };
  }, [userId]);

  const currentLang = (i18n.language || 'tr').split('-')[0].toLowerCase();

  const loadCreators = async () => {
    setLoading(true);
    try {
      // 1. Gerçek kadın profillerini çek (Yayıncıları ve fotoğraflı olanları en başta göster)
      const { data: realUsers } = await supabase
        .from('profiles')
        .select('*')
        .eq('gender', 'kadin')
        .neq('role', 'deleted')
        .neq('is_banned', true)
        .neq('id', 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b')
        .neq('id', '16cd9b54-a051-4548-a3ad-d34f4b5b9ab4')
        .not('display_name', 'ilike', '%silinmiş%')
        .not('display_name', 'ilike', '%silinmis%')
        .not('display_name', 'ilike', '%apoo%')
        .order('total_likes', { ascending: false })
        .limit(30);

      if (realUsers) {
        const filteredFemales = realUsers.filter((u: any) => 
          u.id !== 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b' &&
          u.id !== '16cd9b54-a051-4548-a3ad-d34f4b5b9ab4' &&
          !u.display_name?.toLowerCase().includes('apoo') &&
          u.gender === 'kadin' &&
          u.is_streamer === true &&
          Boolean(u.avatar && !u.avatar.includes('avatar_female') && u.avatar.length > 20)
        );
        setRealFemales(filteredFemales);
      }


    } catch (err) {
      console.warn('Kesfet yukleme hatasi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCreators();

    // Gerçek zamanlı profil silinme / banlanma dinleyicisi (Keşfetten anında anlık düşmesi için)
    const profileChannel = supabase
      .channel('explore_profiles_realtime')
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'profiles' },
        (payload: any) => {
          const deletedId = payload.old?.id;
          if (deletedId) {
            setRealFemales((prev) => prev.filter((u) => u.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload: any) => {
          const updated = payload.new;
          if (updated && (updated.role === 'deleted' || updated.is_banned === true || (updated.display_name || '').toLowerCase().includes('silinmiş'))) {
            setRealFemales((prev) => prev.filter((u) => u.id !== updated.id));
          } else if (updated && updated.gender === 'kadin') {
            setRealFemales((prev) => {
              const idx = prev.findIndex((u) => u.id === updated.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...updated };
                return copy;
              } else {
                return [updated, ...prev];
              }
            });
          }
        }
      )
      .subscribe();

    const handleProfileDeleted = (e: any) => {
      const deletedId = e.detail?.userId;
      if (deletedId) {
        setRealFemales((prev) => prev.filter((u) => u.id !== deletedId));
      }
    };

    const handleBotsChanged = () => {
      loadCreators();
    };

    window.addEventListener('pyngoo_profile_deleted', handleProfileDeleted);
    window.addEventListener('pyngoo_bots_status_changed', handleBotsChanged);
    window.addEventListener('pyngoo_bots_updated', handleBotsChanged);
    window.addEventListener('pyngoo_streamer_updated', handleBotsChanged);
    return () => {
      supabase.removeChannel(profileChannel);
      window.removeEventListener('pyngoo_profile_deleted', handleProfileDeleted);
      window.removeEventListener('pyngoo_bots_status_changed', handleBotsChanged);
      window.removeEventListener('pyngoo_bots_updated', handleBotsChanged);
      window.removeEventListener('pyngoo_streamer_updated', handleBotsChanged);
    };
  }, [userId]);

  // Birleştirilmiş Liste Oluştur
  const combinedList: Array<{
    id: string;
    name: string;
    age: number;
    city: string;
    country: string;
    language: string;
    avatar: string;
    bio: string;
    tags: string[];
    likes: number;
    isOnline: boolean;
    isBusy: boolean;
    isBot: boolean;
    isRealStreamer: boolean;
    isCurrentUser: boolean;
  }> = [];

  // 1. ÖNCE GERÇEK KADIN YAYINCILARI EN ÜSTE EKLE
  const realStreamerCards: typeof combinedList = [];

  // A) Eğer giriş yapan kullanıcı kadın yayıncı ise kendisini en başa yerleştir
  const myIsStreamer = 
    outletContext.profile?.role === 'streamer' ||
    outletContext.profile?.is_streamer || 
    localStorage.getItem(`pyngoo_is_streamer_${userId}`) === 'true' ||
    userId === '95eca0cf-3f6f-4c0f-9778-47760f1cd4c2' ||
    outletContext.profile?.display_name?.toLowerCase().includes('selin');

  const isFemaleStreamerUser = 
    (outletContext.profile?.gender === 'kadin' && (myIsStreamer || outletContext.profile?.avatar || streamerAvatar)) ||
    userId === '95eca0cf-3f6f-4c0f-9778-47760f1cd4c2' ||
    localStorage.getItem(`pyngoo_is_streamer_${userId}`) === 'true';

  if (isFemaleStreamerUser) {
    const myAvatar = 
      streamerAvatar || 
      outletContext.profile?.avatar || 
      (userId ? localStorage.getItem(`pyngoo_streamer_avatar_${userId}`) : null) ||
      (userId ? localStorage.getItem(`pyngoo_avatar_${userId}`) : null) ||
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';

    const myBio = outletContext.profile?.streamer_bio || (userId ? localStorage.getItem(`pyngoo_streamer_bio_${userId}`) : null) || 'Sohbet etmeyi ve eğlenmeyi çok seviyorum 💕';
    realStreamerCards.push({
      id: userId,
      name: outletContext.profile?.display_name?.split(',')[0] || outletContext.profile?.display_name || 'Yayıncı',
      age: 23,
      city: (outletContext.profile?.preferred_language || 'tr').toUpperCase() === 'TR' ? 'İstanbul' : 'Online',
      country: (outletContext.profile?.preferred_language || 'tr').toUpperCase(),
      language: outletContext.profile?.preferred_language || currentLang,
      avatar: myAvatar,
      bio: myBio,
      tags: ['#canlı', '#yeni', '#yayıncı'],
      likes: outletContext.profile?.total_likes || 0,
      isOnline: streamerOnline,
      isBusy: false,
      isBot: false,
      isRealStreamer: true,
      isCurrentUser: true
    });
  }

  // B) Veritabanındaki diğer gerçek kadın yayıncıları ekle
  realFemales.forEach(rf => {
    if (rf.id === userId) return; // Kendi profilimiz zaten en başa eklendi
    if (rf.role === 'bot' || rf.role === 'deleted' || rf.is_banned === true) return;

    const lowerName = (rf.display_name || '').toLowerCase();
    if (lowerName.includes('silinmiş') || lowerName.includes('silinmis')) {
      return;
    }

    // Yayıncı Mola / Çevrim içi kontrolü (Son 90 saniye aktiflik & DB/Map kontrolü)
    const lastActiveTime = rf.last_active_at ? new Date(rf.last_active_at).getTime() : 0;
    const isRecentlyActive = lastActiveTime > 0 && (Date.now() - lastActiveTime) < 90000;

    let isOnline = false;
    if (streamerStatusMap.has(rf.id)) {
      isOnline = streamerStatusMap.get(rf.id)!;
    } else if (rf.is_streamer_online !== undefined && rf.is_streamer_online !== null) {
      isOnline = rf.is_streamer_online === true;
    } else if (outletContext.onlineUsers && outletContext.onlineUsers.has(rf.id)) {
      isOnline = true;
    } else {
      isOnline = isRecentlyActive;
    }
    const localSavedAvatar = localStorage.getItem(`pyngoo_streamer_avatar_${rf.id}`);
    const streamAvatar = rf.avatar || localSavedAvatar || (rf.role === 'streamer' ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80' : 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=500&auto=format&fit=crop&q=80');

    realStreamerCards.push({
      id: rf.id,
      name: rf.display_name?.split(',')[0] || rf.display_name || 'Kullanıcı',
      age: 22,
      city: (rf.preferred_language || 'tr').toUpperCase() === 'TR' ? 'Türkiye' : 'Online',
      country: (rf.preferred_language || 'tr').toUpperCase(),
      language: rf.preferred_language || 'tr',
      avatar: streamAvatar,
      bio: rf.bio || 'Sohbet etmeyi ve yeni insanlarla tanışmayı çok seviyorum ✨',
      tags: ['#sohbet', '#arkadaşlık'],
      likes: rf.total_likes || 0,
      isOnline: isOnline,
      isBusy: false,
      isBot: false,
      isRealStreamer: rf.role === 'streamer' || rf.is_streamer === true,
      isCurrentUser: false
    });
  });

  // Gerçek kullanıcıları sırala: Kullanıcının ülkesine ve diline uyanlar öncelikli!
  realStreamerCards.sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    const aMatch = a.language === currentLang;
    const bMatch = b.language === currentLang;
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return b.likes - a.likes;
  });

  // Gerçek profiller EN ÜSTE yerleşir!
  combinedList.push(...realStreamerCards);

  // Filtreleme
  let filteredList = combinedList.filter(item => {
    // Dil filtresi
    if (languageFilter === 'same') {
      if (item.language !== currentLang && item.language !== 'tr' && currentLang === 'tr') {
        if (item.language !== 'tr') return false;
      } else if (item.language !== currentLang) {
        return false;
      }
    }

    // Durum filtresi
    if (statusFilter === 'online') {
      if (!item.isOnline) return false;
    }

    return true;
  });

  // Popüler veya Çevrim içi sıralaması
  if (statusFilter === 'popular') {
    filteredList = [...filteredList].sort((a, b) => (b.likes || 0) - (a.likes || 0));
  } else if (statusFilter === 'online') {
    filteredList = [...filteredList].sort((a, b) => {
      if (a.isOnline === b.isOnline) return (b.likes || 0) - (a.likes || 0);
      return a.isOnline ? -1 : 1;
    });
  }

  // Arama Onay Modalini Ac
  const handleStartCall = (creator: any) => {
    if (!creator.isOnline && !creator.isBusy) {
      alert(t('streamer_mola_alert', '☕ Yayıncı şu anda molada! Lütfen canlıya geçmesini bekleyin veya daha sonra tekrar deneyin.'));
      return;
    }
    if (creator.isBusy) {
      alert(t('streamer_busy_alert', '🔒 {{name}} şu anda başka bir kullanıcıyla özel görüşmede! Lütfen birkaç dakika sonra tekrar deneyin.', { name: creator.name }));
      return;
    }
    setConfirmCallCreator(creator);
  };

  // Onaylandiktan Sonra Aramayi Baslat
  const executeStartCall = (creator: any) => {
    const callId = generateUUID();
    setCallingBotId(creator.id);
    
    if (outletContext.startDirectCall) {
      outletContext.startDirectCall(callId, {
        id: creator.id,
        name: `${creator.name}, ${creator.age}`
      });
    }

    setTimeout(() => {
      setCallingBotId(null);
    }, 4000);
  };

  const getFlag = (lang: string) => {
    let code = 'tr';
    switch (lang) {
      case 'tr': code = 'tr'; break;
      case 'en': code = 'gb'; break;
      case 'de': code = 'de'; break;
      case 'fr': code = 'fr'; break;
      case 'es': code = 'es'; break;
      case 'ru': code = 'ru'; break;
      case 'ar': code = 'ae'; break;
      case 'az': code = 'az'; break;
      case 'it': code = 'it'; break;
      case 'pt': code = 'br'; break;
      default: code = 'tr'; break;
    }
    return (
      <img
        src={`https://flagcdn.com/w40/${code}.png`}
        width="20"
        height="14"
        alt={code.toUpperCase()}
        style={{ display: 'inline-block', borderRadius: '3px', objectFit: 'cover', verticalAlign: 'middle', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }}
      />
    );
  };

  return (
    <div className="explore-container" style={{
      width: '100%',
      paddingBottom: 'calc(95px + env(safe-area-inset-bottom, 0px))',
      background: 'linear-gradient(180deg, #0b0c16 0%, #121324 100%)',
      color: '#fff'
    }}>
      {/* 🔔 TAKİP EDİLEN YAYINCI CANLIYA GEÇTİ BİLDİRİMİ */}
      {liveAlert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '92%',
          maxWidth: '460px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #1b0e33 0%, #2b124c 100%)',
          border: '2px solid #00e676',
          borderRadius: '20px',
          padding: '12px 16px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.85), 0 0 30px rgba(0, 230, 118, 0.45)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0 }}>
            <img
              src={liveAlert.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500'}
              alt={liveAlert.name}
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #00e676' }}
            />
            <span style={{
              position: 'absolute', bottom: '1px', right: '1px', width: '12px', height: '12px',
              borderRadius: '50%', background: '#00e676', border: '2px solid #1b0e33'
            }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.90rem', fontWeight: '900', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {liveAlert.name}
              </span>
              <span style={{ fontSize: '0.62rem', background: '#00e676', color: '#000', fontWeight: '900', padding: '1px 6px', borderRadius: '8px' }}>
                CANLI
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.76rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.25 }}>
              {t('explore_streamer_online_alert', 'şu an çevrim içi! Hemen ara ve sohbete başla.')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                const target = realFemales.find(f => f.id === liveAlert.id) || {
                  id: liveAlert.id,
                  name: liveAlert.name,
                  avatar: liveAlert.avatar,
                  isOnline: true
                };
                setLiveAlert(null);
                handleStartCall(target);
              }}
              style={{
                background: 'linear-gradient(135deg, #00e676 0%, #00b0ff 100%)',
                border: 'none',
                color: '#000',
                fontWeight: '900',
                fontSize: '0.78rem',
                padding: '8px 12px',
                borderRadius: '12px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: '0 4px 15px rgba(0, 230, 118, 0.4)'
              }}
            >
              {t('explore_call_streamer_now', 'Hemen Ara 🟢')}
            </button>

            <button
              onClick={() => setLiveAlert(null)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: 'rgba(255,255,255,0.6)',
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Hero Header */}
      <div style={{
        padding: '24px 20px 16px 20px',
        background: 'linear-gradient(180deg, rgba(255, 45, 85, 0.12) 0%, rgba(0,0,0,0) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 45, 85, 0.18)',
          border: '1px solid rgba(255, 45, 85, 0.35)',
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '0.8rem',
          fontWeight: '700',
          color: '#ff4d6d',
          marginBottom: '10px'
        }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#00e676', boxShadow: '0 0 8px #00e676',
            display: 'inline-block'
          }}></span>
          <Radio size={14} />
          <span>{t('explore_online_active_count', '{{count}} Çevrim İçi & Aktif', { count: filteredList.length })}</span>
        </div>

        <h1 style={{
          fontSize: '1.65rem',
          fontWeight: '900',
          background: isFemale ? 'linear-gradient(135deg, #ffd700 0%, #ff8800 50%, #ff416c 100%)' : 'linear-gradient(135deg, #ffffff 0%, #ff758c 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: '0 0 6px 0'
        }}>
          {isFemale ? t('explore_female_title', 'Yayıncı Vitrini & Liderler 👑') : t('explore_title')}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.88rem', margin: 0 }}>
          {isFemale ? t('explore_female_subtitle', 'Zirvedeki yıldız yayıncıların vitrinlerini incele, ilham al ve kendi vitrinini #1 sıraya taşı!') : t('explore_subtitle')}
        </p>

        {/* Filtre Butonlari */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginTop: '16px',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Dil Filtresi */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setLanguageFilter('same')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '12px',
                background: languageFilter === 'same' ? 'linear-gradient(135deg, #ff2d55, #ff758c)' : 'rgba(255,255,255,0.06)',
                border: languageFilter === 'same' ? '1px solid #ff2d55' : '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer',
                boxShadow: languageFilter === 'same' ? '0 4px 15px rgba(255,45,85,0.35)' : 'none',
                transition: '0.2s'
              }}
            >
              <span>{getFlag(currentLang)}</span>
              <span>{t('home_filter_lang', 'Benim Dilim')}</span>
            </button>
            <button
              onClick={() => setLanguageFilter('all')}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '8px 14px', borderRadius: '12px',
                background: languageFilter === 'all' ? 'linear-gradient(135deg, #00f2fe, #4facfe)' : 'rgba(255,255,255,0.06)',
                border: languageFilter === 'all' ? '1px solid #00f2fe' : '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer',
                boxShadow: languageFilter === 'all' ? '0 4px 15px rgba(0,242,254,0.35)' : 'none',
                transition: '0.2s'
              }}
            >
              <span>{t('home_filter_all', 'Tum Dunya')}</span>
            </button>
          </div>

          {/* Durum Filtresi */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setStatusFilter('all')}
              style={{
                padding: '6px 12px', borderRadius: '10px',
                background: statusFilter === 'all' ? 'rgba(255,255,255,0.2)' : 'transparent',
                border: '1px solid rgba(255,255,255,0.1)', color: '#fff',
                fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer'
              }}
            >
              {t('explore_filter_all', 'Tumu')}
            </button>
            <button
              onClick={() => setStatusFilter('online')}
              style={{
                padding: '6px 12px', borderRadius: '10px',
                background: statusFilter === 'online' ? 'rgba(0,230,118,0.2)' : 'transparent',
                border: statusFilter === 'online' ? '1px solid #00e676' : '1px solid rgba(255,255,255,0.1)',
                color: statusFilter === 'online' ? '#00e676' : '#fff',
                fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer'
              }}
            >
              {t('explore_filter_online', 'Cevrimici')}
            </button>
            <button
              onClick={() => setStatusFilter('popular')}
              style={{
                padding: '6px 12px', borderRadius: '10px',
                background: statusFilter === 'popular' ? 'rgba(255,160,0,0.2)' : 'transparent',
                border: statusFilter === 'popular' ? '1px solid #ffa000' : '1px solid rgba(255,255,255,0.1)',
                color: statusFilter === 'popular' ? '#ffa000' : '#fff',
                fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer'
              }}
            >
              {t('explore_filter_popular', 'Populer')}
            </button>
          </div>
        </div>
      </div>

      {/* Profil Kartlari Grid */}
      <div style={{
        padding: '16px 14px',
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap: '12px'
      }}>
        {filteredList.map((creator, index) => (
          <div
            key={creator.id}
            style={{
              background: creator.isCurrentUser 
                ? (creator.isOnline 
                    ? 'linear-gradient(180deg, rgba(0, 230, 118, 0.1) 0%, rgba(15, 25, 20, 0.95) 100%)' 
                    : 'linear-gradient(180deg, rgba(120, 120, 130, 0.08) 0%, rgba(20, 20, 28, 0.95) 100%)')
                : (creator.isRealStreamer ? 'linear-gradient(180deg, rgba(255, 65, 108, 0.08) 0%, rgba(20, 15, 30, 0.95) 100%)' : 'rgba(255, 255, 255, 0.04)'),
              borderRadius: '20px',
              border: creator.isCurrentUser 
                ? (creator.isOnline ? '2px solid #00e676' : '2px solid rgba(158, 158, 158, 0.55)') 
                : (creator.isRealStreamer ? '2px solid rgba(255, 65, 108, 0.75)' : '1px solid rgba(255, 255, 255, 0.08)'),
              overflow: 'hidden',
              boxShadow: creator.isCurrentUser 
                ? (creator.isOnline ? '0 0 30px rgba(0, 230, 118, 0.4), 0 10px 30px rgba(0,0,0,0.6)' : '0 6px 20px rgba(0,0,0,0.6)') 
                : (creator.isRealStreamer ? '0 0 30px rgba(255, 65, 108, 0.35), 0 10px 30px rgba(0,0,0,0.6)' : '0 10px 30px rgba(0,0,0,0.4)'),
              display: 'flex',
              flexDirection: 'column',
              transition: 'transform 0.25s ease, box-shadow 0.25s ease',
              cursor: 'pointer'
            }}
            onClick={() => recordProfileView(creator.id)}
          >
            {/* Foto ve Ust Rozetler */}
            <div style={{ position: 'relative', width: '100%', height: '200px', overflow: 'hidden' }}>
              <img
                src={creator.avatar}
                alt={creator.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'top center',
                  display: 'block'
                }}
              />
              <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%)'
              }} />

              {/* Canlı Yayıncı / Online / Mola Rozeti */}
              <div style={{
                position: 'absolute',
                top: '12px',
                left: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: creator.isCurrentUser 
                  ? (creator.isOnline 
                      ? 'linear-gradient(135deg, rgba(0, 230, 118, 0.95), rgba(0, 200, 83, 0.95))' 
                      : 'linear-gradient(135deg, rgba(100, 100, 110, 0.9), rgba(60, 60, 70, 0.9))') 
                  : (creator.isRealStreamer ? 'linear-gradient(135deg, rgba(255, 45, 85, 0.9), rgba(255, 117, 140, 0.9))' : 'rgba(0, 0, 0, 0.65)'),
                backdropFilter: 'blur(10px)',
                padding: '5px 12px',
                borderRadius: '20px',
                border: '1px solid rgba(255,255,255,0.25)',
                fontSize: '0.74rem',
                fontWeight: '800',
                color: '#fff',
                boxShadow: creator.isCurrentUser 
                  ? (creator.isOnline ? '0 2px 12px rgba(0, 230, 118, 0.5)' : '0 2px 10px rgba(0,0,0,0.5)') 
                  : (creator.isRealStreamer ? '0 2px 10px rgba(0,0,0,0.5)' : 'none')
              }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: creator.isCurrentUser 
                    ? (creator.isOnline ? '#fff' : '#bdbdbd') 
                    : (creator.isRealStreamer ? '#fff' : (creator.isOnline ? '#00e676' : (creator.isBusy ? '#ffa000' : '#9e9e9e'))),
                  boxShadow: (creator.isCurrentUser && creator.isOnline) ? '0 0 8px #fff' : 'none'
                }}></span>
                <span>
                  {creator.isCurrentUser 
                    ? (creator.isOnline ? t('streamer_badge_live_active', '🟢 Çevrim İçi') : t('streamer_badge_offline_break', '⚪ Çevrim Dışı')) 
                    : (creator.isOnline ? t('explore_online_badge', 'Çevrim İçi') : (creator.isBusy ? t('explore_busy_badge', 'Görüşmede') : t('explore_offline_badge', 'Çevrim Dışı')))}
                </span>
              </div>

              {/* Ulke Bayragi */}
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                background: 'rgba(0, 0, 0, 0.65)',
                backdropFilter: 'blur(10px)',
                padding: '5px 8px',
                borderRadius: '16px',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {getFlag(creator.language)}
              </div>

              {/* Kart Uzeri Isim, Lokasyon & Yanında Çevrim İçi / Çevrim Dışı Rozeti */}
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '14px',
                right: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                      {creator.name}, {creator.age}
                    </h3>
                    <CheckCircle2 size={17} color={creator.isOnline ? "#00e676" : "#00f2fe"} />
                  </div>

                  {/* Resmin / İsmin Yanındaki Çevrim İçi / Çevrim Dışı Durumu */}
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 9px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: '800',
                    background: creator.isOnline ? 'rgba(0, 230, 118, 0.22)' : 'rgba(0, 0, 0, 0.6)',
                    border: creator.isOnline ? '1px solid #00e676' : '1px solid rgba(255, 255, 255, 0.25)',
                    color: creator.isOnline ? '#00e676' : '#e0e0e0',
                    backdropFilter: 'blur(8px)'
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: creator.isOnline ? '#00e676' : (creator.isRealStreamer ? '#ff9800' : '#9e9e9e'),
                      boxShadow: creator.isOnline ? '0 0 6px #00e676' : 'none'
                    }}></span>
                    <span>
                      {creator.isOnline 
                        ? t('explore_status_online', 'Çevrim içi') 
                        : (creator.isRealStreamer || creator.isCurrentUser ? t('explore_status_break', '☕ Molada') : t('explore_status_offline', 'Çevrim dışı'))}
                    </span>
                  </div>
                </div>

                <div style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  color: 'rgba(255,255,255,0.85)', fontSize: '0.8rem', marginTop: '4px'
                }}>
                  <MapPin size={13} color="#ff2d55" />
                  <span>{creator.city}, {creator.country}</span>
                </div>
              </div>
            </div>

            {/* Kart Gövdesi (Kendi Kartımız için Anında Canlı/Mola Butonu, Diğerleri için Arama ve Takip Butonu) */}
            <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.02)' }}>
              {creator.isCurrentUser ? (
                <button
                  onClick={async () => {
                    const nextOnline = !streamerOnline;
                    setStreamerOnline(nextOnline);
                    localStorage.setItem(`pyngoo_streamer_online_${userId}`, nextOnline ? 'true' : 'false');
                    window.dispatchEvent(new CustomEvent('pyngoo_streamer_online_changed', { detail: { isOnline: nextOnline } }));

                    try {
                      await supabase.from('profiles').update({ is_streamer_online: nextOnline, is_streamer: true }).eq('id', userId);
                    } catch (_) {}

                    try {
                      const statusCh = supabase.channel('pyngoo_streamer_status_channel');
                      statusCh.subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                          statusCh.send({
                            type: 'broadcast',
                            event: 'streamer_status_changed',
                            payload: { userId, isOnline: nextOnline }
                          });
                          setTimeout(() => { try { supabase.removeChannel(statusCh); } catch (_) {} }, 2000);
                        }
                      });
                    } catch (_) {}

                    if (nextOnline) {
                      soundManager.playMatchFound();
                      broadcastStreamerGoLive({
                        id: userId,
                        name: outletContext.profile?.display_name || 'Host',
                        avatar: streamerAvatar || ''
                      });
                      try {
                        await supabase.from('waiting_room').upsert([{ 
                          user_id: userId, 
                          gender: 'kadin',
                          preferred_language: outletContext.profile?.preferred_language || 'tr'
                        }]);
                      } catch (_) {}
                    } else {
                      try {
                        await supabase.from('waiting_room').delete().eq('user_id', userId);
                      } catch (_) {}
                    }
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '13px 18px',
                    borderRadius: '16px',
                    background: streamerOnline 
                      ? 'linear-gradient(135deg, rgba(0, 230, 118, 0.2), rgba(0, 200, 83, 0.25))' 
                      : 'linear-gradient(135deg, rgba(255, 152, 0, 0.2), rgba(255, 87, 34, 0.25))',
                    border: streamerOnline ? '1.5px solid #00e676' : '1.5px solid #ff9800',
                    color: streamerOnline ? '#00e676' : '#ffb74d',
                    fontWeight: '800',
                    fontSize: '0.92rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: streamerOnline ? '0 4px 15px rgba(0, 230, 118, 0.2)' : '0 4px 15px rgba(255, 152, 0, 0.2)'
                  }}
                >
                  {streamerOnline ? (
                    <>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00e676', boxShadow: '0 0 8px #00e676' }}></span>
                      <span>{t('streamer_card_online_you', '🟢 Çevrim İçi (Canlıdasın - Molaya Geç)')}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>{t('streamer_card_break_you', '☕ Moladasın (Tıkla & Canlıya Geç)')}</span>
                    </>
                  )}
                </button>
              ) : isFemale ? (
                /* KADIN KULLANICI İÇİN: Kadınlar birbirini aramaz ve altın harcamaz! Vitrini inceleme & Trend Sıralaması */
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div
                    style={{
                      padding: '11px 13px',
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.16), rgba(255, 170, 0, 0.22))',
                      border: '1.5px solid rgba(255, 215, 0, 0.4)',
                      color: '#ffd700',
                      fontWeight: '800',
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0
                    }}
                  >
                    <Crown size={16} color="#ffd700" />
                    <span>#{index + 1} Trend</span>
                  </div>

                  <button
                    onClick={() => {
                      recordProfileView(creator.id);
                      setInspectingCreator({ ...creator, rank: index + 1 });
                    }}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px 14px',
                      borderRadius: '16px',
                      background: 'linear-gradient(135deg, rgba(255, 45, 85, 0.18), rgba(255, 82, 82, 0.26))',
                      border: '1.5px solid rgba(255, 45, 85, 0.45)',
                      color: '#ff4d6d',
                      fontWeight: '800',
                      fontSize: '0.90rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 14px rgba(255, 45, 85, 0.15)'
                    }}
                  >
                    <Eye size={17} />
                    <span>{t('explore_female_view_showcase', 'Vitrini İncele 👁️')}</span>
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {/* Takip Et / Takip Ediliyor Butonu */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFollow(creator);
                    }}
                    style={{
                      flexShrink: 0,
                      padding: '12px 14px',
                      borderRadius: '16px',
                      background: followedSet.has(creator.id) 
                        ? 'linear-gradient(135deg, rgba(0, 230, 118, 0.18), rgba(0, 200, 83, 0.22))' 
                        : 'rgba(255, 255, 255, 0.08)',
                      border: followedSet.has(creator.id) 
                        ? '1.5px solid #00e676' 
                        : '1px solid rgba(255, 255, 255, 0.2)',
                      color: followedSet.has(creator.id) ? '#00e676' : '#fff',
                      fontWeight: '800',
                      fontSize: '0.80rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      transition: 'all 0.2s ease',
                      boxShadow: followedSet.has(creator.id) ? '0 2px 10px rgba(0, 230, 118, 0.25)' : 'none'
                    }}
                    title={followedSet.has(creator.id) ? t('explore_following_btn', '✓ Takip Ediliyor') : t('explore_follow_btn', '+ Takip Et')}
                  >
                    {followedSet.has(creator.id) ? <UserCheck size={16} /> : <UserPlus size={16} />}
                    <span>{followedSet.has(creator.id) ? t('explore_following_btn', '✓ Takip') : t('explore_follow_btn', '+ Takip')}</span>
                  </button>

                  {/* Hemen Ara Butonu */}
                  <button
                    onClick={() => {
                      recordProfileView(creator.id);
                      handleStartCall(creator);
                    }}
                    disabled={callingBotId === creator.id}
                    style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '13px 14px',
                      borderRadius: '16px',
                      background: creator.isOnline 
                        ? 'linear-gradient(135deg, #ff2d55 0%, #ff5252 100%)' 
                        : (creator.isBusy ? 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)' : 'rgba(255,255,255,0.08)'),
                      border: 'none',
                      color: '#fff',
                      fontWeight: '800',
                      fontSize: '0.94rem',
                      cursor: (!creator.isOnline && !creator.isBusy) ? 'not-allowed' : 'pointer',
                      boxShadow: creator.isOnline ? '0 6px 20px rgba(255, 45, 85, 0.45)' : 'none',
                      transition: '0.2s',
                      opacity: (!creator.isOnline && !creator.isBusy) ? 0.6 : 1
                    }}
                  >
                    <PhoneCall size={17} />
                    <span>
                      {callingBotId === creator.id 
                        ? t('voice_calling', 'Aranıyor...') 
                        : (creator.isOnline ? t('explore_call_btn', 'Hemen Ara') : (creator.isBusy ? t('explore_busy_badge', 'Görüşmede') : (creator.isRealStreamer ? t('explore_status_break', '☕ Molada') : t('explore_status_offline', 'Çevrim dışı'))))}
                    </span>
                    {creator.isOnline && (
                      <span style={{
                        background: 'rgba(0,0,0,0.3)',
                        padding: '2px 7px',
                        borderRadius: '8px',
                        fontSize: '0.72rem',
                        fontWeight: '700',
                        color: '#ffd700',
                        border: '1px solid rgba(255, 215, 0, 0.3)'
                      }}>
                        {t('explore_call_cost_desc', '120 Altin/dk')}
                      </span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredList.length === 0 && !loading && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: 'rgba(255,255,255,0.5)'
        }}>
          <Sparkles size={48} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
          <p>{t('explore_no_results', 'Arama kriterine uygun yayinci bulunamadi.')}</p>
        </div>
      )}

      {/* 120 Altin Arama Onay Modali */}
      {confirmCallCreator && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.82)',
          backdropFilter: 'blur(8px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #1d192e 0%, #120e20 100%)',
            border: '1px solid rgba(255, 45, 85, 0.4)',
            borderRadius: '24px',
            maxWidth: '380px',
            width: '100%',
            overflow: 'hidden',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8), 0 0 35px rgba(255, 45, 85, 0.25)',
            position: 'relative',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            {/* Kapat Butonu */}
            <button
              onClick={() => setConfirmCallCreator(null)}
              style={{
                position: 'absolute',
                top: '14px',
                right: '14px',
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                color: '#fff',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                zIndex: 10
              }}
            >
              <X size={18} />
            </button>

            {/* Modal Icerigi */}
            <div style={{ padding: '26px 22px', textAlign: 'center' }}>
              {/* Creator Profil Resmi */}
              <div style={{ position: 'relative', width: '88px', height: '88px', margin: '0 auto 14px' }}>
                <img
                  src={confirmCallCreator.avatar}
                  alt={confirmCallCreator.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid #ff2d55',
                    boxShadow: '0 0 20px rgba(255, 45, 85, 0.45)'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '2px',
                  right: '2px',
                  background: '#00e676',
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  border: '2px solid #1a1a2e',
                  boxShadow: '0 0 6px #00e676'
                }} />
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 4px', color: '#fff' }}>
                {confirmCallCreator.name}, {confirmCallCreator.age}
              </h3>
              <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.65)', margin: '0 0 16px' }}>
                {confirmCallCreator.city}, {confirmCallCreator.country}
              </p>

              {/* Tarife Kutusu */}
              <div style={{
                background: 'rgba(255, 215, 0, 0.08)',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                borderRadius: '16px',
                padding: '14px',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Coins size={22} color="#ffd700" />
                  <span style={{ fontSize: '1.18rem', fontWeight: '900', color: '#ffd700' }}>
                    120 Altın / Dakika
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: 1.45 }}>
                  Arama başladığında hesabınızdan dakikası <strong>120 Altın</strong> olarak düşülecektir.
                </p>
              </div>

              {/* Bakiye Kutusu */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderRadius: '12px',
                background: 'rgba(255,255,255,0.05)',
                marginBottom: '20px',
                fontSize: '0.85rem'
              }}>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>Mevcut Bakiyeniz:</span>
                <span style={{ fontWeight: '800', color: userGold >= 120 ? '#00e676' : '#ff4d6d' }}>
                  {userGold} Altın
                </span>
              </div>

              {/* Butonlar */}
              {userGold >= 120 ? (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setConfirmCallCreator(null)}
                    style={{
                      flex: 1,
                      padding: '12px',
                      borderRadius: '14px',
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#fff',
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      cursor: 'pointer'
                    }}
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={() => {
                      const creator = confirmCallCreator;
                      setConfirmCallCreator(null);
                      executeStartCall(creator);
                    }}
                    style={{
                      flex: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '12px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #ff2d55 0%, #ff5252 100%)',
                      border: 'none',
                      color: '#fff',
                      fontWeight: '800',
                      fontSize: '0.92rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(255, 45, 85, 0.45)'
                    }}
                  >
                    <PhoneCall size={18} />
                    <span>Aramayı Başlat</span>
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#ff4d6d',
                    fontSize: '0.82rem',
                    marginBottom: '14px',
                    justifyContent: 'center'
                  }}>
                    <AlertTriangle size={16} />
                    <span>Aramayı başlatmak için en az 120 altınınız olmalı.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => setConfirmCallCreator(null)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        borderRadius: '14px',
                        background: 'rgba(255,255,255,0.08)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        cursor: 'pointer'
                      }}
                    >
                      Kapat
                    </button>
                    <button
                      onClick={() => {
                        setConfirmCallCreator(null);
                        navigate('/market');
                      }}
                      style={{
                        flex: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px',
                        borderRadius: '14px',
                        background: 'linear-gradient(135deg, #ffd700 0%, #ffaa00 100%)',
                        border: 'none',
                        color: '#000',
                        fontWeight: '800',
                        fontSize: '0.92rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 15px rgba(255, 215, 0, 0.4)'
                      }}
                    >
                      <Coins size={18} />
                      <span>Altın Yükle</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KADINLAR İÇİN: Yayıncı Vitrini İnceleme Modalı */}
      {inspectingCreator && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.78)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px'
          }}
          onClick={() => setInspectingCreator(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              background: 'linear-gradient(180deg, #1f1b2e 0%, #120f1d 100%)',
              border: '1px solid rgba(255, 45, 85, 0.35)',
              borderRadius: '28px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(255, 45, 85, 0.15)',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            {/* Header / Kapat */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Crown size={20} color="#ffd700" />
                <span style={{ fontWeight: '800', fontSize: '0.96rem', color: '#fff' }}>
                  {t('explore_female_showcase_modal_title', 'Yayıncı Vitrin Detayı')}
                </span>
              </div>
              <button
                onClick={() => setInspectingCreator(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Profil Görseli & Vitrin Bilgileri */}
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <div style={{
                position: 'relative',
                width: '130px',
                height: '130px',
                margin: '0 auto 16px auto'
              }}>
                <img
                  src={inspectingCreator.avatar}
                  alt={inspectingCreator.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: '28px',
                    objectFit: 'cover',
                    border: '3px solid #ff4d6d',
                    boxShadow: '0 8px 25px rgba(255, 45, 85, 0.35)'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '-8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'linear-gradient(135deg, #ffd700 0%, #ff8800 100%)',
                  color: '#000',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.74rem',
                  fontWeight: '900',
                  letterSpacing: '0.5px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                  whiteSpace: 'nowrap'
                }}>
                  👑 #{inspectingCreator.rank || 1} Trend
                </div>
              </div>

              <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#fff', margin: '14px 0 4px 0' }}>
                {inspectingCreator.name}{inspectingCreator.age ? `, ${inspectingCreator.age}` : ''}
              </h3>

              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.06)',
                fontSize: '0.80rem',
                color: 'rgba(255, 255, 255, 0.75)',
                marginBottom: '16px'
              }}>
                <span>{inspectingCreator.country || '🇹🇷'}</span>
                <span>{inspectingCreator.city || 'İstanbul'}</span>
              </div>

              {/* İstatistikler */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                marginBottom: '18px'
              }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '12px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <div style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>
                    {t('creator_followers_label', 'Takipçiler')}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#00e676' }}>
                    👥 {inspectingCreator.followersCount || 0}
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '12px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.08)'
                }}>
                  <div style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '4px' }}>
                    {t('creator_views_label', 'Profil Görüntülenme')}
                  </div>
                  <div style={{ fontSize: '1.05rem', fontWeight: '800', color: '#ffaa00' }}>
                    👁️ {inspectingCreator.profileViews || 0}
                  </div>
                </div>
              </div>

              {/* Bio / Tanıtım */}
              {inspectingCreator.bio && (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '12px 14px',
                  borderRadius: '16px',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  fontSize: '0.86rem',
                  color: 'rgba(255, 255, 255, 0.85)',
                  lineHeight: '1.4',
                  marginBottom: '16px',
                  fontStyle: 'italic',
                  textAlign: 'center'
                }}>
                  "{inspectingCreator.bio}"
                </div>
              )}

              {/* İlham / Tavsiye Kartı */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.12), rgba(255, 140, 0, 0.12))',
                border: '1px solid rgba(255, 215, 0, 0.3)',
                padding: '12px 14px',
                borderRadius: '16px',
                color: '#ffd700',
                fontSize: '0.80rem',
                lineHeight: '1.45',
                textAlign: 'left',
                marginBottom: '18px'
              }}>
                {t('explore_female_showcase_modal_tip', '💡 İpucu: Işıltılı, estetik vitrin fotoğrafları ve samimi bir selamlama cümlen seni Keşfet\'in en tepesine taşır!')}
              </div>

              {/* Kapat Butonu */}
              <button
                onClick={() => setInspectingCreator(null)}
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#fff',
                  fontWeight: '800',
                  fontSize: '0.92rem',
                  cursor: 'pointer',
                  transition: '0.2s'
                }}
              >
                {t('close', 'Kapat')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
