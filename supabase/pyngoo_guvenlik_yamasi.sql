-- ============================================================================
-- PYNGOO GÜVENLİK YAMASI (2026-09-24)
-- Supabase SQL Editor'de TEK SEFERDE çalıştırın. Tek bir transaction'dır:
-- herhangi bir adım hata verirse hiçbir değişiklik uygulanmaz.
--
-- Kapatılan açıklar:
--  1. Admin RPC'leri (moderatör atama, ödeme onayı, profil silme, yetim temizliği)
--     giriş yapmamış herkese açıktı  -> yalnızca role='admin' olan GİRİŞ YAPMIŞ hesap.
--  2. deduct_gold / request_diamond_withdrawal başkası adına çağrılabiliyordu.
--  3. Hediye/arama RPC'lerinde elmas miktarını istemci belirliyordu -> sabit fiyat listesi.
--  4. Kullanıcı kendi profiline doğrudan +50.000 altın yazabiliyordu -> altın/elmas
--     artışı yalnızca güvenli sunucu fonksiyonlarıyla.
--  5. Kayıt anında profil INSERT ile sınırsız altın/rol yazılabiliyordu.
--  6. payment_notifications herkese açık okunabiliyordu.
--  7. check_email_exists e-postadan rumuz sızdırıyordu.
--
-- Yeni güvenli fonksiyonlar: claim_daily_reward(), claim_ad_reward()
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Yardımcı: Çağıran kişi admin mi?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND COALESCE(is_banned, false) = false
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- 1. ADMIN RPC'LERİ
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.approve_payment_order(
  p_order_id UUID,
  p_admin_notes TEXT DEFAULT 'Yonetici tarafindan onaylandi'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_current_gold INT;
  v_new_gold INT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz');
  END IF;

  SELECT * INTO v_order FROM public.payment_notifications WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Siparis bulunamadi');
  END IF;
  IF v_order.status = 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu siparis zaten daha once onaylanmis!');
  END IF;

  SELECT total_gold INTO v_current_gold FROM public.profiles WHERE id = v_order.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kullanici profili bulunamadi');
  END IF;

  PERFORM set_config('app.bypass_diamond_check', 'on', true);
  v_new_gold := COALESCE(v_current_gold, 0) + COALESCE(v_order.total_gold, 0);
  UPDATE public.profiles SET total_gold = v_new_gold WHERE id = v_order.user_id;
  UPDATE public.payment_notifications
     SET status = 'approved', admin_notes = p_admin_notes
   WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'user_id', v_order.user_id,
    'new_gold', v_new_gold, 'added_gold', v_order.total_gold);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_moderator_status(
  p_target TEXT,
  p_is_moderator BOOLEAN,
  p_role TEXT DEFAULT 'user'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz');
  END IF;
  IF p_role NOT IN ('user', 'moderator', 'streamer') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gecersiz rol');
  END IF;

  PERFORM set_config('app.bypass_diamond_check', 'on', true);

  IF p_target ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    UPDATE public.profiles SET is_moderator = p_is_moderator, role = p_role
     WHERE id = p_target::UUID AND role <> 'admin';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;
  IF v_updated = 0 THEN
    UPDATE public.profiles SET is_moderator = p_is_moderator, role = p_role
     WHERE LOWER(display_name) = LOWER(TRIM(p_target)) AND role <> 'admin';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('success', true, 'updated_count', v_updated);
END;
$$;

CREATE OR REPLACE FUNCTION public.clean_orphaned_profiles()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz');
  END IF;
  WITH deleted_rows AS (
    DELETE FROM public.profiles p
    WHERE COALESCE(p.role, '') NOT IN ('bot', 'admin')
      AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_count FROM deleted_rows;
  RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.approve_payment_order(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_moderator_status(TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.clean_orphaned_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payment_order(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_moderator_status(TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clean_orphaned_profiles() TO authenticated;

-- admin_delete_profile / delete_report: gövdeleri bu repoda yok. Güvenli tarafta kalmak için
-- istemciden çağrılması tamamen kapatılır (yalnızca service_role / SQL Editor).
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('admin_delete_profile', 'delete_report')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. KULLANICI PARA / BAKİYE RPC'LERİ: sadece kendi hesabın
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deduct_gold(p_user_id UUID, p_amount INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_gold INT;
  v_new_gold INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz işlem');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Geçersiz altın miktarı');
  END IF;

  SELECT total_gold INTO v_current_gold FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_current_gold IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kullanıcı bulunamadı');
  END IF;
  IF v_current_gold < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetersiz altın bakiyesi');
  END IF;

  v_new_gold := v_current_gold - p_amount;
  UPDATE public.profiles SET total_gold = v_new_gold WHERE id = p_user_id;
  RETURN jsonb_build_object('success', true, 'new_balance', v_new_gold);
END;
$$;

CREATE OR REPLACE FUNCTION public.request_diamond_withdrawal(
  p_user_id UUID,
  p_amount_diamonds INT,
  p_amount_currency NUMERIC,
  p_iban TEXT,
  p_full_name TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_diamonds INT;
  v_pending_count INT;
  v_new_diamonds INT;
  v_request_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz işlem');
  END IF;
  IF p_amount_diamonds IS NULL OR p_amount_diamonds <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Geçersiz çekim miktarı');
  END IF;

  SELECT COUNT(*) INTO v_pending_count
    FROM public.withdrawal_requests
   WHERE user_id = p_user_id AND status = 'pending';
  IF v_pending_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Zaten beklemede olan bir çekim talebiniz bulunmaktadır.');
  END IF;

  SELECT total_diamonds INTO v_current_diamonds
    FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF v_current_diamonds IS NULL OR v_current_diamonds < p_amount_diamonds THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetersiz elmas bakiyesi');
  END IF;

  v_new_diamonds := v_current_diamonds - p_amount_diamonds;
  UPDATE public.profiles SET total_diamonds = v_new_diamonds WHERE id = p_user_id;

  INSERT INTO public.withdrawal_requests (user_id, amount_diamonds, amount_currency, iban, full_name, status)
  VALUES (p_user_id, p_amount_diamonds, p_amount_currency, TRIM(p_iban), TRIM(p_full_name), 'pending')
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id, 'new_balance', v_new_diamonds);
END;
$$;

REVOKE ALL ON FUNCTION public.deduct_gold(UUID, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_diamond_withdrawal(UUID, INT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deduct_gold(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_diamond_withdrawal(UUID, INT, NUMERIC, TEXT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. HEDİYE / ARAMA RPC'LERİ: sabit fiyat listesi (VoiceChat.tsx & Chats.tsx ile birebir)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_gift_transaction(
  p_sender_id UUID,
  p_receiver_id UUID,
  p_gold_cost INT,
  p_diamond_reward INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_gold INT;
  v_receiver_gender TEXT;
  v_final_diamonds INT := 0;
  v_sender_new_gold INT;
  v_allowed_reward INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_sender_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz işlem');
  END IF;
  IF p_receiver_id IS NULL OR p_receiver_id = p_sender_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Geçersiz alıcı');
  END IF;

  -- Hediye kataloğu: altın -> elmas (istemcinin gönderdiği elmas değeri YOK SAYILIR)
  v_allowed_reward := CASE p_gold_cost
    WHEN 10 THEN 3     WHEN 20 THEN 6     WHEN 35 THEN 10    WHEN 50 THEN 15
    WHEN 100 THEN 30   WHEN 200 THEN 60   WHEN 350 THEN 105  WHEN 500 THEN 150
    WHEN 1000 THEN 300 WHEN 2000 THEN 600 WHEN 3000 THEN 900 WHEN 5000 THEN 1500
    ELSE NULL END;
  IF v_allowed_reward IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Geçersiz hediye');
  END IF;

  SELECT total_gold INTO v_sender_gold FROM public.profiles WHERE id = p_sender_id FOR UPDATE;
  IF v_sender_gold IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gönderen profil bulunamadı');
  END IF;
  IF v_sender_gold < p_gold_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetersiz altın bakiyesi');
  END IF;

  SELECT gender INTO v_receiver_gender FROM public.profiles WHERE id = p_receiver_id FOR UPDATE;
  IF v_receiver_gender = 'kadin' THEN
    v_final_diamonds := v_allowed_reward;
  END IF;

  PERFORM set_config('app.bypass_diamond_check', 'on', true);
  v_sender_new_gold := v_sender_gold - p_gold_cost;
  UPDATE public.profiles SET total_gold = v_sender_new_gold WHERE id = p_sender_id;
  IF v_final_diamonds > 0 THEN
    UPDATE public.profiles SET total_diamonds = COALESCE(total_diamonds, 0) + v_final_diamonds
     WHERE id = p_receiver_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'new_gold', v_sender_new_gold, 'diamonds_awarded', v_final_diamonds);
END;
$$;

-- Süre uzatma: SABİT 20 altın -> 5 elmas
CREATE OR REPLACE FUNCTION public.reward_call_extension(
  p_sender_id UUID,
  p_partner_id UUID,
  p_gold_cost INT DEFAULT 20,
  p_diamond_reward INT DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_cost CONSTANT INT := 20;
  c_reward CONSTANT INT := 5;
  v_sender_gold INT;
  v_partner_gender TEXT;
  v_final_diamonds INT := 0;
  v_sender_new_gold INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_sender_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz işlem');
  END IF;
  IF p_partner_id IS NULL OR p_partner_id = p_sender_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Geçersiz partner');
  END IF;

  SELECT total_gold INTO v_sender_gold FROM public.profiles WHERE id = p_sender_id FOR UPDATE;
  IF v_sender_gold IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kullanıcı bulunamadı');
  END IF;
  IF v_sender_gold < c_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetersiz altın bakiyesi');
  END IF;

  SELECT gender INTO v_partner_gender FROM public.profiles WHERE id = p_partner_id FOR UPDATE;
  IF v_partner_gender = 'kadin' THEN
    v_final_diamonds := c_reward;
  END IF;

  PERFORM set_config('app.bypass_diamond_check', 'on', true);
  v_sender_new_gold := v_sender_gold - c_cost;
  UPDATE public.profiles SET total_gold = v_sender_new_gold WHERE id = p_sender_id;
  IF v_final_diamonds > 0 THEN
    UPDATE public.profiles SET total_diamonds = COALESCE(total_diamonds, 0) + v_final_diamonds
     WHERE id = p_partner_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'new_gold', v_sender_new_gold, 'diamonds_awarded', v_final_diamonds);
END;
$$;

-- Doğrudan arama: SABİT 120 altın -> 30 elmas (dakika başı)
CREATE OR REPLACE FUNCTION public.reward_direct_call_start(
  p_caller_id UUID,
  p_receiver_id UUID,
  p_gold_cost INT DEFAULT 120,
  p_diamond_reward INT DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_cost CONSTANT INT := 120;
  c_reward CONSTANT INT := 30;
  v_caller_gold INT;
  v_receiver_gender TEXT;
  v_final_diamonds INT := 0;
  v_caller_new_gold INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz işlem');
  END IF;
  IF p_receiver_id IS NULL OR p_receiver_id = p_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Geçersiz alıcı');
  END IF;

  SELECT total_gold INTO v_caller_gold FROM public.profiles WHERE id = p_caller_id FOR UPDATE;
  IF v_caller_gold IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kullanıcı bulunamadı');
  END IF;
  IF v_caller_gold < c_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetersiz altın bakiyesi');
  END IF;

  SELECT gender INTO v_receiver_gender FROM public.profiles WHERE id = p_receiver_id FOR UPDATE;
  IF v_receiver_gender = 'kadin' THEN
    v_final_diamonds := c_reward;
  END IF;

  PERFORM set_config('app.bypass_diamond_check', 'on', true);
  v_caller_new_gold := v_caller_gold - c_cost;
  UPDATE public.profiles SET total_gold = v_caller_new_gold WHERE id = p_caller_id;
  IF v_final_diamonds > 0 THEN
    UPDATE public.profiles SET total_diamonds = COALESCE(total_diamonds, 0) + v_final_diamonds
     WHERE id = p_receiver_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'new_gold', v_caller_new_gold, 'diamonds_awarded', v_final_diamonds);
END;
$$;

REVOKE ALL ON FUNCTION public.send_gift_transaction(UUID, UUID, INT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reward_call_extension(UUID, UUID, INT, INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reward_direct_call_start(UUID, UUID, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_gift_transaction(UUID, UUID, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reward_call_extension(UUID, UUID, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reward_direct_call_start(UUID, UUID, INT, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. GÜNLÜK ÖDÜL & REKLAM ÖDÜLÜ (artık sunucuda hesaplanır)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ad_reward_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ad_reward_count INT NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_ad_reward_at TIMESTAMPTZ;

-- DailyRewards.tsx REWARDS tablosunun birebir karşılığı; güncellenmiş profil satırını döndürür.
CREATE OR REPLACE FUNCTION public.claim_daily_reward()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_p RECORD;
  v_streak INT;
  v_idx INT;
  v_gold INT[]    := ARRAY[10, 20, 30, 40, 50, 80, 150];
  v_diamond INT[] := ARRAY[0, 0, 0, 0, 0, 0, 1];
  v_friend INT[]  := ARRAY[0, 0, 1, 0, 0, 0, 2];
  v_extend INT[]  := ARRAY[0, 0, 0, 0, 1, 0, 2];
  v_today DATE := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_last_day DATE;
  v_row public.profiles;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz');
  END IF;

  SELECT * INTO v_p FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profil bulunamadı');
  END IF;

  IF v_p.last_reward_date IS NOT NULL THEN
    v_last_day := (v_p.last_reward_date::timestamptz AT TIME ZONE 'Europe/Istanbul')::date;
    IF v_last_day = v_today OR now() - v_p.last_reward_date::timestamptz < interval '20 hours' THEN
      RETURN jsonb_build_object('success', false, 'error', 'already_claimed');
    END IF;
  END IF;

  IF v_last_day IS NOT NULL AND v_last_day = v_today - 1 THEN
    v_streak := COALESCE(v_p.login_streak, 0) % 7;
  ELSE
    v_streak := 0;
  END IF;
  v_idx := LEAST(v_streak, 6) + 1; -- PostgreSQL dizileri 1'den başlar

  PERFORM set_config('app.bypass_diamond_check', 'on', true);
  UPDATE public.profiles SET
    total_gold       = COALESCE(total_gold, 0) + v_gold[v_idx],
    total_diamonds   = COALESCE(total_diamonds, 0) + v_diamond[v_idx],
    free_friend_adds = COALESCE(free_friend_adds, 0) + v_friend[v_idx],
    free_extensions  = COALESCE(free_extensions, 0) + v_extend[v_idx],
    login_streak     = v_streak + 1,
    last_reward_date = now()
  WHERE id = v_uid
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('success', true, 'gold_added', v_gold[v_idx], 'profile', to_jsonb(v_row));
END;
$$;

-- Reklam ödülü: +20 altın, günde en fazla 5, iki ödül arası en az 20 sn.
CREATE OR REPLACE FUNCTION public.claim_ad_reward()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c_gold CONSTANT INT := 20;
  c_daily_limit CONSTANT INT := 5;
  v_uid UUID := auth.uid();
  v_p RECORD;
  v_today DATE := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_count INT;
  v_new_gold INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz');
  END IF;

  SELECT total_gold, ad_reward_date, ad_reward_count, last_ad_reward_at
    INTO v_p FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profil bulunamadı');
  END IF;

  v_count := CASE WHEN v_p.ad_reward_date = v_today THEN COALESCE(v_p.ad_reward_count, 0) ELSE 0 END;
  IF v_count >= c_daily_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'daily_limit', 'remaining', 0);
  END IF;
  IF v_p.last_ad_reward_at IS NOT NULL AND now() - v_p.last_ad_reward_at < interval '20 seconds' THEN
    RETURN jsonb_build_object('success', false, 'error', 'too_fast', 'remaining', c_daily_limit - v_count);
  END IF;

  PERFORM set_config('app.bypass_diamond_check', 'on', true);
  UPDATE public.profiles SET
    total_gold = COALESCE(total_gold, 0) + c_gold,
    ad_reward_date = v_today,
    ad_reward_count = v_count + 1,
    last_ad_reward_at = now()
  WHERE id = v_uid
  RETURNING total_gold INTO v_new_gold;

  RETURN jsonb_build_object('success', true, 'new_gold', v_new_gold, 'gold_added', c_gold,
                            'remaining', c_daily_limit - (v_count + 1));
END;
$$;

REVOKE ALL ON FUNCTION public.claim_daily_reward() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_ad_reward() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_daily_reward() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward() TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. PROFİL KORUMA TRIGGER'LARI
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_critical_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.bypass_diamond_check', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Kısıtlar yalnızca uygulama istemcilerine (anon/authenticated JWT) uygulanır;
  -- SQL Editor ve service_role etkilenmez.
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    -- Yetki yükseltme / ban kaldırma engeli
    NEW.role := OLD.role;
    NEW.is_moderator := OLD.is_moderator;
    NEW.is_banned := OLD.is_banned;

    -- Altın ve elmas istemciden ASLA artırılamaz (yalnızca güvenli RPC'ler artırır)
    IF COALESCE(NEW.total_gold, 0) > COALESCE(OLD.total_gold, 0) THEN
      NEW.total_gold := OLD.total_gold;
    END IF;
    IF COALESCE(NEW.total_diamonds, 0) > COALESCE(OLD.total_diamonds, 0) THEN
      NEW.total_diamonds := OLD.total_diamonds;
    END IF;

    -- Ödül sayaçları istemciden artırılamaz / sıfırlanamaz
    IF COALESCE(NEW.free_friend_adds, 0) > COALESCE(OLD.free_friend_adds, 0) THEN
      NEW.free_friend_adds := OLD.free_friend_adds;
    END IF;
    -- Günlük sıfırlama (App.tsx) uzatma hakkını 2'ye çekebilir; daha fazlası yalnızca RPC ile.
    IF COALESCE(NEW.free_extensions, 0) > GREATEST(COALESCE(OLD.free_extensions, 0), 2) THEN
      NEW.free_extensions := OLD.free_extensions;
    END IF;
    NEW.login_streak := OLD.login_streak;
    NEW.last_reward_date := OLD.last_reward_date;
    NEW.ad_reward_date := OLD.ad_reward_date;
    NEW.ad_reward_count := OLD.ad_reward_count;
    NEW.last_ad_reward_at := OLD.last_ad_reward_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_critical_fields();

-- Yeni profil oluşturulurken bakiye ve rol istemciden belirlenemez
CREATE OR REPLACE FUNCTION public.protect_profile_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('app.bypass_diamond_check', true) = 'on' THEN
    RETURN NEW;
  END IF;
  -- Kısıtlar yalnızca uygulama istemcilerine (anon/authenticated JWT) uygulanır;
  -- SQL Editor ve service_role etkilenmez.
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    NEW.total_gold := 0;
    NEW.total_diamonds := 0;
    NEW.is_banned := false;
    NEW.is_moderator := false;
    IF COALESCE(NEW.role, 'user') NOT IN ('user', 'streamer') THEN
      NEW.role := 'user';
    END IF;
    NEW.free_extensions := LEAST(COALESCE(NEW.free_extensions, 2), 2);
    NEW.free_friend_adds := 0;
    NEW.login_streak := 0;
    NEW.last_reward_date := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_insert ON public.profiles;
CREATE TRIGGER trg_protect_profile_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_insert();

-- ---------------------------------------------------------------------------
-- 6. payment_notifications: herkes okuyamaz
-- ---------------------------------------------------------------------------
ALTER TABLE public.payment_notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'payment_notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.payment_notifications', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY pn_select_own_or_admin ON public.payment_notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY pn_insert_own_pending ON public.payment_notifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY pn_admin_update ON public.payment_notifications
  FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY pn_admin_delete ON public.payment_notifications
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ---------------------------------------------------------------------------
-- 7. check_email_exists: rumuz sızdırmaz (giriş/kayıt akışı için sadece var/yok)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_exists BOOLEAN := false;
  v_name TEXT := '';
BEGIN
  IF p_email IS NULL OR TRIM(p_email) = '' THEN
    RETURN jsonb_build_object('exists', false, 'display_name', '');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE LOWER(u.email) = LOWER(TRIM(p_email)) AND COALESCE(p.role, '') <> 'deleted'
  ) INTO v_exists;

  -- Rumuz yalnızca e-postanın SAHİBİNE döner (App.tsx'teki OAuth kontrolü için)
  IF v_exists AND auth.uid() IS NOT NULL THEN
    SELECT p.display_name INTO v_name
    FROM auth.users u JOIN public.profiles p ON p.id = u.id
    WHERE LOWER(u.email) = LOWER(TRIM(p_email))
      AND LOWER(u.email) = LOWER((SELECT email FROM auth.users WHERE id = auth.uid()))
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object('exists', v_exists, 'display_name', COALESCE(v_name, ''));
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO anon, authenticated;

COMMIT;

-- ============================================================================
-- KONTROL: Bu sorgu yamadan sonra 'herkes_cagirabilir' sütununda sadece
-- check_email_exists için true göstermelidir.
-- ============================================================================
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'execute') AS herkes_cagirabilir,
       has_function_privilege('authenticated', p.oid, 'execute') AS uyeler_cagirabilir
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN (
  'admin_set_moderator_status','approve_payment_order','request_diamond_withdrawal',
  'deduct_gold','send_gift_transaction','reward_call_extension','reward_direct_call_start',
  'clean_orphaned_profiles','check_email_exists','admin_delete_profile','delete_report',
  'claim_daily_reward','claim_ad_reward','is_admin')
ORDER BY 1;
