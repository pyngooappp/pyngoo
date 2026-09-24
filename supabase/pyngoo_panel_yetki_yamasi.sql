-- ============================================================================
-- PYNGOO YÖNETİCİ PANELİ YETKİ YAMASI (2026-09-24)
-- pyngoo_guvenlik_yamasi.sql'den SONRA çalıştırın. Tek transaction'dır.
--
-- Panel artık gerçek Supabase oturumuyla çalışır:
--   * role = 'admin'  -> tam yetki (ödeme onayı, moderatör atama, silme, çekim işlemleri)
--   * is_moderator     -> şikayetleri yönetme ve kullanıcı banlama / ban kaldırma
-- Yetkiler sunucuda is_admin() / is_staff() ile kontrol edilir; istemciye güvenilmez.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Süper admin hesapları (CLAUDE.md'deki iki UID) kesin olarak admin
-- ---------------------------------------------------------------------------
UPDATE public.profiles
   SET role = 'admin', is_banned = false
 WHERE id IN ('d6afbbb7-9a25-4552-a913-e80a1bae7e2b', '22b3c0e7-e1e2-4cb5-9532-990066b5a80c');

-- ---------------------------------------------------------------------------
-- 1. Yardımcı: admin veya moderatör mü?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND COALESCE(is_banned, false) = false
      AND (role IN ('admin', 'moderator') OR is_moderator = true)
  );
$$;
REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Profil koruma trigger'ı: admin / moderatör kuralları eklendi
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_critical_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_banned BOOLEAN;
BEGIN
  IF current_setting('app.bypass_diamond_check', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Kısıtlar yalnızca uygulama istemcilerine (anon/authenticated JWT) uygulanır;
  -- SQL Editor ve service_role etkilenmez.
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN

    -- BAŞKASININ profili
    IF auth.uid() IS DISTINCT FROM OLD.id THEN
      -- Admin: başka bir admini değiştiremez, diğer herkesi düzenleyebilir (iade, ban vb.)
      IF public.is_admin() AND COALESCE(OLD.role, '') <> 'admin' THEN
        IF NEW.role = 'admin' THEN
          NEW.role := OLD.role; -- admin rolü sadece SQL Editor'den verilebilir
        END IF;
        RETURN NEW;
      END IF;
      -- Moderatör: admin olmayan kullanıcıyı sadece banlayabilir / banını kaldırabilir
      IF public.is_staff() AND COALESCE(OLD.role, '') <> 'admin' THEN
        v_banned := NEW.is_banned;
        NEW := OLD;
        NEW.is_banned := v_banned;
        RETURN NEW;
      END IF;
      RETURN OLD; -- yetkisiz: hiçbir alan değişmez
    END IF;

    -- KENDİ profili (admin dahil): kritik alanlar istemciden değiştirilemez
    NEW.role := OLD.role;
    NEW.is_moderator := OLD.is_moderator;
    NEW.is_banned := OLD.is_banned;

    IF COALESCE(NEW.total_gold, 0) > COALESCE(OLD.total_gold, 0) THEN
      NEW.total_gold := OLD.total_gold;
    END IF;
    IF COALESCE(NEW.total_diamonds, 0) > COALESCE(OLD.total_diamonds, 0) THEN
      NEW.total_diamonds := OLD.total_diamonds;
    END IF;
    IF COALESCE(NEW.free_friend_adds, 0) > COALESCE(OLD.free_friend_adds, 0) THEN
      NEW.free_friend_adds := OLD.free_friend_adds;
    END IF;
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

-- ---------------------------------------------------------------------------
-- 3. RLS politikaları (mevcut politikalara EK; kullanıcıların kendi yetkileri değişmez)
-- ---------------------------------------------------------------------------
-- profiles: yetkililer başkasını güncelleyebilir (trigger alan bazında sınırlar), admin silebilir
DROP POLICY IF EXISTS profiles_staff_update ON public.profiles;
CREATE POLICY profiles_staff_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS profiles_admin_delete ON public.profiles;
CREATE POLICY profiles_admin_delete ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin() AND COALESCE(role, '') <> 'admin');

-- Diğer tablolar: sadece mevcutsa politika ekle
DO $$
BEGIN
  -- Şikayetler: moderatörler görür, günceller, siler
  IF to_regclass('public.reports') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS reports_staff_select ON public.reports';
    EXECUTE 'CREATE POLICY reports_staff_select ON public.reports FOR SELECT TO authenticated USING (public.is_staff())';
    EXECUTE 'DROP POLICY IF EXISTS reports_staff_update ON public.reports';
    EXECUTE 'CREATE POLICY reports_staff_update ON public.reports FOR UPDATE TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff())';
    EXECUTE 'DROP POLICY IF EXISTS reports_staff_delete ON public.reports';
    EXECUTE 'CREATE POLICY reports_staff_delete ON public.reports FOR DELETE TO authenticated USING (public.is_staff())';
  END IF;

  -- Elmas çekim talepleri (IBAN içerir): sadece admin görür ve günceller
  IF to_regclass('public.withdrawal_requests') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS wr_admin_select ON public.withdrawal_requests';
    EXECUTE 'CREATE POLICY wr_admin_select ON public.withdrawal_requests FOR SELECT TO authenticated USING (public.is_admin())';
    EXECUTE 'DROP POLICY IF EXISTS wr_admin_update ON public.withdrawal_requests';
    EXECUTE 'CREATE POLICY wr_admin_update ON public.withdrawal_requests FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())';
  END IF;

  -- İnceleme/denetim ekranları için okuma
  IF to_regclass('public.transactions') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS tx_staff_select ON public.transactions';
    EXECUTE 'CREATE POLICY tx_staff_select ON public.transactions FOR SELECT TO authenticated USING (public.is_staff())';
  END IF;
  IF to_regclass('public.match_history') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS mh_staff_select ON public.match_history';
    EXECUTE 'CREATE POLICY mh_staff_select ON public.match_history FOR SELECT TO authenticated USING (public.is_staff())';
  END IF;
  IF to_regclass('public.messages') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS msg_staff_select ON public.messages';
    EXECUTE 'CREATE POLICY msg_staff_select ON public.messages FOR SELECT TO authenticated USING (public.is_staff())';
  END IF;
  IF to_regclass('public.waiting_room') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS wroom_admin_delete ON public.waiting_room';
    EXECUTE 'CREATE POLICY wroom_admin_delete ON public.waiting_room FOR DELETE TO authenticated USING (public.is_admin())';
  END IF;
END $$;

COMMIT;

-- KONTROL: admin ve moderatör hesapları
SELECT id, display_name, role, is_moderator, is_banned
FROM public.profiles
WHERE role IN ('admin', 'moderator') OR is_moderator = true
ORDER BY role, display_name;
