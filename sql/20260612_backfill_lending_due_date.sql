-- =====================================================
-- 20260612_backfill_lending_due_date.sql
-- 返却予定日（due_date）が未設定の貸出履歴を、
-- 貸し出し日（created_at）の 14 日後で補完する
--
-- 前提: public.libraly_app_lending_history に due_date 列が存在すること
--       （20260525_06 または 20260601 実行済み）
-- 再実行可: due_date IS NULL の行のみ更新
-- =====================================================

UPDATE public.libraly_app_lending_history
SET due_date = ((created_at AT TIME ZONE 'Asia/Tokyo')::date + 14)
WHERE due_date IS NULL
  AND created_at IS NOT NULL;

-- 確認用（実行後、0 件であること）
-- SELECT count(*) FROM public.libraly_app_lending_history WHERE due_date IS NULL;
