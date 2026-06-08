-- =====================================================
-- 20260602_add_staff_lending_processor.sql
-- 担当者マスタと貸出履歴の処理者（貸出・返却）
-- RLS: OFF
-- 前提: libraly_app_lending_history が存在すること
-- =====================================================

-- -----------------------------------------------------
-- 1. 担当者マスタ
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.libraly_app_staff (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_number    text        NOT NULL UNIQUE,
  name            text        NOT NULL,
  email           text        NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.libraly_app_staff IS '担当者マスタ（ログインメールと紐づけ）';
COMMENT ON COLUMN public.libraly_app_staff.staff_number IS '職員番号（重複不可）';
COMMENT ON COLUMN public.libraly_app_staff.name IS '氏名';
COMMENT ON COLUMN public.libraly_app_staff.email IS 'ログイン用メールアドレス（Supabase Auth と一致）';

CREATE INDEX IF NOT EXISTS libraly_app_staff_email_idx
  ON public.libraly_app_staff (email);

-- -----------------------------------------------------
-- 2. 貸出履歴に処理者を追加
-- -----------------------------------------------------
ALTER TABLE public.libraly_app_lending_history
  ADD COLUMN IF NOT EXISTS lent_by_staff_id uuid NULL
    REFERENCES public.libraly_app_staff(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS returned_by_staff_id uuid NULL
    REFERENCES public.libraly_app_staff(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.libraly_app_lending_history.lent_by_staff_id IS '貸出処理を行った担当者';
COMMENT ON COLUMN public.libraly_app_lending_history.returned_by_staff_id IS '返却処理を行った担当者';

CREATE INDEX IF NOT EXISTS libraly_app_lending_history_lent_by_staff_id_idx
  ON public.libraly_app_lending_history (lent_by_staff_id);

CREATE INDEX IF NOT EXISTS libraly_app_lending_history_returned_by_staff_id_idx
  ON public.libraly_app_lending_history (returned_by_staff_id);

-- -----------------------------------------------------
-- 3. 権限
-- -----------------------------------------------------
ALTER TABLE public.libraly_app_staff DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app_staff TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app_staff TO authenticated;
