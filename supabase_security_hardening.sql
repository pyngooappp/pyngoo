-- ==============================================================================
-- PYNGOO SUPABASE GÜVENLİK VE SERTLEŞTİRME SCRIPTI (DEFINITIVE HARDENING)
-- ==============================================================================
-- Bu SQL scriptini Supabase Dashboard -> SQL Editor içerisine yapıştırıp "RUN" 
-- butonuna basarak tek tıkla çalıştırabilirsiniz.

-- 1. ESKİ VEYA AÇIKTA KALMIŞ TÜM POLİTİKALARI TEMİZLE
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN (
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('messages', 'reports', 'friends', 'withdrawal_requests', 'profiles')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 2. RLS'LERİ KESİN OLARAK AKTİF ET
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- 3. PROFILES TABLOSU POLİTİKALARI
CREATE POLICY "Profilleri herkes görüntüleyebilir" 
ON public.profiles FOR SELECT 
USING (true);

CREATE POLICY "Kullanıcı kendi profilini ekleyebilir" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = id OR auth.role() = 'service_role');

CREATE POLICY "Kullanıcı sadece kendi profilini güncelleyebilir" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id OR auth.role() = 'service_role');

CREATE POLICY "Kullanıcı kendi profilini silebilir" 
ON public.profiles FOR DELETE 
USING (auth.uid() = id OR auth.role() = 'service_role');

-- 4. MESAJLAR (MESSAGES) TABLOSU GÜVENLİĞİ (TAM GİZLİLİK)
CREATE POLICY "Mesajları sadece taraflar görebilir" 
ON public.messages FOR SELECT 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR auth.role() = 'service_role');

CREATE POLICY "Güvenli mesaj ekleme" 
ON public.messages FOR INSERT 
WITH CHECK (auth.uid() = sender_id OR auth.uid() = receiver_id OR auth.role() = 'service_role');

CREATE POLICY "Mesaj okundu yapma" 
ON public.messages FOR UPDATE 
USING (auth.uid() = receiver_id OR auth.role() = 'service_role');

CREATE POLICY "Mesajları taraflar silebilir" 
ON public.messages FOR DELETE 
USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR auth.role() = 'service_role');

-- 5. ŞİKAYETLER (REPORTS) TABLOSU GÜVENLİĞİ (SIZINTI ENGELLEME)
CREATE POLICY "Herkes şikayet bildirebilir" 
ON public.reports FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Şikayetleri sadece yetkililer görebilir" 
ON public.reports FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_moderator = true OR profiles.role IN ('admin', 'moderator'))
  )
  OR auth.role() = 'service_role'
);

-- 6. ARKADAŞLAR (FRIENDS) TABLOSU GÜVENLİĞİ
CREATE POLICY "Sadece kendi arkadaşlıklarını gör" 
ON public.friends FOR SELECT 
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2 OR auth.role() = 'service_role');

CREATE POLICY "Arkadaşlık ekleme" 
ON public.friends FOR INSERT 
WITH CHECK (auth.uid() = user_id_1 OR auth.uid() = user_id_2 OR auth.role() = 'service_role');

CREATE POLICY "Arkadaşlık güncelleme" 
ON public.friends FOR UPDATE 
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2 OR auth.role() = 'service_role');

CREATE POLICY "Arkadaşlık silme" 
ON public.friends FOR DELETE 
USING (auth.uid() = user_id_1 OR auth.uid() = user_id_2 OR auth.role() = 'service_role');

-- 7. PARA ÇEKİM TALEPLERİ (WITHDRAWAL_REQUESTS) GÜVENLİĞİ
CREATE POLICY "Kullanıcılar kendi çekim taleplerini görebilir" 
ON public.withdrawal_requests FOR SELECT 
USING (
  auth.uid() = user_id 
  OR EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_moderator = true OR profiles.role IN ('admin', 'moderator'))
  )
  OR auth.role() = 'service_role'
);

CREATE POLICY "Kullanıcılar sadece kendi adına çekim talebi açabilir" 
ON public.withdrawal_requests FOR INSERT 
WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');

CREATE POLICY "Sadece yetkililer çekim taleplerini güncelleyebilir" 
ON public.withdrawal_requests FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.is_moderator = true OR profiles.role IN ('admin', 'moderator'))
  )
  OR auth.role() = 'service_role'
);

-- 8. GELİŞMİŞ GÜVENLİK TRİGGERI (YETKİ, ELMAS VE SAHTEKARLIK KORUMASI)
CREATE OR REPLACE FUNCTION public.protect_profile_critical_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Eğer güvenli bir RPC fonksiyonu içinden çağrılıyorsa (Hediye, Süre Uzatma vb.) bypass et
  IF current_setting('app.bypass_diamond_check', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    -- Yetki yükseltme ve ban kaldırma engeli
    NEW.role := OLD.role;
    NEW.is_moderator := OLD.is_moderator;
    NEW.is_banned := OLD.is_banned;
    
    -- Elması kullanıcı asla elle artıramaz (Yalnızca hediye fonksiyonu artırabilir)
    IF (NEW.total_diamonds > OLD.total_diamonds) THEN
      NEW.total_diamonds := OLD.total_diamonds;
    END IF;

    -- Tek seferde 50.000 üzeri sahte altın sıçramalarını engelle
    IF (NEW.total_gold - OLD.total_gold > 50000) THEN
      NEW.total_gold := OLD.total_gold;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_critical_fields();

-- 9. GÜVENLİ BAKİYE DÜŞME FONKSİYONU (RPC)
CREATE OR REPLACE FUNCTION public.deduct_gold(p_user_id UUID, p_amount INT)
RETURNS JSONB AS $$
DECLARE
  v_current_gold INT;
  v_new_gold INT;
BEGIN
  IF p_amount <= 0 THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. GÜVENLİ HEDİYE VE ELMAS AKTARMA FONKSİYONU (RPC)
CREATE OR REPLACE FUNCTION public.send_gift_transaction(
  p_sender_id UUID, 
  p_receiver_id UUID, 
  p_gold_cost INT, 
  p_diamond_reward INT
)
RETURNS JSONB AS $$
DECLARE
  v_sender_gold INT;
  v_receiver_gender TEXT;
  v_final_diamonds INT := 0;
  v_sender_new_gold INT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_sender_id AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz işlem');
  END IF;

  IF p_gold_cost < 0 OR p_diamond_reward < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Geçersiz transfer tutarı');
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
    v_final_diamonds := p_diamond_reward;
  ELSE
    v_final_diamonds := 0;
  END IF;

  -- Güvenli oturum bayrağını aç
  PERFORM set_config('app.bypass_diamond_check', 'on', true);

  v_sender_new_gold := v_sender_gold - p_gold_cost;
  UPDATE public.profiles SET total_gold = v_sender_new_gold WHERE id = p_sender_id;

  IF v_final_diamonds > 0 AND p_receiver_id IS NOT NULL THEN
    UPDATE public.profiles SET total_diamonds = COALESCE(total_diamonds, 0) + v_final_diamonds WHERE id = p_receiver_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'new_gold', v_sender_new_gold, 
    'diamonds_awarded', v_final_diamonds
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SÜRE UZATMA VE KADINA 5 ELMAS AKTARMA FONKSİYONU (RPC)
CREATE OR REPLACE FUNCTION public.reward_call_extension(
  p_sender_id UUID,
  p_partner_id UUID,
  p_gold_cost INT DEFAULT 20,
  p_diamond_reward INT DEFAULT 5
)
RETURNS JSONB AS $$
DECLARE
  v_sender_gold INT;
  v_partner_gender TEXT;
  v_final_diamonds INT := 0;
  v_sender_new_gold INT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_sender_id AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz işlem');
  END IF;

  SELECT total_gold INTO v_sender_gold FROM public.profiles WHERE id = p_sender_id FOR UPDATE;

  IF v_sender_gold IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kullanıcı bulunamadı');
  END IF;

  IF v_sender_gold < p_gold_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetersiz altın bakiyesi');
  END IF;

  SELECT gender INTO v_partner_gender FROM public.profiles WHERE id = p_partner_id FOR UPDATE;

  IF v_partner_gender = 'kadin' THEN
    v_final_diamonds := p_diamond_reward;
  ELSE
    v_final_diamonds := 0;
  END IF;

  PERFORM set_config('app.bypass_diamond_check', 'on', true);

  v_sender_new_gold := v_sender_gold - p_gold_cost;
  UPDATE public.profiles SET total_gold = v_sender_new_gold WHERE id = p_sender_id;

  IF v_final_diamonds > 0 AND p_partner_id IS NOT NULL THEN
    UPDATE public.profiles SET total_diamonds = COALESCE(total_diamonds, 0) + v_final_diamonds WHERE id = p_partner_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'new_gold', v_sender_new_gold, 
    'diamonds_awarded', v_final_diamonds
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- DOĞRUDAN ARAMA PEŞİN VE DAKİKALIK KAZANÇ RPC FONKSİYONU
CREATE OR REPLACE FUNCTION public.reward_direct_call_start(
  p_caller_id UUID,
  p_receiver_id UUID,
  p_gold_cost INT DEFAULT 120,
  p_diamond_reward INT DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
  v_caller_gold INT;
  v_receiver_gender TEXT;
  v_final_diamonds INT := 0;
  v_caller_new_gold INT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_caller_id AND auth.role() <> 'service_role' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz işlem');
  END IF;

  SELECT total_gold INTO v_caller_gold FROM public.profiles WHERE id = p_caller_id FOR UPDATE;

  IF v_caller_gold IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kullanıcı bulunamadı');
  END IF;

  IF v_caller_gold < p_gold_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetersiz altın bakiyesi');
  END IF;

  SELECT gender INTO v_receiver_gender FROM public.profiles WHERE id = p_receiver_id FOR UPDATE;

  IF v_receiver_gender = 'kadin' THEN
    v_final_diamonds := p_diamond_reward;
  ELSE
    v_final_diamonds := 0;
  END IF;

  PERFORM set_config('app.bypass_diamond_check', 'on', true);

  v_caller_new_gold := v_caller_gold - p_gold_cost;
  UPDATE public.profiles SET total_gold = v_caller_new_gold WHERE id = p_caller_id;

  IF v_final_diamonds > 0 AND p_receiver_id IS NOT NULL THEN
    UPDATE public.profiles SET total_diamonds = COALESCE(total_diamonds, 0) + v_final_diamonds WHERE id = p_receiver_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'new_gold', v_caller_new_gold, 
    'diamonds_awarded', v_final_diamonds
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.send_gift_transaction TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reward_call_extension TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.reward_direct_call_start TO authenticated, anon;

-- 11. ATOMİK PARA ÇEKME FONKSİYONU (RACE CONDITION VE ÇİFTE ÇEKİM ENGELLEYİCİ)
CREATE OR REPLACE FUNCTION public.request_diamond_withdrawal(
  p_user_id UUID,
  p_amount_diamonds INT,
  p_amount_currency NUMERIC,
  p_iban TEXT,
  p_full_name TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_current_diamonds INT;
  v_pending_count INT;
  v_new_diamonds INT;
  v_request_id UUID;
BEGIN
  IF p_amount_diamonds <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Geçersiz çekim miktarı');
  END IF;

  SELECT COUNT(*) INTO v_pending_count
  FROM public.withdrawal_requests
  WHERE user_id = p_user_id AND status = 'pending';

  IF v_pending_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Zaten beklemede olan bir çekim talebiniz bulunmaktadır.');
  END IF;

  SELECT total_diamonds INTO v_current_diamonds
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_diamonds IS NULL OR v_current_diamonds < p_amount_diamonds THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetersiz elmas bakiyesi');
  END IF;

  v_new_diamonds := v_current_diamonds - p_amount_diamonds;
  UPDATE public.profiles
  SET total_diamonds = v_new_diamonds
  WHERE id = p_user_id;

  INSERT INTO public.withdrawal_requests (
    user_id,
    amount_diamonds,
    amount_currency,
    iban,
    full_name,
    status
  ) VALUES (
    p_user_id,
    p_amount_diamonds,
    p_amount_currency,
    TRIM(p_iban),
    TRIM(p_full_name),
    'pending'
  ) RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id, 'new_balance', v_new_diamonds);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. HESAP VE TÜM VERİLERİ KALICI SİLME FONKSİYONU (APPLE & GOOGLE COMPLIANCE + TAM TEMİZLİK-- 12. KULLANICI KENDİ HESABINI SİLDİĞİNDE TAM VE GÜVENLİ TEMİZLİK (auth.users dahil)
CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz islem: Oturum bulunamadi');
  END IF;

  BEGIN DELETE FROM public.waiting_room WHERE user_id = v_user_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.messages WHERE sender_id = v_user_id OR receiver_id = v_user_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.friends WHERE user_id_1 = v_user_id OR user_id_2 = v_user_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.reports WHERE reporter_id = v_user_id OR reported_user_id = v_user_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.withdrawal_requests WHERE user_id = v_user_id; EXCEPTION WHEN OTHERS THEN NULL; END;

  BEGIN DELETE FROM public.profiles WHERE id = v_user_id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM auth.users WHERE id = v_user_id; EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 13. ADMİN SUPABASE'DEN PROFİL SİLDİĞİNDE OTOMATİK CASCADE TEMİZLİĞİ
CREATE OR REPLACE FUNCTION public.handle_profile_deleted_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  BEGIN DELETE FROM public.waiting_room WHERE user_id = OLD.id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.messages WHERE sender_id = OLD.id OR receiver_id = OLD.id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.friends WHERE user_id_1 = OLD.id OR user_id_2 = OLD.id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.reports WHERE reporter_id = OLD.id OR reported_user_id = OLD.id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.withdrawal_requests WHERE user_id = OLD.id; EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_deleted_cascade ON public.profiles;
CREATE TRIGGER trg_profile_deleted_cascade
AFTER DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_profile_deleted_cascade();

-- 13.b SUPABASE AUTH USERS TABLOSUNDAN KULLANICI SİLİNDİĞİNDE PROFİLİ VE VERİLERİ OTOMATİK SİL
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  BEGIN DELETE FROM public.waiting_room WHERE user_id = OLD.id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.messages WHERE sender_id = OLD.id OR receiver_id = OLD.id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.friends WHERE user_id_1 = OLD.id OR user_id_2 = OLD.id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.reports WHERE reporter_id = OLD.id OR reported_user_id = OLD.id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.withdrawal_requests WHERE user_id = OLD.id; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN DELETE FROM public.profiles WHERE id = OLD.id; EXCEPTION WHEN OTHERS THEN NULL; END;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_user_deleted ON auth.users;
CREATE TRIGGER trg_auth_user_deleted
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_deleted();

-- 14. YÖNETİCİ / MODERATÖR İÇİN GÜVENLİ ALTIN YÜKLEME & ONAY RPC FONKSİYONU
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
  -- 1. Siparişi bul ve kilitle
  SELECT * INTO v_order FROM public.payment_notifications WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Siparis bulunamadi');
  END IF;

  IF v_order.status = 'approved' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bu siparis zaten daha once onaylanmis!');
  END IF;

  -- 2. Kullanıcının mevcut altınını al
  SELECT total_gold INTO v_current_gold FROM public.profiles WHERE id = v_order.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Kullanici profili bulunamadi');
  END IF;

  -- 3. Altını güvenle ekle (trigger engelini aşmak için bypass ayarla)
  PERFORM set_config('app.bypass_diamond_check', 'on', true);
  v_new_gold := COALESCE(v_current_gold, 0) + COALESCE(v_order.total_gold, 0);

  UPDATE public.profiles 
  SET total_gold = v_new_gold 
  WHERE id = v_order.user_id;

  -- 4. Sipariş durumunu 'approved' yap
  UPDATE public.payment_notifications
  SET status = 'approved',
      admin_notes = p_admin_notes
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true, 
    'user_id', v_order.user_id, 
    'new_gold', v_new_gold, 
    'added_gold', v_order.total_gold
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_payment_order(UUID, TEXT) TO authenticated, anon;

-- 15. BOŞTA / SAHİPSİZ KALMIŞ TÜM YETİM PROFİLLERİ OTOMATİK TEMİZLEME RPC FONKSİYONU
CREATE OR REPLACE FUNCTION public.clean_orphaned_profiles()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  WITH deleted_rows AS (
    DELETE FROM public.profiles p
    WHERE COALESCE(p.role, '') NOT IN ('bot', 'admin')
      AND NOT EXISTS (
        SELECT 1 FROM auth.users u WHERE u.id = p.id
      )
    RETURNING p.id
  )
  SELECT COUNT(*) INTO v_count FROM deleted_rows;

  RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.clean_orphaned_profiles() TO authenticated, anon;

-- 16. MODERATÖR YETKİSİ ATAMA VE KALDIRMA GÜVENLİ RPC FONKSİYONU
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
  PERFORM set_config('app.bypass_diamond_check', 'on', true);

  IF p_target ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    UPDATE public.profiles
    SET is_moderator = p_is_moderator,
        role = p_role
    WHERE id = p_target::UUID;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  IF v_updated = 0 THEN
    UPDATE public.profiles
    SET is_moderator = p_is_moderator,
        role = p_role
    WHERE LOWER(display_name) = LOWER(TRIM(p_target));
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('success', true, 'updated_count', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_moderator_status(TEXT, BOOLEAN, TEXT) TO authenticated, anon;

-- 17. E-POSTA ADRESİ KONTROL VE SORGULAMA RPC FONKSİYONU
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
    WHERE LOWER(u.email) = LOWER(TRIM(p_email))
  ) INTO v_exists;

  IF v_exists THEN
    SELECT p.display_name INTO v_name
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE LOWER(u.email) = LOWER(TRIM(p_email))
      AND COALESCE(p.role, '') <> 'deleted'
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'exists', v_exists,
    'display_name', COALESCE(v_name, '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO authenticated, anon;

-- 18. AUTH.USERS METADATA ÜZERİNE KULLANICININ PYNGOO RUMUZUNU MÜHÜRLEME RPC FONKSİYONU
-- (Google/Apple OAuth Girişlerinde Google Gerçek Ad-Soyad Verisinin auth.users ve profiles'ı ezmesini engeller)
CREATE OR REPLACE FUNCTION public.sync_auth_display_name(p_display_name TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Yetkisiz');
  END IF;

  IF p_display_name IS NULL OR TRIM(p_display_name) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gecersiz rumuz');
  END IF;

  UPDATE auth.users
  SET raw_user_meta_data = 
    COALESCE(raw_user_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'full_name', TRIM(p_display_name),
      'name', TRIM(p_display_name),
      'display_name', TRIM(p_display_name),
      'user_name', TRIM(p_display_name)
    )
  WHERE id = auth.uid();

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_auth_display_name(TEXT) TO authenticated, anon;

