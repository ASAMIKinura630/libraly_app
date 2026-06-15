-- =====================================================
-- 20260616_student_self_service.sql
-- 学生セルフ貸出（認証紐づけ・履歴フラグ）
-- RLS: OFF（既存テーブルと同様）
-- =====================================================

ALTER TABLE public.libraly_app_student
  ADD COLUMN IF NOT EXISTS auth_user_id uuid NULL;

COMMENT ON COLUMN public.libraly_app_student.auth_user_id IS 'Supabase Auth ユーザー ID（学生セルフ貸出ログイン）';

CREATE UNIQUE INDEX IF NOT EXISTS libraly_app_student_auth_user_id_idx
  ON public.libraly_app_student (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

ALTER TABLE public.libraly_app_lending_history
  ADD COLUMN IF NOT EXISTS is_self_service boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.libraly_app_lending_history.is_self_service IS '学生セルフ貸出（lent_by_staff_id は NULL）';

CREATE INDEX IF NOT EXISTS libraly_app_lending_history_is_self_service_idx
  ON public.libraly_app_lending_history (is_self_service);

NOTIFY pgrst, 'reload schema';
