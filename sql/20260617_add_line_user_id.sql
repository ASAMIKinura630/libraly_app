-- =====================================================
-- 20260617_add_line_user_id.sql
-- 学生セルフ貸出 — 公式 LINE 連携（LINE User ID 紐づけ）
-- RLS: OFF（既存テーブルと同様）
-- =====================================================

ALTER TABLE public.libraly_app_student
  ADD COLUMN IF NOT EXISTS line_user_id text NULL;

COMMENT ON COLUMN public.libraly_app_student.line_user_id IS 'LINE Login / LIFF の User ID（チャネルごとに一意）';

CREATE UNIQUE INDEX IF NOT EXISTS libraly_app_student_line_user_id_idx
  ON public.libraly_app_student (line_user_id)
  WHERE line_user_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
