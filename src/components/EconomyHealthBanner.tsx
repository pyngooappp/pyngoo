import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCw } from 'lucide-react';

// SADECE YÖNETİCİ: güncel USD/TRY kuru ile ₺ paket fiyatlarının dayandığı referans kur arasındaki farkı gösterir.
// Kur veritabanında günde bir kez kaydedilir (supabase/pyngoo_kur_takibi_yamasi.sql); ödemelerde CANLI KUR KULLANILMAZ,
// bu kart yalnızca "fiyatları gözden geçirin" uyarısıdır. Yönetici değilse veya yama henüz çalıştırılmadıysa hiçbir şey göstermez.
// Periyodik sorgu yok: yalnızca açılışta ve sekmeye dönüldüğünde bir kez okunur.

interface EconomyHealth {
  allowed: boolean;
  usd_try?: number | null;
  day?: string | null;
  reference?: number | null;
  drift?: number | null;
  threshold?: number | null;
  alert?: boolean;
  diamond_value_try?: number | null;
  diamond_value_usd?: number | null;
}

interface EconomyHealthBannerProps {
  isAdmin: boolean;
}

const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '5px 12px',
  borderRadius: '999px',
  background: 'rgba(255, 255, 255, 0.07)',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  fontSize: '0.78rem',
  color: 'rgba(255, 255, 255, 0.85)',
  whiteSpace: 'nowrap',
};

export const EconomyHealthBanner: React.FC<EconomyHealthBannerProps> = ({ isAdmin }) => {
  const [data, setData] = useState<EconomyHealth | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { data: res, error } = await supabase.rpc('get_economy_health');
      if (error || !res) {
        setData(null);
      } else {
        setData(res as EconomyHealth);
      }
    } catch (_) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    load();
    const onFocus = () => load();
    const onVis = () => {
      if (!document.hidden) load();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  if (!isAdmin || !data || !data.allowed || data.usd_try == null) return null;

  const drift = Number(data.drift ?? 0);
  const alert = !!data.alert;
  const fmt = (n: number | null | undefined, d = 2) => (n == null ? '-' : Number(n).toFixed(d));
  const color = alert ? '#ff6b6b' : '#2ecc71';
  const dayText = data.day ? String(data.day).split('-').reverse().join('.') : '-';

  return (
    <div
      style={{
        // Yandaki "Gerçek Çevrimiçi" kartıyla aynı sütun: 1200px, ortalı, taşmaz
        width: '100%',
        maxWidth: '1200px',
        boxSizing: 'border-box',
        margin: '0 auto 16px auto',
        padding: '14px 18px',
        borderRadius: '16px',
        background: alert ? 'rgba(255, 107, 107, 0.09)' : 'rgba(46, 204, 113, 0.08)',
        border: `1.5px solid ${alert ? 'rgba(255, 107, 107, 0.45)' : 'rgba(46, 204, 113, 0.4)'}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}>
        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#fff', minWidth: 0, overflowWrap: 'anywhere' }}>
          💱 Kur ve fiyat sağlığı {alert ? '⚠️' : '✅'}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          title="Yenile"
          style={{
            flexShrink: 0,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            color: '#fff',
            padding: '7px 9px',
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <span style={chipStyle}>
          Güncel kur: <b style={{ color: '#fff' }}>1 $ = {fmt(data.usd_try)} ₺</b> <span style={{ opacity: 0.6 }}>({dayText})</span>
        </span>
        <span style={chipStyle}>
          Referans kur: <b style={{ color: '#fff' }}>{fmt(data.reference)}</b>
        </span>
        <span style={{ ...chipStyle, borderColor: color, color }}>
          Fark: <b>{drift >= 0 ? '+' : ''}{(drift * 100).toFixed(1)}%</b> <span style={{ opacity: 0.7 }}>(eşik %{fmt((data.threshold ?? 0) * 100, 0)})</span>
        </span>
        <span style={chipStyle}>
          Elmas: <b style={{ color: '#fff' }}>{fmt(data.diamond_value_try, 3)} ₺</b> / <b style={{ color: '#fff' }}>{fmt(data.diamond_value_usd, 4)} $</b>
        </span>
      </div>

      <div
        style={{
          fontSize: '0.8rem',
          lineHeight: '1.55',
          color: alert ? '#ffc9c9' : 'rgba(255,255,255,0.6)',
          overflowWrap: 'anywhere',
          minWidth: 0,
        }}
      >
        {alert
          ? 'Kur, ₺ fiyatların dayandığı referans kurdan uzaklaştı: ₺ paket fiyatları ve ₺ elmas ödemesi dolar karşılığında geride kalıyor, Agora gibi maliyetler dolar olduğu için marj eriyor. Fiyatları ve elmas değerini gözden geçirin; güncelledikten sonra ayar tablosundaki referans kuru (price_reference_usd_try) güncel kura çekin.'
          : 'Fiyatlar referans kura yakın, işlem gerekmiyor.'}
      </div>
    </div>
  );
};

export default EconomyHealthBanner;
