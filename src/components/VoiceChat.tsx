import { useEffect, useState, useRef } from 'react';
import AgoraRTC, { type IAgoraRTCClient, type IMicrophoneAudioTrack, type ICameraVideoTrack, type IRemoteVideoTrack } from 'agora-rtc-sdk-ng';
import { SkipForward, Mic, MicOff, PhoneOff, Clock, Flag, Gift, X, Video, VideoOff, Eye, SwitchCamera, Send, UserX, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import femaleAvatar from '../assets/avatar_female.png';
import maleAvatar from '../assets/avatar_male.png';
import { useTranslation } from 'react-i18next';
import { sendReportToTelegram } from '../utils/telegramAlert';
import { translateText } from '../utils/translator';
import { generateUUID } from '../utils/uuid';
import { blockUser } from '../utils/blockService';
import { logTransaction } from '../utils/transactionService';
import { soundManager } from '../utils/SoundManager';
// @ts-ignore
import pkg from 'agora-token';
const { RtcTokenBuilder, RtcRole } = pkg;

const appId = import.meta.env.VITE_AGORA_APP_ID;
const appCertificate = import.meta.env.VITE_AGORA_APP_CERTIFICATE;

interface VoiceChatProps {
  channelName: string;
  userId: string;
  mode?: 'voice' | 'video';
  onEndCall: () => void;
  onSkip: () => void;
  initialTime?: number;
  partnerId?: string;
  isDirectCall?: boolean;
  isCaller?: boolean;
}

export default function VoiceChat({ 
  channelName, 
  userId, 
  mode = 'video', 
  onEndCall, 
  onSkip, 
  initialTime, 
  partnerId: directPartnerId,
  isDirectCall = false,
  isCaller = false
}: VoiceChatProps) {
  const { t, i18n } = useTranslation();
  const [localAudioTrack, setLocalAudioTrack] = useState<IMicrophoneAudioTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<ICameraVideoTrack | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<IRemoteVideoTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isBlurred, setIsBlurred] = useState(mode === 'video');
  const [blurTimer, setBlurTimer] = useState(4);
  const [timeLeft, setTimeLeft] = useState(initialTime || 45);
  const [isConnected, setIsConnected] = useState(false);
  const [isCallAnswered, setIsCallAnswered] = useState(!isDirectCall);
  const isCallAnsweredRef = useRef(!isDirectCall);
  isCallAnsweredRef.current = isCallAnswered;
  const [isPartnerBusy, setIsPartnerBusy] = useState(false);
  const isPartnerBusyRef = useRef(false);
  isPartnerBusyRef.current = isPartnerBusy;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const profileRef = useRef<any>(null);
  profileRef.current = profile;
  const onEndCallRef = useRef(onEndCall);
  onEndCallRef.current = onEndCall;
  const [isExtending, setIsExtending] = useState(false);
  const [partnerProfile, setPartnerProfile] = useState<any>(null);
  const partnerProfileRef = useRef<any>(null);
  partnerProfileRef.current = partnerProfile;
  const directPartnerIdRef = useRef(directPartnerId);
  directPartnerIdRef.current = directPartnerId;
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [reportCategory, setReportCategory] = useState('🔞 Çıplaklık / Uygunsuz Görüntü');
  const [reportReason, setReportReason] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [evidenceSnapshot, setEvidenceSnapshot] = useState<string | null>(null);
  const lastGiftRequestTimeRef = useRef<number>(0);
  
  // Video DOM element refs
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);

  // Şikayet anında karşı tarafın kamerasından gizli kanıt karesi al
  const captureEvidenceSnapshot = () => {
    try {
      const videoEl = remoteVideoRef.current?.querySelector('video') || 
                      document.querySelector('#remote-player video') ||
                      document.querySelectorAll('video')[1] ||
                      document.querySelector('video');

      if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) {
        setEvidenceSnapshot(null);
        return;
      }

      const canvas = document.createElement('canvas');
      const targetWidth = 480;
      const targetHeight = Math.round((videoEl.videoHeight / videoEl.videoWidth) * targetWidth) || 360;
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoEl, 0, 0, targetWidth, targetHeight);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
      setEvidenceSnapshot(dataUrl);
    } catch (e) {
      console.warn('Snapshot alma hatası:', e);
      setEvidenceSnapshot(null);
    }
  };

  const handleOpenReportModal = () => {
    captureEvidenceSnapshot();
    setShowReportModal(true);
  };

  const handleConfirmBlock = async () => {
    let targetPartnerId = partnerId;
    if (!targetPartnerId) {
      try {
        const { data: matchData } = await supabase
          .from('match_history')
          .select('caller_id, receiver_id')
          .eq('match_id', channelName)
          .single();
        if (matchData) {
          targetPartnerId = matchData.caller_id === userId ? matchData.receiver_id : matchData.caller_id;
        }
      } catch (_) {}
    }

    if (targetPartnerId) {
      await blockUser(userId, targetPartnerId, partnerProfile?.display_name || 'Kullanıcı');
    }
    setShowBlockModal(false);
    alert(t('voice_blocked_success'));
    onEndCall();
  };
  
  // Ekonomi ve Hediyeler
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [showGiftMenu, setShowGiftMenu] = useState(false);
  const [showGiftRequestMenu, setShowGiftRequestMenu] = useState(false);
  const [incomingGiftRequest, setIncomingGiftRequest] = useState<{ giftEmoji: string; giftName: string; cost: number; reward: number; senderName: string } | null>(null);
  const isFemale = profile?.gender === 'kadin' || localStorage.getItem('pyngoo_gender') === 'kadin' || localStorage.getItem(`pyngoo_role_${userId}`) === 'streamer';
  const [activeGiftAnimation, setActiveGiftAnimation] = useState<string | null>(null);
  const [hasLiked, setHasLiked] = useState(false);
  const [hasAddedFriend, setHasAddedFriend] = useState(false);
  const [showFriendButton, setShowFriendButton] = useState(true);

  // Yetersiz Altın / Hızlı Altın Satın Alma Modalı
  const [showGoldModal, setShowGoldModal] = useState(false);
  const [requiredGold, setRequiredGold] = useState(0);
  const [sendingGift, setSendingGift] = useState(false);

  // Canlı Görüşme İçi Mesajlaşma (In-Call Realtime Chat & Auto-Translate)
  const [messages, setMessages] = useState<Array<{
    id: string;
    senderId: string;
    senderName: string;
    originalText: string;
    translatedText: string;
    sourceLang?: string;
    isMine: boolean;
    timestamp: number;
  }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // iOS Safari ve mobil cihazlarda sanal klavye açılmasını pürüzsüz takip et (Visual Viewport API)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const updateKeyboard = () => {
      // iOS Safari'de sanal klavye açıldığında visualViewport.height küçülür
      const offset = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0));
      if (offset > 80) {
        setKeyboardOffset(offset);
      } else {
        setKeyboardOffset(0);
      }
    };

    vv.addEventListener('resize', updateKeyboard);
    vv.addEventListener('scroll', updateKeyboard);
    return () => {
      vv.removeEventListener('resize', updateKeyboard);
      vv.removeEventListener('scroll', updateKeyboard);
    };
  }, []);

  // Profil bilgilerini çek (Altın ve hakları öğrenmek için) ve Partneri bul
  useEffect(() => {
    const fetchData = async () => {
      // 1. Kendi profilimizi çek
      const { data: myData } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (myData) {
        // Hata düzeltme: Eğer eski kayıtlardan 10 kaldıysa anında 2'ye çek ve UI'ı düzelt
        if (myData.free_extensions > 2) {
          myData.free_extensions = 2;
          await supabase.from('profiles').update({ free_extensions: 2 }).eq('id', userId);
        }
        setProfile(myData);
      }

      // 2. Partneri bul (Doğrudan veya eşleşme geçmişinden)
      const targetPId = directPartnerId || (await (async () => {
        const { data: matchData } = await supabase
          .from('match_history')
          .select('caller_id, receiver_id')
          .eq('match_id', channelName)
          .single();
        return matchData ? (matchData.caller_id === userId ? matchData.receiver_id : matchData.caller_id) : null;
      })());
        
      if (targetPId) {
        setPartnerId(targetPId);
        const { data: pData } = await supabase.from('profiles').select('display_name, gender, total_likes, preferred_language').eq('id', targetPId).single();
        if (pData) setPartnerProfile(pData);

        // Beğeni tekil kontrolü: Bu kullanıcı bu partneri daha önce beğendi mi?
        const alreadyLiked = localStorage.getItem(`pyngoo_like_${userId}_${targetPId}`);
        if (alreadyLiked === 'true') {
          setHasLiked(true);
        }

        // Zaten arkadaş mı kontrol et: Arkadaşsa 5 sn "Siz Arkadaşsınız" gösterip kaldır
        try {
          const { data: existingFriend } = await supabase
            .from('friends')
            .select('id')
            .or(`and(user_id_1.eq.${userId},user_id_2.eq.${targetPId}),and(user_id_1.eq.${targetPId},user_id_2.eq.${userId})`)
            .maybeSingle();

          if (existingFriend) {
            setHasAddedFriend(true);
            setShowFriendButton(true);
            setTimeout(() => {
              setShowFriendButton(false);
            }, 5000);
          }
        } catch (_) {}
      }
    };
    fetchData();
  }, [userId, channelName, directPartnerId]);

  // Görüşme aktifken genel alt gezinme menüsünü ve dış kaydırmaları gizle
  useEffect(() => {
    document.body.classList.add('in-call');
    return () => {
      document.body.classList.remove('in-call');
    };
  }, []);

  // Meşgul durumu yönetimi
  const handleBusyState = () => {
    if (isPartnerBusyRef.current || isCallAnsweredRef.current) return;
    setIsPartnerBusy(true);
    isPartnerBusyRef.current = true;
    soundManager.stopOutgoingRingback();
    soundManager.playBusyTone(() => {
      onEndCall();
    });
  };

  // Arayan kişi için arama çalma sesi (Düüüt... düüüt...)
  useEffect(() => {
    if (isDirectCall && isCaller && !isCallAnswered && !isPartnerBusy) {
      soundManager.startOutgoingRingback();
    } else {
      soundManager.stopOutgoingRingback();
    }
    return () => {
      soundManager.stopOutgoingRingback();
    };
  }, [isDirectCall, isCaller, isCallAnswered, isPartnerBusy]);

  // Cevapsız kalırsa 40 saniye sonra meşgul/zaman aşımıyla sonlandır
  useEffect(() => {
    if (isDirectCall && isCaller && !isCallAnswered && !isPartnerBusy) {
      const timeout = setTimeout(() => {
        if (!isCallAnsweredRef.current && !isPartnerBusyRef.current) {
          handleBusyState();
        }
      }, 40000);
      return () => clearTimeout(timeout);
    }
  }, [isDirectCall, isCaller, isCallAnswered, isPartnerBusy]);

  // Arayan tarafta meşgul ve ret sinyallerini dinleme
  useEffect(() => {
    if (!isDirectCall || !isCaller) return;
    const sub = supabase.channel(`vc_caller_sub_${userId}_${channelName}`)
      .on('broadcast', { event: 'direct_call_busy' }, () => {
        handleBusyState();
      })
      .on('broadcast', { event: 'direct_call_rejected' }, () => {
        soundManager.stopOutgoingRingback();
        onEndCall();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'match_history',
        filter: `match_id=eq.${channelName}`
      }, (payload: any) => {
        if (payload?.new?.status === 'busy') {
          handleBusyState();
        } else if (payload?.new?.status === 'rejected') {
          soundManager.stopOutgoingRingback();
          onEndCall();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [isDirectCall, isCaller, userId, channelName]);

  const channelRef = useRef<any>(null);

  // Süre uzatma ve arama senkronizasyonu için Broadcast kanalı
  useEffect(() => {
    channelRef.current = supabase.channel(`room_${channelName}`)
      .on('broadcast', { event: 'direct_call_connected' }, () => {
        soundManager.stopOutgoingRingback();
        if (!isCallAnsweredRef.current) {
          setIsCallAnswered(true);
          isCallAnsweredRef.current = true;
        }
      })
      .on('broadcast', { event: 'direct_call_busy' }, () => {
        handleBusyState();
      })
      .on('broadcast', { event: 'direct_call_rejected' }, () => {
        soundManager.stopOutgoingRingback();
        onEndCall();
      })
      .on('broadcast', { event: 'extend_time' }, () => {
        setTimeLeft((prev) => (prev <= 0 ? 60 + prev : prev + 60));
      })
      .on('broadcast', { event: 'direct_call_ended' }, () => {
        onEndCall();
      })
      .on('broadcast', { event: 'gift' }, (payload: any) => {
        setActiveGiftAnimation(payload.payload.giftEmoji);
        setTimeout(() => setActiveGiftAnimation(null), 3000);
      })
      .on('broadcast', { event: 'gift_request' }, (payload: any) => {
        const req = payload?.payload;
        if (req) {
          setIncomingGiftRequest(req);
          try { soundManager.playMessageSound(); } catch (_) {}
          // 15 saniye sonra otomatik kapan
          setTimeout(() => {
            setIncomingGiftRequest((curr) => (curr?.giftEmoji === req.giftEmoji ? null : curr));
          }, 15000);
        }
      })
      .on('broadcast', { event: 'like' }, async () => {
        // Karşı taraf beğendiğinde büyük kalp animasyonu göster
        setActiveGiftAnimation('❤️');
        setTimeout(() => setActiveGiftAnimation(null), 3000);

        // Kendi beğeni sayımızı veritabanında +1 artır (Kendi kullanıcımız olduğu için RLS engellemez!)
        setProfile((prev: any) => {
          const currentLikes = prev?.total_likes || 0;
          const updatedLikes = currentLikes + 1;
          supabase
            .from('profiles')
            .update({ total_likes: updatedLikes })
            .eq('id', userId)
            .then(({ error }) => {
              if (error) console.warn('Kendi profil like güncelleme hatası:', error);
            });
          return prev ? { ...prev, total_likes: updatedLikes } : prev;
        });
      })
      .on('broadcast', { event: 'add_friend' }, () => {
        setHasAddedFriend(true);
        setShowFriendButton(true);
        setActiveGiftAnimation('🤝');
        setTimeout(() => setActiveGiftAnimation(null), 3000);
        setSuccessMessage(t("voice_you_are_friends", { defaultValue: "Siz Arkadaşsınız" }));
        setTimeout(() => setSuccessMessage(null), 5000);
        setTimeout(() => setShowFriendButton(false), 5000);
      })
      .on('broadcast', { event: 'chat_message' }, (payload: any) => {
        const msg = payload.payload;
        if (msg && msg.senderId !== userId) {
          const myLang = profile?.preferred_language || (navigator.language?.startsWith('tr') ? 'tr' : 'en');
          const displayMsg = { ...msg, isMine: false };

          // 1. Karşı tarafın mesajını ANINDA (0ms) ekrana bas
          setMessages((prev) => [...prev.slice(-15), displayMsg]);

          // 2. Diller farklıysa ve çeviri gerekiyorsa arka planda asenkron çevir, asla ekrana basmayı bekletme
          const senderLang = (msg.sourceLang || 'tr').substring(0, 2).toLowerCase();
          const targetLang = myLang.substring(0, 2).toLowerCase();
          const needsTranslation = senderLang !== targetLang && (!msg.translatedText || msg.translatedText === msg.originalText);

          if (needsTranslation) {
            translateText(msg.originalText, targetLang, senderLang)
              .then((localTranslated) => {
                if (localTranslated && localTranslated.toLowerCase() !== msg.originalText.toLowerCase()) {
                  setMessages((prev) => 
                    prev.map(m => m.id === msg.id ? { ...m, translatedText: localTranslated } : m)
                  );
                }
              })
              .catch(() => {});
          }
        }
      })
      .on('broadcast', { event: 'skip' }, () => {
        setErrorMessage(t('voice_partner_skipped', { defaultValue: 'Karşı taraf ayrıldı, yeni arama başlatılıyor...' }));
        setTimeout(() => onSkip(), 2000);
      })
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [channelName, t, onSkip, userId, profile]);

  // Yeni mesaj geldiğinde veya karşı taraf yazarken otomatik aşağı kaydır
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Mesaj gönderme fonksiyonu (0ms Işık Hızında İletim + Arka Plan Çevirisi + Bot Yanıtı)
  const handleSendMessage = () => {
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');

    const myLang = profile?.preferred_language || (navigator.language?.startsWith('tr') ? 'tr' : 'en');
    const partnerLang = partnerProfile?.preferred_language;

    const msgPayload = {
      id: generateUUID(),
      senderId: userId,
      senderName: profile?.display_name || 'Sen',
      originalText: text,
      translatedText: text,
      sourceLang: myLang,
      timestamp: Date.now()
    };

    // 1. Kendi ekranımıza ANINDA (0ms) ekle
    setMessages((prev) => [...prev.slice(-15), { ...msgPayload, isMine: true }]);

    // 2. Karşı tarafa WebSocket ile ANINDA (10ms) ilet
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'chat_message',
        payload: msgPayload
      });
    }

    // 3. Eğer partner dili biliniyorsa ve farklıysa arka planda çevirip güncelle
    if (partnerLang && partnerLang.substring(0, 2).toLowerCase() !== myLang.substring(0, 2).toLowerCase()) {
      translateText(text, partnerLang, myLang)
        .then((translated) => {
          if (translated && translated !== text) {
            setMessages((prev) => 
              prev.map(m => m.id === msgPayload.id ? { ...m, translatedText: translated } : m)
            );
          }
        })
        .catch(() => {});
    }

  };

  // Görüşme içinden markete yönlendirme
  const handleRedirectToMarket = () => {
    setShowGoldModal(false);
    window.location.href = '/market';
  };

  useEffect(() => {
    let agoraClient: IAgoraRTCClient;
    let audioTrack: IMicrophoneAudioTrack | null = null;
    let videoTrack: ICameraVideoTrack | null = null;
    let isMounted = true;

    const initAgora = async () => {

      if (!appId) {
        if (isMounted) setErrorMessage('Agora App ID eksik. Lütfen .env dosyasını kontrol et ve sunucuyu yeniden başlat.');
        return;
      }

      agoraClient = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      agoraClient.on('user-published', async (user, mediaType) => {
        await agoraClient.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          user.audioTrack?.play();
        }
        if (mediaType === 'video') {
          setRemoteVideoTrack(user.videoTrack || null);
        }

        // Karşı taraf açtı/bağlandı! (Telefon Mantığı: Karşı taraf açınca altın düşmeye başlar)
        if (isDirectCall && !isCallAnsweredRef.current) {
          setIsCallAnswered(true);
          isCallAnsweredRef.current = true;

          if (channelRef.current) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'direct_call_connected'
            });
          }

          if (isCaller) {
            // Arayandan ilk 60 saniye için 120 altın peşin tahsil edilir ve karşı taraf kadınsa 30 elmas aktarılır
            const targetPId = directPartnerIdRef.current;
            if (targetPId) {
              supabase.rpc('reward_direct_call_start', {
                p_caller_id: userId,
                p_receiver_id: targetPId,
                p_gold_cost: 120,
                p_diamond_reward: 30
              }).then(({ data: rpcRes, error: rpcErr }) => {
                if (rpcErr || (rpcRes && !rpcRes.success)) {
                  console.warn('reward_direct_call_start RPC fallback:', rpcErr || rpcRes?.error);
                  const latestGold = profileRef.current?.total_gold || 0;
                  if (latestGold >= 120) {
                    const nextGold = latestGold - 120;
                    supabase.from('profiles').update({ total_gold: nextGold }).eq('id', userId).gte('total_gold', 120).then(({ error }) => {
                      if (!error) {
                        setProfile((p: any) => ({ ...p, total_gold: nextGold }));
                      }
                    });
                  }
                } else if (rpcRes?.new_gold !== undefined) {
                  setProfile((p: any) => ({ ...p, total_gold: rpcRes.new_gold }));
                }
              });
              logTransaction(userId, -120, 'call_cost', { targetUserId: targetPId, details: '60 sn Arama Peşin' });
              logTransaction(targetPId, 30, 'call_earning', { targetUserId: userId, details: '%25 Kadın Payı' });
            }
          }
        }
      });

      agoraClient.on('user-unpublished', (_user, mediaType) => {
        if (mediaType === 'video') {
          setRemoteVideoTrack(null);
        }
      });

      agoraClient.on('user-left', () => {
        if (!isMounted) return;
        setErrorMessage('Karşı taraf görüşmeden ayrıldı...');
        setTimeout(() => {
          if (isMounted) onSkip();
        }, 2000);
      });

      try {
        const uid = Math.floor(Math.random() * 10000);
        const privilegeExpiredTs = Math.floor(Date.now() / 1000) + 3600;
        
        let token: string | null = null;

        // GÜVENLİK: Önce sunucu tarafı Edge Function'dan token al
        // (Agora App Certificate istemciye inmek zorunda kalmaz).
        try {
          const { data: tokenRes, error: tokenErr } = await supabase.functions.invoke('agora-token', {
            body: { channelName, uid, expireSeconds: 3600 }
          });
          if (!tokenErr && tokenRes?.token) {
            token = tokenRes.token;
          } else if (tokenErr) {
            console.warn('agora-token Edge Function yok/yanıt vermedi, yerel üretime düşülüyor:', tokenErr.message);
          }
        } catch (_) { /* Edge Function erişilemezse yerel üretime düş */ }

        if (!token && appCertificate) {
          try {
            // @ts-ignore
            token = RtcTokenBuilder.buildTokenWithUid(
              appId, 
              appCertificate, 
              channelName, 
              uid, 
              RtcRole.PUBLISHER, 
              privilegeExpiredTs,
              privilegeExpiredTs
            );
          } catch (tokErr) {
            console.warn('Agora token üretilemedi, tokensiz bağlanılıyor:', tokErr);
            token = null;
          }
        }

        await agoraClient.join(appId, channelName, token, uid);
        
        const audioConfig: any = {
          encoderConfig: 'speech_standard', // Konuşma için optimize edilmiş kristal netliğinde 32kbps mono Opus ses
          AEC: true, // Yankı engelleme (Echo Cancellation)
          ANS: true, // Gürültü engelleme (Noise Suppression: dip gürültü, cızırtı ve fan sesini filtreler)
          AGC: true  // Otomatik ses kazancı kontrolü (Ses patlamalarını dengeler)
        };

        if (mode === 'video') {
          const [aTrack, vTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(audioConfig, {
            encoderConfig: '480p_1'
          });
          audioTrack = aTrack;
          videoTrack = vTrack;
          
          if (!isMounted) {
            audioTrack.close();
            videoTrack.close();
            agoraClient.leave();
            return;
          }
          
          setLocalAudioTrack(audioTrack);
          setLocalVideoTrack(videoTrack);
          await agoraClient.publish([audioTrack, videoTrack]);
        } else {
          audioTrack = await AgoraRTC.createMicrophoneAudioTrack(audioConfig);
          
          if (!isMounted) {
            audioTrack.close();
            agoraClient.leave();
            return;
          }

          setLocalAudioTrack(audioTrack);
          await agoraClient.publish([audioTrack]);
        }
        
        setIsConnected(true);
      } catch (error: any) {
        if (!isMounted) return;
        if (error?.message?.includes('NotAllowedError') || error?.message?.includes('Permission denied')) {
          setErrorMessage(mode === 'video' ? 'Kamera veya mikrofon izni verilmedi! Lütfen tarayıcıdan izin verin.' : 'Mikrofon izni verilmedi! Lütfen tarayıcıdan mikrofon izni verin.');
        } else if (error?.message?.includes('DEVICE_NOT_FOUND') || error?.message?.includes('NotFoundError')) {
          setErrorMessage(mode === 'video' ? 'Kamera veya mikrofon bulunamadı! Lütfen cihazınızı kontrol edin.' : 'Mikrofon bulunamadı! Lütfen bilgisayarınıza bir mikrofon bağlayın.');
        } else {
          setErrorMessage('Bağlantı hatası: ' + (error?.message || 'Bilinmeyen hata'));
        }
      }
    };

    initAgora();

    return () => {
      isMounted = false;
      if (audioTrack) {
        audioTrack.stop();
        audioTrack.close();
      }
      if (videoTrack) {
        videoTrack.stop();
        videoTrack.close();
      }
      if (agoraClient) {
        agoraClient.leave();
      }
    };
  }, [channelName, mode]);

  // Video track'lerini DOM elemanlarına bağla
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current && !isVideoOff) {
      localVideoTrack.play(localVideoRef.current);
    }
  }, [localVideoTrack, isVideoOff]);

  useEffect(() => {
    if (remoteVideoTrack && remoteVideoRef.current) {
      remoteVideoTrack.play(remoteVideoRef.current);
    }
  }, [remoteVideoTrack]);

  // Görüntülü sohbette 4 saniyelik güvenlik bulanıklığı (Safety Blur) sayacı
  useEffect(() => {
    if (mode !== 'video' || !isBlurred) return;
    const interval = setInterval(() => {
      setBlurTimer((prev) => {
        if (prev <= 1) {
          setIsBlurred(false);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [mode, isBlurred]);

  useEffect(() => {
    const timer = setInterval(() => {
      // Doğrudan aramalarda karşı taraf açana kadar süre başlamaz (telefon mantığı)
      if (isDirectCall && !isCallAnsweredRef.current) {
        return;
      }

      setTimeLeft((prev) => {
        // Süre 1 saniyeye indiğinde (dakika dolduğunda)
        if (prev <= 1) {
          if (isDirectCall) {
            if (isCaller) {
              // Arayan taraf: 61. saniyeye (2. dakikaya) girildiği an 120 altın direkt kesilir
              const latestGold = profileRef.current?.total_gold || 0;
              if (latestGold >= 120) {
                const targetPId = directPartnerIdRef.current;
                if (targetPId) {
                  supabase.rpc('reward_direct_call_start', {
                    p_caller_id: userId,
                    p_receiver_id: targetPId,
                    p_gold_cost: 120,
                    p_diamond_reward: 30
                  }).then(({ data: rpcRes, error: rpcErr }) => {
                    if (rpcErr || (rpcRes && !rpcRes.success)) {
                      console.warn('reward_direct_call_start per-minute fallback:', rpcErr || rpcRes?.error);
                      const nextGold = latestGold - 120;
                      supabase.from('profiles').update({ total_gold: nextGold }).eq('id', userId).gte('total_gold', 120).then(({ error }) => {
                        if (!error) {
                          setProfile((p: any) => ({ ...p, total_gold: nextGold }));
                        }
                      });
                    } else if (rpcRes?.new_gold !== undefined) {
                      setProfile((p: any) => ({ ...p, total_gold: rpcRes.new_gold }));
                    }
                  });
                  logTransaction(userId, -120, 'call_cost', { targetUserId: targetPId, details: '+60 sn Arama Uzatma' });
                  logTransaction(targetPId, 30, 'call_earning', { targetUserId: userId, details: '%25 Kadın Payı (+60 sn)' });
                }

                // Sayacı güncelle
                const nextGold = latestGold - 120;
                const updated = { ...(profileRef.current || {}), total_gold: nextGold };
                setProfile(updated);
                profileRef.current = updated;

                // Karşı tarafa da sürenin uzatıldığını bildir
                if (channelRef.current) {
                  channelRef.current.send({
                    type: 'broadcast',
                    event: 'extend_time',
                  });
                }

                // Sayacı yeni 60 saniyeye resetle
                return 60;
              } else {
                // Yetersiz altın: 2. dakikaya başlanamaz, görüşmeyi hemen sonlandır
                if (channelRef.current) {
                  channelRef.current.send({
                    type: 'broadcast',
                    event: 'direct_call_ended',
                  });
                }
                setTimeout(() => onEndCallRef.current(), 0);
                return 0;
              }
            } else {
              // Alıcı taraf: Karşı taraf arayan kişidir, altın onda kesilir.
              // Arayan tarafın süreyi uzatması ve ağ gecikmesi için 6 saniyelik tolerans tanı
              if (prev > -5) {
                return prev - 1;
              }
              setTimeout(() => onEndCallRef.current(), 0);
              return 0;
            }
          } else {
            // Eşleşme modu: Süre dolunca görüşmeyi bitir
            setTimeout(() => onEndCallRef.current(), 0);
            return 0;
          }
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isDirectCall, isCaller, userId]);

  // Sayfa arka plana atıldığında (minimize edildiğinde) güvenliği sağlamak için anında görüşmeyi kapat
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        onEndCall();
      }
    };
    
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [onEndCall]);

  const toggleMute = () => {
    if (localAudioTrack) {
      localAudioTrack.setMuted(!isMuted);
      setIsMuted(!isMuted);
    } else {
      setErrorMessage("Mikrofon bulunamadığı için ses kapatıp açılamıyor.");
    }
  };

  const toggleVideo = () => {
    if (localVideoTrack) {
      localVideoTrack.setEnabled(isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);

  // Ön / Arka Kamera Değiştir (Flip Camera - Tek tıkta garantili ön/arka geçişi)
  const switchCamera = async () => {
    if (!localVideoTrack || isSwitchingCamera) return;
    setIsSwitchingCamera(true);
    try {
      const cameras = await AgoraRTC.getCameras();
      if (!cameras || cameras.length === 0) return;

      const isFront = (c: MediaDeviceInfo) => {
        const l = (c.label || '').toLowerCase();
        return l.includes('front') || l.includes('ön') || l.includes('user') || l.includes('facetime') || l.includes('selfie');
      };
      const isBack = (c: MediaDeviceInfo) => {
        const l = (c.label || '').toLowerCase();
        return l.includes('back') || l.includes('rear') || l.includes('arka') || l.includes('environment');
      };

      const frontCams = cameras.filter(isFront);
      const backCams = cameras.filter(isBack);

      let targetDevice: MediaDeviceInfo | undefined;

      if (isFrontCamera) {
        // Şu an ön kameradayız -> Arka kameraya geç (birden fazla arka lens varsa ilk ana lensi seç)
        targetDevice = backCams[0] || cameras.find(c => !isFront(c)) || cameras[cameras.length - 1];
      } else {
        // Şu an arka kameradayız -> Ön kameraya dön (tek tıkta kesin dönüş)
        targetDevice = frontCams[0] || cameras.find(isFront) || cameras[0];
      }

      if (targetDevice) {
        await localVideoTrack.setDevice(targetDevice.deviceId);
        setIsFrontCamera(!isFrontCamera);
      }
    } catch (err) {
      console.error('Kamera çevirme hatası:', err);
    } finally {
      setIsSwitchingCamera(false);
    }
  };



  const submitReport = async () => {
    // Kategori veya açıklama varsa gönderilebilir
    const finalReason = reportReason.trim() ? reportReason.trim() : reportCategory;

    // Partner ID tespiti
    let targetPartnerId = partnerId;
    if (!targetPartnerId) {
      try {
        const { data: matchData } = await supabase
          .from('match_history')
          .select('caller_id, receiver_id')
          .eq('match_id', channelName)
          .single();
        if (matchData) {
          targetPartnerId = matchData.caller_id === userId ? matchData.receiver_id : matchData.caller_id;
        }
      } catch (_) {}
    }

    if (!targetPartnerId) {
      targetPartnerId = 'unknown_partner';
    }

    const payload = {
      reporterId: userId,
      reporterName: profile?.display_name || 'Anonim',
      reportedId: targetPartnerId,
      reportedName: partnerProfile?.display_name || 'Kullanıcı',
      category: reportCategory,
      reason: reportReason.trim(),
      matchId: channelName,
      evidenceSnapshot: evidenceSnapshot
    };

    // 1. Telegram Bildirimini Anında Ateşle (Arka Planda)
    sendReportToTelegram(payload).catch((err) => console.warn('Telegram bildirim hatası:', err));

    // 2. Supabase Veritabanına Kaydet
    try {
      const { error: insErr } = await supabase.from('reports').insert([
        { 
          reporter_id: userId, 
          reported_user_id: targetPartnerId, 
          category: reportCategory,
          reason: finalReason,
          status: 'pending',
          snapshot_data: evidenceSnapshot
        }
      ]);
      if (insErr) throw insErr;
    } catch (err) {
      console.warn('Supabase reports tablosuna yazılamadı, yerel yedek alınıyor:', err);
      // Yerel hafızaya kaydet
      const localReports = JSON.parse(localStorage.getItem('pyngoo_local_reports') || '[]');
      localReports.unshift({
        id: `local_${Date.now()}`,
        reporter_id: userId,
        reported_user_id: targetPartnerId,
        category: reportCategory,
        reason: finalReason,
        status: 'pending',
        snapshot_data: evidenceSnapshot,
        created_at: new Date().toISOString(),
        reporter_name: profile?.display_name || 'Anonim',
        reported_name: partnerProfile?.display_name || 'Kullanıcı'
      });
      localStorage.setItem('pyngoo_local_reports', JSON.stringify(localReports));
    }

    setShowReportModal(false);
    setSuccessMessage(t("voice_report_success"));
    
    // Görüşmeyi anında sonlandır
    setTimeout(() => {
      onEndCall();
    }, 1500);
  };

  const handleExtend = async () => {
    if (!profile || isExtending) return;
    setIsExtending(true);

    try {
      // 1. Veritabanından güncel bakiye ve hakları doğrula
      const { data: freshProf } = await supabase.from('profiles').select('free_extensions, total_gold').eq('id', userId).single();
      const currentExt = freshProf?.free_extensions ?? profile.free_extensions ?? 0;
      const currentGold = freshProf?.total_gold ?? profile.total_gold ?? 0;

      if (currentExt > 0) {
        // Ücretsiz uzat (Güvenli koşullu düşme)
        const newExt = currentExt - 1;
        const { error: extErr } = await supabase.from('profiles').update({ free_extensions: newExt }).eq('id', userId).gte('free_extensions', 1);
        if (extErr) {
          setIsExtending(false);
          return;
        }
        setProfile({ ...profile, free_extensions: newExt });
      } else {
        // Altınla uzat (Güvenli RPC: Hem gönderenden altın düşer, hem partner kadınsa 5 elmas aktarır)
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('reward_call_extension', {
          p_sender_id: userId,
          p_partner_id: partnerId,
          p_gold_cost: 20,
          p_diamond_reward: 5
        });

        if (rpcErr || (rpcRes && !rpcRes.success)) {
          console.warn('reward_call_extension RPC fallback:', rpcErr || rpcRes?.error);
          if (currentGold < 20) {
            setErrorMessage(t('voice_not_enough_gold'));
            setProfile({ ...profile, total_gold: currentGold });
            setIsExtending(false);
            return;
          }
          const newGold = currentGold - 20;
          const { error: goldErr } = await supabase.from('profiles').update({ total_gold: newGold }).eq('id', userId).gte('total_gold', 20);
          if (goldErr) {
            setIsExtending(false);
            return;
          }
          setProfile({ ...profile, total_gold: newGold });
        } else {
          const updatedGold = rpcRes?.new_gold !== undefined ? rpcRes.new_gold : currentGold - 20;
          setProfile({ ...profile, total_gold: updatedGold });
        }
      }

      // Senkronizasyon (Hem kendine hem karşıya +60 ekle)
      setTimeLeft((prev) => prev + 60);
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'extend_time',
        });
      }

    } catch (err) {
      console.error('Uzatma hatası:', err);
      alert(t('voice_extend_failed'));
    } finally {
      setIsExtending(false);
    }
  };

  const handleSendGift = async (goldCost: number, diamondReward: number, giftEmoji: string) => {
    if (!profile || !partnerId || sendingGift) return;

    if ((profile.total_gold || 0) < goldCost) {
      setRequiredGold(goldCost);
      setShowGiftMenu(false);
      setShowGoldModal(true);
      return;
    }

    setSendingGift(true);
    try {
      // 1. Güvenli RPC transferini çağır (Atomik altın düşme ve alıcı kadınsa elmas aktarma)
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('send_gift_transaction', {
        p_sender_id: userId,
        p_receiver_id: partnerId,
        p_gold_cost: goldCost,
        p_diamond_reward: diamondReward
      });

      if (rpcErr || (rpcRes && !rpcRes.success)) {
        console.warn('send_gift_transaction RPC fallback:', rpcErr || rpcRes?.error);
        const { data: freshProf } = await supabase.from('profiles').select('total_gold').eq('id', userId).single();
        const currentGold = freshProf?.total_gold ?? profile.total_gold ?? 0;

        if (currentGold < goldCost) {
          setRequiredGold(goldCost);
          setProfile({ ...profile, total_gold: currentGold });
          setShowGiftMenu(false);
          setShowGoldModal(true);
          setSendingGift(false);
          return;
        }

        const newGold = currentGold - goldCost;
        const { error: deductErr } = await supabase.from('profiles').update({ total_gold: newGold }).eq('id', userId).gte('total_gold', goldCost);
        if (deductErr) {
          setSendingGift(false);
          return;
        }
        setProfile({ ...profile, total_gold: newGold });
      } else {
        const newGold = rpcRes?.new_gold !== undefined ? rpcRes.new_gold : ((profile.total_gold || goldCost) - goldCost);
        setProfile({ ...profile, total_gold: newGold });
      }

      logTransaction(userId, -goldCost, 'gift_sent', { targetUserId: partnerId || undefined, details: `${giftEmoji} Hediye` });
      if (partnerProfile?.gender === 'kadin' && partnerId) {
        logTransaction(partnerId, diamondReward, 'gift_received', { targetUserId: userId, details: `${giftEmoji} Hediye` });
      }

      // Animasyonu tetikle
      setActiveGiftAnimation(giftEmoji);
      setTimeout(() => setActiveGiftAnimation(null), 3000);
      setShowGiftMenu(false);

      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'gift',
          payload: { giftEmoji }
        });
      }

    } catch (err) {
      console.error('Hediye gönderim hatası:', err);
    }
  };

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

  const handleRequestGift = (giftEmoji: string, giftName: string, cost: number, reward: number) => {
    const now = Date.now();
    if (now - lastGiftRequestTimeRef.current < 25000) {
      const waitSec = Math.ceil((25000 - (now - lastGiftRequestTimeRef.current)) / 1000);
      setErrorMessage(`⚠️ Lütfen tekrar hediye istemek için ${waitSec} saniye bekleyin.`);
      setTimeout(() => setErrorMessage(null), 3000);
      setShowGiftRequestMenu(false);
      return;
    }
    lastGiftRequestTimeRef.current = now;

    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'gift_request',
        payload: {
          giftEmoji,
          giftName,
          cost,
          reward,
          senderName: profile?.display_name?.split(',')[0] || 'Yayıncı'
        }
      });
    }
    setShowGiftRequestMenu(false);
    setSuccessMessage(t('voice_gift_request_toast', { emoji: giftEmoji, name: giftName, defaultValue: `🎀 ${giftEmoji} ${giftName} isteği partnerinize iletildi!` }));
    setTimeout(() => setSuccessMessage(null), 3000);

  };

  const handleLike = async () => {
    if (hasLiked || !partnerId) return;
    localStorage.setItem(`pyngoo_like_${userId}_${partnerId}`, 'true');
    setHasLiked(true);
    setActiveGiftAnimation('❤️');
    setTimeout(() => setActiveGiftAnimation(null), 3000);

    try {
      const currentLikes = partnerProfile?.total_likes || 0;
      const nextLikes = currentLikes + 1;
      setPartnerProfile((prev: any) => ({ ...prev, total_likes: nextLikes }));

      // 1. RPC ile veritabanında artırmayı dene (RLS engelini aşar)
      try {
        await supabase.rpc('increment_user_likes', { target_user_id: partnerId });
      } catch (rpcErr) {
        console.warn('RPC increment_user_likes notice:', rpcErr);
      }

      // 2. Doğrudan update fallback
      try {
        await supabase.from('profiles').update({ total_likes: nextLikes }).eq('id', partnerId);
      } catch (_) {}

      // 3. Karşı tarafa anında canlı beğeni sinyali gönder (Alıcı kendi tarafında da DB'ye yazar)
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'like',
          payload: { nextLikes }
        });
      }
    } catch (err) {
      console.error("Beğeni hatası:", err);
    }
  };

  const handleAddFriend = async () => {
    if (hasAddedFriend || !partnerId || !profile) return;
    
    try {
      // 1. ÖNCE arkadaşlık veya istek var mı diye kontrol et (Hakkını yememek için!)
      const { data: existingFriend } = await supabase
        .from('friends')
        .select('id')
        .or(`and(user_id_1.eq.${userId},user_id_2.eq.${partnerId}),and(user_id_1.eq.${partnerId},user_id_2.eq.${userId})`)
        .maybeSingle();

      if (existingFriend) {
        setHasAddedFriend(true);
        setShowFriendButton(true);
        setSuccessMessage(t("voice_you_are_friends", { defaultValue: "Siz Arkadaşsınız" }));
        setTimeout(() => setSuccessMessage(null), 5000);
        setTimeout(() => setShowFriendButton(false), 5000);
        return; // İşlemi durdur, altın/hak düşme!
      }

      // 2. Kontrolü geçtiysek şimdi ödemeyi/hakkı düş
      if (profile.free_friend_adds > 0) {
        const newFree = profile.free_friend_adds - 1;
        await supabase.from('profiles').update({ free_friend_adds: newFree }).eq('id', userId);
        setProfile({ ...profile, free_friend_adds: newFree });
      } else {
        const cost = 50;
        if (profile.total_gold < cost) {
          setErrorMessage(t("voice_need_gold_for_friend", { cost }));
          setTimeout(() => setErrorMessage(null), 4000);
          return;
        }
        const newGold = profile.total_gold - cost;
        await supabase.from('profiles').update({ total_gold: newGold }).eq('id', userId);
        setProfile({ ...profile, total_gold: newGold });
      }

      // 3. Veritabanına isteği ekle
      const { error } = await supabase.from('friends').insert([{ user_id_1: userId, user_id_2: partnerId }]);
      if (error) throw error;
      
      setHasAddedFriend(true);
      setShowFriendButton(true);
      setSuccessMessage(t("voice_you_are_friends", { defaultValue: "Siz Arkadaşsınız" }));
      setTimeout(() => setSuccessMessage(null), 5000);
      setTimeout(() => setShowFriendButton(false), 5000);
      setActiveGiftAnimation('🤝');
      setTimeout(() => setActiveGiftAnimation(null), 3000);
      
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'add_friend',
        });
      }
    } catch (err: any) {
      console.error("Arkadaş ekleme hatası:", err);
      setErrorMessage(`İstek hatası: ${err.message || err.details || JSON.stringify(err)}`);
    }
  };

  const handleSkipAction = () => {
    // Karşı tarafa 'Ben çıktım' sinyali gönder
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'skip',
      });
    }
    
    // Mikrofonu yerel olarak anında kapat (ses sızıntısını önlemek için)
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
    }
    
    onSkip();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100dvh',
      zIndex: 500,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      background: '#070814'
    }}>
      
      {/* ⚠️ ÖZEL ARAMA: 30 SN KALA YETERSİZ ALTIN UYARISI */}
      {isDirectCall && isCaller && timeLeft <= 30 && timeLeft > 0 && (profile?.total_gold || 0) < 120 && (
        <div style={{
          position: 'absolute',
          top: '76px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1500,
          width: '92%',
          maxWidth: '380px',
          background: 'linear-gradient(135deg, rgba(255, 45, 85, 0.95), rgba(255, 107, 107, 0.95))',
          border: '1px solid rgba(255, 255, 255, 0.4)',
          borderRadius: '18px',
          padding: '12px 16px',
          boxShadow: '0 10px 30px rgba(255, 45, 85, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          color: '#fff',
          backdropFilter: 'blur(10px)',
          animation: 'pulse 1.5s infinite'
        }}>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontWeight: '800', fontSize: '0.86rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>⚠️</span>
              <span>{t('voice_call_low_gold_title', { defaultValue: 'Altınınız 30 sn sonra bitiyor!' })}</span>
            </div>
            <div style={{ fontSize: '0.74rem', opacity: 0.9, marginTop: '2px' }}>
              {t('voice_call_low_gold_desc', { defaultValue: 'Görüşmenin kesilmemesi için altın yükleyin.' })}
            </div>
          </div>
          <button
            onClick={() => setShowGoldModal(true)}
            style={{
              background: 'linear-gradient(135deg, #ffd700, #ff9800)',
              border: 'none',
              color: '#000',
              padding: '9px 14px',
              borderRadius: '12px',
              fontWeight: '900',
              fontSize: '0.82rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            {t('voice_buy_gold_btn', { defaultValue: 'Altın Al 🛒' })}
          </button>
        </div>
      )}

      {/* 📹 MODERN EŞLEŞME & ARAMA EKRANI (SESLİ VE GÖRÜNTÜLÜ ORTAK) */}
      <div className="video-call-box">
        {/* 1. Karşı Tarafın Video Akışı veya Avatarı */}
        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden', zIndex: 1 }}>
          <div ref={remoteVideoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

          {/* Bot Görüntülü Arama Videosu */}
          {partnerProfile?.videoUrl && isCallAnswered ? (
            <video
              src={partnerProfile.videoUrl}
              autoPlay
              playsInline
              loop
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            /* Karşı Tarafın Görüntüsü Henüz Gelmediyse veya Kapattıysa veya Sesli Modsa Avatar Göster */
            (!remoteVideoTrack || isVideoOff || mode === 'voice') && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'radial-gradient(circle at center, #1b1c36 0%, #080914 100%)'
              }}>
                <div style={{ position: 'relative' }}>
                  {isConnected && (
                    <>
                      <div className="sound-wave-ring"></div>
                      <div className="sound-wave-ring"></div>
                    </>
                  )}
                  <img 
                    src={partnerProfile?.avatar || (partnerProfile?.gender === 'kadin' ? femaleAvatar : maleAvatar)} 
                    alt="Avatar" 
                    style={{ width: '130px', height: '130px', borderRadius: '50%', border: '3px solid rgba(0, 242, 254, 0.5)', marginBottom: '14px', boxShadow: '0 10px 30px rgba(0,242,254,0.25)', position: 'relative', zIndex: 5, objectFit: 'cover' }}
                  />
                </div>
                <h3 style={{ color: '#fff', margin: '4px 0 2px', fontSize: '1.2rem', fontWeight: '800' }}>
                  {partnerProfile?.display_name || t('voice_mysterious', { defaultValue: 'Gizemli Kullanıcı' })}
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', fontWeight: '600', margin: 0 }}>
                  {isCallAnswered ? '● Canlı Görüşme' : (isDirectCall ? 'Aranıyor...' : t('voice_connecting'))}
                </p>
              </div>
            )
          )}

            {/* 🛡️ Güvenlik Bulanıklığı (Safety Blur Katmanı) */}
            {isBlurred && (
              <div style={{
                position: 'absolute', inset: 0,
                backdropFilter: 'blur(30px)',
                background: 'rgba(10, 10, 26, 0.55)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: '12px', zIndex: 25, padding: '20px', textAlign: 'center'
              }}>
                <div style={{ background: 'rgba(0, 242, 254, 0.15)', border: '1px solid #00f2fe', color: '#00f2fe', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  {t('video_blur_active')} ({blurTimer}s)
                </div>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.82rem', maxWidth: '280px', margin: 0 }}>
                  Güvenliğiniz için ilk 4 saniye koruma açık başlatıldı.
                </p>
                <button 
                  onClick={() => setIsBlurred(false)}
                  style={{
                    background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                    border: 'none', color: '#000', padding: '8px 20px', borderRadius: '20px',
                    fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(0, 242, 254, 0.4)'
                  }}
                >
                  <Eye size={18} /> {t('video_unblur_btn')}
                </button>
              </div>
            )}
          </div>

          {/* Gelen Hediye İsteği Bildirimi (Erkek Kullanıcının Ekranında Çıkar) */}
          {incomingGiftRequest && (
            <div style={{
              position: 'absolute',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 110,
              width: 'calc(100% - 32px)',
              maxWidth: '390px',
              background: 'linear-gradient(135deg, rgba(28, 12, 38, 0.96) 0%, rgba(15, 12, 30, 0.98) 100%)',
              border: '2px solid rgba(255, 42, 141, 0.8)',
              boxShadow: '0 12px 35px rgba(255, 42, 141, 0.5), 0 0 25px rgba(0,0,0,0.8)',
              borderRadius: '24px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              backdropFilter: 'blur(16px)',
              animation: 'bounceIn 0.35s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '2.4rem', animation: 'giftPop 1.2s infinite' }}>{incomingGiftRequest.giftEmoji}</span>
                <div>
                  <div style={{ color: '#fff', fontSize: '0.85rem', fontWeight: '800' }}>
                    {t('voice_gift_request_incoming', { name: incomingGiftRequest.senderName, defaultValue: `${incomingGiftRequest.senderName} senden istedi:` })}
                  </div>
                  <div style={{ color: '#ffd700', fontSize: '0.90rem', fontWeight: '900' }}>
                    {incomingGiftRequest.giftName} • {incomingGiftRequest.cost} 🪙
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => {
                    handleSendGift(incomingGiftRequest.cost, incomingGiftRequest.reward, incomingGiftRequest.giftEmoji);
                    setIncomingGiftRequest(null);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #ff9800)',
                    border: 'none',
                    borderRadius: '16px',
                    color: '#000',
                    fontWeight: '900',
                    fontSize: '0.82rem',
                    padding: '8px 14px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(255, 215, 0, 0.45)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  🎁 Gönder
                </button>
                <button
                  onClick={() => setIncomingGiftRequest(null)}
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    borderRadius: '50%',
                    width: '28px',
                    height: '28px',
                    color: '#aaa',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Hediye Animasyonu (Ortada Devasa Patlama) */}
          {activeGiftAnimation && (
            <div style={{
              position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%, -50%)',
              fontSize: '6.5rem', zIndex: 100, pointerEvents: 'none',
              animation: 'giftPop 3s ease-out forwards', textShadow: '0 10px 30px rgba(0,0,0,0.7)'
            }}>
              {activeGiftAnimation === '❤️' ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', filter: 'drop-shadow(0 0 35px rgba(255, 45, 85, 0.95))' }}>
                  <Heart size={110} fill="#ff2d55" color="#ff416c" />
                </div>
              ) : (
                activeGiftAnimation
              )}
            </div>
          )}

          {/* 2. ÜST BİLGİ & PIP KONTROLÜ (Floating Top Header) */}
          <div style={{
            position: 'relative', zIndex: 20,
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 14px)',
            paddingLeft: '16px',
            paddingRight: '16px',
            paddingBottom: '8px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%)'
          }}>
            {/* Sol: Partner İsmi & Beğeni & Süre */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
                padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.15)'
              }}>
                <span style={{ color: '#fff', fontWeight: '800', fontSize: '0.92rem' }}>
                  {partnerProfile?.display_name || t('voice_mysterious')}
                </span>
                {partnerProfile?.total_likes !== undefined && (
                  <span style={{ 
                    fontSize: '0.78rem', 
                    color: '#ff416c', 
                    fontWeight: '800',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: 'rgba(255, 65, 108, 0.2)',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 65, 108, 0.35)'
                  }}>
                    <Heart size={12} fill="#ff416c" color="#ff416c" />
                    <span>{partnerProfile.total_likes}</span>
                  </span>
                )}
              </div>

              {/* Sadece Özel Görüşmede Özel Görüşme Rozeti Göster */}
              {isDirectCall && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: 'rgba(255, 45, 85, 0.25)',
                  border: '1px solid rgba(255, 45, 85, 0.5)',
                  backdropFilter: 'blur(8px)',
                  padding: '3px 9px', borderRadius: '12px', width: 'fit-content'
                }}>
                  <span style={{ fontSize: '0.70rem', color: '#ff758c', fontWeight: '800' }}>
                    {t('voice_private_call_badge', '🔒 Özel Görüşme')}
                  </span>
                </div>
              )}

              {/* Süre Rozeti: Eşleşmede her zaman; özel aramada ise yalnızca altın bitmeye yakınsa (< 120) ve son 30 sn ise görünür */}
              {(!isDirectCall || (isCallAnswered && timeLeft <= 30 && (profile?.total_gold || 0) < 120)) && (
                <div 
                  onClick={() => isDirectCall && setShowGoldModal(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    background: timeLeft <= 15 ? 'rgba(255, 65, 108, 0.95)' : 'rgba(255, 107, 0, 0.95)',
                    backdropFilter: 'blur(10px)',
                    padding: '4px 10px', borderRadius: '16px',
                    border: '1.5px solid #fff',
                    color: '#fff', fontWeight: '800', fontSize: '0.82rem',
                    width: 'fit-content',
                    cursor: isDirectCall ? 'pointer' : 'default',
                    animation: 'pulse 1s infinite',
                    boxShadow: isDirectCall ? '0 0 16px rgba(255, 107, 0, 0.7)' : 'none'
                  }}
                >
                  <span>⏱️</span>
                  <span>{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
                  {isDirectCall && (
                    <span style={{ fontSize: '0.68rem', background: '#fff', color: '#ff6b00', padding: '1px 5px', borderRadius: '6px', marginLeft: '3px', fontWeight: '900' }}>
                      + Yükle
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Sağ: Şikayet & Engelleme Butonları & Kullanıcı PIP Kamerası */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setShowBlockModal(true)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,107,107,0.4)',
                    color: '#ff6b6b', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', backdropFilter: 'blur(10px)'
                  }}
                  title={t("voice_block_user")}
                >
                  <UserX size={17} />
                </button>
                {!isDirectCall && (
                  <button
                    onClick={handleOpenReportModal}
                    style={{
                      height: '36px', borderRadius: '18px', padding: '0 10px',
                      background: 'rgba(255,45,85,0.22)', border: '1.2px solid rgba(255,45,85,0.6)',
                      color: '#ff2d55', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '4px', cursor: 'pointer', backdropFilter: 'blur(10px)',
                      fontWeight: '800', fontSize: '0.74rem'
                    }}
                    title={t("voice_report", { defaultValue: "Şikayet Et" })}
                  >
                    <Flag size={15} />
                    <span>{t("voice_report", { defaultValue: "Şikayet Et" })}</span>
                  </button>
                )}
              </div>

              {/* PIP Kendi Kameran */}
              <div style={{
                width: '88px', height: '124px', borderRadius: '16px',
                overflow: 'hidden', border: '2px solid rgba(0, 242, 254, 0.8)',
                background: '#121226', boxShadow: '0 8px 25px rgba(0,0,0,0.7)',
                position: 'relative'
              }}>
                <div ref={localVideoRef} style={{ width: '100%', height: '100%', display: isVideoOff ? 'none' : 'block' }} />
                {isVideoOff && (
                  <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.68rem' }}>
                    <VideoOff size={20} style={{ marginBottom: '4px' }} />
                    <span>{t("voice_off")}</span>
                  </div>
                )}
                {!isVideoOff && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      switchCamera();
                    }}
                    disabled={isSwitchingCamera}
                    style={{
                      position: 'absolute', top: '5px', left: '5px',
                      width: '26px', height: '26px', borderRadius: '50%',
                      background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(0, 242, 254, 0.7)',
                      color: '#00f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', zIndex: 35,
                      transform: isSwitchingCamera ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.3s'
                    }}
                    title={t("voice_switch_camera")}
                  >
                    <SwitchCamera size={13} />
                  </button>
                )}
                <div style={{ position: 'absolute', bottom: '2px', left: 0, right: 0, textAlign: 'center', fontSize: '0.62rem', background: 'rgba(0,0,0,0.65)', color: 'white', fontWeight: 'bold', padding: '1px 0' }}>
                  Sen
                </div>
              </div>
            </div>
          </div>

          {/* Ortadaki Bildirim Toast'ları */}
          <div style={{ position: 'relative', zIndex: 20, padding: '0 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {successMessage && (
              <div style={{ background: 'rgba(46, 204, 113, 0.9)', color: '#fff', padding: '8px 16px', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 4px 15px rgba(0,0,0,0.4)', textAlign: 'center' }}>
                {successMessage}
              </div>
            )}
            {errorMessage && (
              <div style={{ background: 'rgba(255, 45, 85, 0.9)', color: '#fff', padding: '8px 16px', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.85rem', boxShadow: '0 4px 15px rgba(0,0,0,0.4)', textAlign: 'center' }}>
                {errorMessage}
              </div>
            )}
          </div>


          {/* Çalıyor / Bağlanıyor / Meşgul Ekranı (Telefon Mantığı: Karşı taraf açana kadar süre başlamaz) */}
          {isDirectCall && !isCallAnswered && (
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(10, 10, 20, 0.94)',
              backdropFilter: 'blur(16px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              zIndex: 45, padding: '24px'
            }}>
              <div style={{
                width: '100px', height: '100px', borderRadius: '50%',
                background: isPartnerBusy 
                  ? 'linear-gradient(135deg, #ff416c, #ff4b2b)' 
                  : 'linear-gradient(135deg, #00f2fe, #4facfe)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '20px',
                boxShadow: isPartnerBusy
                  ? '0 0 35px rgba(255, 65, 108, 0.5)'
                  : '0 0 35px rgba(0, 242, 254, 0.45)',
                animation: isPartnerBusy ? 'none' : 'pulse 1.5s infinite'
              }}>
                <span style={{ fontSize: '2.5rem' }}>{isPartnerBusy ? '📵' : '📞'}</span>
              </div>
              <h3 style={{ color: '#fff', fontSize: '1.35rem', fontWeight: '800', marginBottom: '8px', textAlign: 'center' }}>
                {partnerProfile?.display_name || t('voice_mysterious')}
              </h3>
              <p style={{ 
                color: isPartnerBusy ? '#ff6b6b' : '#00f2fe', 
                fontSize: isPartnerBusy ? '1rem' : '0.92rem', 
                fontWeight: 'bold', 
                marginBottom: '32px', 
                textAlign: 'center',
                maxWidth: '300px',
                lineHeight: '1.4'
              }}>
                {isPartnerBusy 
                  ? 'Kullanıcı şu anda başka bir görüşmede (Meşgul)...'
                  : (isCaller ? 'Çalıyor... (Açıldığında süre başlayacaktır)' : 'Bağlanıyor...')}
              </p>
              <button
                onClick={() => {
                  soundManager.stopOutgoingRingback();
                  onEndCall();
                }}
                style={{
                  padding: '13px 30px', borderRadius: '24px',
                  background: 'linear-gradient(135deg, #ff2d55, #ff416c)',
                  border: 'none', color: '#fff', fontWeight: '800',
                  fontSize: '0.95rem', cursor: 'pointer',
                  boxShadow: '0 6px 20px rgba(255, 45, 85, 0.4)',
                  display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                <PhoneOff size={18} />
                Aramayı Kapat
              </button>
            </div>
          )}

          {/* CANLI GÖRÜŞME İÇİ SOHBET AKIŞI (OTOMATİK ÇEVİRİ DESTEKLİ SAYDAM MESAJLAR) */}
          <div style={{
            position: 'absolute',
            bottom: keyboardOffset > 0 ? `${keyboardOffset + 98}px` : '228px',
            left: '12px',
            width: 'calc(100% - 24px)',
            maxWidth: '320px',
            maxHeight: keyboardOffset > 0 ? '110px' : '120px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            zIndex: 35,
            pointerEvents: 'none',
            transition: 'bottom 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {messages.map((m) => {
              const isMine = m.isMine;
              const isTranslated = m.translatedText && m.translatedText.trim().toLowerCase() !== m.originalText.trim().toLowerCase();

              return (
                <div
                  key={m.id}
                  style={{
                    background: isMine ? 'rgba(0, 242, 254, 0.22)' : 'rgba(0, 0, 0, 0.60)',
                    backdropFilter: 'blur(8px)',
                    border: isMine ? '1px solid rgba(0, 242, 254, 0.45)' : '1px solid rgba(255, 255, 255, 0.16)',
                    borderRadius: '14px',
                    padding: '5px 10px',
                    maxWidth: '88%',
                    alignSelf: isMine ? 'flex-end' : 'flex-start',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
                    pointerEvents: 'auto',
                    animation: 'fadeIn 0.2s ease'
                  }}
                >
                  <div style={{ fontSize: '0.65rem', fontWeight: '800', color: isMine ? '#00f2fe' : '#ff416c', marginBottom: '1px' }}>
                    {isMine ? 'Sen' : m.senderName}
                  </div>
                  
                  {/* Ana Metin */}
                  <div style={{ fontSize: '0.82rem', color: '#fff', fontWeight: isMine ? '600' : '700', lineHeight: '1.25' }}>
                    {isMine ? m.originalText : (isTranslated ? m.translatedText : m.originalText)}
                  </div>

                  {/* Otomatik Çeviri Alt Bilgisi */}
                  {isTranslated && (
                    <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span>🌐</span>
                      <span>{isMine ? `(${m.translatedText})` : `${t('chat_original', 'Orijinal')}: "${m.originalText}"`}</span>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* HIZLI HEDİYE ÇİPLERİ (KADINLAR İÇİN HEDİYE İSTE / ERKEKLER İÇİN HEDİYE GÖNDER) */}
          <div style={{
            position: 'absolute',
            bottom: keyboardOffset > 0 ? `${keyboardOffset + 58}px` : '186px',
            left: '12px',
            zIndex: 35,
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            transition: 'bottom 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {isFemale ? (
              <>
                <button
                  onClick={() => handleRequestGift('🌹', t('gift_rose'), 10, 3)}
                  style={{
                    background: 'rgba(255, 45, 85, 0.32)',
                    border: '1px solid rgba(255, 45, 85, 0.7)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '14px',
                    padding: '3px 8px',
                    color: '#fff',
                    fontSize: '0.70rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(255, 45, 85, 0.4)',
                    transition: 'transform 0.15s'
                  }}
                  title={t('voice_chip_rose_request', 'Gül İste')}
                >
                  <span>🌹</span>
                  <span style={{ color: '#ff80ab', fontSize: '0.68rem' }}>{t('voice_chip_rose_request', 'Gül İste')}</span>
                </button>

                <button
                  onClick={() => handleRequestGift('☕', t('gift_coffee'), 20, 6)}
                  style={{
                    background: 'rgba(255, 152, 0, 0.32)',
                    border: '1px solid rgba(255, 152, 0, 0.7)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '14px',
                    padding: '3px 8px',
                    color: '#fff',
                    fontSize: '0.70rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(255, 152, 0, 0.4)',
                    transition: 'transform 0.15s'
                  }}
                  title={t('voice_chip_coffee_request', 'Kahve İste')}
                >
                  <span>☕</span>
                  <span style={{ color: '#ffb74d', fontSize: '0.68rem' }}>{t('voice_chip_coffee_request', 'Kahve İste')}</span>
                </button>

                <button
                  onClick={() => handleRequestGift('🧸', t('gift_bear'), 100, 30)}
                  style={{
                    background: 'rgba(156, 39, 176, 0.32)',
                    border: '1px solid rgba(156, 39, 176, 0.7)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '14px',
                    padding: '3px 8px',
                    color: '#fff',
                    fontSize: '0.70rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(156, 39, 176, 0.4)',
                    transition: 'transform 0.15s'
                  }}
                  title={t('voice_chip_bear_request', 'Ayıcık İste')}
                >
                  <span>🧸</span>
                  <span style={{ color: '#ce93d8', fontSize: '0.68rem' }}>{t('voice_chip_bear_request', 'Ayıcık İste')}</span>
                </button>

                <button
                  onClick={() => setShowGiftRequestMenu(true)}
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 42, 141, 0.4), rgba(255, 82, 119, 0.4))',
                    border: '1px solid #ff2a8d',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '14px',
                    padding: '3px 8px',
                    color: '#ff758c',
                    fontSize: '0.70rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(255, 42, 141, 0.35)'
                  }}
                  title={t('voice_gift_request_title', 'Hediye İste')}
                >
                  <span>🎀</span>
                  <span>{t('voice_gift_request', 'Hediye İste')}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleSendGift(10, 3, '🌹')}
                  style={{
                    background: 'rgba(255, 45, 85, 0.28)',
                    border: '1px solid rgba(255, 45, 85, 0.65)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '14px',
                    padding: '3px 8px',
                    color: '#fff',
                    fontSize: '0.70rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(255, 45, 85, 0.35)',
                    transition: 'transform 0.15s'
                  }}
                  title="Gül Gönder (10 Altın)"
                >
                  <span>🌹</span>
                  <span style={{ color: '#ffd700', fontSize: '0.68rem' }}>10🪙</span>
                </button>

                <button
                  onClick={() => handleSendGift(20, 6, '☕')}
                  style={{
                    background: 'rgba(255, 152, 0, 0.28)',
                    border: '1px solid rgba(255, 152, 0, 0.65)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '14px',
                    padding: '3px 8px',
                    color: '#fff',
                    fontSize: '0.70rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(255, 152, 0, 0.35)',
                    transition: 'transform 0.15s'
                  }}
                  title="Kahve Ismarla (20 Altın)"
                >
                  <span>☕</span>
                  <span style={{ color: '#ffd700', fontSize: '0.68rem' }}>20🪙</span>
                </button>

                <button
                  onClick={() => handleSendGift(100, 30, '🧸')}
                  style={{
                    background: 'rgba(156, 39, 176, 0.28)',
                    border: '1px solid rgba(156, 39, 176, 0.65)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '14px',
                    padding: '3px 8px',
                    color: '#fff',
                    fontSize: '0.70rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(156, 39, 176, 0.35)',
                    transition: 'transform 0.15s'
                  }}
                  title="Ayıcık Gönder (100 Altın)"
                >
                  <span>🧸</span>
                  <span style={{ color: '#ffd700', fontSize: '0.68rem' }}>100🪙</span>
                </button>

                <button
                  onClick={() => setShowGiftMenu(true)}
                  style={{
                    background: 'rgba(255, 215, 0, 0.20)',
                    border: '1px solid rgba(255, 215, 0, 0.60)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '14px',
                    padding: '3px 8px',
                    color: '#ffd700',
                    fontSize: '0.70rem',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(255, 215, 0, 0.25)'
                  }}
                  title="Tüm Hediyeler"
                >
                  <span>🎁</span>
                  <span>Hediyeler</span>
                </button>
              </>
            )}
          </div>

          {/* AZAR TARZI: MOBİL VE SAFARİ UYUMLU ŞEFFAF MESAJ GİRİŞ ÇUBUĞU */}
          <form
            action="#"
            onSubmit={(e) => {
              e.preventDefault();
              if (chatInput.trim()) {
                handleSendMessage();
              }
            }}
            style={{
              position: 'absolute',
              bottom: keyboardOffset > 0 ? `${keyboardOffset + 12}px` : '148px',
              left: '12px',
              zIndex: 35,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              width: (keyboardOffset > 0 || isInputFocused) ? 'calc(100% - 24px)' : 'calc(65% - 12px)',
              maxWidth: (keyboardOffset > 0 || isInputFocused) ? '520px' : '240px',
              padding: '6px 12px',
              background: (keyboardOffset > 0 || isInputFocused) ? 'rgba(12, 14, 28, 0.88)' : 'rgba(0, 0, 0, 0.45)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRadius: '24px',
              border: (keyboardOffset > 0 || isInputFocused) ? '1px solid rgba(0, 242, 254, 0.55)' : '1px solid rgba(255, 255, 255, 0.18)',
              boxShadow: (keyboardOffset > 0 || isInputFocused) 
                ? '0 8px 30px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 242, 254, 0.25)' 
                : '0 4px 15px rgba(0, 0, 0, 0.3)',
              transition: 'bottom 0.25s cubic-bezier(0.16, 1, 0.3, 1), width 0.22s ease, background 0.2s ease, border 0.2s ease, box-shadow 0.2s ease'
            }}
          >
            <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>💬</span>
            <input
              ref={chatInputRef}
              type="text"
              enterKeyHint="send"
              autoCapitalize="sentences"
              autoComplete="off"
              placeholder={t('chat_placeholder', 'Mesaj yaz...')}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onFocus={() => {
                setIsInputFocused(true);
                setTimeout(() => window.scrollTo(0, 0), 50);
              }}
              onBlur={() => {
                setIsInputFocused(false);
                setTimeout(() => window.scrollTo(0, 0), 50);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (chatInput.trim()) {
                    handleSendMessage();
                  }
                }
              }}
              style={{
                flex: 1, minWidth: 0,
                background: 'transparent', border: 'none',
                color: '#fff',
                fontSize: '16px', // iOS Safari'nin inputa tıklandığında sayfayı zoom yapmasını engeller!
                outline: 'none',
                padding: '2px 4px',
                lineHeight: '1.3'
              }}
            />
            {chatInput.trim() ? (
              <button
                type="submit"
                style={{
                  width: '30px', height: '30px', borderRadius: '50%', border: 'none',
                  background: 'linear-gradient(135deg, #00f2fe, #4facfe)',
                  color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', flexShrink: 0,
                  boxShadow: '0 2px 8px rgba(0, 242, 254, 0.4)'
                }}
              >
                <Send size={15} />
              </button>
            ) : null}
          </form>

          {/* 3. ALT KONTROLLER (Görselin Altına Yerleşik Kontrol Paneli) */}
          <div style={{
            position: 'relative', zIndex: 20,
            paddingTop: '12px',
            paddingLeft: '10px',
            paddingRight: '10px',
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
            background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 65%, transparent 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
          }}>
            {/* Üst Yardımcı Aksiyonlar (Süre Uzat & Arkadaş Ekle) */}
            <div style={{ display: 'flex', gap: '10px', width: '100%', justifyContent: 'center' }}>
              {isConnected && profile && !isDirectCall && (
                <button 
                  onClick={handleExtend}
                  disabled={isExtending}
                  style={{
                    background: profile.free_extensions > 0 ? 'rgba(0, 242, 254, 0.25)' : 'rgba(255, 215, 0, 0.25)',
                    border: profile.free_extensions > 0 ? '1px solid #00f2fe' : '1px solid #ffd700',
                    borderRadius: '16px', padding: '5px 12px',
                    color: profile.free_extensions > 0 ? '#00f2fe' : '#ffd700',
                    fontWeight: '800', fontSize: '0.75rem',
                    display: 'flex', alignItems: 'center', gap: '5px',
                    cursor: 'pointer', backdropFilter: 'blur(10px)'
                  }}
                >
                  <Clock size={13} />
                  {profile.free_extensions > 0 
                    ? `+60s (${profile.free_extensions} Ücretsiz)` 
                    : `+60s (20 ${t('gold_currency_label')})`}
                </button>
              )}

              {profile && partnerId && showFriendButton && (
                <button 
                  onClick={handleAddFriend}
                  disabled={hasAddedFriend}
                  style={{
                    background: hasAddedFriend ? 'rgba(46, 204, 113, 0.25)' : 'rgba(255, 255, 255, 0.15)',
                    border: hasAddedFriend ? '1px solid #2ecc71' : '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '16px', padding: '5px 12px',
                    color: hasAddedFriend ? '#2ecc71' : '#fff',
                    fontWeight: '800', fontSize: '0.75rem',
                    display: 'flex', alignItems: 'center', gap: '5px',
                    cursor: hasAddedFriend ? 'default' : 'pointer', backdropFilter: 'blur(10px)',
                    transition: 'all 0.3s ease'
                  }}
                >
                  <span>🤝</span>
                  {hasAddedFriend 
                    ? t("voice_you_are_friends", { defaultValue: "Siz Arkadaşsınız" })
                    : t("voice_add_friend", { defaultValue: "Arkadaş Ekle" })}
                </button>
              )}
            </div>

            {/* Ana Buton Çubuğu (Dock: 3 Sol Buton - HEDİYE TAM ORTADA - 3 Sağ Buton) */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', maxWidth: '420px', gap: '6px', padding: '0 4px'
            }}>
              {/* SOL GRUP: Mikrofon, Kamera Aç/Kapa, Kamera Çevir */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Mikrofon (38px) */}
                <button 
                  onClick={toggleMute}
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%', border: 'none',
                    background: isMuted ? 'rgba(255, 65, 108, 0.35)' : 'rgba(255, 255, 255, 0.16)',
                    color: isMuted ? '#ff416c' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    backdropFilter: 'blur(10px)'
                  }}
                  title={isMuted ? t("voice_unmute") : t("voice_mute")}
                >
                  {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                </button>

                {/* Kamera Aç/Kapat (38px) */}
                <button 
                  onClick={toggleVideo}
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%', border: 'none',
                    background: isVideoOff ? 'rgba(255, 65, 108, 0.35)' : 'rgba(255, 255, 255, 0.16)',
                    color: isVideoOff ? '#ff416c' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    backdropFilter: 'blur(10px)'
                  }}
                  title={isVideoOff ? "Kamerayı Aç" : "Kamerayı Kapat"}
                >
                  {isVideoOff ? <VideoOff size={18} /> : <Video size={18} />}
                </button>

                {/* Kamera Değiştir (Flip) (38px) */}
                <button 
                  onClick={switchCamera}
                  disabled={isSwitchingCamera || isVideoOff}
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%', border: 'none',
                    background: isVideoOff ? 'rgba(255,255,255,0.06)' : 'rgba(0, 242, 254, 0.2)',
                    color: isVideoOff ? 'rgba(255,255,255,0.3)' : '#00f2fe',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isVideoOff ? 'default' : 'pointer',
                    backdropFilter: 'blur(10px)',
                    transform: isSwitchingCamera ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.3s'
                  }}
                  title={t("voice_switch_camera")}
                >
                  <SwitchCamera size={18} />
                </button>
              </div>

              {/* TAM ORTADA DEV BUTON: KADINLAR İÇİN HEDİYE İSTE / ERKEKLER İÇİN HEDİYE GÖNDER */}
              {isFemale ? (
                <button 
                  onClick={() => setShowGiftRequestMenu(true)}
                  style={{
                    width: '68px', height: '68px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.6)',
                    background: 'linear-gradient(135deg, #ff2a8d 0%, #ff5277 50%, #ff758c 100%)',
                    color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 0 28px rgba(255, 42, 141, 0.85), 0 8px 20px rgba(0,0,0,0.6)',
                    animation: 'pulse 1.8s infinite',
                    transform: 'scale(1.08)',
                    zIndex: 25,
                    margin: '0 2px'
                  }}
                  title={t('voice_gift_request', 'Hediye İste')}
                >
                  <span style={{ fontSize: '26px', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}>🎀</span>
                  <span style={{ fontSize: '0.58rem', fontWeight: '900', letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: '1px' }}>
                    {t('voice_gift_request', 'HEDİYE İSTE')}
                  </span>
                </button>
              ) : (
                <button 
                  onClick={() => setShowGiftMenu(true)}
                  style={{
                    width: '68px', height: '68px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.5)',
                    background: 'linear-gradient(135deg, #ff0844 0%, #ff4e50 50%, #f857a6 100%)',
                    color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 0 28px rgba(255, 8, 68, 0.85), 0 8px 20px rgba(0,0,0,0.6)',
                    animation: 'pulse 1.8s infinite',
                    transform: 'scale(1.08)',
                    zIndex: 25,
                    margin: '0 2px'
                  }}
                  title={t("voice_gift")}
                >
                  <Gift size={30} style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }} />
                  <span style={{ fontSize: '0.60rem', fontWeight: '900', letterSpacing: '0.5px', textTransform: 'uppercase', marginTop: '1px' }}>
                    {t('voice_gift')}
                  </span>
                </button>
              )}

              {/* SAĞ GRUP: Beğen (❤️), Sonraki Eşleşme (⏭️), Görüşmeyi Bitir (📞) */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {/* Beğen (Kalp) (38px) */}
                <button 
                  onClick={handleLike}
                  disabled={hasLiked}
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%', border: 'none',
                    background: hasLiked ? 'rgba(255, 65, 108, 0.25)' : 'linear-gradient(135deg, #ff0844 0%, #ff4e50 100%)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: hasLiked ? 'default' : 'pointer',
                    boxShadow: hasLiked ? 'none' : '0 4px 16px rgba(255, 8, 68, 0.55)',
                    opacity: hasLiked ? 0.8 : 1,
                    transition: 'all 0.25s'
                  }}
                  title={hasLiked ? t('voice_already_liked', 'Beğenildi') : t("voice_like")}
                >
                  <Heart size={18} fill={hasLiked ? "#ff416c" : "#fff"} color={hasLiked ? "#ff416c" : "#fff"} />
                </button>

                {/* Sonraki Eşleşme (46px Yeşil Buton) */}
                <button 
                  onClick={handleSkipAction}
                  style={{
                    width: '46px', height: '46px', borderRadius: '50%', border: 'none',
                    background: 'linear-gradient(135deg, #11998e, #38ef7d)',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', boxShadow: '0 6px 18px rgba(56, 239, 125, 0.45)'
                  }}
                  title={t("voice_skip")}
                >
                  <SkipForward size={22} />
                </button>

                {/* Görüşmeyi Bitir (38px Kırmızı Buton) */}
                <button 
                  onClick={onEndCall}
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%', border: 'none',
                    background: 'rgba(255, 65, 108, 0.25)', color: '#ff416c',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                    backdropFilter: 'blur(10px)'
                  }}
                  title={t("voice_end")}
                >
                  <PhoneOff size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

      {/* HEDİYE MENÜSÜ (BOTTOM SHEET) */}
      {showGiftMenu && (
        <div 
          onClick={() => setShowGiftMenu(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
            zIndex: 2000, animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '440px',
              background: 'linear-gradient(180deg, #181a32 0%, #0d0e1c 100%)',
              border: '1px solid rgba(255,255,255,0.12)', borderBottom: 'none',
              borderRadius: '28px 28px 0 0',
              padding: '18px 16px calc(env(safe-area-inset-bottom, 0px) + 24px) 16px',
              boxShadow: '0 -15px 50px rgba(0,0,0,0.8)',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            {/* Çekme Çubuğu */}
            <div style={{ width: '42px', height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', margin: '0 auto 12px auto' }} />

            {/* Başlık & Kapat */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.25rem' }}>🎁</span>
                <span style={{ color: '#fff', fontWeight: '800', fontSize: '1.05rem' }}>{t('voice_send_gift', 'Hediye Gönder')}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  background: 'rgba(255, 235, 59, 0.15)', border: '1px solid rgba(255, 235, 59, 0.4)',
                  padding: '4px 10px', borderRadius: '14px', color: '#ffeb3b', fontWeight: '800', fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  <span>🪙</span>
                  <span>{profile?.total_gold || 0} {t('gold_currency_label')}</span>
                </div>

                <button 
                  onClick={() => {
                    setShowGiftMenu(false);
                    setShowGoldModal(true);
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #ffd700, #ff9800)',
                    border: 'none', color: '#000',
                    padding: '4px 10px', borderRadius: '14px',
                    fontWeight: '800', fontSize: '0.78rem',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
                    boxShadow: '0 2px 8px rgba(255, 215, 0, 0.4)'
                  }}
                >
                  <span>+</span>
                  <span>{t('gold_modal_buy_now')}</span>
                </button>

                <button 
                  onClick={() => setShowGiftMenu(false)}
                  style={{
                    width: '30px', height: '30px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)', border: 'none',
                    color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 12 Hediyeli 4x3 Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              maxHeight: '340px',
              overflowY: 'auto',
              padding: '2px'
            }}>
              {gifts.map((gift) => (
                <button
                  key={gift.name}
                  onClick={() => handleSendGift(gift.cost, gift.reward, gift.emoji)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '10px 2px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '2rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>
                    {gift.emoji}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap' }}>
                    {gift.name}
                  </span>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '3px',
                    color: '#ffeb3b', fontSize: '0.75rem', fontWeight: '800'
                  }}>
                    <div style={{ width: '7px', height: '7px', background: '#ffeb3b', borderRadius: '50%' }}></div>
                    {gift.cost}
                  </div>
                </button>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
              Hediyeler partnerinizi destekler ve beğenisini artırır.
            </div>
          </div>
        </div>
      )}

      {/* 🎀 HEDİYE İSTE MENÜSÜ (KADIN KULLANICILAR İÇİN BOTTOM SHEET) */}
      {showGiftRequestMenu && (
        <div 
          onClick={() => setShowGiftRequestMenu(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center',
            zIndex: 2000, animation: 'fadeIn 0.2s ease'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '440px',
              background: 'linear-gradient(180deg, #2a1226 0%, #15091a 100%)',
              border: '1px solid rgba(255, 42, 141, 0.35)', borderBottom: 'none',
              borderRadius: '28px 28px 0 0',
              padding: '18px 16px calc(env(safe-area-inset-bottom, 0px) + 24px) 16px',
              boxShadow: '0 -15px 50px rgba(0,0,0,0.85)',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            {/* Çekme Çubuğu */}
            <div style={{ width: '42px', height: '4px', background: 'rgba(255, 42, 141, 0.4)', borderRadius: '2px', margin: '0 auto 12px auto' }} />

            {/* Başlık & Kapat */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.3rem' }}>🎀</span>
                <div>
                  <div style={{ color: '#fff', fontWeight: '800', fontSize: '1.05rem' }}>{t('voice_gift_request_title', 'Hediye İste')}</div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.72rem' }}>{t('voice_gift_request_subtitle', 'Partnerinizden hediye talep edin')}</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  background: 'rgba(0, 242, 254, 0.15)', border: '1px solid rgba(0, 242, 254, 0.4)',
                  padding: '4px 10px', borderRadius: '14px', color: '#00f2fe', fontWeight: '800', fontSize: '0.8rem',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  <span>💎</span>
                  <span>{profile?.total_diamonds || 0} {t('diamonds', 'Elmas')}</span>
                </div>

                <button 
                  onClick={() => setShowGiftRequestMenu(false)}
                  style={{
                    width: '30px', height: '30px', borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)', border: 'none',
                    color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* 12 Hediyeli 4x3 Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '8px',
              maxHeight: '340px',
              overflowY: 'auto',
              padding: '2px'
            }}>
              {gifts.map((gift) => (
                <button
                  key={gift.name}
                  onClick={() => handleRequestGift(gift.emoji, gift.name, gift.cost, gift.reward)}
                  style={{
                    background: 'rgba(255, 42, 141, 0.08)',
                    border: '1px solid rgba(255, 42, 141, 0.25)',
                    borderRadius: '16px',
                    padding: '10px 2px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '2rem', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }}>
                    {gift.emoji}
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#fff', whiteSpace: 'nowrap' }}>
                    {gift.name}
                  </span>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '3px',
                    color: '#00f2fe', fontSize: '0.72rem', fontWeight: '800'
                  }}>
                    <span>+{gift.reward}💎</span>
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#ffd700' }}>
                    {gift.cost}🪙
                  </div>
                </button>
              ))}
            </div>

            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
              {t('voice_gift_request_hint', '🎀 İstediğiniz hediyeye dokunun, partnerinizin ekranında hediye gönderme butonu belirsin.')}
            </div>
          </div>
        </div>
      )}

      {/* 🪙 YETERSİZ ALTIN / ALTIN SATIN ALMA MODALI */}
      {showGoldModal && (
        <div 
          onClick={() => setShowGoldModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2500,
            animation: 'fadeIn 0.2s ease-out'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'linear-gradient(180deg, #1b1c36 0%, #0c0d1c 100%)',
              padding: '26px 20px', borderRadius: '24px', width: '92%', maxWidth: '390px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.9), 0 0 30px rgba(255, 215, 0, 0.15)',
              border: '1px solid rgba(255, 215, 0, 0.35)',
              textAlign: 'center', position: 'relative'
            }}
          >
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

            <div style={{ fontSize: '3.2rem', marginBottom: '6px' }}>🪙</div>
            <h3 style={{ color: '#ffd700', margin: '0 0 6px 0', fontSize: '1.35rem', fontWeight: '800' }}>
              {isDirectCall ? t('call_gold_topup_title') : t('gold_modal_title')}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.86rem', margin: '0 0 18px 0', lineHeight: '1.4' }}>
              {isDirectCall 
                ? t('call_gold_topup_desc')
                : (requiredGold > 0 
                    ? t('chats_need_gold', { cost: requiredGold })
                    : t('gold_modal_desc', 'Görüşmenizi unutulmaz kılmak için altın yükleyin!'))}
            </p>

            {/* Altın Paketleri (Genişletilmiş Zengin Paketler) */}
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '8px',
              maxHeight: '280px', overflowY: 'auto', paddingRight: '4px', marginBottom: '16px'
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
                  onClick={handleRedirectToMarket}
                  style={{
                    background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)',
                    color: '#fff', padding: '7px 14px', borderRadius: '16px',
                    fontWeight: '800', fontSize: '0.80rem', cursor: 'pointer'
                  }}
                >
                  {i18n.language.startsWith('tr') ? '29.99 ₺' : '$0.99'}
                </button>
              </div>

              {/* Paket 2: 450 Altın (En Popüler) */}
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
                      POPÜLER
                    </span>
                  </div>
                  <div style={{ color: '#ff416c', fontSize: '0.70rem', fontWeight: '700' }}>{t('market_modal_bonus', { count: 150 })}! ({t('market_badge_discount_50')})</div>
                </div>
                <button
                  onClick={handleRedirectToMarket}
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

              {/* Paket 3: 1200 Altın (Süper Avantaj) */}
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
                      EN AVANTAJLI
                    </span>
                  </div>
                  <div style={{ color: '#ffd700', fontSize: '0.70rem', fontWeight: '700' }}>{t('market_modal_bonus', { count: 500 })}! ({t('market_badge_discount_65')})</div>
                </div>
                <button
                  onClick={handleRedirectToMarket}
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

              {/* Paket 4: 2800 Altın (Mega Kasa) */}
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
                  onClick={handleRedirectToMarket}
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
                  onClick={handleRedirectToMarket}
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
                  onClick={handleRedirectToMarket}
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
              onClick={() => setShowGoldModal(false)}
              style={{
                background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem',
                cursor: 'pointer', textDecoration: 'underline'
              }}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}

      {/* ŞİKAYET MODALI (OVERLAY) */}
      {showReportModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000,
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #18192a, #111220)',
            padding: '28px', borderRadius: '24px', width: '92%', maxWidth: '440px',
            boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,45,85,0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '12px', background: 'rgba(255,45,85,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #ff2d55' }}>
                <Flag size={20} color="#ff2d55" />
              </div>
              <h3 style={{ color: 'white', margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>
                {t('voice_report_title')}
              </h3>
            </div>
            
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.4' }}>
              {t('voice_report_desc')}
            </p>

            {/* Kategori Seçim Butonları */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {[
                t('voice_report_cat_nudity'),
                t('voice_report_cat_harassment'),
                t('voice_report_cat_fake'),
                t('voice_report_cat_underage'),
                t('voice_report_cat_other')
              ].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setReportCategory(cat)}
                  style={{
                    padding: '10px 14px', borderRadius: '12px', textAlign: 'left',
                    background: reportCategory === cat ? 'rgba(255, 45, 85, 0.25)' : 'rgba(255,255,255,0.04)',
                    border: reportCategory === cat ? '1.5px solid #ff2d55' : '1px solid rgba(255,255,255,0.1)',
                    color: reportCategory === cat ? '#fff' : 'rgba(255,255,255,0.8)',
                    fontSize: '0.85rem', fontWeight: '700', cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
            
            <textarea 
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder={t("voice_report_additional_placeholder")}
              style={{
                width: '100%', height: '65px',
                background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.15)',
                color: 'white', padding: '12px', borderRadius: '12px',
                marginBottom: '14px', resize: 'none', outline: 'none', fontSize: '0.85rem'
              }}
            />

            {/* Otomatik Kanıt Bilgilendirme Kutusu */}
            {evidenceSnapshot ? (
              <div style={{
                marginBottom: '16px', padding: '10px 14px', borderRadius: '12px',
                background: 'rgba(255, 45, 85, 0.12)', border: '1px solid rgba(255, 45, 85, 0.35)',
                display: 'flex', alignItems: 'center', gap: '12px'
              }}>
                <img 
                  src={evidenceSnapshot} 
                  alt="Kanıt Önizleme" 
                  style={{
                    width: '46px', height: '46px', borderRadius: '8px',
                    objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0
                  }}
                />
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#ff2d55' }}>
                    {t('voice_evidence_captured')}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.65)', marginTop: '2px', lineHeight: '1.3' }}>
                    {t('voice_evidence_desc')}
                  </div>
                </div>
              </div>
            ) : mode === 'video' ? (
              <div style={{
                marginBottom: '16px', padding: '8px 12px', borderRadius: '10px',
                background: 'rgba(255,255,255,0.04)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)',
                textAlign: 'center'
              }}>
                {t('voice_cam_off_note')}
              </div>
            ) : null}
            
            {/* 24 Saatlik İnceleme Taahhüdü (Apple Guideline 1.2 Zorunlu Kuralı) */}
            <div style={{
              marginBottom: '16px', padding: '10px 14px', borderRadius: '12px',
              background: 'rgba(0, 242, 254, 0.08)', border: '1px solid rgba(0, 242, 254, 0.25)',
              fontSize: '0.76rem', color: 'rgba(255,255,255,0.8)', lineHeight: '1.4', textAlign: 'center'
            }}>
              {t('voice_report_24h_commitment')}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowReportModal(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '14px',
                  background: 'rgba(255,255,255,0.08)', border: 'none',
                  color: 'white', cursor: 'pointer', fontWeight: '700', fontSize: '0.9rem'
                }}
              >
                {t('voice_cancel')}
              </button>
              <button 
                onClick={submitReport}
                style={{
                  flex: 1.4, padding: '12px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #ff2d55, #ff416c)',
                  border: 'none',
                  color: 'white', cursor: 'pointer', 
                  fontWeight: '800', fontSize: '0.9rem',
                  boxShadow: '0 4px 15px rgba(255,45,85,0.4)'
                }}
              >
                {t('voice_submit_report')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KULLANICIYI ENGELLE (BLOCK) MODALI */}
      {showBlockModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 3500, animation: 'fadeIn 0.2s ease-out', padding: '20px'
        }}>
          <div style={{
            background: 'linear-gradient(180deg, #20141f 0%, #120b12 100%)',
            border: '1.5px solid rgba(255, 45, 85, 0.4)',
            borderRadius: '24px', padding: '26px', width: '100%', maxWidth: '390px',
            textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.9)'
          }}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '50%',
              background: 'rgba(255, 45, 85, 0.15)', border: '2px solid #ff2d55',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px auto'
            }}>
              <UserX size={28} color="#ff2d55" />
            </div>

            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>
              {t('voice_block_confirm_title')}
            </h3>

            <p style={{ margin: '0 0 22px 0', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', lineHeight: '1.5' }}>
              {t('voice_block_confirm_desc')}
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowBlockModal(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '14px',
                  background: 'rgba(255,255,255,0.08)', border: 'none',
                  color: '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '0.88rem'
                }}
              >
                {t('voice_cancel', 'Vazgeç')}
              </button>

              <button
                onClick={handleConfirmBlock}
                style={{
                  flex: 1.3, padding: '12px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #ff2d55 0%, #c0183b 100%)',
                  border: 'none', color: '#fff', cursor: 'pointer',
                  fontWeight: '800', fontSize: '0.88rem',
                  boxShadow: '0 4px 15px rgba(255,45,85,0.4)'
                }}
              >
                {t('voice_block_confirm_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
