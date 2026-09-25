-- =====================================================================
-- Pyngoo - profiles.last_active_at sütunu
-- Tarih: 2026-09-25
--
-- Sorun: Uygulama yayıncı kalp atışında (App.tsx, her 25 sn) ve oturum kapanışında
-- profiles.last_active_at sütununa yazıyor; Keşfet de "son 90 sn aktif mi" kontrolünde
-- bu sütunu okuyor. Ama tabloda bu sütun HİÇ yoktu. Sonuç: her yayıncının kalp atışı
-- PostgREST'ten 400 hatası alıyordu (25 sn'de bir, yayıncı başına) ve is_streamer_online
-- de bu istekle birlikte kaydedilemiyordu.
--
-- Bu yama sütunu ekler. Tekrar çalıştırılabilir (idempotent).
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;
