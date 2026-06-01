-- =====================================================
-- 20260525_06_add_lending_history.sql
-- 図書貸し出し履歴（libraly_app_lending_history）
-- RLS: OFF
-- 前提: libraly_app / libraly_app_student が存在すること
-- 仕様: docs/02_DB仕様書.md
-- =====================================================

-- -----------------------------------------------------
-- 1. 貸し出し履歴テーブル
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.libraly_app_lending_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id         uuid        NOT NULL REFERENCES public.libraly_app(id) ON DELETE RESTRICT,
  student_number  text        NOT NULL REFERENCES public.libraly_app_student(student_number) ON DELETE RESTRICT,
  is_returned     boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.libraly_app_lending_history IS '図書貸し出し履歴';
COMMENT ON COLUMN public.libraly_app_lending_history.id IS '履歴レコード識別子（自動採番）';
COMMENT ON COLUMN public.libraly_app_lending_history.book_id IS '図書マスターのレコード識別子（libraly_app.id）';
COMMENT ON COLUMN public.libraly_app_lending_history.student_number IS '学生マスターの学籍番号';
COMMENT ON COLUMN public.libraly_app_lending_history.is_returned IS '返却フラグ（true=返却済み、false=貸出中）';
COMMENT ON COLUMN public.libraly_app_lending_history.created_at IS '貸出日時';

CREATE INDEX IF NOT EXISTS libraly_app_lending_history_book_id_idx
  ON public.libraly_app_lending_history (book_id);

CREATE INDEX IF NOT EXISTS libraly_app_lending_history_student_number_idx
  ON public.libraly_app_lending_history (student_number);

CREATE INDEX IF NOT EXISTS libraly_app_lending_history_is_returned_idx
  ON public.libraly_app_lending_history (is_returned);

CREATE INDEX IF NOT EXISTS libraly_app_lending_history_created_at_idx
  ON public.libraly_app_lending_history (created_at DESC);

ALTER TABLE public.libraly_app_lending_history DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app_lending_history TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app_lending_history TO authenticated;
