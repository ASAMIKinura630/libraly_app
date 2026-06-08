-- =====================================================
-- 20260601_add_lending_return_dates.sql
-- 貸し出し履歴に返却予定日・返却日を追加
-- 前提: 20260525_06_add_lending_history.sql 実行済み
-- =====================================================

ALTER TABLE public.libraly_app_lending_history
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz;

COMMENT ON COLUMN public.libraly_app_lending_history.due_date IS '返却予定日';
COMMENT ON COLUMN public.libraly_app_lending_history.returned_at IS '返却日時（返却済みのとき設定）';

-- 既存データの補完
UPDATE public.libraly_app_lending_history
SET due_date = (created_at AT TIME ZONE 'Asia/Tokyo')::date + 14
WHERE due_date IS NULL;

UPDATE public.libraly_app_lending_history
SET returned_at = created_at
WHERE is_returned = true AND returned_at IS NULL;

ALTER TABLE public.libraly_app_lending_history
  ALTER COLUMN due_date SET NOT NULL;

CREATE INDEX IF NOT EXISTS libraly_app_lending_history_due_date_idx
  ON public.libraly_app_lending_history (due_date);
