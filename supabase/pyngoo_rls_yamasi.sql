-- ============================================================================
-- PYNGOO RLS YAMASI (2026-09-24) — pyngoo_panel_yetki_yamasi.sql'den SONRA çalıştırın.
-- Tek transaction'dır; hata olursa hiçbir değişiklik uygulanmaz.
--
--  1. profiles       : giriş yapmamış (anon) kimse okuyamaz.
--  2. match_history  : yalnızca görüşmenin tarafları (ve admin/moderatör) görür/günceller.
--                      Yeni 'direct_pending' durumu (doğrudan arama) kısıtlamaya eklenir.
--  3. reports        : anon'a tamamen kapalı; kullanıcı yalnızca kendi adına şikayet açar.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. profiles: SELECT yalnızca giriş yapmış kullanıcılara
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd IN ('SELECT', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY profiles_select_authenticated ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

-- Önceden 'ALL' politikası silindiyse kullanıcının kendi profiline yazma yetkileri korunur
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_delete_own ON public.profiles;
CREATE POLICY profiles_delete_own ON public.profiles
  FOR DELETE TO authenticated
  USING (id = auth.uid());

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles FROM anon;

-- ---------------------------------------------------------------------------
-- 2. match_history
-- ---------------------------------------------------------------------------
-- 2a. status sütununda CHECK kısıtlaması varsa 'direct_pending' ekle
DO $$
DECLARE c RECORD; v_def TEXT; v_new TEXT;
BEGIN
  FOR c IN
    SELECT con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    WHERE con.conrelid = 'public.match_history'::regclass AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%status%'
      AND pg_get_constraintdef(con.oid) NOT ILIKE '%direct_pending%'
  LOOP
    v_def := c.def;
    v_new := replace(v_def, '''pending''::text', '''pending''::text, ''direct_pending''::text');
    IF v_new <> v_def AND v_def ILIKE '%ANY (ARRAY[%' THEN
      EXECUTE format('ALTER TABLE public.match_history DROP CONSTRAINT %I', c.conname);
      EXECUTE format('ALTER TABLE public.match_history ADD CONSTRAINT %I %s', c.conname, v_new);
      RAISE NOTICE 'match_history kısıtı güncellendi: %', c.conname;
    ELSE
      RAISE NOTICE 'match_history kısıtı otomatik güncellenemedi, elle kontrol edin: % -> %', c.conname, v_def;
    END IF;
  END LOOP;
END $$;

-- 2b. Politikalar
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'match_history'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.match_history', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY mh_select_participants ON public.match_history
  FOR SELECT TO authenticated
  USING (caller_id = auth.uid() OR receiver_id = auth.uid() OR public.is_staff());

CREATE POLICY mh_insert_caller ON public.match_history
  FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid() AND receiver_id IS NOT NULL AND receiver_id <> auth.uid());

CREATE POLICY mh_update_participants ON public.match_history
  FOR UPDATE TO authenticated
  USING (caller_id = auth.uid() OR receiver_id = auth.uid())
  WITH CHECK (caller_id = auth.uid() OR receiver_id = auth.uid());

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.match_history FROM anon;

-- ---------------------------------------------------------------------------
-- 3. reports: anon kapalı, kullanıcı sadece kendi adına şikayet açar
-- ---------------------------------------------------------------------------
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_insert_own ON public.reports;
CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

REVOKE SELECT, INSERT, UPDATE, DELETE ON public.reports FROM anon;

COMMIT;

-- KONTROL: tablo başına politikalar
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('profiles', 'match_history', 'reports')
ORDER BY tablename, cmd, policyname;
