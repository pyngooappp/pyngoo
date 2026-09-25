-- =====================================================================
-- Pyngoo - Günlük USD/TRY kur takibi ve fiyat sağlığı uyarısı
-- Tarih: 2026-09-25
--
-- Neden: Gelirin büyük kısmı ₺ (paketler), en büyük maliyet (Agora) dolar. Lira değer kaybettikçe
-- ₺ paket fiyatları ve ₺ elmas değeri (0,10 ₺) dolar karşılığında eriyor ve marj sessizce düşüyor.
--
-- Bu yama kuru CANLI ÖDEMEDE KULLANMAZ (ödemeler sabit oranla kalır). Yalnızca günde bir kez kuru kaydeder;
-- referans kurdan fark eşiği aşarsa yönetici için moderatör panelinde uyarı çıkar. Karar sizde kalır.
--
-- ÖN KOŞUL: pyngoo_cekim_dogrulama_yamasi.sql önce çalıştırılmış olmalı (economy_config tablosu orada).
-- Tekrar çalıştırılabilir (idempotent). Tamamını tek seferde çalıştırın.
-- =====================================================================

-- 1) Eklentiler (zamanlanmış görev ve sunucudan HTTP isteği)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2) Günlük kur tablosu (yalnızca yönetici okuyabilir; yazmayı yalnızca sunucu fonksiyonu yapar)
CREATE TABLE IF NOT EXISTS public.fx_rates (
  day        date PRIMARY KEY,
  usd_try    numeric NOT NULL CHECK (usd_try > 0),
  source     text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fx_rates_admin_read ON public.fx_rates;
CREATE POLICY fx_rates_admin_read ON public.fx_rates FOR SELECT TO authenticated USING (public.is_admin());

-- 3) Kuru çeken fonksiyon (yalnızca zamanlanmış görev çağırır)
CREATE OR REPLACE FUNCTION public.refresh_usd_try()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_resp http_response;
  v_rate NUMERIC;
  v_prev NUMERIC;
BEGIN
  SELECT * INTO v_resp FROM http_get('https://open.er-api.com/v6/latest/USD');
  IF v_resp.status IS DISTINCT FROM 200 THEN
    RAISE WARNING 'refresh_usd_try: kur servisi % döndü', v_resp.status;
    RETURN;
  END IF;

  v_rate := (v_resp.content::jsonb -> 'rates' ->> 'TRY')::numeric;
  IF v_rate IS NULL OR v_rate <= 0 THEN
    RAISE WARNING 'refresh_usd_try: geçersiz kur';
    RETURN;
  END IF;

  -- Saçma sıçramaları kaydetme (önceki değerden 1,5 kat sapma)
  SELECT usd_try INTO v_prev FROM public.fx_rates ORDER BY day DESC LIMIT 1;
  IF v_prev IS NOT NULL AND (v_rate > v_prev * 1.5 OR v_rate < v_prev / 1.5) THEN
    RAISE WARNING 'refresh_usd_try: kur % önceki % ile uyuşmuyor, kaydedilmedi', v_rate, v_prev;
    RETURN;
  END IF;

  INSERT INTO public.fx_rates (day, usd_try, source)
  VALUES (current_date, v_rate, 'open.er-api.com')
  ON CONFLICT (day) DO UPDATE SET usd_try = EXCLUDED.usd_try, fetched_at = now();
END;
$function$;

REVOKE ALL ON FUNCTION public.refresh_usd_try() FROM PUBLIC, anon, authenticated;

-- 4) Yönetici için kur/fiyat sağlığı (moderatör paneli çağırır; yönetici değilse boş döner)
CREATE OR REPLACE FUNCTION public.get_economy_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_fx    NUMERIC;
  v_day   DATE;
  v_ref   NUMERIC;
  v_thr   NUMERIC;
  v_try   NUMERIC;
  v_usd   NUMERIC;
  v_drift NUMERIC;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('allowed', false);
  END IF;

  SELECT usd_try, day INTO v_fx, v_day FROM public.fx_rates ORDER BY day DESC LIMIT 1;
  SELECT value INTO v_ref FROM public.economy_config WHERE key = 'price_reference_usd_try';
  SELECT COALESCE((SELECT value FROM public.economy_config WHERE key = 'price_alert_drift'), 0.10) INTO v_thr;
  SELECT value INTO v_try FROM public.economy_config WHERE key = 'diamond_value_try';
  SELECT value INTO v_usd FROM public.economy_config WHERE key = 'diamond_value_usd';

  v_drift := CASE WHEN v_fx IS NOT NULL AND v_ref IS NOT NULL AND v_ref > 0 THEN v_fx / v_ref - 1 END;

  RETURN jsonb_build_object(
    'allowed', true,
    'usd_try', v_fx,
    'day', v_day,
    'reference', v_ref,
    'drift', v_drift,
    'threshold', v_thr,
    'alert', COALESCE(v_drift > v_thr, false),
    'diamond_value_try', v_try,
    'diamond_value_usd', v_usd
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_economy_health() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_economy_health() TO authenticated;

-- 5) Günlük zamanlama (her gün 03:15 UTC) ve ilk değeri hemen kaydet
DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'fx-usd-try-daily';
  PERFORM cron.schedule('fx-usd-try-daily', '15 3 * * *', 'select public.refresh_usd_try()');
END $$;

SELECT public.refresh_usd_try();
