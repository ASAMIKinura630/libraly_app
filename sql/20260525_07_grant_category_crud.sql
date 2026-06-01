-- =====================================================
-- 20260525_07_grant_category_crud.sql
-- 図書カテゴリマスタ画面（categories.html）用 CRUD 権限
-- 前提: libraly_app_category が存在すること
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app_category TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app_category TO authenticated;
