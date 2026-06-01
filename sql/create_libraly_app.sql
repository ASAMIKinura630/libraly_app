-- =====================================================
-- 図書館保守システム — DB作成用SQL
-- テーブル: public.libraly_app
-- RLS: OFF（Row Level Security は使用しない）
-- =====================================================
--
-- 【実行方法】
--   Supabase ダッシュボード → SQL Editor → New query
--   本ファイルの内容を貼り付けて Run
--
-- 【前提】
--   - 初回作成用（テーブルが既にある場合はエラーになります）
--   - user_id カラムなし / 認証連携なし
--
-- 仕様: docs/02.DB仕様書.md
-- =====================================================

-- -----------------------------------------------------
-- 1. テーブル作成
-- -----------------------------------------------------
CREATE TABLE public.libraly_app (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  content     text        NOT NULL,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- -----------------------------------------------------
-- 2. コメント
-- -----------------------------------------------------
COMMENT ON TABLE public.libraly_app IS '図書一覧';
COMMENT ON COLUMN public.libraly_app.id IS 'レコード識別子（自動採番）';
COMMENT ON COLUMN public.libraly_app.title IS 'タイトル';
COMMENT ON COLUMN public.libraly_app.content IS 'あらすじ';
COMMENT ON COLUMN public.libraly_app.name IS '著者';
COMMENT ON COLUMN public.libraly_app.created_at IS '作成日時';

-- -----------------------------------------------------
-- 3. インデックス（一覧を新しい順で表示するため）
-- -----------------------------------------------------
CREATE INDEX libraly_app_created_at_idx
  ON public.libraly_app (created_at DESC);

-- -----------------------------------------------------
-- 4. RLS — OFF（まだ有効化しない）
-- -----------------------------------------------------
ALTER TABLE public.libraly_app DISABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- 5. API（anon / authenticated）からの CRUD 権限
--     RLS が OFF でも、ロールに GRANT が必要です
-- -----------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app TO authenticated;
