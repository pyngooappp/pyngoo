-- ============================================================================
-- PYNGOO BEĞENİ (KALP) YAMASI (2026-09-24) — önceki yamalardan SONRA çalıştırın.
-- Kural: Her kullanıcı bir başkasına ÖMÜR BOYU yalnızca 1 kez kalp atabilir.
--  * Beğeniler user_likes tablosunda (beğenen, beğenilen) çifti olarak tutulur.
--  * Sayaç (profiles.total_likes) yalnızca like_user() fonksiyonuyla artar;
--    istemci kendi ya da başkasının sayacını doğrudan değiştiremez.
-- Tek transaction'dır.
-- ============================================================================

BEGIN;

-- 1. Beğeni kayıtları
CREATE TABLE IF NOT EXISTS public.user_likes (
  liker_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (liker_id, target_id),
  CHECK (liker_id <> target_id)
);

ALTER TABLE public.user_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_likes_select_own ON public.user_likes;
CREATE POLICY user_likes_select_own ON public.user_likes
  FOR SELECT TO authenticated
  USING (liker_id = auth.uid() OR target_id = auth.uid());
-- INSERT/UPDATE/DELETE politikası YOK: yazma yalnızca like_user() ile.
REVOKE ALL ON public.user_likes FROM anon;
GRANT SELECT ON public.user_likes TO authenticated;

-- 2. Güvenli beğeni fonksiyonu
CREATE OR REPLACE FUNCTION public.like_user(p_target UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_inserted INT := 0;
  v_likes INT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz');
  END IF;
  IF p_target IS NULL OR p_target = v_uid THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gecersiz hedef');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_target) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kullanici bulunamadi');
  END IF;

  INSERT INTO public.user_likes (liker_id, target_id)
  VALUES (v_uid, p_target)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    SELECT total_likes INTO v_likes FROM public.profiles WHERE id = p_target;
    RETURN jsonb_build_object('success', true, 'already', true, 'total_likes', COALESCE(v_likes, 0));
  END IF;

  PERFORM set_config('app.bypass_diamond_check', 'on', true);
  UPDATE public.profiles
     SET total_likes = COALESCE(total_likes, 0) + 1
   WHERE id = p_target
  RETURNING total_likes INTO v_likes;

  RETURN jsonb_build_object('success', true, 'already', false, 'total_likes', v_likes);
END;
$$;
REVOKE ALL ON FUNCTION public.like_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.like_user(UUID) TO authenticated;

-- 3. Eski uygulama sürümlerinin çağırdığı fonksiyon: artık aynı kurala uyar
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'increment_user_likes'
  LOOP
    EXECUTE format('DROP FUNCTION %s', f.sig);
  END LOOP;
END $$;

CREATE FUNCTION public.increment_user_likes(target_user_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.like_user(target_user_id); $$;
REVOKE ALL ON FUNCTION public.increment_user_likes(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_user_likes(UUID) TO authenticated;

-- 4. Profil koruma trigger'ı: total_likes istemciden değiştirilemez
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
      IF public.is_admin() AND COALESCE(OLD.role, '') <> 'admin' THEN
        IF NEW.role = 'admin' THEN
          NEW.role := OLD.role;
        END IF;
        RETURN NEW;
      END IF;
      IF public.is_staff() AND COALESCE(OLD.role, '') <> 'admin' THEN
        v_banned := NEW.is_banned;
        NEW := OLD;
        NEW.is_banned := v_banned;
        RETURN NEW;
      END IF;
      RETURN OLD;
    END IF;

    -- KENDİ profili
    NEW.role := OLD.role;
    NEW.is_moderator := OLD.is_moderator;
    NEW.is_banned := OLD.is_banned;
    NEW.total_likes := OLD.total_likes;

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

-- Yeni profil: beğeni sayacı sıfırdan başlar
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
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated') THEN
    NEW.total_gold := 0;
    NEW.total_diamonds := 0;
    NEW.total_likes := 0;
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

COMMIT;

-- KONTROL
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'execute') AS herkes_cagirabilir,
       has_function_privilege('authenticated', p.oid, 'execute') AS uyeler_cagirabilir
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname IN ('like_user', 'increment_user_likes')
ORDER BY 1;
