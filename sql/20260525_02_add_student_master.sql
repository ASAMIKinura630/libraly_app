-- =====================================================
-- 20260525_02_add_student_master.sql
-- 学生マスタ 仮データ 3件
--
-- 【重要】20260525_04 実行後のスキーマ（department_id）用です。
-- faculty / department 列は使いません。
--
-- 【実行順】
--   1. 20260525_04_add_faculty_department_master.sql  ← 先に必須
--   2. 本ファイル（3件）
--   3. 20260525_03_insert_student_test_data.sql（47件・任意）
--   4. 20260525_05_grant_faculty_department_crud.sql（任意）
-- =====================================================

-- テーブルが未作成の場合のみ（04 実行後で student テーブルが無いとき）
CREATE TABLE IF NOT EXISTS public.libraly_app_student (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_number  text        NOT NULL UNIQUE,
  name            text        NOT NULL,
  department_id   uuid        NOT NULL REFERENCES public.libraly_app_department(id) ON DELETE RESTRICT,
  birth_date      text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT libraly_app_student_birth_date_format CHECK (
    birth_date ~ '^\d{8}$'
    AND birth_date = to_char(to_date(birth_date, 'YYYYMMDD'), 'YYYYMMDD')
  )
);

CREATE INDEX IF NOT EXISTS libraly_app_student_name_idx
  ON public.libraly_app_student (name);

CREATE INDEX IF NOT EXISTS libraly_app_student_department_id_idx
  ON public.libraly_app_student (department_id);

ALTER TABLE public.libraly_app_student DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app_student TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.libraly_app_student TO authenticated;

-- 仮データ 3件（学部名・学科名から department_id を解決）
INSERT INTO public.libraly_app_student (student_number, name, department_id, birth_date)
SELECT v.student_number, v.name, d.id, v.birth_date
FROM (VALUES
  ('20240001', '山田 太郎', '工学部', '情報工学科', '20020415'),
  ('20240002', '佐藤 花子', '文学部', '日本文学科', '20010820'),
  ('20240003', '鈴木 一郎', '経済学部', '経営学科', '20031103')
) AS v(student_number, name, faculty_name, department_name, birth_date)
JOIN public.libraly_app_faculty AS f ON f.name = v.faculty_name
JOIN public.libraly_app_department AS d ON d.faculty_id = f.id AND d.name = v.department_name
ON CONFLICT (student_number) DO NOTHING;
