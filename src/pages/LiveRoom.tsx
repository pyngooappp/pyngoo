// PYNGOO — Canlı Oda (Live Room): TEK yayıncı, ÇOK izleyici (Bigo Live / Kick modeli).
// TikTok'un "multi-guest" (birden fazla yayıncı aynı ekranda) modeliyle KARIŞTIRILMASIN —
// burada sadece `roomId` (= yayıncının userId'si) sahibi yayın açar, gerisi izleyicidir:
// sohbete yazar, hediye gönderir. Yayıncı bir izleyiciyi yayından atabilir/engelleyebilir.
//
// Eşleşme ekranından (VoiceChat.tsx) BİLEREK ayrı bir bileşen: farklı Agora modu (1-e-çok
// için 'live' + host/audience rolü, 'rtc' değil), farklı ekran mantığı (bulanıklık/kaydırma
// yok, sohbet+hediye akışı var).

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AgoraRTC, { type IAgoraRTCClient, type ICameraVideoTrack, type IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { ArrowLeft, Eye, Send, Gift as GiftIcon, X, Flag, UserPlus, UserCheck, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { blockUser } from '../utils/blockService';
import { logTransaction } from '../utils/transactionService';
import { sendReportToTelegram } from '../utils/telegramAlert';
import { toggleFollowStreamer, isFollowingStreamer } from '../utils/followService';

const appId = import.meta.env.VITE_AGORA_APP_ID;

interface LiveRoomProps {
  userId: string;
}

interface ChatMsg {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  giftEmoji?: string;
}

export default function LiveRoom({ userId }: LiveRoomProps) {
  const { roomId } = useParams<{ roomId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isHost = userId === roomId;

  const [profile, setProfile] = useState<any>(null);
  const [hostProfile, setHostProfile] = useState<any>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [showGiftMenu, setShowGiftMenu] = useState(false);
  const [activeGiftAnimation, setActiveGiftAnimation] = useState<string | null>(null);
  const [kickTarget, setKickTarget] = useState<ChatMsg | null>(null);
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showReportMenu, setShowReportMenu] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);
  const [hostLikes, setHostLikes] = useState<number | null>(null);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localTracksRef = useRef<{ audio?: IMicrophoneAudioTrack; video?: ICameraVideoTrack }>({});

  const gifts = [
    { emoji: '🌹', name: t('gift_rose', 'Gül'), cost: 10, reward: 3 },
    { emoji: '☕', name: t('gift_coffee', 'Kahve'), cost: 20, reward: 6 },
    { emoji: '🍫', name: t('gift_chocolate', 'Çikolata'), cost: 50, reward: 15 },
    { emoji: '🧸', name: t('gift_bear', 'Ayıcık'), cost: 100, reward: 30 },
    { emoji: '👑', name: t('gift_crown', 'Taç'), cost: 500, reward: 150 },
  ];

  // Profiller
  useEffect(() => {
    supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => data && setProfile(data));
    if (roomId) {
      supabase.from('profiles').select('id, display_name, avatar, total_likes').eq('id', roomId).single()
        .then(({ data }) => {
          if (data) {
            setHostProfile(data);
            setHostLikes(data.total_likes || 0);
          }
        });
      setIsFollowing(isFollowingStreamer(userId, roomId));
    }
  }, [userId, roomId]);

  const handleFollow = async () => {
    if (!roomId || isHost) return;
    const res = await toggleFollowStreamer(userId, roomId, hostProfile?.display_name);
    setIsFollowing(res.isFollowing);
  };

  // Kural VoiceChat.tsx ile AYNI: bir kullanıcı bir yayıncıya ömür boyu yalnızca 1 kez
  // kalp atabilir (sunucuda zorunlu, like_user RPC "already" ile tekrarı sessizce engeller).
  const handleLike = async () => {
    if (hasLiked || !roomId || isHost) return;
    setHasLiked(true);
    try {
      const { data: likeRes, error: likeErr } = await supabase.rpc('like_user', { p_target: roomId });
      if (likeErr || !likeRes?.success) { if (!likeRes?.already) setHasLiked(false); return; }
      if (likeRes.already) return;
      const nextLikes = typeof likeRes.total_likes === 'number' ? likeRes.total_likes : (hostLikes || 0) + 1;
      setHostLikes(nextLikes);
      setActiveGiftAnimation('❤️');
      setTimeout(() => setActiveGiftAnimation(null), 2000);
      channelRef.current?.send({ type: 'broadcast', event: 'like', payload: { nextLikes } });
    } catch (err) {
      console.error('Canlı Oda beğeni hatası:', err);
    }
  };

  const reportCategories = [
    t('voice_report_cat_nudity'),
    t('voice_report_cat_harassment'),
    t('voice_report_cat_fake'),
    t('voice_report_cat_other'),
  ];

  const handleReport = async (category: string) => {
    if (!roomId) return;
    setShowReportMenu(false);
    try {
      await supabase.from('reports').insert([{
        reporter_id: userId,
        reported_user_id: roomId,
        category,
        reason: `Canlı Oda şikayeti: ${category}`,
        status: 'pending',
      }]);
      sendReportToTelegram({
        reporterId: userId,
        reporterName: profile?.display_name || 'Anonim',
        reportedId: roomId,
        reportedName: hostProfile?.display_name || 'Yayıncı',
        category,
        reason: `Canlı Oda (room_${roomId}) içinden şikayet edildi.`,
      }).catch(() => {});
      setReportSent(true);
      setTimeout(() => setReportSent(false), 3000);
    } catch (err) {
      console.error('Canlı Oda şikayet hatası:', err);
    }
  };

  // Sohbet listesi otomatik kaydırma
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Supabase Realtime: sohbet, hediye, yayından atma, izleyici sayısı (presence)
  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`live_room_${roomId}`, { config: { presence: { key: userId } } });
    channelRef.current = ch;

    ch.on('broadcast', { event: 'chat' }, (msg: any) => {
      setMessages((prev) => [...prev.slice(-49), msg.payload]);
    });
    ch.on('broadcast', { event: 'gift' }, (msg: any) => {
      setActiveGiftAnimation(msg.payload.giftEmoji);
      setMessages((prev) => [...prev.slice(-49), msg.payload]);
      setTimeout(() => setActiveGiftAnimation(null), 2500);
    });
    ch.on('broadcast', { event: 'like' }, (msg: any) => {
      setActiveGiftAnimation('❤️');
      setTimeout(() => setActiveGiftAnimation(null), 2000);
      if (typeof msg.payload?.nextLikes === 'number') setHostLikes(msg.payload.nextLikes);
    });
    ch.on('broadcast', { event: 'kick' }, (msg: any) => {
      if (msg.payload.targetUserId === userId && !isHost) {
        setKickedMessage(
          msg.payload.blocked
            ? t('room_kicked_blocked', 'Yayıncı seni engelledi.')
            : t('room_kicked_only', 'Yayıncı seni odadan çıkardı.')
        );
        setTimeout(() => navigate('/explore', { replace: true }), 2500);
      }
    });
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      setViewerCount(Math.max(0, Object.keys(state).length - 1)); // yayıncı hariç
    });

    ch.subscribe(async (status: string) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ name: profile?.display_name || 'Kullanıcı', joinedAt: Date.now() });
      }
    });

    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, userId, isHost, profile?.display_name]);

  // Agora: 'live' modu — yayıncı 'host', izleyici 'audience' rolünde tek yönlü akış alır.
  useEffect(() => {
    if (!roomId || !appId) return;
    let isMounted = true;
    const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
    clientRef.current = client;

    client.on('user-published', async (user, mediaType) => {
      await client.subscribe(user, mediaType);
      if (mediaType === 'video') {
        user.videoTrack?.play(remoteVideoRef.current!);
      }
      if (mediaType === 'audio') {
        user.audioTrack?.play();
      }
    });

    const start = async () => {
      try {
        await client.setClientRole(isHost ? 'host' : 'audience');
        const uid = Math.floor(Math.random() * 100000);
        let token: string | null = null;
        try {
          const { data } = await supabase.functions.invoke('agora-token', {
            body: { channelName: `room_${roomId}`, uid, expireSeconds: 7200 }
          });
          token = data?.token || null;
        } catch (_) {}

        await client.join(appId, `room_${roomId}`, token, uid);

        if (isHost) {
          const [aTrack, vTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
            { AEC: true, ANS: true, AGC: true },
            { encoderConfig: '480p_1' }
          );
          if (!isMounted) { aTrack.close(); vTrack.close(); return; }
          localTracksRef.current = { audio: aTrack, video: vTrack };
          vTrack.play(localVideoRef.current!);
          await client.publish([aTrack, vTrack]);
        }
        if (isMounted) setConnecting(false);
      } catch (err) {
        console.error('Canlı Oda bağlantı hatası:', err);
        if (isMounted) setConnecting(false);
      }
    };
    start();

    return () => {
      isMounted = false;
      localTracksRef.current.audio?.close();
      localTracksRef.current.video?.close();
      client.leave().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, isHost]);

  const sendChat = () => {
    if (!input.trim() || !channelRef.current) return;
    const msg: ChatMsg = { id: `${Date.now()}_${userId}`, senderId: userId, senderName: profile?.display_name || 'Kullanıcı', text: input.trim() };
    channelRef.current.send({ type: 'broadcast', event: 'chat', payload: msg });
    setMessages((prev) => [...prev.slice(-49), msg]);
    setInput('');
  };

  const sendGift = async (cost: number, reward: number, emoji: string) => {
    if (!profile || !roomId) return;
    if ((profile.total_gold || 0) < cost) { setShowGiftMenu(false); return; }
    setShowGiftMenu(false);
    try {
      const { data: rpcRes } = await supabase.rpc('send_gift_transaction', {
        p_sender_id: userId, p_receiver_id: roomId, p_gold_cost: cost, p_diamond_reward: reward
      });
      const newGold = rpcRes?.new_gold !== undefined ? rpcRes.new_gold : (profile.total_gold - cost);
      setProfile((p: any) => ({ ...p, total_gold: newGold }));
      logTransaction(userId, -cost, 'gift_sent', { targetUserId: roomId, details: `${emoji} Canlı Oda Hediyesi` });
      logTransaction(roomId, reward, 'gift_received', { targetUserId: userId, details: `${emoji} Canlı Oda Hediyesi` });

      const msg: ChatMsg = { id: `${Date.now()}_gift`, senderId: userId, senderName: profile?.display_name || 'Kullanıcı', giftEmoji: emoji };
      channelRef.current?.send({ type: 'broadcast', event: 'gift', payload: msg });
      setActiveGiftAnimation(emoji);
      setTimeout(() => setActiveGiftAnimation(null), 2500);
    } catch (err) {
      console.error('Canlı Oda hediye hatası:', err);
    }
  };

  const kickViewer = (also_block: boolean) => {
    if (!kickTarget || !channelRef.current) return;
    channelRef.current.send({
      type: 'broadcast', event: 'kick', payload: { targetUserId: kickTarget.senderId, blocked: also_block }
    });
    if (also_block) blockUser(userId, kickTarget.senderId, kickTarget.senderName);
    setKickTarget(null);
  };

  if (kickedMessage) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0b0c16', color: '#fff', textAlign: 'center', padding: 24 }}>
        <div>
          <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>{kickedMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', height: '100vh', width: '100%', background: '#000', overflow: 'hidden', color: '#fff' }}>
      {/* Video: host kendi kamerasını, izleyici yayıncının akışını görür */}
      <div ref={isHost ? localVideoRef : remoteVideoRef} style={{ position: 'absolute', inset: 0 }} />

      {connecting && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)' }}>
          <span style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)' }}>{t('room_connecting', 'Odaya bağlanılıyor...')}</span>
        </div>
      )}

      {/* Üst bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        paddingTop: 'calc(env(safe-area-inset-top, 12px) + 10px)',
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.65) 0%, transparent 100%)'
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <ArrowLeft size={18} color="#fff" />
        </button>
        {!isHost && (
          <img src={hostProfile?.avatar} alt="" style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', border: '1px solid #ff2d55' }} />
        )}
        <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>
          {isHost ? t('room_you_are_live', 'Yayındasın') : (hostProfile?.display_name || '...')}
        </span>
        <span style={{ background: '#ff2d55', fontSize: '0.6rem', fontWeight: 900, padding: '2px 8px', borderRadius: 8 }}>LIVE</span>

        {!isHost && (
          <button onClick={handleFollow} style={{
            display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 800,
            padding: '5px 10px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: isFollowing ? 'rgba(255,255,255,0.14)' : 'linear-gradient(135deg, #ff2d55, #ff758c)',
            color: '#fff'
          }}>
            {isFollowing ? <UserCheck size={13} /> : <UserPlus size={13} />}
            {isFollowing ? t('explore_following_btn', '✓ Takip Ediliyor') : t('explore_follow_btn', '+ Takip Et')}
          </button>
        )}

        <div style={{ marginLeft: isHost ? 'auto' : 0, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: 14, fontSize: '0.75rem', fontWeight: 700 }}>
          <Eye size={13} />{viewerCount}
        </div>
        {hostLikes !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.12)', padding: '4px 10px', borderRadius: 14, fontSize: '0.75rem', fontWeight: 700 }}>
            <Heart size={13} color="#ff4d6d" fill="#ff4d6d" />{hostLikes}
          </div>
        )}

        {!isHost && (
          <button onClick={() => setShowReportMenu(true)} style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Flag size={15} color="#fff" />
          </button>
        )}
      </div>

      {reportSent && (
        <div style={{ position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.75)', padding: '8px 16px', borderRadius: 20, fontSize: '0.8rem', zIndex: 30 }}>
          {t('voice_report_success')}
        </div>
      )}

      {showReportMenu && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 25 }} onClick={() => setShowReportMenu(false)}>
          <div style={{ width: '100%', background: '#1b0e33', borderRadius: '20px 20px 0 0', padding: '10px 0 24px' }} onClick={(e) => e.stopPropagation()}>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', padding: '8px 0' }}>{t('voice_report_title')}</p>
            {reportCategories.map((c) => (
              <button key={c} onClick={() => handleReport(c)} style={roomSheetBtnStyle}>{c}</button>
            ))}
            <button onClick={() => setShowReportMenu(false)} style={{ ...roomSheetBtnStyle, color: 'rgba(255,255,255,0.5)' }}>{t('room_cancel', 'İptal')}</button>
          </div>
        </div>
      )}

      {/* Hediye animasyonu */}
      {activeGiftAnimation && (
        <div style={{ position: 'absolute', top: '35%', left: '50%', transform: 'translateX(-50%)', fontSize: '4rem', animation: 'roomGiftPop 1.2s ease-out', pointerEvents: 'none' }}>
          {activeGiftAnimation}
        </div>
      )}

      {/* Sohbet akışı */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: isHost ? 16 : 74,
        maxHeight: '38%', overflowY: 'auto', padding: '0 14px', display: 'flex', flexDirection: 'column', gap: 6
      }}>
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.4)', padding: '5px 10px', borderRadius: 12, alignSelf: 'flex-start', maxWidth: '85%' }}>
            <button
              disabled={!isHost || m.senderId === userId}
              onClick={() => isHost && m.senderId !== userId && setKickTarget(m)}
              style={{ background: 'none', border: 'none', padding: 0, cursor: isHost ? 'pointer' : 'default', color: '#ff8fa3', fontWeight: 800, fontSize: '0.78rem' }}
            >
              {m.senderName}
            </button>
            {m.giftEmoji ? (
              <span style={{ fontSize: '1rem' }}>{t('room_sent_gift', 'hediye gönderdi')} {m.giftEmoji}</span>
            ) : (
              <span style={{ fontSize: '0.82rem', color: '#fff' }}>{m.text}</span>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Yayından at / engelle menüsü (yalnızca yayıncı) */}
      {kickTarget && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 20 }} onClick={() => setKickTarget(null)}>
          <div style={{ width: '100%', background: '#1b0e33', borderRadius: '20px 20px 0 0', padding: '10px 0 24px' }} onClick={(e) => e.stopPropagation()}>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', padding: '8px 0' }}>{kickTarget.senderName}</p>
            <button onClick={() => kickViewer(false)} style={roomSheetBtnStyle}>{t('room_kick_out', 'Yayından At')}</button>
            <button onClick={() => kickViewer(true)} style={{ ...roomSheetBtnStyle, color: '#ff4d6d' }}>{t('room_block', 'Engelle')}</button>
            <button onClick={() => setKickTarget(null)} style={{ ...roomSheetBtnStyle, color: 'rgba(255,255,255,0.5)' }}>{t('room_cancel', 'İptal')}</button>
          </div>
        </div>
      )}

      {/* Alt bar: izleyici için mesaj + hediye */}
      {!isHost && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          paddingBottom: 'calc(env(safe-area-inset-bottom, 10px) + 10px)',
          padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)'
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            placeholder={t('room_chat_placeholder', 'Mesaj yaz...')}
            style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,0.14)', border: 'none', borderRadius: 20, padding: '10px 14px', color: '#fff', fontSize: '0.85rem' }}
          />
          <button onClick={sendChat} style={roomIconBtnStyle}><Send size={17} color="#fff" /></button>
          <button onClick={handleLike} disabled={hasLiked} style={{ ...roomIconBtnStyle, opacity: hasLiked ? 0.5 : 1 }}>
            <Heart size={17} color="#ff4d6d" fill={hasLiked ? '#ff4d6d' : 'none'} />
          </button>
          <button onClick={() => setShowGiftMenu(true)} style={{ ...roomIconBtnStyle, background: 'linear-gradient(135deg, #ff2d55, #ff758c)' }}><GiftIcon size={17} color="#fff" /></button>
        </div>
      )}

      {/* Hediye menüsü */}
      {showGiftMenu && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', zIndex: 20 }} onClick={() => setShowGiftMenu(false)}>
          <div style={{ width: '100%', background: '#1b0e33', borderRadius: '20px 20px 0 0', padding: 16 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 800 }}>{t('room_send_gift', 'Hediye Gönder')}</span>
              <button onClick={() => setShowGiftMenu(false)} style={{ background: 'none', border: 'none' }}><X size={18} color="#fff" /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {gifts.map((g) => (
                <button key={g.emoji} onClick={() => sendGift(g.cost, g.reward, g.emoji)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <span style={{ fontSize: '1.4rem' }}>{g.emoji}</span>
                  <span style={{ fontSize: '0.62rem', color: '#ffd54f' }}>{g.cost} 🪙</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes roomGiftPop { 0% { opacity:0; transform:translateX(-50%) scale(.4);} 30% {opacity:1; transform:translateX(-50%) scale(1.15);} 100% {opacity:0; transform:translateX(-50%) scale(1) translateY(-40px);} }`}</style>
    </div>
  );
}

const roomIconBtnStyle: CSSProperties = {
  width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.14)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0
};

const roomSheetBtnStyle: CSSProperties = {
  width: '100%', background: 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,0.08)',
  padding: '16px 0', color: '#fff', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer'
};
