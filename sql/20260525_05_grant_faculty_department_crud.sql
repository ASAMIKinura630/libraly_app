-- =====================================================
-- 20260525_05_grant_faculty_department_crud.sql
-- 学部・学科マスタ画面からの CRUD 用権限付与
-- 前提: 20260525_04_add_faculty_department_master.sql 実行済み
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app_faculty TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app_faculty TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app_department TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app_department TO authenticated;
