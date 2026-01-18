-- Fix Exams Module for Term/Year preservation

-- 1. Add Term/Year columns to exam_results
ALTER TABLE exam_results 
ADD COLUMN IF NOT EXISTS term TEXT,
ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- 2. Add Term/Year columns to exam_submissions
ALTER TABLE exam_submissions 
ADD COLUMN IF NOT EXISTS term TEXT,
ADD COLUMN IF NOT EXISTS academic_year TEXT;

-- 3. Update Unique Constraints to prevent overwriting across terms
ALTER TABLE exam_results DROP CONSTRAINT IF EXISTS exam_results_student_id_class_subject_key;
-- Add new constraint (handle NULLs just in case, but usually we want them set)
-- Note: NULL != NULL in SQL uniqueness, so we should ensure they correspond to active term
ALTER TABLE exam_results 
ADD CONSTRAINT exam_results_term_unique UNIQUE (student_id, class, subject, term, academic_year);

ALTER TABLE exam_submissions DROP CONSTRAINT IF EXISTS exam_submissions_school_id_class_subject_key;
ALTER TABLE exam_submissions 
ADD CONSTRAINT exam_submissions_term_unique UNIQUE (school_id, class, subject, term, academic_year);

-- 4. Backfill existing data with current school term info
UPDATE exam_results e
SET term = s.current_term,
    academic_year = s.academic_year
FROM schools s
WHERE e.school_id = s.id
AND e.term IS NULL;

UPDATE exam_submissions e
SET term = s.current_term,
    academic_year = s.academic_year
FROM schools s
WHERE e.school_id = s.id
AND e.term IS NULL;

-- 5. Update Policies (Optional but good practice if RLS relies on it, here strict school_id is enough)

