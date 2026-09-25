import { supabase } from '../lib/supabase';
import { notifyFollowers } from './pushService';

export interface FollowStats {
  total: number;
  today: number;
}

const BROADCAST_CHANNEL_NAME = 'pyngoo_streamer_live_broadcast';

/**
 * Kullanıcının belirli bir yayıncıyı takip edip etmediğini kontrol eder
 */
export const isFollowingStreamer = (followerId: string, streamerId: string): boolean => {
  if (!followerId || !streamerId) return false;
  try {
    const list: string[] = JSON.parse(localStorage.getItem(`pyngoo_user_follows_${followerId}`) || '[]');
    return list.includes(streamerId);
  } catch (_) {
    return false;
  }
};

/**
 * Takip listesini sunucudan çeker ve yerel önbelleği günceller.
 * Eski sürümde yalnızca telefonda tutulan takipler bir kerelik sunucuya taşınır.
 */
export const syncMyFollows = async (followerId: string): Promise<Set<string>> => {
  const key = `pyngoo_user_follows_${followerId}`;
  let local: string[] = [];
  try { local = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) {}
  if (!followerId) return new Set(local);

  try {
    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', followerId);
    if (error || !data) return new Set(local);

    const server = new Set<string>(data.map((r: { following_id: string }) => r.following_id));

    const migratedKey = `pyngoo_follows_migrated_${followerId}`;
    if (localStorage.getItem(migratedKey) !== '1') {
      const missing = local.filter((id) => id && id !== followerId && !server.has(id));
      if (missing.length > 0) {
        const { error: insErr } = await supabase
          .from('follows')
          .upsert(missing.map((id) => ({ follower_id: followerId, following_id: id })), { onConflict: 'follower_id,following_id', ignoreDuplicates: true });
        if (!insErr) missing.forEach((id) => server.add(id));
      }
      localStorage.setItem(migratedKey, '1');
    }

    localStorage.setItem(key, JSON.stringify(Array.from(server)));
    return server;
  } catch (_) {
    return new Set(local);
  }
};

/**
 * Yayıncıyı takip et veya takipten çık (Toggle)
 */
export const toggleFollowStreamer = async (
  followerId: string, 
  streamerId: string,
  _streamerName?: string
): Promise<{ isFollowing: boolean; newCount: number }> => {
  if (!followerId || !streamerId) return { isFollowing: false, newCount: 0 };

  const currentFollowing = isFollowingStreamer(followerId, streamerId);
  const nextFollowing = !currentFollowing;

  // 1. Önce sunucuya kaydet (bildirimler buradaki kayda göre gönderilir)
  try {
    if (nextFollowing) {
      const { error } = await supabase.from('follows').insert([{ follower_id: followerId, following_id: streamerId }]);
      // 23505 = zaten takip ediliyor; sorun değil
      if (error && error.code !== '23505') {
        return { isFollowing: currentFollowing, newCount: getStreamerFollowers(streamerId).total };
      }
    } else {
      const { error } = await supabase.from('follows').delete()
        .eq('follower_id', followerId)
        .eq('following_id', streamerId);
      if (error) {
        return { isFollowing: currentFollowing, newCount: getStreamerFollowers(streamerId).total };
      }
    }
  } catch (_) {
    return { isFollowing: currentFollowing, newCount: getStreamerFollowers(streamerId).total };
  }

  // Yerel önbelleği güncelle (ekranın anında tepki vermesi için)
  try {
    const list: string[] = JSON.parse(localStorage.getItem(`pyngoo_user_follows_${followerId}`) || '[]');
    const updatedList = nextFollowing 
      ? Array.from(new Set([...list, streamerId]))
      : list.filter(id => id !== streamerId);
    localStorage.setItem(`pyngoo_user_follows_${followerId}`, JSON.stringify(updatedList));
  } catch (_) {}

  // 2. Yayıncının takipçi sayısını ve bugünkü artışını güncelle
  const todayKey = new Date().toISOString().slice(0, 10);
  let totalFollowers = getStreamerFollowers(streamerId).total;
  let todayFollowers = getStreamerFollowers(streamerId).today;

  if (nextFollowing) {
    totalFollowers += 1;
    todayFollowers += 1;
  } else {
    totalFollowers = Math.max(0, totalFollowers - 1);
    todayFollowers = Math.max(0, todayFollowers - 1);
  }

  localStorage.setItem(`pyngoo_streamer_followers_${streamerId}`, totalFollowers.toString());
  localStorage.setItem(`pyngoo_streamer_followers_today_${streamerId}_${todayKey}`, todayFollowers.toString());

  // 4. Global olay tetikle
  window.dispatchEvent(new CustomEvent('pyngoo_follow_updated', {
    detail: { followerId, streamerId, isFollowing: nextFollowing, totalFollowers }
  }));

  return { isFollowing: nextFollowing, newCount: totalFollowers };
};

/**
 * Yayıncının toplam takipçi ve bugünkü takipçi sayısını getirir
 */
export const getStreamerFollowers = (streamerId: string, baseDiamonds: number = 100): FollowStats => {
  if (!streamerId) return { total: 350, today: 18 };
  
  const todayKey = new Date().toISOString().slice(0, 10);
  const storedTotal = localStorage.getItem(`pyngoo_streamer_followers_${streamerId}`);
  const storedToday = localStorage.getItem(`pyngoo_streamer_followers_today_${streamerId}_${todayKey}`);

  // Taban değer hesabı (doğal ve cezbedici görünüm)
  const defaultTotal = Math.max(140, Math.floor(baseDiamonds * 3.5) || 350);
  const defaultToday = Math.max(8, Math.floor(defaultTotal * 0.08) || 28);

  const total = storedTotal ? parseInt(storedTotal, 10) : defaultTotal;
  const today = storedToday ? parseInt(storedToday, 10) : defaultToday;

  return { total, today };
};

/**
 * Vitrin / Profil İnceleme İzlenmesini Kaydet (Görüntüleme)
 */
export const recordProfileView = (streamerId: string): number => {
  if (!streamerId) return 0;

  const current = getProfileViews(streamerId);
  const updated = current + 1;
  localStorage.setItem(`pyngoo_streamer_views_${streamerId}`, updated.toString());

  window.dispatchEvent(new CustomEvent('pyngoo_views_updated', {
    detail: { streamerId, views: updated }
  }));

  return updated;
};

/**
 * Yayıncının toplam vitrin izlenme sayısını getirir
 */
export const getProfileViews = (streamerId: string, baseDiamonds: number = 100): number => {
  if (!streamerId) return 12800;

  const stored = localStorage.getItem(`pyngoo_streamer_views_${streamerId}`);
  if (stored) return parseInt(stored, 10);

  // Doğal vitrin izlenme tabanı (Örn: 12.8K)
  const defaultViews = Math.max(1200, Math.floor(baseDiamonds * 128) || 12800);
  return defaultViews;
};

/**
 * İzlenme sayısını K / M formatında biçimlendir (Örn: 12800 -> 12.8K)
 */
export const formatMetricNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

/**
 * Kadın yayıncı moladan çıkıp Canlıya Geçtiğinde Takipçilerine Anons Gönderir
 */
export const broadcastStreamerGoLive = (streamer: {
  id: string;
  name: string;
  avatar: string;
}) => {
  const payload = {
    ...streamer,
    timestamp: Date.now()
  };

  // 1. BroadcastChannel ile tüm açık sekmelere yayınla
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.postMessage(payload);
      setTimeout(() => bc.close(), 1000);
    } catch (_) {}
  }

  // 2. Aynı pencere içi event
  window.dispatchEvent(new CustomEvent('pyngoo_streamer_golive_alert', { detail: payload }));

  // 3. LocalStorage sinyali (diğer pencereler için ek güvence)
  localStorage.setItem('pyngoo_last_golive_broadcast', JSON.stringify(payload));

  // 4. Takipçilerin telefonuna bildirim (sunucu 30 dakikada 1 sınırı uygular)
  notifyFollowers('live');
};

/**
 * Takip edilen yayıncı canlıya geçtiğinde dinleme servisi
 */
export const subscribeToStreamerGoLive = (
  currentUserId: string,
  onAlert: (streamer: { id: string; name: string; avatar: string }) => void
): (() => void) => {
  let bc: BroadcastChannel | null = null;

  const handleMessage = (streamer: any) => {
    if (!streamer || !streamer.id) return;
    // Kendimizsek uyarı gösterme
    if (streamer.id === currentUserId) return;

    // Bu yayıncıyı takip ediyor muyuz?
    const following = isFollowingStreamer(currentUserId, streamer.id);
    if (following) {
      onAlert(streamer);
    }
  };

  // 1. BroadcastChannel dinleyici
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      bc.onmessage = (event) => handleMessage(event.data);
    } catch (_) {}
  }

  // 2. Window event dinleyici
  const handleCustomEvent = (e: any) => {
    handleMessage(e.detail);
  };
  window.addEventListener('pyngoo_streamer_golive_alert', handleCustomEvent);

  // 3. Storage event dinleyici
  const handleStorageEvent = (e: StorageEvent) => {
    if (e.key === 'pyngoo_last_golive_broadcast' && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        handleMessage(data);
      } catch (_) {}
    }
  };
  window.addEventListener('storage', handleStorageEvent);

  return () => {
    if (bc) bc.close();
    window.removeEventListener('pyngoo_streamer_golive_alert', handleCustomEvent);
    window.removeEventListener('storage', handleStorageEvent);
  };
};