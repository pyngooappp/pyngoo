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
  isLight?: boolean;
}

const getChipStyle = (isLight?: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '4px 10px',
  borderRadius: '6px',
  background: isLight ? '#f1f5f9' : '#141724',
  border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255, 255, 255, 0.08)',
  fontSize: '0.74rem',
  color: isLight ? '#334155' : '#cbd5e1',
  whiteSpace: 'nowrap',
});

export const EconomyHealthBanner: React.FC<EconomyHealthBannerProps> = ({ isAdmin, isLight }) => {
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

  const chip = getChipStyle(isLight);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1200px',
        boxSizing: 'border-box',
        margin: '0 auto 14px auto',
        padding: '14px 18px',
        borderRadius: '12px',
        background: isLight ? '#ffffff' : '#0f111c',
        border: alert
          ? '1px solid rgba(239, 68, 68, 0.45)'
          : isLight
          ? '1px solid #e2e8f0'
          : '1px solid rgba(255, 255, 255, 0.07)',
        boxShadow: isLight ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', minWidth: 0 }}>
        <div style={{ fontSize: '0.88rem', fontWeight: '700', color: isLight ? '#0f172a' : '#fff', minWidth: 0, overflowWrap: 'anywhere' }}>
          💱 Kur ve Fiyat Sağlığı {alert ? '⚠️' : '✅'}
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          title="Yenile"
          style={{
            flexShrink: 0,
            background: isLight ? '#f1f5f9' : '#141724',
            border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.08)',
            borderRadius: '8px',
            color: isLight ? '#334155' : '#cbd5e1',
            padding: '6px 10px',
            cursor: loading ? 'wait' : 'pointer',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <span style={chip}>
          Güncel kur: <b style={{ color: isLight ? '#0f172a' : '#fff' }}>1 $ = {fmt(data.usd_try)} ₺</b> <span style={{ opacity: 0.6 }}>({dayText})</span>
        </span>
        <span style={chip}>
          Referans kur: <b style={{ color: isLight ? '#0f172a' : '#fff' }}>{fmt(data.reference)}</b>
        </span>
        <span style={{ ...chip, borderColor: color, color }}>
          Fark: <b>{drift >= 0 ? '+' : ''}{(drift * 100).toFixed(1)}%</b> <span style={{ opacity: 0.7 }}>(eşik %{fmt((data.threshold ?? 0) * 100, 0)})</span>
        </span>
        <span style={chip}>
          Elmas: <b style={{ color: isLight ? '#0f172a' : '#fff' }}>{fmt(data.diamond_value_try, 3)} ₺</b> / <b style={{ color: isLight ? '#0f172a' : '#fff' }}>{fmt(data.diamond_value_usd, 4)} $</b>
        </span>
      </div>

      <div
        style={{
          fontSize: '0.8rem',
          lineHeight: '1.55',
          color: alert ? '#ef4444' : isLight ? '#64748b' : 'rgba(255,255,255,0.6)',
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
