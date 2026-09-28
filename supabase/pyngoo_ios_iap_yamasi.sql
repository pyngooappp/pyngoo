-- =====================================================================
-- Pyngoo - iOS Apple In-App Purchase (IAP) altyapısı
-- Tarih: 2026-09-28
--
-- Apple App Store Review Guideline 3.1.1: uygulama içinde kullanılan sanal para
-- (altın) iOS'ta YALNIZCA Apple'ın kendi satın alma sistemi üzerinden satılabilir.
-- Bu yama:
--   1) Apple ürün kimliği -> altın miktarı eşlemesini VERİTABANINDA tutar
--      (istemciden veya webhook gövdesinden GELEN miktara asla güvenilmez).
--   2) Aynı RevenueCat/Apple işlem kimliği ikinci kez geldiğinde (webhook tekrarı)
--      altının tekrar eklenmesini engeller (idempotency).
--   3) Altını yalnızca service_role (Supabase Edge Function) çağırabilen tek
--      güvenli fonksiyon üzerinden ekler; normal kullanıcı bu fonksiyonu
--      doğrudan çağıramaz.
--   4) Moderatör panelinin zaten okuduğu payment_notifications tablosunu
--      yeniden kullanır (yeni bir ekran/tablo gerekmez), payment_method='apple_iap'.
-- Tekrar çalıştırılabilir (idempotent).
-- =====================================================================


-- 1) ÜRÜN -> ALTIN EŞLEMESİ (App Store Connect'teki ürün kimlikleriyle BİREBİR aynı olmalı) ---
CREATE TABLE IF NOT EXISTS public.iap_products (
  product_id  text PRIMARY KEY,
  gold_amount integer NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  note        text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.iap_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS iap_products_read ON public.iap_products;
CREATE POLICY iap_products_read ON public.iap_products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS iap_products_admin_write ON public.iap_products;
CREATE POLICY iap_products_admin_write ON public.iap_products FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- NOT: gold_amount, Market.tsx'teki paketin (gold + bonus) TOPLAMIDIR — web/Android'de
-- kullanıcının aldığı toplam altınla iOS'ta aldığı birebir aynı olsun diye.
INSERT INTO public.iap_products (product_id, gold_amount, note) VALUES
  ('com.pyngoo.gold.650',   800,    'pack_650: 650 taban + 150 hediye'),
  ('com.pyngoo.gold.1400',  1800,   'pack_1400: 1400 taban + 400 hediye'),
  ('com.pyngoo.gold.3800',  5000,   'pack_3800: 3800 taban + 1200 hediye'),
  ('com.pyngoo.gold.8500',  12000,  'pack_8500: 8500 taban + 3500 hediye'),
  ('com.pyngoo.gold.18000', 25000,  'pack_18000: 18000 taban + 7000 hediye'),
  ('com.pyngoo.gold.40000', 55000,  'pack_40000: 40000 taban + 15000 hediye'),
  ('com.pyngoo.gold.85000', 120000, 'pack_85000: 85000 taban + 35000 hediye'),
  ('com.pyngoo.gold.vip_pass', 2000, 'vip_monthly: 1500 taban + 500 hediye (VIP Pass)')
ON CONFLICT (product_id) DO UPDATE SET gold_amount = EXCLUDED.gold_amount, note = EXCLUDED.note;


-- 2) payment_notifications: Apple işlemi için kaynak sütun + tekrar-kredi koruması ---
ALTER TABLE public.payment_notifications
  ADD COLUMN IF NOT EXISTS product_id text;

-- Aynı Apple/RevenueCat işlem kimliği (crypto_txid sütununu ödünç alıyoruz) yalnızca
-- payment_method='apple_iap' satırları arasında benzersiz olsun (kripto/havale ile çakışmaz).
CREATE UNIQUE INDEX IF NOT EXISTS payment_notifications_apple_txid_uniq
  ON public.payment_notifications (crypto_txid)
  WHERE payment_method = 'apple_iap';


-- 3) SUNUCU TARAFI KREDİ FONKSİYONU ------------------------------------------------
-- Yalnızca service_role (Edge Function) çağırabilir. Miktar İSTEMCİDEN/WEBHOOK'TAN
-- ALINMAZ; ürün kimliğine göre yalnızca yukarıdaki iap_products tablosundan okunur.
CREATE OR REPLACE FUNCTION public.credit_iap_gold(
  p_user_id        UUID,
  p_product_id     TEXT,
  p_transaction_id TEXT,
  p_environment    TEXT DEFAULT 'production',
  p_price_text     TEXT DEFAULT NULL
) RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_gold        INT;
  v_current     INT;
  v_new_gold    INT;
  v_order_id    UUID;
BEGIN
  IF p_user_id IS NULL OR COALESCE(btrim(p_transaction_id), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_input');
  END IF;

  SELECT gold_amount INTO v_gold FROM public.iap_products
   WHERE product_id = p_product_id AND active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'unknown_product');
  END IF;

  SELECT total_gold INTO v_current FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'profile_not_found');
  END IF;

  -- Bu işlem kimliği daha önce kredilendiyse (webhook tekrarı) sessizce başarı dön,
  -- altını İKİNCİ KEZ ekleme. Kayıt, benzersiz kısmi indeks üzerinden atomik olarak korunur.
  INSERT INTO public.payment_notifications
    (user_id, payment_method, gold_amount, bonus_amount, total_gold, price_text,
     order_code, crypto_txid, product_id, status, admin_notes)
  VALUES
    (p_user_id, 'apple_iap', v_gold, 0, v_gold, p_price_text,
     'APPLE-' || substr(p_transaction_id, 1, 16), p_transaction_id, p_product_id,
     'approved', 'Apple In-App Purchase, otomatik (' || p_environment || ')')
  ON CONFLICT (crypto_txid) WHERE (payment_method = 'apple_iap') DO NOTHING
  RETURNING id INTO v_order_id;

  IF v_order_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'duplicate', true);
  END IF;

  v_new_gold := COALESCE(v_current, 0) + v_gold;
  PERFORM set_config('app.bypass_diamond_check', 'on', true);
  UPDATE public.profiles SET total_gold = v_new_gold WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'user_id', p_user_id,
    'new_gold', v_new_gold, 'added_gold', v_gold, 'order_id', v_order_id);
END;
$$;

REVOKE ALL ON FUNCTION public.credit_iap_gold(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_iap_gold(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
