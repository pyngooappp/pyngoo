// Global "çevrimiçi / canlı-mola" varlık takibi (Supabase Realtime Presence).
//
// Supabase Realtime, bir istemciden ~6-8 sn'den sık presence güncellemesi gelirse (5 güncellemeden sonra)
// "Client presence rate limit exceeded" hatasıyla kanalı SUNUCU TARAFINDA KAPATIR (phx_close). Kapanan kanal
// kendiliğinden yeniden açılmaz; yayıncı presence'tan düşer ve karşı taraf onu sayfa yenilenene kadar
// "molada / çevrim dışı" görür. Bu yüzden:
//   1) Güncellemeler en az `minGapMs` (10 sn) arayla gönderilir; arada biriken değişiklikler tek güncellemede
//      birleşir ve HER ZAMAN en güncel durum gönderilir.
//   2) Durum değişmediyse (live aynı) hiç güncelleme gönderilmez.
//   3) Kanal yine de kapanır / hata verirse gecikmeli olarak yeniden kurulur.

export interface PresencePayload {
  live: boolean;
  [key: string]: unknown;
}

export interface PresenceSyncOptions {
  client: { channel: (topic: string, opts?: any) => any; removeChannel: (ch: any) => any };
  topic: string;
  key: string;
  buildPayload: () => PresencePayload;
  onState: (state: Record<string, any[]>) => void;
  minGapMs?: number;
  debounceMs?: number;
  reconnectBaseMs?: number;
}

export const createPresenceSync = (opts: PresenceSyncOptions) => {
  const minGap = opts.minGapMs ?? 10000;
  const debounce = opts.debounceMs ?? 400;
  const reconnectBase = opts.reconnectBaseMs ?? 10000;

  let channel: any = null;
  let disposed = false;
  let subscribed = false;
  let connecting = false;
  let lastSentAt = 0;
  let lastLive: boolean | null = null;
  let attempts = 0;
  let trackTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = () => {
    if (channel) {
      try { opts.onState(channel.presenceState()); } catch (_) {}
    }
  };

  const sendIfChanged = () => {
    if (!channel || !subscribed) return;
    const payload = opts.buildPayload();
    if (payload.live === lastLive) return;
    lastLive = payload.live;
    lastSentAt = Date.now();
    try { Promise.resolve(channel.track(payload)).catch(() => {}); } catch (_) {}
  };

  // Canlı/Mola değişiminde çağrılır: son değişikliği, hız sınırını aşmayacak en erken anda gönderir.
  const requestTrack = () => {
    if (disposed) return;
    if (trackTimer) clearTimeout(trackTimer);
    const wait = Math.max(debounce, lastSentAt + minGap - Date.now());
    trackTimer = setTimeout(() => {
      trackTimer = null;
      sendIfChanged();
    }, wait);
  };

  const scheduleReconnect = () => {
    if (disposed || reconnectTimer) return;
    const delay = Math.min(reconnectBase * (attempts + 1), reconnectBase * 3);
    attempts++;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (disposed || subscribed) return;
      void connect();
    }, delay);
  };

  const connect = async () => {
    if (disposed || connecting) return;
    connecting = true;
    try {
      if (channel) {
        const old = channel;
        channel = null;
        // Aynı topic ile yeni kanal kurmadan önce eskisinin gerçekten kaldırılmasını bekle (en fazla 3 sn).
        try {
          await Promise.race([
            Promise.resolve(opts.client.removeChannel(old)),
            new Promise((resolve) => setTimeout(resolve, 3000)),
          ]);
        } catch (_) {}
      }
      if (disposed) return;
      subscribed = false;
      lastLive = null;
      const ch = opts.client.channel(opts.topic, { config: { presence: { key: opts.key } } });
      channel = ch;
      ch.on('presence', { event: 'sync' }, emit)
        .on('presence', { event: 'join' }, emit)
        .on('presence', { event: 'leave' }, emit)
        .subscribe(async (status: string) => {
          if (disposed || ch !== channel) return;
          if (status === 'SUBSCRIBED') {
            subscribed = true;
            attempts = 0;
            if (reconnectTimer) {
              clearTimeout(reconnectTimer);
              reconnectTimer = null;
            }
            const payload = opts.buildPayload();
            lastLive = payload.live;
            lastSentAt = Date.now();
            try { await ch.track(payload); } catch (_) {}
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            subscribed = false;
            scheduleReconnect();
          }
        });
    } finally {
      connecting = false;
    }
  };

  const stop = () => {
    disposed = true;
    if (trackTimer) clearTimeout(trackTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    trackTimer = null;
    reconnectTimer = null;
    const ch = channel;
    channel = null;
    subscribed = false;
    if (ch) {
      try { opts.client.removeChannel(ch); } catch (_) {}
    }
  };

  return { start: () => { void connect(); }, requestTrack, stop };
};
