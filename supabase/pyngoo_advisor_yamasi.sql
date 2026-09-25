-- =====================================================================
-- Pyngoo - Supabase Advisor (Security + Performance) uyarı yaması
-- Tarih: 2026-09-25
--
-- BÖLÜM A ve B güvenle çalıştırılabilir (uygulama davranışını değiştirmez).
-- BÖLÜM C (waiting_room) eşleşme akışına dokunur; ayrı çalıştırılır ve
--          çalıştırdıktan sonra uygulamada eşleşme MUTLAKA denenmelidir.
-- Hepsi tekrar çalıştırılabilir (idempotent) şekilde yazıldı.
-- =====================================================================


-- =====================================================================
-- BÖLÜM A - GÜVENLİK
-- =====================================================================

-- A1) auto_confirm_new_users: search_path sabitlenmemişti (Function Search Path Mutable).
--     Gövdesi yalnızca now() kullanıyor; boş search_path ile aynen çalışır.
ALTER FUNCTION public.auto_confirm_new_users() SET search_path = '';

-- A2) Tetikleyici (trigger) fonksiyonlar /rest/v1/rpc/... üzerinden anon ve giriş yapmış
--     kullanıcılara açıktı. Tetikleyiciler EXECUTE yetkisini yalnızca CREATE TRIGGER anında
--     ister, çalışırken istemez; bu yüzden kapatmak tetikleyicileri BOZMAZ.
--     (is_admin / is_staff / is_caller_staff BİLEREK dokunulmadı: RLS politikaları bunları
--      çağıran kullanıcının yetkisiyle çalıştırır, kapatılırsa politikalar bozulur.)
REVOKE EXECUTE ON FUNCTION public.auto_confirm_new_users()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_auth_user_deleted()          FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_profile_deleted_cascade()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_critical_fields()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_insert()            FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_display_name_to_auth() FROM PUBLIC, anon, authenticated;


-- =====================================================================
-- BÖLÜM B - PERFORMANS
-- =====================================================================

-- B1) Yabancı anahtarlar için eksik indeksler (6 adet)
CREATE INDEX IF NOT EXISTS friends_user_id_2_idx              ON public.friends (user_id_2);
CREATE INDEX IF NOT EXISTS match_history_caller_id_idx        ON public.match_history (caller_id);
CREATE INDEX IF NOT EXISTS match_history_receiver_id_idx      ON public.match_history (receiver_id);
CREATE INDEX IF NOT EXISTS transactions_user_id_idx           ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS user_likes_target_id_idx           ON public.user_likes (target_id);
CREATE INDEX IF NOT EXISTS withdrawal_requests_user_id_idx    ON public.withdrawal_requests (user_id);

-- B2) profiles üzerindeki ESKİ, yinelenen politikalar. Yeni profiles_*_own politikalarıyla
--     giriş yapmış kullanıcı için birebir aynı işi yapıyorlar (service_role zaten RLS'i atlar).
DROP POLICY IF EXISTS "Kullanıcı kendi profilini silebilir"            ON public.profiles;
DROP POLICY IF EXISTS "Kullanıcı kendi profilini ekleyebilir"          ON public.profiles;
DROP POLICY IF EXISTS "Kullanıcı sadece kendi profilini güncelleyebilir" ON public.profiles;

-- B3) RLS politikalarında auth.uid() / auth.role() her satır için yeniden hesaplanıyordu.
--     (select auth.uid()) ile sorgu başına bir kez hesaplanır. Mantık DEĞİŞMEZ.
ALTER POLICY follows_delete_own ON public.follows
  USING ((follower_id = (select auth.uid())));
ALTER POLICY follows_insert_own ON public.follows
  WITH CHECK ((follower_id = (select auth.uid())));
ALTER POLICY follows_select_own ON public.follows
  USING (((follower_id = (select auth.uid())) OR (following_id = (select auth.uid()))));

ALTER POLICY "Arkadaşlık ekleme" ON public.friends
  WITH CHECK ((((select auth.uid()) = user_id_1) OR ((select auth.uid()) = user_id_2) OR ((select auth.role()) = 'service_role'::text)));
ALTER POLICY "Arkadaşlık güncelleme" ON public.friends
  USING ((((select auth.uid()) = user_id_1) OR ((select auth.uid()) = user_id_2) OR ((select auth.role()) = 'service_role'::text)));
ALTER POLICY "Arkadaşlık silme" ON public.friends
  USING ((((select auth.uid()) = user_id_1) OR ((select auth.uid()) = user_id_2) OR ((select auth.role()) = 'service_role'::text)));
ALTER POLICY "Sadece kendi arkadaşlıklarını gör" ON public.friends
  USING ((((select auth.uid()) = user_id_1) OR ((select auth.uid()) = user_id_2) OR ((select auth.role()) = 'service_role'::text)));

ALTER POLICY mh_insert_caller ON public.match_history
  WITH CHECK (((caller_id = (select auth.uid())) AND (receiver_id IS NOT NULL) AND (receiver_id <> (select auth.uid()))));
ALTER POLICY mh_select_participants ON public.match_history
  USING (((caller_id = (select auth.uid())) OR (receiver_id = (select auth.uid())) OR is_staff()));
ALTER POLICY mh_update_participants ON public.match_history
  USING (((caller_id = (select auth.uid())) OR (receiver_id = (select auth.uid()))))
  WITH CHECK (((caller_id = (select auth.uid())) OR (receiver_id = (select auth.uid()))));

ALTER POLICY "Güvenli mesaj ekleme" ON public.messages
  WITH CHECK ((((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id) OR ((select auth.role()) = 'service_role'::text)));
ALTER POLICY "Mesaj okundu yapma" ON public.messages
  USING ((((select auth.uid()) = receiver_id) OR ((select auth.role()) = 'service_role'::text)));
ALTER POLICY "Mesajları sadece taraflar görebilir" ON public.messages
  USING ((((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id) OR ((select auth.role()) = 'service_role'::text)));
ALTER POLICY "Mesajları taraflar silebilir" ON public.messages
  USING ((((select auth.uid()) = sender_id) OR ((select auth.uid()) = receiver_id) OR ((select auth.role()) = 'service_role'::text)));

ALTER POLICY pn_insert_own_pending ON public.payment_notifications
  WITH CHECK (((user_id = (select auth.uid())) AND (status = 'pending'::text)));
ALTER POLICY pn_select_own_or_admin ON public.payment_notifications
  USING (((user_id = (select auth.uid())) OR is_admin()));

ALTER POLICY profiles_delete_own ON public.profiles
  USING ((id = (select auth.uid())));
ALTER POLICY profiles_insert_own ON public.profiles
  WITH CHECK ((id = (select auth.uid())));
ALTER POLICY profiles_update_own ON public.profiles
  USING ((id = (select auth.uid())))
  WITH CHECK ((id = (select auth.uid())));

ALTER POLICY push_tokens_own ON public.push_tokens
  USING ((user_id = (select auth.uid())))
  WITH CHECK ((user_id = (select auth.uid())));

ALTER POLICY reports_insert_own ON public.reports
  WITH CHECK ((reporter_id = (select auth.uid())));
ALTER POLICY "Şikayetleri sadece yetkililer görebilir" ON public.reports
  USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND ((profiles.is_moderator = true) OR (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))) OR ((select auth.role()) = 'service_role'::text)));

ALTER POLICY user_likes_select_own ON public.user_likes
  USING (((liker_id = (select auth.uid())) OR (target_id = (select auth.uid()))));

ALTER POLICY "Kullanıcılar kendi çekim taleplerini görebilir" ON public.withdrawal_requests
  USING ((((select auth.uid()) = user_id) OR (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = (select auth.uid())) AND ((profiles.is_moderator = true) OR (profiles.role = ANY (ARRAY['admin'::text, 'moderator'::text])))))) OR ((select auth.role()) = 'service_role'::text)));
ALTER POLICY "Kullanıcılar sadece kendi adına çekim talebi açabilir" ON public.withdrawal_requests
  WITH CHECK ((((select auth.uid()) = user_id) OR ((select auth.role()) = 'service_role'::text)));

-- waiting_room'daki "Kullanıcı sadece kendini ekleyebilir" politikası BÖLÜM C'de yeniden kurulur.


-- =====================================================================
-- BÖLÜM C - waiting_room KİLİTLEME (AYRI ÇALIŞTIRIN, SONRA EŞLEŞMEYİ TEST EDİN)
--
-- Sorun: "Allow all operations on waiting_room" (ALL, public, true/true) sayesinde giriş
-- yapmamış biri bile (herkese açık anon anahtarıyla) bekleme odasındaki tüm satırları
-- okuyabilir, ekleyebilir, değiştirebilir ve silebilir; diğer sıkı politikalar anlamsız kalıyor.
--
-- Bu bölüm: anon erişimini kapatır, ekleme/güncellemeyi yalnızca kendi satırıyla sınırlar.
-- SİLME bilerek "giriş yapmış herkes" bırakıldı: eşleşme mantığı (Home.tsx) karşı tarafın
-- bekleme satırını siliyor. Bunu da kısıtlamak için eşleşmeyi bir RPC'ye taşımak gerekir
-- (ileride ayrıca yapılır).
-- =====================================================================
/*
DROP POLICY IF EXISTS "Allow all operations on waiting_room"   ON public.waiting_room;
DROP POLICY IF EXISTS "Eşleşmede silme"                        ON public.waiting_room;
DROP POLICY IF EXISTS "Bekleme odasını herkes görebilir"       ON public.waiting_room;
DROP POLICY IF EXISTS "Kullanıcı sadece kendini ekleyebilir"   ON public.waiting_room;

CREATE POLICY wroom_select_auth ON public.waiting_room FOR SELECT TO authenticated
  USING (true);
CREATE POLICY wroom_insert_own ON public.waiting_room FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY wroom_update_own ON public.waiting_room FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY wroom_delete_auth ON public.waiting_room FOR DELETE TO authenticated
  USING (true);
-- (wroom_admin_delete zaten var; kalabilir.)
*/
