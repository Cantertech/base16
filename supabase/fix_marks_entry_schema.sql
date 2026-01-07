-- FIX MARKS ENTRY SAVING ISSUE
-- The issue is likely missing 'term'/'academic_year' columns OR missing Unique Constraint for UPSERT.

BEGIN;

-- 1. Ensure Columns Exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_results' AND column_name = 'term') THEN
        ALTER TABLE public.exam_results ADD COLUMN term TEXT NOT NULL DEFAULT 'Term 1 2026';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_results' AND column_name = 'academic_year') THEN
        ALTER TABLE public.exam_results ADD COLUMN academic_year TEXT NOT NULL DEFAULT '2026';
    END IF;
END $$;

-- 2. Fix Unique Constraint (CRITICAL for UPSERT)
-- We need to drop any partial unique constraints and ensure the full composite key exists.

-- Drop old potential constraints by name (try common names)
ALTER TABLE public.exam_results DROP CONSTRAINT IF EXISTS exam_results_student_id_class_subject_key;
ALTER TABLE public.exam_results DROP CONSTRAINT IF EXISTS exam_results_student_subject_class_key;
ALTER TABLE public.exam_results DROP CONSTRAINT IF EXISTS exam_results_student_subject_class_term_year_key;

-- Create the Correct Constraint matching the Frontend's UPSERT
-- Frontend uses: onConflict: 'student_id,class,subject,term,academic_year'
ALTER TABLE public.exam_results
ADD CONSTRAINT exam_results_student_id_class_subject_term_academic_year_key 
UNIQUE (student_id, class, subject, term, academic_year);

-- 3. Ensure RLS allows Insert/Update
DROP POLICY IF EXISTS "School staff can insert exam results" ON public.exam_results;
CREATE POLICY "School staff can insert exam results"
ON public.exam_results FOR INSERT
WITH CHECK (
    school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "School staff can update exam results" ON public.exam_results;
CREATE POLICY "School staff can update exam results"
ON public.exam_results FOR UPDATE
USING (
    school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "School staff can select exam results" ON public.exam_results;
CREATE POLICY "School staff can select exam results"
ON public.exam_results FOR SELECT
USING (
    school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

COMMIT;
