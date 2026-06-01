-- =====================================================
-- 20260525_01_add_category_master.sql
-- 図書カテゴリマスタの作成・図書テーブルへの category_id 追加
-- カテゴリ仮データ 5 件の投入
-- RLS: OFF
-- 仕様: docs/02_DB仕様書.md
-- =====================================================

-- -----------------------------------------------------
-- 1. 図書カテゴリマスタテーブル
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.libraly_app_category (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.libraly_app_category IS '図書カテゴリマスタ';
COMMENT ON COLUMN public.libraly_app_category.id IS 'カテゴリ識別子（自動採番）';
COMMENT ON COLUMN public.libraly_app_category.name IS 'カテゴリ名';
COMMENT ON COLUMN public.libraly_app_category.created_at IS '登録日時';

ALTER TABLE public.libraly_app_category DISABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.libraly_app_category TO anon;
GRANT SELECT ON public.libraly_app_category TO authenticated;

-- -----------------------------------------------------
-- 2. 図書テーブル（未作成の場合のみ・category_id 込み）
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.libraly_app (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text        NOT NULL,
  content      text        NOT NULL,
  name         text        NOT NULL,
  category_id  uuid        NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------
-- 3. 既存の libraly_app に category_id を追加
-- -----------------------------------------------------
ALTER TABLE public.libraly_app
  ADD COLUMN IF NOT EXISTS category_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'libraly_app_category_id_fkey'
      AND conrelid = 'public.libraly_app'::regclass
  ) THEN
    ALTER TABLE public.libraly_app
      ADD CONSTRAINT libraly_app_category_id_fkey
      FOREIGN KEY (category_id)
      REFERENCES public.libraly_app_category (id)
      ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.libraly_app.category_id IS '図書カテゴリ（任意・NULL可）';

CREATE INDEX IF NOT EXISTS libraly_app_created_at_idx
  ON public.libraly_app (created_at DESC);

CREATE INDEX IF NOT EXISTS libraly_app_category_id_idx
  ON public.libraly_app (category_id);

ALTER TABLE public.libraly_app DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app TO authenticated;

-- -----------------------------------------------------
-- 4. カテゴリ仮データ（5件）
-- -----------------------------------------------------
INSERT INTO public.libraly_app_category (name)
VALUES
  ('小説'),
  ('ビジネス'),
  ('技術書'),
  ('歴史・人文'),
  ('児童書')
ON CONFLICT (name) DO NOTHING;
