-- Migration to add term and academic_year to timetable_entries
-- This allows differentiating timetables across different terms

-- 1. Add columns
ALTER TABLE public.timetable_entries 
ADD COLUMN IF NOT EXISTS term TEXT,
ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- 2. Backfill existing records with the current term of the corresponding school
-- This ensures that when we enable filtering by term in the UI, the current visible timetable doesn't disappear.
UPDATE public.timetable_entries te
SET 
  term = s.current_term,
  academic_year = s.academic_year
FROM public.schools s
WHERE te.school_id = s.id
  AND te.term IS NULL;

-- 3. Create Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_timetable_term ON public.timetable_entries(school_id, term, academic_year);
