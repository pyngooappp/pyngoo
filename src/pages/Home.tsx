import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Video, Mic } from 'lucide-react';
import VoiceChat from '../components/VoiceChat';
import DailyRewards from '../components/DailyRewards';
import StreamerRecruitmentModal from '../components/StreamerRecruitmentModal';
import { soundManager } from '../utils/SoundManager';
import { useTranslation } from 'react-i18next';
import { generateUUID } from '../utils/uuid';
import { getLocalBlockedIds } from '../utils/blockService';
import PrivacyShield from '../components/PrivacyShield';
import LivePulseCounter from '../components/LivePulseCounter';

interface HomeProps {
  userId: string;
}

export default function Home({ userId }: HomeProps) {
  const { t, i18n } = useTranslation();
  const outletContext = useOutletContext<{ setIsCallActive?: (active: boolean) => void }>() || {};
  const [isSearching, setIsSearching] = useState(false);
  const [activeMatch, setActiveMatch] = useState<string | null>(null);

  useEffect(() => {
    outletContext.setIsCallActive?.(!!activeMatch);
    return () => {
      outletContext.setIsCallActive?.(false);
    };
  }, [activeMatch, outletContext]);
  const [chatMode, setChatMode] = useState<'video' | 'voice'>('video');
  const [profile, setProfile] = useState<any>(() => {
    try {
      const cached = localStorage.getItem(`pyngoo_user_profile_${userId}`);
      if (cached) return JSON.parse(cached);
    } catch (_) {}
    const savedGender = localStorage.getItem('pyngoo_gender') || localStorage.getItem('pending_gender');
    if (savedGender === 'kadin') {
      return {
        id: userId,
        gender: 'kadin',
        role: 'streamer',
        display_name: localStorage.getItem('pyngoo_nickname') || 'Yayıncı',
        total_gold: 100,
        free_extensions: 5
      };
    }
    return null;
  });
  const [micError, setMicError] = useState(false);
  const [mediaErrorType, setMediaErrorType] = useState<'not_found_video' | 'not_found_audio' | 'in_use' | 'denied' | null>(null);
  const [languageFilter, setLanguageFilter] = useState<'all' | 'same'>('same');
  
  // Eşleşme Öncesi Onay Ekranı State'leri
  const [pendingMatchData, setPendingMatchData] = useState<{matchId: string, partnerId: string} | null>(null);
  const [hasAccepted, setHasAccepted] = useState(false);
  const [partnerAccepted, setPartnerAccepted] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [rejectMessage, setRejectMessage] = useState<string | null>(null);
  const pendingChannelRef = useRef<any>(null);

  // Günlük Ödül & Yayıncı Modalı State
  const [showDailyRewards, setShowDailyRewards] = useState(false);
  const [showStreamerModal, setShowStreamerModal] = useState(false);

  // Kadın Yayıncı Mola Uyarısı State & Canlıya Geçme
  const [streamerOnline, setStreamerOnline] = useState(() => localStorage.getItem(`pyngoo_streamer_online_${userId}`) !== 'false');
  const [dismissBreakAlert, setDismissBreakAlert] = useState(false);
  const [justWentLive, setJustWentLive] = useState(false);

  useEffect(() => {
    const handleStatus = () => {
      setStreamerOnline(localStorage.getItem(`pyngoo_streamer_online_${userId}`) !== 'false');
    };
    window.addEventListener('pyngoo_streamer_online_changed', handleStatus);
    window.addEventListener('storage', handleStatus);
    return () => {
      window.removeEventListener('pyngoo_streamer_online_changed', handleStatus);
      window.removeEventListener('storage', handleStatus);
    };
  }, [userId]);

  const syncStreamerStatusToNetwork = async (isLive: boolean) => {
    try {
      const statusCh = supabase.channel('pyngoo_streamer_status_channel');
      statusCh.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          statusCh.send({
            type: 'broadcast',
            event: 'streamer_status_changed',
            payload: { userId, isOnline: isLive }
          });
          setTimeout(() => { try { supabase.removeChannel(statusCh); } catch (_) {} }, 2000);
        }
      });
    } catch (_) {}
    try {
      await supabase.from('profiles').update({ is_streamer_online: isLive, is_streamer: true }).eq('id', userId);
    } catch (_) {}
  };

  const handleGoLiveImmediately = async () => {
    if (!hasStreamerActivated) {
      setShowStreamerModal(true);
      return;
    }
    localStorage.setItem(`pyngoo_streamer_online_${userId}`, 'true');
    setStreamerOnline(true);
    setJustWentLive(true);
    window.dispatchEvent(new CustomEvent('pyngoo_streamer_online_changed', { detail: { isOnline: true } }));
    soundManager.playMatchFound();
    syncStreamerStatusToNetwork(true);
    try {
      await supabase.from('waiting_room').upsert([{ 
        user_id: userId, 
        gender: 'kadin',
        preferred_language: profile?.preferred_language || 'tr'
      }]);
    } catch (_) {}
    setTimeout(() => setJustWentLive(false), 4500);
  };

  const isOmer = userId === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b';
  const isApoo = userId === '16cd9b54-a051-4548-a3ad-d34f4b5b9ab4';

  const isKadin = !isOmer && !isApoo && (
    profile?.gender 
      ? profile.gender === 'kadin'
      : (localStorage.getItem('pyngoo_gender') === 'kadin' || localStorage.getItem('pending_gender') === 'kadin')
  );

  // Gerçekten yayıncı olmuş mu (fotoğrafını yükleyip aktif etmiş mi)?
  const hasStreamerActivated = isKadin && (
    Boolean(localStorage.getItem(`pyngoo_streamer_avatar_${userId}`)) ||
    Boolean(profile?.avatar && !profile.avatar.includes('avatar_female') && profile.avatar.length > 20) ||
    userId === '95eca0cf-3f6f-4c0f-9778-47760f1cd4c2' ||
    profile?.display_name?.toLowerCase().includes('selin')
  );

  const isFemaleStreamer = isKadin && hasStreamerActivated;

  const currentLang = i18n.language.substring(0, 2);

  // KULLANICI KURALI:
  // "kadın bu gün yayıncı olursa artık ona yayıncı ol ekranı gelmesin ama eğer yayıncı olmazsa programa her girişinde hatırlatalım 1 kere"
  useEffect(() => {
    if (isKadin && !hasStreamerActivated) {
      const alreadyPrompted = sessionStorage.getItem(`pyngoo_streamer_modal_prompted_${userId}`) === 'true';
      if (!alreadyPrompted) {
        const timer = setTimeout(() => {
          setShowStreamerModal(true);
          sessionStorage.setItem(`pyngoo_streamer_modal_prompted_${userId}`, 'true');
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [isKadin, hasStreamerActivated, userId]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (data) {
          const isThisOmer = userId === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b';
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
          }
          setProfile(data);
          localStorage.setItem(`pyngoo_user_profile_${userId}`, JSON.stringify(data));
          if (data.gender && !isThisOmer) localStorage.setItem('pyngoo_gender', data.gender);
          
          if (data.gender === 'kadin' && !isThisOmer) {
            setShowDailyRewards(false);

            const isAlreadyActive = Boolean(
              localStorage.getItem(`pyngoo_streamer_avatar_${userId}`) ||
              data.avatar ||
              data.is_streamer === true ||
              userId === '95eca0cf-3f6f-4c0f-9778-47760f1cd4c2' ||
              data.display_name?.toLowerCase().includes('selin')
            );

            if (!isAlreadyActive) {
              const alreadyPrompted = sessionStorage.getItem(`pyngoo_streamer_modal_prompted_${userId}`) === 'true';
              if (!alreadyPrompted) {
                setTimeout(() => {
                  setShowStreamerModal(true);
                  sessionStorage.setItem(`pyngoo_streamer_modal_prompted_${userId}`, 'true');
                }, 300);
              }
            }
          } else {
            // Erkek kullanıcılarda normal günlük ödül kontrolü
            const lastReward = data.last_reward_date ? new Date(data.last_reward_date) : null;
            const today = new Date();
            const hasClaimedToday = lastReward && lastReward.toDateString() === today.toDateString();
            if (!hasClaimedToday) {
              setShowDailyRewards(true);
            }
          }
        } else {
          if (isKadin) {
            setShowDailyRewards(false);
            const isAlreadyActive = Boolean(
              localStorage.getItem(`pyngoo_streamer_avatar_${userId}`) ||
              profile?.avatar ||
              profile?.is_streamer === true
            );
            if (!isAlreadyActive) {
              const alreadyPrompted = sessionStorage.getItem(`pyngoo_streamer_modal_prompted_${userId}`) === 'true';
              if (!alreadyPrompted) {
                setTimeout(() => {
                  setShowStreamerModal(true);
                  sessionStorage.setItem(`pyngoo_streamer_modal_prompted_${userId}`, 'true');
                }, 300);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Home fetchProfile error:', err);
      }
    };
    fetchProfile();
  }, [userId, isKadin]);

  // Dinleme Mantığı: Eğer aranıyor modundaysak match_history'yi dinle
  useEffect(() => {
    if (!isSearching) return;

    const channel = supabase
      .channel(`public:match_history`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'match_history',
        filter: `receiver_id=eq.${userId}` 
      }, (payload: any) => {
        // Doğrudan aramalar (Keşfet/Mesajlar) Layout tarafından karşılanır, burada atla
        if (payload?.new?.status === 'direct_pending') {
          return;
        }

        // Biri bizi bulup eşleşme yarattı!
        const callerId = payload.new.caller_id;
        const blockedIds = getLocalBlockedIds();
        if (blockedIds.includes(callerId)) {
          // Engellenen kullanıcı ile eşleşmeyi engelle
          return;
        }

        soundManager.playMatchFound();
        setPendingMatchData({
          matchId: payload.new.match_id,
          partnerId: payload.new.caller_id
        });
        setCountdown(10);
        setHasAccepted(false);
        setPartnerAccepted(false);
        setIsSearching(false);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isSearching, userId]);

  // Sayfa kapanırsa (veya başka sekmeye geçilirse) sesi kapat
  useEffect(() => {
    return () => {
      soundManager.stopRadar();
    };
  }, []);

  // ----------------------------------------------------
  // Ön Onay (Bağlan/Geç) Senkronizasyon ve Sayaç
  // ----------------------------------------------------
  useEffect(() => {
    if (!pendingMatchData) return;
    const mId = pendingMatchData.matchId;

    // 1. Veritabanı seviyesinde UPDATE dinle (Kesintisiz güvenilirlik)
    const historySub = supabase.channel(`pending_match_status_${mId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'match_history',
        filter: `match_id=eq.${mId}`
      }, (payload: any) => {
        const st = payload?.new?.status;
        if (st === 'active' || st === 'accepted') {
          setPartnerAccepted(true);
        } else if (st === 'rejected') {
          setRejectMessage(t('match_rejected'));
          setTimeout(() => {
            setRejectMessage(null);
            setPendingMatchData(null);
            setHasAccepted(false);
            setPartnerAccepted(false);
          }, 2000);
        }
      })
      .subscribe();

    // 2. Broadcast kanalı (Hızlı eş zamanlı iletim)
    pendingChannelRef.current = supabase.channel(`pending_room_${mId}`)
      .on('broadcast', { event: 'accept' }, () => {
        setPartnerAccepted(true);
      })
      .on('broadcast', { event: 'reject' }, () => {
        setRejectMessage(t('match_rejected'));
        setTimeout(() => {
          setRejectMessage(null);
          setPendingMatchData(null);
          setHasAccepted(false);
          setPartnerAccepted(false);
        }, 2000);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(historySub);
      if (pendingChannelRef.current) {
        supabase.removeChannel(pendingChannelRef.current);
      }
    };
  }, [pendingMatchData, t]);

  useEffect(() => {
    if (hasAccepted && partnerAccepted && pendingMatchData) {
      setActiveMatch(pendingMatchData.matchId);
      setPendingMatchData(null);
      setHasAccepted(false);
      setPartnerAccepted(false);
    }
  }, [hasAccepted, partnerAccepted, pendingMatchData]);

  useEffect(() => {
    if (!pendingMatchData || rejectMessage) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleReject(); // Otomatik reddet
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [pendingMatchData, rejectMessage]);

  const handleAccept = async () => {
    if (!pendingMatchData) return;
    setHasAccepted(true);
    const mId = pendingMatchData.matchId;

    // 1. Veritabanında eşleşmeyi 'active' olarak güncelle
    try {
      await supabase.from('match_history').update({ status: 'active' }).eq('match_id', mId);
    } catch (_) {}

    // 2. Broadcast kanalına 'accept' sinyali gönder
    if (pendingChannelRef.current) {
      try {
        pendingChannelRef.current.send({
          type: 'broadcast',
          event: 'accept',
        });
      } catch (_) {}
    }

    // 3. KESİN BAĞLANTI ZAMANLAYICISI:
    // Kullanıcı "Bağlan" dediğinde en geç 1 saniye içinde odaya girip görüşmeyi başlatır.
    // Asla "Bağlanıyor..." yazısında takılı kalmaz!
    setTimeout(() => {
      setActiveMatch(mId);
      setPendingMatchData(null);
      setHasAccepted(false);
      setPartnerAccepted(false);
    }, 1000);
  };

  const handleReject = async () => {
    if (!pendingMatchData) return;
    const mId = pendingMatchData.matchId;
    try {
      await supabase.from('match_history').update({ status: 'rejected' }).eq('match_id', mId);
    } catch (_) {}
    if (pendingChannelRef.current) {
      try {
        pendingChannelRef.current.send({
          type: 'broadcast',
          event: 'reject',
        });
      } catch (_) {}
    }
    setPendingMatchData(null);
    setHasAccepted(false);
    setPartnerAccepted(false);
  };
  // ----------------------------------------------------

  const cancelSearch = async () => {
    soundManager.stopRadar();
    setIsSearching(false);
    await supabase.from('waiting_room').delete().eq('user_id', userId);
  };

  const checkMediaPermissions = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMediaErrorType('denied');
      setMicError(true);
      return false;
    }

    try {
      const constraints = chatMode === 'video' ? { audio: true, video: true } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach(track => track.stop());
      setMicError(false);
      setMediaErrorType(null);
      return true;
    } catch (error: any) {
      console.error("Medya izni hatası:", error);
      setMicError(true);
      if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
        setMediaErrorType(chatMode === 'video' ? 'not_found_video' : 'not_found_audio');
      } else if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
        setMediaErrorType('in_use');
      } else {
        setMediaErrorType('denied');
      }
      return false;
    }
  };

  const startSearching = async () => {
    // 1. Dokunma anında SESİ VE RADARI ANINDA SENKRON BAŞLAT (iOS gesture kilidini anında kırar)
    soundManager.startRadar();
    setIsSearching(true);

    const hasPermission = await checkMediaPermissions();
    if (!hasPermission || !profile) {
      soundManager.stopRadar();
      setIsSearching(false);
      return;
    }
    
    try {
      // 1. Bekleyen biri var mı diye kontrol et
      let query = supabase
        .from('waiting_room')
        .select('user_id, gender')
        .neq('user_id', userId)
        .order('joined_at', { ascending: true });

      // Azar Mantığı Algoritması (GEÇİCİ OLARAK TEST İÇİN DEVRE DIŞI BIRAKILDI)
      // Test aşamasında rahat eşleşebilin diye herkes herkesi %100 bulacak.
      /*
      const rand = Math.floor(Math.random() * 100) + 1; // 1-100 arası sayı

      if (profile.gender === 'erkek') {
        if (!profile.is_premium) {
          if (rand <= 85) query = query.eq('gender', 'erkek');
          else query = query.eq('gender', 'kadin');
        } else {
          if (rand <= 80) query = query.eq('gender', 'kadin');
          else query = query.eq('gender', 'erkek');
        }
      }
      */

      // Dil filtresi
      if (languageFilter === 'same') {
        query = query.eq('preferred_language', currentLang);
      }

      const { data: waitingUsers } = await query.limit(10);
      const blockedIds = getLocalBlockedIds();
      const validWaitingUsers = (waitingUsers || []).filter(u => !blockedIds.includes(u.user_id));

      if (validWaitingUsers.length > 0) {
        // Eşleşme bulundu!
        soundManager.playMatchFound();
        const partnerId = validWaitingUsers[0].user_id;
        const matchId = generateUUID();
        
        // Onu bekleme odasından sil
        await supabase.from('waiting_room').delete().eq('user_id', partnerId);
        
        // Yeni bir match_history kaydı oluştur
        await supabase.from('match_history').insert([{
          match_id: matchId,
          caller_id: userId,
          receiver_id: partnerId,
          status: 'pending'
        }]);
        
        setPendingMatchData({ matchId, partnerId });
        setCountdown(10);
        setHasAccepted(false);
        setPartnerAccepted(false);
        setIsSearching(false);
      } else {
        // Bekleyen kimse yok (ya da kritere uyan yok), biz bekleme odasına girelim
        await supabase.from('waiting_room').upsert([{ 
          user_id: userId, 
          gender: profile?.gender || (isKadin ? 'kadin' : 'erkek'),
          preferred_language: currentLang
        }]);
      }
    } catch (err) {
      console.error('Eşleşme hatası:', err);
      soundManager.stopRadar();
      setIsSearching(false);
    }
  };

  const handleEndCall = () => {
    setActiveMatch(null);
  };

  const handleSkip = () => {
    setActiveMatch(null);
    // Kısa bir gecikme ile hemen yeni arama başlat (kullanıcıya pürüzsüz bir geçiş hissi vermek için)
    setTimeout(() => {
      startSearching();
    }, 300);
  };

  // Aktif bir eşleşme varsa sesli/görüntülü sohbet ekranını göster (Eşleşme ekranında kullanıcılar video/ekran kaydı alabilir)
  if (activeMatch) {
    return (
      <PrivacyShield activeUserId={userId} enabled={false}>
        <VoiceChat channelName={activeMatch} mode={chatMode} onEndCall={handleEndCall} onSkip={handleSkip} userId={userId} />
      </PrivacyShield>
    );
  }

  return (
    <div className="home-container" style={{ paddingBottom: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      
      {/* Günlük Ödül Pop-up'ı */}
      {showDailyRewards && profile && (
        <DailyRewards 
          profile={profile} 
          onClose={() => {
            setShowDailyRewards(false);
            if (profile.gender === 'kadin' && !profile.is_streamer && !localStorage.getItem(`pyngoo_streamer_dismissed_${userId}`)) {
              setTimeout(() => setShowStreamerModal(true), 400);
            }
          }} 
          onClaimSuccess={(newProfile) => {
            setProfile(newProfile);
            setShowDailyRewards(false);
            if (newProfile.gender === 'kadin' && !newProfile.is_streamer && !localStorage.getItem(`pyngoo_streamer_dismissed_${userId}`)) {
              setTimeout(() => setShowStreamerModal(true), 500);
            }
          }} 
        />
      )}

      {/* Kadın Kullanıcılar İçin Göz Alıcı Yayıncı Ol & Para Kazan Modalı */}
      <StreamerRecruitmentModal
        isOpen={showStreamerModal}
        onClose={() => setShowStreamerModal(false)}
        userId={userId}
        profile={profile}
        onStreamerActivated={(newProf) => {
          setProfile(newProf);
        }}
      />

      {/* Onay Pop-up'ı (Bağlan/Geç) - Yayıncı Kadınlarda Ultra Cazip VIP Çağrı Kartı */}
      {pendingMatchData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5, 5, 16, 0.92)', backdropFilter: 'blur(16px)', zIndex: 10005, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', animation: 'fadeIn 0.3s ease' }}>
          <div style={{
            background: isFemaleStreamer 
              ? 'linear-gradient(165deg, #1d1038 0%, #120b22 55%, #0d071a 100%)' 
              : '#1a1a2e',
            border: isFemaleStreamer 
              ? '2px solid rgba(46, 204, 113, 0.8)' 
              : '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '26px',
            padding: '28px 22px',
            textAlign: 'center',
            maxWidth: '430px',
            width: '100%',
            boxShadow: isFemaleStreamer 
              ? '0 20px 60px rgba(0, 0, 0, 0.9), 0 0 40px rgba(46, 204, 113, 0.35)' 
              : '0 20px 60px rgba(0, 0, 0, 0.8)',
            color: '#fff',
            position: 'relative'
          }}>
            {rejectMessage ? (
              <h3 style={{ color: '#ff6b6b', animation: 'fadeIn 0.3s ease' }}>{rejectMessage}</h3>
            ) : (
              <div style={{ animation: 'fadeIn 0.3s ease' }}>
                {isFemaleStreamer ? (
                  <>
                    {/* VIP Çağrı Rozeti */}
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 15px',
                      borderRadius: '20px',
                      background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.25), rgba(46, 204, 113, 0.25))',
                      border: '1px solid #ffd700',
                      color: '#ffd700',
                      fontSize: '0.74rem',
                      fontWeight: '900',
                      marginBottom: '12px',
                      boxShadow: '0 0 16px rgba(255, 215, 0, 0.3)'
                    }}>
                      <span>{t('streamer_incoming_call_badge', '🔥 VIP ERKEK ÜYE ARIYOR')}</span>
                    </div>

                    <h2 style={{ fontSize: '1.45rem', fontWeight: '900', margin: '0 0 8px', color: '#fff' }}>
                      {t('streamer_incoming_call_title', 'Gelen Canlı Görüntülü Arama! 📞')}
                    </h2>

                    {/* Arayan Kullanıcı Kartı */}
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '18px',
                      padding: '12px 14px',
                      margin: '0 auto 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      textAlign: 'left'
                    }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.4rem',
                        boxShadow: '0 0 15px rgba(0, 242, 254, 0.4)'
                      }}>
                        👨
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '900', fontSize: '0.98rem', color: '#fff' }}>
                          Canlı Kullanıcı (Erkek)
                        </div>
                        <div style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.65)', marginTop: '2px' }}>
                          ⭐ VIP Seviye Üye • Türkiye
                        </div>
                      </div>
                    </div>

                    {/* Net Kazanç Bildirimi */}
                    <div style={{
                      background: 'rgba(46, 204, 113, 0.14)',
                      border: '1px solid rgba(46, 204, 113, 0.5)',
                      borderRadius: '16px',
                      padding: '12px 14px',
                      marginBottom: '16px',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px'
                    }}>
                      <span style={{ fontSize: '1.5rem' }}>💵</span>
                      <div style={{ fontSize: '0.78rem', color: '#e8f8f0', lineHeight: '1.4', fontWeight: '700' }}>
                        {t('streamer_call_earning_note', 'Bu görüşmede kaldığın her dakika hesabına +50 Elmas ($0.75 / 25₺) eklenecek!')}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 style={{ color: 'white', marginBottom: '10px' }}>{t('match_found_title')}</h2>
                    <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '20px' }}>{t('match_found_desc')}</p>
                  </>
                )}
                
                <div style={{
                  fontSize: isFemaleStreamer ? '2.4rem' : '3rem',
                  fontWeight: '900',
                  color: countdown <= 3 ? '#ff416c' : (isFemaleStreamer ? '#2ecc71' : '#00f2fe'),
                  marginBottom: '18px',
                  transition: 'color 0.3s ease'
                }}>
                  00:0{countdown}
                </div>
                
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    onClick={handleReject}
                    style={{
                      padding: '14px 20px',
                      borderRadius: '16px',
                      background: 'rgba(255, 255, 255, 0.08)',
                      color: 'white',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      fontWeight: '800',
                      cursor: 'pointer',
                      transition: '0.2s'
                    }}
                  >
                    {isFemaleStreamer ? t('streamer_decline_call', 'Reddet 🔴') : t('match_skip')}
                  </button>
                  <button 
                    onClick={handleAccept}
                    disabled={hasAccepted}
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: '16px',
                      background: hasAccepted 
                        ? 'rgba(46, 204, 113, 0.3)' 
                        : (isFemaleStreamer ? 'linear-gradient(135deg, #2ecc71, #11998e)' : 'linear-gradient(135deg, #11998e, #38ef7d)'),
                      color: 'white',
                      border: 'none',
                      fontWeight: '900',
                      cursor: hasAccepted ? 'default' : 'pointer',
                      boxShadow: hasAccepted ? 'none' : '0 6px 25px rgba(46, 204, 113, 0.5)'
                    }}
                  >
                    {hasAccepted ? t('match_waiting') : (isFemaleStreamer ? t('streamer_accept_call', 'KABUL ET (+50 Elmas/dk) 🟢') : t('match_connect'))}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <main className="home-main" style={{ width: '100%' }}>
        {isSearching ? (
          <div className="searching-state">
            <div className="radar-container">
              {/* Dönen Radar Çizgisi */}
              <div className="radar-sweep"></div>
              
              {/* Genişleyen Dalga Efektleri */}
              <div className="radar-ripple"></div>
              <div className="radar-ripple"></div>
              <div className="radar-ripple"></div>
              
              {/* Ortadaki Kullanıcı Avatarı */}
              <div className="radar-center-avatar">
                {profile?.display_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>

              {/* Bulunup kaybolan sahte hedefler (Kullanıcının karşı cinsine göre) */}
              <div className="floating-avatar" style={{ top: '10%', left: '20%', animationDelay: '0s' }}>
                {isKadin ? '👨' : '👩'}
              </div>
              <div className="floating-avatar" style={{ top: '70%', left: '80%', animationDelay: '1.5s' }}>
                {isKadin ? '👱‍♂️' : '👱‍♀️'}
              </div>
              <div className="floating-avatar" style={{ top: '80%', left: '25%', animationDelay: '2.5s' }}>
                {isKadin ? '👨‍🦱' : '👩‍🦰'}
              </div>
              <div className="floating-avatar" style={{ top: '25%', left: '75%', animationDelay: '3.5s' }}>
                {isKadin ? '👦' : '👧'}
              </div>
            </div>
            
            <h3>{t('home_searching')}</h3>
            <p>{t('home_scanning', { gender: isKadin ? t('login_male') : t('login_female') })}</p>
            
            <button onClick={cancelSearch} className="cancel-btn" style={{ marginTop: '10px' }}>
              {t('home_cancel')}
            </button>
          </div>
        ) : (
          <div className="match-prompt">
            <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              {/* KADIN YAYINCI GİRİŞİNDE MOLA UYARISI BANNERI */}
              {isFemaleStreamer && !streamerOnline && !dismissBreakAlert && (
                <div style={{
                  width: '100%',
                  maxWidth: '460px',
                  margin: '0 auto 12px auto',
                  padding: '16px 18px',
                  borderRadius: '22px',
                  background: 'linear-gradient(135deg, rgba(255, 152, 0, 0.16) 0%, rgba(255, 65, 108, 0.14) 50%, rgba(20, 20, 32, 0.95) 100%)',
                  border: '1.5px solid rgba(255, 152, 0, 0.65)',
                  boxShadow: '0 10px 30px rgba(255, 152, 0, 0.25)',
                  position: 'relative',
                  backdropFilter: 'blur(16px)',
                  textAlign: 'left'
                }}>
                  <button
                    onClick={() => setDismissBreakAlert(true)}
                    style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      background: 'rgba(255, 255, 255, 0.12)',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.75)',
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.85rem'
                    }}
                    title="Kapat"
                  >
                    ✕
                  </button>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #ff9800, #ff5722)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.45rem',
                      flexShrink: 0,
                      boxShadow: '0 4px 15px rgba(255, 152, 0, 0.45)'
                    }}>
                      ☕
                    </div>

                    <div style={{ flex: 1, paddingRight: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '1rem', fontWeight: '900', color: '#fff' }}>
                          {t('streamer_break_title', 'Şu an moladasın!')}
                        </span>
                        <span style={{
                          fontSize: '0.68rem',
                          padding: '2px 8px',
                          borderRadius: '8px',
                          background: 'rgba(255, 152, 0, 0.25)',
                          border: '1px solid rgba(255, 152, 0, 0.55)',
                          color: '#ffb74d',
                          fontWeight: '800'
                        }}>
                          {t('streamer_break_tag', 'Çevrim Dışı')}
                        </span>
                      </div>

                      <p style={{
                        margin: '0 0 12px 0',
                        fontSize: '0.82rem',
                        color: 'rgba(255, 255, 255, 0.85)',
                        lineHeight: '1.4'
                      }}>
                        {t('streamer_break_desc', 'Aramaları kabul etmek ve Keşfet vitrininde en üstte çevrim içi görünmek için hemen canlıya geç.')}
                      </p>

                      <button
                        onClick={handleGoLiveImmediately}
                        style={{
                          width: '100%',
                          padding: '11px 16px',
                          borderRadius: '14px',
                          background: 'linear-gradient(135deg, #00e676 0%, #00b0ff 100%)',
                          border: 'none',
                          color: '#061727',
                          fontWeight: '900',
                          fontSize: '0.94rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: '0 6px 22px rgba(0, 230, 118, 0.45)',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: '#061727',
                          boxShadow: '0 0 8px rgba(6, 23, 39, 0.8)'
                        }}></span>
                        <span>{t('streamer_go_live_btn', '🟢 Canlıya Geç (Hemen Başla)')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* CANLIYA GEÇİLDİĞİNDE BAŞARI TOASTI */}
              {justWentLive && (
                <div style={{
                  width: '100%',
                  maxWidth: '460px',
                  margin: '0 auto 12px auto',
                  padding: '12px 18px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.22), rgba(0, 176, 255, 0.22))',
                  border: '1.5px solid #00e676',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  color: '#00e676',
                  fontWeight: '800',
                  fontSize: '0.88rem',
                  boxShadow: '0 4px 20px rgba(0, 230, 118, 0.35)'
                }}>
                  <span>🎉</span>
                  <span>{t('streamer_live_success_toast', 'Harika! Canlıya geçtin, Keşfet vitrininde en üsttesin!')}</span>
                </div>
              )}

              {/* KADIN YAYINCI ÇEVRİM İÇİ İSE HOME EKRANINDA KÜÇÜK CANLI GÖSTERGESİ */}
              {isFemaleStreamer && streamerOnline && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 16px',
                  borderRadius: '20px',
                  background: 'rgba(0, 230, 118, 0.12)',
                  border: '1px solid rgba(0, 230, 118, 0.4)',
                  color: '#00e676',
                  fontSize: '0.82rem',
                  fontWeight: '800',
                  marginBottom: '8px'
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00e676', boxShadow: '0 0 8px #00e676' }}></span>
                  <span>{t('streamer_home_live_badge', '🟢 Canlıdasın (Aramalar Açık)')}</span>
                  <button
                    onClick={() => {
                      localStorage.setItem(`pyngoo_streamer_online_${userId}`, 'false');
                      setStreamerOnline(false);
                      window.dispatchEvent(new CustomEvent('pyngoo_streamer_online_changed', { detail: { isOnline: false } }));
                      syncStreamerStatusToNetwork(false);
                      try {
                        supabase.from('waiting_room').delete().eq('user_id', userId);
                      } catch (_) {}
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ffb74d',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontWeight: '700',
                      textDecoration: 'underline',
                      marginLeft: '6px'
                    }}
                  >
                    {t('streamer_take_break_action', 'Molaya Geç ☕')}
                  </button>
                </div>
              )}



              {/* KADIN KULLANICI İÇİN AFİLLİ YAYINCI OL BANNERI (Yalnızca henüz yayıncı değilse) */}
              {profile?.gender === 'kadin' && !isFemaleStreamer && (
                <button
                  onClick={() => setShowStreamerModal(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.28), rgba(255, 215, 0, 0.32))',
                    border: '1.5px solid rgba(255, 215, 0, 0.8)',
                    color: '#fff',
                    padding: '9px 22px',
                    borderRadius: '22px',
                    fontSize: '0.86rem',
                    fontWeight: '900',
                    cursor: 'pointer',
                    boxShadow: '0 4px 18px rgba(46, 204, 113, 0.35)',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '1.1rem' }}>💵</span>
                  <span>
                    💰 {t('streamer_become_host_banner', 'Yayıncı Ol & Nakit Para Kazan!')}
                  </span>
                  <span style={{ fontSize: '0.9rem', color: '#ffd700' }}>➔</span>
                </button>
              )}

              {/* Canlı Odalar & Aktif Çevrimiçi Kullanıcı Rozeti */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px', marginBottom: '8px' }}>
                <LivePulseCounter />
              </div>
            </div>

            <h3>{t('home_ready')}</h3>
            <p>{chatMode === 'video' ? t('home_ready_desc_video') : t('home_ready_desc_voice')}</p>
            
            {micError && (
              <div style={{ 
                color: '#ff6b6b', 
                background: 'rgba(255, 107, 107, 0.12)', 
                border: '1px solid rgba(255, 107, 107, 0.35)',
                padding: '14px 18px', 
                borderRadius: '12px', 
                marginBottom: '20px', 
                fontWeight: '500',
                fontSize: '0.92rem',
                lineHeight: '1.5',
                textAlign: 'left'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ fontSize: '1.2rem', marginTop: '1px' }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#ff7675' }}>
                      {mediaErrorType === 'not_found_video' && t('home_device_not_found_video')}
                      {mediaErrorType === 'not_found_audio' && t('home_device_not_found_audio')}
                      {mediaErrorType === 'in_use' && t('home_device_in_use')}
                      {(!mediaErrorType || mediaErrorType === 'denied') && t('home_mic_camera_permission_err')}
                    </div>
                    {mediaErrorType === 'not_found_video' && (
                      <div style={{ fontSize: '0.82rem', color: '#ffd2d2', marginTop: '6px' }}>
                        💡 <b>Çözüm:</b> Kameranız yoksa alttaki <b>"🎙️ Sesli Sohbet"</b> seçeneğine tıklayıp hemen sadece sesle eşleşebilirsiniz!
                      </div>
                    )}
                    {mediaErrorType === 'denied' && (
                      <div style={{ fontSize: '0.82rem', color: '#ffd2d2', marginTop: '6px' }}>
                        💡 <b>Çözüm:</b> Tarayıcının en üstündeki kilit 🔒 simgesine tıklayın, Kamera ve Mikrofonu "İzin Ver" yapıp sayfayı yenileyin.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 📹 Görüntülü / 🎙️ Sesli Mod Seçimi */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '16px' }}>
              <button 
                onClick={() => { setChatMode('video'); setMicError(false); setMediaErrorType(null); }}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '14px',
                  background: chatMode === 'video' ? 'linear-gradient(135deg, rgba(0, 242, 254, 0.25), rgba(79, 172, 254, 0.25))' : 'rgba(255,255,255,0.05)',
                  border: chatMode === 'video' ? '2px solid #00f2fe' : '1px solid rgba(255,255,255,0.15)',
                  color: 'white', cursor: 'pointer', transition: '0.3s',
                  boxShadow: chatMode === 'video' ? '0 0 15px rgba(0, 242, 254, 0.3)' : 'none'
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>{t('mode_video')}</span>
              </button>
              <button 
                onClick={() => { setChatMode('voice'); setMicError(false); setMediaErrorType(null); }}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '14px',
                  background: chatMode === 'voice' ? 'linear-gradient(135deg, rgba(255, 65, 108, 0.25), rgba(255, 75, 43, 0.25))' : 'rgba(255,255,255,0.05)',
                  border: chatMode === 'voice' ? '2px solid #ff416c' : '1px solid rgba(255,255,255,0.15)',
                  color: 'white', cursor: 'pointer', transition: '0.3s',
                  boxShadow: chatMode === 'voice' ? '0 0 15px rgba(255, 65, 108, 0.3)' : 'none'
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>{t('mode_voice')}</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
              <button 
                onClick={() => setLanguageFilter('same')}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', borderRadius: '12px',
                  background: languageFilter === 'same' ? 'rgba(255, 65, 108, 0.2)' : 'transparent',
                  border: languageFilter === 'same' ? '2px solid #ff416c' : '1px solid rgba(255,255,255,0.2)',
                  color: 'white', cursor: 'pointer', transition: '0.3s'
                }}
              >
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{t('home_filter_lang')}</span>
              </button>
              <button 
                onClick={() => setLanguageFilter('all')}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 15px', borderRadius: '12px',
                  background: languageFilter === 'all' ? 'rgba(79, 172, 254, 0.2)' : 'transparent',
                  border: languageFilter === 'all' ? '2px solid #4facfe' : '1px solid rgba(255,255,255,0.2)',
                  color: 'white', cursor: 'pointer', transition: '0.3s'
                }}
              >
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{t('home_filter_all')}</span>
              </button>
            </div>

            <button onClick={startSearching} className="match-btn pulse-animation">
              {chatMode === 'video' ? <Video size={36} /> : <Mic size={36} />}
              <span>{t('home_match_btn')}</span>
            </button>
            
            {/* GELİŞTİRİCİ TEST BUTONLARI - Tamamen kaldırıldı */}
          </div>
        )}
      </main>
    </div>
  );
}
