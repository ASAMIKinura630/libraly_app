-- =====================================================
-- 20260525_04_add_faculty_department_master.sql
-- 学部マスタ・学科マスタの作成
-- 学生マスタを department_id 参照に移行
-- RLS: OFF
-- 前提: 20260525_02_add_student_master.sql 実行済み（任意で 03 も）
-- 仕様: docs/02_DB仕様書.md
-- =====================================================

-- -----------------------------------------------------
-- 1. 学部マスタ
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.libraly_app_faculty (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.libraly_app_faculty IS '学部マスタ';
COMMENT ON COLUMN public.libraly_app_faculty.id IS '学部識別子（自動採番）';
COMMENT ON COLUMN public.libraly_app_faculty.name IS '学部名';

ALTER TABLE public.libraly_app_faculty DISABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.libraly_app_faculty TO anon;
GRANT SELECT ON public.libraly_app_faculty TO authenticated;

-- -----------------------------------------------------
-- 2. 学科マスタ（学部が親）
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.libraly_app_department (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id  uuid        NOT NULL REFERENCES public.libraly_app_faculty(id) ON DELETE RESTRICT,
  name        text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT libraly_app_department_faculty_name_key UNIQUE (faculty_id, name)
);

COMMENT ON TABLE public.libraly_app_department IS '学科マスタ';
COMMENT ON COLUMN public.libraly_app_department.faculty_id IS '所属学部（親）';
COMMENT ON COLUMN public.libraly_app_department.name IS '学科名';

CREATE INDEX IF NOT EXISTS libraly_app_department_faculty_id_idx
  ON public.libraly_app_department (faculty_id);

ALTER TABLE public.libraly_app_department DISABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.libraly_app_department TO anon;
GRANT SELECT ON public.libraly_app_department TO authenticated;

-- -----------------------------------------------------
-- 3. マスタ初期データ
-- -----------------------------------------------------
INSERT INTO public.libraly_app_faculty (name)
VALUES
  ('工学部'),
  ('文学部'),
  ('経済学部'),
  ('法学部'),
  ('理学部'),
  ('教育学部'),
  ('医学部')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.libraly_app_department (faculty_id, name)
SELECT f.id, d.name
FROM (VALUES
  ('工学部', '情報工学科'),
  ('工学部', '機械工学科'),
  ('工学部', '電気工学科'),
  ('工学部', '建築学科'),
  ('文学部', '日本文学科'),
  ('文学部', '英文学科'),
  ('文学部', '史学専攻'),
  ('経済学部', '経営学科'),
  ('経済学部', '経済学科'),
  ('経済学部', '商学科'),
  ('法学部', '法律学科'),
  ('法学部', '政治学科'),
  ('理学部', '数学科'),
  ('理学部', '物理学科'),
  ('理学部', '化学科'),
  ('教育学部', '教育学科'),
  ('教育学部', '心理学科'),
  ('医学部', '医学科')
) AS d(faculty_name, name)
JOIN public.libraly_app_faculty AS f ON f.name = d.faculty_name
ON CONFLICT (faculty_id, name) DO NOTHING;

-- -----------------------------------------------------
-- 4. 学生マスタ：既存データの移行（faculty / department 列がある場合）
-- -----------------------------------------------------
ALTER TABLE public.libraly_app_student
  ADD COLUMN IF NOT EXISTS department_id uuid NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'libraly_app_student'
      AND column_name = 'faculty'
  ) THEN
    INSERT INTO public.libraly_app_faculty (name)
    SELECT DISTINCT faculty
    FROM public.libraly_app_student
    WHERE faculty IS NOT NULL AND faculty <> ''
    ON CONFLICT (name) DO NOTHING;

    INSERT INTO public.libraly_app_department (faculty_id, name)
    SELECT DISTINCT f.id, s.department
    FROM public.libraly_app_student AS s
    JOIN public.libraly_app_faculty AS f ON f.name = s.faculty
    WHERE s.department IS NOT NULL AND s.department <> ''
    ON CONFLICT (faculty_id, name) DO NOTHING;

    UPDATE public.libraly_app_student AS s
    SET department_id = d.id
    FROM public.libraly_app_department AS d
    JOIN public.libraly_app_faculty AS f ON f.id = d.faculty_id
    WHERE s.faculty = f.name
      AND s.department = d.name
      AND s.department_id IS NULL;

    ALTER TABLE public.libraly_app_student DROP COLUMN IF EXISTS faculty;
    ALTER TABLE public.libraly_app_student DROP COLUMN IF EXISTS department;
  END IF;
END $$;

DROP INDEX IF EXISTS public.libraly_app_student_faculty_idx;

-- -----------------------------------------------------
-- 5. 外部キー・NOT NULL
-- -----------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'libraly_app_student_department_id_fkey'
  ) THEN
    ALTER TABLE public.libraly_app_student
      ADD CONSTRAINT libraly_app_student_department_id_fkey
      FOREIGN KEY (department_id)
      REFERENCES public.libraly_app_department (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

COMMENT ON COLUMN public.libraly_app_student.department_id IS '学科（学科マスタ参照・必須）';

CREATE INDEX IF NOT EXISTS libraly_app_student_department_id_idx
  ON public.libraly_app_student (department_id);

-- 既存行がある場合は department_id を埋めてから NOT NULL にする
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.libraly_app_student WHERE department_id IS NULL
  ) THEN
    RAISE EXCEPTION 'department_id が NULL の学生が残っています。学部・学科マスタと既存データの対応を確認してください。';
  END IF;

  ALTER TABLE public.libraly_app_student
    ALTER COLUMN department_id SET NOT NULL;
END $$;
