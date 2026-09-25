import { useState, useEffect, useRef, useCallback } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Send, Check, CheckCheck, Gift, ArrowLeft, X, MessageSquare, Clock, UserX, PhoneCall, PhoneOff, PhoneIncoming, Trash2, Heart } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { blockUser, getLocalBlockedIds } from '../utils/blockService';
import VoiceChat from '../components/VoiceChat';
import PrivacyShield from '../components/PrivacyShield';
import { generateUUID } from '../utils/uuid';
import { soundManager } from '../utils/SoundManager';
import { logTransaction } from '../utils/transactionService';

interface ChatsProps {
  userId: string;
}

export default function Chats({ userId }: ChatsProps) {
  const { t, i18n } = useTranslation();
  const outletContext = useOutletContext<{
    setIsCallActive?: (v: boolean) => void;
    startDirectCall?: (callId: string, partner: { id: string; name: string }) => void;
    profile?: any;
    refreshProfile?: () => void;
    onlineUsers?: Set<string>;
  }>() || {};
  const navigate = useNavigate();

  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any>(null); // friend profile object
  const [messages, setMessages] = useState<any[]>([]);
  const [messageText, setMessageText] = useState('');
  const [profile, setProfile] = useState<any>(null);
  
  // Hediye Sistemi
  const [showGiftMenu, setShowGiftMenu] = useState(false);
  const [showGiftRequestMenu, setShowGiftRequestMenu] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sohbet İçi Altın Satın Alma Modalı
  const [showGoldModal, setShowGoldModal] = useState(false);

  // Ücretli Arama Sistemi (60 sn = 120 Altın)
  const [showCallModal, setShowCallModal] = useState(false);
  const [activeCallChannel, setActiveCallChannel] = useState<string | null>(null);
  const [callPartner, setCallPartner] = useState<{ id: string; name: string } | null>(null);
  const [directCallCallerId, setDirectCallCallerId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ callId: string; callerName: string; callerId: string } | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<any | null>(null);
  const [isDeletingChat, setIsDeletingChat] = useState(false);
  const [userToBlock, setUserToBlock] = useState<any | null>(null);
  const [isBlockingUser, setIsBlockingUser] = useState(false);
  const isUserOnline = (targetId: string) => {
    return !!outletContext.onlineUsers?.has(targetId);
  };

  // Mobilde aktif sohbete girildiğinde alt barın (BottomNav) kaldırılması
  useEffect(() => {
    if (activeChat) {
      document.body.classList.add('in-active-chat');
      window.dispatchEvent(new CustomEvent('pyngoo_active_chat_state', { detail: { isActive: true } }));
    } else {
      document.body.classList.remove('in-active-chat');
      window.dispatchEvent(new CustomEvent('pyngoo_active_chat_state', { detail: { isActive: false } }));
    }
    return () => {
      document.body.classList.remove('in-active-chat');
      window.dispatchEvent(new CustomEvent('pyngoo_active_chat_state', { detail: { isActive: false } }));
    };
  }, [activeChat]);

  useEffect(() => {
    outletContext.setIsCallActive?.(!!activeCallChannel);
    return () => {
      outletContext.setIsCallActive?.(false);
    };
  }, [activeCallChannel, outletContext]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChannelRef = useRef<any>(null);

  // Eşleşmedeki ile Birebir Aynı 12 Hediye
  const gifts = [
    { emoji: '🌹', name: t('gift_rose'), cost: 10, reward: 3, color: '#ff2d55' },
    { emoji: '☕', name: t('gift_coffee'), cost: 20, reward: 6, color: '#bcaaa4' },
    { emoji: '🍦', name: t('gift_icecream'), cost: 35, reward: 10, color: '#ff80ab' },
    { emoji: '🍫', name: t('gift_chocolate'), cost: 50, reward: 15, color: '#d7ccc8' },
    { emoji: '🧸', name: t('gift_bear'), cost: 100, reward: 30, color: '#ffb74d' },
    { emoji: '💐', name: t('gift_bouquet'), cost: 200, reward: 60, color: '#ba68c8' },
    { emoji: '💍', name: t('gift_diamond_ring'), cost: 350, reward: 105, color: '#4fc3f7' },
    { emoji: '👑', name: t('gift_crown'), cost: 500, reward: 150, color: '#ffd54f' },
    { emoji: '🏎️', name: t('gift_sportscar'), cost: 1000, reward: 300, color: '#ff1744' },
    { emoji: '🛥️', name: t('gift_yacht'), cost: 2000, reward: 600, color: '#00e5ff' },
    { emoji: '🚀', name: t('gift_rocket'), cost: 3000, reward: 900, color: '#7c4dff' },
    { emoji: '🏰', name: t('gift_castle'), cost: 5000, reward: 1500, color: '#ffab00' },
  ];

  // Profil Verisi Çekme (Hediyeler için altın lazim)
  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (data) setProfile(data);
    };
    fetchProfile();
  }, [userId]);

  const fetchFriends = async () => {
    const { data: friendsData } = await supabase
      .from('friends')
      .select('*')
      .or(`user_id_1.eq.${userId},user_id_2.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (friendsData) {
      const friendProfiles = await Promise.all(
        friendsData.map(async (friend) => {
          const partnerId = friend.user_id_1 === userId ? friend.user_id_2 : friend.user_id_1;
          const { data: pData } = await supabase.from('profiles').select('id, display_name, gender, total_likes, avatar').eq('id', partnerId).single();
          
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('sender_id', partnerId)
            .eq('receiver_id', userId)
            .eq('is_read', false);

          return { ...pData, friendRowId: friend.id, last_message_at: friend.last_message_at, status: friend.status, sender_id: friend.user_id_1, unread_count: unreadCount || 0 };
        })
      );
      
      const blockedIds = getLocalBlockedIds();
      const active = friendProfiles.filter(f => (f.status === 'accepted' || !f.status) && !blockedIds.includes(f.id)); // Fallback for old ones
      const pending = friendProfiles.filter(f => f.status === 'pending' && f.sender_id !== userId && !blockedIds.includes(f.id));
      
      setFriendsList(active);
      setPendingRequests(pending);
    }
  };

  const handleConfirmBlock = async () => {
    if (!userToBlock) return;
    const target = userToBlock;
    setIsBlockingUser(true);

    try {
      await blockUser(userId, target.id, target.display_name);
      if (target.friendRowId) {
        try {
          await supabase.from('friends').delete().eq('id', target.friendRowId);
        } catch (_) {}
      }
      if (activeChat?.id === target.id) {
        setActiveChat(null);
      }
      fetchFriends();
    } catch (err) {
      console.error('Kullanıcı engelleme hatası:', err);
    } finally {
      setIsBlockingUser(false);
      setUserToBlock(null);
    }
  };

  // Sohbeti ve Mesajları Kalıcı Sil
  const handleDeleteChat = async () => {
    if (!chatToDelete) return;
    const target = chatToDelete;
    setIsDeletingChat(true);

    try {
      // 1. İki kullanıcı arasındaki tüm mesajları sil
      try {
        await supabase
          .from('messages')
          .delete()
          .or(`and(sender_id.eq.${userId},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${userId})`);
      } catch (_) {}

      try {
        await supabase.from('messages').delete().eq('sender_id', userId).eq('receiver_id', target.id);
      } catch (_) {}
      try {
        await supabase.from('messages').delete().eq('sender_id', target.id).eq('receiver_id', userId);
      } catch (_) {}

      // 2. Arkadaşlık / sohbet listesi kaydını sil
      if (target.friendRowId) {
        try {
          await supabase.from('friends').delete().eq('id', target.friendRowId);
        } catch (_) {}
      }
      try {
        await supabase
          .from('friends')
          .delete()
          .or(`and(user_id_1.eq.${userId},user_id_2.eq.${target.id}),and(user_id_1.eq.${target.id},user_id_2.eq.${userId})`);
      } catch (_) {}

      // 3. Yerel listeyi hemen güncelle
      setFriendsList((prev) => prev.filter((f) => f.id !== target.id));

      // 4. Açık sohbet silindiyse pencereyi kapat
      if (activeChat?.id === target.id) {
        setActiveChat(null);
        setMessages([]);
      }

      // 5. Bildirim sayaçlarını güncelle
      window.dispatchEvent(new Event('pyngoo_messages_read'));
    } catch (err) {
      console.error('Sohbet silme hatası:', err);
    } finally {
      setIsDeletingChat(false);
      setChatToDelete(null);
    }
  };

  // Arkadaş Listesini Çek ve Dinle (Sadece userId değişiminde dinler)
  useEffect(() => {
    fetchFriends();

    const friendsChannel = supabase.channel(`chats_friends_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends', filter: `user_id_2=eq.${userId}` }, () => {
        fetchFriends();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends', filter: `user_id_1=eq.${userId}` }, () => {
        fetchFriends();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(friendsChannel);
    };
  }, [userId]); 

  const handleAcceptRequest = async (friendRowId: string) => {
    await supabase.from('friends').update({ status: 'accepted' }).eq('id', friendRowId);
    fetchFriends();
  };

  const handleRejectRequest = async (friendRowId: string) => {
    await supabase.from('friends').delete().eq('id', friendRowId);
    fetchFriends();
  };

  // Mesaj Ekleme ve Tekilleştirme (Deduplication)
  const addOrUpdateMessage = (incoming: any) => {
    setMessages(prev => {
      // 1. Aynı ID zaten varsa güncelle
      const existsIndex = prev.findIndex(m => m.id === incoming.id);
      if (existsIndex !== -1) {
        const updated = [...prev];
        updated[existsIndex] = { ...updated[existsIndex], ...incoming };
        return updated;
      }

      // 2. Geçici (pending) mesajı gerçek ID ile eşleştir
      const tempIndex = prev.findIndex(m => 
        (m.pending || String(m.id).startsWith('temp_')) && 
        m.sender_id === incoming.sender_id && 
        m.content === incoming.content
      );
      if (tempIndex !== -1) {
        const updated = [...prev];
        updated[tempIndex] = incoming;
        return updated;
      }

      // 3. Yeni mesaj olarak sona ekle
      return [...prev, incoming];
    });
  };

  const handleSelectChat = (friend: any) => {
    setActiveChat(friend);
    setFriendsList(prev => prev.map(f => f.id === friend.id ? { ...f, unread_count: 0 } : f));
    supabase.from('messages')
      .update({ is_read: true })
      .eq('receiver_id', userId)
      .eq('sender_id', friend.id)
      .eq('is_read', false)
      .then(() => {
        window.dispatchEvent(new CustomEvent('pyngoo_messages_read'));
      });
  };

  const handleCloseChat = () => {
    setActiveChat(null);
    fetchFriends();
    window.dispatchEvent(new CustomEvent('pyngoo_messages_read'));
  };

  // Mesajları Çek, Okundu İşaretle ve Hızlı Realtime Kanalları Kur
  useEffect(() => {
    if (!activeChat) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${userId},receiver_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},receiver_id.eq.${userId})`)
        .order('created_at', { ascending: true });
      
      if (data) {
        setMessages(prev => {
          // Henüz veritabanına yazılmamış yerel pending mesajları koru
          const pendings = prev.filter(m => (m.pending || String(m.id).startsWith('temp_')) && !data.some(d => d.content === m.content && d.sender_id === m.sender_id));
          return [...data, ...pendings];
        });

        // Okunmamışları anında veritabanında ve arayüzde okundu yap
        const hasUnread = data.some(m => m.receiver_id === userId && !m.is_read);
        if (hasUnread) {
          supabase.from('messages')
            .update({ is_read: true })
            .eq('receiver_id', userId)
            .eq('sender_id', activeChat.id)
            .eq('is_read', false)
            .then(() => {
              window.dispatchEvent(new CustomEvent('pyngoo_messages_read'));
            });
          setFriendsList(prev => prev.map(f => f.id === activeChat.id ? { ...f, unread_count: 0 } : f));
        }
      }
    };
    
    fetchMessages();

    // 1. İki kullanıcıya özel doğrudan WebSocket Broadcast Odası (10-30ms Işık Hızı!)
    const roomKey = [userId, activeChat.id].sort().join('_');
    const channelName = `dm_room_${roomKey}`;

    let hasSubscribedOnce = false;
    const channel = supabase.channel(channelName)
      // Doğrudan soket yayını (Karşı taraf aktifse anında 20ms'de düşer)
      .on('broadcast', { event: 'dm_instant_message' }, (payload: any) => {
        const msg = payload.payload;
        if (msg && msg.sender_id === activeChat.id) {
          addOrUpdateMessage({ ...msg, is_read: true });
          supabase.from('messages').update({ is_read: true }).eq('id', msg.id).then(() => {
            window.dispatchEvent(new CustomEvent('pyngoo_messages_read'));
          });
          setFriendsList(prev => prev.map(f => f.id === activeChat.id ? { ...f, unread_count: 0 } : f));
        }
      })
      // Supabase Veritabanı Değişikliği (Yedek ve kalıcı dinleyici)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `receiver_id=eq.${userId}` 
      }, (payload: any) => {
        const newMessage = payload.new;
        if (newMessage && newMessage.sender_id === activeChat.id) {
          addOrUpdateMessage({ ...newMessage, is_read: true });
          supabase.from('messages').update({ is_read: true }).eq('id', newMessage.id).then(() => {
            window.dispatchEvent(new CustomEvent('pyngoo_messages_read'));
          });
          setFriendsList(prev => prev.map(f => f.id === activeChat.id ? { ...f, unread_count: 0 } : f));
        } else {
          fetchFriends();
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'messages',
        filter: `sender_id=eq.${userId}` 
      }, (payload: any) => {
        setMessages(prev => prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m));
      })
      .on('broadcast', { event: 'direct_call_start' }, (payload: any) => {
        const data = payload.payload;
        if (data && data.callId && data.callerId !== userId) {
          setIncomingCall({
            callId: data.callId,
            callerName: data.callerName || activeChat.display_name,
            callerId: data.callerId
          });
        }
      })
      .on('broadcast', { event: 'direct_call_rejected' }, () => {
        setIsCalling(false);
        setActiveCallChannel(null);
        soundManager.stopOutgoingRingback();
        setErrorMessage(t('chats_call_rejected'));
        setTimeout(() => setErrorMessage(null), 4000);
      })
      .on('broadcast', { event: 'direct_call_busy' }, () => {
        setIsCalling(false);
        setActiveCallChannel(null);
        soundManager.stopOutgoingRingback();
        setErrorMessage(t('chats_call_busy'));
        setTimeout(() => setErrorMessage(null), 4000);
      })
      // Kanal koptuktan sonra yeniden bağlandığında (mobil arka plan / ağ kesintisi) arada kaçan mesajları bir kez çek.
      // İlk SUBSCRIBED atlanır; ilk yükleme zaten yukarıdaki fetchMessages() ile yapıldı.
      .subscribe((status: string) => {
        if (status !== 'SUBSCRIBED') return;
        if (hasSubscribedOnce) fetchMessages();
        hasSubscribedOnce = true;
      });

    activeChannelRef.current = channel;

    // 2. Nano katman kuralı: periyodik polling YOK. Uygulama/sekme öne geldiğinde bir kez yeniden senkronize et.
    const onFocus = () => fetchMessages();
    const onVisChange = () => {
      if (!document.hidden) fetchMessages();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisChange);
      supabase.removeChannel(channel);
      activeChannelRef.current = null;
    };
  }, [userId, activeChat?.id]);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (giftEmoji: string | null = null) => {
    if (!activeChat || (!messageText.trim() && !giftEmoji)) return;
    
    const textToSend = messageText.trim();
    setMessageText(''); // Input'u anında temizle
    setShowGiftMenu(false);

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nowIso = new Date().toISOString();

    const optimisticMsg = {
      id: tempId,
      sender_id: userId,
      receiver_id: activeChat.id,
      content: giftEmoji ? giftEmoji : textToSend,
      created_at: nowIso,
      is_read: false,
      pending: true
    };

    // 1. Arayüzde anında göster (0ms Sıfır Gecikme)
    addOrUpdateMessage(optimisticMsg);

    // 2. WebSocket üzerinden doğrudan karşı tarafa broadcast yayın yap (20ms Işık Hızı)
    if (activeChannelRef.current) {
      activeChannelRef.current.send({
        type: 'broadcast',
        event: 'dm_instant_message',
        payload: { ...optimisticMsg, pending: false }
      });
    }

    try {
      // 3. Supabase Veritabanına asenkron kalıcı olarak kaydet
      const { data, error } = await supabase.from('messages').insert([{
        sender_id: userId,
        receiver_id: activeChat.id,
        content: giftEmoji ? giftEmoji : textToSend,
        is_read: false
      }]).select().single();

      if (error) {
        console.error("Mesaj veritabanına yazılamadı:", error);
        setErrorMessage(t('chats_msg_send_failed', { error: error.message }));
        setTimeout(() => setErrorMessage(null), 5000);
        return;
      }

      if (data) {
        addOrUpdateMessage(data);
      }

      // 4. Arkadaş listesinde son mesaj tarihini güncelle
      await supabase.from('friends').update({
        last_message_at: nowIso,
        last_message: giftEmoji ? giftEmoji : textToSend
      }).eq('id', activeChat.friendRowId);

      fetchFriends();

    } catch (err: any) {
      console.error("Mesaj catch hatası:", err);
      setErrorMessage(t('chats_error_generic', { error: err.message }));
      setTimeout(() => setErrorMessage(null), 5000);
    }
  };

  const [sendingGift, setSendingGift] = useState(false);

  const handleSendGift = async (cost: number, reward: number, emoji: string, giftName: string) => {
    if (sendingGift) return;
    if (!profile || (profile.total_gold || 0) < cost) {
      setShowGiftMenu(false);
      setShowGoldModal(true);
      return;
    }

    setSendingGift(true);
    try {
      // 1. Veritabanından güncel bakiye kontrolü ve atomik koşullu düşme
      const { data: freshProfile } = await supabase.from('profiles').select('total_gold').eq('id', userId).single();
      const currentGold = freshProfile?.total_gold ?? 0;
      if (currentGold < cost) {
        setProfile({ ...profile, total_gold: currentGold });
        setShowGiftMenu(false);
        setShowGoldModal(true);
        setSendingGift(false);
        return;
      }

      // 1. Güvenli RPC transferini çağır (Atomik altın düşme ve alıcı kadınsa elmas aktarma)
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('send_gift_transaction', {
        p_sender_id: userId,
        p_receiver_id: activeChat.id,
        p_gold_cost: cost,
        p_diamond_reward: reward
      });

      if (rpcErr || (rpcRes && !rpcRes.success)) {
        console.warn('Chats send_gift_transaction RPC fallback:', rpcErr || rpcRes?.error);
        const newGold = currentGold - cost;
        const { error: deductErr } = await supabase.from('profiles').update({ total_gold: newGold }).eq('id', userId).gte('total_gold', cost);
        if (deductErr) {
          setSendingGift(false);
          return;
        }
        setProfile({ ...profile, total_gold: newGold });
      } else {
        const newGold = rpcRes?.new_gold !== undefined ? rpcRes.new_gold : currentGold - cost;
        setProfile({ ...profile, total_gold: newGold });
      }

      logTransaction(userId, -cost, 'gift_sent', { targetUserId: activeChat.id, details: `${emoji} ${giftName}`, giftName });
      logTransaction(activeChat.id, reward, 'gift_received', { targetUserId: userId, details: `${emoji} ${giftName}`, giftName });

      // Mesaj olarak gönder
      handleSendMessage(`${emoji} ${giftName} (+${reward} 💎)`);
      setShowGiftMenu(false);
    } catch (err) {
      console.error('Hediye gönderim hatası:', err);
    } finally {
      setSendingGift(false);
    }
  };

  // Ücretli Sesli/Görüntülü Arama Başlat (Telefon mantığı: Ücret karşı taraf açınca başlar)
  const handleStartCall = async () => {
    if (!profile || !activeChat) return;
    const CALL_COST = 120;
    
    if ((profile.total_gold || 0) < CALL_COST) {
      setShowCallModal(false);
      setShowGoldModal(true);
      return;
    }

    setIsCalling(true);
    try {
      const callId = generateUUID();

      // 1. match_history'ye 'pending' olarak kaydet (Böylece Postgres Realtime tetiklenir)
      await supabase.from('match_history').insert([{
        match_id: callId,
        caller_id: userId,
        receiver_id: activeChat.id,
        status: 'direct_pending' // Rastgele eşleşmeden ('pending') ayrılır
      }]);

      const callPayload = {
        callId,
        callerId: userId,
        callerName: profile.display_name,
        mode: 'video',
        duration: 60
      };

      // 2. Alıcının arama bildirim kanalına bildir (Tüm sayfalarda anında çalar)
      const notifyChannel = supabase.channel(`user_call_channel_${activeChat.id}`);
      notifyChannel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          notifyChannel.send({
            type: 'broadcast',
            event: 'direct_call_start',
            payload: callPayload
          });
          setTimeout(() => {
            try { supabase.removeChannel(notifyChannel); } catch (_) {}
          }, 4000);
        }
      });

      handleSendMessage(t('chats_call_started_msg'));

      setShowCallModal(false);

      if (outletContext.startDirectCall) {
        outletContext.startDirectCall(callId, { id: activeChat.id, name: activeChat.display_name });
      } else {
        setDirectCallCallerId(userId);
        setCallPartner({ id: activeChat.id, name: activeChat.display_name });
        setActiveCallChannel(callId);
      }
    } catch (err: any) {
      console.error('Arama başlatma hatası:', err);
      setErrorMessage(t('chats_call_start_failed', { error: err.message || '' }));
      setTimeout(() => setErrorMessage(null), 4000);
    } finally {
      setIsCalling(false);
    }
  };

  const handleAcceptIncomingCall = () => {
    if (!incomingCall) return;
    setDirectCallCallerId(incomingCall.callerId);
    setCallPartner({ id: incomingCall.callerId, name: incomingCall.callerName });
    setActiveCallChannel(incomingCall.callId);
    setIncomingCall(null);
  };

  const handleRejectIncomingCall = () => {
    if (!incomingCall) return;
    const targetChannel = supabase.channel(`user_call_channel_${incomingCall.callerId}`);
    targetChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        targetChannel.send({
          type: 'broadcast',
          event: 'direct_call_rejected',
          payload: {}
        });
      }
    });
    setIncomingCall(null);
    setDirectCallCallerId(null);
  };

  const handleEndVoiceCall = useCallback(() => {
    setActiveCallChannel(null);
    setCallPartner(null);
    setDirectCallCallerId(null);
  }, []);

  if (activeCallChannel) {
    return (
      <PrivacyShield activeUserId={userId} userName={profile?.display_name} enabled={true} isPrivateCall={true}>
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: '#0a0a14' }}>
          <VoiceChat 
            channelName={activeCallChannel} 
            mode="video" 
            initialTime={60}
            partnerId={callPartner?.id}
            isDirectCall={true}
            isCaller={directCallCallerId === userId}
            onEndCall={handleEndVoiceCall} 
            onSkip={handleEndVoiceCall} 
            userId={userId} 
          />
        </div>
      </PrivacyShield>
    );
  }

  return (
    <div className="home-container" style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
      
      {/* Sol Taraf: Arkadaş Listesi (Mobilde activeChat yoksa tam ekran) */}
      <div style={{ 
        width: activeChat ? '30%' : '100%', 
        borderRight: '1px solid rgba(255,255,255,0.1)', 
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        paddingBottom: 'calc(95px + env(safe-area-inset-bottom, 0px))',
        display: (window.innerWidth < 768 && activeChat) ? 'none' : 'block' // Mobilde mesajlaşırken listeyi gizle
      }}>
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <h2>{t('chats_title')}</h2>
        </div>
        
        {pendingRequests.length > 0 && (
          <div style={{ padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255, 215, 0, 0.05)' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#FFD700' }}>{t('chats_incoming')} ({pendingRequests.length})</h4>
            {pendingRequests.map(req => (
              <div key={req.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '10px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: req.gender === 'erkek' ? '#4facfe' : '#ff416c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                  {req.display_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{req.display_name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{t('chats_added_you')}</div>
                </div>
                <button onClick={() => handleAcceptRequest(req.friendRowId)} style={{ background: '#28a745', border: 'none', color: 'white', padding: '5px 10px', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>{t('chats_accept')}</button>
                <button onClick={() => handleRejectRequest(req.friendRowId)} style={{ background: '#dc3545', border: 'none', color: 'white', padding: '5px 10px', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem' }}>{t('chats_reject')}</button>
              </div>
            ))}
          </div>
        )}

        {friendsList.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', opacity: 0.5 }}>
            <p>{t('chats_empty_1')}</p>
            <p style={{ fontSize: '0.8rem' }}>{t('chats_empty_2')}</p>
          </div>
        ) : (
          friendsList.map(friend => {
            const isOnline = isUserOnline(friend.id);
            return (
              <div 
                key={friend.id} 
                onClick={() => handleSelectChat(friend)}
                style={{ 
                  padding: '14px 20px', 
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  background: activeChat?.id === friend.id ? 'rgba(79, 172, 254, 0.12)' : 'transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '14px',
                  transition: 'background 0.2s'
                }}
              >
                {/* Avatar with Status Dot */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: friend.gender === 'erkek' ? 'linear-gradient(135deg, #4facfe, #00f2fe)' : 'linear-gradient(135deg, #ff416c, #ff4b2b)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 'bold',
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}>
                    {friend.display_name.charAt(0).toUpperCase()}
                  </div>
                  {/* Durum Rozeti (Yeşil / Gri) */}
                  <span 
                    title={isOnline ? t('chats_online', 'Çevrimiçi') : t('chats_offline', 'Çevrimdışı')}
                    style={{
                      position: 'absolute',
                      bottom: '1px',
                      right: '1px',
                      width: '13px',
                      height: '13px',
                      borderRadius: '50%',
                      backgroundColor: isOnline ? '#22c55e' : '#6b7280',
                      border: '2.5px solid #141424',
                      boxShadow: isOnline ? '0 0 8px rgba(34, 197, 94, 0.85)' : 'none',
                      transition: 'all 0.3s ease'
                    }}
                  />
                </div>

                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {friend.display_name}
                    </div>
                    {/* Küçük Durum Etiketi */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      fontSize: '0.72rem',
                      color: isOnline ? '#22c55e' : 'rgba(255,255,255,0.4)',
                      fontWeight: isOnline ? '700' : 'normal',
                      flexShrink: 0
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: isOnline ? '#22c55e' : '#6b7280',
                        boxShadow: isOnline ? '0 0 6px #22c55e' : 'none'
                      }} />
                      <span>{isOnline ? t('chats_online', 'Çevrimiçi') : t('chats_offline', 'Çevrimdışı')}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.84rem', color: friend.unread_count > 0 ? '#00f2fe' : 'rgba(255,255,255,0.45)', fontWeight: friend.unread_count > 0 ? '700' : 'normal', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {friend.unread_count > 0 ? t('chats_new_message', { count: friend.unread_count }) : t('chats_click_to_open')}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {friend.unread_count > 0 && (
                    <div style={{ background: '#ff416c', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px', boxShadow: '0 2px 8px rgba(255, 65, 108, 0.4)' }}>
                      {friend.unread_count}
                    </div>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setChatToDelete(friend);
                    }}
                    title={t('chats_delete_conversation', 'Sohbeti Sil')}
                    style={{
                      background: 'rgba(255, 77, 109, 0.12)',
                      border: '1px solid rgba(255, 77, 109, 0.3)',
                      color: '#ff4d6d',
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#ff4d6d';
                      e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 77, 109, 0.12)';
                      e.currentTarget.style.color = '#ff4d6d';
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sağ Taraf: Mesajlaşma Alanı */}
      {activeChat ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'rgba(0,0,0,0.2)', minHeight: 0 }}>
          {/* Header */}
          <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button 
              onClick={handleCloseChat}
              style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <ArrowLeft size={24} />
            </button>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                background: activeChat.gender === 'erkek' ? 'linear-gradient(135deg, #4facfe, #00f2fe)' : 'linear-gradient(135deg, #ff416c, #ff4b2b)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.05rem',
                fontWeight: 'bold',
                color: 'white',
                boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
              }}>
                {activeChat.display_name.charAt(0).toUpperCase()}
              </div>
              <span 
                style={{
                  position: 'absolute',
                  bottom: '1px',
                  right: '1px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: isUserOnline(activeChat.id) ? '#22c55e' : '#6b7280',
                  border: '2px solid #141424',
                  boxShadow: isUserOnline(activeChat.id) ? '0 0 8px rgba(34, 197, 94, 0.85)' : 'none'
                }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 'bold', color: 'white' }}>{activeChat.display_name}</h3>
                {activeChat.total_likes !== undefined && (
                  <span style={{ 
                    fontSize: '0.74rem', 
                    color: '#ff416c', 
                    fontWeight: '800',
                    background: 'rgba(255, 65, 108, 0.15)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 65, 108, 0.3)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Heart size={12} fill="#ff416c" color="#ff416c" />
                    <span>{activeChat.total_likes || 0}</span>
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                <span style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: isUserOnline(activeChat.id) ? '#22c55e' : '#6b7280',
                  boxShadow: isUserOnline(activeChat.id) ? '0 0 6px #22c55e' : 'none',
                  display: 'inline-block'
                }} />
                <span style={{
                  fontSize: '0.78rem',
                  color: isUserOnline(activeChat.id) ? '#22c55e' : 'rgba(255,255,255,0.4)',
                  fontWeight: isUserOnline(activeChat.id) ? '700' : 'normal'
                }}>
                  {isUserOnline(activeChat.id) ? t('chats_online', 'Çevrimiçi') : t('chats_offline', 'Çevrimdışı')}
                </span>
              </div>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* 📞 Ücretli Sesli Arama Butonu (Sadece Erkek Kullanıcılarda Görünür - Kadınlarda Arama Tuşu Çıkmaz) */}
              {!(profile?.gender === 'kadin' || localStorage.getItem('pyngoo_gender') === 'kadin') && (
                <button
                  onClick={() => setShowCallModal(true)}
                  style={{
                    background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.2), rgba(79, 172, 254, 0.2))',
                    border: '1px solid #00f2fe',
                    color: '#00f2fe',
                    padding: '7px 11px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.80rem',
                    fontWeight: '700',
                    boxShadow: '0 0 10px rgba(0, 242, 254, 0.25)',
                    transition: '0.2s',
                    flexShrink: 0
                  }}
                  title={t('chats_private_call_title')}
                >
                  <PhoneCall size={16} />
                  <span style={{ fontSize: '0.72rem', background: 'rgba(255, 215, 0, 0.25)', color: '#ffd700', padding: '1px 5px', borderRadius: '8px', border: '1px solid rgba(255, 215, 0, 0.5)' }}>
                    120G
                  </span>
                </button>
              )}

              {/* 🚫 Kullanıcıyı Engelle Butonu (Sadece İkon) */}
              <button
                onClick={() => setUserToBlock(activeChat)}
                style={{
                  background: 'rgba(255,65,108,0.15)',
                  border: '1px solid rgba(255,65,108,0.3)',
                  color: '#ff6b6b',
                  width: '36px',
                  height: '36px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#ff416c';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,65,108,0.15)';
                  e.currentTarget.style.color = '#ff6b6b';
                }}
                title={t('chats_block_confirm_title', 'Kullanıcıyı Engelle')}
              >
                <UserX size={17} />
              </button>

              {/* 🗑️ Sohbeti Sil Butonu (Sadece İkon) */}
              <button
                onClick={() => setChatToDelete(activeChat)}
                style={{
                  background: 'rgba(255, 77, 109, 0.15)',
                  border: '1px solid rgba(255, 77, 109, 0.3)',
                  color: '#ff6b6b',
                  width: '36px',
                  height: '36px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#ff4d6d';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 77, 109, 0.15)';
                  e.currentTarget.style.color = '#ff6b6b';
                }}
                title={t('chats_delete_confirm_title', 'Sohbeti Sil')}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>

          {/* Mesaj Listesi */}
          <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', touchAction: 'pan-y', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
            {messages.map(msg => {
              const isMine = msg.sender_id === userId;
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                  <div style={{ 
                    maxWidth: '75%', 
                    padding: msg.gift_emoji ? '20px' : '10px 15px', 
                    borderRadius: isMine ? '20px 20px 0 20px' : '20px 20px 20px 0',
                    background: msg.gift_emoji 
                      ? (isMine ? 'linear-gradient(135deg, rgba(79, 172, 254, 0.2), rgba(0, 242, 254, 0.2))' : 'linear-gradient(135deg, rgba(255, 65, 108, 0.2), rgba(255, 75, 43, 0.2))')
                      : (isMine ? 'linear-gradient(135deg, #4facfe, #00f2fe)' : 'rgba(255,255,255,0.1)'),
                    color: 'white',
                    border: msg.gift_emoji ? '1px solid rgba(255,255,255,0.2)' : 'none',
                    textAlign: msg.gift_emoji ? 'center' : 'left',
                    wordBreak: 'break-word',
                    overflowWrap: 'anywhere'
                  }}>
                    {msg.gift_emoji ? (
                      <div>
                        <div style={{ fontSize: '3rem', marginBottom: '10px', animation: 'giftPop 1s ease' }}>{msg.gift_emoji}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                          {isMine ? t('chats_sent_gift') : t('chats_received_gift')}
                        </div>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  
                  {/* Görüldü ve Saat */}
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMine && (
                      msg.pending ? (
                        <Clock size={12} style={{ opacity: 0.6 }} />
                      ) : msg.is_read ? (
                        <CheckCheck size={14} color="#00f2fe" />
                      ) : (
                        <Check size={14} style={{ opacity: 0.7 }} />
                      )
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Hediye Menüsü Pop-up (Eşleşmedeki 12 Hediye ile Birebir Aynı) */}
          {showGiftMenu && (
            <div style={{ background: 'rgba(20,20,35,0.98)', borderTop: '1px solid rgba(255,255,255,0.15)', padding: '16px 20px', position: 'relative', boxShadow: '0 -10px 25px rgba(0,0,0,0.5)' }}>
              <button onClick={() => setShowGiftMenu(false)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}>
                <X size={20} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '14px' }}>
                <Gift size={20} color="#ffd700" />
                <h4 style={{ margin: 0, textAlign: 'center', color: 'white', fontSize: '1rem' }}>
                  {t('chats_send_gift_title', { gold: profile?.total_gold || 0 })}
                </h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))', gap: '10px', maxHeight: '240px', overflowY: 'auto', padding: '4px' }}>
                {gifts.map((g, i) => (
                  <div 
                    key={i} 
                    onClick={() => handleSendGift(g.cost, g.reward, g.emoji, g.name)} 
                    style={{ 
                      background: 'rgba(255,255,255,0.04)', 
                      borderRadius: '12px', 
                      padding: '10px 6px', 
                      textAlign: 'center', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s', 
                      border: `1px solid ${g.color ? g.color + '40' : 'rgba(255,255,255,0.1)'}` 
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = g.color || '#ffd700'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = g.color ? g.color + '40' : 'rgba(255,255,255,0.1)'; }}
                  >
                    <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>{g.emoji}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#ffd700', fontWeight: 'bold', marginTop: '2px' }}>{g.cost}G</div>
                    <div style={{ fontSize: '0.65rem', color: '#00f2fe' }}>+{g.reward}💎</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hediye İste Menüsü Pop-up (Kadınlar İçin) */}
          {showGiftRequestMenu && (
            <div style={{ background: 'linear-gradient(180deg, #2a1226 0%, #15091a 100%)', borderTop: '1px solid rgba(255, 42, 141, 0.35)', padding: '16px 20px', position: 'relative', boxShadow: '0 -10px 25px rgba(0,0,0,0.7)' }}>
              <button onClick={() => setShowGiftRequestMenu(false)} style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', color: '#aaa', cursor: 'pointer' }}>
                <X size={20} />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '14px' }}>
                <span style={{ fontSize: '1.2rem' }}>🎀</span>
                <h4 style={{ margin: 0, textAlign: 'center', color: 'white', fontSize: '1rem' }}>
                  {t('chats_request_gift_title', 'Hediye İste (Kazanç: Elmas)')}
                </h4>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(85px, 1fr))', gap: '10px', maxHeight: '240px', overflowY: 'auto', padding: '4px' }}>
                {gifts.map((g, i) => (
                  <div 
                    key={i} 
                    onClick={() => {
                      setShowGiftRequestMenu(false);
                      handleSendMessage(t('chats_gift_request_msg', { emoji: g.emoji, name: g.name, reward: g.reward }));
                    }} 
                    style={{ 
                      background: 'rgba(255, 42, 141, 0.08)', 
                      borderRadius: '12px', 
                      padding: '10px 6px', 
                      textAlign: 'center', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s', 
                      border: '1px solid rgba(255, 42, 141, 0.3)' 
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = '#ff2a8d'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'rgba(255, 42, 141, 0.3)'; }}
                  >
                    <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>{g.emoji}</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#00f2fe', fontWeight: 'bold', marginTop: '2px' }}>+{g.reward}💎</div>
                    <div style={{ fontSize: '0.65rem', color: '#ffd700' }}>{g.cost}G</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hata Mesajı Alanı */}
          {errorMessage && (
            <div style={{ color: '#ff6b6b', background: 'rgba(255, 107, 107, 0.1)', padding: '10px', textAlign: 'center', fontSize: '0.9rem', borderTop: '1px solid rgba(255, 107, 107, 0.3)' }}>
              {errorMessage}
            </div>
          )}

          {/* Giriş Alanı */}
          <form 
            action="#"
            onSubmit={(e) => {
              e.preventDefault();
              if (messageText.trim()) handleSendMessage();
            }}
            style={{ padding: '12px 16px calc(78px + env(safe-area-inset-bottom, 0px)) 16px', borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(20, 18, 38, 0.95)', display: 'flex', gap: '10px' }}
          >
            {profile?.gender === 'erkek' && (
              <button 
                type="button"
                onClick={() => setShowGiftMenu(!showGiftMenu)}
                title={t('voice_send_gift', 'Hediye Gönder')}
                style={{ background: 'rgba(255, 215, 0, 0.2)', border: '1px solid rgba(255, 215, 0, 0.5)', color: '#FFD700', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <Gift size={20} />
              </button>
            )}
            {profile?.gender === 'kadin' && (
              <button 
                type="button"
                onClick={() => setShowGiftRequestMenu(!showGiftRequestMenu)}
                title={t('voice_gift_request', 'Hediye İste')}
                style={{ background: 'linear-gradient(135deg, rgba(255, 42, 141, 0.3), rgba(255, 82, 119, 0.3))', border: '1px solid #ff2a8d', color: '#ff758c', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
              >
                <span style={{ fontSize: '1.2rem' }}>🎀</span>
              </button>
            )}
            <input 
              type="text"
              enterKeyHint="send"
              autoCapitalize="sentences"
              autoComplete="off"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (messageText.trim()) handleSendMessage();
                }
              }}
              placeholder={t('chats_input_placeholder')}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '25px', padding: '0 20px', color: 'white', fontSize: '16px', outline: 'none' }}
            />
            <button 
              type="submit"
              disabled={!messageText.trim()}
              style={{ background: messageText.trim() ? '#4facfe' : 'rgba(255,255,255,0.1)', border: 'none', color: 'white', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: messageText.trim() ? 'pointer' : 'default', transition: '0.2s', flexShrink: 0 }}
            >
              <Send size={20} style={{ marginLeft: '3px' }} />
            </button>
          </form>

        </div>
      ) : (
        <div style={{ flex: 1, display: (window.innerWidth < 768) ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
          <MessageSquare size={64} style={{ marginBottom: '20px' }} />
          <h3>{t('chats_no_active')}</h3>
        </div>
      )}

      {/* 📞 Özel Arama Başlatma Onay Modalı */}
      {showCallModal && activeChat && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '20px' }}>
          <div style={{ background: '#181829', border: '1px solid rgba(0, 242, 254, 0.4)', borderRadius: '20px', padding: '26px', maxWidth: '380px', width: '100%', textAlign: 'center', boxShadow: '0 0 30px rgba(0, 242, 254, 0.2)' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg, #00f2fe, #4facfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <PhoneCall size={30} color="white" />
            </div>

            <h3 style={{ margin: '0 0 8px', color: 'white', fontSize: '1.2rem' }}>{t('chats_call_modal_title')}</h3>
            <p style={{ color: '#ccc', fontSize: '0.9rem', marginBottom: '18px', lineHeight: '1.4' }}>
              <strong style={{ color: '#00f2fe' }}>{activeChat.display_name}</strong> {t('chats_call_modal_desc')}
            </p>

            <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', padding: '14px', marginBottom: '20px', textAlign: 'left', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#aaa' }}>{t('chats_call_duration_label')}</span>
                <span style={{ color: 'white', fontWeight: 'bold' }}>{t('chats_call_duration_value')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#aaa' }}>{t('chats_call_fee_label')}</span>
                <span style={{ color: '#ffd700', fontWeight: 'bold' }}>120 {t('gold_currency_label')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '8px' }}>
                <span style={{ color: '#aaa' }}>{t('chats_current_balance_label')}</span>
                <span style={{ color: (profile?.total_gold || 0) >= 120 ? '#00f2fe' : '#ff6b6b', fontWeight: 'bold' }}>
                  {profile?.total_gold || 0} {t('gold_currency_label')}
                </span>
              </div>
            </div>

            {(profile?.total_gold || 0) < 120 ? (
              <div>
                <div style={{ color: '#ff6b6b', fontSize: '0.85rem', marginBottom: '14px', fontWeight: '500' }}>
                  {t('chats_insufficient_gold_call')}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    onClick={() => setShowCallModal(false)}
                    style={{ flex: 1, padding: '11px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {t('close')}
                  </button>
                  <button 
                    onClick={() => { setShowCallModal(false); setShowGoldModal(true); }}
                    style={{ flex: 1.2, padding: '11px', borderRadius: '12px', background: 'linear-gradient(135deg, #ffd700, #ffaa00)', border: 'none', color: '#111', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    {t('chats_buy_gold_btn')}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => setShowCallModal(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {t('chats_delete_cancel')}
                </button>
                <button 
                  onClick={handleStartCall}
                  disabled={isCalling}
                  style={{ flex: 1.4, padding: '12px', borderRadius: '12px', background: 'linear-gradient(135deg, #00f2fe, #4facfe)', border: 'none', color: '#0a0a14', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 0 15px rgba(0, 242, 254, 0.4)' }}
                >
                  {isCalling ? t('voice_connecting') : t('chats_start_call_btn')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 🪙 Sohbet İçi Hızlı Altın Satın Alma Modalı */}
      {showGoldModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10005, animation: 'fadeIn 0.2s ease-out', padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #1c1c30 0%, #0d0d1a 100%)',
            border: '2px solid #ffd700',
            borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '380px',
            textAlign: 'center', position: 'relative', boxShadow: '0 0 40px rgba(255, 215, 0, 0.35)'
          }}>
            <button
              onClick={() => setShowGoldModal(false)}
              style={{
                position: 'absolute', top: '14px', right: '14px',
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>

            <div style={{ fontSize: '3rem', marginBottom: '6px' }}>🪙</div>
            <h3 style={{ color: '#ffd700', margin: '0 0 6px 0', fontSize: '1.3rem', fontWeight: '800' }}>
              {t('gold_modal_title', 'Altın Yükle')}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', margin: '0 0 16px 0', lineHeight: '1.4' }}>
              {t('chats_gold_modal_desc')}
            </p>

            <div style={{
              display: 'flex', flexDirection: 'column', gap: '8px',
              maxHeight: '280px', overflowY: 'auto', paddingRight: '4px', marginBottom: '14px'
            }}>
              {/* Paket 1: 150 Altın */}
              <div style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px', padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: '#fff', fontWeight: '800', fontSize: '0.92rem' }}>150 {t('gold_currency_label')} 🪙</div>
                  <div style={{ color: '#2ecc71', fontSize: '0.68rem', fontWeight: '700' }}>{t('market_modal_bonus', { count: 30 })}</div>
                </div>
                <button
                  onClick={() => { setShowGoldModal(false); navigate('/market'); }}
                  style={{
                    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                    color: '#fff', padding: '7px 14px', borderRadius: '16px',
                    fontWeight: '800', fontSize: '0.80rem', cursor: 'pointer'
                  }}
                >
                  {i18n.language.startsWith('tr') ? '29.99 ₺' : '$0.99'}
                </button>
              </div>

              {/* Paket 2: 450 Altın */}
              <div style={{
                background: 'rgba(255, 65, 108, 0.12)', border: '2px solid #ff416c',
                borderRadius: '16px', padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 4px 15px rgba(255, 65, 108, 0.25)'
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#fff', fontWeight: '900', fontSize: '0.95rem' }}>450 {t('gold_currency_label')} 🪙</span>
                    <span style={{ background: '#ff416c', color: '#fff', fontSize: '0.58rem', fontWeight: '900', padding: '1px 5px', borderRadius: '4px' }}>
                      {t('market_badge_popular')}
                    </span>
                  </div>
                  <div style={{ color: '#ff416c', fontSize: '0.70rem', fontWeight: '700' }}>{t('market_modal_bonus', { count: 150 })}! ({t('market_badge_discount_50')})</div>
                </div>
                <button
                  onClick={() => { setShowGoldModal(false); navigate('/market'); }}
                  style={{
                    background: 'linear-gradient(135deg, #ff416c, #ff4b2b)',
                    border: 'none', color: '#fff', padding: '7px 15px', borderRadius: '16px',
                    fontWeight: '900', fontSize: '0.80rem', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(255, 65, 108, 0.4)'
                  }}
                >
                  {i18n.language.startsWith('tr') ? '79.99 ₺' : '$2.49'}
                </button>
              </div>

              {/* Paket 3: 1200 Altın */}
              <div style={{
                background: 'rgba(255, 215, 0, 0.10)', border: '1.5px solid rgba(255, 215, 0, 0.5)',
                borderRadius: '16px', padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 4px 15px rgba(255, 215, 0, 0.15)'
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#fff', fontWeight: '900', fontSize: '0.95rem' }}>1,200 {t('gold_currency_label')} 💎</span>
                    <span style={{ background: '#ffd700', color: '#000', fontSize: '0.58rem', fontWeight: '900', padding: '1px 5px', borderRadius: '4px' }}>
                      {t('badge_best_value')}
                    </span>
                  </div>
                  <div style={{ color: '#ffd700', fontSize: '0.70rem', fontWeight: '700' }}>{t('market_modal_bonus', { count: 500 })}! ({t('market_badge_discount_65')})</div>
                </div>
                <button
                  onClick={() => { setShowGoldModal(false); navigate('/market'); }}
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #ff9800)',
                    border: 'none', color: '#000', padding: '7px 15px', borderRadius: '16px',
                    fontWeight: '900', fontSize: '0.80rem', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(255, 215, 0, 0.4)'
                  }}
                >
                  {i18n.language.startsWith('tr') ? '169.99 ₺' : '$4.99'}
                </button>
              </div>

              {/* Paket 4: 2800 Altın */}
              <div style={{
                background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.3)',
                borderRadius: '16px', padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: '#fff', fontWeight: '900', fontSize: '0.92rem' }}>2,800 {t('gold_currency_label')} 🏆</div>
                  <div style={{ color: '#00f2fe', fontSize: '0.70rem', fontWeight: '700' }}>{t('market_modal_bonus', { count: 1200 })}!</div>
                </div>
                <button
                  onClick={() => { setShowGoldModal(false); navigate('/market'); }}
                  style={{
                    background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                    border: 'none', color: '#000', padding: '7px 15px', borderRadius: '16px',
                    fontWeight: '900', fontSize: '0.80rem', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 242, 254, 0.3)'
                  }}
                >
                  {i18n.language.startsWith('tr') ? '299.99 ₺' : '$8.99'}
                </button>
              </div>

              {/* Paket 5: 6500 Altın (VIP Sultan Kasası) */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.15), rgba(236, 72, 153, 0.1))',
                border: '1px solid #a855f7',
                borderRadius: '16px', padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: '#fff', fontWeight: '900', fontSize: '0.92rem' }}>6,500 {t('gold_currency_label')} 👑</div>
                  <div style={{ color: '#c084fc', fontSize: '0.70rem', fontWeight: '700' }}>{t('market_modal_bonus', { count: 3000 })}! ({t('market_badge_discount_70')})</div>
                </div>
                <button
                  onClick={() => { setShowGoldModal(false); navigate('/market'); }}
                  style={{
                    background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                    border: 'none', color: '#fff', padding: '7px 15px', borderRadius: '16px',
                    fontWeight: '900', fontSize: '0.80rem', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(168, 85, 247, 0.4)'
                  }}
                >
                  {i18n.language.startsWith('tr') ? '599.99 ₺' : '$17.99'}
                </button>
              </div>

              {/* Paket 6: 15000 Altın (Milyarder Servet Kasası) */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.18), rgba(255, 107, 0, 0.15))',
                border: '1.5px solid #ffd700',
                borderRadius: '16px', padding: '10px 14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 4px 15px rgba(255, 215, 0, 0.25)'
              }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#ffd700', fontWeight: '900', fontSize: '0.95rem' }}>15,000 {t('gold_currency_label')} 💎</span>
                    <span style={{ background: 'linear-gradient(135deg, #ff0844, #ffb199)', color: '#fff', fontSize: '0.58rem', fontWeight: '900', padding: '1px 5px', borderRadius: '4px' }}>
                      VIP %80
                    </span>
                  </div>
                  <div style={{ color: '#ffd700', fontSize: '0.70rem', fontWeight: '700' }}>{t('market_modal_bonus', { count: 8000 })}! ({t('market_badge_discount_80')})</div>
                </div>
                <button
                  onClick={() => { setShowGoldModal(false); navigate('/market'); }}
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #ff9800)',
                    border: 'none', color: '#000', padding: '7px 15px', borderRadius: '16px',
                    fontWeight: '900', fontSize: '0.80rem', cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(255, 215, 0, 0.4)'
                  }}
                >
                  {i18n.language.startsWith('tr') ? '1,199.99 ₺' : '$34.99'}
                </button>
              </div>
            </div>

            <button
              onClick={() => { setShowGoldModal(false); navigate('/market'); }}
              style={{
                width: '100%', padding: '10px', borderRadius: '14px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#aaa', fontSize: '0.8rem', cursor: 'pointer', fontWeight: '600'
              }}
            >
              {t('chats_go_to_market')}
            </button>
          </div>
        </div>
      )}

      {/* 🔔 Gelen Arama Modalı */}
      {incomingCall && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: '20px' }}>
          <div style={{ background: '#1c1c30', border: '2px solid #00f2fe', borderRadius: '22px', padding: '28px', maxWidth: '360px', width: '100%', textAlign: 'center', boxShadow: '0 0 35px rgba(0, 242, 254, 0.35)' }}>
            <div style={{ width: '70px', height: '70px', borderRadius: '50%', background: 'linear-gradient(135deg, #00f2fe, #4facfe)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <PhoneIncoming size={36} color="white" />
            </div>

            <h3 style={{ margin: '0 0 6px', color: 'white', fontSize: '1.25rem' }}>{t('chats_incoming_voice_title')}</h3>
            <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: '22px' }}>
              <strong style={{ color: '#00f2fe', fontSize: '1.05rem' }}>{incomingCall.callerName}</strong> {t('chats_incoming_voice_desc')}
            </p>

            {/* Kazanç kartı: yalnızca doğrudan aramalarda ve alıcı bayan ise */}
            {profile?.gender === 'kadin' && (
              <div style={{ margin: '-10px 0 20px', padding: '10px 12px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.18), rgba(255, 215, 0, 0.12))', border: '1.5px solid rgba(46, 204, 113, 0.8)', boxShadow: '0 0 22px rgba(46, 204, 113, 0.25)' }}>
                <div style={{ display: 'inline-block', padding: '3px 12px', borderRadius: '20px', background: 'rgba(255, 215, 0, 0.22)', border: '1px solid #ffd700', color: '#ffd700', fontSize: '0.72rem', fontWeight: '900', marginBottom: '6px' }}>{t('call_earning_badge')}</div>
                <div style={{ color: '#eafff1', fontSize: '0.84rem', fontWeight: '700', lineHeight: '1.4' }}>{t('call_earning_note_direct')}</div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={handleRejectIncomingCall}
                style={{ flex: 1, padding: '13px', borderRadius: '14px', background: 'rgba(255, 65, 108, 0.2)', border: '1px solid #ff416c', color: '#ff6b6b', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <PhoneOff size={18} />
                {t('call_decline')}
              </button>
              <button 
                onClick={handleAcceptIncomingCall}
                style={{ flex: 1.2, padding: '13px', borderRadius: '14px', background: 'linear-gradient(135deg, #00f2fe, #4facfe)', border: 'none', color: '#0a0a14', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 0 15px rgba(0, 242, 254, 0.5)' }}
              >
                <PhoneCall size={18} />
                {t('call_answer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ Sohbeti Silme Çift Onay Modalı */}
      {chatToDelete && (
        <div 
          onClick={() => !isDeletingChat && setChatToDelete(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)', zIndex: 11000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #20121e 0%, #120a11 100%)',
              border: '1.5px solid rgba(255, 77, 109, 0.4)',
              borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '380px',
              boxShadow: '0 20px 60px rgba(255, 77, 109, 0.25)', textAlign: 'center'
            }}
          >
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(255, 77, 109, 0.15)', border: '2px solid #ff4d6d',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <Trash2 size={30} color="#ff4d6d" />
            </div>

            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>
              {t('chats_delete_confirm_title', 'Sohbeti Sil')}
            </h3>

            <p style={{ margin: '0 0 24px 0', fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: '1.5' }}>
              <strong style={{ color: '#fff' }}>{chatToDelete.display_name}</strong> {t('chats_delete_confirm_desc', 'ile olan tüm mesajlarınız ve bu sohbet kalıcı olarak silinecektir. Bu işlem geri alınamaz.')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                disabled={isDeletingChat}
                onClick={handleDeleteChat}
                style={{
                  background: 'linear-gradient(135deg, #ff4d6d 0%, #c9184a 100%)',
                  border: 'none', color: '#fff', padding: '14px', borderRadius: '16px',
                  fontSize: '0.92rem', fontWeight: '800', cursor: isDeletingChat ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 8px 24px rgba(255, 77, 109, 0.3)',
                  opacity: isDeletingChat ? 0.7 : 1
                }}
              >
                {isDeletingChat ? (
                  <span>{t('chats_deleting')}</span>
                ) : (
                  <>
                    <Trash2 size={18} />
                    <span>{t('chats_delete_btn', 'Evet, Sohbeti ve Mesajları Sil')}</span>
                  </>
                )}
              </button>

              <button
                disabled={isDeletingChat}
                onClick={() => setChatToDelete(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff', padding: '12px', borderRadius: '16px',
                  fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer'
                }}
              >
                {t('chats_delete_cancel', 'Vazgeç')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚫 Kullanıcıyı Engelleme Çift Onay Modalı */}
      {userToBlock && (
        <div 
          onClick={() => !isBlockingUser && setUserToBlock(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(10px)', zIndex: 11000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #1f1422 0%, #120a11 100%)',
              border: '1.5px solid rgba(255, 65, 108, 0.4)',
              borderRadius: '24px', padding: '24px', width: '100%', maxWidth: '380px',
              boxShadow: '0 20px 60px rgba(255, 65, 108, 0.25)', textAlign: 'center'
            }}
          >
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(255, 65, 108, 0.15)', border: '2px solid #ff416c',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <UserX size={32} color="#ff416c" />
            </div>

            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>
              {t('chats_block_confirm_title', 'Kullanıcıyı Engelle')}
            </h3>

            <p style={{ margin: '0 0 24px 0', fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.75)', lineHeight: '1.5' }}>
              <strong style={{ color: '#fff' }}>{userToBlock.display_name}</strong> {t('chats_block_confirm_desc', 'adlı kullanıcıyı engellemek istediğinize emin misiniz? Birbirinize mesaj gönderemez ve eşleşemezsiniz.')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                disabled={isBlockingUser}
                onClick={handleConfirmBlock}
                style={{
                  background: 'linear-gradient(135deg, #ff416c 0%, #ff4b2b 100%)',
                  border: 'none', color: '#fff', padding: '14px', borderRadius: '16px',
                  fontSize: '0.92rem', fontWeight: '800', cursor: isBlockingUser ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: '0 8px 24px rgba(255, 65, 108, 0.3)',
                  opacity: isBlockingUser ? 0.7 : 1
                }}
              >
                {isBlockingUser ? (
                  <span>{t('loading', 'İşleniyor...')}</span>
                ) : (
                  <>
                    <UserX size={18} />
                    <span>{t('chats_block_btn', 'Evet, Kullanıcıyı Engelle')}</span>
                  </>
                )}
              </button>

              <button
                disabled={isBlockingUser}
                onClick={() => setUserToBlock(null)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: '#fff', padding: '12px', borderRadius: '16px',
                  fontSize: '0.88rem', fontWeight: '700', cursor: 'pointer'
                }}
              >
                {t('chats_delete_cancel', 'Vazgeç')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


