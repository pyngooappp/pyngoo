-- ==============================================================================
-- PYNGOO ADMIN PANEL & DUYURU KULLANICI LİSTESİ DÜZELTME
-- ==============================================================================
-- 1. ESKİ FONKSİYONU SİL (Tip uyuşmazlığı hatasını çözer)
DROP FUNCTION IF EXISTS public.get_broadcast_target_users(TEXT);

-- 2. PROFILES RLS OKUMA POLİTİKASINI HERKESE AÇ
DROP POLICY IF EXISTS "Profilleri herkes görüntüleyebilir" ON public.profiles;
CREATE POLICY "Profilleri herkes görüntüleyebilir" 
ON public.profiles FOR SELECT 
TO public
USING (true);

-- 3. HEDEF KULLANICI LİSTELEME VE ARAMA FONKSİYONU
CREATE OR REPLACE FUNCTION public.get_broadcast_target_users(p_search TEXT DEFAULT '')
RETURNS TABLE (
  id UUID,
  display_name TEXT,
  gender TEXT,
  role TEXT,
  avatar TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id, 
    p.display_name, 
    p.gender, 
    p.role, 
    p.avatar,
    p.created_at
  FROM public.profiles p
  WHERE COALESCE(p.role, '') <> 'deleted'
    AND (
      p_search IS NULL 
      OR TRIM(p_search) = '' 
      OR p.display_name ILIKE '%' || TRIM(p_search) || '%' 
      OR p.id::TEXT = TRIM(p_search)
    )
  ORDER BY p.created_at DESC
  LIMIT 250;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_broadcast_target_users(TEXT) TO anon, authenticated;
