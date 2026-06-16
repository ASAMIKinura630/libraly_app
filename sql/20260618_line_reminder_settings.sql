-- =====================================================
-- 20260618_line_reminder_settings.sql
-- LINE 返却リマインド — 職員画面からの送信オン/オフ
-- RLS: OFF（既存テーブルと同様）
-- =====================================================

CREATE TABLE IF NOT EXISTS public.libraly_app_settings (
  id text PRIMARY KEY,
  line_reminder_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by_staff_id uuid NULL REFERENCES public.libraly_app_staff (id) ON DELETE SET NULL
);

COMMENT ON TABLE public.libraly_app_settings IS '図書館アプリ全体の運用設定（1行: id=default）';
COMMENT ON COLUMN public.libraly_app_settings.line_reminder_enabled IS
  'LINE 返却リマインド（Messaging API）の自動送信。テスト環境では false 推奨';

INSERT INTO public.libraly_app_settings (id, line_reminder_enabled)
VALUES ('default', false)
ON CONFLICT (id) DO NOTHING;

GRANT SELECT, UPDATE ON public.libraly_app_settings TO anon;
GRANT SELECT, UPDATE ON public.libraly_app_settings TO authenticated;

NOTIFY pgrst, 'reload schema';
