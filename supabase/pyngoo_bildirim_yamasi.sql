-- ============================================================================
-- PYNGOO TAKİP & BİLDİRİM YAMASI (2026-09-24) — önceki yamalardan SONRA çalıştırın.
--  * follows            : Takip ilişkileri artık sunucuda (önceden sadece telefonda tutuluyordu).
--  * push_tokens        : Kullanıcının cihaz bildirim anahtarları (iOS / Android / Web).
--  * live_notify_log    : Aynı yayıncı için bildirim sıklığı sınırı (spam engeli).
--  * get_follow_stats() : Gerçek takipçi sayıları (toplam + bugün).
-- Tek transaction'dır.
-- ============================================================================

BEGIN;

-- 1. Takipler
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS follows_following_idx ON public.follows (following_id);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS follows_select_own ON public.follows;
CREATE POLICY follows_select_own ON public.follows
  FOR SELECT TO authenticated
  USING (follower_id = auth.uid() OR following_id = auth.uid());
DROP POLICY IF EXISTS follows_insert_own ON public.follows;
CREATE POLICY follows_insert_own ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK (follower_id = auth.uid());
DROP POLICY IF EXISTS follows_delete_own ON public.follows;
CREATE POLICY follows_delete_own ON public.follows
  FOR DELETE TO authenticated
  USING (follower_id = auth.uid());
REVOKE ALL ON public.follows FROM anon;
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;

-- 2. Gerçek takipçi istatistikleri (herhangi bir yayıncı için, sadece sayılar)
CREATE OR REPLACE FUNCTION public.get_follow_stats(p_user UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM public.follows WHERE following_id = p_user),
    'today', (SELECT COUNT(*) FROM public.follows
              WHERE following_id = p_user
                AND created_at >= date_trunc('day', now() AT TIME ZONE 'Europe/Istanbul') AT TIME ZONE 'Europe/Istanbul')
  );
$$;
REVOKE ALL ON FUNCTION public.get_follow_stats(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_follow_stats(UUID) TO authenticated;

-- 3. Cihaz bildirim anahtarları
CREATE TABLE IF NOT EXISTS public.push_tokens (
  token      TEXT PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform   TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  language   TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_tokens_user_idx ON public.push_tokens (user_id);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS push_tokens_own ON public.push_tokens;
CREATE POLICY push_tokens_own ON public.push_tokens
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.push_tokens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO authenticated;

-- Aynı cihaz başka hesapla giriş yaparsa anahtar yeni hesaba geçer (eski hesaba bildirim gitmez)
CREATE OR REPLACE FUNCTION public.register_push_token(p_token TEXT, p_platform TEXT, p_language TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz');
  END IF;
  IF p_token IS NULL OR length(p_token) < 20 OR length(p_token) > 4096 OR p_platform NOT IN ('ios', 'android', 'web') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gecersiz');
  END IF;
  INSERT INTO public.push_tokens (token, user_id, platform, language, updated_at)
  VALUES (p_token, auth.uid(), p_platform, left(p_language, 5), now())
  ON CONFLICT (token) DO UPDATE
    SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform,
        language = EXCLUDED.language, updated_at = now();
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.register_push_token(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_token(TEXT, TEXT, TEXT) TO authenticated;

-- 4. Bildirim sıklığı kaydı (yalnızca sunucu fonksiyonu yazar)
CREATE TABLE IF NOT EXISTS public.live_notify_log (
  streamer_id  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_sent_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.live_notify_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.live_notify_log FROM anon, authenticated;

COMMIT;

-- KONTROL
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('follows', 'push_tokens', 'live_notify_log')
ORDER BY 1;
