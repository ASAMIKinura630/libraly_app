-- =====================================================
-- 20260615_add_sub_lend_fields.sql
-- また貸し（実保持者）記録用カラム
-- RLS: OFF（既存テーブルと同様）
-- 前提: libraly_app_lending_history が存在すること
-- =====================================================

ALTER TABLE public.libraly_app_lending_history
  ADD COLUMN IF NOT EXISTS is_sub_lend boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS actual_holder_student_number text NULL
    REFERENCES public.libraly_app_student(student_number) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS sub_lend_note text NULL,
  ADD COLUMN IF NOT EXISTS sub_lend_recorded_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS sub_lend_recorded_by_staff_id uuid NULL
    REFERENCES public.libraly_app_staff(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.libraly_app_lending_history.is_sub_lend IS 'また貸し記録済み（公式借り手と実保持者が異なる）';
COMMENT ON COLUMN public.libraly_app_lending_history.actual_holder_student_number IS '実保持者の学籍番号（公式借り手 student_number は変更しない）';
COMMENT ON COLUMN public.libraly_app_lending_history.sub_lend_note IS 'また貸しメモ（任意）';
COMMENT ON COLUMN public.libraly_app_lending_history.sub_lend_recorded_at IS 'また貸し記録日時';
COMMENT ON COLUMN public.libraly_app_lending_history.sub_lend_recorded_by_staff_id IS 'また貸しを記録した担当者';

CREATE INDEX IF NOT EXISTS libraly_app_lending_history_is_sub_lend_idx
  ON public.libraly_app_lending_history (is_sub_lend);

CREATE INDEX IF NOT EXISTS libraly_app_lending_history_actual_holder_student_number_idx
  ON public.libraly_app_lending_history (actual_holder_student_number);

-- また貸し時は実保持者必須かつ公式借り手と異なること
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'libraly_app_lending_history_sub_lend_check'
  ) THEN
    ALTER TABLE public.libraly_app_lending_history
      ADD CONSTRAINT libraly_app_lending_history_sub_lend_check
      CHECK (
        (NOT is_sub_lend)
        OR (
          actual_holder_student_number IS NOT NULL
          AND actual_holder_student_number <> student_number
        )
      );
  END IF;
END $$;
