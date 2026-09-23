import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { MessageCircle, Phone, User, Wallet as WalletIcon, Coins, PhoneIncoming, PhoneOff, PhoneCall, Compass } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import { soundManager } from '../utils/SoundManager';
import VoiceChat from './VoiceChat';
import PrivacyShield from './PrivacyShield';

interface LayoutProps {
  userId: string;
}

export default function Layout({ userId }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [profile, setProfile] = useState<any>(() => {
    const savedStr = localStorage.getItem(`pyngoo_user_profile_${userId}`);
    let p: any = null;
    try { p = savedStr ? JSON.parse(savedStr) : null; } catch (_) { p = null; }
    const checkOmer = userId === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b';
    const checkApoo = userId === '16cd9b54-a051-4548-a3ad-d34f4b5b9ab4';
    if (p && checkOmer) {
      p.gender = 'erkek';
      p.role = 'admin';
    } else if (p && checkApoo) {
      p.gender = 'erkek';
      p.role = 'moderator';
      p.is_moderator = true;
    }
    return p;
  });

  const isOmer = userId === 'd6afbbb7-9a25-4552-a913-e80a1bae7e2b';
  const isApoo = userId === '16cd9b54-a051-4548-a3ad-d34f4b5b9ab4';

  const [gender, setGender] = useState<string>(() => {
    if (isOmer || isApoo) return 'erkek';
    const isKadin = localStorage.getItem('pyngoo_gender') === 'kadin' || localStorage.getItem(`pyngoo_role_${userId}`) === 'streamer';
    return isKadin ? 'kadin' : (localStorage.getItem('pyngoo_gender') || 'erkek');
  });
  const [pendingCount, setPendingCount] = useState(0);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isInsideActiveChat, setIsInsideActiveChat] = useState(false);

  useEffect(() => {
    const handleActiveChatState = (e: any) => {
      setIsInsideActiveChat(Boolean(e.detail?.isActive));
    };
    window.addEventListener('pyngoo_active_chat_state', handleActiveChatState);
    return () => {
      window.removeEventListener('pyngoo_active_chat_state', handleActiveChatState);
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== '/chats') {
      setIsInsideActiveChat(false);
      document.body.classList.remove('in-active-chat');
    }
  }, [location.pathname]);

  // Global Arama Yönetimi (Tüm sayfalarda geçerli)
  const [incomingCall, setIncomingCall] = useState<{ callId: string; callerName: string; callerId: string } | null>(null);
  const incomingCallRef = useRef(incomingCall);
  incomingCallRef.current = incomingCall;

  const [activeCallChannel, setActiveCallChannel] = useState<string | null>(null);
  const [callPartner, setCallPartner] = useState<{ id: string; name: string } | null>(null);
  const [directCallCallerId, setDirectCallCallerId] = useState<string | null>(null);
  const [callWaitingNotification, setCallWaitingNotification] = useState<{ callerName: string; callerId: string } | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [goldToastMessage, setGoldToastMessage] = useState<string | null>(null);

  const isCallActiveRef = useRef(false);
  isCallActiveRef.current = isCallActive || !!activeCallChannel;

  const forceLogoutUser = useCallback(async (reason?: string) => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('pyngoo_') || key.startsWith('sb-') || key.startsWith('pending_') || key.includes(userId))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      sessionStorage.clear();
      document.cookie = "p_gen=; path=/; max-age=0";
      document.cookie = "p_role=; path=/; max-age=0";
      document.cookie = "p_nick=; path=/; max-age=0";
      document.cookie = "p_lang=; path=/; max-age=0";
    } catch (_) {}

    try {
      await supabase.auth.signOut();
    } catch (_) {}

    if (reason && reason.includes('askıya')) {
      alert(reason);
      window.location.replace('/login');
    } else {
      window.location.replace('/login?mode=register&deleted=1');
    }
  }, [userId]);

  const fetchProfile = useCallback(async () => {
    if (userId) {
      try {
        const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        
        if (error) {
          console.warn("fetchProfile network notice:", error);
          return; // Ağ hatası durumunda kullanıcıyı sistemden atma!
        }

        if (!data) {
          return; // Veri bulunamadığında da ağ dalgalanması olabilir, anında atma!
        }

        if (data.role === 'deleted' || data.is_banned === true) {
          console.warn("fetchProfile: Hesap silinmiş veya yasaklanmış.");
          forceLogoutUser(data.is_banned ? 'Hesabınız askıya alınmıştır.' : 'Hesabınız silinmiştir.');
          return;
        }

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
        const effectiveGender = isThisOmer ? 'erkek' : (data.gender || 'erkek');
        setGender(effectiveGender);
        localStorage.setItem('pyngoo_gender', effectiveGender);
        localStorage.setItem(`pyngoo_user_profile_${userId}`, JSON.stringify(data));
      } catch (err: any) {
        console.error('fetchProfile error:', err);
      }
    }
  }, [userId, i18n.language, forceLogoutUser]);

  const fetchCounts = useCallback(async () => {
    if (!userId) return;
    try {
      // Bekleyen istekler
      const { count: reqCount } = await supabase
        .from('friends')
        .select('*', { count: 'exact', head: true })
        .eq('user_id_2', userId)
        .eq('status', 'pending');
        
      // Okunmamış mesajlar
      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', userId)
        .eq('is_read', false);
        
      setPendingCount((reqCount || 0) + (msgCount || 0));
    } catch (_) {}
  }, [userId]);

  // Sayfa değiştikçe ve ilk açılışta bildirim sayılarını otomatik güncelle
  useEffect(() => {
    fetchCounts();
  }, [fetchCounts, location.pathname]);

  useEffect(() => {
    fetchProfile();

    // 1. Tarayıcı Bildirim İzni İsteme (Mesaj veya arama gelirse ekrana düşürmek için)
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      try {
        Notification.requestPermission().catch(() => {});
      } catch (_) {}
    }

    fetchCounts();

    const handleMessagesRead = () => {
      fetchCounts();
    };
    window.addEventListener('pyngoo_messages_read', handleMessagesRead);

    // 2. Profil Değişikliklerini ve Silinmeyi Dinle
    const profileChannel = supabase.channel(`layout_profile_${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, (payload: any) => {
        if (payload.new) {
          if (payload.new.role === 'deleted' || payload.new.is_banned === true) {
            console.warn("Profil güncellendi: silinmiş veya yasaklanmış.");
            forceLogoutUser(payload.new.is_banned ? 'Hesabınız askıya alınmıştır.' : 'Hesabınız silinmiştir.');
            return;
          }
          setProfile(payload.new);
          localStorage.setItem(`pyngoo_user_profile_${userId}`, JSON.stringify(payload.new));
          if (payload.new.gender) setGender(payload.new.gender);
          window.dispatchEvent(new CustomEvent('pyngoo_gold_updated', { detail: { newGold: payload.new.total_gold } }));
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, () => {
        console.warn("Profil veritabanından silindi (DELETE event)! Derhal oturum sonlandırılıyor.");
        forceLogoutUser('Hesabınız silinmiştir.');
      })
      .subscribe();

    // Periyodik Varlık Kontrolü
    const checkLiveness = async () => {
      try {
        // 1. Auth sunucusu kontrolü
        const { data: authData, error: authErr } = await supabase.auth.getUser();
        if (authErr) {
          return; // Ağ hatasında kullanıcıyı atma!
        }
        if (!authData?.user) {
          console.warn("Liveness check: Kullanıcı Supabase Auth üzerinde bulunamadı.");
          forceLogoutUser('Hesabınız silinmiştir.');
          return;
        }

        // 2. Tek Oturum Kontrolü (Başka cihazdan açılmış mı?)
        const myDevId = localStorage.getItem('pyngoo_client_device_id');
        const activeDevId = authData.user.user_metadata?.active_device_id;
        if (activeDevId && myDevId && activeDevId !== myDevId) {
          console.warn("Layout liveness: Başka bir cihazdan giriş yapıldığı tespit edildi.");
          window.dispatchEvent(new CustomEvent('pyngoo_session_conflict'));
          return;
        }

        // 3. Profiles tablosu kontrolü
        const { data, error } = await supabase
          .from('profiles')
          .select('id, role, is_banned')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          return; // Ağ hatasında kullanıcıyı atma!
        }

        if (data && (data.role === 'deleted' || data.is_banned === true)) {
          console.warn("Liveness check: Profil silinmiş veya yasaklanmış.");
          forceLogoutUser(data.is_banned ? 'Hesabınız askıya alınmıştır.' : 'Hesabınız silinmiştir.');
        }
      } catch (_) {}
    };

    // Performans/Bağlantı Havuzu: Bu periyodik anket, App.tsx'teki checkOwnership/realtime
    // kanallarıyla ve yukarıdaki profileChannel realtime aboneliğiyle aynı işi tekrar tekrar
    // yapıyordu (her sekme 20-30 sn'de bir ekstra Supabase isteği = gereksiz yük).
    // Silinme/ban anlık olarak realtime ile, cihaz çakışması App.tsx'in checkOwnership'i ile
    // zaten yakalanıyor. Bu yüzden sabit interval kaldırıldı; sadece sekmeye geri dönüldüğünde
    // (focus/visibilitychange) bir kez kontrol ediliyor.
    const livenessInterval: ReturnType<typeof setInterval> | undefined = undefined;
    window.addEventListener('focus', checkLiveness);
    document.addEventListener('visibilitychange', checkLiveness);

    // 3. Global Gelen Arama Dinleyicisi (Hangi sekmede/sayfada olursa olsun çalar)
    const callChannel = supabase.channel(`user_call_channel_${userId}`)
      .on('broadcast', { event: 'direct_call_start' }, (payload: any) => {
        const data = payload?.payload;
        if (data && data.callId && data.callerId !== userId) {
          // 🛑 Yayıncı Mola Kontrolü: Eğer bu kullanıcı yayıncı ise ve şu anda moladaysa (veya çevrim dışıysa) ASLA ÇALMA!
          const isStreamerUser = 
            profile?.role === 'streamer' || 
            profile?.is_streamer === true || 
            localStorage.getItem(`pyngoo_is_streamer_${userId}`) === 'true';

          const isStreamerOnline = localStorage.getItem(`pyngoo_streamer_online_${userId}`) === 'true';

          if (isStreamerUser && !isStreamerOnline) {
            console.log('🛑 Yayıncı molada olduğu için gelen arama engellendi ve arayana meşgul iletildi.');
            const callerChannel = supabase.channel(`user_call_channel_${data.callerId}`);
            callerChannel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                callerChannel.send({
                  type: 'broadcast',
                  event: 'direct_call_busy',
                  payload: { callId: data.callId, callerId: data.callerId, busyUserId: userId, isMola: true }
                });
                setTimeout(() => {
                  try { supabase.removeChannel(callerChannel); } catch (_) {}
                }, 3000);
              }
            });

            const roomChannel = supabase.channel(`room_${data.callId}`);
            roomChannel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                roomChannel.send({
                  type: 'broadcast',
                  event: 'direct_call_busy',
                  payload: { callId: data.callId, callerId: data.callerId, busyUserId: userId, isMola: true }
                });
                setTimeout(() => {
                  try { supabase.removeChannel(roomChannel); } catch (_) {}
                }, 3000);
              }
            });

            try {
              supabase.from('match_history').update({ status: 'busy' }).eq('match_id', data.callId).then();
            } catch (_) {}
            return; // ASLA ÇALMA, MODAL AÇMA!
          }

          // Eğer kullanıcı şu anda zaten aktif bir görüşmedeyse (MEŞGUL)
          if (isCallActiveRef.current) {
            // 1. Arayan kişiye meşgul sinyali ilet
            const callerChannel = supabase.channel(`user_call_channel_${data.callerId}`);
            callerChannel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                callerChannel.send({
                  type: 'broadcast',
                  event: 'direct_call_busy',
                  payload: { callId: data.callId, callerId: data.callerId, busyUserId: userId }
                });
                setTimeout(() => {
                  try { supabase.removeChannel(callerChannel); } catch (_) {}
                }, 3000);
              }
            });

            // Arama odasına da meşgul yayınla
            const roomChannel = supabase.channel(`room_${data.callId}`);
            roomChannel.subscribe((status) => {
              if (status === 'SUBSCRIBED') {
                roomChannel.send({
                  type: 'broadcast',
                  event: 'direct_call_busy',
                  payload: { callId: data.callId, callerId: data.callerId, busyUserId: userId }
                });
                setTimeout(() => {
                  try { supabase.removeChannel(roomChannel); } catch (_) {}
                }, 3000);
              }
            });

            // match_history kaydını 'busy' olarak işaretle
            try {
              supabase.from('match_history').update({ status: 'busy' }).eq('match_id', data.callId).then();
            } catch (_) {}

            // 2. Görüşmedeki kullanıcıya sessiz/hafif Arama Bekletme Üst Bildirimi göster
            setCallWaitingNotification({
              callerName: data.callerName || 'Arkadaşın',
              callerId: data.callerId
            });
            soundManager.playCallWaitingBeep();
            setTimeout(() => {
              setCallWaitingNotification(null);
            }, 7000);

            return; // Tam ekran gelen arama modalını açıp görüşmeyi BÖLME!
          }

          setIncomingCall({
            callId: data.callId,
            callerName: data.callerName || 'Arkadaşın',
            callerId: data.callerId
          });

          // Telefon zil sesini başlat
          soundManager.startRingtone();

          // Uygulama simgesinde veya arka plandayken sistem bildirimi düşür
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
            try {
              new Notification('📞 Gelen Arama - Pyngoo', {
                body: `${data.callerName || 'Arkadaşın'} sizi sesli/görüntülü aramaya davet ediyor!`,
                icon: '/favicon.svg'
              });
            } catch (_) {}
          }
        }
      })
      .on('broadcast', { event: 'direct_call_rejected' }, () => {
        soundManager.stopOutgoingRingback();
        soundManager.stopRingtone();
        setIncomingCall(null);
        handleEndDirectCall();
      })
      .on('broadcast', { event: 'direct_call_busy' }, (payload: any) => {
        soundManager.stopOutgoingRingback();
        soundManager.stopRingtone();
        const isMola = payload?.payload?.isMola;
        alert(isMola ? '☕ Yayıncı şu anda molada! Lütfen canlıya geçmesini bekleyin veya daha sonra tekrar deneyin.' : '📞 Aradığınız kullanıcı şu anda başka bir görüşmede meşgul!');
        handleEndDirectCall();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'match_history',
        filter: `receiver_id=eq.${userId}`
      }, async (payload: any) => {
        const newMatch = payload?.new;
        if (newMatch && newMatch.match_id && newMatch.caller_id !== userId && newMatch.status === 'pending') {
          // 🛑 Yayıncı Mola Kontrolü: Moladaysa veritabanı dinleyicisi de çalmasın
          const isStreamerUser = 
            profile?.role === 'streamer' || 
            profile?.is_streamer === true || 
            localStorage.getItem(`pyngoo_is_streamer_${userId}`) === 'true';

          const isStreamerOnline = localStorage.getItem(`pyngoo_streamer_online_${userId}`) === 'true';

          if (isStreamerUser && !isStreamerOnline) {
            try {
              supabase.from('match_history').update({ status: 'busy' }).eq('match_id', newMatch.match_id).then();
            } catch (_) {}
            return; // ÇALMA!
          }
          if (isCallActiveRef.current) {
            // Zaten görüşmede, broadcast dinleyicisi meşgulü yönetir
            return;
          }
          let callerName = 'Arkadaşın';
          try {
            const { data: callerProf } = await supabase
              .from('profiles')
              .select('display_name')
              .eq('id', newMatch.caller_id)
              .single();
            if (callerProf?.display_name) callerName = callerProf.display_name;
          } catch (_) {}

          setIncomingCall({
            callId: newMatch.match_id,
            callerName,
            callerId: newMatch.caller_id
          });
          soundManager.startRingtone();
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'match_history',
        filter: `caller_id=eq.${userId}`
      }, (payload: any) => {
        if (payload?.new?.status === 'rejected') {
          soundManager.stopOutgoingRingback();
          soundManager.stopRingtone();
          handleEndDirectCall();
        } else if (payload?.new?.status === 'busy') {
          soundManager.stopOutgoingRingback();
        }
      })
      .subscribe();

    // 4. Arkadaş ve Mesaj Bildirim Dinleyicileri
    const friendsChannel = supabase.channel('layout_friends_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends', filter: `user_id_2=eq.${userId}` }, () => {
        fetchCounts();
      })
      .subscribe();
      
    const messagesChannel = supabase.channel('layout_messages_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, () => {
        fetchCounts();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${userId}` }, () => {
        fetchCounts();
      })
      .subscribe();

    // 5. Global Kullanıcı Çevrimiçi Varlık Takibi (Realtime Presence)
    const presenceChannel = supabase.channel('pyngoo_presence', {
      config: { presence: { key: userId } }
    });

    const updatePresence = () => {
      const state = presenceChannel.presenceState();
      const onlineSet = new Set<string>();
      Object.keys(state).forEach((k) => onlineSet.add(k));
      setOnlineUsers(onlineSet);
    };

    presenceChannel
      .on('presence', { event: 'sync' }, updatePresence)
      .on('presence', { event: 'join' }, updatePresence)
      .on('presence', { event: 'leave' }, updatePresence)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            userId,
            online_at: new Date().toISOString()
          });
        }
      });

    // 6. Onaylanan Altın Ödemelerini Takip Et ve Bildirim Göster (1 Kerelik Bildirim Garantisi)
    const syncApprovedPayments = async (isRealtimeNotification = false) => {
      if (!userId) return;
      try {
        const { data: approvedOrders } = await supabase
          .from('payment_notifications')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'approved');

        const notifiedKey = `pyngoo_notified_orders_${userId}`;
        const creditedKey = `pyngoo_credited_orders_${userId}`;

        const existingNotified: string[] = JSON.parse(localStorage.getItem(notifiedKey) || '[]');
        const existingCredited: string[] = JSON.parse(localStorage.getItem(creditedKey) || '[]');
        const notifiedSet = new Set([...existingNotified, ...existingCredited]);

        let newlyNotifiedCount = 0;
        let newlyCreditedAmount = 0;

        if (approvedOrders && approvedOrders.length > 0) {
          const now = Date.now();
          for (const order of approvedOrders) {
            const idKey = order.id ? String(order.id) : '';
            const codeKey = order.order_code ? String(order.order_code) : '';
            const isAlreadyNotified = (idKey && notifiedSet.has(idKey)) || (codeKey && notifiedSet.has(codeKey));

            if (!isAlreadyNotified) {
              const updatedTime = order.updated_at ? new Date(order.updated_at).getTime() : (order.created_at ? new Date(order.created_at).getTime() : 0);
              const isRecent = isRealtimeNotification || (updatedTime > 0 && (now - updatedTime < 180000)); // Son 3 dakika

              if (isRecent) {
                newlyNotifiedCount++;
                newlyCreditedAmount += (Number(order.total_gold) || 0);
              }

              if (idKey) notifiedSet.add(idKey);
              if (codeKey) notifiedSet.add(codeKey);
            }
          }
        }

        // Güncellenmiş bildirim listesini hafızaya kaydet
        const finalIdsList = Array.from(notifiedSet);
        localStorage.setItem(notifiedKey, JSON.stringify(finalIdsList));
        localStorage.setItem(creditedKey, JSON.stringify(finalIdsList));

        // Veritabanından en güncel profili çek (RPC altınları zaten eklemiştir)
        const { data: freshProf } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (freshProf) {
          setProfile(freshProf);
          localStorage.setItem(`pyngoo_user_profile_${userId}`, JSON.stringify(freshProf));
          window.dispatchEvent(new CustomEvent('pyngoo_gold_updated', { detail: { newGold: freshProf.total_gold } }));
        }

        // Yalnızca yeni onaylanan siparişler için 1 KEREYE MAHSUS toast göster
        if (newlyNotifiedCount > 0 && newlyCreditedAmount > 0) {
          soundManager.playCoinSound();
          setGoldToastMessage(`🎉 +${newlyCreditedAmount.toLocaleString()} Altın hesabınıza tanımlandı!`);
          setTimeout(() => setGoldToastMessage(null), 6000);
        }
      } catch (err) {
        console.warn('syncApprovedPayments hatası:', err);
      }
    };

    const handleFocusSyncPayments = () => {
      syncApprovedPayments(false);
    };

    syncApprovedPayments(false);
    window.addEventListener('focus', handleFocusSyncPayments);

    const paymentChannel = supabase.channel(`user_payment_channel_${userId}`)
      .on('broadcast', { event: 'payment_approved' }, () => {
        syncApprovedPayments(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_notifications', filter: `user_id=eq.${userId}` }, () => {
        syncApprovedPayments(true);
      })
      .subscribe();

    return () => {
      clearInterval(livenessInterval);
      window.removeEventListener('focus', checkLiveness);
      window.removeEventListener('focus', handleFocusSyncPayments);
      document.removeEventListener('visibilitychange', checkLiveness);
      window.removeEventListener('pyngoo_messages_read', handleMessagesRead);
      soundManager.stopRingtone();
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(callChannel);
      supabase.removeChannel(friendsChannel);
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(paymentChannel);
    };
  }, [userId, fetchCounts, forceLogoutUser]);

  // Gelen Arama Cevapla
  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;
    soundManager.stopRingtone();
    try {
      supabase.from('match_history').update({ status: 'active' }).eq('match_id', incomingCall.callId).then();
    } catch (_) {}
    setDirectCallCallerId(incomingCall.callerId);
    setCallPartner({ id: incomingCall.callerId, name: incomingCall.callerName });
    setActiveCallChannel(incomingCall.callId);
    setIsCallActive(true);
    setIncomingCall(null);
  };

  // Gelen Arama Reddet
  const handleRejectIncomingCall = () => {
    if (!incomingCall) return;
    soundManager.stopRingtone();
    try {
      supabase.from('match_history').update({ status: 'rejected' }).eq('match_id', incomingCall.callId).then();
    } catch (_) {}
    const callerChannel = supabase.channel(`user_call_channel_${incomingCall.callerId}`);
    callerChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        callerChannel.send({
          type: 'broadcast',
          event: 'direct_call_rejected',
          payload: {}
        });
        setTimeout(() => {
          try { supabase.removeChannel(callerChannel); } catch (_) {}
        }, 2000);
      }
    });
    setIncomingCall(null);
  };

  // Doğrudan arama başlatma (Keşfet, Chats veya diğer sayfalardan çağrılabilir)
  const handleStartDirectCall = async (callId: string, partner: { id: string; name: string }) => {
    setDirectCallCallerId(userId);
    setCallPartner(partner);
    setActiveCallChannel(callId);
    setIsCallActive(true);

    const callerName = profile?.display_name || 'VIP Kullanıcı';

    // 1. match_history tablosuna pending kaydı aç (Postgres Realtime dinleyicisi için)
    try {
      await supabase.from('match_history').insert([{
        match_id: callId,
        caller_id: userId,
        receiver_id: partner.id,
        status: 'pending'
      }]);
    } catch (err) {
      console.warn('handleStartDirectCall insert notice:', err);
    }

    // 2. Karşı tarafın doğrudan arama kanalına anında broadcast sinyali gönder
    const targetChannel = supabase.channel(`user_call_channel_${partner.id}`);
    targetChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        targetChannel.send({
          type: 'broadcast',
          event: 'direct_call_start',
          payload: {
            callId,
            callerId: userId,
            callerName
          }
        });
        setTimeout(() => {
          try { supabase.removeChannel(targetChannel); } catch (_) {}
        }, 5000);
      }
    });
  };

  const handleEndDirectCall = () => {
    soundManager.stopRingtone();
    setActiveCallChannel(null);
    setCallPartner(null);
    setDirectCallCallerId(null);
    setIsCallActive(false);
    fetchProfile();
  };

  return (
    <div className="app-wrapper">
        <main className="main-content">
          <Outlet context={{ isCallActive, setIsCallActive, startDirectCall: handleStartDirectCall, profile, refreshProfile: fetchProfile, onlineUsers }} />
        </main>

        {/* Global Tam Ekran Özel Arama Görüşmesi (Ekran kaydı ve görüntüsü kesinlikle engellenir) */}
        {activeCallChannel && (
          <PrivacyShield activeUserId={userId} userName={profile?.display_name} enabled={true} isPrivateCall={true}>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#0a0a14' }}>
              <VoiceChat 
                channelName={activeCallChannel} 
                mode="video" 
                initialTime={60}
                partnerId={callPartner?.id}
                isDirectCall={true}
                isCaller={directCallCallerId === userId}
                onEndCall={handleEndDirectCall} 
                onSkip={handleEndDirectCall} 
                userId={userId} 
              />
            </div>
          </PrivacyShield>
        )}

        {/* Global Gelen Arama Modalı (Tüm sayfalarda çalar) */}
        {incomingCall && (
          <div style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100000, padding: '20px'
          }}>
            <div style={{
              background: 'linear-gradient(180deg, #1f1b2e 0%, #120e1f 100%)',
              border: '2px solid #00f2fe',
              borderRadius: '24px', padding: '30px 24px',
              maxWidth: '380px', width: '100%',
              textAlign: 'center', boxShadow: '0 0 45px rgba(0, 242, 254, 0.4)'
            }}>
              <div style={{
                width: '76px', height: '76px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 18px',
                boxShadow: '0 0 25px rgba(0, 242, 254, 0.5)',
                animation: 'pulse 1.4s infinite'
              }}>
                <PhoneIncoming size={38} color="white" />
              </div>

              <h3 style={{ margin: '0 0 6px', color: 'white', fontSize: '1.3rem', fontWeight: '800' }}>
                Gelen Arama
              </h3>
              <p style={{ color: '#ccc', fontSize: '0.92rem', marginBottom: '26px', lineHeight: '1.5' }}>
                <strong style={{ color: '#00f2fe', fontSize: '1.1rem' }}>{incomingCall.callerName}</strong> sizi sesli/görüntülü aramaya davet ediyor!
              </p>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  onClick={handleRejectIncomingCall}
                  style={{
                    flex: 1, padding: '14px', borderRadius: '16px',
                    background: 'rgba(255, 65, 108, 0.15)', border: '1.5px solid #ff416c',
                    color: '#ff6b6b', fontWeight: '800', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    fontSize: '0.95rem'
                  }}
                >
                  <PhoneOff size={18} />
                  {t('chats_reject', 'Reddet')}
                </button>
                <button 
                  onClick={handleAcceptIncomingCall}
                  style={{
                    flex: 1.3, padding: '14px', borderRadius: '16px',
                    background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                    border: 'none', color: '#0a0a14', fontWeight: '900',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    fontSize: '0.95rem',
                    boxShadow: '0 0 20px rgba(0, 242, 254, 0.6)'
                  }}
                >
                  <PhoneCall size={18} />
                  {t('chats_accept', 'Cevapla')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Görüşme Sırasında Arama Bekletme Bildirimi (Meşgulken Arayanı Gösterir) */}
        {callWaitingNotification && (
          <div style={{
            position: 'fixed',
            top: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(20, 20, 35, 0.96)',
            backdropFilter: 'blur(20px)',
            border: '1.5px solid #ffd700',
            boxShadow: '0 8px 32px rgba(255, 215, 0, 0.4)',
            borderRadius: '20px',
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            zIndex: 100002,
            maxWidth: '92%',
            width: '360px',
            boxSizing: 'border-box'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ffd700, #ff9800)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 0 15px rgba(255, 215, 0, 0.5)'
            }}>
              <PhoneIncoming size={22} color="#0a0a14" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#ffd700', fontSize: '0.74rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('call_waiting_busy')}
              </div>
              <div style={{ color: '#fff', fontSize: '0.92rem', fontWeight: '700', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t('user_called_you', { name: callWaitingNotification.callerName })}
              </div>
            </div>
          </div>
        )}
        {!isCallActive && !isInsideActiveChat && (
          <nav className="bottom-nav glassmorphism">
            <NavLink 
              to="/" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              end
            >
              <Phone size={24} />
              <span>{t('nav_home')}</span>
            </NavLink>

            <NavLink 
              to="/explore" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Compass size={24} />
              <span>{t('nav_explore', 'Keşfet')}</span>
            </NavLink>

            <NavLink 
              to="/chats" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              style={{ position: 'relative' }}
            >
              <MessageCircle size={24} />
              {pendingCount > 0 && (
                <div style={{ position: 'absolute', top: '0px', right: '10px', background: 'red', color: 'white', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 'bold', border: '2px solid #1a1a2e' }}>
                  {pendingCount}
                </div>
              )}
              <span className="nav-text">{t('nav_chats')}</span>
            </NavLink>
            
            {(gender === 'kadin' || profile?.gender === 'kadin') && (
              <NavLink 
                to="/wallet" 
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <WalletIcon size={24} />
                <span>{t('nav_wallet')}</span>
              </NavLink>
            )}
            
            {!(gender === 'kadin' || profile?.gender === 'kadin') && (
              <NavLink 
                to="/market" 
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                style={{ position: 'relative' }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Coins size={24} color="#ffd700" />
                  <div style={{
                    position: 'absolute', top: '-7px', right: '-14px',
                    background: 'linear-gradient(135deg, #ff0844, #ffb199)',
                    color: 'white', fontSize: '0.58rem', fontWeight: '900',
                    padding: '1px 5px', borderRadius: '6px',
                    boxShadow: '0 2px 6px rgba(255,8,68,0.6)',
                    animation: 'pulse 1.8s infinite'
                  }}>
                    %80
                  </div>
                </div>
                <span style={{ color: '#ffd700', fontWeight: '700' }}>{t('profile_gold_market', 'Market')}</span>
              </NavLink>
            )}

            <NavLink 
              to="/profile" 
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <User size={24} />
              <span>{t('nav_profile')}</span>
            </NavLink>
          </nav>
        )}

        {/* ALTIN YÜKLENDİ TEBRİK BİLDİRİMİ */}
        {goldToastMessage && (
          <div style={{
            position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
            zIndex: 99999, background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
            color: '#000', padding: '14px 28px', borderRadius: '18px',
            boxShadow: '0 12px 35px rgba(255, 170, 0, 0.5), 0 0 25px rgba(255, 215, 0, 0.4)',
            fontWeight: '900', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '10px',
            border: '2px solid #fff'
          }}>
            <Coins size={24} color="#000" />
            <span>{goldToastMessage}</span>
          </div>
        )}
      </div>
    );
  }
