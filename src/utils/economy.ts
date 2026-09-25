import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Pyngoo ekonomisinin İSTEMCİ tarafındaki TEK kaynağı: elmasın para değeri ve çekim kuralları.
//
// Oranlar veritabanındaki economy_config tablosundan okunur (değiştirmek için yeni sürüm gerekmez); tablo okunamazsa
// aşağıdaki varsayılanlar kullanılır. SUNUCU AYNI TABLOYU okur: request_diamond_withdrawal para tutarını sunucuda hesaplar,
// yani ekranda görülen ile ödenen her zaman aynıdır. Ayrıntı: supabase/pyngoo_cekim_dogrulama_yamasi.sql
//
// Önceden Cüzdan (gerçek çekim) 1 elmas = 0,10 ₺ / 0,003 $ kullanırken, VIP Yayıncı Stüdyosu ve Kokpit "tahmini kazancı"
// 0,50 ₺ / 0,015 $ ile hesaplıyordu (5 kat fazla). Artık hepsi buradan okur.
//
// Kazanç kuralları (görüşmede kadına giden elmas, hediye tablosu) sunucudaki veritabanı fonksiyonlarında sabittir:
//   reward_direct_call_start: erkek 120 altın öder -> kadına 30 elmas (dakika başı)
//   reward_call_extension:    erkek 20 altın öder  -> kadına 5 elmas
//   send_gift_transaction:    hediye kataloğu (altının %30'u kadar elmas)

export interface EconomyConfig {
  /** Türkiye: elmas başına ₺ */
  diamondValueTry: number;
  /** Diğer ülkeler: elmas başına $ */
  diamondValueUsd: number;
  /** En az çekilebilecek elmas */
  minWithdrawDiamonds: number;
}

export const DEFAULT_ECONOMY: EconomyConfig = {
  diamondValueTry: 0.1,
  diamondValueUsd: 0.003,
  minWithdrawDiamonds: 500,
};

/** Varsayılan değerlerle uyumluluk için (tablo okunmadan önce ve testlerde) */
export const DIAMOND_VALUE_TRY = DEFAULT_ECONOMY.diamondValueTry;
export const DIAMOND_VALUE_USD = DEFAULT_ECONOMY.diamondValueUsd;
export const MIN_WITHDRAW_DIAMONDS = DEFAULT_ECONOMY.minWithdrawDiamonds;
/** Doğrudan görüşmede kadına dakika başı yazılan elmas (sunucudaki sabitle aynı) */
export const CALL_DIAMONDS_PER_MIN = 30;

/** Çekim para birimi kullanıcının uygulama diline göre belirlenir: Türkçe -> ₺, diğerleri -> $ */
export const isTurkishLang = (lang?: string | null): boolean =>
  (lang || '').toLowerCase().startsWith('tr');

export const diamondValue = (isTr: boolean, cfg: EconomyConfig = DEFAULT_ECONOMY): number =>
  isTr ? cfg.diamondValueTry : cfg.diamondValueUsd;

export const diamondsToMoney = (diamonds: number, isTr: boolean, cfg: EconomyConfig = DEFAULT_ECONOMY): number =>
  (Number(diamonds) || 0) * diamondValue(isTr, cfg);

// ---- Ayar tablosunu oku (oturum başına önbellekli; süreli yenileme, periyodik sorgu YOK) ----
const CACHE_MS = 15 * 60 * 1000;
let cached: EconomyConfig | null = null;
let cachedAt = 0;
let inflight: Promise<EconomyConfig> | null = null;

export const loadEconomyConfig = (): Promise<EconomyConfig> => {
  if (cached && Date.now() - cachedAt < CACHE_MS) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase
        .from('economy_config')
        .select('key, value')
        .in('key', ['diamond_value_try', 'diamond_value_usd', 'min_withdraw_diamonds']);
      if (error || !data) return cached || DEFAULT_ECONOMY;
      const map: Record<string, number> = {};
      for (const row of data as Array<{ key: string; value: number | string }>) map[row.key] = Number(row.value);
      const pick = (k: string, d: number) => (Number.isFinite(map[k]) && map[k] > 0 ? map[k] : d);
      cached = {
        diamondValueTry: pick('diamond_value_try', DEFAULT_ECONOMY.diamondValueTry),
        diamondValueUsd: pick('diamond_value_usd', DEFAULT_ECONOMY.diamondValueUsd),
        minWithdrawDiamonds: pick('min_withdraw_diamonds', DEFAULT_ECONOMY.minWithdrawDiamonds),
      };
      cachedAt = Date.now();
      return cached;
    } catch (_) {
      return cached || DEFAULT_ECONOMY;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
};

/** React kancası: ilk çizimde varsayılan/önbellek, ardından ayar tablosundaki güncel değerler */
export const useEconomyConfig = (): EconomyConfig => {
  const [cfg, setCfg] = useState<EconomyConfig>(cached || DEFAULT_ECONOMY);
  useEffect(() => {
    let alive = true;
    loadEconomyConfig().then((c) => {
      if (alive) setCfg(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  return cfg;
};
