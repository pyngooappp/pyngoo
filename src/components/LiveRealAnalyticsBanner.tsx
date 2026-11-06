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
  isLight?: boolean;
}

export const LiveRealAnalyticsBanner: React.FC<LiveRealAnalyticsBannerProps> = ({ isAdmin, isLight = false }) => {
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
        margin: '0 auto 14px auto',
        padding: '14px 18px',
        borderRadius: '12px',
        background: isLight ? '#ffffff' : '#0f111c',
        border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.07)',
        boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.04)' : 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)',
          }}
        />
        <div>
          <div
            style={{
              fontSize: '0.86rem',
              fontWeight: '700',
              color: isLight ? '#0f172a' : '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Gerçek Zamanlı Çevrimiçi & Üye Takibi</span>
            {data && (
              <span style={{ fontSize: '0.7rem', color: isLight ? '#94a3b8' : '#64748b', fontWeight: 'normal' }}>
                ({data.lastChecked})
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.74rem', color: isLight ? '#64748b' : '#64748b', marginTop: '1px' }}>
            Yalnızca yöneticilere açık organik ve gerçek veritabanı akışı.
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div
          style={{
            background: isLight ? '#f8fafc' : '#141724',
            border: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '6px 12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1rem', fontWeight: '800', color: isLight ? '#059669' : '#34d399' }}>
            {onlineNow === null ? '...' : onlineNow}
          </div>
          <div style={{ fontSize: '0.68rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '600' }}>
            Şu An Çevrimiçi{liveStreamers > 0 ? ` • ${liveStreamers} canlı` : ''}
          </div>
        </div>

        <div
          style={{
            background: isLight ? '#f8fafc' : '#141724',
            border: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '6px 12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1rem', fontWeight: '800', color: isLight ? '#0f172a' : '#fff' }}>
            {data ? `+${data.newUsers24h}` : '...'}
          </div>
          <div style={{ fontSize: '0.68rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '600' }}>
            Bugün Yeni Üye
          </div>
        </div>

        <div
          style={{
            background: isLight ? '#f8fafc' : '#141724',
            border: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '6px 12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1rem', fontWeight: '800', color: isLight ? '#0f172a' : '#fff' }}>
            {data ? data.totalUsers : '...'}
          </div>
          <div style={{ fontSize: '0.68rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '600' }}>
            Toplam Üye
          </div>
        </div>

        <div
          style={{
            background: isLight ? '#f8fafc' : '#141724',
            border: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '8px',
            padding: '6px 12px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '0.86rem', fontWeight: '700', color: isLight ? '#334155' : '#cbd5e1' }}>
            {data ? `♀ ${data.femaleCount} • ♂ ${data.maleCount}` : '...'}
          </div>
          <div style={{ fontSize: '0.68rem', color: isLight ? '#64748b' : '#94a3b8', fontWeight: '600' }}>
            Cinsiyet Dağılımı
          </div>
        </div>

        <button
          onClick={fetchAnalytics}
          disabled={loading}
          style={{
            background: isLight ? '#f1f5f9' : '#141724',
            border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
            color: isLight ? '#334155' : '#cbd5e1',
            borderRadius: '8px',
            padding: '7px 12px',
            fontSize: '0.76rem',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          {loading ? '...' : 'Yenile'}
        </button>
      </div>
    </div>
  );
};

export default LiveRealAnalyticsBanner;
