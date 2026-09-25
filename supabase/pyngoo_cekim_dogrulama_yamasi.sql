-- =====================================================================
-- Pyngoo - Para çekme güvenliği, çoklu para birimi ve ayar tablosu
-- Tarih: 2026-09-25
--
-- BULGULAR (kod + veritabanı incelemesi):
--  1) Cüzdan, sunucudaki request_diamond_withdrawal fonksiyonunu HİÇ çağırmıyordu; elmasları doğrudan
--     profiles tablosundan düşüp talebi doğrudan withdrawal_requests tablosuna yazıyor ve para tutarını
--     KENDİSİ hesaplıyordu. Sunucu tutarı doğrulamıyordu.
--  2) Talep eklenemezse "elmasları iade et" (rollback) kodu, profiles tetikleyicisi kullanıcının kendi
--     elmasının ARTMASINI engellediği için hiç çalışmıyordu: elmas düşüp talep yazılmazsa elmas kaybolurdu.
--  3) withdrawal_requests tablosunda para birimi sütunu yoktu; moderatör paneli her tutarı "₺" gösteriyordu.
--  4) Elmasın para değeri uygulama koduna yazılıydı; değiştirmek için yeni sürüm yayınlamak gerekiyordu.
--
-- Bu yama: ayar tablosu (economy_config), para birimi sütunu ve tutarı SUNUCUDA hesaplayan tek güvenli
-- fonksiyonu kurar (elmas düşümü + talep kaydı tek işlemde), eski doğrulamasız yolları kapatır.
-- Oranları değiştirmek için artık yalnızca economy_config tablosunu güncellemeniz yeter (uygulama güncellemesi gerekmez).
--
-- Şu ana kadar hiç çekim talebi olmadığı için (tablo boş) geriye dönük düzeltme gerekmiyor.
-- Tekrar çalıştırılabilir (idempotent). Tamamını tek seferde çalıştırın.
-- =====================================================================


-- 1) AYAR TABLOSU ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.economy_config (
  key        text PRIMARY KEY,
  value      numeric NOT NULL,
  note       text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.economy_config ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (uygulama elmas değerini gösterir); yalnızca yönetici değiştirebilir.
DROP POLICY IF EXISTS economy_config_read ON public.economy_config;
CREATE POLICY economy_config_read ON public.economy_config FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS economy_config_admin_insert ON public.economy_config;
CREATE POLICY economy_config_admin_insert ON public.economy_config FOR INSERT TO authenticated WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS economy_config_admin_update ON public.economy_config;
CREATE POLICY economy_config_admin_update ON public.economy_config FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS economy_config_admin_delete ON public.economy_config;
CREATE POLICY economy_config_admin_delete ON public.economy_config FOR DELETE TO authenticated USING (public.is_admin());

INSERT INTO public.economy_config (key, value, note) VALUES
  ('diamond_value_try',      0.10,  'Elmas başına ₺ (Türkiye çekimi)'),
  ('diamond_value_usd',      0.003, 'Elmas başına $ (diğer ülkeler çekimi)'),
  ('min_withdraw_diamonds',  500,   'Minimum çekim (elmas)'),
  ('price_reference_usd_try', 40,   '₺ paket fiyatlarının kabaca dayandığı USD/TRY kuru. Fiyatları güncelleyince bunu da güncel kura çekin.'),
  ('price_alert_drift',      0.10,  'Güncel kur referanstan bu oranda (0,10 = %10) uzaklaşırsa moderatör panelinde uyarı çıkar')
ON CONFLICT (key) DO NOTHING;


-- 2) PARA BİRİMİ SÜTUNU -------------------------------------------------
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'TRY';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'withdrawal_requests_currency_chk') THEN
    ALTER TABLE public.withdrawal_requests
      ADD CONSTRAINT withdrawal_requests_currency_chk CHECK (currency IN ('TRY', 'USD'));
  END IF;
END $$;


-- 3) SUNUCUDA HESAPLAYAN TEK ÇEKİM YOLU -----------------------------------
-- İstemciden para tutarı ALINMAZ; kullanıcı kimliği JWT'den gelir; oranlar economy_config'ten okunur.
CREATE OR REPLACE FUNCTION public.request_diamond_withdrawal(
  p_amount_diamonds integer,
  p_currency text,
  p_iban text,
  p_full_name text
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      UUID := auth.uid();
  v_min      INT;
  v_rate     NUMERIC;
  v_currency TEXT;
  v_amount   NUMERIC;
  v_current  BIGINT;
  v_new      BIGINT;
  v_pending  INT;
  v_id       UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  SELECT COALESCE((SELECT value FROM public.economy_config WHERE key = 'min_withdraw_diamonds'), 500)::INT INTO v_min;
  IF p_amount_diamonds IS NULL OR p_amount_diamonds < v_min THEN
    RETURN jsonb_build_object('success', false, 'error', 'min_amount');
  END IF;

  v_currency := upper(COALESCE(p_currency, ''));
  IF v_currency = 'TRY' THEN
    SELECT COALESCE((SELECT value FROM public.economy_config WHERE key = 'diamond_value_try'), 0.10) INTO v_rate;
  ELSIF v_currency = 'USD' THEN
    SELECT COALESCE((SELECT value FROM public.economy_config WHERE key = 'diamond_value_usd'), 0.003) INTO v_rate;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid_currency');
  END IF;
  IF COALESCE(btrim(p_iban), '') = '' OR COALESCE(btrim(p_full_name), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_account');
  END IF;

  -- Tutar SUNUCUDA hesaplanır.
  v_amount := round(p_amount_diamonds * v_rate, 2);

  SELECT COUNT(*) INTO v_pending
    FROM public.withdrawal_requests
   WHERE user_id = v_uid AND status = 'pending';
  IF v_pending > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'pending_exists');
  END IF;

  SELECT total_diamonds INTO v_current FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_current IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;
  IF v_current < p_amount_diamonds THEN
    RETURN jsonb_build_object('success', false, 'error', 'insufficient');
  END IF;

  -- Elmas düşümü ve talep kaydı TEK işlemde (biri başarısız olursa ikisi de geri alınır).
  v_new := v_current - p_amount_diamonds;
  UPDATE public.profiles SET total_diamonds = v_new WHERE id = v_uid;

  INSERT INTO public.withdrawal_requests (user_id, amount_diamonds, amount_currency, currency, iban, full_name, status)
  VALUES (v_uid, p_amount_diamonds, v_amount, v_currency, btrim(p_iban), btrim(p_full_name), 'pending')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_id, 'new_balance', v_new,
                            'amount', v_amount, 'currency', v_currency);
END;
$function$;

-- Yalnızca giriş yapmış kullanıcılar çağırabilsin (anon ve herkes kapalı)
REVOKE ALL ON FUNCTION public.request_diamond_withdrawal(integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_diamond_withdrawal(integer, text, text, text) TO authenticated;


-- 4) ESKİ, DOĞRULAMASIZ YOLLARI KAPAT -----------------------------------
-- Eski 5 parametreli fonksiyon (tutarı istemciden alıyordu)
DROP FUNCTION IF EXISTS public.request_diamond_withdrawal(uuid, integer, numeric, text, text);

-- Kullanıcıların withdrawal_requests tablosuna DOĞRUDAN kayıt eklemesi (artık yalnızca fonksiyon üzerinden)
DROP POLICY IF EXISTS "Kullanıcılar sadece kendi adına çekim talebi açabilir" ON public.withdrawal_requests;
