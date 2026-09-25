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

  return (
    <div
      style={{
        margin: '0 0 14px',
        padding: '12px 16px',
        borderRadius: '16px',
        background: alert ? 'rgba(255, 107, 107, 0.10)' : 'rgba(46, 204, 113, 0.08)',
        border: `1px solid ${alert ? 'rgba(255, 107, 107, 0.45)' : 'rgba(46, 204, 113, 0.35)'}`,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: '240px' }}>
        <div style={{ fontSize: '0.92rem', fontWeight: '800', color: '#fff' }}>
          💱 Kur ve fiyat sağlığı {alert ? '⚠️' : '✅'}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', marginTop: '4px', lineHeight: '1.5' }}>
          Güncel kur: <b>1 $ = {fmt(data.usd_try)} ₺</b> ({data.day || '-'}) · ₺ fiyatların dayandığı referans kur:{' '}
          <b>{fmt(data.reference)}</b> · Fark: <b style={{ color }}>{drift >= 0 ? '+' : ''}{(drift * 100).toFixed(1)}%</b>{' '}
          (uyarı eşiği %{fmt((data.threshold ?? 0) * 100, 0)})
        </div>
        {alert ? (
          <div style={{ fontSize: '0.78rem', color: '#ffb3b3', marginTop: '6px', lineHeight: '1.5' }}>
            ₺ paket fiyatları ve ₺ elmas ödemesi ({fmt(data.diamond_value_try, 3)} ₺/elmas) dolar karşılığında geride kalıyor; Agora gibi
            maliyetler dolar olduğu için marjınız eriyor. Fiyatları ve elmas değerini gözden geçirin. Güncelledikten sonra economy_config
            tablosundaki <code>price_reference_usd_try</code> değerini güncel kura çekin.
          </div>
        ) : (
          <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', marginTop: '6px' }}>
            Fiyatlar referans kura yakın. Elmas değeri: {fmt(data.diamond_value_try, 3)} ₺ / {fmt(data.diamond_value_usd, 4)} $.
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={load}
        disabled={loading}
        title="Yenile"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '10px',
          color: '#fff',
          padding: '8px 10px',
          cursor: loading ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <RefreshCw size={15} />
      </button>
    </div>
  );
};

export default EconomyHealthBanner;
