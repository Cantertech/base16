
-- 1. DELETE "Wrong Year" marks if a "Correct Year" mark ALREADY/ALSO exists
-- (This effectively merges duplicates by keeping the one that already has the correct year)
DELETE FROM public.exam_results er
USING public.schools s
WHERE er.school_id = s.id
  AND er.academic_year != (s.exam_config->>'academic_year')
  AND EXISTS (
      -- Check if a record exists with the SAME keys but the CORRECT year
      SELECT 1 FROM public.exam_results correct
      WHERE correct.school_id = er.school_id
        AND correct.student_id = er.student_id
        AND correct.class = er.class
        AND correct.subject = er.subject
        AND correct.term = er.term
        AND correct.academic_year = (s.exam_config->>'academic_year')
  );

-- 2. UPDATE remaining "Wrong Year" marks (which have no conflict) to the Correct Year
UPDATE public.exam_results
SET academic_year = s.exam_config->>'academic_year'
FROM public.schools s
WHERE public.exam_results.school_id = s.id
  AND public.exam_results.academic_year != (s.exam_config->>'academic_year')
  AND s.exam_config->>'academic_year' IS NOT NULL;

-- Output the number of fixed records (for your confirmation)
-- Note: Supabase SQL editor usually shows "Rows affected" automatically.
