-- 図書テーブル（libraly_app）
CREATE TABLE public.libraly_app (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  content     text        NOT NULL,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.libraly_app IS '図書一覧';
COMMENT ON COLUMN public.libraly_app.id IS 'レコード識別子（自動採番）';
COMMENT ON COLUMN public.libraly_app.title IS 'タイトル';
COMMENT ON COLUMN public.libraly_app.content IS 'あらすじ';
COMMENT ON COLUMN public.libraly_app.name IS '著者';
COMMENT ON COLUMN public.libraly_app.created_at IS '作成日時';

CREATE INDEX libraly_app_created_at_idx
  ON public.libraly_app (created_at DESC);

ALTER TABLE public.libraly_app DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app TO authenticated;
