-- =====================================================
-- 20260619_line_reminder_log.sql
-- LINE 返却リマインド — 送信履歴（同日・同種別の重複防止）
-- RLS: OFF（Edge Function が Service Role で操作）
-- =====================================================

CREATE TABLE IF NOT EXISTS public.libraly_app_line_reminder_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lending_history_id uuid NOT NULL REFERENCES public.libraly_app_lending_history (id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (
    reminder_type IN ('three_days_before', 'day_before', 'overdue')
  ),
  sent_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT libraly_app_line_reminder_log_unique
    UNIQUE (lending_history_id, reminder_type, sent_on)
);

COMMENT ON TABLE public.libraly_app_line_reminder_log IS
  'LINE 返却リマインド送信ログ（JST の sent_on 単位で重複防止）';

CREATE INDEX IF NOT EXISTS libraly_app_line_reminder_log_sent_on_idx
  ON public.libraly_app_line_reminder_log (sent_on DESC);

NOTIFY pgrst, 'reload schema';
