
-- Fix Exam Results Year Mismatch
-- Moves marks improperly defaulted to '2024/2025' to '2025/2026' so they appear in the dashboard.

UPDATE public.exam_results
SET academic_year = '2025/2026'
WHERE academic_year = '2024/2025';

-- Also ensure Term is correct if it was defaulted to 'First Term' but you are in 'Second Term'
-- Uncomment the line below ONLY if you are sure ALL your current marks belong to Second Term:
-- UPDATE public.exam_results SET term = 'Second Term' WHERE term = 'First Term';
