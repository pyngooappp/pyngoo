import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw } from 'lucide-react';

interface RealAnalyticsData {
  totalUsers: number;
  newUsers24h: number;
  femaleCount: number;
  maleCount: number;
  lastChecked: string;
}

interface LiveRealAnalyticsBannerProps {
  isAdmin: boolean;
}

export const LiveRealAnalyticsBanner: React.FC<LiveRealAnalyticsBannerProps> = ({ isAdmin }) => {
  const [data, setData] = useState<RealAnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  // GERÇEK çevrimiçi sayısı: uygulamanın kullandığı 'pyngoo_presence' kanalı yalnızca DİNLENİR (track edilmez,
  // yani yönetici kendini listeye eklemez). null = kanal henüz bağlanmadı.
  const [onlineNow, setOnlineNow] = useState<number | null>(null);
  const [liveStreamers, setLiveStreamers] = useState<number>(0);
  const presenceRef = useRef<any>(null);

  const readPresence = () => {
    const ch = presenceRef.current;
    if (!ch) return;
    try {
      const st = ch.presenceState() as Record<string, any[]>;
      const keys = Object.keys(st);
      setOnlineNow(keys.length);
      setLiveStreamers(keys.filter((k) => (st[k] || []).some((m: any) => m?.live === true)).length);
    } catch (_) {
      // sessizce geç
    }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const ch = supabase.channel('pyngoo_presence');
    presenceRef.current = ch;
    ch.on('presence', { event: 'sync' }, readPresence)
      .on('presence', { event: 'join' }, readPresence)
      .on('presence', { event: 'leave' }, readPresence)
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') readPresence();
      });
    return () => {
      presenceRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [isAdmin]);

  const fetchAnalytics = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { data: users, error } = await supabase
        .from('profiles')
        .select('id, gender, role, created_at, last_reward_date, last_extension_date')
        .neq('role', 'deleted');

      if (error) throw error;

      const total = users?.length || 0;
      const female = users?.filter((u) => u.gender === 'kadin').length || 0;
      const male = users?.filter((u) => u.gender === 'erkek').length || 0;

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const new24h = users?.filter((u) => u.created_at && new Date(u.created_at).getTime() >= oneDayAgo).length || 0;

      setData({
        totalUsers: total,
        newUsers24h: new24h,
        femaleCount: female,
        maleCount: male,
        lastChecked: new Date().toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      });
    } catch (err) {
      console.warn('LiveRealAnalyticsBanner fetch error:', err);
    } finally {
      readPresence();
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAnalytics();
    }
  }, [isAdmin]);

  if (!isAdmin) return null;

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto 16px auto',
        padding: '16px 20px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(14, 28, 48, 0.85) 0%, rgba(9, 15, 29, 0.95) 100%)',
        border: '1.5px solid rgba(0, 242, 254, 0.4)',
        boxShadow: '0 8px 30px rgba(0, 242, 254, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: '#00e676',
            boxShadow: '0 0 12px #00e676',
            animation: 'pulse 1.6s infinite',
          }}
        />
        <div>
          <div
            style={{
              fontSize: '0.92rem',
              fontWeight: '800',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>👑 Sadece Size Özel Gerçek Çevrimiçi & Üye Takibi</span>
            {data && (
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', fontWeight: 'normal' }}>
                (Son Güncelleme: {data.lastChecked})
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'rgba(0, 242, 254, 0.85)', marginTop: '2px' }}>
            Normal ziyaretçiler ana sayfada organik nabız sayacını görürken, siz burada %100 gerçek veriyi görürsünüz.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div
          style={{
            background: 'rgba(0, 230, 118, 0.12)',
            border: '1px solid rgba(0, 230, 118, 0.35)',
            borderRadius: '12px',
            padding: '8px 14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#00e676' }}>
            {onlineNow === null ? '...' : onlineNow}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontWeight: '700' }}>
            🟢 Şu An Çevrimiçi{liveStreamers > 0 ? ` • 🎥 ${liveStreamers} canlı` : ''}
          </div>
        </div>

        <div
          style={{
            background: 'rgba(0, 242, 254, 0.12)',
            border: '1px solid rgba(0, 242, 254, 0.35)',
            borderRadius: '12px',
            padding: '8px 14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#00f2fe' }}>
            {data ? `+${data.newUsers24h}` : '...'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontWeight: '700' }}>
            📅 Bugün Yeni Üye
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '12px',
            padding: '8px 14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.15rem', fontWeight: '900', color: '#fff' }}>
            {data ? data.totalUsers : '...'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontWeight: '700' }}>
            👥 Toplam Gerçek Üye
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 65, 108, 0.1)',
            border: '1px solid rgba(255, 65, 108, 0.3)',
            borderRadius: '12px',
            padding: '8px 14px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#ff758c' }}>
            {data ? `♀️ ${data.femaleCount} • ♂️ ${data.maleCount}` : '...'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)', fontWeight: '700' }}>
            Cinsiyet Dağılımı
          </div>
        </div>

        <button
          onClick={fetchAnalytics}
          disabled={loading}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#fff',
            borderRadius: '10px',
            padding: '8px 14px',
            fontSize: '0.78rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s',
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Yenileniyor...' : 'Verileri Yenile'}
        </button>
      </div>
    </div>
  );
};

export default LiveRealAnalyticsBanner;
